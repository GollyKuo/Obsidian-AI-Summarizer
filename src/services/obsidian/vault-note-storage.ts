import { normalizePath, TFile, type Vault } from "obsidian";
import type { NoteStorage } from "@services/obsidian/note-writer";

async function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized) {
    return;
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (vault.getAbstractFileByPath(current)) {
      continue;
    }
    await vault.createFolder(current);
  }
}

function parentFolderPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex === -1 ? "" : normalized.slice(0, slashIndex);
}

export class VaultNoteStorage implements NoteStorage {
  private readonly vault: Vault;

  public constructor(vault: Vault) {
    this.vault = vault;
  }

  public async exists(path: string): Promise<boolean> {
    return this.vault.getAbstractFileByPath(normalizePath(path)) !== null;
  }

  public async write(path: string, content: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    await ensureFolder(this.vault, parentFolderPath(normalizedPath));
    await this.vault.create(normalizedPath, content);
  }

  public async readTemplate(templateReference: string): Promise<string | null> {
    const normalizedPath = normalizePath(templateReference.trim());
    if (!normalizedPath) {
      return null;
    }

    const file = this.vault.getAbstractFileByPath(normalizedPath);
    if (!(file instanceof TFile)) {
      return null;
    }
    return this.vault.read(file);
  }
}
