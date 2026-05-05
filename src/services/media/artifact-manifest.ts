import { promises as fs } from "node:fs";
import path from "node:path";
import type { SourceMetadata } from "@domain/types";
import type { MediaUrlSourceType } from "@services/media/url-classifier";
import type { PreUploadCompressionResult } from "@services/media/pre-upload-compressor";

export interface InitialArtifactManifestInput {
  sessionId: string;
  sourceType: MediaUrlSourceType | "local_media";
  sourceUrl?: string;
  sourcePath?: string;
  metadata: SourceMetadata;
  sourceArtifactPath: string;
  normalizedAudioPath: string;
  transcriptPath: string;
  rawTranscriptPath?: string;
  subtitlePath: string;
  warnings: string[];
}

export interface MediaArtifactManifest {
  sessionId: string;
  sourceType: MediaUrlSourceType | "local_media";
  sourceUrl?: string;
  sourcePath?: string;
  title: string;
  creatorOrAuthor: string;
  platform: string;
  createdAt: string;
  originalFilename: string;
  downloadedPath: string;
  sourceArtifactPath: string;
  normalizedAudioPath: string;
  transcriptPath: string;
  rawTranscriptPath?: string;
  subtitlePath: string;
  derivedArtifactPaths: string[];
  uploadArtifactPaths: string[];
  chunkCount: number;
  chunkDurationsMs: number[];
  vadApplied: boolean;
  selectedCodec: PreUploadCompressionResult["selectedCodec"] | null;
  remoteFiles?: RemoteFileLifecycleRecord[];
  warnings: string[];
}

export interface RemoteFileLifecycleRecord {
  provider: "Gemini";
  strategy: "files_api";
  localArtifactPath: string;
  name: string;
  uri: string;
  mimeType: string;
  state: string;
  createdAt: string;
  deletedAt?: string;
  deleteState?: "deleted" | "failed" | "skipped";
  warning?: string;
}

export type ArtifactManifestReadFailureReason = "missing" | "invalid_json" | "schema_mismatch";

export type ArtifactManifestReadResult =
  | {
      ok: true;
      manifest: Partial<MediaArtifactManifest> & Record<string, unknown>;
      warning: null;
    }
  | {
      ok: false;
      manifest: null;
      reason: ArtifactManifestReadFailureReason;
      warning: string;
    };

function isEnoent(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

function formatManifestReadWarning(
  metadataPath: string,
  reason: ArtifactManifestReadFailureReason
): string {
  const fileName = path.basename(metadataPath);
  if (reason === "missing") {
    return `Artifact manifest ${fileName} is missing; using recoverable fallback.`;
  }
  if (reason === "invalid_json") {
    return `Artifact manifest ${fileName} contains invalid JSON; using recoverable fallback.`;
  }
  return `Artifact manifest ${fileName} does not contain an object; using recoverable fallback.`;
}

export async function readArtifactManifest(
  metadataPath: string,
  readFile: (targetPath: string) => Promise<string> = async (targetPath) => {
    return fs.readFile(targetPath, "utf8");
  }
): Promise<ArtifactManifestReadResult> {
  let rawManifest: string;
  try {
    rawManifest = await readFile(metadataPath);
  } catch (error) {
    if (isEnoent(error)) {
      return {
        ok: false,
        manifest: null,
        reason: "missing",
        warning: formatManifestReadWarning(metadataPath, "missing")
      };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawManifest);
  } catch {
    return {
      ok: false,
      manifest: null,
      reason: "invalid_json",
      warning: formatManifestReadWarning(metadataPath, "invalid_json")
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      manifest: null,
      reason: "schema_mismatch",
      warning: formatManifestReadWarning(metadataPath, "schema_mismatch")
    };
  }

  return {
    ok: true,
    manifest: parsed as Partial<MediaArtifactManifest> & Record<string, unknown>,
    warning: null
  };
}

export function buildInitialArtifactManifest(
  input: InitialArtifactManifestInput
): MediaArtifactManifest {
  return {
    sessionId: input.sessionId,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    sourcePath: input.sourcePath,
    title: input.metadata.title,
    creatorOrAuthor: input.metadata.creatorOrAuthor,
    platform: input.metadata.platform,
    createdAt: input.metadata.created,
    originalFilename: path.basename(input.sourceArtifactPath),
    downloadedPath: input.sourceArtifactPath,
    sourceArtifactPath: input.sourceArtifactPath,
    normalizedAudioPath: input.normalizedAudioPath,
    transcriptPath: input.transcriptPath,
    rawTranscriptPath: input.rawTranscriptPath,
    subtitlePath: input.subtitlePath,
    derivedArtifactPaths: [],
    uploadArtifactPaths: [],
    chunkCount: 0,
    chunkDurationsMs: [],
    vadApplied: false,
    selectedCodec: null,
    remoteFiles: [],
    warnings: input.warnings
  };
}

export async function updateArtifactManifestWithRemoteFile(
  metadataPath: string,
  remoteFile: RemoteFileLifecycleRecord,
  writeFile: (targetPath: string, content: string) => Promise<void> = async (targetPath, content) => {
    await fs.writeFile(targetPath, content, "utf8");
  },
  readFile: (targetPath: string) => Promise<string> = async (targetPath) => {
    return fs.readFile(targetPath, "utf8");
  }
): Promise<string[]> {
  const manifestResult = await readArtifactManifest(metadataPath, readFile);
  if (!manifestResult.ok) {
    return [manifestResult.warning];
  }

  const manifest = manifestResult.manifest as MediaArtifactManifest;
  const remoteFiles = [...(manifest.remoteFiles ?? [])];
  const existingIndex = remoteFiles.findIndex(
    (item) => item.provider === remoteFile.provider && item.name === remoteFile.name
  );
  if (existingIndex >= 0) {
    remoteFiles[existingIndex] = {
      ...remoteFiles[existingIndex],
      ...remoteFile
    };
  } else {
    remoteFiles.push(remoteFile);
  }

  await writeArtifactManifest(
    metadataPath,
    {
      ...manifest,
      remoteFiles,
      warnings: remoteFile.warning
        ? [...(manifest.warnings ?? []), remoteFile.warning]
        : manifest.warnings
    },
    writeFile
  );
  return [];
}

export function getRemoteFileCleanupCandidates(
  manifest: Pick<MediaArtifactManifest, "remoteFiles"> | null | undefined
): RemoteFileLifecycleRecord[] {
  return (manifest?.remoteFiles ?? []).filter(
    (remoteFile) => remoteFile.deleteState !== "deleted" && remoteFile.name.trim().length > 0
  );
}

export async function updateArtifactManifestWithTranscriptArtifacts(
  metadataPath: string,
  input: {
    transcriptPath: string;
    rawTranscriptPath?: string;
    subtitlePath: string;
  },
  writeFile: (targetPath: string, content: string) => Promise<void> = async (targetPath, content) => {
    await fs.writeFile(targetPath, content, "utf8");
  },
  readFile: (targetPath: string) => Promise<string> = async (targetPath) => {
    return fs.readFile(targetPath, "utf8");
  }
): Promise<string[]> {
  const manifestResult = await readArtifactManifest(metadataPath, readFile);
  if (!manifestResult.ok) {
    return [manifestResult.warning];
  }

  const manifest = manifestResult.manifest as MediaArtifactManifest;
  await writeArtifactManifest(
    metadataPath,
    {
      ...manifest,
      transcriptPath: input.transcriptPath,
      rawTranscriptPath: input.rawTranscriptPath ?? manifest.rawTranscriptPath,
      subtitlePath: input.subtitlePath
    },
    writeFile
  );
  return [];
}

export async function writeArtifactManifest(
  metadataPath: string,
  manifest: MediaArtifactManifest,
  writeFile: (targetPath: string, content: string) => Promise<void>
): Promise<void> {
  await writeFile(metadataPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function updateArtifactManifestWithCompression(
  metadataPath: string,
  compressionResult: PreUploadCompressionResult,
  writeFile: (targetPath: string, content: string) => Promise<void> = async (targetPath, content) => {
    await fs.writeFile(targetPath, content, "utf8");
  },
  readFile: (targetPath: string) => Promise<string> = async (targetPath) => {
    return fs.readFile(targetPath, "utf8");
  }
): Promise<string[]> {
  const manifestResult = await readArtifactManifest(metadataPath, readFile);
  if (!manifestResult.ok) {
    return [manifestResult.warning];
  }

  const manifest = manifestResult.manifest as MediaArtifactManifest;
  const nextManifest: MediaArtifactManifest = {
    ...manifest,
    normalizedAudioPath: compressionResult.normalizedAudioPath,
    derivedArtifactPaths: [compressionResult.normalizedAudioPath],
    uploadArtifactPaths: compressionResult.aiUploadArtifactPaths,
    chunkCount: compressionResult.chunkCount,
    chunkDurationsMs: compressionResult.chunkDurationsMs,
    vadApplied: compressionResult.vadApplied,
    selectedCodec: compressionResult.selectedCodec,
    warnings: [...(manifest.warnings ?? []), ...compressionResult.warnings]
  };

  await writeArtifactManifest(metadataPath, nextManifest, writeFile);
  return [];
}
