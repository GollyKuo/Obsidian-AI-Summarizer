import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { App, PluginSettingTab, Setting } from "obsidian";
import {
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  normalizeSummaryModel,
  type MediaCompressionProfile,
  type SummaryModel,
  type SummaryProvider,
  type TranscriptionModel,
  type TranscriptionProvider
} from "@domain/settings";
import type { RetentionMode, SourceType } from "@domain/types";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import { testAiApiAvailability } from "@services/ai/api-health-check";
import { listPromptAssets } from "@services/ai/prompt-assets";
import {
  collectRuntimeDiagnostics,
  formatRuntimeDiagnosticsSummary,
  type AppSurface,
  type DiagnosticsState,
  type RuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";
import { ensureLatestProjectFfmpegTools } from "@services/media/ffmpeg-tool-installer";
import {
  describeTemplateReference,
  isBuiltinTemplateReference,
  listBuiltinTemplates
} from "@services/obsidian/template-library";
import { getSourceGuidance } from "@ui/source-guidance";

type SettingsSection = "ai_models" | "output_media" | "templates_prompts" | "diagnostics";
type ApiTestTarget = "transcription" | "summary";

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: "ai_models", label: "AI 模型" },
  { id: "output_media", label: "輸出與媒體" },
  { id: "templates_prompts", label: "模板與提示" },
  { id: "diagnostics", label: "診斷" }
];

const SOURCE_TYPE_OPTIONS: SourceType[] = ["webpage_url", "media_url", "local_media"];
const RETENTION_OPTIONS: RetentionMode[] = ["none", "source", "all"];
const MEDIA_COMPRESSION_OPTIONS: MediaCompressionProfile[] = ["balanced", "quality"];
const CUSTOM_TEMPLATE_OPTION = "__custom__";

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  webpage_url: "網頁 URL",
  media_url: "媒體 URL",
  local_media: "本機媒體"
};

const DIAGNOSTIC_CAPABILITY_LABELS: Record<SourceType, string> = {
  webpage_url: "網頁摘要",
  media_url: "YouTube / 媒體網址",
  local_media: "本機音訊 / 影片"
};

const RETENTION_LABELS: Record<RetentionMode, string> = {
  none: "流程完成後刪除暫存產物",
  source: "保留來源檔與 metadata",
  all: "保留全部暫存產物"
};

const MEDIA_COMPRESSION_LABELS: Record<MediaCompressionProfile, string> = {
  balanced: "平衡：較小體積，適合日常轉錄",
  quality: "品質：保留較高音質"
};

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

type MediaToolPathSettingKey = "ffmpegPath" | "ffprobePath";

const execFileAsync = promisify(execFile);

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
  if (templateReference.trim().length === 0) {
    return "";
  }

  if (isBuiltinTemplateReference(templateReference)) {
    return templateReference;
  }

  return CUSTOM_TEMPLATE_OPTION;
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

  private async pickMediaToolExecutable(settingKey: MediaToolPathSettingKey): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
      this.plugin.notify("目前環境無法開啟檔案選擇器，請手動輸入可執行檔路徑。");
      return;
    }

    const toolName = settingKey === "ffmpegPath" ? "ffmpeg" : "ffprobe";
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
      apiKey: this.plugin.settings.apiKey
    });
  }

  private async testSummaryApi(): Promise<void> {
    const isOpenRouter = this.plugin.settings.summaryProvider === "openrouter";
    await this.runApiTest("summary", {
      kind: "summary",
      provider: this.plugin.settings.summaryProvider,
      model: this.plugin.settings.summaryModel,
      apiKey: isOpenRouter ? this.plugin.settings.openRouterApiKey : this.plugin.settings.apiKey
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
      .setDesc("目前只有 Gemini；未來加入其他 audio-capable provider 時會出現在這裡。")
      .addDropdown((dropdown) => {
        for (const option of TRANSCRIPTION_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown
          .setValue(this.plugin.settings.transcriptionProvider)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionProvider = value as TranscriptionProvider;
            this.plugin.settings.transcriptionModel = getTranscriptionModelOptions()[0].value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("建議選穩定的 Gemini audio-capable 模型。")
      .addDropdown((dropdown) => {
        for (const option of getTranscriptionModelOptions()) {
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
      .setDesc("Gemini 轉錄使用的 API Key。")
      .addText((text) =>
        text
          .setPlaceholder("輸入 Gemini API Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
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
      .setDesc("Gemini 為預設；OpenRouter 適合已有逐字稿後只重跑摘要的路徑。")
      .addDropdown((dropdown) => {
        for (const option of SUMMARY_PROVIDER_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }

        dropdown.setValue(this.plugin.settings.summaryProvider).onChange(async (value) => {
          const provider = value as SummaryProvider;
          this.plugin.settings.summaryProvider = provider;
          this.plugin.settings.summaryModel = normalizeSummaryModel(provider, "");
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("摘要模型只處理文字輸入；媒體逐字稿會先由轉錄模型產生。")
      .addDropdown((dropdown) => {
        for (const option of getSummaryModelOptions(this.plugin.settings.summaryProvider)) {
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
      .setDesc(
        this.plugin.settings.summaryProvider === "openrouter"
          ? "OpenRouter 摘要使用的 API Key。"
          : "Gemini 摘要會自動使用轉錄模型的 Gemini API Key。"
      )
      .addText((text) => {
        const isOpenRouter = this.plugin.settings.summaryProvider === "openrouter";
        text
          .setPlaceholder(isOpenRouter ? "輸入 OpenRouter API Key" : "輸入 Gemini API Key")
          .setValue(isOpenRouter ? this.plugin.settings.openRouterApiKey : this.plugin.settings.apiKey)
          .onChange(async (value) => {
            if (isOpenRouter) {
              this.plugin.settings.openRouterApiKey = value.trim();
            } else {
              this.plugin.settings.apiKey = value.trim();
            }
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

  private renderAiModelSettings(containerEl: HTMLElement): void {
    this.renderTranscriptionSettings(containerEl);
    this.renderSummarySettings(containerEl);
  }

  private renderOutputAndMediaSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("輸出資料夾")
      .setDesc("摘要筆記寫入 vault 的相對資料夾；空值表示寫到 vault 根目錄。")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
          this.plugin.settings.outputFolder = value.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("媒體快取資料夾")
      .setDesc("media URL 與本機媒體流程的暫存目錄。請填入絕對路徑，避免寫進 vault。")
      .addText((text) =>
        text
          .setPlaceholder("例如 D:\\AI-Summarizer\\media-cache")
          .setValue(this.plugin.settings.mediaCacheRoot)
          .onChange(async (value) => {
            this.plugin.settings.mediaCacheRoot = value.trim();
            this.runtimeDiagnostics = null;
            await this.plugin.saveSettings();
          })
      )
      .addButton((button) =>
        button.setButtonText("選擇資料夾").onClick(() => {
          void this.pickMediaStorageDirectory();
        })
      );

    new Setting(containerEl)
      .setName("產物保留模式")
      .setDesc("控制 media pipeline 完成後保留哪些暫存產物。")
      .addDropdown((dropdown) => {
        for (const mode of RETENTION_OPTIONS) {
          dropdown.addOption(mode, RETENTION_LABELS[mode]);
        }

        dropdown.setValue(this.plugin.settings.retentionMode).onChange(async (value) => {
          this.plugin.settings.retentionMode = value as RetentionMode;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("媒體壓縮策略")
      .setDesc("控制送進轉錄階段前的音訊壓縮品質。")
      .addDropdown((dropdown) => {
        for (const profile of MEDIA_COMPRESSION_OPTIONS) {
          dropdown.addOption(profile, MEDIA_COMPRESSION_LABELS[profile]);
        }

        dropdown.setValue(this.plugin.settings.mediaCompressionProfile).onChange(async (value) => {
          this.plugin.settings.mediaCompressionProfile = value as MediaCompressionProfile;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("預設輸入類型")
      .setDesc("開啟 AI 摘要器時預先選中的輸入類型。")
      .addDropdown((dropdown) => {
        for (const sourceType of SOURCE_TYPE_OPTIONS) {
          dropdown.addOption(sourceType, SOURCE_TYPE_LABELS[sourceType]);
        }

        dropdown.setValue(this.plugin.settings.lastSourceType).onChange(async (value) => {
          this.plugin.settings.lastSourceType = value as SourceType;
          await this.plugin.saveSettings();
          this.display();
        });
      });
  }

  private renderTemplateExperience(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "筆記模板" });

    const builtinTemplates = listBuiltinTemplates();

    new Setting(containerEl)
      .setName("模板來源")
      .setDesc("可使用內建模板或指定 vault 內的自訂模板。")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "預設 frontmatter");
        for (const template of builtinTemplates) {
          dropdown.addOption(template.reference, template.label);
        }
        dropdown.addOption(CUSTOM_TEMPLATE_OPTION, "自訂模板");

        dropdown.setValue(getTemplateDropdownValue(this.plugin.settings.templateReference)).onChange(async (value) => {
          if (value === CUSTOM_TEMPLATE_OPTION) {
            if (
              this.plugin.settings.templateReference.trim().length === 0 ||
              isBuiltinTemplateReference(this.plugin.settings.templateReference)
            ) {
              this.plugin.settings.templateReference = "Templates/ai-summary-template.md";
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
            .setValue(this.plugin.settings.templateReference)
            .onChange(async (value) => {
              this.plugin.settings.templateReference = value.trim();
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }

    const templateListEl = containerEl.createEl("ul");
    for (const template of builtinTemplates) {
      templateListEl.createEl("li", {
        text: `${template.label}: ${template.description}。支援 ${template.supportedSourceTypes
          .map((sourceType) => SOURCE_TYPE_LABELS[sourceType])
          .join("、")}`
      });
    }
  }

  private renderPromptAssets(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Prompt 資產" });
    containerEl.createEl("p", {
      text: "這裡列出目前程式內建的 prompt contract 與資產來源，方便追蹤設定頁、流程與測試是否對齊。"
    });

    const assetsEl = containerEl.createEl("ul");
    for (const asset of listPromptAssets()) {
      assetsEl.createEl("li", {
        text: `${asset.label}: ${asset.description} (${asset.exportedSymbol} / ${asset.sourcePath})`
      });
    }
  }

  private renderInputGuidance(containerEl: HTMLElement): void {
    const guidance = getSourceGuidance(this.plugin.settings.lastSourceType);

    containerEl.createEl("h3", { text: "輸入引導" });
    containerEl.createEl("p", {
      text: `目前預設輸入類型：${guidance.label}`
    });

    const guidanceList = containerEl.createEl("ul");
    guidanceList.createEl("li", { text: guidance.description });
    guidanceList.createEl("li", { text: `輸入格式：${guidance.inputHint}` });
    guidanceList.createEl("li", { text: `範例：${guidance.examples.join("、")}` });
    guidanceList.createEl("li", { text: `空值提示：${guidance.emptyValueHint}` });
  }

  private renderTemplateAndPromptSettings(containerEl: HTMLElement): void {
    this.renderTemplateExperience(containerEl);
    this.renderPromptAssets(containerEl);
    this.renderInputGuidance(containerEl);
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
    new Setting(containerEl)
      .setName(toolName)
      .setDesc(
        `可留空使用系統 PATH；按「自動填入」會在外掛資料夾的 tools/ffmpeg 中檢查、下載或更新 ffmpeg/ffprobe，並寫入路徑。`
      )
      .addText((text) =>
        text
          .setPlaceholder(process.platform === "win32" ? `例如 C:\\ffmpeg\\bin\\${toolName}.exe` : `例如 /usr/local/bin/${toolName}`)
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
        button
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
    this.renderMediaToolPathSetting(containerEl, "ffmpegPath", "ffmpeg");
    this.renderMediaToolPathSetting(containerEl, "ffprobePath", "ffprobe");
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
