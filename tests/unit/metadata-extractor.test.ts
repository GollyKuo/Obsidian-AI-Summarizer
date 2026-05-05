import { describe, expect, it } from "vitest";
import { BasicMetadataExtractor } from "@services/web/metadata-extractor";

describe("BasicMetadataExtractor", () => {
  it("uses extraction metadata before generic fallbacks", () => {
    const metadata = new BasicMetadataExtractor().fromWebpage(
      "https://example.com/input",
      "Readable text fallback",
      {
        title: "Extracted Title",
        author: "Demo Author",
        canonicalUrl: "https://example.com/canonical"
      }
    );

    expect(metadata).toMatchObject({
      title: "Extracted Title",
      creatorOrAuthor: "Demo Author",
      platform: "Web",
      source: "https://example.com/canonical"
    });
  });

  it("falls back to the first readable line for title", () => {
    const metadata = new BasicMetadataExtractor().fromWebpage(
      "https://example.com/input",
      "\n  First readable heading\nSecond line"
    );

    expect(metadata.title).toBe("First readable heading");
    expect(metadata.source).toBe("https://example.com/input");
  });
});
