export interface PromptAssetDefinition {
  id: "transcript" | "media_summary" | "webpage_summary";
  label: string;
  description: string;
  sourcePath: string;
  exportedSymbol: string;
  usedBy: readonly string[];
}

const PROMPT_ASSETS: readonly PromptAssetDefinition[] = [
  {
    id: "transcript",
    label: "Transcript Prompt",
    description: "將原始內容整理成逐字稿片段與時間範圍。",
    sourcePath: "src/domain/prompts.ts",
    exportedSymbol: "PROMPT_CONTRACT.transcriptPrompt",
    usedBy: ["buildTranscriptPrompt", "runtime transcript stage"]
  },
  {
    id: "media_summary",
    label: "Media Summary Prompt",
    description: "用於 media_url / local_media 的分段摘要與最終摘要。",
    sourcePath: "src/domain/prompts.ts",
    exportedSymbol: "PROMPT_CONTRACT.mediaSummaryPrompt",
    usedBy: ["buildMediaSummaryPrompt", "summarizeMediaWithChunking"]
  },
  {
    id: "webpage_summary",
    label: "Webpage Summary Prompt",
    description: "用於網頁可讀文字的摘要與 note payload 產出。",
    sourcePath: "src/domain/prompts.ts",
    exportedSymbol: "PROMPT_CONTRACT.webpageSummaryPrompt",
    usedBy: ["buildWebpageSummaryPrompt", "processWebpage"]
  }
] as const;

export function listPromptAssets(): readonly PromptAssetDefinition[] {
  return PROMPT_ASSETS;
}

