import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaSummaryResult,
  MediaTranscriptionResult,
  TranscriptSegment,
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
import { updateArtifactManifestWithTranscriptArtifacts } from "@services/media/artifact-manifest";

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

function formatSrtTimestamp(ms: number): string {
  const normalizedMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(normalizedMs / 3_600_000);
  const minutes = Math.floor((normalizedMs % 3_600_000) / 60_000);
  const seconds = Math.floor((normalizedMs % 60_000) / 1_000);
  const milliseconds = normalizedMs % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function stripTranscriptTimingMarkup(text: string): string {
  return text
    .split(/\r?\n/g)
    .map((line) => line.replace(/^\s*\{[^}]+\}\s*/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function segmentsToSrt(transcript: TranscriptSegment[], transcriptMarkdown: string): string {
  const segments = transcript.length > 0
    ? transcript
    : [{ startMs: 0, endMs: 1000, text: transcriptMarkdown }];

  const cues = segments.map((segment, index) => {
    const hasUsableTiming = Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs;
    const startMs = hasUsableTiming ? segment.startMs : index * 1000;
    const rawEndMs = Number.isFinite(segment.endMs) ? segment.endMs : startMs + 1000;
    const endMs = hasUsableTiming && rawEndMs > startMs ? rawEndMs : startMs + 1000;
    const text = stripTranscriptTimingMarkup(segment.text) || stripTranscriptTimingMarkup(transcriptMarkdown);

    return [
      String(index + 1),
      `${formatSrtTimestamp(startMs)} --> ${formatSrtTimestamp(endMs)}`,
      text
    ].join("\n");
  });

  return `${cues.join("\n\n")}\n`;
}

async function writeTranscriptArtifacts(
  mediaInput: MediaProcessResult,
  transcription: MediaTranscriptionResult
): Promise<void> {
  const artifactCleanup = mediaInput.artifactCleanup;
  if (!artifactCleanup) {
    return;
  }

  try {
    await mkdir(path.dirname(artifactCleanup.transcriptPath), { recursive: true });
    await writeFile(artifactCleanup.transcriptPath, `${transcription.transcriptMarkdown.trim()}\n`, "utf8");
    await writeFile(
      artifactCleanup.subtitlePath,
      segmentsToSrt(transcription.transcript, transcription.transcriptMarkdown),
      "utf8"
    );
    await updateArtifactManifestWithTranscriptArtifacts(
      artifactCleanup.metadataPath,
      {
        transcriptPath: artifactCleanup.transcriptPath,
        subtitlePath: artifactCleanup.subtitlePath
      }
    );
  } catch (error) {
    throw new SummarizerError({
      category: "note_write_failure",
      message: `Transcript artifact handoff failed: ${getErrorMessage(error)}`,
      recoverable: true,
      cause: error
    });
  }
}

function getPartialTranscriptMarkdown(error: unknown): string | null {
  if (!(error instanceof SummarizerError)) {
    return null;
  }

  const cause = error.causeValue;
  if (typeof cause !== "object" || cause === null) {
    return null;
  }

  const partialTranscriptMarkdown = (cause as { partialTranscriptMarkdown?: unknown }).partialTranscriptMarkdown;
  return typeof partialTranscriptMarkdown === "string" && partialTranscriptMarkdown.trim().length > 0
    ? partialTranscriptMarkdown
    : null;
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

async function persistPartialTranscriptForRecovery(
  mediaInput: MediaProcessResult | null,
  error: unknown
): Promise<string[]> {
  const transcriptPath = mediaInput?.artifactCleanup?.transcriptPath;
  const partialTranscriptMarkdown = getPartialTranscriptMarkdown(error);
  if (!transcriptPath || !partialTranscriptMarkdown) {
    return [];
  }

  try {
    await mkdir(path.dirname(transcriptPath), { recursive: true });
    await writeFile(transcriptPath, `${partialTranscriptMarkdown.trim()}\n`, "utf8");
    return [`Partial transcript preserved for transcription retry: ${transcriptPath}`];
  } catch (writeError) {
    return [`Partial transcript preservation failed for ${transcriptPath}: ${getErrorMessage(writeError)}`];
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

    await writeTranscriptArtifacts(mediaInput, transcription);

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

        return summarizeMediaWithChunking(
          summaryInput,
          dependencies.summaryProvider,
          signal
        );
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
          summaryMetadata: summary.summaryMetadata,
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
    const recoveryWarnings = transcriptionResult
      ? await persistTranscriptForRecovery(mediaInput, transcriptionResult)
      : await persistPartialTranscriptForRecovery(mediaInput, error);
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
