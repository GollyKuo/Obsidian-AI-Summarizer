import { describe, expect, it } from "vitest";
import { processMedia } from "@orchestration/process-media";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import type { TranscriptionProvider } from "@services/ai/transcription-provider";

describe("processMedia integration", () => {
  it("runs media_url pipeline: runtime -> summary -> note", async () => {
    const stages: string[] = [];
    const warnings: string[] = [];
    let mediaUrlCallCount = 0;
    let localMediaCallCount = 0;

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        mediaUrlCallCount += 1;
        return {
          metadata: {
            title: "Media URL Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=demo",
            created: "2026-04-23T00:00:00.000Z"
          },
          normalizedText: "ai-ready artifact text",
          transcript: [],
          warnings: ["runtime-warning"]
        };
      },
      async processLocalMedia() {
        localMediaCallCount += 1;
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia() {
        return {
          transcript: [],
          transcriptMarkdown: "No transcript",
          warnings: ["transcription-warning"]
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        return {
          summaryMarkdown: "# Summary\n\nMedia URL summary",
          warnings: ["ai-warning"]
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        return {
          notePath: "Summaries/Media URL Demo.md",
          createdAt: "2026-04-23T00:00:00.000Z",
          warnings: ["write-warning"]
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=demo",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp",
        mediaCompressionProfile: "balanced"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal,
      {
        onStageChange: (status, message) => {
          stages.push(`${status}:${message}`);
        },
        onWarning: (warning) => {
          warnings.push(warning);
        }
      }
    );

    expect(mediaUrlCallCount).toBe(1);
    expect(localMediaCallCount).toBe(0);
    expect(result.summary.summaryMarkdown).toContain("Media URL summary");
    expect(result.writeResult.notePath).toBe("Summaries/Media URL Demo.md");
    expect(result.warnings).toContain("runtime-warning");
    expect(result.warnings).toContain("transcription-warning");
    expect(result.warnings).toContain("ai-warning");
    expect(result.warnings).toContain("write-warning");
    expect(
      result.warnings.some((warning) => warning.includes("AI output contract: normalized summary heading"))
    ).toBe(true);
    expect(warnings).toEqual(result.warnings);
    expect(stages).toEqual([
      "validating:Validating media input",
      "acquiring:Processing media URL input",
      "transcribing:Generating media transcript",
      "summarizing:Generating media summary",
      "writing:Writing media note into vault"
    ]);
  });

  it("runs local_media pipeline: runtime -> summary -> note", async () => {
    let mediaUrlCallCount = 0;
    let localMediaCallCount = 0;

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        mediaUrlCallCount += 1;
        throw new Error("should not execute");
      },
      async processLocalMedia() {
        localMediaCallCount += 1;
        return {
          metadata: {
            title: "Local Demo",
            creatorOrAuthor: "Local User",
            platform: "Local File",
            source: "D:\\source\\demo.mp3",
            created: "2026-04-23T00:00:00.000Z"
          },
          normalizedText: "local ai-ready artifact text",
          transcript: [],
          warnings: []
        };
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia() {
        return {
          transcript: [],
          transcriptMarkdown: "No transcript",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        return {
          summaryMarkdown: "# Summary\n\nLocal summary",
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        return {
          notePath: "Summaries/Local Demo.md",
          createdAt: "2026-04-23T00:00:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "local_media",
        sourceValue: "D:\\source\\demo.mp3",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp",
        mediaCompressionProfile: "balanced"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal
    );

    expect(mediaUrlCallCount).toBe(0);
    expect(localMediaCallCount).toBe(1);
    expect(result.writeResult.notePath).toBe("Summaries/Local Demo.md");
    expect(
      result.warnings.some((warning) => warning.includes("AI output contract: normalized summary heading"))
    ).toBe(true);
  });

  it("applies chunking strategy when transcript is large", async () => {
    let summarizeMediaCalls = 0;
    let capturedSummaryMarkdown = "";

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Chunk Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=chunk",
            created: "2026-04-23T00:00:00.000Z"
          },
          normalizedText: "normalized-context",
          transcript: [
            { startMs: 0, endMs: 1000, text: "1234567890".repeat(700) },
            { startMs: 1000, endMs: 2000, text: "abcdefghij".repeat(700) }
          ],
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia(input) {
        return {
          transcript: input.transcript,
          transcriptMarkdown: "Chunk transcript content",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        summarizeMediaCalls += 1;
        return {
          summaryMarkdown: `Chunk summary ${summarizeMediaCalls}`,
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote(input) {
        capturedSummaryMarkdown = input.summaryMarkdown;
        return {
          notePath: "Summaries/Chunk Demo.md",
          createdAt: "2026-04-23T00:00:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=chunk",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal
    );

    expect(summarizeMediaCalls).toBeGreaterThan(1);
    expect(capturedSummaryMarkdown).toContain("## Chunk 1");
    expect(result.warnings.some((warning) => warning.includes("Chunked media summary into"))).toBe(true);
  });

  it("throws validation_error when media source value is empty", async () => {
    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        throw new Error("should not execute");
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    await expect(
      processMedia(
        {
          sourceKind: "media_url",
          sourceValue: "   ",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp"
        },
        {
          runtimeProvider,
          transcriptionProvider: {
            async transcribeMedia() {
              throw new Error("should not execute");
            }
          },
          summaryProvider: {
            async summarizeMedia() {
              throw new Error("should not execute");
            },
            async summarizeWebpage() {
              throw new Error("should not execute");
            }
          },
          noteWriter: {
            async writeMediaNote() {
              throw new Error("should not execute");
            },
            async writeWebpageNote() {
              throw new Error("should not execute");
            }
          }
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "validation_error"
    });
  });
});
