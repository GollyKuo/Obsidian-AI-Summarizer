import { App, PluginSettingTab, Setting } from "obsidian";
import {
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  normalizeSummaryModel,
  type MediaCompressionProfile,
  type SummaryModel,
  type SummaryProvider,
  type TranscriptionModel,
  type TranscriptionProvider
} from "@domain/settings";
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
  media_url: "媒體 URL",
  local_media: "本機媒體"
};

const RETENTION_LABELS: Record<RetentionMode, string> = {
  none: "流程結束後刪除暫存產物",
  source: "保留來源檔與 metadata",
  all: "保留全部暫存產物"
};

const MEDIA_COMPRESSION_LABELS: Record<MediaCompressionProfile, string> = {
  balanced: "平衡：較小體積，適合日常轉錄",
  quality: "品質：保留較高音質"
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

function getSelectedModelDescription(
  provider: SummaryProvider | TranscriptionProvider,
  model: SummaryModel | TranscriptionModel
): string {
  const options =
    provider === "openrouter" ? OPENROUTER_SUMMARY_MODEL_OPTIONS : GEMINI_MODEL_OPTIONS;
  return options.find((option) => option.value === model)?.description ?? "";
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
      this.plugin.notify("目前環境不支援目錄挑選，請直接輸入絕對路徑。");
      return;
    }

    const result = await dialog.showOpenDialog({
      title: "選擇媒體快取資料夾",
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

  private renderProviderSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Provider 與模型" });

    new Setting(containerEl)
      .setName("Gemini API Key")
      .setDesc("Gemini 轉錄與摘要共用的 API Key。")
      .addText((text) =>
        text
          .setPlaceholder("輸入 Gemini API Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("轉錄 Provider")
      .setDesc("media URL 與本機媒體的音訊轉錄 provider。v1 先固定使用 Gemini。")
      .addDropdown((dropdown) => {
        for (const option of TRANSCRIPTION_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown
          .setValue(this.plugin.settings.transcriptionProvider)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionProvider = value as TranscriptionProvider;
            this.plugin.settings.transcriptionModel = getTranscriptionModelOptions()[0].value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("轉錄模型")
      .setDesc("負責 audio/video 到 transcript。建議優先選穩定的 Gemini audio-capable 模型。")
      .addDropdown((dropdown) => {
        for (const option of getTranscriptionModelOptions()) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown
          .setValue(this.plugin.settings.transcriptionModel)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionModel = value as TranscriptionModel;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    containerEl.createEl("p", {
      text: getSelectedModelDescription(
        this.plugin.settings.transcriptionProvider,
        this.plugin.settings.transcriptionModel
      )
    });

    new Setting(containerEl)
      .setName("摘要 Provider")
      .setDesc("網頁摘要與逐字稿摘要使用的 provider。Gemini 為預設，OpenRouter 適合 transcript-first 路徑。")
      .addDropdown((dropdown) => {
        for (const option of SUMMARY_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(this.plugin.settings.summaryProvider).onChange(async (value) => {
          const provider = value as SummaryProvider;
          this.plugin.settings.summaryProvider = provider;
          this.plugin.settings.summaryModel = normalizeSummaryModel(provider, "");
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("摘要模型")
      .setDesc("摘要模型只負責整理文字內容，不承擔音訊轉錄。")
      .addDropdown((dropdown) => {
        for (const option of getSummaryModelOptions(this.plugin.settings.summaryProvider)) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(this.plugin.settings.summaryModel).onChange(async (value) => {
          this.plugin.settings.summaryModel = value as SummaryModel;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    containerEl.createEl("p", {
      text: getSelectedModelDescription(
        this.plugin.settings.summaryProvider,
        this.plugin.settings.summaryModel
      )
    });

    if (this.plugin.settings.summaryProvider === "openrouter") {
      new Setting(containerEl)
        .setName("OpenRouter API Key")
        .setDesc("只在摘要 Provider 選擇 OpenRouter 時使用。")
        .addText((text) =>
          text
            .setPlaceholder("輸入 OpenRouter API Key")
            .setValue(this.plugin.settings.openRouterApiKey)
            .onChange(async (value) => {
              this.plugin.settings.openRouterApiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }
  }

  private renderTemplateExperience(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "筆記模板" });

    const builtinTemplates = listBuiltinTemplates();

    new Setting(containerEl)
      .setName("模板來源")
      .setDesc("可使用內建模板或指定 vault 內的自訂模板。")
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
        .setDesc("請填入 vault 內的相對路徑，例如 `Templates/ai-summary-template.md`。")
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
        text: `${template.label}: ${template.description}。支援 ${template.supportedSourceTypes
          .map((sourceType) => SOURCE_TYPE_LABELS[sourceType])
          .join("、")}`
      });
    }
  }

  private renderPromptAssets(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Prompt 資產" });
    containerEl.createEl("p", {
      text: "這裡列出目前程式內建的 prompt contract 與資產來源，方便追蹤設定頁、流程與測試是否對齊。"
    });

    const assetsEl = containerEl.createEl("ul");
    for (const asset of listPromptAssets()) {
      assetsEl.createEl("li", {
        text: `${asset.label}: ${asset.description} (${asset.exportedSymbol} / ${asset.sourcePath})`
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
    guidanceList.createEl("li", { text: `輸入格式：${guidance.inputHint}` });
    guidanceList.createEl("li", { text: `範例：${guidance.examples.join("、")}` });
    guidanceList.createEl("li", { text: `空值提示：${guidance.emptyValueHint}` });
  }

  private renderDiagnostics(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "執行環境診斷" });

    new Setting(containerEl)
      .setName("Runtime / 依賴檢查")
      .setDesc("檢查桌面/行動端環境、yt-dlp、ffmpeg、ffprobe、cache root 與 capability readiness。")
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

    this.renderProviderSettings(containerEl);

    new Setting(containerEl)
      .setName("輸出資料夾")
      .setDesc("摘要筆記寫入 vault 的相對資料夾；空值表示寫到 vault 根目錄。")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
          this.plugin.settings.outputFolder = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("媒體快取資料夾")
      .setDesc("media URL 與本機媒體流程的暫存目錄。請填入絕對路徑，避免寫進 vault。")
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
      .setDesc("控制 media pipeline 完成後保留哪些暫存產物。")
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
      .setDesc("控制送進轉錄階段前的音訊壓縮品質。")
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
      .setDesc("開啟 AI 摘要器時預先選中的輸入類型。")
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
