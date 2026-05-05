import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_CAPABILITY_LABELS,
  MEDIA_COMPRESSION_LABELS,
  RETENTION_LABELS,
  SETTINGS_SECTIONS,
  SOURCE_TYPE_LABELS,
  TRANSCRIPT_CLEANUP_FAILURE_MODE_LABELS
} from "@ui/settings-copy";

describe("settings copy", () => {
  it("keeps the primary settings section labels stable", () => {
    expect(SETTINGS_SECTIONS).toEqual([
      { id: "ai_models", label: "AI 模型" },
      { id: "output_media", label: "輸出與媒體" },
      { id: "templates_prompts", label: "筆記模板" },
      { id: "help", label: "使用說明" },
      { id: "diagnostics", label: "診斷" }
    ]);
  });

  it("keeps source and diagnostic labels aligned with supported inputs", () => {
    expect(SOURCE_TYPE_LABELS).toEqual({
      webpage_url: "網頁 URL",
      media_url: "媒體 URL",
      local_media: "本機媒體",
      transcript_file: "文字檔案"
    });
    expect(DIAGNOSTIC_CAPABILITY_LABELS).toEqual({
      webpage_url: "網頁摘要",
      media_url: "YouTube / 媒體網址",
      local_media: "本機音訊 / 影片",
      transcript_file: "文字檔案摘要"
    });
  });

  it("keeps release-sensitive option labels stable", () => {
    expect(RETENTION_LABELS).toEqual({
      delete_temp: "刪除暫存檔",
      keep_temp: "保留暫存檔"
    });
    expect(TRANSCRIPT_CLEANUP_FAILURE_MODE_LABELS).toEqual({
      fallback_to_original: "失敗時使用原始逐字稿",
      fail: "失敗時中止流程"
    });
    expect(MEDIA_COMPRESSION_LABELS).toEqual({
      balanced: "平衡：較小體積，適合日常轉錄",
      quality: "品質：保留較高音質"
    });
  });
});
