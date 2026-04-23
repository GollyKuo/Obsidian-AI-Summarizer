import { describe, expect, it } from "vitest";
import { ObsidianNoteWriter } from "@services/obsidian/note-writer";

describe("note writer", () => {
  it("normalizes metadata, resolves collisions, and writes escaped frontmatter", async () => {
    let writtenPath = "";
    let writtenContent = "";

    const storage = {
      async exists(path: string): Promise<boolean> {
        return path === "Summaries/A _Quote_.md";
      },
      async write(path: string, content: string): Promise<void> {
        writtenPath = path;
        writtenContent = content;
      },
      async readTemplate(): Promise<string | null> {
        return null;
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: ""
    });

    const result = await writer.writeWebpageNote({
      metadata: {
        title: "  A \"Quote\"  ",
        creatorOrAuthor: "  ",
        platform: "Web",
        source: "https://example.com/article",
        created: "invalid-date"
      },
      summaryMarkdown: "## 一、摘要\n內容"
    });

    expect(writtenPath).toBe("Summaries/A _Quote_ (2).md");
    expect(result.notePath).toBe(writtenPath);
    expect(result.warnings.some((warning) => warning.includes("Path collision policy"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("created timestamp was invalid"))).toBe(true);
    expect(writtenContent).toContain("Title: \"A \\\"Quote\\\"\"");
    expect(writtenContent).toContain("Creator: \"Unknown\"");
  });
});
