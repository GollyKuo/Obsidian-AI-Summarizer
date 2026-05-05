import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { App, Modal, normalizePath, PluginSettingTab, Setting, TFile, TFolder } from "obsidian";
import {
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  createModelCatalogEntry,
  getFirstModelIdForProvider,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  getGeminiTranscriptionRiskMessage,
  normalizeSummaryModel,
  normalizeTranscriptionModelForProvider,
  removeModelCatalogEntry,
  upsertModelCatalogEntry,
  type AiModelCatalogEntry,
  type ModelProvider,
  type ModelPurpose,
  type SummaryModel,
  type SummaryProvider,
  type TranscriptionModel,
  type TranscriptionProvider
} from "@domain/settings";
import type { SourceType, TranscriptCleanupFailureMode } from "@domain/types";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import { testAiApiAvailability } from "@services/ai/api-health-check";
import {
  fetchGeminiModels,
  searchGeminiModels
} from "@services/ai/gemini-models";
import type { GeminiModelRecord } from "@services/ai/gemini-models";
import {
  fetchOpenRouterModels,
  searchOpenRouterModels,
  syncOpenRouterModelCatalog
} from "@services/ai/openrouter-models";
import type { OpenRouterModelRecord } from "@services/ai/openrouter-models";
import {
  fetchMistralModels,
  searchMistralModels
} from "@services/ai/mistral-models";
import type { MistralModelRecord } from "@services/ai/mistral-models";
import {
  collectRuntimeDiagnostics,
  formatRuntimeDiagnosticsSummary,
  type AppSurface,
  type DiagnosticsState,
  type RuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";
import { ensureLatestProjectFfmpegTools } from "@services/media/ffmpeg-tool-installer";
import {
  createCustomTemplateReference,
  describeTemplateReference,
  getCustomTemplatePath,
  isBuiltinTemplateReference,
  listBuiltinTemplates,
  UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE
} from "@services/obsidian/template-library";
import {
  getLocalManagedModelSuggestions,
  mergeManagedModelSuggestions,
  searchManagedModelSuggestions,
  type ManagedModelSuggestion
} from "@ui/model-autocomplete";
import {
  DIAGNOSTIC_CAPABILITY_LABELS,
  SETTINGS_SECTIONS,
  SOURCE_TYPE_LABELS,
  TRANSCRIPT_CLEANUP_FAILURE_MODE_LABELS,
  type SettingsSection
} from "@ui/settings-copy";
import { renderHelpSection } from "@ui/settings/help-section";
import { renderOutputMediaSection } from "@ui/settings/output-media-section";

type ApiTestTarget = "transcription" | "summary";

const TRANSCRIPT_CLEANUP_FAILURE_MODE_OPTIONS: TranscriptCleanupFailureMode[] = ["fallback_to_original", "fail"];
const CUSTOM_TEMPLATE_OPTION = "__custom__";
const MODEL_AUTOCOMPLETE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CUSTOM_TEMPLATE_BODY = [
  "---",
  'title: "{{title}}"',
  'book: "{{book}}"',
  'author: "{{author}}"',
  'creator: "{{creator}}"',
  'description: "{{description}}"',
  "tags:{{tags}}",
  'platform: "{{platform}}"',
  'source: "{{source}}"',
  'created: "{{createdDate}}"',
  "---",
  "",
  "# {{title}}",
  "",
  "{{summary}}",
  "",
  "## Transcript",
  "",
  "{{transcript}}",
  ""
].join("\n");

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

type MediaToolPathSettingKey = "ytDlpPath" | "ffmpegPath" | "ffprobePath";

const execFileAsync = promisify(execFile);

interface VaultTemplateTreeNode {
  children: VaultTemplateTreeNode[];
  name: string;
  path: string;
  type: "folder" | "file";
}

class VaultTemplateTreeModal extends Modal {
  public constructor(
    app: App,
    private readonly rootNode: VaultTemplateTreeNode,
    private readonly onChooseFile: (filePath: string) => void
  ) {
    super(app);
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ai-summarizer-template-picker");
    contentEl.createEl("h2", { text: "選擇自訂模板" });

    const treeEl = contentEl.createDiv({ cls: "ai-summarizer-template-tree" });
    for (const child of this.rootNode.children) {
      this.renderTreeNode(treeEl, child, 0, new Set());
    }
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private renderTreeNode(
    containerEl: HTMLElement,
    node: VaultTemplateTreeNode,
    depth: number,
    ancestorNodes: Set<VaultTemplateTreeNode>
  ): void {
    if (ancestorNodes.has(node)) {
      return;
    }

    const rowEl = containerEl.createDiv({
      cls: `ai-summarizer-template-tree-row is-${node.type}`
    });
    rowEl.style.setProperty("--ais-template-tree-depth", String(depth));

    if (node.type === "folder") {
      const toggleEl = rowEl.createSpan({
        cls: "ai-summarizer-template-tree-toggle"
      });
      toggleEl.setText(node.children.length > 0 ? ">" : "");

      rowEl.createSpan({ cls: "ai-summarizer-template-tree-icon is-folder" });
      rowEl.createSpan({ cls: "ai-summarizer-template-tree-label", text: node.name });
      rowEl.title = node.path || "Vault";

      if (node.children.length === 0) {
        rowEl.addClass("is-empty");
        return;
      }

      const childrenEl = containerEl.createDiv({ cls: "ai-summarizer-template-tree-children" });
      childrenEl.style.display = "none";
      const childAncestors = new Set(ancestorNodes);
      childAncestors.add(node);
      for (const child of node.children) {
        this.renderTreeNode(childrenEl, child, depth + 1, childAncestors);
      }

      const toggleChildren = (): void => {
        const isOpen = childrenEl.style.display !== "none";
        childrenEl.style.display = isOpen ? "none" : "";
        toggleEl.setText(isOpen ? ">" : "v");
        rowEl.setAttr("aria-expanded", String(!isOpen));
      };
      rowEl.setAttr("role", "button");
      rowEl.setAttr("aria-expanded", "false");
      rowEl.tabIndex = 0;
      rowEl.addEventListener("click", toggleChildren);
      rowEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        toggleChildren();
      });
      return;
    }

    rowEl.createSpan({ cls: "ai-summarizer-template-tree-toggle-spacer" });
    rowEl.createSpan({ cls: "ai-summarizer-template-tree-icon is-file" });
    rowEl.createSpan({ cls: "ai-summarizer-template-tree-label", text: node.name });
    rowEl.title = node.path;
    rowEl.setAttr("role", "button");
    rowEl.tabIndex = 0;

    const chooseFile = (): void => {
      this.onChooseFile(node.path);
      this.close();
    };
    rowEl.addEventListener("click", chooseFile);
    rowEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      chooseFile();
    });
  }
}

class VaultFolderTreeModal extends Modal {
  public constructor(
    app: App,
    private readonly rootNode: VaultTemplateTreeNode,
    private readonly onChooseFolder: (folderPath: string) => void
  ) {
    super(app);
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ai-summarizer-template-picker");
    contentEl.createEl("h2", { text: "選擇輸出資料夾" });

    const treeEl = contentEl.createDiv({ cls: "ai-summarizer-template-tree" });
    this.renderFolderNode(treeEl, this.rootNode, 0, new Set(), true);
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private renderFolderNode(
    containerEl: HTMLElement,
    node: VaultTemplateTreeNode,
    depth: number,
    ancestorNodes: Set<VaultTemplateTreeNode>,
    expanded = false
  ): void {
    if (ancestorNodes.has(node)) {
      return;
    }

    const rowEl = containerEl.createDiv({ cls: "ai-summarizer-template-tree-row is-folder" });
    rowEl.style.setProperty("--ais-template-tree-depth", String(depth));

    const toggleEl = rowEl.createSpan({ cls: "ai-summarizer-template-tree-toggle" });
    toggleEl.setText(node.children.length > 0 ? (expanded ? "v" : ">") : "");
    rowEl.createSpan({ cls: "ai-summarizer-template-tree-icon is-folder" });
    rowEl.createSpan({ cls: "ai-summarizer-template-tree-label", text: node.name });
    rowEl.title = node.path || "Vault 根目錄";
    rowEl.setAttr("role", "button");
    rowEl.tabIndex = 0;

    const chooseFolder = (): void => {
      this.onChooseFolder(node.path);
      this.close();
    };
    rowEl.addEventListener("click", chooseFolder);
    rowEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      chooseFolder();
    });

    if (node.children.length === 0) {
      return;
    }

    const childrenEl = containerEl.createDiv({ cls: "ai-summarizer-template-tree-children" });
    childrenEl.style.display = expanded ? "" : "none";
    const childAncestors = new Set(ancestorNodes);
    childAncestors.add(node);
    for (const child of node.children) {
      this.renderFolderNode(childrenEl, child, depth + 1, childAncestors);
    }

    const toggleChildren = (): void => {
      const isOpen = childrenEl.style.display !== "none";
      childrenEl.style.display = isOpen ? "none" : "";
      toggleEl.setText(isOpen ? ">" : "v");
      rowEl.setAttr("aria-expanded", String(!isOpen));
    };
    rowEl.setAttr("aria-expanded", String(expanded));
    toggleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleChildren();
    });
  }
}

function getMediaToolCommand(settingKey: MediaToolPathSettingKey): string {
  if (settingKey === "ytDlpPath") {
    return "yt-dlp";
  }
  if (settingKey === "ffmpegPath") {
    return "ffmpeg";
  }
  return "ffprobe";
}

function getMediaToolPlaceholder(toolName: string): string {
  if (process.platform !== "win32") {
    return `例如 /usr/local/bin/${toolName}`;
  }
  if (toolName === "yt-dlp") {
    return "例如 C:\\Tools\\yt-dlp\\yt-dlp.exe";
  }
  return `例如 C:\\ffmpeg\\bin\\${toolName}.exe`;
}

async function findExecutableInPath(command: string): Promise<string | null> {
  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";
  const result = await execFileAsync(lookupCommand, [command], {
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });
  const output = `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}`;
  return (
    output
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function getTemplateDropdownValue(templateReference: string): string {
  if (isBuiltinTemplateReference(templateReference)) {
    return UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE;
  }

  return CUSTOM_TEMPLATE_OPTION;
}

function normalizeVaultRelativePath(filePath: string): string {
  const normalizedPath = normalizePath(filePath).replace(/^\/+/, "").replace(/\/+$/, "");
  return normalizedPath === "." ? "" : normalizedPath;
}

function parentFolderPath(filePath: string): string {
  const normalizedPath = normalizeVaultRelativePath(filePath);
  const slashIndex = normalizedPath.lastIndexOf("/");
  return slashIndex === -1 ? "" : normalizedPath.slice(0, slashIndex);
}

function addInlineHeading(containerEl: HTMLElement, title: string, hint: string): void {
  const headingEl = containerEl.createEl("h3", { text: title });
  const hintEl = headingEl.createSpan({
    cls: "ai-summarizer-settings-heading-hint",
    text: hint
  });
  hintEl.style.marginLeft = "2rem";
  hintEl.style.color = "var(--text-muted)";
  hintEl.style.fontSize = "0.9em";
  hintEl.style.fontWeight = "500";
}

function getDiagnosticStateLabel(state: DiagnosticsState): string {
  if (state === "ready") {
    return "可用";
  }
  if (state === "warning") {
    return "需注意";
  }
  if (state === "error") {
    return "不可用";
  }
  return "略過";
}

function getDiagnosticStatusText(summary: RuntimeDiagnosticsSummary): string {
  if (summary.overallState === "ready") {
    return "正常";
  }
  if (summary.overallState === "warning") {
    return "需注意";
  }
  return "異常";
}

function getDiagnosticUserMessage(summary: RuntimeDiagnosticsSummary): string {
  if (summary.dependencies.state === "error" && summary.dependencies.diagnostics) {
    const missingDependencies = summary.dependencies.diagnostics.statuses
      .filter((status) => !status.available)
      .map((status) => status.name)
      .join(" / ");

    return `缺少 ${missingDependencies}，音訊與影片轉錄目前無法使用。`;
  }

  if (summary.overallState === "ready") {
    return "網頁摘要、媒體網址與本機音訊/影片功能都可以使用。";
  }

  if (summary.overallState === "warning") {
    return "部分媒體功能需要注意，請展開詳細資訊確認環境狀態。";
  }

  return "媒體處理環境尚未準備完成，音訊與影片相關功能可能無法使用。";
}

export class AISummarizerSettingTab extends PluginSettingTab {
  private readonly plugin: AISummarizerPlugin;
  private activeSection: SettingsSection = "ai_models";
  private runtimeDiagnostics: RuntimeDiagnosticsSummary | null = null;
  private runtimeDiagnosticsError: string | null = null;
  private diagnosticsLoading = false;
  private apiTestTarget: ApiTestTarget | null = null;
  private mediaToolInstallInProgress = false;
  private mediaToolInstallAbortController: AbortController | null = null;
  private modelCatalogDraftProvider: ModelProvider = "gemini";
  private modelCatalogDraftPurpose: ModelPurpose = "summary";
  private modelCatalogDraftDisplayName = "";
  private modelCatalogDraftModelId = "";
  private openRouterModelSyncInProgress = false;
  private modelDataListRefreshInProgress = false;
  private managedModelDataListEl: HTMLDataListElement | null = null;
  private geminiModelsCache: GeminiModelRecord[] | null = null;
  private geminiModelsFetchedAt = 0;
  private geminiModelsRequest: Promise<GeminiModelRecord[]> | null = null;
  private openRouterModelsCache: OpenRouterModelRecord[] | null = null;
  private openRouterModelsFetchedAt = 0;
  private openRouterModelsRequest: Promise<OpenRouterModelRecord[]> | null = null;
  private mistralModelsCache: MistralModelRecord[] | null = null;
  private mistralModelsFetchedAt = 0;
  private mistralModelsRequest: Promise<MistralModelRecord[]> | null = null;

  public constructor(app: App, plugin: AISummarizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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

  private detectAppSurface(): AppSurface {
    return this.getDesktopDialog() ? "desktop" : "mobile";
  }

  private resolvePluginDirectory(): string | null {
    const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & {
      getBasePath?: () => string;
    };
    if (typeof adapter.getBasePath !== "function") {
      return null;
    }

    const vaultBasePath = adapter.getBasePath();
    const pluginRelativeDirectory =
      this.plugin.manifest.dir ??
      path.join(this.app.vault.configDir, "plugins", this.plugin.manifest.id);

    return path.join(vaultBasePath, pluginRelativeDirectory);
  }

  private hasVaultFilesystemAccess(): boolean {
    return this.resolvePluginDirectory() !== null;
  }

  private async pickMediaStorageDirectory(): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
      this.plugin.notify("目前環境不支援目錄挑選，請直接輸入絕對路徑。");
      return;
    }

    const result = await dialog.showOpenDialog({
      title: "選擇媒體快取資料夾",
      defaultPath: this.plugin.settings.mediaCacheRoot || undefined,
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    this.plugin.settings.mediaCacheRoot = result.filePaths[0];
    await this.plugin.saveSettings();
    this.runtimeDiagnostics = null;
    this.display();
  }

  private getVaultFolderOptions(): string[] {
    const folderPaths = Array.from(
      new Set(
        this.app.vault
          .getAllLoadedFiles()
          .filter((file): file is TFolder => file instanceof TFolder)
          .map((folder) => normalizeVaultRelativePath(folder.path))
          .filter((folderPath) => folderPath.length > 0)
      )
    ).sort((left, right) => left.localeCompare(right));

    return ["", ...folderPaths];
  }

  private pickOutputFolder(): void {
    new VaultFolderTreeModal(this.app, this.getVaultFolderTree(), (folderPath) => {
      this.plugin.settings.outputFolder = folderPath;
      void this.plugin.saveSettings().then(() => {
        this.plugin.notify(
          folderPath.length > 0
            ? `輸出資料夾已設定為：${folderPath}`
            : "輸出資料夾已設定為 vault 根目錄。"
        );
        this.display();
      });
    }).open();
  }

  private getVaultFolderTree(): VaultTemplateTreeNode {
    const rootNode: VaultTemplateTreeNode = {
      children: [],
      name: "Vault 根目錄",
      path: "",
      type: "folder"
    };

    const folderNodes = new Map<string, VaultTemplateTreeNode>([["", rootNode]]);
    const ensureFolderNode = (folderPath: string): VaultTemplateTreeNode => {
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
      const folderNode: VaultTemplateTreeNode = {
        children: [],
        name: normalizedFolderPath.split("/").pop() ?? normalizedFolderPath,
        path: normalizedFolderPath,
        type: "folder"
      };
      parentNode.children.push(folderNode);
      folderNodes.set(normalizedFolderPath, folderNode);
      return folderNode;
    };

    for (const folderPath of this.getVaultFolderOptions()) {
      ensureFolderNode(folderPath);
    }

    const sortedNodes = new Set<VaultTemplateTreeNode>();
    const sortNode = (node: VaultTemplateTreeNode): void => {
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

  private getVaultTemplateTree(): VaultTemplateTreeNode {
    const rootNode = this.getVaultFolderTree();
    rootNode.name = "Vault";

    const folderNodes = new Map<string, VaultTemplateTreeNode>();
    const collectFolderNodes = (node: VaultTemplateTreeNode): void => {
      if (node.type !== "folder" || folderNodes.has(node.path)) {
        return;
      }
      folderNodes.set(node.path, node);
      for (const child of node.children) {
        collectFolderNodes(child);
      }
    };
    collectFolderNodes(rootNode);

    const ensureFolderNode = (folderPath: string): VaultTemplateTreeNode => {
      const normalizedFolderPath = normalizeVaultRelativePath(folderPath);
      const existingNode = folderNodes.get(normalizedFolderPath);
      if (existingNode) {
        return existingNode;
      }

      const parentPath = parentFolderPath(normalizedFolderPath);
      const parentNode = parentPath === normalizedFolderPath ? rootNode : ensureFolderNode(parentPath);
      const folderNode: VaultTemplateTreeNode = {
        children: [],
        name: normalizedFolderPath.split("/").pop() ?? normalizedFolderPath,
        path: normalizedFolderPath,
        type: "folder"
      };
      parentNode.children.push(folderNode);
      folderNodes.set(normalizedFolderPath, folderNode);
      return folderNode;
    };

    for (const file of this.app.vault.getMarkdownFiles()) {
      const filePath = normalizeVaultRelativePath(file.path);
      if (filePath.length === 0) {
        continue;
      }

      const parentNode = ensureFolderNode(parentFolderPath(filePath));
      parentNode.children.push({
        children: [],
        name: file.name,
        path: filePath,
        type: "file"
      });
    }

    const sortedNodes = new Set<VaultTemplateTreeNode>();
    const sortNode = (node: VaultTemplateTreeNode): void => {
      if (sortedNodes.has(node)) {
        return;
      }
      sortedNodes.add(node);

      node.children.sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === "folder" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
      for (const child of node.children) {
        sortNode(child);
      }
    };
    sortNode(rootNode);
    return rootNode;
  }

  private pickCustomTemplateFile(): void {
    try {
      new VaultTemplateTreeModal(
        this.app,
        this.getVaultTemplateTree(),
        (filePath) => {
          this.plugin.settings.templateReference = createCustomTemplateReference(filePath);
          void this.plugin.saveSettings().then(() => {
            this.plugin.notify(`自訂模板已設定為：${filePath}`);
            this.display();
          });
        }
      ).open();
    } catch (error) {
      const report = this.plugin.reportError("template_settings", error);
      this.plugin.notify(report.noticeMessage);
    }
  }

  private async ensureVaultFolder(folderPath: string): Promise<void> {
    const normalizedFolderPath = normalizePath(folderPath);
    if (!normalizedFolderPath) {
      return;
    }

    const segments = normalizedFolderPath.split("/").filter((segment) => segment.length > 0);
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (this.app.vault.getAbstractFileByPath(currentPath)) {
        continue;
      }
      await this.app.vault.createFolder(currentPath);
    }
  }

  private async createCustomTemplateFile(): Promise<void> {
    const templatePath = normalizePath(getCustomTemplatePath(this.plugin.settings.templateReference));
    if (!templatePath) {
      this.plugin.notify("請先填入自訂模板路徑。");
      return;
    }

    const existingFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (existingFile instanceof TFile) {
      this.plugin.notify(`模板已存在：${templatePath}`);
      return;
    }
    if (existingFile) {
      this.plugin.notify(`模板路徑已被資料夾占用：${templatePath}`);
      return;
    }

    try {
      await this.ensureVaultFolder(parentFolderPath(templatePath));
      await this.app.vault.create(templatePath, DEFAULT_CUSTOM_TEMPLATE_BODY);
      this.plugin.notify(`已建立自訂模板：${templatePath}`);
    } catch (error) {
      const report = this.plugin.reportError("template_settings", error);
      this.plugin.notify(report.noticeMessage);
    }
  }

  private async pickMediaToolExecutable(settingKey: MediaToolPathSettingKey): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
      this.plugin.notify("目前環境無法開啟檔案選擇器，請手動輸入可執行檔路徑。");
      return;
    }

    const toolName = getMediaToolCommand(settingKey);
    const result = await dialog.showOpenDialog({
      title: `選擇 ${toolName} 可執行檔`,
      defaultPath: this.plugin.settings[settingKey] || undefined,
      properties: ["openFile"],
      filters: [
        {
          name: "Executable",
          extensions: process.platform === "win32" ? ["exe"] : ["*"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    this.plugin.settings[settingKey] = result.filePaths[0];
    this.runtimeDiagnostics = null;
    await this.plugin.saveSettings();
    this.display();
  }

  private async autoDetectMediaToolExecutable(
    settingKey: MediaToolPathSettingKey,
    toolName: string
  ): Promise<void> {
    if (this.detectAppSurface() !== "desktop") {
      this.plugin.notify("自動偵測只支援桌面版 Obsidian。");
      return;
    }

    try {
      const detectedPath = await findExecutableInPath(toolName);
      if (!detectedPath) {
        this.plugin.notify(`找不到 ${toolName}。請先安裝，或用「選擇檔案」手動指定。`);
        return;
      }

      this.plugin.settings[settingKey] = detectedPath;
      this.runtimeDiagnostics = null;
      await this.plugin.saveSettings();
      this.plugin.notify(`已找到 ${toolName}: ${detectedPath}`);
      this.display();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.plugin.notify(`找不到 ${toolName}。請先安裝，或用「選擇檔案」手動指定。`);
      this.plugin.reportWarning("media_tool_detection", `${toolName}: ${message}`);
    }
  }

  private async installOrUpdateProjectMediaTools(): Promise<void> {
    if (this.mediaToolInstallInProgress) {
      return;
    }

    const pluginDirectory = this.resolvePluginDirectory();
    if (!pluginDirectory) {
      this.plugin.notify("自動安裝 ffmpeg/ffprobe 需要 Obsidian 桌面版的檔案系統存取。");
      return;
    }

    const abortController = new AbortController();
    this.mediaToolInstallAbortController = abortController;
    this.mediaToolInstallInProgress = true;
    this.plugin.notify("正在檢查並安裝 ffmpeg/ffprobe，第一次下載可能需要一些時間。");
    this.display();

    try {
      const result = await ensureLatestProjectFfmpegTools(pluginDirectory, {
        signal: abortController.signal,
        onDownloadAttempt: (source) => {
          this.plugin.notify(`正在從 ${source.name} 下載 ffmpeg/ffprobe。`);
        }
      });
      this.plugin.settings.ffmpegPath = result.ffmpegPath;
      this.plugin.settings.ffprobePath = result.ffprobePath;
      this.runtimeDiagnostics = null;
      await this.plugin.saveSettings();
      this.plugin.notify(
        result.installed
          ? `已安裝 ffmpeg/ffprobe ${result.version} (${result.sourceName}): ${result.binDirectory}`
          : `ffmpeg/ffprobe ${result.version} 已是最新版: ${result.binDirectory}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (abortController.signal.aborted) {
        this.plugin.notify("已取消 ffmpeg/ffprobe 下載。");
      } else {
        this.plugin.notify(`ffmpeg/ffprobe 自動安裝失敗：${message}`);
        this.plugin.reportWarning("media_tool_detection", message);
      }
    } finally {
      this.mediaToolInstallAbortController = null;
      this.mediaToolInstallInProgress = false;
      this.display();
    }
  }

  private cancelProjectMediaToolInstall(): void {
    if (!this.mediaToolInstallInProgress) {
      return;
    }

    this.mediaToolInstallAbortController?.abort();
    this.plugin.notify("正在取消 ffmpeg/ffprobe 下載。");
  }

  private async refreshDiagnostics(): Promise<void> {
    this.diagnosticsLoading = true;
    this.runtimeDiagnosticsError = null;
    this.display();

    try {
      this.runtimeDiagnostics = await collectRuntimeDiagnostics(this.plugin.settings, {
        appSurface: this.detectAppSurface()
      });
    } catch (error) {
      const report = this.plugin.reportError("runtime_diagnostics", error);
      this.runtimeDiagnosticsError = report.modalMessage;
    } finally {
      this.diagnosticsLoading = false;
      this.display();
    }
  }

  private async testTranscriptionApi(): Promise<void> {
    await this.runApiTest("transcription", {
      kind: "transcription",
      provider: this.plugin.settings.transcriptionProvider,
      model: this.plugin.settings.transcriptionModel,
      apiKey: this.getTranscriptionApiKey()
    });
  }

  private getTranscriptionApiKey(): string {
    return this.plugin.settings.transcriptionProvider === "gladia"
      ? this.plugin.settings.gladiaApiKey
      : this.plugin.settings.apiKey;
  }

  private setTranscriptionApiKey(value: string): void {
    if (this.plugin.settings.transcriptionProvider === "gladia") {
      this.plugin.settings.gladiaApiKey = value.trim();
      return;
    }

    this.plugin.settings.apiKey = value.trim();
    this.invalidateModelDataListCache("gemini");
  }

  private getTranscriptionProviderLabel(): string {
    return this.plugin.settings.transcriptionProvider === "gladia" ? "Gladia" : "Gemini";
  }

  private getTranscriptionModelPlaceholder(): string {
    return this.plugin.settings.transcriptionProvider === "gladia"
      ? "default"
      : "gemini-2.5-flash";
  }

  private getTranscriptionModelDescription(): string {
    return this.plugin.settings.transcriptionProvider === "gladia"
      ? "Gladia 第一版不需要模型 id；保留 default 供設定與模型清單一致化。"
      : "建議填入穩定的 Gemini audio-capable 模型。";
  }

  private getSummaryApiKey(): string {
    if (this.plugin.settings.summaryProvider === "openrouter") {
      return this.plugin.settings.openRouterApiKey;
    }
    if (this.plugin.settings.summaryProvider === "mistral") {
      return this.plugin.settings.mistralApiKey;
    }
    return this.plugin.settings.apiKey;
  }

  private setSummaryApiKey(value: string): void {
    if (this.plugin.settings.summaryProvider === "openrouter") {
      this.plugin.settings.openRouterApiKey = value.trim();
      this.invalidateModelDataListCache("openrouter");
      return;
    }
    if (this.plugin.settings.summaryProvider === "mistral") {
      this.plugin.settings.mistralApiKey = value.trim();
      this.invalidateModelDataListCache("mistral");
      return;
    }

    this.plugin.settings.apiKey = value.trim();
    this.invalidateModelDataListCache("gemini");
  }

  private getSummaryProviderLabel(): string {
    if (this.plugin.settings.summaryProvider === "openrouter") {
      return "OpenRouter";
    }
    if (this.plugin.settings.summaryProvider === "mistral") {
      return "Mistral";
    }
    return "Gemini";
  }

  private getSummaryModelPlaceholder(): string {
    if (this.plugin.settings.summaryProvider === "openrouter") {
      return "qwen/qwen3.6-plus";
    }
    if (this.plugin.settings.summaryProvider === "mistral") {
      return "mistral-small-latest";
    }
    return "gemini-2.5-flash";
  }

  private getSummaryApiKeyDescription(): string {
    if (this.plugin.settings.summaryProvider === "openrouter") {
      return "OpenRouter 摘要使用的 API Key。";
    }
    if (this.plugin.settings.summaryProvider === "mistral") {
      return "Mistral 摘要使用的 API Key。";
    }
    return "Gemini 摘要會共用 Gemini API Key。";
  }

  private async testSummaryApi(): Promise<void> {
    await this.runApiTest("summary", {
      kind: "summary",
      provider: this.plugin.settings.summaryProvider,
      model: this.plugin.settings.summaryModel,
      apiKey: this.getSummaryApiKey()
    });
  }

  private async runApiTest(
    target: ApiTestTarget,
    request: Parameters<typeof testAiApiAvailability>[0]
  ): Promise<void> {
    if (this.apiTestTarget) {
      return;
    }

    this.apiTestTarget = target;
    this.display();

    try {
      await this.plugin.saveSettings();
      const result = await testAiApiAvailability(request);
      this.plugin.notify(result.message);
      if (result.ok) {
        this.plugin.reportInfo("api_health_check", result.message);
      } else {
        this.plugin.reportWarning("api_health_check", result.message);
      }
    } finally {
      this.apiTestTarget = null;
      this.display();
    }
  }

  private async loadOpenRouterModels(): Promise<OpenRouterModelRecord[]> {
    if (
      this.openRouterModelsCache &&
      Date.now() - this.openRouterModelsFetchedAt < MODEL_AUTOCOMPLETE_CACHE_TTL_MS
    ) {
      return this.openRouterModelsCache;
    }

    if (this.openRouterModelsRequest) {
      return this.openRouterModelsRequest;
    }

    this.openRouterModelsRequest = fetchOpenRouterModels({
      apiKey: this.plugin.settings.openRouterApiKey
    }).then((models) => {
      this.openRouterModelsCache = models;
      this.openRouterModelsFetchedAt = Date.now();
      return models;
    });

    try {
      return await this.openRouterModelsRequest;
    } finally {
      this.openRouterModelsRequest = null;
    }
  }

  private async loadGeminiModels(): Promise<GeminiModelRecord[]> {
    if (
      this.geminiModelsCache &&
      Date.now() - this.geminiModelsFetchedAt < MODEL_AUTOCOMPLETE_CACHE_TTL_MS
    ) {
      return this.geminiModelsCache;
    }

    if (this.geminiModelsRequest) {
      return this.geminiModelsRequest;
    }

    this.geminiModelsRequest = fetchGeminiModels({
      apiKey: this.plugin.settings.apiKey
    }).then((models) => {
      this.geminiModelsCache = models;
      this.geminiModelsFetchedAt = Date.now();
      return models;
    });

    try {
      return await this.geminiModelsRequest;
    } finally {
      this.geminiModelsRequest = null;
    }
  }

  private async loadMistralModels(): Promise<MistralModelRecord[]> {
    if (
      this.mistralModelsCache &&
      Date.now() - this.mistralModelsFetchedAt < MODEL_AUTOCOMPLETE_CACHE_TTL_MS
    ) {
      return this.mistralModelsCache;
    }

    if (this.mistralModelsRequest) {
      return this.mistralModelsRequest;
    }

    this.mistralModelsRequest = fetchMistralModels({
      apiKey: this.plugin.settings.mistralApiKey
    }).then((models) => {
      this.mistralModelsCache = models;
      this.mistralModelsFetchedAt = Date.now();
      return models;
    });

    try {
      return await this.mistralModelsRequest;
    } finally {
      this.mistralModelsRequest = null;
    }
  }

  private invalidateModelDataListCache(
    provider: "gemini" | "openrouter" | "mistral" | "all" = "all"
  ): void {
    if (provider === "all" || provider === "gemini") {
      this.geminiModelsCache = null;
      this.geminiModelsFetchedAt = 0;
    }

    if (provider === "all" || provider === "openrouter") {
      this.openRouterModelsCache = null;
      this.openRouterModelsFetchedAt = 0;
    }

    if (provider === "all" || provider === "mistral") {
      this.mistralModelsCache = null;
      this.mistralModelsFetchedAt = 0;
    }
  }

  private async refreshModelDataList(provider: "gemini" | "openrouter" | "mistral"): Promise<number> {
    if (provider === "gemini") {
      const models = await fetchGeminiModels({
        apiKey: this.plugin.settings.apiKey
      });
      this.geminiModelsCache = models;
      this.geminiModelsFetchedAt = Date.now();
      this.geminiModelsRequest = null;
      return models.length;
    }

    if (provider === "mistral") {
      const models = await fetchMistralModels({
        apiKey: this.plugin.settings.mistralApiKey
      });
      this.mistralModelsCache = models;
      this.mistralModelsFetchedAt = Date.now();
      this.mistralModelsRequest = null;
      return models.length;
    }

    const models = await fetchOpenRouterModels({
      apiKey: this.plugin.settings.openRouterApiKey
    });
    this.openRouterModelsCache = models;
    this.openRouterModelsFetchedAt = Date.now();
    this.openRouterModelsRequest = null;
    return models.length;
  }

  private async refreshManagedModelDataLists(): Promise<void> {
    if (this.modelDataListRefreshInProgress) {
      return;
    }

    this.modelDataListRefreshInProgress = true;
    this.display();

    try {
      const refreshTasks: Array<Promise<string>> = [
        this.refreshModelDataList("openrouter").then((count) => `OpenRouter ${count} 筆`)
      ];

      if (this.plugin.settings.mistralApiKey.trim().length > 0) {
        refreshTasks.push(this.refreshModelDataList("mistral").then((count) => `Mistral ${count} 筆`));
      } else {
        this.invalidateModelDataListCache("mistral");
        refreshTasks.push(Promise.resolve("Mistral 略過（未填 API Key）"));
      }

      if (this.plugin.settings.apiKey.trim().length > 0) {
        refreshTasks.push(this.refreshModelDataList("gemini").then((count) => `Gemini ${count} 筆`));
      } else {
        this.invalidateModelDataListCache("gemini");
        refreshTasks.push(Promise.resolve("Gemini 略過（未填 API Key）"));
      }

      const results = await Promise.allSettled(refreshTasks);
      const messages: string[] = [];
      let failed = false;

      for (const result of results) {
        if (result.status === "fulfilled") {
          messages.push(result.value);
          continue;
        }

        failed = true;
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        messages.push(message);
      }

      if (failed) {
        this.plugin.notify(`模型清單更新完成，但有警告：${messages.join("；")}`);
        for (const result of results) {
          if (result.status === "rejected") {
            const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
            this.plugin.reportWarning("model_data_list_refresh", message);
          }
        }
      } else {
        this.plugin.notify(`模型清單已更新：${messages.join("，")}。`);
      }
    } finally {
      this.modelDataListRefreshInProgress = false;
      this.display();
    }
  }

  private resolveManagedModelDataProvider(
    provider: SummaryProvider | TranscriptionProvider,
    purpose: ModelPurpose
  ): ModelProvider | null {
    if (purpose === "summary") {
      if (provider === "openrouter") {
        return "openrouter";
      }
      if (provider === "mistral") {
        return "mistral";
      }
      return provider === "gemini" ? "gemini" : null;
    }

    if (provider === "gemini" || provider === "gladia") {
      return provider;
    }

    return null;
  }

  private getManagedModelDataListEl(): HTMLDataListElement {
    if (this.managedModelDataListEl?.isConnected) {
      return this.managedModelDataListEl;
    }

    const existing = document.getElementById(
      "ai-summarizer-managed-model-suggest"
    ) as HTMLDataListElement | null;
    if (existing) {
      this.managedModelDataListEl = existing;
      return existing;
    }

    const dataListEl = document.createElement("datalist");
    dataListEl.id = "ai-summarizer-managed-model-suggest";
    document.body.appendChild(dataListEl);
    this.managedModelDataListEl = dataListEl;
    return dataListEl;
  }

  private async updateManagedModelAutocomplete(
    query: string,
    provider: ModelProvider | null,
    purpose: ModelPurpose
  ): Promise<void> {
    const dataListEl = this.getManagedModelDataListEl();
    dataListEl.replaceChildren();

    if (!provider || query.trim().length === 0) {
      return;
    }

    try {
      const suggestions = await this.searchManagedModels(provider, purpose, query);

      for (const suggestion of suggestions) {
        const optionEl = document.createElement("option");
        optionEl.value = suggestion.id;
        optionEl.label = suggestion.name;
        dataListEl.appendChild(optionEl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.plugin.reportWarning(`${provider}_models`, message);
    }
  }

  private async searchManagedModels(
    provider: ModelProvider,
    purpose: ModelPurpose,
    query: string
  ): Promise<ManagedModelSuggestion[]> {
    const localSuggestions = searchManagedModelSuggestions(
      getLocalManagedModelSuggestions(
        this.plugin.settings.modelCatalog,
        provider,
        purpose,
        this.getSelectedManagedModel(provider, purpose)
      ),
      query
    );

    if (provider === "gladia") {
      return localSuggestions;
    }

    try {
      if (provider === "openrouter") {
        return mergeManagedModelSuggestions(
          localSuggestions,
          searchOpenRouterModels(await this.loadOpenRouterModels(), query)
        );
      }
      if (provider === "mistral") {
        return mergeManagedModelSuggestions(
          localSuggestions,
          searchMistralModels(await this.loadMistralModels(), query)
        );
      }
      return mergeManagedModelSuggestions(
        localSuggestions,
        searchGeminiModels(await this.loadGeminiModels(), query)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.plugin.reportWarning(`${provider}_models`, message);
      return localSuggestions;
    }
  }

  private getSelectedManagedModel(provider: ModelProvider, purpose: ModelPurpose): string | undefined {
    if (purpose === "transcription" && provider === this.plugin.settings.transcriptionProvider) {
      return this.plugin.settings.transcriptionModel;
    }

    if (purpose === "summary" && provider === this.plugin.settings.summaryProvider) {
      return this.plugin.settings.summaryModel;
    }

    return undefined;
  }

  private attachManagedModelAutocomplete(
    inputEl: HTMLInputElement,
    purpose: ModelPurpose,
    resolveProvider: () => ModelProvider | null,
    onValueChange: (value: string) => void
  ): void {
    inputEl.setAttribute("list", this.getManagedModelDataListEl().id);
    inputEl.setAttribute("autocomplete", "off");

    const updateSuggestions = (): void => {
      void this.updateManagedModelAutocomplete(inputEl.value, resolveProvider(), purpose);
    };

    inputEl.addEventListener("input", () => {
      onValueChange(inputEl.value);
      updateSuggestions();
    });
    inputEl.addEventListener("change", () => {
      onValueChange(inputEl.value);
      updateSuggestions();
    });
    inputEl.addEventListener("focus", updateSuggestions);
  }

  private persistSelectedModelInCatalog(
    provider: SummaryProvider | TranscriptionProvider,
    purpose: "summary" | "transcription",
    modelId: string
  ): void {
    const normalizedModelId =
      purpose === "transcription"
        ? normalizeTranscriptionModelForProvider(provider as TranscriptionProvider, modelId)
        : normalizeSummaryModel(provider as SummaryProvider, modelId);

    this.plugin.settings.modelCatalog = upsertModelCatalogEntry(
      this.plugin.settings.modelCatalog,
      {
        provider,
        purpose,
        displayName: normalizedModelId,
        modelId: normalizedModelId,
        source: "user"
      }
    );
  }

  private async addModelCatalogDraft(): Promise<void> {
    const entry = createModelCatalogEntry({
      provider: this.modelCatalogDraftProvider,
      purpose: this.modelCatalogDraftPurpose,
      displayName: this.modelCatalogDraftDisplayName,
      modelId: this.modelCatalogDraftModelId
    });

    if (!entry) {
      this.plugin.notify("Model id is required, and OpenRouter is summary-only.");
      return;
    }

    this.plugin.settings.modelCatalog = upsertModelCatalogEntry(
      this.plugin.settings.modelCatalog,
      entry
    );
    if (entry.purpose === "transcription") {
      this.plugin.settings.transcriptionProvider = entry.provider as TranscriptionProvider;
      this.plugin.settings.transcriptionModel = entry.modelId;
    } else if (entry.provider === this.plugin.settings.summaryProvider) {
      this.plugin.settings.summaryModel = entry.modelId;
    }

    this.modelCatalogDraftDisplayName = "";
    this.modelCatalogDraftModelId = "";
    await this.plugin.saveSettings();
    this.display();
  }

  private reconcileSelectedModelsWithCatalog(): void {
    const hasSelectedTranscriptionModel = this.plugin.settings.modelCatalog.some(
      (entry) =>
        entry.provider === this.plugin.settings.transcriptionProvider &&
        entry.purpose === "transcription" &&
        entry.modelId === this.plugin.settings.transcriptionModel
    );
    if (!hasSelectedTranscriptionModel) {
      this.plugin.settings.transcriptionModel =
        getFirstModelIdForProvider(
          this.plugin.settings.modelCatalog,
          this.plugin.settings.transcriptionProvider,
          "transcription"
        ) ?? normalizeTranscriptionModelForProvider(this.plugin.settings.transcriptionProvider, "");
    }

    const hasSelectedSummaryModel = this.plugin.settings.modelCatalog.some(
      (entry) =>
        entry.provider === this.plugin.settings.summaryProvider &&
        entry.purpose === "summary" &&
        entry.modelId === this.plugin.settings.summaryModel
    );
    if (!hasSelectedSummaryModel) {
      this.plugin.settings.summaryModel =
        getFirstModelIdForProvider(
          this.plugin.settings.modelCatalog,
          this.plugin.settings.summaryProvider,
          "summary"
        ) ?? normalizeSummaryModel(this.plugin.settings.summaryProvider, "");
    }
  }

  private async updateModelCatalogEntry(
    original: AiModelCatalogEntry,
    patch: Partial<AiModelCatalogEntry>
  ): Promise<void> {
    const nextEntry = createModelCatalogEntry({
      ...original,
      ...patch,
      source: "user"
    });
    if (!nextEntry) {
      this.plugin.notify("Invalid model catalog entry.");
      return;
    }

    const withoutOriginal = removeModelCatalogEntry(this.plugin.settings.modelCatalog, original);
    this.plugin.settings.modelCatalog = upsertModelCatalogEntry(withoutOriginal, nextEntry);

    if (this.plugin.settings.transcriptionModel === original.modelId) {
      this.plugin.settings.transcriptionProvider = nextEntry.provider === "gemini"
        ? "gemini"
        : this.plugin.settings.transcriptionProvider;
      this.plugin.settings.transcriptionModel = nextEntry.purpose === "transcription"
        ? nextEntry.modelId
        : this.plugin.settings.transcriptionModel;
    }
    if (this.plugin.settings.summaryModel === original.modelId && nextEntry.purpose === "summary") {
      this.plugin.settings.summaryProvider = nextEntry.provider as SummaryProvider;
      this.plugin.settings.summaryModel = nextEntry.modelId;
    }
    this.reconcileSelectedModelsWithCatalog();

    await this.plugin.saveSettings();
    this.display();
  }

  private async deleteModelCatalogEntry(entry: AiModelCatalogEntry): Promise<void> {
    this.plugin.settings.modelCatalog = removeModelCatalogEntry(
      this.plugin.settings.modelCatalog,
      entry
    );
    this.reconcileSelectedModelsWithCatalog();
    await this.plugin.saveSettings();
    this.display();
  }

  private async syncOpenRouterModels(): Promise<void> {
    if (this.openRouterModelSyncInProgress) {
      return;
    }

    this.openRouterModelSyncInProgress = true;
    this.display();

    try {
      const models = await fetchOpenRouterModels({
        apiKey: this.plugin.settings.openRouterApiKey
      });
      const result = syncOpenRouterModelCatalog(this.plugin.settings.modelCatalog, models);
      this.plugin.settings.modelCatalog = result.catalog;
      this.reconcileSelectedModelsWithCatalog();
      await this.plugin.saveSettings();
      this.plugin.notify(
        result.messages.length > 0
          ? result.messages.slice(0, 3).join(" ")
          : `OpenRouter models checked: ${models.length} available models.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.plugin.notify(`OpenRouter model refresh failed: ${message}`);
      this.plugin.reportWarning("openrouter_models", message);
    } finally {
      this.openRouterModelSyncInProgress = false;
      this.display();
    }
  }

  private renderSectionTabs(containerEl: HTMLElement): void {
    const tabsEl = containerEl.createDiv({ cls: "ai-summarizer-settings-tabs" });
    tabsEl.style.display = "flex";
    tabsEl.style.flexWrap = "wrap";
    tabsEl.style.gap = "0.5rem";
    tabsEl.style.margin = "1rem 0 1.25rem";

    for (const section of SETTINGS_SECTIONS) {
      const buttonEl = tabsEl.createEl("button", {
        cls: section.id === this.activeSection ? "mod-cta" : "",
        text: section.label
      });
      buttonEl.type = "button";
      buttonEl.onclick = () => {
        this.activeSection = section.id;
        this.display();
      };
    }
  }

  private renderTranscriptionSettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "轉錄模型", "媒體轉文字");

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Gemini 會優先使用 Files API 上傳抽音訊後的 AI-ready artifact，失敗時回到 inline chunk；Gladia 維持非同步預錄媒體轉錄。")
      .addDropdown((dropdown) => {
        for (const option of TRANSCRIPTION_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown
          .setValue(this.plugin.settings.transcriptionProvider)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionProvider = value as TranscriptionProvider;
            this.plugin.settings.transcriptionModel =
              getFirstModelIdForProvider(
                this.plugin.settings.modelCatalog,
                this.plugin.settings.transcriptionProvider,
                "transcription"
              ) ?? normalizeTranscriptionModelForProvider(this.plugin.settings.transcriptionProvider, "");
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc(this.getTranscriptionModelDescription())
      .addDropdown((dropdown) => {
        for (const option of getTranscriptionModelOptions(
          this.plugin.settings.transcriptionProvider,
          this.plugin.settings.modelCatalog,
          this.plugin.settings.transcriptionModel
        )) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown
          .setValue(this.plugin.settings.transcriptionModel)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionModel = value as TranscriptionModel;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(`${this.getTranscriptionProviderLabel()} 轉錄使用的 API Key。`)
      .addText((text) =>
        text
          .setPlaceholder(`輸入 ${this.getTranscriptionProviderLabel()} API Key`)
          .setValue(this.getTranscriptionApiKey())
          .onChange(async (value) => {
            this.setTranscriptionApiKey(value);
            await this.plugin.saveSettings();
            this.display();
          })
      )
      .addButton((button) =>
        button
          .setButtonText(this.apiTestTarget === "transcription" ? "測試中..." : "測試")
          .setDisabled(this.apiTestTarget !== null)
          .onClick(() => {
            void this.testTranscriptionApi();
          })
      );
  }

  private renderSummarySettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "摘要模型", "文字轉摘要");

    new Setting(containerEl)
      .setName("Provider")
      .addDropdown((dropdown) => {
        for (const option of SUMMARY_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(this.plugin.settings.summaryProvider).onChange(async (value) => {
          const provider = value as SummaryProvider;
          this.plugin.settings.summaryProvider = provider;
          this.plugin.settings.summaryModel =
            getFirstModelIdForProvider(this.plugin.settings.modelCatalog, provider, "summary") ??
            normalizeSummaryModel(provider, "");
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("摘要模型只處理文字輸入；媒體逐字稿會先由轉錄模型產生。")
      .addDropdown((dropdown) => {
        for (const option of getSummaryModelOptions(
          this.plugin.settings.summaryProvider,
          this.plugin.settings.modelCatalog,
          this.plugin.settings.summaryModel
        )) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(this.plugin.settings.summaryModel).onChange(async (value) => {
          this.plugin.settings.summaryModel = value as SummaryModel;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(this.getSummaryApiKeyDescription())
      .addText((text) => {
        text
          .setPlaceholder(`輸入 ${this.getSummaryProviderLabel()} API Key`)
          .setValue(this.getSummaryApiKey())
          .onChange(async (value) => {
            this.setSummaryApiKey(value);
            await this.plugin.saveSettings();
            this.display();
          });
      })
      .addButton((button) =>
        button
          .setButtonText(this.apiTestTarget === "summary" ? "測試中..." : "測試")
          .setDisabled(this.apiTestTarget !== null)
          .onClick(() => {
            void this.testSummaryApi();
          })
      );
  }

  private renderDirectTranscriptionSettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "轉錄模型", "媒體轉文字");

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Gemini 會優先使用 Files API 上傳抽音訊後的 AI-ready artifact，失敗時回到 inline chunk；Gladia 維持非同步預錄媒體轉錄。")
      .addDropdown((dropdown) => {
        for (const option of TRANSCRIPTION_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown
          .setValue(this.plugin.settings.transcriptionProvider)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionProvider = value as TranscriptionProvider;
            this.plugin.settings.transcriptionModel =
              getFirstModelIdForProvider(
                this.plugin.settings.modelCatalog,
                this.plugin.settings.transcriptionProvider,
                "transcription"
              ) ?? normalizeTranscriptionModelForProvider(this.plugin.settings.transcriptionProvider, "");
            this.persistSelectedModelInCatalog(
              this.plugin.settings.transcriptionProvider,
              "transcription",
              this.plugin.settings.transcriptionModel
            );
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc(this.getTranscriptionModelDescription())
      .addText((text) =>
        text
          .setPlaceholder(this.getTranscriptionModelPlaceholder())
          .setValue(this.plugin.settings.transcriptionModel)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionModel = normalizeTranscriptionModelForProvider(
              this.plugin.settings.transcriptionProvider,
              value
            );
            this.persistSelectedModelInCatalog(
              this.plugin.settings.transcriptionProvider,
              "transcription",
              this.plugin.settings.transcriptionModel
            );
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("API Key")
      .setDesc(`${this.getTranscriptionProviderLabel()} 轉錄使用的 API Key。`)
      .addText((text) =>
        text
          .setPlaceholder(`輸入 ${this.getTranscriptionProviderLabel()} API Key`)
          .setValue(this.getTranscriptionApiKey())
          .onChange(async (value) => {
            this.setTranscriptionApiKey(value);
            await this.plugin.saveSettings();
            this.display();
          })
      )
      .addButton((button) =>
        button
          .setButtonText(this.apiTestTarget === "transcription" ? "測試中..." : "測試")
          .setDisabled(this.apiTestTarget !== null)
          .onClick(() => {
            void this.testTranscriptionApi();
          })
      );
  }

  private renderDirectSummarySettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "摘要模型", "文字轉摘要");

    new Setting(containerEl)
      .setName("Provider")
      .addDropdown((dropdown) => {
        for (const option of SUMMARY_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(this.plugin.settings.summaryProvider).onChange(async (value) => {
          const provider = value as SummaryProvider;
          this.plugin.settings.summaryProvider = provider;
          this.plugin.settings.summaryModel = normalizeSummaryModel(
            provider,
            this.plugin.settings.summaryModel
          );
          this.persistSelectedModelInCatalog(provider, "summary", this.plugin.settings.summaryModel);
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("摘要模型只處理文字輸入；媒體逐字稿會先由轉錄模型產生。")
      .addText((text) =>
        text
          .setPlaceholder(this.getSummaryModelPlaceholder())
          .setValue(this.plugin.settings.summaryModel)
          .onChange(async (value) => {
            this.plugin.settings.summaryModel = normalizeSummaryModel(
              this.plugin.settings.summaryProvider,
              value
            );
            this.persistSelectedModelInCatalog(
              this.plugin.settings.summaryProvider,
              "summary",
              this.plugin.settings.summaryModel
            );
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(this.getSummaryApiKeyDescription())
      .addText((text) => {
        text
          .setPlaceholder(`輸入 ${this.getSummaryProviderLabel()} API Key`)
          .setValue(this.getSummaryApiKey())
          .onChange(async (value) => {
            this.setSummaryApiKey(value);
            await this.plugin.saveSettings();
            this.display();
          });
      })
      .addButton((button) =>
        button
          .setButtonText(this.apiTestTarget === "summary" ? "測試中..." : "測試")
          .setDisabled(this.apiTestTarget !== null)
          .onClick(() => {
            void this.testSummaryApi();
          })
      );
  }

  private findManagedModel<TModel extends { id: string; name: string }>(
    models: readonly TModel[],
    query: string
  ): TModel | null {
    const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ");
    return (
      models.find((model) => model.id.toLowerCase() === normalizedQuery) ??
      models.find((model) => model.name.trim().toLowerCase().replace(/\s+/g, " ") === normalizedQuery) ??
      null
    );
  }

  private async addManagedModel(
    provider: SummaryProvider | TranscriptionProvider,
    purpose: "summary" | "transcription",
    rawModelInput: string
  ): Promise<void> {
    const modelInput = rawModelInput.trim();
    if (modelInput.length === 0) {
      this.plugin.notify("請先輸入模型 ID 或模型名稱。");
      return;
    }

    if (provider === "openrouter") {
      try {
        const models = await this.loadOpenRouterModels();
        const matchedModel = this.findManagedModel(models, modelInput);
        if (!matchedModel) {
          this.plugin.notify("OpenRouter 查無此模型，請確認 model id 或名稱。");
          return;
        }

        this.plugin.settings.modelCatalog = upsertModelCatalogEntry(
          this.plugin.settings.modelCatalog,
          {
            provider,
            purpose,
            displayName: matchedModel.name,
            modelId: matchedModel.id,
            source: "openrouter",
            updatedAt: new Date().toISOString()
          }
        );
        this.plugin.settings.summaryProvider = "openrouter";
        this.plugin.settings.summaryModel = matchedModel.id;
        await this.plugin.saveSettings();
        this.plugin.notify(`已加入 OpenRouter 模型：${matchedModel.name}`);
        this.display();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.plugin.notify(`OpenRouter 模型查詢失敗：${message}`);
        this.plugin.reportWarning("openrouter_models", message);
        return;
      }
    }

    if (provider === "mistral" && purpose === "summary" && this.plugin.settings.mistralApiKey.trim().length > 0) {
      try {
        const models = await this.loadMistralModels();
        const matchedModel = this.findManagedModel(models, modelInput);
        if (!matchedModel) {
          this.plugin.notify("Mistral 查無此模型，請確認 model id 或名稱。");
          return;
        }

        this.plugin.settings.modelCatalog = upsertModelCatalogEntry(
          this.plugin.settings.modelCatalog,
          {
            provider,
            purpose,
            displayName: matchedModel.name,
            modelId: matchedModel.id,
            source: "mistral",
            updatedAt: new Date().toISOString()
          }
        );
        this.plugin.settings.summaryProvider = "mistral";
        this.plugin.settings.summaryModel = matchedModel.id;
        await this.plugin.saveSettings();
        this.plugin.notify(`已加入 Mistral 模型：${matchedModel.name}`);
        this.display();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.plugin.notify(`Mistral 模型查詢失敗：${message}`);
        this.plugin.reportWarning("mistral_models", message);
        return;
      }
    }

    const modelId =
      purpose === "transcription"
        ? normalizeTranscriptionModelForProvider(provider as TranscriptionProvider, modelInput)
        : normalizeSummaryModel(provider as SummaryProvider, modelInput);
    this.plugin.settings.modelCatalog = upsertModelCatalogEntry(
      this.plugin.settings.modelCatalog,
      {
        provider,
        purpose,
        displayName: modelId,
        modelId,
        source: "user"
      }
    );
    if (purpose === "transcription") {
      this.plugin.settings.transcriptionProvider = provider as TranscriptionProvider;
      this.plugin.settings.transcriptionModel = modelId;
    } else {
      this.plugin.settings.summaryProvider = provider as SummaryProvider;
      this.plugin.settings.summaryModel = modelId;
    }
    await this.plugin.saveSettings();
    this.display();
  }

  private async deleteManagedModel(
    provider: SummaryProvider | TranscriptionProvider,
    purpose: "summary" | "transcription",
    modelId: string
  ): Promise<void> {
    this.plugin.settings.modelCatalog = removeModelCatalogEntry(
      this.plugin.settings.modelCatalog,
      { provider, purpose, modelId }
    );

    if (purpose === "transcription") {
      const transcriptionProvider = provider as TranscriptionProvider;
      this.plugin.settings.transcriptionProvider = transcriptionProvider;
      this.plugin.settings.transcriptionModel =
        getFirstModelIdForProvider(
          this.plugin.settings.modelCatalog,
          transcriptionProvider,
          "transcription"
        ) ??
        normalizeTranscriptionModelForProvider(transcriptionProvider, "");
    } else {
      const summaryProvider = provider as SummaryProvider;
      this.plugin.settings.summaryModel =
        getFirstModelIdForProvider(this.plugin.settings.modelCatalog, summaryProvider, "summary") ??
        normalizeSummaryModel(summaryProvider, "");
    }

    await this.plugin.saveSettings();
    this.display();
  }

  private renderManagedTranscriptionSettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "轉錄模型", "媒體轉文字");

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Gemini 會優先使用 Files API 上傳抽音訊後的 AI-ready artifact，失敗時回到 inline chunk；Gladia 維持非同步預錄媒體轉錄。")
      .addDropdown((dropdown) => {
        for (const option of TRANSCRIPTION_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(this.plugin.settings.transcriptionProvider).onChange(async (value) => {
          this.plugin.settings.transcriptionProvider = value as TranscriptionProvider;
          this.plugin.settings.transcriptionModel =
            getFirstModelIdForProvider(
              this.plugin.settings.modelCatalog,
              this.plugin.settings.transcriptionProvider,
              "transcription"
            ) ?? normalizeTranscriptionModelForProvider(this.plugin.settings.transcriptionProvider, "");
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("從你自訂的轉錄模型清單選擇。")
      .addDropdown((dropdown) => {
        for (const option of getTranscriptionModelOptions(
          this.plugin.settings.transcriptionProvider,
          this.plugin.settings.modelCatalog,
          this.plugin.settings.transcriptionModel
        )) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(this.plugin.settings.transcriptionModel).onChange(async (value) => {
          this.plugin.settings.transcriptionModel = value as TranscriptionModel;
          await this.plugin.saveSettings();
        });
      });

    let newTranscriptionModel = "";
    let manageTranscriptionModelInputEl: HTMLInputElement | null = null;
    new Setting(containerEl)
      .setName("管理模型")
      .setDesc("新增或刪除轉錄模型下拉選單中的項目。")
      .addText((text) => {
        manageTranscriptionModelInputEl = text.inputEl;
        return text.setPlaceholder(this.getTranscriptionModelPlaceholder()).onChange((value) => {
          newTranscriptionModel = value;
        });
      })
      .addButton((button) =>
        button.setButtonText("新增").onClick(() => {
          void this.addManagedModel(
            this.plugin.settings.transcriptionProvider,
            "transcription",
            newTranscriptionModel
          );
        })
      )
      .addButton((button) =>
        button.setButtonText("刪除目前模型").onClick(() => {
          void this.deleteManagedModel(
            this.plugin.settings.transcriptionProvider,
            "transcription",
            this.plugin.settings.transcriptionModel
          );
        })
      );

    if (manageTranscriptionModelInputEl) {
      this.attachManagedModelAutocomplete(
        manageTranscriptionModelInputEl,
        "transcription",
        () =>
          this.resolveManagedModelDataProvider(
            this.plugin.settings.transcriptionProvider,
            "transcription"
          ),
        (value) => {
          newTranscriptionModel = value;
        }
      );
    }

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(`${this.getTranscriptionProviderLabel()} 轉錄使用的 API Key。`)
      .addText((text) =>
        text
          .setPlaceholder(`輸入 ${this.getTranscriptionProviderLabel()} API Key`)
          .setValue(this.getTranscriptionApiKey())
          .onChange(async (value) => {
            this.setTranscriptionApiKey(value);
            await this.plugin.saveSettings();
            this.display();
          })
      )
      .addButton((button) =>
        button
          .setButtonText(this.apiTestTarget === "transcription" ? "測試中..." : "測試")
          .setDisabled(this.apiTestTarget !== null)
          .onClick(() => {
            void this.testTranscriptionApi();
          })
      );
  }

  private renderManagedSummarySettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "摘要模型", "文字轉摘要");

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Gemini 為預設；OpenRouter / Mistral 適合已有逐字稿後只重跑摘要的路徑。")
      .addDropdown((dropdown) => {
        for (const option of SUMMARY_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(this.plugin.settings.summaryProvider).onChange(async (value) => {
          const provider = value as SummaryProvider;
          this.plugin.settings.summaryProvider = provider;
          this.plugin.settings.summaryModel =
            getFirstModelIdForProvider(this.plugin.settings.modelCatalog, provider, "summary") ??
            normalizeSummaryModel(provider, "");
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("從你自訂的摘要模型清單選擇。")
      .addDropdown((dropdown) => {
        for (const option of getSummaryModelOptions(
          this.plugin.settings.summaryProvider,
          this.plugin.settings.modelCatalog,
          this.plugin.settings.summaryModel
        )) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(this.plugin.settings.summaryModel).onChange(async (value) => {
          this.plugin.settings.summaryModel = value as SummaryModel;
          await this.plugin.saveSettings();
        });
      });

    let newSummaryModel = "";
    let manageSummaryModelInputEl: HTMLInputElement | null = null;
    new Setting(containerEl)
      .setName("管理模型")
      .setDesc(
        this.plugin.settings.summaryProvider === "openrouter"
          ? "輸入 OpenRouter model id 或名稱；新增前會先查官方 models API 防呆。"
          : "新增或刪除摘要模型下拉選單中的項目。"
      )
      .addText((text) => {
        manageSummaryModelInputEl = text.inputEl;
        return text
          .setPlaceholder(this.getSummaryModelPlaceholder())
          .onChange((value) => {
            newSummaryModel = value;
          });
      })
      .addButton((button) =>
        button.setButtonText("新增").onClick(() => {
          void this.addManagedModel(
            this.plugin.settings.summaryProvider,
            "summary",
            newSummaryModel
          );
        })
      )
      .addButton((button) =>
        button.setButtonText("刪除目前模型").onClick(() => {
          void this.deleteManagedModel(
            this.plugin.settings.summaryProvider,
            "summary",
            this.plugin.settings.summaryModel
          );
        })
      );

    if (manageSummaryModelInputEl) {
      this.attachManagedModelAutocomplete(
        manageSummaryModelInputEl,
        "summary",
        () => this.resolveManagedModelDataProvider(this.plugin.settings.summaryProvider, "summary"),
        (value) => {
          newSummaryModel = value;
        }
      );
    }

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(this.getSummaryApiKeyDescription())
      .addText((text) => {
        text
          .setPlaceholder(`輸入 ${this.getSummaryProviderLabel()} API Key`)
          .setValue(this.getSummaryApiKey())
          .onChange(async (value) => {
            this.setSummaryApiKey(value);
            await this.plugin.saveSettings();
            this.display();
          });
      })
      .addButton((button) =>
        button
          .setButtonText(this.apiTestTarget === "summary" ? "測試中..." : "測試")
          .setDisabled(this.apiTestTarget !== null)
          .onClick(() => {
            void this.testSummaryApi();
          })
      );
  }

  private renderTranscriptCleanupSettings(containerEl: HTMLElement): void {
    addInlineHeading(containerEl, "逐字稿校對", "摘要前清理");

    new Setting(containerEl)
      .setName("摘要前校對逐字稿")
      .setDesc("啟用後，媒體與逐字稿檔案流程會在摘要前先用目前摘要 provider/model 做最小必要校對；預設關閉。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableTranscriptCleanup).onChange(async (value) => {
          this.plugin.settings.enableTranscriptCleanup = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName("校對失敗處理")
      .setDesc("建議保留 fallback，避免校對階段暫時失敗時整個摘要流程中止。")
      .addDropdown((dropdown) => {
        for (const mode of TRANSCRIPT_CLEANUP_FAILURE_MODE_OPTIONS) {
          dropdown.addOption(mode, TRANSCRIPT_CLEANUP_FAILURE_MODE_LABELS[mode]);
        }
        dropdown.setValue(this.plugin.settings.transcriptCleanupFailureMode).onChange(async (value) => {
          this.plugin.settings.transcriptCleanupFailureMode = value as TranscriptCleanupFailureMode;
          await this.plugin.saveSettings();
        });
      });
  }

  private renderAiModelSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("模型清單更新")
      .setDesc("自動完成會使用 Gemini / OpenRouter / Mistral 官方模型清單；Mistral 需要先填 API Key。")
      .addButton((button) =>
        button
          .setButtonText(this.modelDataListRefreshInProgress ? "更新中..." : "更新")
          .setDisabled(this.modelDataListRefreshInProgress)
          .onClick(() => {
            void this.refreshManagedModelDataLists();
          })
      );

    this.renderManagedTranscriptionSettings(containerEl);
    this.renderManagedSummarySettings(containerEl);
    this.renderTranscriptCleanupSettings(containerEl);
  }

  private renderOutputAndMediaSettings(containerEl: HTMLElement): void {
    renderOutputMediaSection(containerEl, {
      settings: this.plugin.settings,
      saveSettings: () => this.plugin.saveSettings(),
      onInvalidateRuntimeDiagnostics: () => {
        this.runtimeDiagnostics = null;
      },
      onPickMediaStorageDirectory: () => {
        void this.pickMediaStorageDirectory();
      },
      onPickOutputFolder: () => {
        this.pickOutputFolder();
      },
      onSourceTypeChanged: () => {
        this.display();
      }
    });
  }

  private renderTemplateExperience(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "筆記模板" });

    const builtinTemplates = listBuiltinTemplates();

    new Setting(containerEl)
      .setName("模板來源")
      .setDesc("選擇摘要筆記的輸出格式。可使用預設 frontmatter，或套用 vault 內的自訂模板。")
      .addDropdown((dropdown) => {
        dropdown.addOption(UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE, "預設通用 Frontmatter");
        for (const template of builtinTemplates) {
          if (template.reference === UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE) {
            continue;
          }
          dropdown.addOption(template.reference, template.label);
        }
        dropdown.addOption(CUSTOM_TEMPLATE_OPTION, "自訂模板");

        dropdown.setValue(getTemplateDropdownValue(this.plugin.settings.templateReference)).onChange(async (value) => {
          if (value === CUSTOM_TEMPLATE_OPTION) {
            if (
              this.plugin.settings.templateReference.trim().length === 0 ||
              isBuiltinTemplateReference(this.plugin.settings.templateReference)
            ) {
              this.plugin.settings.templateReference = createCustomTemplateReference("Templates/ai-summary-template.md");
            }
          } else {
            this.plugin.settings.templateReference = value;
          }

          await this.plugin.saveSettings();
          this.display();
        });
      });

    const templateStatusEl = containerEl.createDiv({ cls: "ai-summarizer-template-status" });
    templateStatusEl.setText(describeTemplateReference(this.plugin.settings.templateReference));

    if (getTemplateDropdownValue(this.plugin.settings.templateReference) === CUSTOM_TEMPLATE_OPTION) {
      new Setting(containerEl)
        .setName("自訂模板路徑")
        .setDesc("請填入 vault 內的相對路徑，例如 `Templates/ai-summary-template.md`。")
        .addText((text) =>
          text
            .setPlaceholder("Templates/ai-summary-template.md")
            .setValue(getCustomTemplatePath(this.plugin.settings.templateReference))
            .onChange(async (value) => {
              this.plugin.settings.templateReference = createCustomTemplateReference(value);
              await this.plugin.saveSettings();
              this.display();
            })
        )
        .addButton((button) =>
          button.setButtonText("選資料夾與模板").onClick(() => {
            this.pickCustomTemplateFile();
          })
        )
        .addButton((button) =>
          button.setButtonText("建立範本").onClick(() => {
            void this.createCustomTemplateFile();
          })
        );
    }

    const templateListEl = containerEl.createEl("ul");
    for (const template of builtinTemplates) {
      templateListEl.createEl("li", {
        text: `${template.label}: ${template.description} 支援 ${template.supportedSourceTypes
          .map((sourceType) => SOURCE_TYPE_LABELS[sourceType])
          .join("、")}`
      });
    }
  }

  private renderTemplateAndPromptSettings(containerEl: HTMLElement): void {
    this.renderTemplateExperience(containerEl);
  }

  private renderDiagnosticOverview(containerEl: HTMLElement): void {
    const diagnosticsSetting = new Setting(containerEl).setName("媒體處理狀態");
    const diagnosticsEl = diagnosticsSetting.descEl.createDiv({
      cls: "ai-summarizer-diagnostics"
    });

    if (this.runtimeDiagnosticsError) {
      diagnosticsEl.createEl("p", { text: this.runtimeDiagnosticsError });
      diagnosticsSetting.addExtraButton((button) => {
        button.setIcon("alert-triangle").setTooltip("檢查失敗");
      });
      return;
    }

    if (this.diagnosticsLoading) {
      diagnosticsEl.createEl("p", { text: "正在確認外掛執行環境與媒體處理工具。" });
      diagnosticsSetting.addExtraButton((button) => {
        button.setIcon("refresh-cw").setTooltip("檢查中");
      });
      return;
    }

    if (!this.runtimeDiagnostics) {
      diagnosticsEl.createEl("p", { text: "按下重新檢查後，這裡會顯示目前可用功能。" });
      diagnosticsSetting.addExtraButton((button) => {
        button.setIcon("circle-help").setTooltip("尚未檢查");
      });
      return;
    }

    const statusText = getDiagnosticStatusText(this.runtimeDiagnostics);
    diagnosticsSetting.addExtraButton((button) => {
      button
        .setIcon(this.runtimeDiagnostics?.overallState === "ready" ? "check-circle" : "alert-triangle")
        .setTooltip(`狀態：${statusText}`);
    });

    const statusEl = diagnosticsEl.createDiv();
    statusEl.style.display = "inline-flex";
    statusEl.style.alignItems = "center";
    statusEl.style.gap = "0.5rem";
    statusEl.style.marginBottom = "0.5rem";
    statusEl.createSpan({ text: statusText });

    diagnosticsEl.createEl("p", { text: getDiagnosticUserMessage(this.runtimeDiagnostics) });

    const listEl = diagnosticsEl.createDiv();
    listEl.style.display = "grid";
    listEl.style.gap = "0.35rem";
    listEl.style.marginTop = "0.75rem";
    for (const capability of this.runtimeDiagnostics.capabilities) {
      const rowEl = listEl.createDiv();
      rowEl.style.display = "grid";
      rowEl.style.gridTemplateColumns = "minmax(10rem, 1fr) auto";
      rowEl.style.gap = "1rem";
      rowEl.style.alignItems = "center";

      const label = DIAGNOSTIC_CAPABILITY_LABELS[capability.sourceType];
      const status = getDiagnosticStateLabel(capability.state);
      rowEl.createSpan({ text: label });
      rowEl.createSpan({ text: status });
    }

    const detailsEl = diagnosticsEl.createEl("details");
    detailsEl.style.marginTop = "0.85rem";
    detailsEl.createEl("summary", { text: "詳細資訊" });
    detailsEl.createEl("pre", {
      text: formatRuntimeDiagnosticsSummary(this.runtimeDiagnostics).join("\n")
    });
  }

  private renderMediaToolPathSetting(
    containerEl: HTMLElement,
    settingKey: MediaToolPathSettingKey,
    toolName: string
  ): void {
    const isYtDlp = settingKey === "ytDlpPath";
    new Setting(containerEl)
      .setName(toolName)
      .setDesc(
        isYtDlp
          ? "可留空使用系統 PATH；按「自動偵測」會尋找 PATH 中的 yt-dlp 並寫入路徑。目前不會自動下載 yt-dlp。"
          : "可留空使用系統 PATH；按「自動填入」會在外掛資料夾的 tools/ffmpeg 中檢查、下載或更新 ffmpeg/ffprobe，並寫入路徑。"
      )
      .addText((text) =>
        text
          .setPlaceholder(getMediaToolPlaceholder(toolName))
          .setValue(this.plugin.settings[settingKey])
          .onChange(async (value) => {
            this.plugin.settings[settingKey] = value.trim();
            this.runtimeDiagnostics = null;
            await this.plugin.saveSettings();
          })
      )
      .addButton((button) =>
        button.setButtonText("選擇檔案").onClick(() => {
          void this.pickMediaToolExecutable(settingKey);
        })
      )
      .addButton((button) =>
        isYtDlp
          ? button.setButtonText("自動偵測").onClick(() => {
              void this.autoDetectMediaToolExecutable(settingKey, toolName);
            })
          : button
              .setButtonText(this.mediaToolInstallInProgress ? "取消下載" : "自動填入")
              .setDisabled(!this.mediaToolInstallInProgress && !this.hasVaultFilesystemAccess())
              .onClick(() => {
                if (this.mediaToolInstallInProgress) {
                  this.cancelProjectMediaToolInstall();
                  return;
                }
                void this.installOrUpdateProjectMediaTools();
              })
      );
  }

  private renderMediaToolPathSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "媒體工具路徑" });
    this.renderMediaToolPathSetting(containerEl, "ytDlpPath", "yt-dlp");
    this.renderMediaToolPathSetting(containerEl, "ffmpegPath", "ffmpeg");
    this.renderMediaToolPathSetting(containerEl, "ffprobePath", "ffprobe");
  }

  private renderHelp(containerEl: HTMLElement): void {
    renderHelpSection(containerEl, {
      onNavigate: (section) => {
        this.activeSection = section;
        this.display();
      }
    });
  }

  private renderDiagnostics(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("除錯模式")
      .setDesc("開啟後會輸出更多 plugin log。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );

    this.renderMediaToolPathSettings(containerEl);

    new Setting(containerEl)
      .setName("媒體功能檢查")
      .setDesc("確認網頁摘要、媒體網址與本機音訊/影片是否可用。")
      .addButton((button) =>
        button
          .setButtonText(this.diagnosticsLoading ? "檢查中..." : "重新檢查")
          .setDisabled(this.diagnosticsLoading)
          .onClick(() => {
            void this.refreshDiagnostics();
          })
      );

    this.renderDiagnosticOverview(containerEl);
  }

  private renderActiveSection(containerEl: HTMLElement): void {
    if (this.activeSection === "ai_models") {
      this.renderAiModelSettings(containerEl);
      return;
    }

    if (this.activeSection === "output_media") {
      this.renderOutputAndMediaSettings(containerEl);
      return;
    }

    if (this.activeSection === "templates_prompts") {
      this.renderTemplateAndPromptSettings(containerEl);
      return;
    }

    if (this.activeSection === "help") {
      this.renderHelp(containerEl);
      return;
    }

    this.renderDiagnostics(containerEl);
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Summarizer 設定" });
    this.renderSectionTabs(containerEl);
    this.renderActiveSection(containerEl);

    if (
      this.activeSection === "diagnostics" &&
      !this.runtimeDiagnostics &&
      !this.diagnosticsLoading
    ) {
      void this.refreshDiagnostics();
    }
  }
}
