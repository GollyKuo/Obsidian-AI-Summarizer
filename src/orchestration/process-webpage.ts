import { SummarizerError } from "@domain/errors";
import type { WriteResult, WebpageRequest, WebpageSummaryResult } from "@domain/types";
import type { AiProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import type { MetadataExtractor } from "@services/web/metadata-extractor";
import type { WebpageExtractor } from "@services/web/webpage-extractor";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";

export interface ProcessWebpageDependencies {
  webpageExtractor: WebpageExtractor;
  metadataExtractor: MetadataExtractor;
  aiProvider: AiProvider;
  noteWriter: NoteWriter;
}

export interface ProcessWebpageResult {
  summary: WebpageSummaryResult;
  writeResult: WriteResult;
  warnings: string[];
}

function validateWebpageInput(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new SummarizerError({
      category: "validation_error",
      message: `Invalid webpage URL: ${url}`,
      recoverable: true
    });
  }
}

export async function processWebpage(
  input: WebpageRequest,
  dependencies: ProcessWebpageDependencies,
  signal: AbortSignal,
  hooks?: JobRunHooks
): Promise<ProcessWebpageResult> {
  const warnings: string[] = [];

  await runJobStep(
    "validating",
    "Validating webpage input",
    signal,
    async () => {
      validateWebpageInput(input.sourceValue);
    },
    hooks
  );

  const webpageText = await runJobStep(
    "acquiring",
    "Extracting webpage content",
    signal,
    async () => dependencies.webpageExtractor.extractReadableText(input.sourceValue, signal),
    hooks
  );

  const metadata = dependencies.metadataExtractor.fromWebpage(input.sourceValue, webpageText);

  const summary = await runJobStep(
    "summarizing",
    "Generating webpage summary",
    signal,
    async () =>
      dependencies.aiProvider.summarizeWebpage(
        {
          metadata,
          webpageText
        },
        signal
      ),
    hooks
  );

  warnings.push(...summary.warnings);
  emitWarnings(summary.warnings, hooks);

  const writeResult = await runJobStep(
    "writing",
    "Writing note into vault",
    signal,
    async () =>
      dependencies.noteWriter.writeWebpageNote({
        metadata,
        summaryMarkdown: summary.summaryMarkdown
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
