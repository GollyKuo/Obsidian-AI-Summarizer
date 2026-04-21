import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaUrlRequest,
  WebpageProcessResult,
  WebpageRequest
} from "@domain/types";

export interface RuntimeProvider {
  processMediaUrl(input: MediaUrlRequest, signal: AbortSignal): Promise<MediaProcessResult>;
  processLocalMedia(input: LocalMediaRequest, signal: AbortSignal): Promise<MediaProcessResult>;
  processWebpage(input: WebpageRequest, signal: AbortSignal): Promise<WebpageProcessResult>;
}
