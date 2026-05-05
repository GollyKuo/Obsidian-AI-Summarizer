import { readFile } from "node:fs/promises";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import type {
  MediaSummaryResult,
  MediaTranscriptionResult,
  SourceMetadata,
  TranscriptFileRequest,
  TranscriptSegment,
  WriteResult
} from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import {
  normalizeMediaSummaryResult,
  normalizeMediaTranscriptionResult
} from "@services/ai/ai-output-normalizer";
import { summarizeMediaWithChunking } from "@services/ai/media-summary-chunking";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { TranscriptCleanupProvider } from "@services/ai/ai-provider";
import { readArtifactManifest } from "@services/media/artifact-manifest";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { normalizeToTraditionalChinese } from "@services/text/traditional-chinese";

export interface ProcessTranscriptFileDependencies {
  summaryProvider: SummaryProvider;
  transcriptCleanupProvider?: TranscriptCleanupProvider;
  noteWriter: NoteWriter;
  readTextFile?: (targetPath: string) => Promise<string>;
}

export interface ProcessTranscriptFileResult {
  summary: MediaSummaryResult;
  writeResult: WriteResult;
  warnings: string[];
}

interface ManifestMetadata {
  title?: unknown;
  creatorOrAuthor?: unknown;
  platform?: unknown;
  sourceUrl?: unknown;
  sourcePath?: unknown;
  source?: unknown;
  createdAt?: unknown;
}

function validateInput(input: TranscriptFileRequest): void {
  if (input.sourceKind !== "transcript_file") {
    throw new SummarizerError({
      category: "validation_error",
      message: `Invalid source kind for text file flow: ${input.sourceKind}`,
      recoverable: true
    });
  }

  const trimmed = input.sourceValue.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Text file path is empty.",
      recoverable: true
    });
  }

  if (!path.isAbsolute(trimmed)) {
    throw new SummarizerError({
      category: "validation_error",
      message: `Text file path must be absolute: ${trimmed}`,
      recoverable: true
    });
  }

  const extension = path.extname(trimmed).toLowerCase();
  if (extension !== ".md" && extension !== ".txt") {
    throw new SummarizerError({
      category: "validation_error",
      message: `Text file must be .md or .txt: ${trimmed}`,
      recoverable: true
    });
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildFallbackMetadata(transcriptPath: string): SourceMetadata {
  const title = path.basename(transcriptPath, path.extname(transcriptPath));
  return {
    title: title.trim().length > 0 ? title : "Text File Summary",
    creatorOrAuthor: "Unknown",
    platform: "Text File",
    source: transcriptPath,
    created: new Date().toISOString()
  };
}

async function readManifestMetadata(
  transcriptPath: string,
  readTextFile: (targetPath: string) => Promise<string>
): Promise<{ metadata: SourceMetadata | null; warning: string | null }> {
  const metadataPath = path.join(path.dirname(transcriptPath), "metadata.json");
  const manifestResult = await readArtifactManifest(metadataPath, readTextFile);
  if (!manifestResult.ok) {
    return {
      metadata: null,
      warning: `Text file summary: ${manifestResult.warning} Using text file metadata fallback.`
    };
  }

  const manifest = manifestResult.manifest as ManifestMetadata;
  return {
    metadata: {
      title: asString(manifest.title) || buildFallbackMetadata(transcriptPath).title,
      creatorOrAuthor: asString(manifest.creatorOrAuthor) || "Unknown",
      platform: asString(manifest.platform) || "Text File",
      source:
        asString(manifest.sourceUrl) ||
        asString(manifest.sourcePath) ||
        asString(manifest.source) ||
        transcriptPath,
      created: asString(manifest.createdAt) || new Date().toISOString()
    },
    warning: null
  };
}

const EXPLICIT_TIMING_MARKER =
  /^\s*[\[{](?<start>(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+h\d+m\d+s|\d+m\d+s|\d+(?:\.\d+)?s)(?:\s*[-–]\s*(?<end>(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+h\d+m\d+s|\d+m\d+s|\d+(?:\.\d+)?s))?[\]}]/i;

function parseTimingMarkerMs(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const hmsMatch = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(normalized);
  if (hmsMatch) {
    const hours = hmsMatch[1] ? Number.parseInt(hmsMatch[1], 10) : 0;
    const minutes = Number.parseInt(hmsMatch[2], 10);
    const seconds = Number.parseInt(hmsMatch[3], 10);
    return ((hours * 60 + minutes) * 60 + seconds) * 1000;
  }

  const unitMatch = /^(?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s$/.exec(normalized);
  if (unitMatch) {
    const hours = unitMatch[1] ? Number.parseInt(unitMatch[1], 10) : 0;
    const minutes = unitMatch[2] ? Number.parseInt(unitMatch[2], 10) : 0;
    const seconds = Number.parseFloat(unitMatch[3]);
    return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
  }

  return null;
}

function transcriptMarkdownToSegments(transcriptMarkdown: string): TranscriptSegment[] {
  let syntheticIndex = 0;
  return transcriptMarkdown
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("<!--"))
    .map((line) => {
      const marker = EXPLICIT_TIMING_MARKER.exec(line);
      const explicitStartMs = marker?.groups?.start ? parseTimingMarkerMs(marker.groups.start) : null;
      if (explicitStartMs !== null) {
        const explicitEndMs = marker?.groups?.end ? parseTimingMarkerMs(marker.groups.end) : null;
        return {
          startMs: explicitStartMs,
          endMs: explicitEndMs !== null && explicitEndMs > explicitStartMs
            ? explicitEndMs
            : explicitStartMs + 1000,
          text: line,
          timingSource: "explicit" as const
        };
      }

      const startMs = syntheticIndex * 1000;
      syntheticIndex += 1;
      return {
        startMs,
        endMs: startMs + 1000,
        text: line,
        timingSource: "synthetic" as const
      };
    });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertUsableCleanedTranscript(transcription: MediaTranscriptionResult): void {
  if (transcription.transcriptMarkdown.trim().length === 0 || transcription.transcript.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Transcript cleanup output was empty or did not preserve transcript timing markers.",
      recoverable: true
    });
  }
}

async function readTranscriptFile(input: {
  transcriptPath: string;
  readTextFile: (targetPath: string) => Promise<string>;
}): Promise<{
  metadata: SourceMetadata;
  transcriptMarkdown: string;
  transcript: TranscriptSegment[];
  warnings: string[];
}> {
  let transcriptMarkdown: string;
  try {
    transcriptMarkdown = await input.readTextFile(input.transcriptPath);
  } catch (error) {
    throw new SummarizerError({
      category: "validation_error",
      message: `Text file could not be read: ${error instanceof Error ? error.message : String(error)}`,
      recoverable: true,
      cause: error
    });
  }

  const transcriptLanguageResult = normalizeToTraditionalChinese(transcriptMarkdown.trim());
  const trimmedTranscript = transcriptLanguageResult.value;
  if (trimmedTranscript.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Text file is empty.",
      recoverable: true
    });
  }

  const manifestMetadata = await readManifestMetadata(input.transcriptPath, input.readTextFile);
  const warnings = manifestMetadata.warning ? [manifestMetadata.warning] : [];
  if (transcriptLanguageResult.changed) {
    warnings.push("Text file summary: converted text file content to Traditional Chinese.");
  }
  return {
    metadata: manifestMetadata.metadata ?? buildFallbackMetadata(input.transcriptPath),
    transcriptMarkdown: trimmedTranscript,
    transcript: transcriptMarkdownToSegments(trimmedTranscript),
    warnings
  };
}

async function maybeCleanupTranscriptFile(input: {
  request: TranscriptFileRequest;
  dependencies: ProcessTranscriptFileDependencies;
  transcriptFile: Awaited<ReturnType<typeof readTranscriptFile>>;
  signal: AbortSignal;
  hooks?: JobRunHooks;
}): Promise<{
  transcriptMarkdown: string;
  transcript: TranscriptSegment[];
  warnings: string[];
}> {
  if (input.request.enableTranscriptCleanup !== true) {
    return {
      transcriptMarkdown: input.transcriptFile.transcriptMarkdown,
      transcript: input.transcriptFile.transcript,
      warnings: []
    };
  }

  const provider = input.dependencies.transcriptCleanupProvider;
  if (!provider) {
    return {
      transcriptMarkdown: input.transcriptFile.transcriptMarkdown,
      transcript: input.transcriptFile.transcript,
      warnings: ["Transcript cleanup skipped: cleanup provider is unavailable."]
    };
  }

  try {
    const cleanedRaw = await runJobStep(
      "cleaning",
      "Cleaning transcript before summary",
      input.signal,
      async () =>
        provider.cleanupTranscript(
          {
            metadata: input.transcriptFile.metadata,
            transcript: input.transcriptFile.transcript,
            transcriptMarkdown: input.transcriptFile.transcriptMarkdown,
            cleanupProvider: input.request.summaryProvider,
            cleanupModel: input.request.summaryModel
          },
          input.signal
        ),
      input.hooks
    );
    const cleanedTranscription = normalizeMediaTranscriptionResult(cleanedRaw);
    assertUsableCleanedTranscript(cleanedTranscription);
    return {
      transcriptMarkdown: cleanedTranscription.transcriptMarkdown,
      transcript: cleanedTranscription.transcript,
      warnings: ["Transcript cleanup applied before summary.", ...cleanedTranscription.warnings]
    };
  } catch (error) {
    if (error instanceof SummarizerError && error.category === "cancellation") {
      throw error;
    }
    if (input.request.transcriptCleanupFailureMode === "fail") {
      throw error;
    }

    return {
      transcriptMarkdown: input.transcriptFile.transcriptMarkdown,
      transcript: input.transcriptFile.transcript,
      warnings: [`Transcript cleanup failed; using original transcript: ${getErrorMessage(error)}`]
    };
  }
}

export async function processTranscriptFile(
  input: TranscriptFileRequest,
  dependencies: ProcessTranscriptFileDependencies,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<ProcessTranscriptFileResult> {
  const warnings: string[] = [];
  const readTextFile = dependencies.readTextFile ?? ((targetPath: string) => readFile(targetPath, "utf8"));

  await runJobStep(
    "validating",
    "Validating text file input",
    signal,
    async () => {
      validateInput(input);
    },
    hooks
  );

  const transcriptFile = await runJobStep(
    "acquiring",
    "Reading text file",
    signal,
    async () => readTranscriptFile({
      transcriptPath: input.sourceValue.trim(),
      readTextFile
    }),
    hooks
  );

  warnings.push(...transcriptFile.warnings);
  emitWarnings(transcriptFile.warnings, hooks);

  const cleanupResult = await maybeCleanupTranscriptFile({
    request: input,
    dependencies,
    transcriptFile,
    signal,
    hooks
  });
  warnings.push(...cleanupResult.warnings);
  emitWarnings(cleanupResult.warnings, hooks);

  const summaryRaw = await runJobStep(
    "summarizing",
    "Generating summary from text file",
    signal,
    async () =>
      summarizeMediaWithChunking(
        {
          metadata: transcriptFile.metadata,
          normalizedText: `Text file: ${input.sourceValue.trim()}`,
          transcript: cleanupResult.transcript,
          summaryProvider: input.summaryProvider,
          summaryModel: input.summaryModel
        },
        dependencies.summaryProvider,
        signal
      ),
    hooks
  );

  const summary = normalizeMediaSummaryResult({
    summaryMarkdown: summaryRaw.summaryMarkdown,
    transcriptMarkdown: cleanupResult.transcriptMarkdown,
    warnings: summaryRaw.warnings
  });
  warnings.push(...summary.warnings);
  emitWarnings(summary.warnings, hooks);

  const writeResult = await runJobStep(
    "writing",
    "Writing regenerated summary note into vault",
    signal,
    async () =>
      dependencies.noteWriter.writeMediaNote({
        metadata: transcriptFile.metadata,
        summaryMetadata: summary.summaryMetadata,
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
