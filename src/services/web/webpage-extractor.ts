import { SummarizerError } from "@domain/errors";

export interface WebpageExtractor {
  extractReadableText(url: string, signal: AbortSignal): Promise<string | WebpageExtractionResult>;
}

export interface WebpageExtractionMetadata {
  title?: string;
  description?: string;
  author?: string;
  canonicalUrl?: string;
}

export interface WebpageExtractionResult {
  readableText: string;
  metadata: WebpageExtractionMetadata;
  warnings: string[];
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

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[lower] ?? entity;
  });
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlToText(html: string): string {
  return normalizeText(
    html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
  );
}

function getFirstTagContent(html: string, tagName: string): string {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(html);
  return match ? stripHtmlToText(match[1]) : "";
}

function getFirstTagHtml(html: string, tagName: string): string {
  return new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(html)?.[1] ?? "";
}

function getAttribute(tag: string, attributeName: string): string {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  const rawValue = pattern.exec(tag)?.[1] ?? "";
  return normalizeText(rawValue.replace(/^["']|["']$/g, ""));
}

function findMetaContent(html: string, selectorName: string, selectorValue: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const normalizedSelectorValue = selectorValue.toLowerCase();
  for (const tag of tags) {
    const value = getAttribute(tag, selectorName).toLowerCase();
    if (value === normalizedSelectorValue) {
      return getAttribute(tag, "content");
    }
  }
  return "";
}

function findCanonicalUrl(html: string, baseUrl: string): string {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const link of links) {
    if (getAttribute(link, "rel").toLowerCase().split(/\s+/g).includes("canonical")) {
      const href = getAttribute(link, "href");
      if (href.length > 0) {
        try {
          return new URL(href, baseUrl).toString();
        } catch {
          return "";
        }
      }
    }
  }
  return "";
}

function extractMetadata(html: string, url: string): WebpageExtractionMetadata {
  return {
    title: findMetaContent(html, "property", "og:title") || getFirstTagContent(html, "title"),
    description:
      findMetaContent(html, "name", "description") ||
      findMetaContent(html, "property", "og:description"),
    author: findMetaContent(html, "name", "author") || findMetaContent(html, "property", "article:author"),
    canonicalUrl: findCanonicalUrl(html, url)
  };
}

function extractReadableTextFromHtml(html: string): { readableText: string; warnings: string[] } {
  const warnings: string[] = [];
  const articleText = stripHtmlToText(getFirstTagHtml(html, "article"));
  if (articleText.length >= 80) {
    return { readableText: articleText, warnings };
  }

  const mainText = stripHtmlToText(getFirstTagHtml(html, "main"));
  if (mainText.length >= 80) {
    warnings.push("Webpage extraction: article text was short; used main content fallback.");
    return { readableText: mainText, warnings };
  }

  const bodyText = stripHtmlToText(getFirstTagHtml(html, "body"));
  if (bodyText.length > 0) {
    if (articleText.length > 0 || mainText.length > 0) {
      warnings.push("Webpage extraction: primary content was short; used body fallback.");
    }
    return { readableText: bodyText, warnings };
  }

  return {
    readableText: stripHtmlToText(html),
    warnings: ["Webpage extraction: body content was unavailable; used full HTML fallback."]
  };
}

export class FetchWebpageExtractor implements WebpageExtractor {
  private readonly fetchImpl?: typeof fetch;

  public constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? getDefaultFetchImplementation();
  }

  public async extractReadableText(url: string, signal: AbortSignal): Promise<WebpageExtractionResult> {
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

    const html = await response.text();
    const { readableText, warnings } = extractReadableTextFromHtml(html);
    if (readableText.length === 0) {
      throw new SummarizerError({
        category: "runtime_unavailable",
        message: "Webpage extraction produced empty text.",
        recoverable: true
      });
    }
    return {
      readableText,
      metadata: extractMetadata(html, url),
      warnings
    };
  }
}

function getDefaultFetchImplementation(): typeof fetch | undefined {
  return globalThis.fetch?.bind(globalThis);
}
