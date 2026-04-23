import { describe, expect, it } from "vitest";
import { applyWebpageMetadataPolicy } from "@services/web/webpage-metadata-policy";

describe("webpage metadata policy", () => {
  it("forces platform to Web and source to input url", () => {
    const result = applyWebpageMetadataPolicy(
      "https://example.com/article",
      {
        title: "Demo",
        creatorOrAuthor: "Author",
        platform: "Medium",
        source: "https://wrong.example.com",
        created: "2026-04-20"
      },
      {
        now: () => new Date("2026-04-23T00:00:00.000Z")
      }
    );

    expect(result.metadata.platform).toBe("Web");
    expect(result.metadata.source).toBe("https://example.com/article");
    expect(result.warnings.some((warning) => warning.includes("platform has been normalized to Web"))).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("source has been normalized to input URL"))
    ).toBe(true);
  });

  it("regenerates created timestamp when invalid", () => {
    const result = applyWebpageMetadataPolicy(
      "https://example.com/article",
      {
        title: "",
        creatorOrAuthor: "",
        platform: "Web",
        source: "https://example.com/article",
        created: "invalid-date"
      },
      {
        now: () => new Date("2026-04-23T00:00:00.000Z")
      }
    );

    expect(result.metadata.title).toBe("Untitled Webpage");
    expect(result.metadata.creatorOrAuthor).toBe("Unknown");
    expect(result.metadata.created).toBe("2026-04-23T00:00:00.000Z");
    expect(
      result.warnings.some((warning) => warning.includes("created timestamp was invalid and has been regenerated"))
    ).toBe(true);
  });
});
