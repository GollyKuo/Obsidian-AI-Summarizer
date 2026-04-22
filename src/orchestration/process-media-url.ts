import { SummarizerError } from "@domain/errors";
import type { MediaCompressionProfile } from "@domain/settings";
import type { MediaUrlRequest, SourceMetadata } from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import type {
  DownloaderAdapter,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import type {
  PreUploadCompressionResult,
  PreUploadCompressor
} from "@services/media/pre-upload-compressor";

export interface ProcessMediaUrlInput extends MediaUrlRequest {
  mediaCacheRoot: string;
  vaultId: string;
  mediaCompressionProfile: MediaCompressionProfile;
}

export interface TranscriptReadyPayload {
  sessionId: string;
  sourceType: MediaDownloadSession["source"]["sourceType"];
  sourceUrl: string;
  metadata: SourceMetadata;
  downloadedPath: string;
  normalizedAudioPath: string;
  aiUploadArtifactPaths: string[];
  transcriptPath: string;
  aiUploadDirectory: string;
  warnings: string[];
}

export interface ProcessMediaUrlDependencies {
  downloaderAdapter: DownloaderAdapter;
  preUploadCompressor: PreUploadCompressor;
}

export interface ProcessMediaUrlResult {
  session: MediaDownloadSession;
  downloadResult: MediaDownloadResult;
  preUploadResult: PreUploadCompressionResult;
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
  downloadResult: MediaDownloadResult,
  preUploadResult: PreUploadCompressionResult,
  warnings: string[]
): TranscriptReadyPayload {
  return {
    sessionId: session.sessionId,
    sourceType: session.source.sourceType,
    sourceUrl: session.source.normalizedUrl,
    metadata: downloadResult.metadata,
    downloadedPath: downloadResult.downloadedPath,
    normalizedAudioPath: preUploadResult.normalizedAudioPath,
    aiUploadArtifactPaths: preUploadResult.aiUploadArtifactPaths,
    transcriptPath: session.artifacts.transcriptPath,
    aiUploadDirectory: session.artifacts.aiUploadDirectory,
    warnings
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

  const preUploadResult = await runJobStep(
    "transcribing",
    "Preparing AI-ready media artifacts",
    signal,
    async () =>
      dependencies.preUploadCompressor.prepareForAiUpload(
        {
          session,
          downloadResult,
          profile: input.mediaCompressionProfile
        },
        signal
      ),
    hooks
  );

  const warnings = [...downloadResult.warnings, ...preUploadResult.warnings];
  emitWarnings(downloadResult.warnings, hooks);
  emitWarnings(preUploadResult.warnings, hooks);
  const transcriptReadyPayload = toTranscriptReadyPayload(
    session,
    downloadResult,
    preUploadResult,
    warnings
  );

  return {
    session,
    downloadResult,
    preUploadResult,
    transcriptReadyPayload,
    warnings
  };
}
