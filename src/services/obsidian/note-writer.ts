import type { MediaNoteInput, WebpageNoteInput, WriteResult } from "@domain/types";
import {
  applyTemplate,
  buildDefaultFrontmatter,
  type TemplateData
} from "@services/obsidian/template-resolver";
import { resolveBuiltinTemplate } from "@services/obsidian/template-library";
import { normalizeNoteMetadata } from "@services/obsidian/note-output-contract";
import { resolveUniqueNotePathWithDiagnostics } from "@services/obsidian/path-resolver";

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
    const content = await this.buildContent(
      {
        title: metadataResult.metadata.title,
        creatorOrAuthor: metadataResult.metadata.creatorOrAuthor,
        platform: metadataResult.metadata.platform,
        source: metadataResult.metadata.source,
        created: metadataResult.metadata.created
      },
      [input.summaryMarkdown, "", "## Transcript", "", input.transcriptMarkdown].join("\n")
    );
    await this.storage.write(pathResult.notePath, content);

    const warnings = [...metadataResult.warnings];
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
    const content = await this.buildContent(
      {
        title: metadataResult.metadata.title,
        creatorOrAuthor: metadataResult.metadata.creatorOrAuthor,
        platform: metadataResult.metadata.platform,
        source: metadataResult.metadata.source,
        created: metadataResult.metadata.created
      },
      input.summaryMarkdown
    );
    await this.storage.write(pathResult.notePath, content);

    const warnings = [...metadataResult.warnings];
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

  private async buildContent(data: TemplateData, bodyMarkdown: string): Promise<string> {
    const builtinTemplateBody = resolveBuiltinTemplate(this.options.templateReference);
    if (builtinTemplateBody) {
      return [buildDefaultFrontmatter(data), applyTemplate(builtinTemplateBody, data), "", bodyMarkdown].join("\n");
    }

    const templateBody = await this.storage.readTemplate(this.options.templateReference);

    if (templateBody) {
      return [applyTemplate(templateBody, data), "", bodyMarkdown].join("\n");
    }
    return [buildDefaultFrontmatter(data), bodyMarkdown].join("\n");
  }
}
