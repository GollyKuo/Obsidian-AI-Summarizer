import type {
  MediaSummaryDraft,
  MediaSummaryInput,
  MediaTranscriptionResult,
  TranscriptCleanupInput,
  WebpageAiInput,
  WebpageSummaryResult
} from "@domain/types";

export interface SummaryProvider {
  summarizeMedia(input: MediaSummaryInput, signal: AbortSignal): Promise<MediaSummaryDraft>;
  summarizeWebpage(input: WebpageAiInput, signal: AbortSignal): Promise<WebpageSummaryResult>;
}

export interface TranscriptCleanupProvider {
  cleanupTranscript(
    input: TranscriptCleanupInput,
    signal: AbortSignal
  ): Promise<MediaTranscriptionResult>;
}

export type AiProvider = SummaryProvider;
