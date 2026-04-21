import { App, PluginSettingTab, Setting } from "obsidian";
import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";
import type { RetentionMode, SourceType } from "@domain/types";

const SOURCE_TYPE_OPTIONS: SourceType[] = ["webpage_url", "media_url", "local_media"];
const RETENTION_OPTIONS: RetentionMode[] = ["none", "source", "all"];

export class MediaSummarizerSettingTab extends PluginSettingTab {
  private readonly plugin: MediaSummarizerPlugin;

  public constructor(app: App, plugin: MediaSummarizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Summarizer Settings" });

    new Setting(containerEl)
      .setName("Gemini API key")
      .setDesc("Stored in plugin data. This value is never written into notes.")
      .addText((text) =>
        text
          .setPlaceholder("Enter Gemini API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Default model for summarization jobs.")
      .addText((text) =>
        text.setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Vault folder path for generated notes. Empty means vault root.")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
          this.plugin.settings.outputFolder = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Template reference")
      .setDesc("Template note path or template identifier.")
      .addText((text) =>
        text.setValue(this.plugin.settings.templateReference).onChange(async (value) => {
          this.plugin.settings.templateReference = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Retention mode")
      .setDesc("none: remove source artifacts, source: keep source, all: keep all available artifacts.")
      .addDropdown((dropdown) => {
        for (const mode of RETENTION_OPTIONS) {
          dropdown.addOption(mode, mode);
        }
        dropdown.setValue(this.plugin.settings.retentionMode).onChange(async (value) => {
          this.plugin.settings.retentionMode = value as RetentionMode;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default source type")
      .setDesc("Used as default source type for the next run.")
      .addDropdown((dropdown) => {
        for (const sourceType of SOURCE_TYPE_OPTIONS) {
          dropdown.addOption(sourceType, sourceType);
        }
        dropdown.setValue(this.plugin.settings.lastSourceType).onChange(async (value) => {
          this.plugin.settings.lastSourceType = value as SourceType;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Debug mode")
      .setDesc("Enable verbose plugin logs in developer console.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
