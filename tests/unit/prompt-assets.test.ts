import { describe, expect, it } from "vitest";
import { listPromptAssets } from "@services/ai/prompt-assets";

describe("prompt assets", () => {
  it("exposes the fixed prompt contract inventory", () => {
    const assets = listPromptAssets();

    expect(assets).toHaveLength(3);
    expect(assets.map((asset) => asset.id)).toEqual([
      "transcript",
      "media_summary",
      "webpage_summary"
    ]);
    expect(assets.every((asset) => asset.sourcePath === "src/domain/prompts.ts")).toBe(true);
  });
});

