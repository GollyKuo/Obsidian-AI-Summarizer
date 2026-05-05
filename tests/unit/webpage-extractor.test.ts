import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchWebpageExtractor } from "@services/web/webpage-extractor";

describe("FetchWebpageExtractor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and strips webpage HTML into readable text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html><head><style>.x{}</style></head><body><h1>Hello</h1><script>x()</script><p>A &amp; B &#x1F4A1;</p></body></html>")
    );
    const extractor = new FetchWebpageExtractor(fetchImpl);

    const result = await extractor.extractReadableText("https://example.com", new AbortController().signal);

    expect(result).toMatchObject({
      readableText: "Hello A & B 💡",
      warnings: []
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com", {
      signal: expect.any(AbortSignal)
    });
  });

  it("uses Obsidian requestUrl when no fetch implementation is injected", async () => {
    const requestUrlImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      json: null,
      text: "<main>RequestUrl content</main>"
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("<main>Fetch content</main>"));
    const extractor = new FetchWebpageExtractor(fetchImpl, requestUrlImpl);

    const result = await extractor.extractReadableText("https://example.com/request-url", new AbortController().signal);

    expect(result.readableText).toBe("RequestUrl content");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(requestUrlImpl).toHaveBeenCalledWith({
      url: "https://example.com/request-url",
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      throw: false
    });
  });

  it("falls back to fetch when Obsidian requestUrl fails", async () => {
    const requestUrlImpl = vi.fn().mockRejectedValue(new Error("requestUrl unavailable"));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("<main>Fetch fallback</main>"));
    const extractor = new FetchWebpageExtractor(fetchImpl, requestUrlImpl);

    await expect(
      extractor.extractReadableText("https://example.com/fallback", new AbortController().signal)
    ).resolves.toMatchObject({ readableText: "Fetch fallback" });
    expect(requestUrlImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("extracts title, meta description, OpenGraph, author, and canonical URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`
        <html>
          <head>
            <title>Fallback &amp; Title</title>
            <meta name="description" content="Meta &quot;description&quot;">
            <meta property="og:title" content="OpenGraph Title">
            <meta property="article:author" content="Demo Author">
            <link rel="canonical" href="/canonical-article">
          </head>
          <body>
            <article>${"Article body. ".repeat(20)}</article>
          </body>
        </html>
      `)
    );
    const extractor = new FetchWebpageExtractor(fetchImpl);

    const result = await extractor.extractReadableText("https://example.com/articles?id=1", new AbortController().signal);

    expect(result).toMatchObject({
      metadata: {
        title: "OpenGraph Title",
        description: 'Meta "description"',
        author: "Demo Author",
        canonicalUrl: "https://example.com/canonical-article"
      }
    });
  });

  it("falls back to body text when article content is too short", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`
        <html>
          <body>
            <article>Short.</article>
            <main>Tiny.</main>
            <p>${"Body fallback content. ".repeat(8)}</p>
          </body>
        </html>
      `)
    );
    const extractor = new FetchWebpageExtractor(fetchImpl);

    const result = await extractor.extractReadableText("https://example.com", new AbortController().signal);

    expect(result.readableText).toContain("Body fallback content");
    expect(result.warnings).toContain("Webpage extraction: primary content was short; used body fallback.");
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

    const extractor = new FetchWebpageExtractor(undefined, null);

    await expect(
      extractor.extractReadableText("https://example.com/bound", new AbortController().signal)
    ).resolves.toMatchObject({ readableText: "Bound fetch" });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/bound", {
      signal: expect.any(AbortSignal)
    });
  });
});
