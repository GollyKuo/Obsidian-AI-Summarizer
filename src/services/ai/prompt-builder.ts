import { PROMPT_CONTRACT } from "@domain/prompts";
import type { MediaSummaryInput, WebpageAiInput } from "@domain/types";

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
  return [
    PROMPT_CONTRACT.mediaSummaryPrompt,
    "",
    "以下為輸入資料，請僅依據這些資料產出最終摘要：",
    "",
    "## Metadata",
    buildMetadataBlock(input.metadata),
    "",
    "## Transcript",
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
