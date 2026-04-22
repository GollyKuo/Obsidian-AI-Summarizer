import { SummarizerError } from "@domain/errors";
import type { MediaUrlRequest, SourceMetadata } from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import type {
  DownloaderAdapter,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";

export interface ProcessMediaUrlInput extends MediaUrlRequest {
  mediaCacheRoot: string;
  vaultId: string;
}

export interface TranscriptReadyPayload {
  sessionId: string;
  sourceType: MediaDownloadSession["source"]["sourceType"];
  sourceUrl: string;
  metadata: SourceMetadata;
  downloadedPath: string;
  normalizedAudioPath: string;
  transcriptPath: string;
  aiUploadDirectory: string;
  warnings: string[];
}

export interface ProcessMediaUrlDependencies {
  downloaderAdapter: DownloaderAdapter;
}

export interface ProcessMediaUrlResult {
  session: MediaDownloadSession;
  downloadResult: MediaDownloadResult;
  transcriptReadyPayload: TranscriptReadyPayload;
  warnings: string[];
}

function validateInput(input: ProcessMediaUrlInput): void {
  if (input.sourceKind !== "media_url") {
    throw new SummarizerError({
      category: "validation_error",
      message: `Invalid source kind for media URL flow: ${input.sourceKind}`,
      recoverable: true
    });
  }

  if (input.sourceValue.trim().length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Media URL is empty.",
      recoverable: true
    });
  }

  if (input.vaultId.trim().length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "vaultId is required for media URL flow.",
      recoverable: true
    });
  }
}

function toTranscriptReadyPayload(
  session: MediaDownloadSession,
  downloadResult: MediaDownloadResult
): TranscriptReadyPayload {
  return {
    sessionId: session.sessionId,
    sourceType: session.source.sourceType,
    sourceUrl: session.source.normalizedUrl,
    metadata: downloadResult.metadata,
    downloadedPath: downloadResult.downloadedPath,
    normalizedAudioPath: session.artifacts.normalizedAudioPath,
    transcriptPath: session.artifacts.transcriptPath,
    aiUploadDirectory: session.artifacts.aiUploadDirectory,
    warnings: downloadResult.warnings
  };
}

export async function processMediaUrl(
  input: ProcessMediaUrlInput,
  dependencies: ProcessMediaUrlDependencies,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<ProcessMediaUrlResult> {
  await runJobStep(
    "validating",
    "Validating media URL input",
    signal,
    async () => {
      validateInput(input);
    },
    hooks
  );

  const session = await runJobStep(
    "acquiring",
    "Preparing media acquisition session",
    signal,
    async () =>
      dependencies.downloaderAdapter.prepareSession(
        {
          sourceUrl: input.sourceValue,
          mediaCacheRoot: input.mediaCacheRoot,
          vaultId: input.vaultId
        },
        signal
      ),
    hooks
  );

  const downloadResult = await runJobStep(
    "acquiring",
    "Downloading media artifact",
    signal,
    async () => dependencies.downloaderAdapter.downloadMedia(session, signal),
    hooks
  );

  emitWarnings(downloadResult.warnings, hooks);
  const transcriptReadyPayload = toTranscriptReadyPayload(session, downloadResult);

  return {
    session,
    downloadResult,
    transcriptReadyPayload,
    warnings: [...downloadResult.warnings]
  };
}
