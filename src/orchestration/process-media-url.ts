import { SummarizerError } from "@domain/errors";
import type { MediaCompressionProfile } from "@domain/settings";
import type { MediaUrlRequest, SourceMetadata } from "@domain/types";
import type { JobRunHooks } from "@orchestration/job-runner";
import { runMediaSessionPipeline } from "@orchestration/media-session-pipeline";
import type {
  DownloaderAdapter,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import type { ArtifactRetentionManager } from "@services/media/artifact-retention";
import type {
  PreUploadCompressionResult,
  PreUploadCompressor
} from "@services/media/pre-upload-compressor";

export interface ProcessMediaUrlInput extends MediaUrlRequest {
  mediaCacheRoot: string;
  ytDlpPath?: string;
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
  subtitlePath: string;
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
    subtitlePath: session.artifacts.subtitlePath,
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
  const result = await runMediaSessionPipeline(
    {
      acquireArtifact: (session, activeSignal) =>
        dependencies.downloaderAdapter.downloadMedia(session, activeSignal),
      acquireStageMessage: "Downloading media artifact",
      artifactRetentionManager: dependencies.artifactRetentionManager,
      buildPayload: toTranscriptReadyPayload,
      deferCompletedCleanup: input.deferCompletedCleanup,
      geminiTranscriptionStrategy: input.geminiTranscriptionStrategy,
      mediaCompressionProfile: input.mediaCompressionProfile,
      prepareSession: (activeSignal) =>
        dependencies.downloaderAdapter.prepareSession(
          {
            sourceUrl: input.sourceValue,
            mediaCacheRoot: input.mediaCacheRoot,
            vaultId: input.vaultId
          },
          activeSignal
        ),
      prepareStageMessage: "Preparing media acquisition session",
      preUploadCompressor: dependencies.preUploadCompressor,
      retentionMode: input.retentionMode,
      transcriptionProvider: input.transcriptionProvider,
      validate: () => {
        validateInput(input);
      },
      validateStageMessage: "Validating media URL input"
    },
    signal,
    hooks
  );

  return {
    session: result.session,
    downloadResult: result.acquireResult,
    preUploadResult: result.preUploadResult,
    transcriptReadyPayload: result.transcriptReadyPayload,
    warnings: result.warnings
  };
}
