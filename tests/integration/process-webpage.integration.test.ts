import { describe, expect, it } from "vitest";
import { processWebpage } from "@orchestration/process-webpage";
import type { AiProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import type { MetadataExtractor } from "@services/web/metadata-extractor";
import type { WebpageExtractor } from "@services/web/webpage-extractor";

describe("processWebpage integration", () => {
  it("runs webpage -> summary -> note pipeline with mocked dependencies", async () => {
    const webpageExtractor: WebpageExtractor = {
      async extractReadableText() {
        return "Mock webpage content";
      }
    };

    const metadataExtractor: MetadataExtractor = {
      fromWebpage(url) {
        return {
          title: "Mock Title",
          creatorOrAuthor: "Mock Author",
          platform: "Web",
          source: url,
          created: "2026-04-21T00:00:00.000Z"
        };
      }
    };

    const aiProvider: AiProvider = {
      async summarizeMedia() {
        throw new Error("Not used in webpage flow test");
      },
      async summarizeWebpage() {
        return {
          summaryMarkdown: "# Summary\n\nMock summary.",
          warnings: ["paywall-suspected"]
        };
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        throw new Error("Not used in webpage flow test");
      },
      async writeWebpageNote() {
        return {
          notePath: "Summaries/Mock Title.md",
          createdAt: "2026-04-21T00:00:00.000Z",
          warnings: []
        };
      }
    };

    const abortController = new AbortController();
    const result = await processWebpage(
      {
        sourceKind: "webpage_url",
        sourceValue: "https://example.com/article",
        model: "gemini-2.5-flash"
      },
      {
        webpageExtractor,
        metadataExtractor,
        aiProvider,
        noteWriter
      },
      abortController.signal
    );

    expect(result.summary.summaryMarkdown).toContain("Mock summary");
    expect(result.summary.summaryMarkdown.startsWith("## Summary")).toBe(true);
    expect(result.writeResult.notePath).toBe("Summaries/Mock Title.md");
    expect(result.warnings).toContain("paywall-suspected");
  });

  it("throws validation_error for invalid URL", async () => {
    const abortController = new AbortController();

    await expect(
      processWebpage(
        {
          sourceKind: "webpage_url",
          sourceValue: "not-a-url",
          model: "gemini-2.5-flash"
        },
        {
          webpageExtractor: {
            async extractReadableText() {
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
          aiProvider: {
            async summarizeMedia() {
              throw new Error("not used");
            },
            async summarizeWebpage() {
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
        abortController.signal
      )
    ).rejects.toMatchObject({
      category: "validation_error"
    });
  });
});
