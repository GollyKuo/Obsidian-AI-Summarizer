import type { SourceType } from "@domain/types";

export interface BuiltinTemplateDefinition {
  reference: string;
  label: string;
  description: string;
  supportedSourceTypes: SourceType[];
  body: string;
}

const BUILTIN_TEMPLATES: readonly BuiltinTemplateDefinition[] = [
  {
    reference: "builtin:default",
    label: "預設摘要模板",
    description: "保留標準 frontmatter，並加上一段來源上下文區塊。",
    supportedSourceTypes: ["webpage_url", "media_url", "local_media", "transcript_file"],
    body: [
      "> 由 AI Summarizer 產生",
      "",
      "## Source Context",
      "",
      '- Creator: "{{creatorOrAuthor}}"',
      '- Platform: "{{platform}}"',
      '- Created: "{{created}}"'
    ].join("\n")
  },
  {
    reference: "builtin:webpage-brief",
    label: "Webpage Brief",
    description: "適合文章、文件與網頁摘要，先保留來源紀錄，再接摘要正文。",
    supportedSourceTypes: ["webpage_url"],
    body: [
      "## Capture",
      "",
      '- URL: "{{source}}"',
      '- Author: "{{creatorOrAuthor}}"',
      '- Captured At: "{{created}}"'
    ].join("\n")
  },
  {
    reference: "builtin:media-session",
    label: "Media Session",
    description: "適合影音與逐字稿輸出，先留下媒體脈絡，再接摘要與 transcript。",
    supportedSourceTypes: ["media_url", "local_media", "transcript_file"],
    body: [
      "## Session",
      "",
      '- Source: "{{source}}"',
      '- Speaker / Creator: "{{creatorOrAuthor}}"',
      '- Captured At: "{{created}}"'
    ].join("\n")
  }
] as const;

export function listBuiltinTemplates(): readonly BuiltinTemplateDefinition[] {
  return BUILTIN_TEMPLATES;
}

export function isBuiltinTemplateReference(templateReference: string): boolean {
  return BUILTIN_TEMPLATES.some((template) => template.reference === templateReference);
}

export function resolveBuiltinTemplate(templateReference: string): string | null {
  return BUILTIN_TEMPLATES.find((template) => template.reference === templateReference)?.body ?? null;
}

export function describeTemplateReference(templateReference: string): string {
  if (templateReference.trim().length === 0) {
    return "使用預設 YAML 輸出。";
  }

  const builtinTemplate = BUILTIN_TEMPLATES.find((template) => template.reference === templateReference);
  if (builtinTemplate) {
    return `使用內建模板：${builtinTemplate.label}。`;
  }

  return `使用自訂模板：${templateReference}`;
}
