import type {
  MediaSummaryDraft,
  MediaSummaryInput,
  TranscriptSegment
} from "@domain/types";
import type { SummaryProvider } from "@services/ai/ai-provider";

export interface MediaSummaryChunkingOptions {
  maxChunkCharacters?: number;
  maxNormalizedTextCharacters?: number;
  maxNormalizedTextCharactersPerChunk?: number;
}

interface TextLimitResult {
  value: string;
  warning: string | null;
}

const DEFAULT_MAX_CHUNK_CHARACTERS = 6000;
const DEFAULT_MAX_NORMALIZED_TEXT_CHARACTERS = 6000;
const DEFAULT_MAX_NORMALIZED_TEXT_CHARACTERS_PER_CHUNK = 2000;
const INTERNAL_PROCESSING_MARKER_LINE =
  /^\s*(?:#{1,6}\s*)?(?:[-*]\s*)?(?:chunk|part|分段)\s*\d+\s*[:：-]?\s*$/iu;
const INTERNAL_PROCESSING_MARKER_PREFIX =
  /^\s*(?:#{1,6}\s*)?(?:[-*]\s*)?(?:chunk|part|分段)\s*\d+\s*[:：-]\s*/iu;

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function limitText(text: string, maxCharacters: number, label: string): TextLimitResult {
  if (text.length <= maxCharacters) {
    return {
      value: text,
      warning: null
    };
  }

  return {
    value: text.slice(0, maxCharacters),
    warning: `Token control applied: truncated ${label} from ${text.length} to ${maxCharacters} characters.`
  };
}

function pushChunk(chunks: TranscriptSegment[][], current: TranscriptSegment[]): TranscriptSegment[] {
  if (current.length > 0) {
    chunks.push(current);
  }
  return [];
}

function splitSegmentByCharacterLimit(
  segment: TranscriptSegment,
  maxChunkCharacters: number
): TranscriptSegment[] {
  if (segment.text.length <= maxChunkCharacters) {
    return [segment];
  }

  const splitSegments: TranscriptSegment[] = [];
  let cursor = 0;
  while (cursor < segment.text.length) {
    const nextCursor = Math.min(cursor + maxChunkCharacters, segment.text.length);
    splitSegments.push({
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text.slice(cursor, nextCursor)
    });
    cursor = nextCursor;
  }

  return splitSegments;
}

function chunkTranscript(
  transcript: TranscriptSegment[],
  maxChunkCharacters: number
): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let currentChunk: TranscriptSegment[] = [];
  let currentCharacters = 0;

  for (const rawSegment of transcript) {
    const text = rawSegment.text.trim();
    if (text.length === 0) {
      continue;
    }

    const normalizedSegment: TranscriptSegment = {
      startMs: rawSegment.startMs,
      endMs: rawSegment.endMs,
      text
    };
    const splitSegments = splitSegmentByCharacterLimit(normalizedSegment, maxChunkCharacters);

    for (const segment of splitSegments) {
      const segmentCharacters = segment.text.length;
      if (currentCharacters + segmentCharacters > maxChunkCharacters && currentChunk.length > 0) {
        currentChunk = pushChunk(chunks, currentChunk);
        currentCharacters = 0;
      }

      currentChunk.push(segment);
      currentCharacters += segmentCharacters;
    }
  }

  pushChunk(chunks, currentChunk);

  return chunks;
}

function removeInternalProcessingMarkers(summaryMarkdown: string): string {
  return summaryMarkdown
    .split(/\r?\n/g)
    .filter((line) => !INTERNAL_PROCESSING_MARKER_LINE.test(line))
    .map((line) => line.replace(INTERNAL_PROCESSING_MARKER_PREFIX, "").trimEnd())
    .join("\n")
    .trim();
}

function buildFinalSynthesisMaterial(partialSummaries: string[]): string {
  return [
    "以下為長媒體內部整理素材，請重新統整為單一最終摘要；不要保留素材編號、處理流程描述或中間整理痕跡。",
    "",
    ...partialSummaries.flatMap((summary, index) => [
      `### 摘要素材 ${index + 1}`,
      "",
      removeInternalProcessingMarkers(summary)
    ])
  ].join("\n").trim();
}

export async function summarizeMediaWithChunking(
  input: MediaSummaryInput,
  summaryProvider: SummaryProvider,
  signal: AbortSignal,
  options: MediaSummaryChunkingOptions = {}
): Promise<MediaSummaryDraft> {
  const maxChunkCharacters = clampPositiveInteger(
    options.maxChunkCharacters,
    DEFAULT_MAX_CHUNK_CHARACTERS
  );
  const maxNormalizedTextCharacters = clampPositiveInteger(
    options.maxNormalizedTextCharacters,
    DEFAULT_MAX_NORMALIZED_TEXT_CHARACTERS
  );
  const maxNormalizedTextCharactersPerChunk = clampPositiveInteger(
    options.maxNormalizedTextCharactersPerChunk,
    DEFAULT_MAX_NORMALIZED_TEXT_CHARACTERS_PER_CHUNK
  );

  const chunks = chunkTranscript(input.transcript, maxChunkCharacters);
  if (chunks.length <= 1) {
    const normalizedTextLimit = limitText(
      input.normalizedText,
      maxNormalizedTextCharacters,
      "normalized text"
    );
    const summary = await summaryProvider.summarizeMedia(
      {
        metadata: input.metadata,
        normalizedText: normalizedTextLimit.value,
        transcript: chunks[0] ?? [],
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel
      },
      signal
    );

    const warnings = normalizedTextLimit.warning
      ? [...summary.warnings, normalizedTextLimit.warning]
      : summary.warnings;

    return {
      ...summary,
      warnings
    };
  }

  const firstChunkNormalizedText = limitText(
    input.normalizedText,
    maxNormalizedTextCharactersPerChunk,
    "normalized text in chunk mode"
  );

  const chunkSummaries: MediaSummaryDraft[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const summary = await summaryProvider.summarizeMedia(
      {
        metadata: input.metadata,
        normalizedText: index === 0 ? firstChunkNormalizedText.value : "",
        transcript: chunk,
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel
      },
      signal
    );
    chunkSummaries.push(summary);
  }

  const finalSynthesisMaterial = buildFinalSynthesisMaterial(
    chunkSummaries.map((entry) => entry.summaryMarkdown)
  );
  const finalSummary = await summaryProvider.summarizeMedia(
    {
      metadata: input.metadata,
      normalizedText: finalSynthesisMaterial,
      transcript: [],
      summaryProvider: input.summaryProvider,
      summaryModel: input.summaryModel
    },
    signal
  );
  const warnings: string[] = [
    `Chunked media summary into ${chunks.length} chunks with max ${maxChunkCharacters} characters per chunk.`,
    `Final synthesis generated from ${chunks.length} internal partial summaries.`,
    ...chunkSummaries.flatMap((entry) => entry.warnings),
    ...finalSummary.warnings
  ];
  if (firstChunkNormalizedText.warning) {
    warnings.push(firstChunkNormalizedText.warning);
  }

  return {
    summaryMarkdown: finalSummary.summaryMarkdown,
    warnings
  };
}
