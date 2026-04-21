import { describe, expect, it } from "vitest";
import { classifyMediaUrl } from "@services/media/url-classifier";

describe("classifyMediaUrl", () => {
  it("classifies youtube links", () => {
    const result = classifyMediaUrl("https://www.youtube.com/watch?v=abc123");
    expect(result.sourceType).toBe("youtube");
    expect(result.host).toBe("www.youtube.com");
  });

  it("classifies direct media links by extension", () => {
    const result = classifyMediaUrl("https://cdn.example.com/audio/episode-001.mp3");
    expect(result.sourceType).toBe("direct_media");
  });

  it("classifies podcast platform links", () => {
    const result = classifyMediaUrl("https://open.spotify.com/episode/abc");
    expect(result.sourceType).toBe("podcast");
  });

  it("throws validation_error for unsupported source", () => {
    try {
      classifyMediaUrl("https://example.com/article");
      expect.fail("Expected validation error for unsupported source");
    } catch (error) {
      expect(error).toMatchObject({
        category: "validation_error"
      });
    }
  });

  it("throws validation_error for non-http protocol", () => {
    try {
      classifyMediaUrl("file:///tmp/episode.mp3");
      expect.fail("Expected validation error for non-http protocol");
    } catch (error) {
      expect(error).toMatchObject({
        category: "validation_error"
      });
    }
  });
});
