import type { MediaSummaryResult, WebpageSummaryResult } from "@domain/types";

interface MarkdownNormalizationResult {
  markdown: string;
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
  const trimmed = trimMarkdown(normalizedLineEnding);

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

  return {
    markdown: bracketHandled,
    warnings
  };
}

export function normalizeMediaSummaryResult(summary: MediaSummaryResult): MediaSummaryResult {
  const summaryResult = normalizeSummaryMarkdown(summary.summaryMarkdown);
  const transcriptResult = normalizeTranscriptMarkdown(summary.transcriptMarkdown);

  return {
    summaryMarkdown: summaryResult.markdown,
    transcriptMarkdown: transcriptResult.markdown,
    warnings: [...summary.warnings, ...summaryResult.warnings, ...transcriptResult.warnings]
  };
}

export function normalizeWebpageSummaryResult(summary: WebpageSummaryResult): WebpageSummaryResult {
  const summaryResult = normalizeSummaryMarkdown(summary.summaryMarkdown);

  return {
    summaryMarkdown: summaryResult.markdown,
    warnings: [...summary.warnings, ...summaryResult.warnings]
  };
}
