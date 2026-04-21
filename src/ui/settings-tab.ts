import { App, PluginSettingTab, Setting } from "obsidian";
import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";
import type { RetentionMode, SourceType } from "@domain/types";

const SOURCE_TYPE_OPTIONS: SourceType[] = ["webpage_url", "media_url", "local_media"];
const RETENTION_OPTIONS: RetentionMode[] = ["none", "source", "all"];
const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  webpage_url: "網頁 URL",
  media_url: "媒體 URL（YouTube/Podcast）",
  local_media: "本機媒體"
};
const RETENTION_LABELS: Record<RetentionMode, string> = {
  none: "不保留中間檔案",
  source: "保留來源檔案",
  all: "保留全部可用中間檔案"
};

export class MediaSummarizerSettingTab extends PluginSettingTab {
  private readonly plugin: MediaSummarizerPlugin;

  public constructor(app: App, plugin: MediaSummarizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI 摘要器設定" });

    new Setting(containerEl)
      .setName("Gemini API 金鑰")
      .setDesc("儲存在 plugin 設定資料，不會寫入筆記內容。")
      .addText((text) =>
        text
          .setPlaceholder("請輸入 Gemini API 金鑰")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("模型")
      .setDesc("摘要流程預設使用的模型。")
      .addText((text) =>
        text.setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("輸出資料夾")
      .setDesc("生成筆記的 Vault 路徑。留空代表放在 Vault 根目錄。")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
          this.plugin.settings.outputFolder = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("模板參照")
      .setDesc("可填模板筆記路徑或模板識別值。")
      .addText((text) =>
        text.setValue(this.plugin.settings.templateReference).onChange(async (value) => {
          this.plugin.settings.templateReference = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("保留模式")
      .setDesc("控制來源檔與中間產物是否保留。")
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
      .setName("預設來源類型")
      .setDesc("下次開啟流程時預設選用的來源類型。")
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
      .setDesc("在開發者主控台輸出更完整的 plugin log。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
