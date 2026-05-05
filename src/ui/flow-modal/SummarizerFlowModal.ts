import { ButtonComponent, Modal, normalizePath, TFile, TFolder } from "obsidian";
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
  createConfiguredTranscriptCleanupProvider,
  createConfiguredSummaryProvider,
  createConfiguredTranscriptionProvider
} from "@services/ai/configured-ai-provider";
import { BasicMetadataExtractor } from "@services/web/metadata-extractor";
import { FetchWebpageExtractor } from "@services/web/webpage-extractor";
import {
  collectRuntimeDiagnostics,
  type RuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import { createRuntimeProvider } from "@runtime/runtime-factory";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { ObsidianNoteWriter } from "@services/obsidian/note-writer";
import { VaultNoteStorage } from "@services/obsidian/vault-note-storage";
import { FLOW_MODAL_TITLE } from "@ui/flow-modal/copy";
import { FlowVaultFolderTreeModal } from "@ui/flow-modal/folder-picker-modal";
import { renderPreflightSection } from "@ui/flow-modal/preflight-section";
import type {
  DesktopDialog,
  StageDescriptor,
  UiStatus,
  VaultFolderTreeNode
} from "@ui/flow-modal/types";
import {
  type FlowSourceSectionOptions,
  renderSourceDetails,
  renderSourceInput,
  renderSourceSelector
} from "@ui/flow-modal/source-section";
import { getSourceErrorHint, getSourceGuidance } from "@ui/source-guidance";

const TERMINAL_STAGE_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];

function normalizeVaultRelativePath(filePath: string): string {
  const normalizedPath = normalizePath(filePath).replace(/^\/+/, "").replace(/\/+$/, "");
  return normalizedPath === "." ? "" : normalizedPath;
}

function parentFolderPath(filePath: string): string {
  const normalizedPath = normalizeVaultRelativePath(filePath);
  const slashIndex = normalizedPath.lastIndexOf("/");
  return slashIndex === -1 ? "" : normalizedPath.slice(0, slashIndex);
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
  private mediaDiagnostics: RuntimeDiagnosticsSummary | null = null;
  private mediaDiagnosticsError: string | null = null;
  private mediaDiagnosticsLoading = false;
  private isOpen = false;

  public constructor(plugin: AISummarizerPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.sourceType = plugin.settings.lastSourceType;
    this.modalEl.addClass("ai-summarizer-flow");
    this.contentEl.addClass("ai-summarizer-flow-content");
    this.setTitle(FLOW_MODAL_TITLE);
  }

  public onOpen(): void {
    this.isOpen = true;
    this.render();
  }

  public close(): void {
    if (this.isBusy() && !this.confirmCloseDuringActiveRun()) {
      return;
    }

    super.close();
  }

  public onClose(): void {
    this.isOpen = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.contentEl.empty();
  }

  private confirmCloseDuringActiveRun(): boolean {
    return window.confirm(
      "摘要流程正在執行中。\n\n關閉視窗會取消目前任務，尚未完成的摘要或筆記可能不會產生。\n\n確定要關閉並取消嗎？"
    );
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

  private buildTranscriptCleanupProvider(): ReturnType<typeof createConfiguredTranscriptCleanupProvider> {
    return createConfiguredTranscriptCleanupProvider(this.plugin.settings);
  }

  private buildTranscriptionProvider(): ReturnType<typeof createConfiguredTranscriptionProvider> {
    return createConfiguredTranscriptionProvider(this.plugin.settings);
  }

  private buildNoteWriter(): NoteWriter {
    return new ObsidianNoteWriter(new VaultNoteStorage(this.plugin.app.vault), {
      outputFolder: this.plugin.settings.outputFolder,
      templateReference: this.plugin.settings.templateReference,
      generateFlashcards: this.plugin.settings.generateFlashcards
    });
  }

  private isBusy(): boolean {
    return this.status === "running" || this.status === "cancelling";
  }

  private getSourceSectionOptions(): FlowSourceSectionOptions {
    return {
      isBusy: this.isBusy(),
      sourceType: this.sourceType,
      sourceValue: this.sourceValue,
      templateReference: this.plugin.settings.templateReference,
      onPickLocalFile: () => {
        void this.pickLocalFile();
      },
      onSelectSourceType: (sourceType) => {
        this.selectSourceType(sourceType);
      },
      onSourceValueChange: (sourceValue) => {
        this.sourceValue = sourceValue;
      },
      onUseExample: (sourceValue) => {
        this.sourceValue = sourceValue;
        this.render();
      }
    };
  }

  private shouldShowMediaReadiness(): boolean {
    return this.sourceType === "media_url" || this.sourceType === "local_media";
  }

  private detectAppSurface(): "desktop" | "mobile" {
    return this.getDesktopDialog() ? "desktop" : "mobile";
  }

  private getMediaReadinessState(): "unchecked" | "checking" | "ready" | "warning" | "error" {
    if (this.mediaDiagnosticsLoading) {
      return "checking";
    }
    if (this.mediaDiagnosticsError) {
      return "error";
    }
    if (!this.mediaDiagnostics) {
      return "unchecked";
    }

    const capability = this.mediaDiagnostics.capabilities.find(
      (candidate) => candidate.sourceType === this.sourceType
    );
    const state = capability?.state ?? this.mediaDiagnostics.overallState;
    return state === "skipped" ? "warning" : state;
  }

  private getMediaReadinessText(): string {
    const state = this.getMediaReadinessState();
    if (state === "checking") {
      return "媒體工具：檢查中";
    }
    if (state === "ready") {
      return "媒體工具：可用";
    }
    if (state === "warning") {
      return "媒體工具：需注意";
    }
    if (state === "error") {
      return this.mediaDiagnosticsError ? "媒體工具：檢查失敗" : "媒體工具：不可用";
    }
    return "媒體工具：點擊檢查";
  }

  private getMediaReadinessTooltip(): string {
    const state = this.getMediaReadinessState();
    if (state === "checking") {
      return "正在檢查 yt-dlp、ffmpeg、ffprobe 與媒體暫存資料夾。";
    }
    if (this.mediaDiagnosticsError) {
      return this.mediaDiagnosticsError;
    }
    if (!this.mediaDiagnostics) {
      return "點擊檢查媒體 URL / 本機媒體所需的 yt-dlp、ffmpeg、ffprobe 與媒體暫存資料夾。";
    }

    const capability = this.mediaDiagnostics.capabilities.find(
      (candidate) => candidate.sourceType === this.sourceType
    );
    if (capability) {
      return capability.reason;
    }
    return this.mediaDiagnostics.dependencies.message;
  }

  private shouldShowMediaDiagnosticsEntry(): boolean {
    return this.getMediaReadinessState() === "error";
  }

  private async refreshMediaReadiness(): Promise<void> {
    if (this.mediaDiagnosticsLoading || this.isBusy()) {
      return;
    }

    this.mediaDiagnosticsLoading = true;
    this.mediaDiagnosticsError = null;
    this.render();

    try {
      this.mediaDiagnostics = await collectRuntimeDiagnostics(this.plugin.settings, {
        appSurface: this.detectAppSurface()
      });
    } catch (error) {
      const report = this.plugin.reportError("runtime_diagnostics", error);
      this.mediaDiagnostics = null;
      this.mediaDiagnosticsError = report.modalMessage;
    } finally {
      this.mediaDiagnosticsLoading = false;
      this.render();
    }
  }

  private localizeStageMessage(message: string): string {
    const messages: Record<string, string> = {
      "Validating webpage input": "驗證網頁輸入",
      "Fetching webpage content": "取得網頁內容",
      "Generating webpage summary": "摘要網頁內容",
      "Writing webpage note into vault": "寫入筆記",
      "Validating media input": "驗證媒體輸入",
      "Processing media URL input": "取得媒體",
      "Processing local media input": "準備本機媒體",
      "Generating media transcript": "轉錄媒體內容",
      "Cleaning transcript before summary": "校對逐字稿",
      "Generating media summary": "摘要媒體內容",
      "Writing media note into vault": "寫入筆記",
      "Validating media URL input": "驗證媒體 URL",
      "Preparing media acquisition session": "準備媒體暫存工作區",
      "Downloading media artifact": "下載媒體",
      "Preparing AI-ready media artifacts": "準備 AI 可處理的媒體",
      "Validating local media input": "驗證本機媒體",
      "Preparing local media ingestion session": "準備本機媒體暫存工作區",
      "Importing local media artifact": "匯入本機媒體",
      "Validating transcript file input": "驗證逐字稿檔案",
      "Reading transcript file": "讀取逐字稿",
      "Regenerating summary from transcript": "依逐字稿重新摘要",
      "Writing regenerated summary note into vault": "寫入筆記"
    };

    return messages[message] ?? message;
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
        { id: "cleaning", label: "校對逐字稿" },
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
      { id: "cleaning", label: "校對逐字稿" },
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
    renderSourceSelector(containerEl, this.getSourceSectionOptions());
  }

  private renderSourceInput(containerEl: HTMLElement): void {
    renderSourceInput(containerEl, this.getSourceSectionOptions());
  }

  private renderSourceDetails(containerEl: HTMLElement): void {
    renderSourceDetails(containerEl, this.getSourceSectionOptions());
  }

  private getVaultFolderTree(): VaultFolderTreeNode {
    const rootNode: VaultFolderTreeNode = {
      children: [],
      name: "根目錄",
      path: ""
    };

    const folderNodes = new Map<string, VaultFolderTreeNode>([["", rootNode]]);
    const ensureFolderNode = (folderPath: string): VaultFolderTreeNode => {
      const normalizedFolderPath = normalizeVaultRelativePath(folderPath);
      if (normalizedFolderPath.length === 0) {
        return rootNode;
      }

      const existingNode = folderNodes.get(normalizedFolderPath);
      if (existingNode) {
        return existingNode;
      }

      const parentPath = parentFolderPath(normalizedFolderPath);
      const parentNode = parentPath === normalizedFolderPath ? rootNode : ensureFolderNode(parentPath);
      const folderNode: VaultFolderTreeNode = {
        children: [],
        name: normalizedFolderPath.split("/").pop() ?? normalizedFolderPath,
        path: normalizedFolderPath
      };
      parentNode.children.push(folderNode);
      folderNodes.set(normalizedFolderPath, folderNode);
      return folderNode;
    };

    const folderPaths = Array.from(
      new Set(
        this.plugin.app.vault
          .getAllLoadedFiles()
          .filter((file): file is TFolder => file instanceof TFolder)
          .map((folder) => normalizeVaultRelativePath(folder.path))
          .filter((folderPath) => folderPath.length > 0)
      )
    );
    for (const folderPath of folderPaths) {
      ensureFolderNode(folderPath);
    }

    const sortedNodes = new Set<VaultFolderTreeNode>();
    const sortNode = (node: VaultFolderTreeNode): void => {
      if (sortedNodes.has(node)) {
        return;
      }
      sortedNodes.add(node);
      node.children.sort((left, right) => left.name.localeCompare(right.name));
      for (const child of node.children) {
        sortNode(child);
      }
    };
    sortNode(rootNode);
    return rootNode;
  }

  private pickOutputFolder(): void {
    new FlowVaultFolderTreeModal(this.plugin, this.getVaultFolderTree(), this.plugin.settings.outputFolder, (folderPath) => {
      this.plugin.settings.outputFolder = folderPath;
      void this.plugin.saveSettings().then(() => {
        this.plugin.notify(
          folderPath.length > 0
            ? `輸出資料夾已設定為：${folderPath}`
            : "輸出資料夾已設定為 vault 根目錄。"
        );
        this.render();
      });
    }).open();
  }

  private renderPreflightSummary(containerEl: HTMLElement): void {
    renderPreflightSection(containerEl, {
      isBusy: this.isBusy(),
      mediaDiagnosticsLoading: this.mediaDiagnosticsLoading,
      mediaReadinessState: this.getMediaReadinessState(),
      mediaReadinessText: this.getMediaReadinessText(),
      mediaReadinessTooltip: this.getMediaReadinessTooltip(),
      settings: this.plugin.settings,
      shouldShowMediaDiagnosticsEntry: this.shouldShowMediaDiagnosticsEntry(),
      shouldShowMediaReadiness: this.shouldShowMediaReadiness(),
      sourceType: this.sourceType,
      onOpenSettingsTab: () => {
        this.plugin.openSettingsTab();
      },
      onPickOutputFolder: () => {
        this.pickOutputFolder();
      },
      onRefresh: () => {
        this.render();
      },
      onRefreshMediaReadiness: () => {
        void this.refreshMediaReadiness();
      },
      saveSettings: () => this.plugin.saveSettings()
    });
  }

  private renderStageStatus(containerEl: HTMLElement, renderActions?: (containerEl: HTMLElement) => void): void {
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

    renderActions?.(sectionEl);
  }

  private renderResultPanel(containerEl: HTMLElement): void {
    if (this.status === "failed") {
      this.renderFailedPanel(containerEl);
      return;
    }

    if (this.status === "cancelled") {
      this.renderCancelledPanel(containerEl);
    }
  }

  private renderCompletedExecutionMessage(containerEl: HTMLElement): void {
    const resultEl = containerEl.createDiv({ cls: "ai-summarizer-execution-result" });
    resultEl.createEl("h3", {
      cls: "ai-summarizer-result-title",
      text: "已建立摘要筆記"
    });
    resultEl.createEl("p", {
      cls: "ai-summarizer-result-path",
      text: this.resultNotePath || "筆記路徑尚未回傳"
    });

    const actionsEl = resultEl.createDiv({ cls: "ai-summarizer-result-actions" });
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

  private renderPrimaryActions(containerEl: HTMLElement): void {
    const actionsEl = containerEl.createDiv({ cls: "ai-summarizer-actions" });
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

  private renderExecutionDetails(containerEl: HTMLElement): void {
    const shouldShowCompletedResult = this.status === "completed";
    if (!shouldShowCompletedResult && this.warningMessages.length === 0) {
      return;
    }

    const detailsEl = containerEl.createEl("details", {
      cls: "ai-summarizer-source-details ai-summarizer-execution-details"
    });
    detailsEl.open = shouldShowCompletedResult;
    detailsEl.createEl("summary", {
      text: shouldShowCompletedResult
        ? "執行訊息：已建立摘要筆記"
        : `執行訊息：Warnings (${this.warningMessages.length})`
    });

    if (shouldShowCompletedResult) {
      this.renderCompletedExecutionMessage(detailsEl);
    }

    if (this.warningMessages.length > 0) {
      detailsEl.createEl("h4", {
        cls: "ai-summarizer-execution-subtitle",
        text: "Warnings"
      });
      const listEl = detailsEl.createEl("ul");
      for (const warning of this.warningMessages) {
        listEl.createEl("li", { text: warning });
      }
    }
  }

  private render(): void {
    if (!this.isOpen) {
      return;
    }

    const { contentEl } = this;

    contentEl.empty();

    this.renderSourceSelector(contentEl);
    this.renderSourceInput(contentEl);
    this.renderSourceDetails(contentEl);
    const statusLayoutEl = contentEl.createDiv({ cls: "ai-summarizer-status-layout" });
    this.renderPreflightSummary(statusLayoutEl);
    const statusSideEl = statusLayoutEl.createDiv({ cls: "ai-summarizer-status-side" });
    this.renderStageStatus(statusSideEl, (sectionEl) => {
      this.renderPrimaryActions(sectionEl);
    });

    this.renderExecutionDetails(contentEl);

    this.renderResultPanel(contentEl);
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
          this.stageMessage = this.localizeStageMessage(message);
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
        enableTranscriptCleanup: this.plugin.settings.enableTranscriptCleanup,
        transcriptCleanupFailureMode: this.plugin.settings.transcriptCleanupFailureMode,
        summaryProvider: this.plugin.settings.summaryProvider,
        summaryModel: this.plugin.settings.summaryModel
      } satisfies TranscriptFileRequest,
      {
        summaryProvider: this.buildAiProvider(),
        transcriptCleanupProvider: this.buildTranscriptCleanupProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (status, message) => {
          this.currentStageStatus = status;
          this.stageMessage = this.localizeStageMessage(message);
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
        geminiTranscriptionStrategy: this.plugin.settings.geminiTranscriptionStrategy,
        enableTranscriptCleanup: this.plugin.settings.enableTranscriptCleanup,
        transcriptCleanupFailureMode: this.plugin.settings.transcriptCleanupFailureMode,
        summaryProvider: this.plugin.settings.summaryProvider,
        summaryModel: this.plugin.settings.summaryModel,
        retentionMode: this.plugin.settings.retentionMode,
        mediaCacheRoot: this.plugin.settings.mediaCacheRoot,
        ytDlpPath: this.plugin.settings.ytDlpPath,
        ffmpegPath: this.plugin.settings.ffmpegPath,
        ffprobePath: this.plugin.settings.ffprobePath,
        mediaCompressionProfile: this.plugin.settings.mediaCompressionProfile
      } as MediaUrlRequest | LocalMediaRequest,
      {
        runtimeProvider: this.buildRuntimeProvider(),
        transcriptionProvider: this.buildTranscriptionProvider(),
        transcriptCleanupProvider: this.buildTranscriptCleanupProvider(),
        summaryProvider: this.buildAiProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (status, message) => {
          this.currentStageStatus = status;
          this.stageMessage = this.localizeStageMessage(message);
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
