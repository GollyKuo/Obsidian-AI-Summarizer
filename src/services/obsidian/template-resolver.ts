export interface TemplateData {
  title: string;
  creatorOrAuthor: string;
  platform: string;
  source: string;
  created: string;
}

function quoteFrontmatterValue(value: string): string {
  return JSON.stringify(value);
}

export function applyTemplate(templateBody: string, data: TemplateData): string {
  return templateBody
    .replace(/\{\{title\}\}/g, data.title)
    .replace(/\{\{creatorOrAuthor\}\}/g, data.creatorOrAuthor)
    .replace(/\{\{platform\}\}/g, data.platform)
    .replace(/\{\{source\}\}/g, data.source)
    .replace(/\{\{created\}\}/g, data.created);
}

export function buildDefaultFrontmatter(data: TemplateData): string {
  return [
    "---",
    `Title: ${quoteFrontmatterValue(data.title)}`,
    `Creator: ${quoteFrontmatterValue(data.creatorOrAuthor)}`,
    `Platform: ${quoteFrontmatterValue(data.platform)}`,
    `Source: ${quoteFrontmatterValue(data.source)}`,
    `Created: ${quoteFrontmatterValue(data.created)}`,
    "---",
    ""
  ].join("\n");
}
