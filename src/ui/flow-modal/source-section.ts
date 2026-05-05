import type { SourceType } from "@domain/types";
import { describeTemplateReference } from "@services/obsidian/template-library";
import { getSourceGuidance } from "@ui/source-guidance";

const SOURCE_TYPES: SourceType[] = ["webpage_url", "media_url", "local_media", "transcript_file"];

export interface FlowSourceSectionOptions {
  isBusy: boolean;
  sourceType: SourceType;
  sourceValue: string;
  templateReference: string;
  onPickLocalFile: () => void;
  onSelectSourceType: (sourceType: SourceType) => void;
  onSourceValueChange: (sourceValue: string) => void;
  onUseExample: (sourceValue: string) => void;
}

function getSourceActionLabel(sourceType: SourceType): string {
  return sourceType === "local_media" || sourceType === "transcript_file"
    ? "選擇檔案"
    : "填入範例";
}

export function renderSourceSelector(containerEl: HTMLElement, options: FlowSourceSectionOptions): void {
  const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-section" });
  const headingEl = sectionEl.createEl("h3", {
    cls: "ai-summarizer-section-title",
    text: "輸入來源"
  });
  headingEl.id = "ai-summarizer-source-selector-title";

  const tabsEl = sectionEl.createDiv({ cls: "ai-summarizer-source-tabs" });
  tabsEl.setAttribute("role", "tablist");
  tabsEl.setAttribute("aria-labelledby", headingEl.id);

  SOURCE_TYPES.forEach((sourceType) => {
    const guidance = getSourceGuidance(sourceType);
    const isActive = sourceType === options.sourceType;
    const buttonEl = tabsEl.createEl("button", {
      cls: "ai-summarizer-source-tab",
      text: guidance.label
    });
    buttonEl.type = "button";
    buttonEl.disabled = options.isBusy;
    buttonEl.setAttribute("role", "tab");
    buttonEl.setAttribute("aria-selected", String(isActive));
    buttonEl.setAttribute("data-active", String(isActive));
    buttonEl.addEventListener("click", () => {
      options.onSelectSourceType(sourceType);
    });
  });
}

export function renderSourceInput(containerEl: HTMLElement, options: FlowSourceSectionOptions): void {
  const guidance = getSourceGuidance(options.sourceType);
  const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-section ai-summarizer-source-input" });
  sectionEl.createEl("h3", {
    cls: "ai-summarizer-section-title",
    text: guidance.label
  });
  sectionEl.createEl("p", {
    cls: "ai-summarizer-source-description",
    text: guidance.description
  });

  const rowEl = sectionEl.createDiv({ cls: "ai-summarizer-input-row" });
  const inputEl = rowEl.createEl("input", {
    cls: "ai-summarizer-source-value"
  });
  inputEl.type = "text";
  inputEl.disabled = options.isBusy;
  inputEl.placeholder = guidance.placeholder;
  inputEl.value = options.sourceValue;
  inputEl.addEventListener("input", () => {
    options.onSourceValueChange(inputEl.value.trim());
  });

  const actionButtonEl = rowEl.createEl("button", {
    cls: "ai-summarizer-secondary-action",
    text: getSourceActionLabel(options.sourceType)
  });
  actionButtonEl.type = "button";
  actionButtonEl.disabled = options.isBusy;
  actionButtonEl.addEventListener("click", () => {
    if (options.sourceType === "local_media" || options.sourceType === "transcript_file") {
      options.onPickLocalFile();
      return;
    }

    options.onUseExample(guidance.placeholder);
  });
}

export function renderSourceDetails(containerEl: HTMLElement, options: FlowSourceSectionOptions): void {
  const guidance = getSourceGuidance(options.sourceType);
  const detailsEl = containerEl.createEl("details", {
    cls: "ai-summarizer-source-details"
  });
  detailsEl.createEl("summary", { text: "來源限制" });
  const listEl = detailsEl.createEl("ul");
  listEl.createEl("li", { text: guidance.inputHint });
  listEl.createEl("li", { text: `常見來源：${guidance.examples.join("、")}` });
  listEl.createEl("li", {
    text: `目前 note 模板：${describeTemplateReference(options.templateReference)}`
  });
}
