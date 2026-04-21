import { SummarizerError } from "@domain/errors";
import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaUrlRequest,
  WebpageProcessResult,
  WebpageRequest
} from "@domain/types";
import type { RuntimeProvider } from "@runtime/runtime-provider";

export class PlaceholderRuntimeProvider implements RuntimeProvider {
  public async processMediaUrl(_: MediaUrlRequest, __: AbortSignal): Promise<MediaProcessResult> {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Runtime provider is not configured for media URL processing.",
      recoverable: false
    });
  }

  public async processLocalMedia(_: LocalMediaRequest, __: AbortSignal): Promise<MediaProcessResult> {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Runtime provider is not configured for local media processing.",
      recoverable: false
    });
  }

  public async processWebpage(_: WebpageRequest, __: AbortSignal): Promise<WebpageProcessResult> {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Runtime provider is not configured for webpage processing.",
      recoverable: false
    });
  }
}
