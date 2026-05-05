import { SummarizerError } from "@domain/errors";
import type { WriteResult, WebpageRequest, WebpageSummaryResult } from "@domain/types";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import { normalizeWebpageSummaryResult } from "@services/ai/ai-output-normalizer";
import { applyWebpageMetadataPolicy } from "@services/web/webpage-metadata-policy";
import type { MetadataExtractor } from "@services/web/metadata-extractor";
import type {
  WebpageExtractionResult,
  WebpageExtractor
} from "@services/web/webpage-extractor";
import { emitWarnings, runJobStep, type JobRunHooks } from "@orchestration/job-runner";

export interface ProcessWebpageDependencies {
  webpageExtractor: WebpageExtractor;
  metadataExtractor: MetadataExtractor;
  summaryProvider: SummaryProvider;
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

function normalizeWebpageExtractionResult(
  result: string | WebpageExtractionResult
): WebpageExtractionResult {
  return typeof result === "string"
    ? {
        readableText: result,
        metadata: {},
        warnings: []
      }
    : result;
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

  const webpageExtraction = await runJobStep(
    "acquiring",
    "Extracting webpage content",
    signal,
    async () =>
      normalizeWebpageExtractionResult(
        await dependencies.webpageExtractor.extractReadableText(input.sourceValue, signal)
      ),
    hooks
  );

  warnings.push(...webpageExtraction.warnings);
  emitWarnings(webpageExtraction.warnings, hooks);

  const webpageText = webpageExtraction.readableText;
  const extractedMetadata = dependencies.metadataExtractor.fromWebpage(
    input.sourceValue,
    webpageText,
    webpageExtraction.metadata
  );
  const metadataPolicyResult = applyWebpageMetadataPolicy(input.sourceValue, extractedMetadata);
  const metadata = metadataPolicyResult.metadata;
  warnings.push(...metadataPolicyResult.warnings);
  emitWarnings(metadataPolicyResult.warnings, hooks);

  const summaryRaw = await runJobStep(
    "summarizing",
    "Generating webpage summary",
    signal,
    async () =>
      dependencies.summaryProvider.summarizeWebpage(
        {
          metadata,
          webpageText,
          summaryProvider: input.summaryProvider,
          summaryModel: input.summaryModel
        },
        signal
      ),
    hooks
  );

  const summary = normalizeWebpageSummaryResult(summaryRaw);
  warnings.push(...summary.warnings);
  emitWarnings(summary.warnings, hooks);

  const writeResult = await runJobStep(
    "writing",
    "Writing note into vault",
    signal,
    async () =>
      dependencies.noteWriter.writeWebpageNote({
        metadata,
        summaryMetadata: summary.summaryMetadata,
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
