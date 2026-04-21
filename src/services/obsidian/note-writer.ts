import type { MediaNoteInput, WebpageNoteInput, WriteResult } from "@domain/types";
import {
  applyTemplate,
  buildDefaultFrontmatter,
  type TemplateData
} from "@services/obsidian/template-resolver";
import { resolveUniqueNotePath } from "@services/obsidian/path-resolver";

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
    const path = await resolveUniqueNotePath(this.storage, this.options.outputFolder, input.metadata.title);
    const content = await this.buildContent(
      {
        title: input.metadata.title,
        creatorOrAuthor: input.metadata.creatorOrAuthor,
        platform: input.metadata.platform,
        source: input.metadata.source,
        created: input.metadata.created
      },
      [input.summaryMarkdown, "", "## Transcript", "", input.transcriptMarkdown].join("\n")
    );
    await this.storage.write(path, content);
    return { notePath: path, createdAt: new Date().toISOString(), warnings: [] };
  }

  public async writeWebpageNote(input: WebpageNoteInput): Promise<WriteResult> {
    const path = await resolveUniqueNotePath(this.storage, this.options.outputFolder, input.metadata.title);
    const content = await this.buildContent(
      {
        title: input.metadata.title,
        creatorOrAuthor: input.metadata.creatorOrAuthor,
        platform: input.metadata.platform,
        source: input.metadata.source,
        created: input.metadata.created
      },
      input.summaryMarkdown
    );
    await this.storage.write(path, content);
    return { notePath: path, createdAt: new Date().toISOString(), warnings: [] };
  }

  private async buildContent(data: TemplateData, bodyMarkdown: string): Promise<string> {
    const templateBody = await this.storage.readTemplate(this.options.templateReference);
    if (templateBody) {
      return [applyTemplate(templateBody, data), "", bodyMarkdown].join("\n");
    }
    return [buildDefaultFrontmatter(data), bodyMarkdown].join("\n");
  }
}
