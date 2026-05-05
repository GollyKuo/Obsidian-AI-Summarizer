import type { MediaCompressionProfile } from "@domain/settings";
import type { RetentionMode, SourceType, TranscriptCleanupFailureMode } from "@domain/types";

export type SettingsSection = "ai_models" | "output_media" | "templates_prompts" | "help" | "diagnostics";

export const SETTINGS_SECTIONS: ReadonlyArray<{ id: SettingsSection; label: string }> = [
  { id: "ai_models", label: "AI 模型" },
  { id: "output_media", label: "輸出與媒體" },
  { id: "templates_prompts", label: "筆記模板" },
  { id: "help", label: "使用說明" },
  { id: "diagnostics", label: "診斷" }
];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  webpage_url: "網頁 URL",
  media_url: "媒體 URL",
  local_media: "本機媒體",
  transcript_file: "文字檔案"
};

export const DIAGNOSTIC_CAPABILITY_LABELS: Record<SourceType, string> = {
  webpage_url: "網頁摘要",
  media_url: "YouTube / 媒體網址",
  local_media: "本機音訊 / 影片",
  transcript_file: "文字檔案摘要"
};

export const RETENTION_LABELS: Record<RetentionMode, string> = {
  delete_temp: "刪除暫存檔",
  keep_temp: "保留暫存檔"
};

export const TRANSCRIPT_CLEANUP_FAILURE_MODE_LABELS: Record<TranscriptCleanupFailureMode, string> = {
  fallback_to_original: "失敗時使用原始逐字稿",
  fail: "失敗時中止流程"
};

export const MEDIA_COMPRESSION_LABELS: Record<MediaCompressionProfile, string> = {
  balanced: "平衡：較小體積，適合日常轉錄",
  quality: "品質：保留較高音質"
};
