export interface TemplateData {
  title: string;
  creatorOrAuthor: string;
  platform: string;
  source: string;
  created: string;
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
    `Title: "${data.title}"`,
    `Creator: "${data.creatorOrAuthor}"`,
    `Platform: "${data.platform}"`,
    `Source: "${data.source}"`,
    `Created: "${data.created}"`,
    "---",
    ""
  ].join("\n");
}
