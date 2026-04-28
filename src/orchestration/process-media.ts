import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import { DEFAULT_GEMINI_SUMMARY_MODEL } from "@domain/model-selection";
import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaSummaryResult,
  MediaTranscriptionResult,
  MediaUrlRequest,
  WriteResult
} from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { normalizeMediaSummaryResult } from "@services/ai/ai-output-normalizer";
import { summarizeMediaWithChunking } from "@services/ai/media-summary-chunking";
import type { TranscriptionProvider } from "@services/ai/transcription-provider";
import {
  createArtifactRetentionManager,
  type ArtifactLifecycleStatus
} from "@services/media/artifact-retention";

type MediaRequest = MediaUrlRequest | LocalMediaRequest;

export interface ProcessMediaDependencies {
  runtimeProvider: RuntimeProvider;
  transcriptionProvider: TranscriptionProvider;
  summaryProvider: SummaryProvider;
  noteWriter: NoteWriter;
}

export interface ProcessMediaResult {
  summary: MediaSummaryResult;
  writeResult: WriteResult;
  warnings: string[];
}

function validateMediaInput(input: MediaRequest): void {
  if (input.sourceValue.trim().length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Media source value is empty.",
      recoverable: true
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAiFailure(error: unknown): boolean {
  return error instanceof SummarizerError && error.category === "ai_failure";
}

async function persistTranscriptForRecovery(
  mediaInput: MediaProcessResult | null,
  transcription: MediaTranscriptionResult | null
): Promise<string[]> {
  const transcriptPath = mediaInput?.artifactCleanup?.transcriptPath;
  const transcriptMarkdown = transcription?.transcriptMarkdown.trim();
  if (!transcriptPath || !transcriptMarkdown) {
    return [];
  }

  try {
    await mkdir(path.dirname(transcriptPath), { recursive: true });
    await writeFile(transcriptPath, `${transcriptMarkdown}\n`, "utf8");
    return [`Recovery transcript preserved for summary retry: ${transcriptPath}`];
  } catch (error) {
    return [`Recovery transcript preservation failed for ${transcriptPath}: ${getErrorMessage(error)}`];
  }
}

export async function processMedia(
  input: MediaRequest,
  dependencies: ProcessMediaDependencies,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<ProcessMediaResult> {
  const warnings: string[] = [];
  const artifactRetentionManager = createArtifactRetentionManager();
  let mediaInput: MediaProcessResult | null = null;
  let transcriptionResult: MediaTranscriptionResult | null = null;

  await runJobStep(
    "validating",
    "Validating media input",
    signal,
    async () => {
      validateMediaInput(input);
    },
    hooks
  );

  try {
    mediaInput = await runJobStep(
      "acquiring",
      input.sourceKind === "media_url" ? "Processing media URL input" : "Processing local media input",
      signal,
      async () => {
        if (input.sourceKind === "media_url") {
          return dependencies.runtimeProvider.processMediaUrl(input, signal);
        }
        return dependencies.runtimeProvider.processLocalMedia(input, signal);
      },
      hooks
    );

    warnings.push(...mediaInput.warnings);
    emitWarnings(mediaInput.warnings, hooks);

    const transcription = await runJobStep(
      "transcribing",
      "Generating media transcript",
      signal,
      async () =>
        dependencies.transcriptionProvider.transcribeMedia(
          {
            metadata: mediaInput!.metadata,
            normalizedText: mediaInput!.normalizedText,
            transcript: mediaInput!.transcript,
            aiUploadArtifactPaths: mediaInput!.aiUploadArtifactPaths,
            transcriptionProvider: input.transcriptionProvider,
            transcriptionModel: input.transcriptionModel
          },
          signal
        ),
      hooks
    );
    transcriptionResult = transcription;

    warnings.push(...transcription.warnings);
    emitWarnings(transcription.warnings, hooks);

    const summaryRaw = await runJobStep(
      "summarizing",
      "Generating media summary",
      signal,
      async () => {
        const summaryInput = {
          metadata: mediaInput!.metadata,
          normalizedText: mediaInput!.normalizedText,
          transcript: transcription.transcript,
          summaryProvider: input.summaryProvider,
          summaryModel: input.summaryModel
        };

        try {
          return await summarizeMediaWithChunking(
            summaryInput,
            dependencies.summaryProvider,
            signal
          );
        } catch (error) {
          if (input.summaryProvider !== "openrouter" || !isAiFailure(error)) {
            throw error;
          }

          const fallbackWarning =
            `OpenRouter summary failed; retrying with Gemini summary provider. Reason: ${getErrorMessage(error)}`;
          warnings.push(fallbackWarning);
          emitWarnings([fallbackWarning], hooks);

          try {
            const fallbackSummary = await summarizeMediaWithChunking(
              {
                ...summaryInput,
                summaryProvider: "gemini",
                summaryModel: DEFAULT_GEMINI_SUMMARY_MODEL
              },
              dependencies.summaryProvider,
              signal
            );
            return {
              ...fallbackSummary,
              warnings: [
                `OpenRouter summary fallback used Gemini model ${DEFAULT_GEMINI_SUMMARY_MODEL}.`,
                ...fallbackSummary.warnings
              ]
            };
          } catch (fallbackError) {
            throw new SummarizerError({
              category: "ai_failure",
              message:
                `OpenRouter summary failed and Gemini fallback also failed. ` +
                `OpenRouter: ${getErrorMessage(error)}; ` +
                `Gemini fallback: ${getErrorMessage(fallbackError)}`,
              recoverable: true,
              cause: {
                failureKind: "summary_fallback_failed",
                originalSummaryError: getErrorMessage(error),
                fallbackSummaryError: getErrorMessage(fallbackError)
              }
            });
          }
        }
      },
      hooks
    );

    const summary = normalizeMediaSummaryResult({
      summaryMarkdown: summaryRaw.summaryMarkdown,
      transcriptMarkdown: transcription.transcriptMarkdown,
      warnings: summaryRaw.warnings
    });
    warnings.push(...summary.warnings);
    emitWarnings(summary.warnings, hooks);

    const writeResult = await runJobStep(
      "writing",
      "Writing media note into vault",
      signal,
      async () =>
        dependencies.noteWriter.writeMediaNote({
          metadata: mediaInput!.metadata,
          summaryMarkdown: summary.summaryMarkdown,
          transcriptMarkdown: summary.transcriptMarkdown
        }),
      hooks
    );

    warnings.push(...writeResult.warnings);
    emitWarnings(writeResult.warnings, hooks);

    if (mediaInput.artifactCleanup) {
      const cleanupWarnings = await artifactRetentionManager.cleanup({
        retentionMode: input.retentionMode,
        lifecycleStatus: "completed",
        artifacts: mediaInput.artifactCleanup,
        aiUploadArtifactPaths: mediaInput.artifactCleanup.aiUploadArtifactPaths
      });
      warnings.push(...cleanupWarnings);
      emitWarnings(cleanupWarnings, hooks);
    }

    return {
      summary,
      writeResult,
      warnings
    };
  } catch (error) {
    const recoveryWarnings = await persistTranscriptForRecovery(mediaInput, transcriptionResult);
    emitWarnings(recoveryWarnings, hooks);

    if (mediaInput?.artifactCleanup) {
      const lifecycleStatus: ArtifactLifecycleStatus =
        error instanceof SummarizerError && error.category === "cancellation"
          ? "cancelled"
          : "failed";
      const cleanupWarnings = await artifactRetentionManager.cleanup({
        retentionMode: input.retentionMode,
        lifecycleStatus,
        artifacts: mediaInput.artifactCleanup,
        aiUploadArtifactPaths: mediaInput.artifactCleanup.aiUploadArtifactPaths
      });
      emitWarnings(cleanupWarnings, hooks);
    }
    throw error;
  }
}
