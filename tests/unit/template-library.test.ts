import { describe, expect, it } from "vitest";
import {
  describeTemplateReference,
  isBuiltinTemplateReference,
  listBuiltinTemplates,
  resolveBuiltinTemplate
} from "@services/obsidian/template-library";

describe("template library", () => {
  it("lists builtin templates for webpage and media flows", () => {
    const templates = listBuiltinTemplates();

    expect(templates.some((template) => template.reference === "builtin:default")).toBe(true);
    expect(templates.some((template) => template.reference === "builtin:webpage-brief")).toBe(true);
    expect(templates.some((template) => template.reference === "builtin:media-session")).toBe(true);
  });

  it("resolves builtin template bodies and descriptions", () => {
    expect(isBuiltinTemplateReference("builtin:webpage-brief")).toBe(true);
    expect(resolveBuiltinTemplate("builtin:webpage-brief")).toContain("## Capture");
    expect(describeTemplateReference("builtin:media-session")).toContain("內建模板");
    expect(describeTemplateReference("")).toContain("預設 frontmatter");
  });
});

