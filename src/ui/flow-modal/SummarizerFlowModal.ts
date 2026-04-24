import { ButtonComponent, Modal, Setting } from "obsidian";
import { SummarizerError, type ErrorCategory } from "@domain/errors";
import type { LocalMediaRequest, MediaProcessResult, MediaUrlRequest, SourceMetadata, SourceType, WebpageRequest } from "@domain/types";
import { throwIfCancelled } from "@orchestration/cancellation";
import { processMedia } from "@orchestration/process-media";
import { processWebpage } from "@orchestration/process-webpage";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import type { AiProvider } from "@services/ai/ai-provider";
import { BasicMetadataExtractor } from "@services/web/metadata-extractor";
import type { WebpageExtractor } from "@services/web/webpage-extractor";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { describeTemplateReference } from "@services/obsidian/template-library";
import { getSourceErrorHint, getSourceGuidance } from "@ui/source-guidance";

type UiStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

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

function isLikelyAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/");
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(
        new SummarizerError({
          category: "cancellation",
          message: "使用者已取消摘要流程。",
          recoverable: true
        })
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function createMetadata(sourceType: SourceType, sourceValue: string): SourceMetadata {
  if (sourceType === "webpage_url") {
    return {
      title: "Webpage Capture",
      creatorOrAuthor: "Unknown",
      platform: "Web",
      source: sourceValue,
      created: new Date().toISOString()
    };
  }

  return {
    title: sourceType === "media_url" ? "Media Capture" : "Local Media Capture",
    creatorOrAuthor: "Unknown",
    platform: sourceType === "media_url" ? "Media URL" : "Local Media",
    source: sourceValue,
    created: new Date().toISOString()
  };
}

export class SummarizerFlowModal extends Modal {
  private readonly plugin: AISummarizerPlugin;
  private sourceType: SourceType;
  private sourceValue = "";
  private status: UiStatus = "idle";
  private stageMessage = "等待開始";
  private resultMessage = "";
  private warningMessages: string[] = [];
  private abortController: AbortController | null = null;

  public constructor(plugin: AISummarizerPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.sourceType = plugin.settings.lastSourceType;
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

  private async pickLocalMediaFile(): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
      this.resultMessage = "目前環境不支援檔案選擇器，請手動輸入本機檔案絕對路徑。";
      this.render();
      return;
    }

    const result = await dialog.showOpenDialog({
      title: "選擇本機媒體檔案",
      properties: ["openFile"],
      filters: [
        {
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

  private async persistLastSourceType(sourceType: SourceType): Promise<void> {
    this.plugin.settings.lastSourceType = sourceType;
    await this.plugin.saveSettings();
  }

  private buildRuntimeProvider(): RuntimeProvider {
    return {
      strategy: "local_bridge",
      processWebpage: async () => {
        throw new Error("Media flow runtime should not execute webpage input.");
      },
      processMediaUrl: async (input: MediaUrlRequest, signal: AbortSignal): Promise<MediaProcessResult> => {
        throwIfCancelled(signal);
        await delay(350, signal);

        if (!/^https?:\/\//.test(input.sourceValue)) {
          throw new SummarizerError({
            category: "validation_error",
            message: `Invalid media URL: ${input.sourceValue}`,
            recoverable: true
          });
        }

        if (input.sourceValue.includes("download-fail")) {
          throw new SummarizerError({
            category: "download_failure",
            message: "Media download failed during mock flow.",
            recoverable: true
          });
        }

        return {
          metadata: createMetadata("media_url", input.sourceValue),
          normalizedText: "Normalized media content prepared for AI handoff.",
          transcript: [
            { startMs: 0, endMs: 18000, text: "Mock transcript segment one." },
            { startMs: 18000, endMs: 36000, text: "Mock transcript segment two." }
          ],
          warnings: ["Mock runtime: media URL flow uses simulated acquisition."]
        };
      },
      processLocalMedia: async (input: LocalMediaRequest, signal: AbortSignal): Promise<MediaProcessResult> => {
        throwIfCancelled(signal);
        await delay(350, signal);

        if (!isLikelyAbsolutePath(input.sourceValue)) {
          throw new SummarizerError({
            category: "validation_error",
            message: `Invalid local media path: ${input.sourceValue}`,
            recoverable: true
          });
        }

        return {
          metadata: createMetadata("local_media", input.sourceValue),
          normalizedText: "Normalized local media content prepared for AI handoff.",
          transcript: [
            { startMs: 0, endMs: 15000, text: "Mock local media transcript segment one." },
            { startMs: 15000, endMs: 29000, text: "Mock local media transcript segment two." }
          ],
          warnings: ["Mock runtime: local media flow uses simulated ingestion."]
        };
      }
    };
  }

  private buildAiProvider(): AiProvider {
    return {
      summarizeWebpage: async (input, signal) => {
        throwIfCancelled(signal);
        await delay(350, signal);
        return {
          summaryMarkdown: `# ${input.metadata.title}\n\n${input.webpageText.slice(0, 180)}`,
          warnings: []
        };
      },
      summarizeMedia: async (input, signal) => {
        throwIfCancelled(signal);
        await delay(350, signal);
        return {
          summaryMarkdown: `# ${input.metadata.title}\n\n## Summary\n\n${input.normalizedText}`,
          transcriptMarkdown: input.transcript
            .map((segment) => `- ${segment.startMs}-${segment.endMs}: ${segment.text}`)
            .join("\n"),
          warnings: []
        };
      }
    };
  }

  private buildNoteWriter(): NoteWriter {
    return {
      writeWebpageNote: async (input) => ({
        notePath: `Mock/Webpage/${input.metadata.title}.md`,
        createdAt: new Date().toISOString(),
        warnings: []
      }),
      writeMediaNote: async (input) => ({
        notePath: `Mock/Media/${input.metadata.title}.md`,
        createdAt: new Date().toISOString(),
        warnings: []
      })
    };
  }

  private render(): void {
    const { contentEl } = this;
    const guidance = getSourceGuidance(this.sourceType);

    contentEl.empty();

    new Setting(contentEl)
      .setName("輸入類型")
      .setDesc("三種輸入都走同一個 AI 摘要入口，但背後會接不同的 acquisition / extraction pipeline。")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("webpage_url", "網頁 URL")
          .addOption("media_url", "媒體 URL")
          .addOption("local_media", "本機媒體")
          .setValue(this.sourceType)
          .onChange((value) => {
            const nextSourceType = value as SourceType;
            this.sourceType = nextSourceType;
            this.sourceValue = "";
            this.resultMessage = "";
            this.warningMessages = [];
            void this.persistLastSourceType(nextSourceType);
            this.render();
          });
      });

    new Setting(contentEl)
      .setName(guidance.label)
      .setDesc(guidance.description)
      .addText((text) => {
        text.setPlaceholder(guidance.placeholder).setValue(this.sourceValue);
        text.onChange((value) => {
          this.sourceValue = value.trim();
        });
      })
      .addButton((button) => {
        button.setButtonText(this.sourceType === "local_media" ? "選擇檔案" : "填入範例");
        if (this.status === "running") {
          button.setDisabled(true);
          return;
        }

        button.onClick(() => {
          if (this.sourceType === "local_media") {
            void this.pickLocalMediaFile();
            return;
          }

          this.sourceValue = guidance.placeholder;
          this.render();
        });
      });

    contentEl.createEl("p", {
      text: `輸入提示：${guidance.inputHint}`
    });
    contentEl.createEl("p", {
      text: `常見來源：${guidance.examples.join("、")}`
    });
    contentEl.createEl("p", {
      text: `目前 note 模板：${describeTemplateReference(this.plugin.settings.templateReference)}`
    });

    const stageEl = contentEl.createDiv({ cls: "ai-summarizer-stage" });
    stageEl.setText(`狀態：${this.status} | 階段：${this.stageMessage}`);

    if (this.warningMessages.length > 0) {
      const warningEl = contentEl.createDiv({ cls: "ai-summarizer-warning" });
      warningEl.setText(`Warnings: ${this.warningMessages.join(" | ")}`);
    }

    const resultEl = contentEl.createDiv({ cls: "ai-summarizer-result" });
    resultEl.setText(this.resultMessage);

    const actionsEl = contentEl.createDiv({ cls: "ai-summarizer-actions" });
    const startButton = new ButtonComponent(actionsEl);
    startButton.setButtonText("開始摘要").setCta();

    const cancelButton = new ButtonComponent(actionsEl);
    cancelButton.setButtonText("取消");

    if (this.status === "running") {
      startButton.setDisabled(true);
      cancelButton.setDisabled(false);
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
    this.stageMessage = "使用者取消中";
    this.render();
  }

  private async runWebpageFlow(signal: AbortSignal): Promise<{ notePath: string }> {
    const webpageExtractor: WebpageExtractor = {
      extractReadableText: async (url, innerSignal) => {
        throwIfCancelled(innerSignal);
        await delay(350, innerSignal);
        if (url.includes("extract-fail")) {
          throw new SummarizerError({
            category: "runtime_unavailable",
            message: "Webpage extraction failed during mock flow.",
            recoverable: true
          });
        }
        return `Mock extracted webpage content from ${url}`;
      }
    };

    const result = await processWebpage(
      {
        sourceKind: "webpage_url",
        sourceValue: this.sourceValue,
        model: this.plugin.settings.model
      },
      {
        webpageExtractor,
        metadataExtractor: new BasicMetadataExtractor(),
        aiProvider: this.buildAiProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (_, message) => {
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

  private async runMediaFlow(signal: AbortSignal): Promise<{ notePath: string }> {
    const result = await processMedia(
      {
        sourceKind: this.sourceType,
        sourceValue: this.sourceValue,
        model: this.plugin.settings.model,
        retentionMode: this.plugin.settings.retentionMode,
        mediaCacheRoot: this.plugin.settings.mediaCacheRoot,
        mediaCompressionProfile: this.plugin.settings.mediaCompressionProfile
      } as MediaUrlRequest | LocalMediaRequest,
      {
        runtimeProvider: this.buildRuntimeProvider(),
        aiProvider: this.buildAiProvider(),
        noteWriter: this.buildNoteWriter()
      },
      signal,
      {
        onStageChange: (_, message) => {
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

  private buildErrorResultMessage(category: ErrorCategory | "unknown", modalMessage: string): string {
    const hint = getSourceErrorHint(this.sourceType, category);
    if (!hint) {
      return modalMessage;
    }

    return `${modalMessage}\n\n建議：${hint}`;
  }

  private async startFlow(): Promise<void> {
    if (this.status === "running") {
      return;
    }

    if (this.sourceValue.trim().length === 0) {
      this.status = "failed";
      this.stageMessage = "等待輸入";
      this.resultMessage = getSourceGuidance(this.sourceType).emptyValueHint;
      this.render();
      return;
    }

    this.abortController = new AbortController();
    this.status = "running";
    this.stageMessage = "準備執行";
    this.resultMessage = "";
    this.warningMessages = [];
    this.render();

    try {
      const result =
        this.sourceType === "webpage_url"
          ? await this.runWebpageFlow(this.abortController.signal)
          : await this.runMediaFlow(this.abortController.signal);

      this.status = "completed";
      this.stageMessage = "已完成";
      this.resultMessage = `已建立摘要筆記：${result.notePath}`;
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

      this.resultMessage = this.buildErrorResultMessage(report.category, report.modalMessage);
    } finally {
      this.abortController = null;
      this.render();
    }
  }
}
