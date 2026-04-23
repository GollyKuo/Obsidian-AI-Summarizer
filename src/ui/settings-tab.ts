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

const SOURCE_TYPE_OPTIONS: SourceType[] = ["webpage_url", "media_url", "local_media"];
const RETENTION_OPTIONS: RetentionMode[] = ["none", "source", "all"];
const MEDIA_COMPRESSION_OPTIONS: MediaCompressionProfile[] = ["balanced", "quality"];

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
  balanced: "平衡（預設）",
  quality: "品質優先"
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
      this.plugin.notify("目前環境不支援資料夾選擇器，請直接輸入絕對路徑。");
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
      const message = error instanceof Error ? error.message : String(error);
      this.runtimeDiagnosticsError = message;
      this.plugin.log("error", `Failed to collect runtime diagnostics: ${message}`);
    } finally {
      this.diagnosticsLoading = false;
      this.display();
    }
  }

  private renderDiagnostics(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "執行環境診斷" });

    new Setting(containerEl)
      .setName("Runtime / 依賴摘要")
      .setDesc("檢查桌面/行動端環境、media cache root 與本機依賴可用性。")
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
    containerEl.createEl("h2", { text: "AI 摘要器設定" });

    new Setting(containerEl)
      .setName("Gemini API 金鑰")
      .setDesc("填入 plugin 使用的 Gemini API 金鑰。")
      .addText((text) =>
        text
          .setPlaceholder("輸入 Gemini API 金鑰")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("模型")
      .setDesc("預設摘要流程使用的模型名稱。")
      .addText((text) =>
        text.setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("輸出資料夾")
      .setDesc("摘要筆記會寫入 Vault 內的相對路徑。留空時寫到 Vault 根目錄。")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
          this.plugin.settings.outputFolder = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("媒體暫存資料夾")
      .setDesc("媒體流程的中介產物預設不寫入 Vault，請設定外部絕對路徑或留空使用系統快取。")
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
      .setName("模板參考")
      .setDesc("輸入預設筆記模板參考值，供 note output 使用。")
      .addText((text) =>
        text.setValue(this.plugin.settings.templateReference).onChange(async (value) => {
          this.plugin.settings.templateReference = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("產物保留模式")
      .setDesc("控制媒體流程結束後保留哪些中介產物。")
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
      .setName("媒體壓縮設定")
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
      .setName("預設來源類型")
      .setDesc("開啟摘要流程時預先選擇的來源類型。")
      .addDropdown((dropdown) => {
        for (const sourceType of SOURCE_TYPE_OPTIONS) {
          dropdown.addOption(sourceType, SOURCE_TYPE_LABELS[sourceType]);
        }

        dropdown.setValue(this.plugin.settings.lastSourceType).onChange(async (value) => {
          this.plugin.settings.lastSourceType = value as SourceType;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("除錯模式")
      .setDesc("啟用後會輸出較詳細的 plugin log。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );

    this.renderDiagnostics(containerEl);

    if (!this.runtimeDiagnostics && !this.diagnosticsLoading) {
      void this.refreshDiagnostics();
    }
  }
}
