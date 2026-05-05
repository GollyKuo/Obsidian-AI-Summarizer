import { describe, expect, it } from "vitest";
import type { MediaSummaryInput } from "@domain/types";
import { processMedia } from "@orchestration/process-media";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import type { TranscriptionProvider } from "@services/ai/transcription-provider";

describe("long media global summary regression gate", () => {
  it("uses internal partial notes only as synthesis material and writes a clean final summary", async () => {
    const finalSynthesisInputs: MediaSummaryInput[] = [];
    let summarizeMediaCalls = 0;
    let writtenSummaryMarkdown = "";

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Long Media Gate",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://example.com/watch?v=long-media",
            created: "2026-05-02T03:10:00.000Z"
          },
          normalizedText: "long-media-normalized-context",
          transcript: [
            { startMs: 0, endMs: 1000, text: "alpha ".repeat(1300) },
            { startMs: 1000, endMs: 2000, text: "bravo ".repeat(1300) },
            { startMs: 2000, endMs: 3000, text: "charlie ".repeat(1300) }
          ],
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("not used");
      },
      async processWebpage() {
        throw new Error("not used");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia(input) {
        return {
          transcript: input.transcript,
          transcriptMarkdown: "{0m0s - 0m3s} long transcript",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia(input) {
        summarizeMediaCalls += 1;
        if (input.transcript.length === 0) {
          finalSynthesisInputs.push(input);
          return {
            summaryMarkdown: "## Final Summary\nClean synthesized result with no processing labels.",
            warnings: []
          };
        }

        return {
          summaryMarkdown: [
            `## Chunk ${summarizeMediaCalls}`,
            `Partial insight ${summarizeMediaCalls}`,
            `Part ${summarizeMediaCalls}: Timelined detail ${summarizeMediaCalls}`,
            `分段 ${summarizeMediaCalls}：內容細節 ${summarizeMediaCalls}`
          ].join("\n"),
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("not used");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote(input) {
        writtenSummaryMarkdown = input.summaryMarkdown;
        return {
          notePath: "Summaries/Long Media Gate.md",
          createdAt: "2026-05-02T03:10:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("not used");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "media_url",
        sourceValue: "https://example.com/watch?v=long-media",
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
    expect(finalSynthesisInputs).toHaveLength(1);
    expect(finalSynthesisInputs[0].transcript).toEqual([]);
    expect(finalSynthesisInputs[0].normalizedText).toContain("Partial insight 1");
    expect(finalSynthesisInputs[0].normalizedText).toContain("Timelined detail 1");
    expect(finalSynthesisInputs[0].normalizedText).toContain("內容細節 1");
    expect(finalSynthesisInputs[0].normalizedText).not.toMatch(/^\s*#{1,6}\s*Chunk\s+\d+/imu);
    expect(finalSynthesisInputs[0].normalizedText).not.toMatch(/^\s*Part\s+\d+\s*:/imu);
    expect(finalSynthesisInputs[0].normalizedText).not.toMatch(/^\s*分段\s+\d+\s*：/imu);

    expect(writtenSummaryMarkdown).toContain("Clean synthesized result");
    expect(writtenSummaryMarkdown).not.toMatch(/\bChunk\s+\d+\b/iu);
    expect(writtenSummaryMarkdown).not.toMatch(/\bPart\s+\d+\b/iu);
    expect(writtenSummaryMarkdown).not.toContain("分段");
    expect(result.warnings.some((warning) => warning.includes("Final synthesis generated"))).toBe(true);
  });
});
