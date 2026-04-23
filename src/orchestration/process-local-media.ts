import { SummarizerError } from "@domain/errors";
import type { MediaCompressionProfile } from "@domain/settings";
import type { LocalMediaRequest, SourceMetadata } from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import type { MediaDownloadResult } from "@services/media/downloader-adapter";
import type {
  LocalMediaIngestionAdapter,
  LocalMediaIngestionSession
} from "@services/media/local-media-ingestion-adapter";
import type {
  PreUploadCompressionResult,
  PreUploadCompressor
} from "@services/media/pre-upload-compressor";

export interface ProcessLocalMediaInput extends LocalMediaRequest {
  mediaCacheRoot: string;
  vaultId: string;
  mediaCompressionProfile: MediaCompressionProfile;
}

export interface LocalTranscriptReadyPayload {
  sessionId: string;
  sourceType: "local_media";
  sourcePath: string;
  metadata: SourceMetadata;
  downloadedPath: string;
  normalizedAudioPath: string;
  aiUploadArtifactPaths: string[];
  chunkCount: number;
  chunkDurationsMs: number[];
  vadApplied: boolean;
  selectedCodec: PreUploadCompressionResult["selectedCodec"];
  transcriptPath: string;
  aiUploadDirectory: string;
  warnings: string[];
}

export interface ProcessLocalMediaDependencies {
  localMediaIngestionAdapter: LocalMediaIngestionAdapter;
  preUploadCompressor: PreUploadCompressor;
}

export interface ProcessLocalMediaResult {
  session: LocalMediaIngestionSession;
  ingestionResult: MediaDownloadResult;
  preUploadResult: PreUploadCompressionResult;
  transcriptReadyPayload: LocalTranscriptReadyPayload;
  warnings: string[];
}

function validateInput(input: ProcessLocalMediaInput): void {
  if (input.sourceKind !== "local_media") {
    throw new SummarizerError({
      category: "validation_error",
      message: `Invalid source kind for local media flow: ${input.sourceKind}`,
      recoverable: true
    });
  }

  if (input.sourceValue.trim().length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Local media path is empty.",
      recoverable: true
    });
  }

  if (input.vaultId.trim().length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "vaultId is required for local media flow.",
      recoverable: true
    });
  }
}

function toTranscriptReadyPayload(
  session: LocalMediaIngestionSession,
  ingestionResult: MediaDownloadResult,
  preUploadResult: PreUploadCompressionResult,
  warnings: string[]
): LocalTranscriptReadyPayload {
  return {
    sessionId: session.sessionId,
    sourceType: "local_media",
    sourcePath: session.localSourcePath,
    metadata: ingestionResult.metadata,
    downloadedPath: ingestionResult.downloadedPath,
    normalizedAudioPath: preUploadResult.normalizedAudioPath,
    aiUploadArtifactPaths: preUploadResult.aiUploadArtifactPaths,
    chunkCount: preUploadResult.chunkCount,
    chunkDurationsMs: preUploadResult.chunkDurationsMs,
    vadApplied: preUploadResult.vadApplied,
    selectedCodec: preUploadResult.selectedCodec,
    transcriptPath: session.artifacts.transcriptPath,
    aiUploadDirectory: session.artifacts.aiUploadDirectory,
    warnings
  };
}

export async function processLocalMedia(
  input: ProcessLocalMediaInput,
  dependencies: ProcessLocalMediaDependencies,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<ProcessLocalMediaResult> {
  await runJobStep(
    "validating",
    "Validating local media input",
    signal,
    async () => {
      validateInput(input);
    },
    hooks
  );

  const session = await runJobStep(
    "acquiring",
    "Preparing local media session",
    signal,
    async () =>
      dependencies.localMediaIngestionAdapter.prepareSession(
        {
          sourcePath: input.sourceValue,
          mediaCacheRoot: input.mediaCacheRoot,
          vaultId: input.vaultId
        },
        signal
      ),
    hooks
  );

  const ingestionResult = await runJobStep(
    "acquiring",
    "Ingesting local media artifact",
    signal,
    async () => dependencies.localMediaIngestionAdapter.ingestMedia(session, signal),
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
          downloadResult: ingestionResult,
          profile: input.mediaCompressionProfile
        },
        signal
      ),
    hooks
  );

  const warnings = [...ingestionResult.warnings, ...preUploadResult.warnings];
  emitWarnings(ingestionResult.warnings, hooks);
  emitWarnings(preUploadResult.warnings, hooks);
  const transcriptReadyPayload = toTranscriptReadyPayload(
    session,
    ingestionResult,
    preUploadResult,
    warnings
  );

  return {
    session,
    ingestionResult,
    preUploadResult,
    transcriptReadyPayload,
    warnings
  };
}
