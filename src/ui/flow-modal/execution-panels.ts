import { ButtonComponent } from "obsidian";

import type { ErrorCategory } from "@domain/errors";
import type { JobStatus } from "@domain/jobs";
import type { StageDescriptor, UiStatus } from "@ui/flow-modal/types";

const TERMINAL_STAGE_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];

export interface FlowExecutionPanelOptions {
  currentStageStatus: JobStatus;
  failureCategory: ErrorCategory | "unknown" | null;
  failedSuggestion: string;
  failedTitle: string;
  recoveryTranscriptPath: string;
  resultMessage: string;
  resultNotePath: string;
  stageDescriptors: StageDescriptor[];
  stageMessage: string;
  status: UiStatus;
  warningMessages: string[];
  onCancel: () => void;
  onClose: () => void;
  onCopyResultPath: () => void;
  onOpenResultNote: () => void;
  onOpenSettingsTab: () => void;
  onRerun: () => void;
  onStart: () => void;
  onUseTranscriptFile: (transcriptPath: string) => void;
}

function getStageState(
  stageId: JobStatus,
  descriptors: StageDescriptor[],
  options: FlowExecutionPanelOptions
): "pending" | "current" | "done" {
  if (options.status === "completed") {
    return "done";
  }

  if (options.currentStageStatus === stageId) {
    return "current";
  }

  if (options.currentStageStatus === "idle" || TERMINAL_STAGE_STATUSES.includes(options.currentStageStatus)) {
    return "pending";
  }

  const currentIndex = descriptors.findIndex((stage) => stage.id === options.currentStageStatus);
  const stageIndex = descriptors.findIndex((stage) => stage.id === stageId);
  return currentIndex > stageIndex ? "done" : "pending";
}

export function renderStageStatus(
  containerEl: HTMLElement,
  options: FlowExecutionPanelOptions,
  renderActions?: (containerEl: HTMLElement) => void
): void {
  const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-section ai-summarizer-stage-panel" });
  sectionEl.createEl("h3", {
    cls: "ai-summarizer-section-title",
    text: "進度"
  });
  sectionEl.createEl("p", {
    cls: "ai-summarizer-stage-message",
    text: options.status === "cancelling" ? "正在停止目前流程" : options.stageMessage
  });

  const listEl = sectionEl.createDiv({ cls: "ai-summarizer-stage-list" });
  options.stageDescriptors.forEach((stage) => {
    const state = getStageState(stage.id, options.stageDescriptors, options);
    const itemEl = listEl.createDiv({ cls: "ai-summarizer-stage-item" });
    itemEl.setAttribute("data-state", state);
    itemEl.createSpan({ cls: "ai-summarizer-stage-marker" });
    itemEl.createSpan({ cls: "ai-summarizer-stage-label", text: stage.label });
  });

  renderActions?.(sectionEl);
}

export function renderResultPanel(containerEl: HTMLElement, options: FlowExecutionPanelOptions): void {
  if (options.status === "failed") {
    renderFailedPanel(containerEl, options);
    return;
  }

  if (options.status === "cancelled") {
    renderCancelledPanel(containerEl, options);
  }
}

function renderCompletedExecutionMessage(containerEl: HTMLElement, options: FlowExecutionPanelOptions): void {
  const resultEl = containerEl.createDiv({ cls: "ai-summarizer-execution-result" });
  resultEl.createEl("h3", {
    cls: "ai-summarizer-result-title",
    text: "已建立摘要筆記"
  });
  resultEl.createEl("p", {
    cls: "ai-summarizer-result-path",
    text: options.resultNotePath || "筆記路徑尚未回傳"
  });

  const actionsEl = resultEl.createDiv({ cls: "ai-summarizer-result-actions" });
  const openButton = new ButtonComponent(actionsEl);
  openButton.setButtonText("開啟筆記").setCta().onClick(() => {
    options.onOpenResultNote();
  });

  const copyButton = new ButtonComponent(actionsEl);
  copyButton.setButtonText("複製路徑").onClick(() => {
    if (options.resultNotePath) {
      options.onCopyResultPath();
    }
  });

  const rerunButton = new ButtonComponent(actionsEl);
  rerunButton.setButtonText("再摘要一次").onClick(() => {
    options.onRerun();
  });
}

function renderFailedPanel(containerEl: HTMLElement, options: FlowExecutionPanelOptions): void {
  const panelEl = containerEl.createDiv({ cls: "ai-summarizer-result-panel" });
  panelEl.setAttribute("data-result", "failed");
  panelEl.createEl("h3", {
    cls: "ai-summarizer-result-title",
    text: options.failedTitle
  });
  panelEl.createEl("p", {
    cls: "ai-summarizer-result-message",
    text: options.resultMessage
  });
  panelEl.createEl("p", {
    cls: "ai-summarizer-result-suggestion",
    text: `建議：${options.failedSuggestion}`
  });

  const actionsEl = panelEl.createDiv({ cls: "ai-summarizer-result-actions" });
  const retryButton = new ButtonComponent(actionsEl);
  retryButton.setButtonText("重試").setCta().onClick(() => {
    options.onRerun();
  });

  const diagnosticsButton = new ButtonComponent(actionsEl);
  diagnosticsButton.setButtonText("前往診斷").onClick(() => {
    options.onOpenSettingsTab();
  });

  if (options.recoveryTranscriptPath || options.failureCategory === "ai_failure") {
    const transcriptButton = new ButtonComponent(actionsEl);
    transcriptButton.setButtonText("改用逐字稿檔案").onClick(() => {
      options.onUseTranscriptFile(options.recoveryTranscriptPath);
    });
  }
}

function renderCancelledPanel(containerEl: HTMLElement, options: FlowExecutionPanelOptions): void {
  const panelEl = containerEl.createDiv({ cls: "ai-summarizer-result-panel" });
  panelEl.setAttribute("data-result", "cancelled");
  panelEl.createEl("h3", {
    cls: "ai-summarizer-result-title",
    text: "已取消"
  });
  panelEl.createEl("p", {
    cls: "ai-summarizer-result-message",
    text: options.recoveryTranscriptPath
      ? "已保留可恢復的逐字稿，可改用逐字稿檔案重新摘要。"
      : "流程已停止；若稍後找到 transcript.md，可改用逐字稿檔案重新摘要。"
  });

  const actionsEl = panelEl.createDiv({ cls: "ai-summarizer-result-actions" });
  if (options.recoveryTranscriptPath) {
    const transcriptButton = new ButtonComponent(actionsEl);
    transcriptButton.setButtonText("改用逐字稿檔案").setCta().onClick(() => {
      options.onUseTranscriptFile(options.recoveryTranscriptPath);
    });
  }

  const closeButton = new ButtonComponent(actionsEl);
  closeButton.setButtonText("關閉").onClick(() => {
    options.onClose();
  });
}

export function renderPrimaryActions(containerEl: HTMLElement, options: FlowExecutionPanelOptions): void {
  const actionsEl = containerEl.createDiv({ cls: "ai-summarizer-actions" });
  const startButton = new ButtonComponent(actionsEl);
  startButton.setButtonText("開始摘要").setCta();

  const cancelButton = new ButtonComponent(actionsEl);
  cancelButton.setButtonText("取消");

  if (options.status === "running") {
    startButton.setDisabled(true);
    cancelButton.setDisabled(false);
  } else if (options.status === "cancelling") {
    startButton.setButtonText("正在停止");
    startButton.setDisabled(true);
    cancelButton.setDisabled(true);
  } else {
    startButton.setDisabled(false);
    cancelButton.setDisabled(true);
  }

  startButton.onClick(() => {
    options.onStart();
  });

  cancelButton.onClick(() => {
    options.onCancel();
  });
}

export function renderExecutionDetails(containerEl: HTMLElement, options: FlowExecutionPanelOptions): void {
  const shouldShowCompletedResult = options.status === "completed";
  if (!shouldShowCompletedResult && options.warningMessages.length === 0) {
    return;
  }

  const detailsEl = containerEl.createEl("details", {
    cls: "ai-summarizer-source-details ai-summarizer-execution-details"
  });
  detailsEl.open = shouldShowCompletedResult;
  detailsEl.createEl("summary", {
    text: shouldShowCompletedResult
      ? "執行訊息：已建立摘要筆記"
      : `執行訊息：Warnings (${options.warningMessages.length})`
  });

  if (shouldShowCompletedResult) {
    renderCompletedExecutionMessage(detailsEl, options);
  }

  if (options.warningMessages.length > 0) {
    detailsEl.createEl("h4", {
      cls: "ai-summarizer-execution-subtitle",
      text: "Warnings"
    });
    const listEl = detailsEl.createEl("ul");
    for (const warning of options.warningMessages) {
      listEl.createEl("li", { text: warning });
    }
  }
}
