import { describe, expect, it } from "vitest";
import { buildMediaSummaryPrompt, buildTranscriptCleanupPrompt } from "@services/ai/prompt-builder";

const metadata = {
  title: "Transcript",
  creatorOrAuthor: "Unknown",
  platform: "Transcript File",
  source: "D:\\transcript.md",
  created: "2026-05-05T00:00:00.000Z"
};

describe("prompt-builder", () => {
  it("labels generic text file input as source text in summary prompts", () => {
    const prompt = buildMediaSummaryPrompt({
      metadata: {
        title: "Blocked Article",
        creatorOrAuthor: "Unknown",
        platform: "Text File",
        source: "D:\\article.txt",
        created: "2026-05-06T00:00:00.000Z"
      },
      normalizedText: "Text file: D:\\article.txt",
      transcript: [{ startMs: 0, endMs: 1000, text: "Copied article body." }],
      summaryProvider: "gemini",
      summaryModel: "gemini-2.5-flash"
    });

    expect(prompt).toContain("## Source Text\nCopied article body.");
    expect(prompt).not.toContain("## Transcript\nCopied article body.");
  });

  it("warns cleanup prompts when transcript timing is synthetic", () => {
    const prompt = buildTranscriptCleanupPrompt({
      metadata,
      transcriptMarkdown: "Plain transcript line.",
      transcript: [
        {
          startMs: 0,
          endMs: 1000,
          text: "Plain transcript line.",
          timingSource: "synthetic"
        }
      ],
      cleanupProvider: "gemini",
      cleanupModel: "gemini-2.5-flash"
    });

    expect(prompt).toContain("沒有可信的原始時間碼");
    expect(prompt).toContain("不要新增或宣稱精確時間碼");
  });

  it("preserves explicit timing guidance when transcript has real markers", () => {
    const prompt = buildTranscriptCleanupPrompt({
      metadata,
      transcriptMarkdown: "{00:00:01} Explicit line.",
      transcript: [
        {
          startMs: 1000,
          endMs: 2000,
          text: "{00:00:01} Explicit line.",
          timingSource: "explicit"
        }
      ],
      cleanupProvider: "gemini",
      cleanupModel: "gemini-2.5-flash"
    });

    expect(prompt).toContain("請保留原有 marker 與順序");
  });
});
