import { Setting } from "obsidian";

export interface AiModelsSectionOptions {
  modelDataListRefreshInProgress: boolean;
  onRefreshManagedModelDataLists: () => void;
  renderManagedSummarySettings: (containerEl: HTMLElement) => void;
  renderManagedTranscriptionSettings: (containerEl: HTMLElement) => void;
  renderTranscriptCleanupSettings: (containerEl: HTMLElement) => void;
}

export function renderAiModelsSection(
  containerEl: HTMLElement,
  options: AiModelsSectionOptions
): void {
  new Setting(containerEl)
    .setName("模型清單更新")
    .setDesc("自動完成會使用 Gemini / OpenRouter / Mistral 官方模型清單；Mistral 需要先填 API Key。")
    .addButton((button) =>
      button
        .setButtonText(options.modelDataListRefreshInProgress ? "更新中..." : "更新")
        .setDisabled(options.modelDataListRefreshInProgress)
        .onClick(() => {
          options.onRefreshManagedModelDataLists();
        })
    );

  options.renderManagedTranscriptionSettings(containerEl);
  options.renderManagedSummarySettings(containerEl);
  options.renderTranscriptCleanupSettings(containerEl);
}
