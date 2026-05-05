import type {
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";

export type SourceType = "media_url" | "webpage_url" | "local_media" | "transcript_file";
export type RetentionMode = "delete_temp" | "keep_temp";
export type GeminiTranscriptionStrategy = "auto" | "files_api" | "inline_chunks";
export type TranscriptCleanupFailureMode = "fallback_to_original" | "fail";

export interface SourceMetadata {
  title: string;
  creatorOrAuthor: string;
  platform: string;
  source: string;
  created: string;
}

export interface SummaryMetadata {
  book: string;
  author: string;
  description: string;
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
  geminiTranscriptionStrategy?: GeminiTranscriptionStrategy;
  enableTranscriptCleanup?: boolean;
  transcriptCleanupFailureMode?: TranscriptCleanupFailureMode;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  retentionMode: RetentionMode;
  mediaCacheRoot?: string;
  ytDlpPath?: string;
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
  geminiTranscriptionStrategy?: GeminiTranscriptionStrategy;
  enableTranscriptCleanup?: boolean;
  transcriptCleanupFailureMode?: TranscriptCleanupFailureMode;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  retentionMode: RetentionMode;
  mediaCacheRoot?: string;
  ytDlpPath?: string;
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

export interface TranscriptFileRequest {
  sourceKind: "transcript_file";
  sourceValue: string;
  enableTranscriptCleanup?: boolean;
  transcriptCleanupFailureMode?: TranscriptCleanupFailureMode;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
}

export interface MediaProcessResult {
  metadata: SourceMetadata;
  normalizedText: string;
  transcript: TranscriptSegment[];
  aiUploadArtifactPaths?: string[];
  artifactMetadataPath?: string;
  artifactCleanup?: {
    downloadedPath: string;
    normalizedAudioPath: string;
    transcriptPath: string;
    subtitlePath: string;
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
  artifactMetadataPath?: string;
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
}

export interface MediaTranscriptionResult {
  transcript: TranscriptSegment[];
  transcriptMarkdown: string;
  warnings: string[];
}

export interface TranscriptCleanupInput {
  metadata: SourceMetadata;
  transcript: TranscriptSegment[];
  transcriptMarkdown: string;
  cleanupProvider: SummaryProvider;
  cleanupModel: SummaryModel;
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
  summaryMetadata?: SummaryMetadata;
  warnings: string[];
}

export interface MediaSummaryResult {
  summaryMarkdown: string;
  summaryMetadata?: SummaryMetadata;
  transcriptMarkdown: string;
  warnings: string[];
}

export interface WebpageSummaryResult {
  summaryMarkdown: string;
  summaryMetadata?: SummaryMetadata;
  warnings: string[];
}

export interface WriteResult {
  notePath: string;
  createdAt: string;
  warnings: string[];
}

export interface MediaNoteInput {
  metadata: SourceMetadata;
  summaryMetadata?: SummaryMetadata;
  summaryMarkdown: string;
  transcriptMarkdown: string;
}

export interface WebpageNoteInput {
  metadata: SourceMetadata;
  summaryMetadata?: SummaryMetadata;
  summaryMarkdown: string;
}
