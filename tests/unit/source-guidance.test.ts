import { describe, expect, it } from "vitest";
import { getSourceErrorHint, getSourceGuidance } from "@ui/source-guidance";

describe("source guidance", () => {
  it("returns source-specific labels and placeholders", () => {
    expect(getSourceGuidance("webpage_url").label).toBe("網頁 URL");
    expect(getSourceGuidance("media_url").placeholder).toContain("youtube");
    expect(getSourceGuidance("local_media").emptyValueHint).toContain("檔案路徑");
  });

  it("returns category-specific error hints", () => {
    expect(getSourceErrorHint("media_url", "download_failure")).toContain("連結可能失效");
    expect(getSourceErrorHint("local_media", "validation_error")).toContain("絕對路徑");
    expect(getSourceErrorHint("webpage_url", "unknown")).toContain("plugin log");
  });
});
