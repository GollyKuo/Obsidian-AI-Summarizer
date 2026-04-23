export type SourceType = "media_url" | "webpage_url" | "local_media";
export type RetentionMode = "none" | "source" | "all";

export interface SourceMetadata {
  title: string;
  creatorOrAuthor: string;
  platform: string;
  source: string;
  created: string;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface MediaUrlRequest {
  sourceKind: "media_url";
  sourceValue: string;
  model: string;
  retentionMode: RetentionMode;
  mediaCacheRoot?: string;
  vaultId?: string;
  mediaCompressionProfile?: "balanced" | "quality";
}

export interface LocalMediaRequest {
  sourceKind: "local_media";
  sourceValue: string;
  model: string;
  retentionMode: RetentionMode;
  mediaCacheRoot?: string;
  vaultId?: string;
  mediaCompressionProfile?: "balanced" | "quality";
}

export interface WebpageRequest {
  sourceKind: "webpage_url";
  sourceValue: string;
  model: string;
}

export interface MediaProcessResult {
  metadata: SourceMetadata;
  normalizedText: string;
  transcript: TranscriptSegment[];
  warnings: string[];
}

export interface WebpageProcessResult {
  metadata: SourceMetadata;
  webpageText: string;
  warnings: string[];
}

export interface MediaAiInput {
  metadata: SourceMetadata;
  normalizedText: string;
  transcript: TranscriptSegment[];
}

export interface WebpageAiInput {
  metadata: SourceMetadata;
  webpageText: string;
}

export interface MediaSummaryResult {
  summaryMarkdown: string;
  transcriptMarkdown: string;
  warnings: string[];
}

export interface WebpageSummaryResult {
  summaryMarkdown: string;
  warnings: string[];
}

export interface WriteResult {
  notePath: string;
  createdAt: string;
  warnings: string[];
}

export interface MediaNoteInput {
  metadata: SourceMetadata;
  summaryMarkdown: string;
  transcriptMarkdown: string;
}

export interface WebpageNoteInput {
  metadata: SourceMetadata;
  summaryMarkdown: string;
}
