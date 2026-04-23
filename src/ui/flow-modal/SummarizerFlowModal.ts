import { ButtonComponent, Modal, Setting } from "obsidian";
import { SummarizerError } from "@domain/errors";
import { processWebpage } from "@orchestration/process-webpage";
import { throwIfCancelled } from "@orchestration/cancellation";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
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
          message: "流程已取消。",
          recoverable: true
        })
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class SummarizerFlowModal extends Modal {
  private readonly plugin: AISummarizerPlugin;
  private sourceValue = "";
  private status: UiStatus = "idle";
  private stageMessage = "等待輸入";
  private resultMessage = "";
  private abortController: AbortController | null = null;

  public constructor(plugin: AISummarizerPlugin) {
    super(plugin.app);
    this.plugin = plugin;
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

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("網頁 URL")
      .setDesc("輸入網址以執行目前的網頁摘要流程。")
      .addText((text) => {
        text.setPlaceholder("https://example.com/article").setValue(this.sourceValue);
        text.onChange((value) => {
          this.sourceValue = value.trim();
        });
      });

    const stageEl = contentEl.createDiv({ cls: "ai-summarizer-stage" });
    stageEl.setText(`狀態：${this.status} | 階段：${this.stageMessage}`);

    const resultEl = contentEl.createDiv({ cls: "ai-summarizer-result" });
    resultEl.setText(this.resultMessage);

    const actionsEl = contentEl.createDiv({ cls: "ai-summarizer-actions" });
    const startButton = new ButtonComponent(actionsEl);
    startButton.setButtonText("開始").setCta();

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
    this.stageMessage = "取消中";
    this.render();
  }

  private async startFlow(): Promise<void> {
    if (this.status === "running") {
      return;
    }
    this.abortController = new AbortController();
    this.status = "running";
    this.stageMessage = "啟動中";
    this.resultMessage = "";
    this.render();

    const webpageExtractor: WebpageExtractor = {
      extractReadableText: async (url, signal) => {
        throwIfCancelled(signal);
        await delay(500, signal);
        if (url.includes("fail")) {
          throw new SummarizerError({
            category: "runtime_unavailable",
            message: "模擬擷取失敗（URL 包含 'fail'）。",
            recoverable: true
          });
        }
        return `Mock extracted webpage content from ${url}`;
      }
    };

    const aiProvider: AiProvider = {
      summarizeMedia: async () => {
        throw new Error("網頁流程不會使用媒體摘要。");
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
        throw new Error("網頁流程不會使用媒體筆記寫入。");
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
      this.stageMessage = "已完成";
      this.resultMessage = `成功：${result.writeResult.notePath}`;
      this.plugin.notify("網頁摘要流程已完成。");
    } catch (error) {
      if (error instanceof SummarizerError && error.category === "cancellation") {
        this.status = "cancelled";
        this.stageMessage = "已取消";
        this.resultMessage = "操作已取消。";
      } else {
        const message = error instanceof Error ? error.message : "未知錯誤";
        this.status = "failed";
        this.stageMessage = "失敗";
        this.resultMessage = `失敗：${message}`;
        this.plugin.log("error", message);
      }
    } finally {
      this.abortController = null;
      this.render();
    }
  }
}
