import { ButtonComponent, Modal, Setting } from "obsidian";
import { SummarizerError } from "@domain/errors";
import { processWebpage } from "@orchestration/process-webpage";
import { throwIfCancelled } from "@orchestration/cancellation";
import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";
import type { AiProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { BasicMetadataExtractor } from "@services/web/metadata-extractor";
import type { WebpageExtractor } from "@services/web/webpage-extractor";

type UiStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

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
          message: "Flow cancelled.",
          recoverable: true
        })
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class SummarizerFlowModal extends Modal {
  private readonly plugin: MediaSummarizerPlugin;
  private sourceValue = "";
  private status: UiStatus = "idle";
  private stageMessage = "Waiting for input";
  private resultMessage = "";
  private abortController: AbortController | null = null;

  public constructor(plugin: MediaSummarizerPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.setTitle("AI Summarizer");
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

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Webpage URL")
      .setDesc("Enter a URL to run the mocked webpage flow.")
      .addText((text) => {
        text.setPlaceholder("https://example.com/article").setValue(this.sourceValue);
        text.onChange((value) => {
          this.sourceValue = value.trim();
        });
      });

    const stageEl = contentEl.createDiv({ cls: "ai-summarizer-stage" });
    stageEl.setText(`Status: ${this.status} | Stage: ${this.stageMessage}`);

    const resultEl = contentEl.createDiv({ cls: "ai-summarizer-result" });
    resultEl.setText(this.resultMessage);

    const actionsEl = contentEl.createDiv({ cls: "ai-summarizer-actions" });
    const startButton = new ButtonComponent(actionsEl);
    startButton.setButtonText("Start").setCta();

    const cancelButton = new ButtonComponent(actionsEl);
    cancelButton.setButtonText("Cancel");

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
    this.stageMessage = "Cancelling";
    this.render();
  }

  private async startFlow(): Promise<void> {
    if (this.status === "running") {
      return;
    }
    this.abortController = new AbortController();
    this.status = "running";
    this.stageMessage = "Starting";
    this.resultMessage = "";
    this.render();

    const webpageExtractor: WebpageExtractor = {
      extractReadableText: async (url, signal) => {
        throwIfCancelled(signal);
        await delay(500, signal);
        if (url.includes("fail")) {
          throw new SummarizerError({
            category: "runtime_unavailable",
            message: "Mock extractor failure (URL includes 'fail').",
            recoverable: true
          });
        }
        return `Mock extracted webpage content from ${url}`;
      }
    };

    const aiProvider: AiProvider = {
      summarizeMedia: async () => {
        throw new Error("Not used for webpage flow.");
      },
      summarizeWebpage: async (input, signal) => {
        throwIfCancelled(signal);
        await delay(500, signal);
        return {
          summaryMarkdown: `# ${input.metadata.title}\n\n${input.webpageText.slice(0, 180)}`,
          warnings: []
        };
      }
    };

    const noteWriter: NoteWriter = {
      writeMediaNote: async () => {
        throw new Error("Not used for webpage flow.");
      },
      writeWebpageNote: async (input) => ({
        notePath: `Mock/${input.metadata.title}.md`,
        createdAt: new Date().toISOString(),
        warnings: []
      })
    };

    try {
      const result = await processWebpage(
        {
          sourceKind: "webpage_url",
          sourceValue: this.sourceValue,
          model: this.plugin.settings.model
        },
        {
          webpageExtractor,
          metadataExtractor: new BasicMetadataExtractor(),
          aiProvider,
          noteWriter
        },
        this.abortController.signal,
        {
          onStageChange: (_, message) => {
            this.stageMessage = message;
            this.render();
          },
          onWarning: (warning) => {
            this.plugin.log("warn", warning);
          }
        }
      );

      this.status = "completed";
      this.stageMessage = "Completed";
      this.resultMessage = `Success: ${result.writeResult.notePath}`;
      this.plugin.notify("Webpage flow completed.");
    } catch (error) {
      if (error instanceof SummarizerError && error.category === "cancellation") {
        this.status = "cancelled";
        this.stageMessage = "Cancelled";
        this.resultMessage = "Operation cancelled.";
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        this.status = "failed";
        this.stageMessage = "Failed";
        this.resultMessage = `Failed: ${message}`;
        this.plugin.log("error", message);
      }
    } finally {
      this.abortController = null;
      this.render();
    }
  }
}
