import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchWebpageExtractor } from "@services/web/webpage-extractor";

describe("FetchWebpageExtractor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("binds the default global fetch implementation to the runtime global", async () => {
    const fetchImpl = vi.fn(async function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return new Response("<main>Bound fetch</main>");
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const extractor = new FetchWebpageExtractor();

    await expect(
      extractor.extractReadableText("https://example.com/bound", new AbortController().signal)
    ).resolves.toBe("Bound fetch");
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/bound", {
      signal: expect.any(AbortSignal)
    });
  });
});
