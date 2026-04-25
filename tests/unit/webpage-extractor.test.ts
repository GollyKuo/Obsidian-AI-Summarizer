import { describe, expect, it, vi } from "vitest";
import { FetchWebpageExtractor } from "@services/web/webpage-extractor";

describe("FetchWebpageExtractor", () => {
  it("fetches and strips webpage HTML into readable text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html><head><style>.x{}</style></head><body><h1>Hello</h1><script>x()</script><p>A &amp; B</p></body></html>")
    );
    const extractor = new FetchWebpageExtractor(fetchImpl);

    const result = await extractor.extractReadableText("https://example.com", new AbortController().signal);

    expect(result).toBe("Hello A & B");
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com", {
      signal: expect.any(AbortSignal)
    });
  });

  it("throws when fetch returns an error response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 }));
    const extractor = new FetchWebpageExtractor(fetchImpl);

    await expect(
      extractor.extractReadableText("https://example.com/missing", new AbortController().signal)
    ).rejects.toThrow(/HTTP 404/);
  });
});
