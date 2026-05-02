import { ButtonComponent, Modal, TFile } from "obsidian";
import type { ErrorCategory } from "@domain/errors";
import type { JobStatus } from "@domain/jobs";
import type {
  LocalMediaRequest,
  MediaUrlRequest,
  SourceType,
  TranscriptFileRequest,
  WebpageRequest
} from "@domain/types";
import { processMedia } from "@orchestration/process-media";
import { processTranscriptFile } from "@orchestration/process-transcript-file";
import { processWebpage } from "@orchestration/process-webpage";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import {
  createConfiguredSummaryProvider,
  createConfiguredTranscriptionProvider
} from "@services/ai/configured-ai-provider";
import { BasicMetadataExtractor } from "@services/web/metadata-extractor";
import { FetchWebpageExtractor } from "@services/web/webpage-extractor";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import { createRuntimeProvider } from "@runtime/runtime-factory";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { ObsidianNoteWriter } from "@services/obsidian/note-writer";
import { VaultNoteStorage } from "@services/obsidian/vault-note-storage";
import { describeTemplateReference } from "@services/obsidian/template-library";
import { getSourceErrorHint, getSourceGuidance } from "@ui/source-guidance";

type UiStatus = "idle" | "running" | "cancelling" | "completed" | "failed" | "cancelled";

const SOURCE_TYPES: SourceType[] = ["webpage_url", "media_url", "local_media", "transcript_file"];
const TERMINAL_STAGE_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];

interface StageDescriptor {
  id: JobStatus;
  label: string;
}

interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface DesktopDialog {
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    properties: string[];
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<OpenDialogResult>;
}

export class SummarizerFlowModal extends Modal {
  private readonly plugin: AISummarizerPlugin;
  private sourceType: SourceType;
  private sourceValue = "";
  private status: UiStatus = "idle";
  private currentStageStatus: JobStatus = "idle";
  private stageMessage = "等待開始";
  private resultMessage = "";
  private resultNotePath = "";
  private failureCategory: ErrorCategory | "unknown" | null = null;
  private warningMessages: string[] = [];
  private abortController: AbortController | null = null;

  public constructor(plugin: AISummarizerPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.sourceType = plugin.settings.lastSourceType;
    this.modalEl.addClass("ai-summarizer-flow");
    this.contentEl.addClass("ai-summarizer-flow-content");
    this.setTitle("AI 摘要器");
  }

  public onOpen(): void {
    this.render();
  }

  public onClose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.contentEl.empty();
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

  private async pickLocalFile(): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
      this.status = "failed";
      this.currentStageStatus = "failed";
      this.stageMessage = "等待輸入";
      this.failureCategory = "validation_error";
      this.resultMessage = "目前環境不支援檔案選擇器，請手動輸入本機檔案絕對路徑。";
      this.render();
      return;
    }

    const isTranscriptFile = this.sourceType === "transcript_file";
    const result = await dialog.showOpenDialog({
      title: isTranscriptFile ? "選擇逐字稿檔案" : "選擇本機媒體檔案",
      properties: ["openFile"],
      filters: [
        isTranscriptFile
          ? {
              name: "Transcript",
              extensions: ["md", "txt"]
            }
          : {
              name: "Media",
              extensions: ["mp3", "m4a", "wav", "flac", "mp4", "mov", "mkv"]
            }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    this.sourceValue = result.filePaths[0];
    this.render();
  }

  private async copyTextToClipboard(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.plugin.notify(successMessage);
    } catch (error) {
      this.plugin.reportWarning("flow_modal", `Clipboard copy failed: ${error instanceof Error ? error.message : String(error)}`);
      this.plugin.notify("無法複製到剪貼簿。");
    }
  }

  private async openResultNote(): Promise<void> {
    if (!this.resultNotePath) {
      return;
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(this.resultNotePath);
    if (file instanceof TFile) {
      await this.plugin.app.workspace.getLeaf(false).openFile(file);
      return;
    }

    this.plugin.notify(`找不到筆記：${this.resultNotePath}`);
  }

  private async persistLastSourceType(sourceType: SourceType): Promise<void> {
    this.plugin.settings.lastSourceType = sourceType;
    await this.plugin.saveSettings();
  }

  private selectSourceType(sourceType: SourceType): void {
    if (sourceType === this.sourceType || this.isBusy()) {
      return;
    }

    this.sourceType = sourceType;
    this.sourceValue = "";
    this.resultMessage = "";
    this.resultNotePath = "";
    this.failureCategory = null;
    this.warningMessages = [];
    void this.persistLastSourceType(sourceType);
    this.render();
  }

  private buildRuntimeProvider(): RuntimeProvider {
    return createRuntimeProvider(this.plugin.settings.runtimeStrategy);
  }

  private buildAiProvider(): ReturnType<typeof createConfiguredSummaryProvider> {
    return createConfiguredSummaryProvider(this.plugin.settings);
  }

  private buildTranscriptionProvider(): ReturnType<typeof createConfiguredTranscriptionProvider> {
    return createConfiguredTranscriptionProvider(this.plugin.settings);
  }

  private buildNoteWriter(): NoteWriter {
    return new ObsidianNoteWriter(new VaultNoteStorage(this.plugin.app.vault), {
      outputFolder: this.plugin.settings.outputFolder,
      templateReference: this.plugin.settings.templateReference
    });
  }

  private getSourceActionLabel(): string {
    return this.sourceType === "local_media" || this.sourceType === "transcript_file"
      ? "選擇檔案"
      : "填入範例";
  }

  private isBusy(): boolean {
    return this.status === "running" || this.status === "cancelling";
  }

  private getRetentionModeLabel(): string {
    return this.plugin.settings.retentionMode === "keep_temp"
      ? "保留暫存"
      : "保留必要輸出";
  }

  private getOutputFolderLabel(): string {
    const outputFolder = this.plugin.settings.outputFolder.trim();
    return outputFolder.length > 0 ? outputFolder : "Vault 根目錄";
  }

  private shouldShowMediaReadiness(): boolean {
    return this.sourceType === "media_url" || this.sourceType === "local_media";
  }

  private getStageDescriptors(): StageDescriptor[] {
    const commonStart: StageDescriptor[] = [
      { id: "validating", label: "驗證輸入" }
    ];
    const commonEnd: StageDescriptor[] = [
      { id: "summarizing", label: "摘要" },
      { id: "writing", label: "寫入筆記" },
      { id: "completed", label: "完成" }
    ];

    if (this.sourceType === "webpage_url") {
      return [
        ...commonStart,
        { id: "acquiring", label: "取得網頁內容" },
        ...commonEnd
      ];
    }

    if (this.sourceType === "transcript_file") {
      return [
        ...commonStart,
        { id: "acquiring", label: "讀取逐字稿" },
        ...commonEnd
      ];
    }

    return [
      ...commonStart,
      {
        id: "acquiring",
        label: this.sourceType === "media_url" ? "取得媒體" : "準備本機媒體"
      },
      { id: "transcribing", label: "轉錄" },
      ...commonEnd
    ];
  }

  private getStageState(stageId: JobStatus, descriptors: StageDescriptor[]): "pending" | "current" | "done" {
    if (this.status === "completed") {
      return "done";
    }

    if (this.currentStageStatus === stageId) {
      return "current";
    }

    if (this.currentStageStatus === "idle" || TERMINAL_STAGE_STATUSES.includes(this.currentStageStatus)) {
      return "pending";
    }

    const currentIndex = descriptors.findIndex((stage) => stage.id === this.currentStageStatus);
    const stageIndex = descriptors.findIndex((stage) => stage.id === stageId);
    return currentIndex > stageIndex ? "done" : "pending";
  }

  private findRecoveryTranscriptPath(): string {
    const recoveryWarning = this.warningMessages.find((warning) =>
      warning.includes("transcript preserved") && warning.includes(":")
    );
    if (!recoveryWarning) {
      return "";
    }

    const [, pathPart = ""] = recoveryWarning.split(/:\s+/, 2);
    return pathPart.trim();
  }

  private getFailedTitle(): string {
    switch (this.failureCategory) {
      case "validation_error":
        return "輸入需要修正";
      case "runtime_unavailable":
        return "執行環境尚未準備完成";
      case "download_failure":
        return "媒體下載失敗";
      case "ai_failure":
        return "AI 處理失敗";
      case "note_write_failure":
        return "筆記寫入失敗";
      case "cancellation":
        return "流程已取消";
      default:
        return "摘要流程失敗";
    }
  }

  private getFailedSuggestion(): string {
    const category = this.failureCategory ?? "unknown";
    return getSourceErrorHint(this.sourceType, category)
      ?? "先檢查輸入值、設定頁診斷摘要與 plugin log，再決定是否需要重試。";
  }

  private renderSourceSelector(containerEl: HTMLElement): void {
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
      const isActive = sourceType === this.sourceType;
      const buttonEl = tabsEl.createEl("button", {
        cls: "ai-summarizer-source-tab",
        text: guidance.label
      });
      buttonEl.type = "button";
      buttonEl.disabled = this.isBusy();
      buttonEl.setAttribute("role", "tab");
      buttonEl.setAttribute("aria-selected", String(isActive));
      buttonEl.setAttribute("data-active", String(isActive));
      buttonEl.addEventListener("click", () => {
        this.selectSourceType(sourceType);
      });
    });
  }

  private renderSourceInput(containerEl: HTMLElement): void {
    const guidance = getSourceGuidance(this.sourceType);
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
    inputEl.disabled = this.isBusy();
    inputEl.placeholder = guidance.placeholder;
    inputEl.value = this.sourceValue;
    inputEl.addEventListener("input", () => {
      this.sourceValue = inputEl.value.trim();
    });

    const actionButtonEl = rowEl.createEl("button", {
      cls: "ai-summarizer-secondary-action",
      text: this.getSourceActionLabel()
    });
    actionButtonEl.type = "button";
    actionButtonEl.disabled = this.isBusy();
    actionButtonEl.addEventListener("click", () => {
      if (this.sourceType === "local_media" || this.sourceType === "transcript_file") {
        void this.pickLocalFile();
        return;
      }

      this.sourceValue = guidance.placeholder;
      this.render();
    });
  }

  private renderSourceDetails(containerEl: HTMLElement): void {
    const guidance = getSourceGuidance(this.sourceType);
    const detailsEl = containerEl.createEl("details", {
      cls: "ai-summarizer-source-details"
    });
    detailsEl.createEl("summary", { text: "查看來源限制" });
    const listEl = detailsEl.createEl("ul");
    listEl.createEl("li", { text: guidance.inputHint });
    listEl.createEl("li", { text: `常見來源：${guidance.examples.join("、")}` });
    listEl.createEl("li", {
      text: `目前 note 模板：${describeTemplateReference(this.plugin.settings.templateReference)}`
    });
  }

  private renderPreflightSummary(containerEl: HTMLElement): void {
    const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-section ai-summarizer-preflight" });
    sectionEl.createEl("h3", {
      cls: "ai-summarizer-section-title",
      text: "執行前摘要"
    });

    const chipsEl = sectionEl.createDiv({ cls: "ai-summarizer-chip-row" });
    chipsEl.createSpan({
      cls: "ai-summarizer-chip",
      text: `模板：${describeTemplateReference(this.plugin.settings.templateReference)}`
    });
    chipsEl.createSpan({
      cls: "ai-summarizer-chip",
      text: `輸出：${this.getOutputFolderLabel()}`
    });
    chipsEl.createSpan({
      cls: "ai-summarizer-chip",
      text: `暫存：${this.getRetentionModeLabel()}`
    });

    if (this.shouldShowMediaReadiness()) {
      chipsEl.createSpan({
        cls: "ai-summarizer-chip",
        text: "媒體工具：尚未檢查"
      });
    }
  }

  private renderStageStatus(containerEl: HTMLElement): void {
    const descriptors = this.getStageDescriptors();
    const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-section ai-summarizer-stage-panel" });
    sectionEl.createEl("h3", {
      cls: "ai-summarizer-section-title",
      text: "進度"
    });
    sectionEl.createEl("p", {
      cls: "ai-summarizer-stage-message",
      text: this.status === "cancelling" ? "正在停止目前流程" : this.stageMessage
    });

    const listEl = sectionEl.createDiv({ cls: "ai-summarizer-stage-list" });
    descriptors.forEach((stage) => {
      const state = this.getStageState(stage.id, descriptors);
      const itemEl = listEl.createDiv({ cls: "ai-summarizer-stage-item" });
      itemEl.setAttribute("data-state", state);
      itemEl.createSpan({ cls: "ai-summarizer-stage-marker" });
      itemEl.createSpan({ cls: "ai-summarizer-stage-label", text: stage.label });
    });
  }

  private renderResultPanel(containerEl: HTMLElement): void {
    if (this.status === "completed") {
      this.renderCompletedPanel(containerEl);
      return;
    }

    if (this.status === "failed") {
      this.renderFailedPanel(containerEl);
      return;
    }

    if (this.status === "cancelled") {
      this.renderCancelledPanel(containerEl);
    }
  }

  private renderCompletedPanel(containerEl: HTMLElement): void {
    const panelEl = containerEl.createDiv({ cls: "ai-summarizer-result-panel" });
    panelEl.setAttribute("data-result", "completed");
    panelEl.createEl("h3", {
      cls: "ai-summarizer-result-title",
      text: "已建立摘要筆記"
    });
    panelEl.createEl("p", {
      cls: "ai-summarizer-result-path",
      text: this.resultNotePath || "筆記路徑尚未回傳"
    });

    const actionsEl = panelEl.createDiv({ cls: "ai-summarizer-result-actions" });
    const openButton = new ButtonComponent(actionsEl);
    openButton.setButtonText("開啟筆記").setCta().onClick(() => {
      void this.openResultNote();
    });

    const copyButton = new ButtonComponent(actionsEl);
    copyButton.setButtonText("複製路徑").onClick(() => {
      if (this.resultNotePath) {
        void this.copyTextToClipboard(this.resultNotePath, "已複製筆記路徑。");
      }
    });

    const rerunButton = new ButtonComponent(actionsEl);
    rerunButton.setButtonText("再摘要一次").onClick(() => {
      void this.startFlow();
    });
  }

  private renderFailedPanel(containerEl: HTMLElement): void {
    const panelEl = containerEl.createDiv({ cls: "ai-summarizer-result-panel" });
    panelEl.setAttribute("data-result", "failed");
    panelEl.createEl("h3", {
      cls: "ai-summarizer-result-title",
      text: this.getFailedTitle()
    });
    panelEl.createEl("p", {
      cls: "ai-summarizer-result-message",
      text: this.resultMessage
    });
    panelEl.createEl("p", {
      cls: "ai-summarizer-result-suggestion",
      text: `建議：${this.getFailedSuggestion()}`
    });

    const actionsEl = panelEl.createDiv({ cls: "ai-summarizer-result-actions" });
    const retryButton = new ButtonComponent(actionsEl);
    retryButton.setButtonText("重試").setCta().onClick(() => {
      void this.startFlow();
    });

    const diagnosticsButton = new ButtonComponent(actionsEl);
    diagnosticsButton.setButtonText("前往診斷").onClick(() => {
      this.plugin.openSettingsTab();
    });

    const recoveryPath = this.findRecoveryTranscriptPath();
    if (recoveryPath || this.failureCategory === "ai_failure") {
      const transcriptButton = new ButtonComponent(actionsEl);
      transcriptButton.setButtonText("改用逐字稿檔案").onClick(() => {
        this.sourceType = "transcript_file";
        this.sourceValue = recoveryPath;
        this.status = "idle";
        this.currentStageStatus = "idle";
        this.stageMessage = "等待開始";
        this.resultMessage = "";
        this.failureCategory = null;
        void this.persistLastSourceType("transcript_file");
        this.render();
      });
    }
  }

  private renderCancelledPanel(containerEl: HTMLElement): void {
    const recoveryPath = this.findRecoveryTranscriptPath();
    const panelEl = containerEl.createDiv({ cls: "ai-summarizer-result-panel" });
    panelEl.setAttribute("data-result", "cancelled");
    panelEl.createEl("h3", {
      cls: "ai-summarizer-result-title",
      text: "已取消"
    });
    panelEl.createEl("p", {
      cls: "ai-summarizer-result-message",
      text: recoveryPath
        ? "已保留可恢復的逐字稿，可改用逐字稿檔案重新摘要。"
        : "流程已停止；若稍後找到 transcript.md，可改用逐字稿檔案重新摘要。"
    });

    const actionsEl = panelEl.createDiv({ cls: "ai-summarizer-result-actions" });
    if (recoveryPath) {
      const transcriptButton = new ButtonComponent(actionsEl);
      transcriptButton.setButtonText("改用逐字稿檔案").setCta().onClick(() => {
        this.sourceType = "transcript_file";
        this.sourceValue = recoveryPath;
        this.status = "idle";
        this.currentStageStatus = "idle";
        this.stageMessage = "等待開始";
        this.resultMessage = "";
        this.failureCategory = null;
        void this.persistLastSourceType("transcript_file");
        this.render();
      });
    }

    const closeButton = new ButtonComponent(actionsEl);
    closeButton.setButtonText("關閉").onClick(() => {
      this.close();
    });
  }

  private render(): void {
    const { contentEl } = this;

    contentEl.empty();

    this.renderSourceSelector(contentEl);
    this.renderSourceInput(contentEl);
    this.renderSourceDetails(contentEl);
    this.renderPreflightSummary(contentEl);
    this.renderStageStatus(contentEl);

    if (this.warningMessages.length > 0) {
      const warningEl = contentEl.createDiv({ cls: "ai-summarizer-warning" });
      warningEl.setText(`Warnings: ${this.warningMessages.join(" | ")}`);
    }

    this.renderResultPanel(contentEl);

    const actionsEl = contentEl.createDiv({ cls: "ai-summarizer-actions" });
    const startButton = new ButtonComponent(actionsEl);
    startButton.setButtonText("開始摘要").setCta();

    const cancelButton = new ButtonComponent(actionsEl);
    cancelButton.setButtonText("取消");

    if (this.status === "running") {
      startButton.setDisabled(true);
      cancelButton.setDisabled(false);
    } else if (this.status === "cancelling") {
      startButton.setButtonText("正在停止");
      startButton.setDisabled(true);
      cancelButton.setDisabled(true);
    } else {
      startButton.setDisabled(false);
      cancelButton.setDisabled(true);
    }

    startButton.onClick(() => {
      void this.startFlow();
    });

    cancelButton.onClick(() => {
      this.cancelFlow();
    });
  }

  private cancelFlow(): void {
    if (!this.abortController) {
      return;
    }

    this.abortController.abort();
    this.status = "cancelling";
    this.stageMessage = "使用者取消中";
    this.render();
  }

  private async runWebpageFlow(signal: AbortSignal): Promise<{ notePath: string }> {
    const result = await processWebpage(
      {
        sourceKind: "webpage_url",
        sourceValue: this.sourceValue,
        summaryProvider: this.plugin.settings.summaryProvider,
        summaryModel: this.plugin.settings.summaryModel
      },
      {
        webpageExtractor: new FetchWebpageExtractor(),
        metadataExtractor: new BasicMetadataExtractor(),
        summaryProvider: this.buildAiProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (status, message) => {
          this.currentStageStatus = status;
          this.stageMessage = message;
          this.render();
        },
        onWarning: (warning) => {
          this.warningMessages.push(warning);
          this.plugin.reportWarning("webpage_flow", warning);
          this.render();
        }
      }
    );

    return { notePath: result.writeResult.notePath };
  }

  private async runTranscriptFileFlow(signal: AbortSignal): Promise<{ notePath: string }> {
    const result = await processTranscriptFile(
      {
        sourceKind: "transcript_file",
        sourceValue: this.sourceValue,
        summaryProvider: this.plugin.settings.summaryProvider,
        summaryModel: this.plugin.settings.summaryModel
      } satisfies TranscriptFileRequest,
      {
        summaryProvider: this.buildAiProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (status, message) => {
          this.currentStageStatus = status;
          this.stageMessage = message;
          this.render();
        },
        onWarning: (warning) => {
          this.warningMessages.push(warning);
          this.plugin.reportWarning("transcript_file_flow", warning);
          this.render();
        }
      }
    );

    return { notePath: result.writeResult.notePath };
  }

  private async runMediaFlow(signal: AbortSignal): Promise<{ notePath: string }> {
    const result = await processMedia(
      {
        sourceKind: this.sourceType,
        sourceValue: this.sourceValue,
        transcriptionProvider: this.plugin.settings.transcriptionProvider,
        transcriptionModel: this.plugin.settings.transcriptionModel,
        summaryProvider: this.plugin.settings.summaryProvider,
        summaryModel: this.plugin.settings.summaryModel,
        retentionMode: this.plugin.settings.retentionMode,
        mediaCacheRoot: this.plugin.settings.mediaCacheRoot,
        ffmpegPath: this.plugin.settings.ffmpegPath,
        ffprobePath: this.plugin.settings.ffprobePath,
        mediaCompressionProfile: this.plugin.settings.mediaCompressionProfile
      } as MediaUrlRequest | LocalMediaRequest,
      {
        runtimeProvider: this.buildRuntimeProvider(),
        transcriptionProvider: this.buildTranscriptionProvider(),
        summaryProvider: this.buildAiProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (status, message) => {
          this.currentStageStatus = status;
          this.stageMessage = message;
          this.render();
        },
        onWarning: (warning) => {
          this.warningMessages.push(warning);
          this.plugin.reportWarning("media_flow", warning);
          this.render();
        }
      }
    );

    return { notePath: result.writeResult.notePath };
  }

  private async startFlow(): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    if (this.sourceValue.trim().length === 0) {
      this.status = "failed";
      this.currentStageStatus = "failed";
      this.stageMessage = "等待輸入";
      this.failureCategory = "validation_error";
      this.resultMessage = getSourceGuidance(this.sourceType).emptyValueHint;
      this.render();
      return;
    }

    this.abortController = new AbortController();
    this.status = "running";
    this.currentStageStatus = "idle";
    this.stageMessage = "準備執行";
    this.resultMessage = "";
    this.resultNotePath = "";
    this.failureCategory = null;
    this.warningMessages = [];
    this.render();

    try {
      const result =
        this.sourceType === "webpage_url"
          ? await this.runWebpageFlow(this.abortController.signal)
          : this.sourceType === "transcript_file"
            ? await this.runTranscriptFileFlow(this.abortController.signal)
            : await this.runMediaFlow(this.abortController.signal);

      this.status = "completed";
      this.currentStageStatus = "completed";
      this.stageMessage = "已完成";
      this.resultNotePath = result.notePath;
      this.resultMessage = "";
      this.plugin.notify("摘要流程已完成。");
      this.plugin.reportInfo(`${this.sourceType}_flow`, `Created note: ${result.notePath}`);
    } catch (error) {
      const report = this.plugin.reportError(`${this.sourceType}_flow`, error);

      if (report.category === "cancellation") {
        this.status = "cancelled";
        this.stageMessage = "已取消";
      } else {
        this.status = "failed";
        this.stageMessage = "執行失敗";
      }

      this.failureCategory = report.category;
      this.resultMessage = report.modalMessage;
    } finally {
      this.abortController = null;
      this.render();
    }
  }
}
