import { describe, expect, it } from "vitest";
import { normalizeNoteMetadata } from "@services/obsidian/note-output-contract";

describe("note output contract", () => {
  it("normalizes metadata fields and regenerates invalid created timestamp", () => {
    const result = normalizeNoteMetadata(
      {
        title: "  Demo   Title  ",
        creatorOrAuthor: " ",
        platform: "youtube video",
        source: "  https://example.com/article  ",
        created: "invalid"
      },
      {
        now: () => new Date("2026-04-23T00:00:00.000Z")
      }
    );

    expect(result.metadata.title).toBe("Demo Title");
    expect(result.metadata.creatorOrAuthor).toBe("Unknown");
    expect(result.metadata.platform).toBe("YouTube");
    expect(result.metadata.source).toBe("https://example.com/article");
    expect(result.metadata.created).toBe("2026-04-23T00:00:00.000Z");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("keeps already valid metadata unchanged", () => {
    const result = normalizeNoteMetadata({
      title: "Demo",
      creatorOrAuthor: "Author",
      platform: "Web",
      source: "https://example.com",
      created: "2026-04-20T00:00:00.000Z"
    });

    expect(result.metadata).toEqual({
      title: "Demo",
      creatorOrAuthor: "Author",
      platform: "Web",
      source: "https://example.com",
      created: "2026-04-20T00:00:00.000Z"
    });
    expect(result.warnings).toEqual([]);
  });
});
