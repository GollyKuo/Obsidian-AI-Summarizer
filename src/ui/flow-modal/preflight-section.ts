import type {
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";
import {
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  getFirstModelIdForProvider,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  normalizeSummaryModel,
  normalizeTranscriptionModelForProvider,
  type AISummarizerPluginSettings
} from "@domain/settings";
import type { RetentionMode, SourceType } from "@domain/types";
import {
  createCustomTemplateReference,
  getCustomTemplatePath,
  isBuiltinTemplateReference,
  listBuiltinTemplates,
  UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE
} from "@services/obsidian/template-library";
import {
  FLASHCARD_MARKER_LABEL,
  FLASHCARD_MARKER_TOOLTIP
} from "@ui/flow-modal/copy";

const CUSTOM_TEMPLATE_OPTION = "__custom__";

const RETENTION_LABELS: Record<RetentionMode, string> = {
  delete_temp: "保留必要輸出",
  keep_temp: "保留媒體暫存"
};

export interface FlowPreflightSectionOptions {
  isBusy: boolean;
  mediaDiagnosticsLoading: boolean;
  mediaReadinessState: "unchecked" | "checking" | "ready" | "warning" | "error";
  mediaReadinessText: string;
  mediaReadinessTooltip: string;
  settings: AISummarizerPluginSettings;
  shouldShowMediaDiagnosticsEntry: boolean;
  shouldShowMediaReadiness: boolean;
  sourceType: SourceType;
  onOpenSettingsTab: () => void;
  onPickOutputFolder: () => void;
  onRefresh: () => void;
  onRefreshMediaReadiness: () => void;
  saveSettings: () => Promise<void>;
}

function getTemplateDropdownValue(templateReference: string): string {
  if (isBuiltinTemplateReference(templateReference)) {
    return UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE;
  }

  return CUSTOM_TEMPLATE_OPTION;
}

function createPreflightField(containerEl: HTMLElement, label: string): HTMLElement {
  const fieldEl = containerEl.createDiv({ cls: "ai-summarizer-preflight-field" });
  fieldEl.createEl("label", {
    cls: "ai-summarizer-preflight-label",
    text: label
  });
  return fieldEl;
}

export function renderPreflightSection(
  containerEl: HTMLElement,
  options: FlowPreflightSectionOptions
): void {
  const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-section ai-summarizer-preflight" });
  sectionEl.createEl("h3", {
    cls: "ai-summarizer-section-title",
    text: "執行前摘要"
  });

  const fieldsEl = sectionEl.createDiv({ cls: "ai-summarizer-preflight-fields" });

  const templateFieldEl = createPreflightField(fieldsEl, "模板");
  const templateSelectEl = templateFieldEl.createEl("select", {
    cls: "ai-summarizer-preflight-control"
  });
  templateSelectEl.disabled = options.isBusy;
  templateSelectEl.createEl("option", {
    attr: { value: UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE },
    text: "預設通用 Frontmatter"
  });
  for (const template of listBuiltinTemplates()) {
    if (template.reference === UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE) {
      continue;
    }
    templateSelectEl.createEl("option", {
      attr: { value: template.reference },
      text: template.label
    });
  }
  templateSelectEl.createEl("option", {
    attr: { value: CUSTOM_TEMPLATE_OPTION },
    text: "自訂模板"
  });
  templateSelectEl.value = getTemplateDropdownValue(options.settings.templateReference);
  templateSelectEl.addEventListener("change", () => {
    const selectedValue = templateSelectEl.value;
    if (selectedValue === CUSTOM_TEMPLATE_OPTION) {
      if (
        options.settings.templateReference.trim().length === 0 ||
        isBuiltinTemplateReference(options.settings.templateReference)
      ) {
        options.settings.templateReference = createCustomTemplateReference("Templates/ai-summary-template.md");
      }
    } else {
      options.settings.templateReference = selectedValue;
    }

    void options.saveSettings().then(() => {
      options.onRefresh();
    });
  });

  if (getTemplateDropdownValue(options.settings.templateReference) === CUSTOM_TEMPLATE_OPTION) {
    const customTemplateInputEl = templateFieldEl.createEl("input", {
      cls: "ai-summarizer-preflight-control ai-summarizer-preflight-template-path"
    });
    customTemplateInputEl.type = "text";
    customTemplateInputEl.disabled = options.isBusy;
    customTemplateInputEl.placeholder = "Templates/ai-summary-template.md";
    customTemplateInputEl.value = getCustomTemplatePath(options.settings.templateReference);
    customTemplateInputEl.addEventListener("change", () => {
      options.settings.templateReference = createCustomTemplateReference(customTemplateInputEl.value);
      void options.saveSettings();
    });
  }

  const transcriptionModelFieldEl = createPreflightField(fieldsEl, "轉錄");
  const transcriptionModelControlsEl = transcriptionModelFieldEl.createDiv({
    cls: "ai-summarizer-preflight-model-controls"
  });
  const transcriptionProviderSelectEl = transcriptionModelControlsEl.createEl("select", {
    cls: "ai-summarizer-preflight-control ai-summarizer-preflight-provider-control"
  });
  transcriptionProviderSelectEl.disabled = options.isBusy;
  for (const option of TRANSCRIPTION_PROVIDER_OPTIONS) {
    transcriptionProviderSelectEl.createEl("option", {
      attr: { value: option.value },
      text: option.label
    });
  }
  transcriptionProviderSelectEl.value = options.settings.transcriptionProvider;
  transcriptionProviderSelectEl.addEventListener("change", () => {
    const provider = transcriptionProviderSelectEl.value as TranscriptionProvider;
    options.settings.transcriptionProvider = provider;
    options.settings.transcriptionModel =
      getFirstModelIdForProvider(options.settings.modelCatalog, provider, "transcription")
      ?? normalizeTranscriptionModelForProvider(provider, "");
    void options.saveSettings().then(() => {
      options.onRefresh();
    });
  });

  const transcriptionModelSelectEl = transcriptionModelControlsEl.createEl("select", {
    cls: "ai-summarizer-preflight-control"
  });
  transcriptionModelSelectEl.disabled = options.isBusy;
  for (const option of getTranscriptionModelOptions(
    options.settings.transcriptionProvider,
    options.settings.modelCatalog,
    options.settings.transcriptionModel
  )) {
    transcriptionModelSelectEl.createEl("option", {
      attr: { value: option.value },
      text: option.label
    });
  }
  transcriptionModelSelectEl.value = options.settings.transcriptionModel;
  transcriptionModelSelectEl.addEventListener("change", () => {
    options.settings.transcriptionModel = transcriptionModelSelectEl.value as TranscriptionModel;
    void options.saveSettings();
  });

  const summaryModelFieldEl = createPreflightField(fieldsEl, "摘要");
  const summaryModelControlsEl = summaryModelFieldEl.createDiv({
    cls: "ai-summarizer-preflight-model-controls"
  });
  const summaryProviderSelectEl = summaryModelControlsEl.createEl("select", {
    cls: "ai-summarizer-preflight-control ai-summarizer-preflight-provider-control"
  });
  summaryProviderSelectEl.disabled = options.isBusy;
  for (const option of SUMMARY_PROVIDER_OPTIONS) {
    summaryProviderSelectEl.createEl("option", {
      attr: { value: option.value },
      text: option.label
    });
  }
  summaryProviderSelectEl.value = options.settings.summaryProvider;
  summaryProviderSelectEl.addEventListener("change", () => {
    const provider = summaryProviderSelectEl.value as SummaryProvider;
    options.settings.summaryProvider = provider;
    options.settings.summaryModel =
      getFirstModelIdForProvider(options.settings.modelCatalog, provider, "summary")
      ?? normalizeSummaryModel(provider, "");
    void options.saveSettings().then(() => {
      options.onRefresh();
    });
  });

  const summaryModelSelectEl = summaryModelControlsEl.createEl("select", {
    cls: "ai-summarizer-preflight-control"
  });
  summaryModelSelectEl.disabled = options.isBusy;
  for (const option of getSummaryModelOptions(
    options.settings.summaryProvider,
    options.settings.modelCatalog,
    options.settings.summaryModel
  )) {
    summaryModelSelectEl.createEl("option", {
      attr: { value: option.value },
      text: option.label
    });
  }
  summaryModelSelectEl.value = options.settings.summaryModel;
  summaryModelSelectEl.addEventListener("change", () => {
    options.settings.summaryModel = summaryModelSelectEl.value as SummaryModel;
    void options.saveSettings();
  });

  const outputFieldEl = createPreflightField(fieldsEl, "輸出");
  const outputControlsEl = outputFieldEl.createDiv({
    cls: "ai-summarizer-preflight-pick-row"
  });
  const outputInputEl = outputControlsEl.createEl("input", {
    cls: "ai-summarizer-preflight-control"
  });
  outputInputEl.type = "text";
  outputInputEl.disabled = options.isBusy;
  outputInputEl.placeholder = "Vault 根目錄";
  outputInputEl.value = options.settings.outputFolder;
  outputInputEl.addEventListener("change", () => {
    options.settings.outputFolder = outputInputEl.value.trim();
    void options.saveSettings();
  });
  const outputPickerButtonEl = outputControlsEl.createEl("button", {
    cls: "ai-summarizer-preflight-pick-button",
    text: "選擇"
  });
  outputPickerButtonEl.type = "button";
  outputPickerButtonEl.disabled = options.isBusy;
  outputPickerButtonEl.addEventListener("click", () => {
    options.onPickOutputFolder();
  });

  const retentionFieldEl = createPreflightField(fieldsEl, "暫存");
  const retentionSelectEl = retentionFieldEl.createEl("select", {
    cls: "ai-summarizer-preflight-control"
  });
  retentionSelectEl.disabled = options.isBusy;
  for (const mode of Object.keys(RETENTION_LABELS) as RetentionMode[]) {
    retentionSelectEl.createEl("option", {
      attr: { value: mode },
      text: RETENTION_LABELS[mode]
    });
  }
  retentionSelectEl.value = options.settings.retentionMode;
  retentionSelectEl.addEventListener("change", () => {
    options.settings.retentionMode = retentionSelectEl.value as RetentionMode;
    void options.saveSettings();
  });

  const cleanupFieldEl = createPreflightField(fieldsEl, "校對");
  const cleanupRowEl = cleanupFieldEl.createDiv({
    cls: "ai-summarizer-preflight-inline-row"
  });
  const cleanupControlEl = cleanupRowEl.createEl("label", {
    cls: "ai-summarizer-preflight-checkbox"
  });
  const cleanupCheckboxEl = cleanupControlEl.createEl("input");
  cleanupCheckboxEl.type = "checkbox";
  cleanupCheckboxEl.disabled = options.isBusy || options.sourceType === "webpage_url";
  cleanupCheckboxEl.checked = options.settings.enableTranscriptCleanup;
  cleanupControlEl.createSpan({ text: "摘要前校對逐字稿" });
  cleanupCheckboxEl.addEventListener("change", () => {
    options.settings.enableTranscriptCleanup = cleanupCheckboxEl.checked;
    void options.saveSettings();
  });

  const flashcardFieldEl = createPreflightField(fieldsEl, "閃卡");
  const flashcardRowEl = flashcardFieldEl.createDiv({
    cls: "ai-summarizer-preflight-inline-row"
  });
  const flashcardControlEl = flashcardRowEl.createEl("label", {
    cls: "ai-summarizer-preflight-checkbox"
  });
  const flashcardCheckboxEl = flashcardControlEl.createEl("input");
  flashcardCheckboxEl.type = "checkbox";
  flashcardCheckboxEl.disabled = options.isBusy;
  flashcardCheckboxEl.checked = options.settings.generateFlashcards;
  flashcardControlEl.setAttribute("title", FLASHCARD_MARKER_TOOLTIP);
  flashcardControlEl.setAttribute("aria-label", FLASHCARD_MARKER_TOOLTIP);
  flashcardControlEl.createSpan({ text: FLASHCARD_MARKER_LABEL });
  flashcardCheckboxEl.addEventListener("change", () => {
    options.settings.generateFlashcards = flashcardCheckboxEl.checked;
    void options.saveSettings();
  });

  if (options.shouldShowMediaReadiness) {
    const mediaReadinessEl = flashcardRowEl.createEl("button", {
      cls: "ai-summarizer-chip ai-summarizer-media-readiness",
      text: options.mediaReadinessText
    });
    mediaReadinessEl.type = "button";
    mediaReadinessEl.disabled = options.isBusy || options.mediaDiagnosticsLoading;
    mediaReadinessEl.setAttribute("data-state", options.mediaReadinessState);
    mediaReadinessEl.setAttribute("aria-label", options.mediaReadinessTooltip);
    mediaReadinessEl.setAttribute("title", options.mediaReadinessTooltip);
    mediaReadinessEl.addEventListener("click", () => {
      options.onRefreshMediaReadiness();
    });

    if (options.shouldShowMediaDiagnosticsEntry) {
      const diagnosticsButtonEl = flashcardRowEl.createEl("button", {
        cls: "ai-summarizer-media-diagnostics-link",
        text: "診斷"
      });
      diagnosticsButtonEl.type = "button";
      diagnosticsButtonEl.disabled = options.isBusy;
      diagnosticsButtonEl.setAttribute("aria-label", "前往媒體工具診斷設定");
      diagnosticsButtonEl.setAttribute("title", "前往設定頁查看媒體工具診斷");
      diagnosticsButtonEl.addEventListener("click", () => {
        options.onOpenSettingsTab();
      });
    }
  }
}
