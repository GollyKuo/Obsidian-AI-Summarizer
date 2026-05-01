import { ButtonComponent, Modal, Setting } from "obsidian";
import { SummarizerError, type ErrorCategory } from "@domain/errors";
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

  private async pickLocalFile(): Promise<void> {
    const dialog = this.getDesktopDialog();
    if (!dialog) {
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

  private async persistLastSourceType(sourceType: SourceType): Promise<void> {
    this.plugin.settings.lastSourceType = sourceType;
    await this.plugin.saveSettings();
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
          .addOption("transcript_file", "逐字稿檔案")
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
        button.setButtonText(
          this.sourceType === "local_media" || this.sourceType === "transcript_file"
            ? "選擇檔案"
            : "填入範例"
        );
        if (this.status === "running") {
          button.setDisabled(true);
          return;
        }

        button.onClick(() => {
          if (this.sourceType === "local_media" || this.sourceType === "transcript_file") {
            void this.pickLocalFile();
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
        onStageChange: (_, message) => {
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
          : this.sourceType === "transcript_file"
            ? await this.runTranscriptFileFlow(this.abortController.signal)
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
