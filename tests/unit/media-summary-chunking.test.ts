import { describe, expect, it } from "vitest";
import type { AiProvider } from "@services/ai/ai-provider";
import { summarizeMediaWithChunking } from "@services/ai/media-summary-chunking";

describe("summarizeMediaWithChunking", () => {
  it("calls ai provider once when transcript fits one chunk", async () => {
    let callCount = 0;

    const aiProvider: AiProvider = {
      async summarizeMedia(input) {
        callCount += 1;
        return {
          summaryMarkdown: `Summary: ${input.transcript.length}`,
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("not used");
      }
    };

    const result = await summarizeMediaWithChunking(
      {
        metadata: {
          title: "Demo",
          creatorOrAuthor: "Author",
          platform: "Local File",
          source: "D:\\source\\demo.mp3",
          created: "2026-04-23T00:00:00.000Z"
        },
        normalizedText: "short normalized text",
        transcript: [
          {
            startMs: 0,
            endMs: 1000,
            text: "small transcript"
          }
        ],
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      aiProvider,
      new AbortController().signal,
      {
        maxChunkCharacters: 200
      }
    );

    expect(callCount).toBe(1);
    expect(result.summaryMarkdown).toContain("Summary:");
    expect(result.warnings).toEqual([]);
  });

  it("chunks transcript and merges summaries when transcript exceeds chunk limit", async () => {
    const normalizedTextInputs: string[] = [];
    const transcriptLengths: number[] = [];
    const finalSynthesisInputs: string[] = [];

    const aiProvider: AiProvider = {
      async summarizeMedia(input) {
        normalizedTextInputs.push(input.normalizedText);
        transcriptLengths.push(input.transcript.map((segment) => segment.text.length).reduce((a, b) => a + b, 0));

        if (input.transcript.length === 0) {
          finalSynthesisInputs.push(input.normalizedText);
          return {
            summaryMarkdown: "Final synthesized summary",
            warnings: ["final-warning"]
          };
        }

        return {
          summaryMarkdown: `Internal note ${transcriptLengths.length}`,
          warnings: [`partial-warning-${transcriptLengths.length}`]
        };
      },
      async summarizeWebpage() {
        throw new Error("not used");
      }
    };

    const result = await summarizeMediaWithChunking(
      {
        metadata: {
          title: "Demo",
          creatorOrAuthor: "Author",
          platform: "YouTube",
          source: "https://example.com/demo",
          created: "2026-04-23T00:00:00.000Z"
        },
        normalizedText: "abcdefghijklmnopqrstuvwxyz",
        transcript: [
          { startMs: 0, endMs: 1000, text: "1234567890" },
          { startMs: 1000, endMs: 2000, text: "abcdefghij" },
          { startMs: 2000, endMs: 3000, text: "klmnopqrst" }
        ],
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      aiProvider,
      new AbortController().signal,
      {
        maxChunkCharacters: 10,
        maxNormalizedTextCharactersPerChunk: 8
      }
    );

    expect(transcriptLengths).toEqual([10, 10, 10, 0]);
    expect(normalizedTextInputs.slice(0, 3)).toEqual(["abcdefgh", "", ""]);
    expect(finalSynthesisInputs).toHaveLength(1);
    expect(finalSynthesisInputs[0]).toContain("Internal note 1");
    expect(finalSynthesisInputs[0]).toContain("Internal note 3");
    expect(finalSynthesisInputs[0]).not.toContain("Chunk");
    expect(result.summaryMarkdown).toBe("Final synthesized summary");
    expect(result.summaryMarkdown).not.toContain("## Chunk");
    expect(result.warnings[0]).toContain("Chunked media summary into 3 chunks");
    expect(result.warnings[1]).toContain("Final synthesis generated from 3 internal partial summaries");
    expect(result.warnings).toContain("partial-warning-1");
    expect(result.warnings).toContain("partial-warning-2");
    expect(result.warnings).toContain("partial-warning-3");
    expect(result.warnings).toContain("final-warning");
    expect(
      result.warnings.some((warning) => warning.includes("Token control applied: truncated normalized text in chunk mode"))
    ).toBe(true);
  });

  it("applies normalized text token control in single-call mode", async () => {
    const seenNormalizedText: string[] = [];

    const aiProvider: AiProvider = {
      async summarizeMedia(input) {
        seenNormalizedText.push(input.normalizedText);
        return {
          summaryMarkdown: "ok",
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("not used");
      }
    };

    const result = await summarizeMediaWithChunking(
      {
        metadata: {
          title: "Demo",
          creatorOrAuthor: "Author",
          platform: "Web",
          source: "https://example.com",
          created: "2026-04-23T00:00:00.000Z"
        },
        normalizedText: "1234567890",
        transcript: [],
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      aiProvider,
      new AbortController().signal,
      {
        maxNormalizedTextCharacters: 4
      }
    );

    expect(seenNormalizedText).toEqual(["1234"]);
    expect(
      result.warnings.some((warning) => warning.includes("Token control applied: truncated normalized text"))
    ).toBe(true);
  });
});
