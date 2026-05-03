import { readFile } from "node:fs/promises";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import type {
  MediaSummaryResult,
  SourceMetadata,
  TranscriptFileRequest,
  TranscriptSegment,
  WriteResult
} from "@domain/types";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";
import { normalizeMediaSummaryResult } from "@services/ai/ai-output-normalizer";
import { summarizeMediaWithChunking } from "@services/ai/media-summary-chunking";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";

export interface ProcessTranscriptFileDependencies {
  summaryProvider: SummaryProvider;
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
      message: `Invalid source kind for transcript file flow: ${input.sourceKind}`,
      recoverable: true
    });
  }

  const trimmed = input.sourceValue.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Transcript file path is empty.",
      recoverable: true
    });
  }

  if (!path.isAbsolute(trimmed)) {
    throw new SummarizerError({
      category: "validation_error",
      message: `Transcript file path must be absolute: ${trimmed}`,
      recoverable: true
    });
  }

  const extension = path.extname(trimmed).toLowerCase();
  if (extension !== ".md" && extension !== ".txt") {
    throw new SummarizerError({
      category: "validation_error",
      message: `Transcript file must be .md or .txt: ${trimmed}`,
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
    title: title.trim().length > 0 ? title : "Transcript Summary",
    creatorOrAuthor: "Unknown",
    platform: "Transcript File",
    source: transcriptPath,
    created: new Date().toISOString()
  };
}

async function readManifestMetadata(
  transcriptPath: string,
  readTextFile: (targetPath: string) => Promise<string>
): Promise<SourceMetadata | null> {
  const metadataPath = path.join(path.dirname(transcriptPath), "metadata.json");
  let rawManifest: string;
  try {
    rawManifest = await readTextFile(metadataPath);
  } catch {
    return null;
  }

  try {
    const manifest = JSON.parse(rawManifest) as ManifestMetadata;
    return {
      title: asString(manifest.title) || buildFallbackMetadata(transcriptPath).title,
      creatorOrAuthor: asString(manifest.creatorOrAuthor) || "Unknown",
      platform: asString(manifest.platform) || "Transcript File",
      source:
        asString(manifest.sourceUrl) ||
        asString(manifest.sourcePath) ||
        asString(manifest.source) ||
        transcriptPath,
      created: asString(manifest.createdAt) || new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function transcriptMarkdownToSegments(transcriptMarkdown: string): TranscriptSegment[] {
  return transcriptMarkdown
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("<!--"))
    .map((line, index) => ({
      startMs: index * 1000,
      endMs: (index + 1) * 1000,
      text: line
    }));
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
      message: `Transcript file could not be read: ${error instanceof Error ? error.message : String(error)}`,
      recoverable: true,
      cause: error
    });
  }

  const trimmedTranscript = transcriptMarkdown.trim();
  if (trimmedTranscript.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Transcript file is empty.",
      recoverable: true
    });
  }

  const manifestMetadata = await readManifestMetadata(input.transcriptPath, input.readTextFile);
  const warnings = manifestMetadata ? [] : ["Transcript retry: metadata.json was unavailable; using transcript file metadata fallback."];
  return {
    metadata: manifestMetadata ?? buildFallbackMetadata(input.transcriptPath),
    transcriptMarkdown: trimmedTranscript,
    transcript: transcriptMarkdownToSegments(trimmedTranscript),
    warnings
  };
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
    "Validating transcript file input",
    signal,
    async () => {
      validateInput(input);
    },
    hooks
  );

  const transcriptFile = await runJobStep(
    "acquiring",
    "Reading transcript file",
    signal,
    async () => readTranscriptFile({
      transcriptPath: input.sourceValue.trim(),
      readTextFile
    }),
    hooks
  );

  warnings.push(...transcriptFile.warnings);
  emitWarnings(transcriptFile.warnings, hooks);

  const summaryRaw = await runJobStep(
    "summarizing",
    "Regenerating summary from transcript",
    signal,
    async () =>
      summarizeMediaWithChunking(
        {
          metadata: transcriptFile.metadata,
          normalizedText: `Transcript file: ${input.sourceValue.trim()}`,
          transcript: transcriptFile.transcript,
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
    transcriptMarkdown: transcriptFile.transcriptMarkdown,
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
