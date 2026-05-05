import { Modal, normalizePath, TFile, TFolder } from "obsidian";
import type { ErrorCategory } from "@domain/errors";
import type { JobStatus } from "@domain/jobs";
import type { SourceType } from "@domain/types";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import {
  collectRuntimeDiagnostics,
  type RuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";
import { FLOW_MODAL_TITLE } from "@ui/flow-modal/copy";
import {
  type FlowExecutionPanelOptions,
  renderExecutionDetails,
  renderPrimaryActions,
  renderResultPanel,
  renderStageStatus
} from "@ui/flow-modal/execution-panels";
import { FlowVaultFolderTreeModal } from "@ui/flow-modal/folder-picker-modal";
import { runSummarizerFlow } from "@ui/flow-modal/flow-job-runner";
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
      title: isTranscriptFile ? "選擇文字檔案" : "選擇本機媒體檔案",
      properties: ["openFile"],
      filters: [
        isTranscriptFile
          ? {
              name: "Text",
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
        { id: "acquiring", label: "讀取文字檔案" },
        { id: "cleaning", label: "校對文字" },
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

  private useRecoveryTranscriptFile(transcriptPath: string): void {
    this.sourceType = "transcript_file";
    this.sourceValue = transcriptPath;
    this.status = "idle";
    this.currentStageStatus = "idle";
    this.stageMessage = "等待開始";
    this.resultMessage = "";
    this.failureCategory = null;
    void this.persistLastSourceType("transcript_file");
    this.render();
  }

  private getExecutionPanelOptions(): FlowExecutionPanelOptions {
    const recoveryTranscriptPath = this.findRecoveryTranscriptPath();
    return {
      currentStageStatus: this.currentStageStatus,
      failureCategory: this.failureCategory,
      failedSuggestion: this.getFailedSuggestion(),
      failedTitle: this.getFailedTitle(),
      recoveryTranscriptPath,
      resultMessage: this.resultMessage,
      resultNotePath: this.resultNotePath,
      stageDescriptors: this.getStageDescriptors(),
      stageMessage: this.stageMessage,
      status: this.status,
      warningMessages: this.warningMessages,
      onCancel: () => {
        this.cancelFlow();
      },
      onClose: () => {
        this.close();
      },
      onCopyResultPath: () => {
        if (this.resultNotePath) {
          void this.copyTextToClipboard(this.resultNotePath, "已複製筆記路徑。");
        }
      },
      onOpenResultNote: () => {
        void this.openResultNote();
      },
      onOpenSettingsTab: () => {
        this.plugin.openSettingsTab();
      },
      onRerun: () => {
        void this.startFlow();
      },
      onStart: () => {
        void this.startFlow();
      },
      onUseTranscriptFile: (transcriptPath) => {
        this.useRecoveryTranscriptFile(transcriptPath);
      }
    };
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
    renderStageStatus(containerEl, this.getExecutionPanelOptions(), renderActions);
  }

  private renderResultPanel(containerEl: HTMLElement): void {
    renderResultPanel(containerEl, this.getExecutionPanelOptions());
  }

  private renderPrimaryActions(containerEl: HTMLElement): void {
    renderPrimaryActions(containerEl, this.getExecutionPanelOptions());
  }

  private renderExecutionDetails(containerEl: HTMLElement): void {
    renderExecutionDetails(containerEl, this.getExecutionPanelOptions());
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
      const result = await runSummarizerFlow({
        plugin: this.plugin,
        signal: this.abortController.signal,
        sourceType: this.sourceType,
        sourceValue: this.sourceValue,
        onStageChange: (status, message) => {
          this.currentStageStatus = status;
          this.stageMessage = message;
          this.render();
        },
        onWarning: (scope, warning) => {
          this.warningMessages.push(warning);
          this.plugin.reportWarning(scope, warning);
          this.render();
        }
      });

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
