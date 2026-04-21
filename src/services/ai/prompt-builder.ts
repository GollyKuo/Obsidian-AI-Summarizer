import { PROMPT_CONTRACT } from "@domain/prompts";
import type { MediaAiInput, WebpageAiInput } from "@domain/types";

function buildMetadataBlock(metadata: {
  title: string;
  creatorOrAuthor: string;
  platform: string;
  source: string;
  created: string;
}): string {
  return [
    `Title: ${metadata.title}`,
    `Creator/Author: ${metadata.creatorOrAuthor}`,
    `Platform: ${metadata.platform}`,
    `Source: ${metadata.source}`,
    `Created: ${metadata.created}`
  ].join("\n");
}

export function buildMediaSummaryPrompt(input: MediaAiInput): string {
  return [
    PROMPT_CONTRACT.mediaSummaryPrompt,
    "",
    buildMetadataBlock(input.metadata),
    "",
    "Transcript:",
    input.transcript.map((segment) => segment.text).join("\n"),
    "",
    "Normalized Content:",
    input.normalizedText
  ].join("\n");
}

export function buildWebpageSummaryPrompt(input: WebpageAiInput): string {
  return [
    PROMPT_CONTRACT.webpageSummaryPrompt,
    "",
    buildMetadataBlock(input.metadata),
    "",
    "Webpage Content:",
    input.webpageText
  ].join("\n");
}

export function buildTranscriptPrompt(rawText: string): string {
  return [PROMPT_CONTRACT.transcriptPrompt, "", rawText].join("\n");
}
