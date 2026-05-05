import type { SourceMetadata } from "@domain/types";
import type { WebpageExtractionMetadata } from "@services/web/webpage-extractor";

export interface MetadataExtractor {
  fromWebpage(
    url: string,
    extractedText: string,
    extractionMetadata?: WebpageExtractionMetadata
  ): SourceMetadata;
}

export class BasicMetadataExtractor implements MetadataExtractor {
  public fromWebpage(
    url: string,
    extractedText: string,
    extractionMetadata: WebpageExtractionMetadata = {}
  ): SourceMetadata {
    const fallbackTitle = extractedText
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 80);

    return {
      title: extractionMetadata.title || fallbackTitle || "Untitled Webpage",
      creatorOrAuthor: extractionMetadata.author || "Unknown",
      platform: "Web",
      source: extractionMetadata.canonicalUrl || url,
      created: new Date().toISOString()
    };
  }
}
