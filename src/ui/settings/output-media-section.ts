import { Setting } from "obsidian";

import type { AISummarizerPluginSettings, MediaCompressionProfile } from "@domain/settings";
import type { RetentionMode, SourceType } from "@domain/types";
import {
  MEDIA_COMPRESSION_LABELS,
  RETENTION_LABELS,
  SOURCE_TYPE_LABELS
} from "@ui/settings-copy";

const SOURCE_TYPE_OPTIONS: SourceType[] = ["webpage_url", "media_url", "local_media", "transcript_file"];
const RETENTION_OPTIONS: RetentionMode[] = ["delete_temp", "keep_temp"];
const MEDIA_COMPRESSION_OPTIONS: MediaCompressionProfile[] = ["balanced", "quality"];

export interface OutputMediaSectionOptions {
  settings: AISummarizerPluginSettings;
  saveSettings: () => Promise<void>;
  onInvalidateRuntimeDiagnostics: () => void;
  onPickMediaStorageDirectory: () => void;
  onPickOutputFolder: () => void;
  onSourceTypeChanged: () => void;
}

export function renderOutputMediaSection(
  containerEl: HTMLElement,
  options: OutputMediaSectionOptions
): void {
  new Setting(containerEl)
    .setName("輸出資料夾")
    .setDesc("摘要筆記寫入 vault 的相對資料夾；空值表示寫到 vault 根目錄。")
    .addText((text) =>
      text.setValue(options.settings.outputFolder).onChange(async (value) => {
        options.settings.outputFolder = value.trim();
        await options.saveSettings();
      })
    )
    .addButton((button) =>
      button.setButtonText("搜尋資料夾").onClick(() => {
        options.onPickOutputFolder();
      })
    );

  new Setting(containerEl)
    .setName("媒體暫存檔保留")
    .setDesc("控制媒體流程完成後，是否保留原始下載、轉檔音訊與逐字稿。")
    .addDropdown((dropdown) => {
      for (const mode of RETENTION_OPTIONS) {
        dropdown.addOption(mode, RETENTION_LABELS[mode]);
      }

      dropdown.setValue(options.settings.retentionMode).onChange(async (value) => {
        options.settings.retentionMode = value as RetentionMode;
        await options.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("媒體暫存資料夾")
    .setDesc("媒體流程的暫存目錄。請填入絕對路徑，避免寫進 vault。")
    .addText((text) =>
      text
        .setPlaceholder("例如 D:\\AI-Summarizer\\media-cache")
        .setValue(options.settings.mediaCacheRoot)
        .onChange(async (value) => {
          options.settings.mediaCacheRoot = value.trim();
          options.onInvalidateRuntimeDiagnostics();
          await options.saveSettings();
        })
    )
    .addButton((button) =>
      button.setButtonText("選擇資料夾").onClick(() => {
        options.onPickMediaStorageDirectory();
      })
    );

  new Setting(containerEl)
    .setName("媒體壓縮策略")
    .setDesc("控制送進轉錄階段前的音訊壓縮品質。")
    .addDropdown((dropdown) => {
      for (const profile of MEDIA_COMPRESSION_OPTIONS) {
        dropdown.addOption(profile, MEDIA_COMPRESSION_LABELS[profile]);
      }

      dropdown.setValue(options.settings.mediaCompressionProfile).onChange(async (value) => {
        options.settings.mediaCompressionProfile = value as MediaCompressionProfile;
        await options.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("預設輸入類型")
    .setDesc("開啟 AI 摘要器時預先選中的輸入類型。")
    .addDropdown((dropdown) => {
      for (const sourceType of SOURCE_TYPE_OPTIONS) {
        dropdown.addOption(sourceType, SOURCE_TYPE_LABELS[sourceType]);
      }

      dropdown.setValue(options.settings.lastSourceType).onChange(async (value) => {
        options.settings.lastSourceType = value as SourceType;
        await options.saveSettings();
        options.onSourceTypeChanged();
      });
    });
}
