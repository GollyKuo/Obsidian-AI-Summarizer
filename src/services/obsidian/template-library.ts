import type { SourceType } from "@domain/types";

export const UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE = "builtin:universal-frontmatter";
export const CUSTOM_TEMPLATE_PREFIX = "custom:";

export interface BuiltinTemplateDefinition {
  reference: string;
  label: string;
  description: string;
  supportedSourceTypes: SourceType[];
  body: string;
}

const BUILTIN_TEMPLATES: readonly BuiltinTemplateDefinition[] = [
  {
    reference: UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE,
    label: "預設通用 Frontmatter",
    description: "在筆記開頭加入標題、來源、日期等 YAML frontmatter。",
    supportedSourceTypes: ["webpage_url", "media_url", "local_media", "transcript_file"],
    body: [
      "---",
      'Title: "{{title}}"',
      'Book: "{{book}}"',
      'Author: "{{author}}"',
      'Creator: "{{creator}}"',
      'Description: "{{description}}"',
      "tags:{{tags}}",
      'Platform: "{{platform}}"',
      'Source: "{{source}}"',
      'Created: "{{createdDate}}"',
      "---"
    ].join("\n")
  }
] as const;

const BUILTIN_TEMPLATE_ALIASES = new Map<string, string>([
  ["", UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE],
  ["builtin:default", UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE],
  ["builtin:webpage-brief", UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE],
  ["builtin:media-session", UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE]
]);

export function listBuiltinTemplates(): readonly BuiltinTemplateDefinition[] {
  return BUILTIN_TEMPLATES;
}

export function normalizeTemplateReference(templateReference: string): string {
  const trimmed = templateReference.trim();
  return BUILTIN_TEMPLATE_ALIASES.get(trimmed) ?? trimmed;
}

export function isBuiltinTemplateReference(templateReference: string): boolean {
  const normalizedReference = normalizeTemplateReference(templateReference);
  return BUILTIN_TEMPLATES.some((template) => template.reference === normalizedReference);
}

export function resolveBuiltinTemplate(templateReference: string): string | null {
  const normalizedReference = normalizeTemplateReference(templateReference);
  return BUILTIN_TEMPLATES.find((template) => template.reference === normalizedReference)?.body ?? null;
}

export function createCustomTemplateReference(templatePath: string): string {
  const normalizedPath = templatePath.trim().replace(/^custom:/, "").trim();
  return normalizedPath.length > 0 ? `${CUSTOM_TEMPLATE_PREFIX}${normalizedPath}` : "";
}

export function getCustomTemplatePath(templateReference: string): string {
  const trimmed = templateReference.trim();
  return trimmed.startsWith(CUSTOM_TEMPLATE_PREFIX)
    ? trimmed.slice(CUSTOM_TEMPLATE_PREFIX.length).trim()
    : trimmed;
}

export function describeTemplateReference(templateReference: string): string {
  const normalizedReference = normalizeTemplateReference(templateReference);

  const builtinTemplate = BUILTIN_TEMPLATES.find((template) => template.reference === normalizedReference);
  if (builtinTemplate) {
    return `目前使用 ${builtinTemplate.label}。摘要會寫在 frontmatter 後方；有逐字稿時會附在筆記末尾。`;
  }

  return `目前使用自訂模板：${getCustomTemplatePath(templateReference)}`;
}
