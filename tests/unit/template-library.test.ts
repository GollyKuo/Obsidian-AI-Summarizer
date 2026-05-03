import { describe, expect, it } from "vitest";
import {
  createCustomTemplateReference,
  describeTemplateReference,
  getCustomTemplatePath,
  isBuiltinTemplateReference,
  listBuiltinTemplates,
  normalizeTemplateReference,
  resolveBuiltinTemplate
} from "@services/obsidian/template-library";

describe("template library", () => {
  it("lists the universal frontmatter builtin template", () => {
    const templates = listBuiltinTemplates();

    expect(templates.map((template) => template.reference)).toEqual(["builtin:universal-frontmatter"]);
    expect(resolveBuiltinTemplate("builtin:universal-frontmatter")).toContain("Book:");
    expect(
      templates.find((template) => template.reference === "builtin:universal-frontmatter")?.supportedSourceTypes
    ).toContain("transcript_file");
  });

  it("keeps legacy builtin references compatible with universal frontmatter", () => {
    expect(isBuiltinTemplateReference("builtin:webpage-brief")).toBe(true);
    expect(normalizeTemplateReference("builtin:media-session")).toBe("builtin:universal-frontmatter");
    expect(resolveBuiltinTemplate("builtin:default")).toContain("Created:");
    expect(describeTemplateReference("")).toContain("預設通用 Frontmatter");
  });

  it("normalizes custom template references", () => {
    expect(createCustomTemplateReference("Templates/ai-summary-template.md")).toBe(
      "custom:Templates/ai-summary-template.md"
    );
    expect(getCustomTemplatePath("custom:Templates/ai-summary-template.md")).toBe(
      "Templates/ai-summary-template.md"
    );
    expect(describeTemplateReference("custom:Templates/ai-summary-template.md")).toContain("自訂模板");
  });
});
