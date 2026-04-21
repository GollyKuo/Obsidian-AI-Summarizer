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
