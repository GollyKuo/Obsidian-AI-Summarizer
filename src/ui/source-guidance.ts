import type { ErrorCategory } from "@domain/errors";
import type { SourceType } from "@domain/types";

export interface SourceGuidance {
  label: string;
  placeholder: string;
  description: string;
  inputHint: string;
  examples: readonly string[];
  emptyValueHint: string;
  errorHints: Partial<Record<ErrorCategory, string>>;
}

const SOURCE_GUIDANCE: Record<SourceType, SourceGuidance> = {
  webpage_url: {
    label: "網頁 URL",
    placeholder: "https://example.com/article",
    description: "貼上文章、文件或一般網頁連結，先抽取可讀文字，再做摘要與 note 輸出。",
    inputHint: "只支援 http/https。若網站有付費牆、登入限制或大量動態載入，可能只能抓到部分內容。",
    examples: ["新聞文章", "技術文件", "部落格文章"],
    emptyValueHint: "請先輸入網頁 URL。",
    errorHints: {
      validation_error: "確認網址以 http/https 開頭，且不是空白或不完整的 URL。",
      runtime_unavailable: "若目標頁面阻擋擷取，請改用可讀模式頁面，或先整理成純文字再摘要。"
    }
  },
  media_url: {
    label: "媒體 URL",
    placeholder: "https://www.youtube.com/watch?v=...",
    description: "貼上 YouTube、podcast 或直接媒體檔連結，下載後走同一條 AI-ready media pipeline。",
    inputHint: "桌面版需要可用的 yt-dlp / ffmpeg。下載產物會先進 media cache，再依 retention policy 清理。",
    examples: ["YouTube 影片", "Podcast episode", "直接音訊檔 URL"],
    emptyValueHint: "請先輸入媒體 URL。",
    errorHints: {
      validation_error: "確認來源是可直接存取的 http/https 媒體 URL。",
      runtime_unavailable: "先到設定頁的執行環境診斷確認 yt-dlp / ffmpeg 是否可用。",
      download_failure: "連結可能失效、受地區限制，或上游暫時拒絕下載。"
    }
  },
  local_media: {
    label: "本機媒體",
    placeholder: "D:\\Media\\episode.mp3",
    description: "輸入本機音訊或影片的絕對路徑；桌面版也可以直接挑檔。",
    inputHint: "v1 只支援常見音訊/影片格式與大小限制。來源檔不會直接寫進 vault，而是先進入 local media ingestion。",
    examples: ["mp3 / m4a 音檔", "mp4 / mov 影片", "錄音檔"],
    emptyValueHint: "請先輸入本機媒體檔案路徑。",
    errorHints: {
      validation_error: "確認使用絕對路徑，檔案存在，且副檔名與大小都在支援範圍內。",
      runtime_unavailable: "先到設定頁確認本機 runtime 與 media cache root 診斷是否正常。"
    }
  },
  transcript_file: {
    label: "逐字稿檔案",
    placeholder: "D:\\MediaCache\\session\\transcript.md",
    description: "選擇已產生的 transcript.md 或純文字逐字稿，跳過轉錄，只重跑摘要與 note 輸出。",
    inputHint: "適合摘要失敗後重跑、改用不同摘要 provider，或手動修正逐字稿後重新整理。",
    examples: ["transcript.md", "subtitles 轉成的純文字", "手動整理逐字稿"],
    emptyValueHint: "請先輸入逐字稿檔案路徑。",
    errorHints: {
      validation_error: "確認使用絕對路徑，檔案存在，且副檔名為 .md 或 .txt。",
      ai_failure: "確認摘要 provider/API key 可用，或換用較穩定的摘要模型後重試。",
      note_write_failure: "確認輸出資料夾可寫入，或檢查同名筆記衝突處理。"
    }
  }
};

const FALLBACK_ERROR_HINTS: Record<ErrorCategory, string> = {
  validation_error: "確認輸入值符合目前來源格式，修正後再重試。",
  runtime_unavailable: "先到設定頁的診斷區確認目前來源需要的本機執行環境是否可用。",
  download_failure: "確認連結仍可存取；若來源限制下載，可改用本機媒體或逐字稿檔案。",
  ai_failure: "確認 API key、provider 與模型可用；若已有 transcript.md，可改用逐字稿檔案重跑摘要。",
  note_write_failure: "確認輸出資料夾存在且可寫入，並檢查是否有同名筆記衝突。",
  cancellation: "流程已停止；可修正輸入或改用已保留的逐字稿後重新執行。"
};

export function getSourceGuidance(sourceType: SourceType): SourceGuidance {
  return SOURCE_GUIDANCE[sourceType];
}

export function getSourceErrorHint(
  sourceType: SourceType,
  category: ErrorCategory | "unknown"
): string | null {
  if (category === "unknown") {
    return "先檢查輸入值、設定頁診斷摘要與 plugin log，再決定是否需要重試。";
  }

  return SOURCE_GUIDANCE[sourceType].errorHints[category] ?? FALLBACK_ERROR_HINTS[category];
}
