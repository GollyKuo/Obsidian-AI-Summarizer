import type { SourceMetadata } from "@domain/types";

export interface MetadataExtractor {
  fromWebpage(url: string, extractedText: string): SourceMetadata;
}

export class BasicMetadataExtractor implements MetadataExtractor {
  public fromWebpage(url: string, _: string): SourceMetadata {
    return {
      title: "Untitled Webpage",
      creatorOrAuthor: "Unknown",
      platform: "Web",
      source: url,
      created: new Date().toISOString()
    };
  }
}
