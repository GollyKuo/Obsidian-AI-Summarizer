import type {
  MediaSummaryResult,
  MediaTranscriptionResult,
  SummaryMetadata,
  TranscriptSegment,
  WebpageSummaryResult
} from "@domain/types";
import { normalizeToTraditionalChinese } from "@services/text/traditional-chinese";

interface MarkdownNormalizationResult {
  markdown: string;
  summaryMetadata: SummaryMetadata;
  warnings: string[];
}

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function trimMarkdown(value: string): string {
  return value.trim();
}

function removeEmoji(value: string): { value: string; removed: boolean } {
  const replaced = value.replace(EMOJI_PATTERN, "");
  return {
    value: replaced,
    removed: replaced !== value
  };
}

function emptySummaryMetadata(): SummaryMetadata {
  return {
    book: "",
    author: "",
    description: ""
  };
}

function unquoteMetadataValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function extractSummaryMetadata(markdown: string): {
  markdown: string;
  summaryMetadata: SummaryMetadata;
  extracted: boolean;
} {
  const normalized = normalizeLineEndings(markdown).trimStart();
  const metadata = emptySummaryMetadata();

  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!frontmatterMatch) {
    return {
      markdown,
      summaryMetadata: metadata,
      extracted: false
    };
  }

  const [, rawBlock = "", body = ""] = frontmatterMatch;
  let recognizedFieldCount = 0;

  for (const rawLine of rawBlock.split("\n")) {
    const match = rawLine.match(/^\s*(Book|Author|Description)\s*:\s*(.*)\s*$/i);
    if (!match) {
      continue;
    }

    recognizedFieldCount += 1;
    const key = match[1].toLowerCase();
    const value = unquoteMetadataValue(match[2] ?? "");
    if (key === "book") {
      metadata.book = value;
    } else if (key === "author") {
      metadata.author = value;
    } else if (key === "description") {
      metadata.description = value;
    }
  }

  if (recognizedFieldCount === 0) {
    return {
      markdown,
      summaryMetadata: metadata,
      extracted: false
    };
  }

  return {
    markdown: body.trimStart(),
    summaryMetadata: metadata,
    extracted: true
  };
}

function ensureHeadingStartsFromH2(markdown: string): { value: string; changed: boolean } {
  const lines = markdown.split("\n");
  let changed = false;
  let seenAnyH2ToH5 = false;

  const normalizedLines = lines.map((line) => {
    if (/^##{1,4}\s+/.test(line)) {
      seenAnyH2ToH5 = true;
      return line;
    }

    if (/^#\s+/.test(line)) {
      changed = true;
      seenAnyH2ToH5 = true;
      return line.replace(/^#\s+/, "## ");
    }

    return line;
  });

  if (!seenAnyH2ToH5 && normalizedLines.some((line) => line.trim().length > 0)) {
    changed = true;
    return {
      value: ["## 一、重點摘要", ...normalizedLines].join("\n"),
      changed
    };
  }

  return {
    value: normalizedLines.join("\n"),
    changed
  };
}

function removeBlankLineAfterHeading(markdown: string): { value: string; changed: boolean } {
  const replaced = markdown.replace(/^(#{2,5}[^\n]*)\n{2,}/gm, "$1\n");
  return {
    value: replaced,
    changed: replaced !== markdown
  };
}

function normalizeSummaryMarkdown(markdown: string): MarkdownNormalizationResult {
  const warnings: string[] = [];
  const normalizedLineEnding = normalizeLineEndings(markdown);
  const metadataHandled = extractSummaryMetadata(normalizedLineEnding);
  if (metadataHandled.extracted) {
    warnings.push("AI output contract: extracted summary metadata block.");
  }
  const trimmed = trimMarkdown(metadataHandled.markdown);

  const emojiHandled = removeEmoji(trimmed);
  if (emojiHandled.removed) {
    warnings.push("AI output contract: removed emoji from summary output.");
  }

  const headingHandled = ensureHeadingStartsFromH2(emojiHandled.value);
  if (headingHandled.changed) {
    warnings.push("AI output contract: normalized summary heading to start from H2.");
  }

  const blankLineHandled = removeBlankLineAfterHeading(headingHandled.value);
  if (blankLineHandled.changed) {
    warnings.push("AI output contract: removed blank lines directly after headings.");
  }

  return {
    markdown: blankLineHandled.value,
    summaryMetadata: metadataHandled.summaryMetadata,
    warnings
  };
}

function normalizeTranscriptMarkdown(markdown: string): MarkdownNormalizationResult {
  const warnings: string[] = [];
  const normalizedLineEnding = normalizeLineEndings(markdown);
  const trimmed = trimMarkdown(normalizedLineEnding);

  const emojiHandled = removeEmoji(trimmed);
  if (emojiHandled.removed) {
    warnings.push("AI output contract: removed emoji from transcript output.");
  }

  const bracketHandled = emojiHandled.value.replace(/\[/g, "{").replace(/\]/g, "}");
  if (bracketHandled !== emojiHandled.value) {
    warnings.push("AI output contract: converted transcript time markers from [] to {}.");
  }

  const traditionalChineseHandled = normalizeToTraditionalChinese(bracketHandled);
  if (traditionalChineseHandled.changed) {
    warnings.push("AI output contract: converted transcript output to Traditional Chinese.");
  }

  return {
    markdown: traditionalChineseHandled.value,
    summaryMetadata: emptySummaryMetadata(),
    warnings
  };
}

function normalizeTranscriptSegments(transcript: TranscriptSegment[]): {
  transcript: TranscriptSegment[];
  changed: boolean;
} {
  let changed = false;
  const normalizedTranscript = transcript.map((segment) => {
    const textResult = normalizeToTraditionalChinese(segment.text);
    changed = changed || textResult.changed;
    return {
      ...segment,
      text: textResult.value
    };
  });

  return {
    transcript: normalizedTranscript,
    changed
  };
}

export function normalizeMediaTranscriptionResult(
  transcription: MediaTranscriptionResult
): MediaTranscriptionResult {
  const transcriptResult = normalizeTranscriptMarkdown(transcription.transcriptMarkdown);
  const segmentResult = normalizeTranscriptSegments(transcription.transcript);
  const warnings = [...transcription.warnings, ...transcriptResult.warnings];
  if (segmentResult.changed && !warnings.some((warning) => warning.includes("converted transcript output"))) {
    warnings.push("AI output contract: converted transcript output to Traditional Chinese.");
  }

  return {
    transcript: segmentResult.transcript,
    transcriptMarkdown: transcriptResult.markdown,
    warnings
  };
}

export function normalizeMediaSummaryResult(summary: MediaSummaryResult): MediaSummaryResult {
  const summaryResult = normalizeSummaryMarkdown(summary.summaryMarkdown);
  const transcriptResult = normalizeTranscriptMarkdown(summary.transcriptMarkdown);

  return {
    summaryMarkdown: summaryResult.markdown,
    summaryMetadata: summary.summaryMetadata ?? summaryResult.summaryMetadata,
    transcriptMarkdown: transcriptResult.markdown,
    warnings: [...summary.warnings, ...summaryResult.warnings, ...transcriptResult.warnings]
  };
}

export function normalizeWebpageSummaryResult(summary: WebpageSummaryResult): WebpageSummaryResult {
  const summaryResult = normalizeSummaryMarkdown(summary.summaryMarkdown);

  return {
    summaryMarkdown: summaryResult.markdown,
    summaryMetadata: summary.summaryMetadata ?? summaryResult.summaryMetadata,
    warnings: [...summary.warnings, ...summaryResult.warnings]
  };
}
