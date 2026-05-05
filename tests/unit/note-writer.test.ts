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
      templateReference: "",
      generateFlashcards: true
    });

    const result = await writer.writeWebpageNote({
      metadata: {
        title: "  A \"Quote\"  ",
        creatorOrAuthor: "  ",
        platform: "Web",
        source: "https://example.com/article",
        created: "invalid-date"
      },
      summaryMetadata: {
        book: "Demo Book",
        author: "Demo Author",
        description: "A short description."
      },
      summaryMarkdown: "## 一、摘要\n內容"
    });

    expect(writtenPath).toBe("Summaries/A _Quote_ (2).md");
    expect(result.notePath).toBe(writtenPath);
    expect(result.warnings.some((warning) => warning.includes("Path collision policy"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("created timestamp was invalid"))).toBe(true);
    expect(writtenContent).toContain("Title: \"A \\\"Quote\\\"\"");
    expect(writtenContent).toContain("Book: \"Demo Book\"");
    expect(writtenContent).toContain("Author: \"Demo Author\"");
    expect(writtenContent).toContain("Creator: \"Unknown\"");
    expect(writtenContent).toContain("tags:\n  - Flashcard");
  });

  it("omits the Flashcard tag when marker mode is disabled", async () => {
    let writtenContent = "";
    const storage = {
      async exists(): Promise<boolean> {
        return false;
      },
      async write(_path: string, content: string): Promise<void> {
        writtenContent = content;
      },
      async readTemplate(): Promise<string | null> {
        return null;
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: "",
      generateFlashcards: false
    });

    await writer.writeWebpageNote({
      metadata: {
        title: "Article",
        creatorOrAuthor: "Author",
        platform: "Web",
        source: "https://example.com/article",
        created: "2026-04-24T08:00:00.000Z"
      },
      summaryMarkdown: "## Summary\n\nHello"
    });

    expect(writtenContent).toContain("tags:");
    expect(writtenContent).not.toContain("Flashcard");
  });

  it("uses builtin template references without reading custom template storage", async () => {
    let writtenContent = "";
    let readTemplateCalls = 0;

    const storage = {
      async exists(): Promise<boolean> {
        return false;
      },
      async write(_path: string, content: string): Promise<void> {
        writtenContent = content;
      },
      async readTemplate(): Promise<string | null> {
        readTemplateCalls += 1;
        return null;
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: "builtin:universal-frontmatter"
    });

    await writer.writeWebpageNote({
      metadata: {
        title: "Article",
        creatorOrAuthor: "Author",
        platform: "Web",
        source: "https://example.com/article",
        created: "2026-04-24T08:00:00.000Z"
      },
      summaryMarkdown: "## Summary\n\nHello"
    });

    expect(readTemplateCalls).toBe(0);
    expect(writtenContent).toContain("Platform: \"Web\"");
    expect(writtenContent).toContain("Created: \"2026-04-24\"");
    expect(writtenContent).toContain("## Summary\n\nHello");
  });

  it("inserts summary and transcript into custom template placeholders", async () => {
    let writtenContent = "";

    const storage = {
      async exists(): Promise<boolean> {
        return false;
      },
      async write(_path: string, content: string): Promise<void> {
        writtenContent = content;
      },
      async readTemplate(templateReference: string): Promise<string | null> {
        expect(templateReference).toBe("Templates/custom.md");
        return [
          "---",
          'title: "{{title}}"',
          'description: "{{description}}"',
          "tags:{{tags}}",
          "---",
          "# {{title}}",
          "{{summary}}",
          "## Raw",
          "{{transcript}}"
        ].join("\n");
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: "custom:Templates/custom.md",
      generateFlashcards: true
    });

    const result = await writer.writeMediaNote({
      metadata: {
        title: "Media",
        creatorOrAuthor: "Creator",
        platform: "YouTube",
        source: "https://example.com/watch",
        created: "2026-04-24T08:00:00.000Z"
      },
      summaryMetadata: {
        book: "",
        author: "",
        description: "Media description."
      },
      summaryMarkdown: "## Summary\nMedia summary.",
      transcriptMarkdown: "{0m0s - 0m1s} 这是网络软件 with OpenAI API"
    });

    expect(writtenContent).toContain("description: \"Media description.\"");
    expect(writtenContent).toContain("tags:\n  - Flashcard");
    expect(writtenContent).toContain("## Summary\nMedia summary.");
    expect(writtenContent).toContain("## Raw\n{0m0s - 0m1s} 這是網路軟體 with OpenAI API");
    expect(writtenContent).not.toContain("这是网络软件");
    expect(writtenContent.match(/## Transcript/g)).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("default frontmatter was added"))).toBe(false);
  });

  it("appends summary and transcript when custom template has no insertion placeholders", async () => {
    let writtenContent = "";

    const storage = {
      async exists(): Promise<boolean> {
        return false;
      },
      async write(_path: string, content: string): Promise<void> {
        writtenContent = content;
      },
      async readTemplate(): Promise<string | null> {
        return "# {{title}}\n\nSource: {{source}}";
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: "custom:Templates/custom.md"
    });

    const result = await writer.writeMediaNote({
      metadata: {
        title: "Media",
        creatorOrAuthor: "Creator",
        platform: "Podcast",
        source: "https://example.com/episode",
        created: "2026-04-24T08:00:00.000Z"
      },
      summaryMarkdown: "## Summary\nMedia summary.",
      transcriptMarkdown: "{0m0s - 0m1s} hello"
    });

    expect(writtenContent).toContain("Title: \"Media\"");
    expect(writtenContent).toContain("# Media\n\nSource: https://example.com/episode");
    expect(writtenContent).toContain("## Summary\nMedia summary.");
    expect(writtenContent).toContain("## Transcript\n\n{0m0s - 0m1s} hello");
    expect(result.warnings).toEqual(expect.arrayContaining([
      "Template renderer: custom template did not include frontmatter; default frontmatter was added.",
      "Template renderer: custom template did not include {{summary}}; summary was appended.",
      "Template renderer: custom template did not include {{transcript}}; transcript was appended."
    ]));
  });

  it("keeps custom frontmatter and reports unknown placeholders", async () => {
    let writtenContent = "";

    const storage = {
      async exists(): Promise<boolean> {
        return false;
      },
      async write(_path: string, content: string): Promise<void> {
        writtenContent = content;
      },
      async readTemplate(): Promise<string | null> {
        return [
          "---",
          'title: "{{title}}"',
          "custom: {{unknownPlaceholder}}",
          "---",
          "# {{title}}",
          "{{summary}}"
        ].join("\n");
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: "custom:Templates/custom.md"
    });

    const result = await writer.writeWebpageNote({
      metadata: {
        title: "Article",
        creatorOrAuthor: "Author",
        platform: "Web",
        source: "https://example.com/article",
        created: "2026-04-24T08:00:00.000Z"
      },
      summaryMarkdown: "## Summary\nArticle summary."
    });

    expect(writtenContent.match(/^---/g)).toHaveLength(1);
    expect(writtenContent).toContain("custom: {{unknownPlaceholder}}");
    expect(writtenContent).not.toContain("Title: \"Article\"");
    expect(result.warnings).toContain(
      "Template renderer: unknown placeholder(s) left unchanged: unknownPlaceholder."
    );
  });

  it("falls back to universal frontmatter when a custom template is unavailable", async () => {
    let writtenContent = "";

    const storage = {
      async exists(): Promise<boolean> {
        return false;
      },
      async write(_path: string, content: string): Promise<void> {
        writtenContent = content;
      },
      async readTemplate(): Promise<string | null> {
        return null;
      }
    };

    const writer = new ObsidianNoteWriter(storage, {
      outputFolder: "Summaries",
      templateReference: "custom:Templates/missing.md"
    });

    const result = await writer.writeWebpageNote({
      metadata: {
        title: "Article",
        creatorOrAuthor: "Author",
        platform: "Web",
        source: "https://example.com/article",
        created: "2026-04-24T08:00:00.000Z"
      },
      summaryMarkdown: "## Summary\nArticle summary."
    });

    expect(writtenContent).toContain("Title: \"Article\"");
    expect(writtenContent).toContain("## Summary\nArticle summary.");
    expect(result.warnings.some((warning) => warning.includes("custom template was not found"))).toBe(true);
  });
});
