import { describe, expect, it } from "vitest";
import { getSourceErrorHint, getSourceGuidance } from "@ui/source-guidance";

describe("source guidance", () => {
  it("returns source-specific labels and placeholders", () => {
    expect(getSourceGuidance("webpage_url").label).toBe("網頁 URL");
    expect(getSourceGuidance("media_url").placeholder).toContain("youtube");
    expect(getSourceGuidance("local_media").emptyValueHint).toContain("檔案路徑");
    expect(getSourceGuidance("transcript_file").label).toBe("文字檔案");
    expect(getSourceGuidance("transcript_file").placeholder).toContain("article.txt");
    expect(getSourceGuidance("transcript_file").inputHint).toContain("被網站阻擋");
  });

  it("returns category-specific error hints", () => {
    expect(getSourceErrorHint("media_url", "download_failure")).toContain("連結可能失效");
    expect(getSourceErrorHint("local_media", "validation_error")).toContain("絕對路徑");
    expect(getSourceErrorHint("transcript_file", "validation_error")).toContain(".md");
    expect(getSourceErrorHint("media_url", "ai_failure")).toContain("API key");
    expect(getSourceErrorHint("webpage_url", "note_write_failure")).toContain("輸出資料夾");
    expect(getSourceErrorHint("webpage_url", "unknown")).toContain("plugin log");
  });
});
