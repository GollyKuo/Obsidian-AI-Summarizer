import { PROMPT_CONTRACT } from "@domain/prompts";
import type { MediaSummaryInput, TranscriptCleanupInput, WebpageAiInput } from "@domain/types";

function buildMetadataBlock(metadata: {
  title: string;
  creatorOrAuthor: string;
  platform: string;
  source: string;
  created: string;
}): string {
  return [
    `標題：${metadata.title}`,
    `作者／講者：${metadata.creatorOrAuthor}`,
    `平台：${metadata.platform}`,
    `來源：${metadata.source}`,
    `建立時間：${metadata.created}`
  ].join("\n");
}

export function buildMediaSummaryPrompt(input: MediaSummaryInput): string {
  const contentLabel = input.metadata.platform === "Text File" ? "Source Text" : "Transcript";
  return [
    PROMPT_CONTRACT.mediaSummaryPrompt,
    "",
    "以下為輸入資料，請僅依據這些資料產出最終摘要：",
    "",
    "## Metadata",
    buildMetadataBlock(input.metadata),
    "",
    `## ${contentLabel}`,
    input.transcript.map((segment) => segment.text).join("\n"),
    "",
    "## Normalized Content",
    input.normalizedText
  ].join("\n");
}

export function buildWebpageSummaryPrompt(input: WebpageAiInput): string {
  return [
    PROMPT_CONTRACT.webpageSummaryPrompt,
    "",
    "以下為輸入資料，請僅依據這些資料產出最終摘要：",
    "",
    "## Metadata",
    buildMetadataBlock(input.metadata),
    "",
    "## Webpage Content",
    input.webpageText
  ].join("\n");
}

export function buildTranscriptPrompt(rawText: string): string {
  return [
    PROMPT_CONTRACT.transcriptPrompt,
    "",
    "以下為待整理內容，請直接輸出最終逐字稿：",
    "",
    "## Raw Content",
    rawText
  ].join("\n");
}

export function buildTranscriptCleanupPrompt(input: TranscriptCleanupInput): string {
  const hasSyntheticTiming = input.transcript.some((segment) => segment.timingSource === "synthetic");
  const hasExplicitTiming = input.transcript.some((segment) => segment.timingSource === "explicit");
  const timingInstruction = hasSyntheticTiming && !hasExplicitTiming
    ? "時間軸提示：此逐字稿沒有可信的原始時間碼；系統只為分段產生 synthetic timing。請清理文字內容，不要新增或宣稱精確時間碼。"
    : "時間軸提示：若逐字稿包含既有時間碼，請保留原有 marker 與順序。";

  return [
    PROMPT_CONTRACT.transcriptCleanupPrompt,
    "",
    "以下為待校對與清理的逐字稿，請僅依據這些資料輸出清理後逐字稿：",
    "",
    "## Metadata",
    buildMetadataBlock(input.metadata),
    "",
    timingInstruction,
    "",
    "## Transcript",
    input.transcriptMarkdown
  ].join("\n");
}
