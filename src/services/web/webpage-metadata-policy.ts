import type { SourceMetadata } from "@domain/types";

export interface WebpageMetadataPolicyResult {
  metadata: SourceMetadata;
  warnings: string[];
}

interface WebpageMetadataPolicyOptions {
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
      warning: "Webpage metadata policy: created timestamp was missing and has been regenerated."
    };
  }

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return {
      created: now().toISOString(),
      warning: "Webpage metadata policy: created timestamp was invalid and has been regenerated."
    };
  }

  return {
    created: new Date(parsed).toISOString(),
    warning: null
  };
}

export function applyWebpageMetadataPolicy(
  sourceUrl: string,
  metadata: SourceMetadata,
  options: WebpageMetadataPolicyOptions = {}
): WebpageMetadataPolicyResult {
  const now = options.now ?? (() => new Date());
  const warnings: string[] = [];

  const title = normalizeSingleLine(metadata.title) || "Untitled Webpage";
  const creatorOrAuthor = normalizeSingleLine(metadata.creatorOrAuthor) || "Unknown";
  const createdResult = normalizeCreated(metadata.created, now);

  if (metadata.platform.trim() !== "Web") {
    warnings.push("Webpage metadata policy: platform has been normalized to Web.");
  }
  if (metadata.source.trim() !== sourceUrl.trim()) {
    warnings.push("Webpage metadata policy: source has been normalized to input URL.");
  }
  if (createdResult.warning) {
    warnings.push(createdResult.warning);
  }

  return {
    metadata: {
      title,
      creatorOrAuthor,
      platform: "Web",
      source: sourceUrl.trim(),
      created: createdResult.created
    },
    warnings
  };
}
