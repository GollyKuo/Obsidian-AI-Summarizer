import type {
  MediaAiInput,
  MediaSummaryResult,
  WebpageAiInput,
  WebpageSummaryResult
} from "@domain/types";

export interface AiProvider {
  summarizeMedia(input: MediaAiInput, signal: AbortSignal): Promise<MediaSummaryResult>;
  summarizeWebpage(input: WebpageAiInput, signal: AbortSignal): Promise<WebpageSummaryResult>;
}
