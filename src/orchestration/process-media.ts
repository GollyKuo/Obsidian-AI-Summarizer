import { SummarizerError } from "@domain/errors";
import type {
  LocalMediaRequest,
  MediaSummaryResult,
  MediaUrlRequest,
  WriteResult
} from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import type { AiProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { summarizeMediaWithChunking } from "@services/ai/media-summary-chunking";

type MediaRequest = MediaUrlRequest | LocalMediaRequest;

export interface ProcessMediaDependencies {
  runtimeProvider: RuntimeProvider;
  aiProvider: AiProvider;
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

export async function processMedia(
  input: MediaRequest,
  dependencies: ProcessMediaDependencies,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<ProcessMediaResult> {
  const warnings: string[] = [];

  await runJobStep(
    "validating",
    "Validating media input",
    signal,
    async () => {
      validateMediaInput(input);
    },
    hooks
  );

  const mediaInput = await runJobStep(
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

  const summary = await runJobStep(
    "summarizing",
    "Generating media summary",
    signal,
    async () =>
      summarizeMediaWithChunking(
        {
          metadata: mediaInput.metadata,
          normalizedText: mediaInput.normalizedText,
          transcript: mediaInput.transcript
        },
        dependencies.aiProvider,
        signal
      ),
    hooks
  );

  warnings.push(...summary.warnings);
  emitWarnings(summary.warnings, hooks);

  const writeResult = await runJobStep(
    "writing",
    "Writing media note into vault",
    signal,
    async () =>
      dependencies.noteWriter.writeMediaNote({
        metadata: mediaInput.metadata,
        summaryMarkdown: summary.summaryMarkdown,
        transcriptMarkdown: summary.transcriptMarkdown
      }),
    hooks
  );

  warnings.push(...writeResult.warnings);
  emitWarnings(writeResult.warnings, hooks);

  return {
    summary,
    writeResult,
    warnings
  };
}
