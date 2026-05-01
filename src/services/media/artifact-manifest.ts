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
  subtitlePath: string;
  derivedArtifactPaths: string[];
  uploadArtifactPaths: string[];
  chunkCount: number;
  chunkDurationsMs: number[];
  vadApplied: boolean;
  selectedCodec: PreUploadCompressionResult["selectedCodec"] | null;
  warnings: string[];
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
    subtitlePath: input.subtitlePath,
    derivedArtifactPaths: [],
    uploadArtifactPaths: [],
    chunkCount: 0,
    chunkDurationsMs: [],
    vadApplied: false,
    selectedCodec: null,
    warnings: input.warnings
  };
}

export async function updateArtifactManifestWithTranscriptArtifacts(
  metadataPath: string,
  input: {
    transcriptPath: string;
    subtitlePath: string;
  },
  writeFile: (targetPath: string, content: string) => Promise<void> = async (targetPath, content) => {
    await fs.writeFile(targetPath, content, "utf8");
  },
  readFile: (targetPath: string) => Promise<string> = async (targetPath) => {
    return fs.readFile(targetPath, "utf8");
  }
): Promise<void> {
  let rawManifest: string;
  try {
    rawManifest = await readFile(metadataPath);
  } catch (error) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT") {
      return;
    }
    throw error;
  }

  const manifest = JSON.parse(rawManifest) as MediaArtifactManifest;
  await writeArtifactManifest(
    metadataPath,
    {
      ...manifest,
      transcriptPath: input.transcriptPath,
      subtitlePath: input.subtitlePath
    },
    writeFile
  );
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
): Promise<void> {
  let rawManifest: string;
  try {
    rawManifest = await readFile(metadataPath);
  } catch (error) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT") {
      return;
    }
    throw error;
  }

  const manifest = JSON.parse(rawManifest) as MediaArtifactManifest;
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
}
