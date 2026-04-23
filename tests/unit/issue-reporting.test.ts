import { describe, expect, it } from "vitest";
import { SummarizerError } from "@domain/errors";
import {
  createIssueReport,
  formatInfoReport,
  formatWarningReport
} from "@services/diagnostics/issue-reporting";

describe("issue reporting", () => {
  it("formats info and warning messages with normalized context", () => {
    expect(formatInfoReport("Webpage Flow", "Created note")).toBe("[webpage_flow] Created note");
    expect(formatWarningReport("Runtime Diagnostics", " dependency missing ")).toBe(
      "[runtime_diagnostics] dependency missing"
    );
  });

  it("creates deterministic reports for summarizer errors", () => {
    const report = createIssueReport(
      "Webpage Flow",
      new SummarizerError({
        category: "validation_error",
        message: "Invalid webpage URL: ftp://example.com",
        recoverable: true
      })
    );

    expect(report.category).toBe("validation_error");
    expect(report.level).toBe("warn");
    expect(report.noticeMessage).toBe("輸入無效：Invalid webpage URL: ftp://example.com");
    expect(report.modalMessage).toBe("輸入無效：Invalid webpage URL: ftp://example.com");
    expect(report.logMessage).toBe(
      "[webpage_flow] validation_error: Invalid webpage URL: ftp://example.com"
    );
    expect(report.assertionMessage).toBe(
      "webpage_flow | validation_error | Invalid webpage URL: ftp://example.com"
    );
  });

  it("creates deterministic reports for unknown errors", () => {
    const report = createIssueReport("AI Pipeline", new Error("socket closed"));

    expect(report.category).toBe("unknown");
    expect(report.level).toBe("error");
    expect(report.noticeMessage).toBe("未預期錯誤：socket closed");
    expect(report.logMessage).toBe("[ai_pipeline] unknown_error: socket closed");
    expect(report.assertionMessage).toBe("ai_pipeline | unknown | socket closed");
  });
});
