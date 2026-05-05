import { SummarizerError } from "@domain/errors";
import type { MediaCompressionProfile } from "@domain/settings";
import type { RetentionMode } from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import {
  createArtifactRetentionManager,
  type ArtifactLifecycleStatus,
  type ArtifactRetentionManager
} from "@services/media/artifact-retention";
import type {
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import type {
  PreUploadCompressionRequest,
  PreUploadCompressionResult,
  PreUploadCompressor
} from "@services/media/pre-upload-compressor";

interface MediaSessionPipelineInput<
  TSession extends MediaDownloadSession,
  TAcquireResult extends MediaDownloadResult,
  TPayload
> {
  acquireArtifact: (session: TSession, signal: AbortSignal) => Promise<TAcquireResult>;
  acquireStageMessage: string;
  artifactRetentionManager?: ArtifactRetentionManager;
  buildPayload: (
    session: TSession,
    acquireResult: TAcquireResult,
    preUploadResult: PreUploadCompressionResult,
    warnings: string[]
  ) => TPayload;
  deferCompletedCleanup?: boolean;
  mediaCompressionProfile: MediaCompressionProfile;
  prepareSession: (signal: AbortSignal) => Promise<TSession>;
  prepareStageMessage: string;
  preUploadCompressor: PreUploadCompressor;
  retentionMode: RetentionMode;
  transcriptionProvider: string;
  geminiTranscriptionStrategy?: string;
  validate: () => void;
  validateStageMessage: string;
}

export interface MediaSessionPipelineResult<
  TSession extends MediaDownloadSession,
  TAcquireResult extends MediaDownloadResult,
  TPayload
> {
  acquireResult: TAcquireResult;
  preUploadResult: PreUploadCompressionResult;
  session: TSession;
  transcriptReadyPayload: TPayload;
  warnings: string[];
}

function getAiUploadArtifactMode(
  input: Pick<
    MediaSessionPipelineInput<MediaDownloadSession, MediaDownloadResult, unknown>,
    "transcriptionProvider" | "geminiTranscriptionStrategy"
  >
): NonNullable<PreUploadCompressionRequest["artifactMode"]> {
  return input.transcriptionProvider === "gemini" && input.geminiTranscriptionStrategy !== "inline_chunks"
    ? "single_artifact"
    : "auto_chunks";
}

export async function runMediaSessionPipeline<
  TSession extends MediaDownloadSession,
  TAcquireResult extends MediaDownloadResult,
  TPayload
>(
  input: MediaSessionPipelineInput<TSession, TAcquireResult, TPayload>,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<MediaSessionPipelineResult<TSession, TAcquireResult, TPayload>> {
  const artifactRetentionManager =
    input.artifactRetentionManager ?? createArtifactRetentionManager();

  let session: TSession | null = null;
  let preUploadResult: PreUploadCompressionResult | null = null;

  await runJobStep(
    "validating",
    input.validateStageMessage,
    signal,
    async () => {
      input.validate();
    },
    hooks
  );

  try {
    session = await runJobStep(
      "acquiring",
      input.prepareStageMessage,
      signal,
      () => input.prepareSession(signal),
      hooks
    );
    const activeSession = session;

    const acquireResult = await runJobStep(
      "acquiring",
      input.acquireStageMessage,
      signal,
      () => input.acquireArtifact(activeSession, signal),
      hooks
    );

    preUploadResult = await runJobStep(
      "transcribing",
      "Preparing AI-ready media artifacts",
      signal,
      () =>
        input.preUploadCompressor.prepareForAiUpload(
          {
            session: activeSession,
            downloadResult: acquireResult,
            profile: input.mediaCompressionProfile,
            artifactMode: getAiUploadArtifactMode(input)
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

    const warnings = [...acquireResult.warnings, ...preUploadResult.warnings, ...cleanupWarnings];
    emitWarnings(acquireResult.warnings, hooks);
    emitWarnings(preUploadResult.warnings, hooks);
    emitWarnings(cleanupWarnings, hooks);

    return {
      session: activeSession,
      acquireResult,
      preUploadResult,
      transcriptReadyPayload: input.buildPayload(
        activeSession,
        acquireResult,
        preUploadResult,
        warnings
      ),
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
