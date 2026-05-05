import type { MediaNoteInput, WebpageNoteInput, WriteResult } from "@domain/types";
import {
  applyTemplate,
  buildDefaultFrontmatter,
  type TemplateData
} from "@services/obsidian/template-resolver";
import {
  getCustomTemplatePath,
  normalizeTemplateReference,
  resolveBuiltinTemplate
} from "@services/obsidian/template-library";
import { normalizeNoteMetadata } from "@services/obsidian/note-output-contract";
import { resolveUniqueNotePathWithDiagnostics } from "@services/obsidian/path-resolver";
import { normalizeToTraditionalChinese } from "@services/text/traditional-chinese";

export interface NoteStorage {
  exists(path: string): Promise<boolean>;
  write(path: string, content: string): Promise<void>;
  readTemplate(templateReference: string): Promise<string | null>;
}

export interface NoteWriter {
  writeMediaNote(input: MediaNoteInput): Promise<WriteResult>;
  writeWebpageNote(input: WebpageNoteInput): Promise<WriteResult>;
}

export interface NoteWriterOptions {
  outputFolder: string;
  templateReference: string;
  generateFlashcards?: boolean;
}

interface ContentBuildResult {
  content: string;
  warnings: string[];
}

function dateOnly(isoTimestamp: string): string {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function buildTagsPlaceholder(generateFlashcards: boolean): string {
  return generateFlashcards ? "\n  - Flashcard" : "";
}

function normalizeTemplateOutput(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendTranscript(summaryMarkdown: string, transcriptMarkdown: string): string {
  const trimmedTranscript = normalizeToTraditionalChinese(transcriptMarkdown.trim()).value;
  if (trimmedTranscript.length === 0) {
    return summaryMarkdown.trim();
  }

  return [summaryMarkdown.trim(), "", "## Transcript", "", trimmedTranscript].join("\n");
}

function hasFrontmatter(markdown: string): boolean {
  return /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(markdown.trimStart());
}

function findUnknownPlaceholders(templateBody: string): string[] {
  const knownPlaceholders = new Set<keyof TemplateData>([
    "title",
    "book",
    "author",
    "creator",
    "creatorOrAuthor",
    "description",
    "tags",
    "platform",
    "source",
    "createdDate",
    "created",
    "summary",
    "transcript"
  ]);
  return Array.from(templateBody.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g))
    .map((match) => match[1])
    .filter((key) => !knownPlaceholders.has(key as keyof TemplateData));
}

export class ObsidianNoteWriter implements NoteWriter {
  private readonly storage: NoteStorage;
  private readonly options: NoteWriterOptions;

  public constructor(storage: NoteStorage, options: NoteWriterOptions) {
    this.storage = storage;
    this.options = options;
  }

  public async writeMediaNote(input: MediaNoteInput): Promise<WriteResult> {
    const metadataResult = normalizeNoteMetadata(input.metadata);
    const pathResult = await resolveUniqueNotePathWithDiagnostics(
      this.storage,
      this.options.outputFolder,
      metadataResult.metadata.title
    );
    const contentResult = await this.buildContent(
      {
        title: metadataResult.metadata.title,
        book: input.summaryMetadata?.book ?? "",
        author: input.summaryMetadata?.author ?? "",
        creator: metadataResult.metadata.creatorOrAuthor,
        creatorOrAuthor: metadataResult.metadata.creatorOrAuthor,
        description: input.summaryMetadata?.description ?? "",
        tags: buildTagsPlaceholder(this.options.generateFlashcards === true),
        platform: metadataResult.metadata.platform,
        source: metadataResult.metadata.source,
        createdDate: dateOnly(metadataResult.metadata.created),
        created: metadataResult.metadata.created,
        summary: input.summaryMarkdown.trim(),
        transcript: normalizeToTraditionalChinese(input.transcriptMarkdown.trim()).value
      },
      appendTranscript(input.summaryMarkdown, input.transcriptMarkdown),
      normalizeToTraditionalChinese(input.transcriptMarkdown).value
    );
    await this.storage.write(pathResult.notePath, contentResult.content);

    const warnings = [...metadataResult.warnings, ...contentResult.warnings];
    if (pathResult.collisionCount > 0) {
      warnings.push(
        `Path collision policy: resolved ${pathResult.collisionCount} collision(s) for note title "${pathResult.normalizedTitle}".`
      );
    }

    return {
      notePath: pathResult.notePath,
      createdAt: new Date().toISOString(),
      warnings
    };
  }

  public async writeWebpageNote(input: WebpageNoteInput): Promise<WriteResult> {
    const metadataResult = normalizeNoteMetadata(input.metadata);
    const pathResult = await resolveUniqueNotePathWithDiagnostics(
      this.storage,
      this.options.outputFolder,
      metadataResult.metadata.title
    );
    const contentResult = await this.buildContent(
      {
        title: metadataResult.metadata.title,
        book: input.summaryMetadata?.book ?? "",
        author: input.summaryMetadata?.author ?? "",
        creator: metadataResult.metadata.creatorOrAuthor,
        creatorOrAuthor: metadataResult.metadata.creatorOrAuthor,
        description: input.summaryMetadata?.description ?? "",
        tags: buildTagsPlaceholder(this.options.generateFlashcards === true),
        platform: metadataResult.metadata.platform,
        source: metadataResult.metadata.source,
        createdDate: dateOnly(metadataResult.metadata.created),
        created: metadataResult.metadata.created,
        summary: input.summaryMarkdown.trim(),
        transcript: ""
      },
      input.summaryMarkdown,
      ""
    );
    await this.storage.write(pathResult.notePath, contentResult.content);

    const warnings = [...metadataResult.warnings, ...contentResult.warnings];
    if (pathResult.collisionCount > 0) {
      warnings.push(
        `Path collision policy: resolved ${pathResult.collisionCount} collision(s) for note title "${pathResult.normalizedTitle}".`
      );
    }

    return {
      notePath: pathResult.notePath,
      createdAt: new Date().toISOString(),
      warnings
    };
  }

  private renderBuiltinNote(data: TemplateData, bodyMarkdown: string): ContentBuildResult {
    return {
      content: normalizeTemplateOutput([buildDefaultFrontmatter(data), bodyMarkdown].join("\n")),
      warnings: []
    };
  }

  private renderCustomTemplateNote(
    templateBody: string,
    data: TemplateData,
    transcriptMarkdown: string
  ): ContentBuildResult {
    const warnings: string[] = [];
    const unknownPlaceholders = findUnknownPlaceholders(templateBody);
    if (unknownPlaceholders.length > 0) {
      warnings.push(
        `Template renderer: unknown placeholder(s) left unchanged: ${Array.from(new Set(unknownPlaceholders)).join(", ")}.`
      );
    }

    const templateHasFrontmatter = hasFrontmatter(templateBody);
    const hasSummaryPlaceholder = templateBody.includes("{{summary}}");
    const hasTranscriptPlaceholder = templateBody.includes("{{transcript}}");
    const renderedTemplate = applyTemplate(templateBody, data);
    const contentParts = templateHasFrontmatter
      ? [renderedTemplate.trim()]
      : [buildDefaultFrontmatter(data).trim(), "", renderedTemplate.trim()];

    if (!templateHasFrontmatter) {
      warnings.push("Template renderer: custom template did not include frontmatter; default frontmatter was added.");
    }

    if (!hasSummaryPlaceholder) {
      contentParts.push("", data.summary);
      warnings.push("Template renderer: custom template did not include {{summary}}; summary was appended.");
    }
    const normalizedTranscriptMarkdown = normalizeToTraditionalChinese(transcriptMarkdown.trim()).value;
    if (!hasTranscriptPlaceholder && normalizedTranscriptMarkdown.length > 0) {
      contentParts.push("", "## Transcript", "", normalizedTranscriptMarkdown);
      warnings.push("Template renderer: custom template did not include {{transcript}}; transcript was appended.");
    }

    return {
      content: normalizeTemplateOutput(contentParts.join("\n")),
      warnings
    };
  }

  private async buildContent(
    data: TemplateData,
    bodyMarkdown: string,
    transcriptMarkdown: string
  ): Promise<ContentBuildResult> {
    const templateReference = normalizeTemplateReference(this.options.templateReference);
    const builtinTemplateBody = resolveBuiltinTemplate(templateReference);
    if (builtinTemplateBody) {
      return this.renderBuiltinNote(data, bodyMarkdown);
    }

    const templatePath = getCustomTemplatePath(templateReference);
    const templateBody = await this.storage.readTemplate(templatePath);

    if (templateBody) {
      return this.renderCustomTemplateNote(templateBody, data, transcriptMarkdown);
    }

    return {
      content: normalizeTemplateOutput([buildDefaultFrontmatter(data), bodyMarkdown].join("\n")),
      warnings: [`Template resolver: custom template was not found; used ${normalizeTemplateReference("")}.`]
    };
  }
}
