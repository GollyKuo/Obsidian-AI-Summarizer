export interface PromptContract {
  transcriptPrompt: string;
  mediaSummaryPrompt: string;
  webpageSummaryPrompt: string;
}

export const PROMPT_CONTRACT: PromptContract = {
  transcriptPrompt:
    "請將輸入內容整理為結構化逐字稿，保持繁體中文，保留關鍵名詞與段落語意。",
  mediaSummaryPrompt:
    "請產出繁體中文的媒體摘要，使用 Markdown 標題，優先給出重點、結論、行動建議。",
  webpageSummaryPrompt:
    "請產出繁體中文的網頁摘要，使用 Markdown 標題，保留作者觀點與關鍵論點。"
};
