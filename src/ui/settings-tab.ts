import { App, PluginSettingTab, Setting } from "obsidian";
import type { MediaCompressionProfile } from "@domain/settings";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import type { RetentionMode, SourceType } from "@domain/types";
import {
  collectRuntimeDiagnostics,
  formatRuntimeDiagnosticsSummary,
  type AppSurface,
  type RuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";
import {
  describeTemplateReference,
  isBuiltinTemplateReference,
  listBuiltinTemplates
} from "@services/obsidian/template-library";
import { listPromptAssets } from "@services/ai/prompt-assets";
import { getSourceGuidance } from "@ui/source-guidance";

const SOURCE_TYPE_OPTIONS: SourceType[] = ["webpage_url", "media_url", "local_media"];
const RETENTION_OPTIONS: RetentionMode[] = ["none", "source", "all"];
const MEDIA_COMPRESSION_OPTIONS: MediaCompressionProfile[] = ["balanced", "quality"];
const CUSTOM_TEMPLATE_OPTION = "__custom__";

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  webpage_url: "網頁 URL",
  media_url: "媒體 URL（YouTube / Podcast）",
  local_media: "本機媒體"
};

const RETENTION_LABELS: Record<RetentionMode, string> = {
  none: "不保留中介產物",
  source: "保留來源與 metadata",
  all: "保留所有產物"
};

const MEDIA_COMPRESSION_LABELS: Record<MediaCompressionProfile, string> = {
  balanced: "平衡（推薦）",
  quality: "高品質"
};

interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface DesktopDialog {
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    properties: string[];
  }): Promise<OpenDialogResult>;
}

function getTemplateDropdownValue(templateReference: string): string {
  if (templateReference.trim().length === 0) {
    return "";
  }

  if (isBuiltinTemplateReference(templateReference)) {
    return templateReference;
  }

  return CUSTOM_TEMPLATE_OPTION;
}

export class AISummarizerSettingTab extends PluginSettingTab {
  private readonly plugin: AISummarizerPlugin;
  private runtimeDiagnostics: RuntimeDiagnosticsSummary | null = null;
  private runtimeDiagnosticsError: string | null = null;
  private diagnosticsLoading = false;

  public constructor(app: App, plugin: AISummarizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private getDesktopDialog(): DesktopDialog | null {
    const maybeWindow = window as Window & {
      require?: (moduleName: string) => unknown;
    };

    const electron = maybeWindow.require?.("electron") as
      | {
          dialog?: DesktopDialog;
          remote?: { dialog?: DesktopDialog };
        }
      | undefined;

    return electron?.dialog ?? electron?.remote?.dialog ?? null;
  }

  private detectAppSurface(): AppSurface {
    return this.getDesktopDialog() ? "desktop" : "mobile";
  }

  private async pickMediaStorageDirectory(): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
      this.plugin.notify("目前環境不支援資料夾選擇器，請手動輸入絕對路徑。");
      return;
    }

    const result = await dialog.showOpenDialog({
      title: "選擇媒體暫存資料夾",
      defaultPath: this.plugin.settings.mediaCacheRoot || undefined,
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    this.plugin.settings.mediaCacheRoot = result.filePaths[0];
    await this.plugin.saveSettings();
    this.runtimeDiagnostics = null;
    this.display();
  }

  private async refreshDiagnostics(): Promise<void> {
    this.diagnosticsLoading = true;
    this.runtimeDiagnosticsError = null;
    this.display();

    try {
      this.runtimeDiagnostics = await collectRuntimeDiagnostics(this.plugin.settings, {
        appSurface: this.detectAppSurface()
      });
    } catch (error) {
      const report = this.plugin.reportError("runtime_diagnostics", error);
      this.runtimeDiagnosticsError = report.modalMessage;
    } finally {
      this.diagnosticsLoading = false;
      this.display();
    }
  }

  private renderTemplateExperience(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "模板輸出設定" });

    const builtinTemplates = listBuiltinTemplates();

    new Setting(containerEl)
      .setName("輸出模板")
      .setDesc("v1 支援預設 frontmatter、內建模板與自訂模板路徑。")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "預設 frontmatter");
        for (const template of builtinTemplates) {
          dropdown.addOption(template.reference, template.label);
        }
        dropdown.addOption(CUSTOM_TEMPLATE_OPTION, "自訂模板");

        dropdown.setValue(getTemplateDropdownValue(this.plugin.settings.templateReference)).onChange(async (value) => {
          if (value === CUSTOM_TEMPLATE_OPTION) {
            if (
              this.plugin.settings.templateReference.trim().length === 0 ||
              isBuiltinTemplateReference(this.plugin.settings.templateReference)
            ) {
              this.plugin.settings.templateReference = "Templates/ai-summary-template.md";
            }
          } else {
            this.plugin.settings.templateReference = value;
          }

          await this.plugin.saveSettings();
          this.display();
        });
      });

    const templateStatusEl = containerEl.createDiv({ cls: "ai-summarizer-template-status" });
    templateStatusEl.setText(describeTemplateReference(this.plugin.settings.templateReference));

    if (getTemplateDropdownValue(this.plugin.settings.templateReference) === CUSTOM_TEMPLATE_OPTION) {
      new Setting(containerEl)
        .setName("自訂模板路徑")
        .setDesc("輸入 vault 內的模板路徑；若找不到檔案，會退回預設 frontmatter。")
        .addText((text) =>
          text
            .setPlaceholder("Templates/ai-summary-template.md")
            .setValue(this.plugin.settings.templateReference)
            .onChange(async (value) => {
              this.plugin.settings.templateReference = value.trim();
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }

    const templateListEl = containerEl.createEl("ul");
    for (const template of builtinTemplates) {
      templateListEl.createEl("li", {
        text: `${template.label}: ${template.description}（適用：${template.supportedSourceTypes
          .map((sourceType) => SOURCE_TYPE_LABELS[sourceType])
          .join("、")}）`
      });
    }
  }

  private renderPromptAssets(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Prompt 資產" });
    containerEl.createEl("p", {
      text: "目前 prompt contract 已收斂成三個固定資產；設定頁只顯示清單，不在 UI 直接編輯。"
    });

    const assetsEl = containerEl.createEl("ul");
    for (const asset of listPromptAssets()) {
      assetsEl.createEl("li", {
        text: `${asset.label}: ${asset.description}（${asset.exportedSymbol} / ${asset.sourcePath}）`
      });
    }
  }

  private renderInputGuidance(containerEl: HTMLElement): void {
    const guidance = getSourceGuidance(this.plugin.settings.lastSourceType);

    containerEl.createEl("h3", { text: "輸入引導" });
    containerEl.createEl("p", {
      text: `目前預設輸入類型：${guidance.label}`
    });

    const guidanceList = containerEl.createEl("ul");
    guidanceList.createEl("li", { text: guidance.description });
    guidanceList.createEl("li", { text: `輸入提示：${guidance.inputHint}` });
    guidanceList.createEl("li", { text: `範例：${guidance.examples.join("、")}` });
    guidanceList.createEl("li", { text: `空值提示：${guidance.emptyValueHint}` });
  }

  private renderDiagnostics(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "執行環境診斷" });

    new Setting(containerEl)
      .setName("Runtime / 依賴摘要")
      .setDesc("檢查桌面/行動環境、yt-dlp、ffmpeg、media cache root 與 capability readiness。")
      .addButton((button) =>
        button
          .setButtonText(this.diagnosticsLoading ? "檢查中..." : "重新檢查")
          .setDisabled(this.diagnosticsLoading)
          .onClick(() => {
            void this.refreshDiagnostics();
          })
      );

    const diagnosticsEl = containerEl.createDiv({ cls: "ai-summarizer-diagnostics" });
    const text = this.runtimeDiagnosticsError
      ? `Diagnostics failed: ${this.runtimeDiagnosticsError}`
      : this.runtimeDiagnostics
        ? formatRuntimeDiagnosticsSummary(this.runtimeDiagnostics).join("\n")
        : this.diagnosticsLoading
          ? "Collecting diagnostics..."
          : "Diagnostics have not been run yet.";

    diagnosticsEl.createEl("pre", { text });
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Summarizer 設定" });

    new Setting(containerEl)
      .setName("Gemini API 金鑰")
      .setDesc("提供目前 plugin 使用的 Gemini API key。")
      .addText((text) =>
        text
          .setPlaceholder("輸入 Gemini API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("模型")
      .setDesc("設定摘要流程預設使用的模型名稱。")
      .addText((text) =>
        text.setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("輸出資料夾")
      .setDesc("AI 摘要寫回 vault 時使用的預設資料夾；留空時會寫到 vault 根目錄。")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
          this.plugin.settings.outputFolder = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("媒體暫存資料夾")
      .setDesc("media URL / local media 的中介產物放置路徑。建議使用 vault 外的絕對路徑。")
      .addText((text) =>
        text
          .setPlaceholder("例如 D:\\AI-Summarizer\\media-cache")
          .setValue(this.plugin.settings.mediaCacheRoot)
          .onChange(async (value) => {
            this.plugin.settings.mediaCacheRoot = value.trim();
            this.runtimeDiagnostics = null;
            await this.plugin.saveSettings();
          })
      )
      .addButton((button) =>
        button.setButtonText("選擇資料夾").onClick(() => {
          void this.pickMediaStorageDirectory();
        })
      );

    new Setting(containerEl)
      .setName("產物保留模式")
      .setDesc("控制 media pipeline 結束後要保留哪些中介檔。")
      .addDropdown((dropdown) => {
        for (const mode of RETENTION_OPTIONS) {
          dropdown.addOption(mode, RETENTION_LABELS[mode]);
        }

        dropdown.setValue(this.plugin.settings.retentionMode).onChange(async (value) => {
          this.plugin.settings.retentionMode = value as RetentionMode;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("媒體壓縮策略")
      .setDesc("控制送進 AI 前的音訊壓縮策略。")
      .addDropdown((dropdown) => {
        for (const profile of MEDIA_COMPRESSION_OPTIONS) {
          dropdown.addOption(profile, MEDIA_COMPRESSION_LABELS[profile]);
        }

        dropdown.setValue(this.plugin.settings.mediaCompressionProfile).onChange(async (value) => {
          this.plugin.settings.mediaCompressionProfile = value as MediaCompressionProfile;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("預設輸入類型")
      .setDesc("決定打開 AI 摘要器 modal 時預設顯示哪一種輸入。")
      .addDropdown((dropdown) => {
        for (const sourceType of SOURCE_TYPE_OPTIONS) {
          dropdown.addOption(sourceType, SOURCE_TYPE_LABELS[sourceType]);
        }

        dropdown.setValue(this.plugin.settings.lastSourceType).onChange(async (value) => {
          this.plugin.settings.lastSourceType = value as SourceType;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("除錯模式")
      .setDesc("開啟後會輸出更多 plugin log。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );

    this.renderTemplateExperience(containerEl);
    this.renderPromptAssets(containerEl);
    this.renderInputGuidance(containerEl);
    this.renderDiagnostics(containerEl);

    if (!this.runtimeDiagnostics && !this.diagnosticsLoading) {
      void this.refreshDiagnostics();
    }
  }
}
