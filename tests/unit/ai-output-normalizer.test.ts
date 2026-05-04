import { describe, expect, it } from "vitest";
import {
  normalizeMediaSummaryResult,
  normalizeWebpageSummaryResult
} from "@services/ai/ai-output-normalizer";

describe("ai-output-normalizer", () => {
  it("normalizes media summary/transcript by contract rules", () => {
    const result = normalizeMediaSummaryResult({
      summaryMarkdown: [
        "---",
        'Book: "Demo Book"',
        "Author: Demo Author",
        "Description: 這是一段描述",
        "---",
        "# Summary 🎯",
        "",
        "這是一段摘要內容"
      ].join("\n"),
      transcriptMarkdown: "[0m1s - 0m2s] 逐字稿😀",
      warnings: ["ai-warning"]
    });

    expect(result.summaryMarkdown.startsWith("## Summary")).toBe(true);
    expect(result.summaryMarkdown).not.toContain("Book:");
    expect(result.summaryMetadata).toEqual({
      book: "Demo Book",
      author: "Demo Author",
      description: "這是一段描述"
    });
    expect(result.summaryMarkdown.includes("🎯")).toBe(false);
    expect(result.summaryMarkdown.includes("\n\n這是一段摘要內容")).toBe(false);
    expect(result.transcriptMarkdown).toContain("{0m1s - 0m2s}");
    expect(result.transcriptMarkdown.includes("[")).toBe(false);
    expect(result.transcriptMarkdown.includes("😀")).toBe(false);
    expect(result.warnings).toContain("ai-warning");
    expect(
      result.warnings.some((warning) => warning.includes("normalized summary heading to start from H2"))
    ).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("converted transcript time markers from [] to {}"))
    ).toBe(true);
  });

  it("adds H2 heading when webpage summary has no heading", () => {
    const result = normalizeWebpageSummaryResult({
      summaryMarkdown: "純文字摘要",
      warnings: []
    });

    expect(result.summaryMarkdown.startsWith("## 一、重點摘要")).toBe(true);
    expect(result.summaryMarkdown).toContain("純文字摘要");
    expect(
      result.warnings.some((warning) => warning.includes("normalized summary heading to start from H2"))
    ).toBe(true);
  });

  it("preserves output when already compliant", () => {
    const result = normalizeMediaSummaryResult({
      summaryMarkdown: "## 一、重點摘要\n內容",
      transcriptMarkdown: "{0m1s - 0m2s} 逐字稿",
      warnings: []
    });

    expect(result.summaryMarkdown).toBe("## 一、重點摘要\n內容");
    expect(result.transcriptMarkdown).toBe("{0m1s - 0m2s} 逐字稿");
    expect(result.warnings).toEqual([]);
  });

  it("unwraps fenced YAML summary output and extracts metadata", () => {
    const result = normalizeMediaSummaryResult({
      summaryMarkdown: [
        "```yaml",
        "---",
        'Book: ""',
        'Author: "Sense Bar"',
        'Description: "Project setup lesson"',
        "---",
        "# Learning path",
        "Use Claude, Obsidian, GitHub, and Firebase.",
        "```"
      ].join("\n"),
      transcriptMarkdown: "{0-1000} transcript",
      warnings: []
    });

    expect(result.summaryMarkdown).toBe(
      "## Learning path\nUse Claude, Obsidian, GitHub, and Firebase."
    );
    expect(result.summaryMarkdown).not.toContain("```");
    expect(result.summaryMarkdown).not.toContain("Book:");
    expect(result.summaryMetadata).toEqual({
      book: "",
      author: "Sense Bar",
      description: "Project setup lesson"
    });
    expect(
      result.warnings.some((warning) => warning.includes("removed wrapping code fence"))
    ).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("extracted summary metadata block"))
    ).toBe(true);
  });

  it("converts transcript output to Taiwan Traditional Chinese while preserving English terms", () => {
    const result = normalizeMediaSummaryResult({
      summaryMarkdown: "## 一、重點摘要\n內容",
      transcriptMarkdown: "{0m1s - 0m2s} 这是一个网络软件，使用 OpenAI API。",
      warnings: []
    });

    expect(result.transcriptMarkdown).toContain("這是一個網路軟體");
    expect(result.transcriptMarkdown).toContain("OpenAI API");
    expect(result.transcriptMarkdown).not.toContain("这是");
    expect(
      result.warnings.some((warning) => warning.includes("converted transcript output to Traditional Chinese"))
    ).toBe(true);
  });
});
