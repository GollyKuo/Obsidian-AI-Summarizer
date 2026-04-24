import type {
  MediaSummaryDraft,
  MediaSummaryInput,
  WebpageAiInput,
  WebpageSummaryResult
} from "@domain/types";

export interface SummaryProvider {
  summarizeMedia(input: MediaSummaryInput, signal: AbortSignal): Promise<MediaSummaryDraft>;
  summarizeWebpage(input: WebpageAiInput, signal: AbortSignal): Promise<WebpageSummaryResult>;
}

export type AiProvider = SummaryProvider;
