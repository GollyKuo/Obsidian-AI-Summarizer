import type { SourceMetadata } from "@domain/types";

export interface NoteMetadataNormalizationResult {
  metadata: SourceMetadata;
  warnings: string[];
}

interface NoteMetadataNormalizationOptions {
  now?: () => Date;
}

function normalizeSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCreated(rawCreated: string, now: () => Date): { created: string; warning: string | null } {
  const normalized = normalizeSingleLine(rawCreated);
  if (normalized.length === 0) {
    return {
      created: now().toISOString(),
      warning: "Note metadata contract: created timestamp was missing and has been regenerated."
    };
  }

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return {
      created: now().toISOString(),
      warning: "Note metadata contract: created timestamp was invalid and has been regenerated."
    };
  }

  return {
    created: new Date(parsed).toISOString(),
    warning: null
  };
}

export function normalizeNoteMetadata(
  metadata: SourceMetadata,
  options: NoteMetadataNormalizationOptions = {}
): NoteMetadataNormalizationResult {
  const now = options.now ?? (() => new Date());
  const warnings: string[] = [];

  const title = normalizeSingleLine(metadata.title) || "Untitled";
  const creatorOrAuthor = normalizeSingleLine(metadata.creatorOrAuthor) || "Unknown";
  const platform = normalizeSingleLine(metadata.platform) || "Unknown";
  const source = normalizeSingleLine(metadata.source) || "unknown-source";
  const createdResult = normalizeCreated(metadata.created, now);

  if (title !== metadata.title.trim()) {
    warnings.push("Note metadata contract: title has been normalized.");
  }
  if (creatorOrAuthor !== metadata.creatorOrAuthor.trim()) {
    warnings.push("Note metadata contract: creator/author has been normalized.");
  }
  if (platform !== metadata.platform.trim()) {
    warnings.push("Note metadata contract: platform has been normalized.");
  }
  if (source !== metadata.source.trim()) {
    warnings.push("Note metadata contract: source has been normalized.");
  }
  if (createdResult.warning) {
    warnings.push(createdResult.warning);
  }

  return {
    metadata: {
      title,
      creatorOrAuthor,
      platform,
      source,
      created: createdResult.created
    },
    warnings
  };
}
