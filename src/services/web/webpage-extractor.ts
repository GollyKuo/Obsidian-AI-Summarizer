import { SummarizerError } from "@domain/errors";

export interface WebpageExtractor {
  extractReadableText(url: string, signal: AbortSignal): Promise<string>;
}

export class PlaceholderWebpageExtractor implements WebpageExtractor {
  public async extractReadableText(_: string, __: AbortSignal): Promise<string> {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Webpage extractor is not configured.",
      recoverable: false
    });
  }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export class FetchWebpageExtractor implements WebpageExtractor {
  private readonly fetchImpl?: typeof fetch;

  public constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? getDefaultFetchImplementation();
  }

  public async extractReadableText(url: string, signal: AbortSignal): Promise<string> {
    if (!this.fetchImpl) {
      throw new SummarizerError({
        category: "runtime_unavailable",
        message: "Current runtime does not provide fetch for webpage extraction.",
        recoverable: false
      });
    }

    const response = await this.fetchImpl(url, { signal });
    if (!response.ok) {
      throw new SummarizerError({
        category: "runtime_unavailable",
        message: `Webpage extraction failed (HTTP ${response.status}).`,
        recoverable: true
      });
    }

    const readableText = stripHtmlToText(await response.text());
    if (readableText.length === 0) {
      throw new SummarizerError({
        category: "runtime_unavailable",
        message: "Webpage extraction produced empty text.",
        recoverable: true
      });
    }
    return readableText;
  }
}

function getDefaultFetchImplementation(): typeof fetch | undefined {
  return globalThis.fetch?.bind(globalThis);
}
