import { SummarizerError } from "@domain/errors";
import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaUrlRequest,
  WebpageProcessResult,
  WebpageRequest
} from "@domain/types";
import { assertMediaDependenciesReady } from "@services/media/dependency-readiness";
import type { RuntimeProvider } from "@runtime/runtime-provider";

export class LocalBridgeRuntimeProvider implements RuntimeProvider {
  public readonly strategy = "local_bridge";

  public async processMediaUrl(_: MediaUrlRequest, __: AbortSignal): Promise<MediaProcessResult> {
    await assertMediaDependenciesReady();

    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Dependencies are ready, but media URL acquisition is not implemented yet.",
      recoverable: false
    });
  }

  public async processLocalMedia(_: LocalMediaRequest, __: AbortSignal): Promise<MediaProcessResult> {
    await assertMediaDependenciesReady();

    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Dependencies are ready, but local media processing is not implemented yet.",
      recoverable: false
    });
  }

  public async processWebpage(_: WebpageRequest, __: AbortSignal): Promise<WebpageProcessResult> {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Local bridge runtime does not handle webpage flow.",
      recoverable: false
    });
  }
}
