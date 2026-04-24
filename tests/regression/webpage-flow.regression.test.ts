import { describe, expect, it } from "vitest";
import { processWebpage } from "@orchestration/process-webpage";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import type { MetadataExtractor } from "@services/web/metadata-extractor";
import type { WebpageExtractor } from "@services/web/webpage-extractor";

describe("webpage flow regression gate", () => {
  it("preserves webpage happy path invariants", async () => {
    let summarizeMediaCalls = 0;
    let writeMediaCalls = 0;
    let capturedPlatform = "";
    let capturedSource = "";
    let capturedSummaryMarkdown = "";

    const webpageExtractor: WebpageExtractor = {
      async extractReadableText() {
        return "Mock webpage content";
      }
    };

    const metadataExtractor: MetadataExtractor = {
      fromWebpage() {
        return {
          title: " Mock Title ",
          creatorOrAuthor: " Mock Author ",
          platform: "Medium",
          source: "https://wrong.example.com/article",
          created: "invalid-date"
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        summarizeMediaCalls += 1;
        throw new Error("webpage regression should never call summarizeMedia");
      },
      async summarizeWebpage() {
        return {
          summaryMarkdown: "# Summary\n\nRegression-safe summary.",
          warnings: ["paywall-suspected"]
        };
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        writeMediaCalls += 1;
        throw new Error("webpage regression should never call writeMediaNote");
      },
      async writeWebpageNote(input) {
        capturedPlatform = input.metadata.platform;
        capturedSource = input.metadata.source;
        capturedSummaryMarkdown = input.summaryMarkdown;
        return {
          notePath: "Summaries/Mock Title.md",
          createdAt: "2026-04-24T00:00:00.000Z",
          warnings: []
        };
      }
    };

    const result = await processWebpage(
      {
        sourceKind: "webpage_url",
        sourceValue: "https://example.com/article",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      {
        webpageExtractor,
        metadataExtractor,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal
    );

    expect(summarizeMediaCalls).toBe(0);
    expect(writeMediaCalls).toBe(0);
    expect(capturedPlatform).toBe("Web");
    expect(capturedSource).toBe("https://example.com/article");
    expect(capturedSummaryMarkdown.startsWith("## Summary")).toBe(true);
    expect(result.writeResult.notePath).toBe("Summaries/Mock Title.md");
    expect(result.warnings).toContain("paywall-suspected");
    expect(
      result.warnings.some((warning) => warning.includes("Webpage metadata policy: platform has been normalized to Web"))
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("Webpage metadata policy: created timestamp was invalid and has been regenerated")
      )
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("AI output contract: normalized summary heading to start from H2")
      )
    ).toBe(true);
  });

  it("rejects invalid URL before touching extraction or AI layers", async () => {
    let extractCalls = 0;
    let summarizeCalls = 0;

    await expect(
      processWebpage(
        {
          sourceKind: "webpage_url",
          sourceValue: "not-a-url",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash"
        },
        {
          webpageExtractor: {
            async extractReadableText() {
              extractCalls += 1;
              return "";
            }
          },
          metadataExtractor: {
            fromWebpage() {
              return {
                title: "",
                creatorOrAuthor: "",
                platform: "",
                source: "",
                created: ""
              };
            }
          },
          summaryProvider: {
            async summarizeMedia() {
              throw new Error("not used");
            },
            async summarizeWebpage() {
              summarizeCalls += 1;
              return { summaryMarkdown: "", warnings: [] };
            }
          },
          noteWriter: {
            async writeMediaNote() {
              throw new Error("not used");
            },
            async writeWebpageNote() {
              return { notePath: "", createdAt: "", warnings: [] };
            }
          }
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "validation_error"
    });

    expect(extractCalls).toBe(0);
    expect(summarizeCalls).toBe(0);
  });
});
