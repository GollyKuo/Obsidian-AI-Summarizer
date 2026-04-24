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
  }
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

  return SOURCE_GUIDANCE[sourceType].errorHints[category] ?? null;
}
