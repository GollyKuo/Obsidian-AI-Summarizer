import type {
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";

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
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  retentionMode: RetentionMode;
  mediaCacheRoot?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  vaultId?: string;
  mediaCompressionProfile?: "balanced" | "quality";
}

export interface LocalMediaRequest {
  sourceKind: "local_media";
  sourceValue: string;
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  retentionMode: RetentionMode;
  mediaCacheRoot?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  vaultId?: string;
  mediaCompressionProfile?: "balanced" | "quality";
}

export interface WebpageRequest {
  sourceKind: "webpage_url";
  sourceValue: string;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
}

export interface MediaProcessResult {
  metadata: SourceMetadata;
  normalizedText: string;
  transcript: TranscriptSegment[];
  aiUploadArtifactPaths?: string[];
  artifactCleanup?: {
    downloadedPath: string;
    normalizedAudioPath: string;
    transcriptPath: string;
    metadataPath: string;
    aiUploadDirectory: string;
    aiUploadArtifactPaths: string[];
  };
  warnings: string[];
}

export interface WebpageProcessResult {
  metadata: SourceMetadata;
  webpageText: string;
  warnings: string[];
}

export interface MediaTranscriptionInput {
  metadata: SourceMetadata;
  normalizedText: string;
  transcript: TranscriptSegment[];
  aiUploadArtifactPaths?: string[];
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
}

export interface MediaTranscriptionResult {
  transcript: TranscriptSegment[];
  transcriptMarkdown: string;
  warnings: string[];
}

export interface MediaSummaryInput {
  metadata: SourceMetadata;
  normalizedText: string;
  transcript: TranscriptSegment[];
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
}

export interface WebpageAiInput {
  metadata: SourceMetadata;
  webpageText: string;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
}

export interface MediaSummaryDraft {
  summaryMarkdown: string;
  warnings: string[];
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
