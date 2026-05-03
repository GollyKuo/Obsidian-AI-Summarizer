export interface TemplateData {
  title: string;
  book: string;
  author: string;
  creator: string;
  creatorOrAuthor: string;
  description: string;
  tags: string;
  platform: string;
  source: string;
  createdDate: string;
  created: string;
  summary: string;
  transcript: string;
}

function quoteFrontmatterValue(value: string): string {
  return JSON.stringify(value);
}

export function applyTemplate(templateBody: string, data: TemplateData): string {
  const placeholderValues: Record<string, string> = {
    title: data.title,
    book: data.book,
    author: data.author,
    creator: data.creator,
    creatorOrAuthor: data.creatorOrAuthor,
    description: data.description,
    tags: data.tags,
    platform: data.platform,
    source: data.source,
    createdDate: data.createdDate,
    created: data.created,
    summary: data.summary,
    transcript: data.transcript
  };

  return templateBody.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(placeholderValues, key)
      ? placeholderValues[key]
      : match;
  });
}

export function buildDefaultFrontmatter(data: TemplateData): string {
  return [
    "---",
    `Title: ${quoteFrontmatterValue(data.title)}`,
    `Book: ${quoteFrontmatterValue(data.book)}`,
    `Author: ${quoteFrontmatterValue(data.author)}`,
    `Creator: ${quoteFrontmatterValue(data.creator)}`,
    `Description: ${quoteFrontmatterValue(data.description)}`,
    `tags:${data.tags}`,
    `Platform: ${quoteFrontmatterValue(data.platform)}`,
    `Source: ${quoteFrontmatterValue(data.source)}`,
    `Created: ${quoteFrontmatterValue(data.createdDate)}`,
    "---",
    ""
  ].join("\n");
}
