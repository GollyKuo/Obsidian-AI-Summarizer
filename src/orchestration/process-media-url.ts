import { SummarizerError } from "@domain/errors";
import type { MediaCompressionProfile } from "@domain/settings";
import type { MediaUrlRequest, SourceMetadata } from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import type {
  DownloaderAdapter,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import {
  createArtifactRetentionManager,
  type ArtifactLifecycleStatus,
  type ArtifactRetentionManager
} from "@services/media/artifact-retention";
import type {
  PreUploadCompressionResult,
  PreUploadCompressor
} from "@services/media/pre-upload-compressor";

export interface ProcessMediaUrlInput extends MediaUrlRequest {
  mediaCacheRoot: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  vaultId: string;
  mediaCompressionProfile: MediaCompressionProfile;
  deferCompletedCleanup?: boolean;
}

export interface TranscriptReadyPayload {
  sessionId: string;
  sourceType: MediaDownloadSession["source"]["sourceType"];
  sourceUrl: string;
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

export interface ProcessMediaUrlDependencies {
  downloaderAdapter: DownloaderAdapter;
  preUploadCompressor: PreUploadCompressor;
  artifactRetentionManager?: ArtifactRetentionManager;
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
    chunkCount: preUploadResult.chunkCount,
    chunkDurationsMs: preUploadResult.chunkDurationsMs,
    vadApplied: preUploadResult.vadApplied,
    selectedCodec: preUploadResult.selectedCodec,
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
  const artifactRetentionManager =
    dependencies.artifactRetentionManager ?? createArtifactRetentionManager();

  let session: MediaDownloadSession | null = null;
  let downloadResult: MediaDownloadResult | null = null;
  let preUploadResult: PreUploadCompressionResult | null = null;

  await runJobStep(
    "validating",
    "Validating media URL input",
    signal,
    async () => {
      validateInput(input);
    },
    hooks
  );

  try {
    session = await runJobStep(
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
    const activeSession = session;

    downloadResult = await runJobStep(
      "acquiring",
      "Downloading media artifact",
      signal,
      async () => dependencies.downloaderAdapter.downloadMedia(activeSession, signal),
      hooks
    );
    const activeDownloadResult = downloadResult;

    preUploadResult = await runJobStep(
      "transcribing",
      "Preparing AI-ready media artifacts",
      signal,
      async () =>
        dependencies.preUploadCompressor.prepareForAiUpload(
          {
            session: activeSession,
            downloadResult: activeDownloadResult,
            profile: input.mediaCompressionProfile
          },
          signal
        ),
      hooks
    );

    const cleanupWarnings = input.deferCompletedCleanup
      ? []
      : await artifactRetentionManager.cleanup({
          retentionMode: input.retentionMode,
          lifecycleStatus: "completed",
          artifacts: activeSession.artifacts,
          aiUploadArtifactPaths: preUploadResult.aiUploadArtifactPaths
        });

    const warnings = [...activeDownloadResult.warnings, ...preUploadResult.warnings, ...cleanupWarnings];
    emitWarnings(activeDownloadResult.warnings, hooks);
    emitWarnings(preUploadResult.warnings, hooks);
    emitWarnings(cleanupWarnings, hooks);
    const transcriptReadyPayload = toTranscriptReadyPayload(
      activeSession,
      activeDownloadResult,
      preUploadResult,
      warnings
    );

    return {
      session: activeSession,
      downloadResult: activeDownloadResult,
      preUploadResult,
      transcriptReadyPayload,
      warnings
    };
  } catch (error) {
    if (session) {
      const lifecycleStatus: ArtifactLifecycleStatus =
        error instanceof SummarizerError && error.category === "cancellation"
          ? "cancelled"
          : "failed";

      const cleanupWarnings = await artifactRetentionManager.cleanup({
        retentionMode: input.retentionMode,
        lifecycleStatus,
        artifacts: session.artifacts,
        aiUploadArtifactPaths: preUploadResult?.aiUploadArtifactPaths ?? []
      });
      emitWarnings(cleanupWarnings, hooks);
    }

    throw error;
  }
}
