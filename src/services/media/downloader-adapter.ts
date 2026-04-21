import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import { throwIfCancelled } from "@orchestration/cancellation";
import {
  assertMediaDependenciesReady,
  type MediaRuntimeDependencyDiagnostics
} from "@services/media/dependency-readiness";
import {
  classifyMediaUrl,
  type MediaUrlClassification,
  type MediaUrlSourceType
} from "@services/media/url-classifier";
import {
  resolveMediaCacheRoot,
  type MediaCacheRootResolution
} from "@services/media/media-cache-root";

export interface MediaDownloadRequest {
  sourceUrl: string;
  mediaCacheRoot: string;
  vaultId: string;
}

export interface MediaDownloadArtifacts {
  downloadedPath: string;
  normalizedAudioPath: string;
  transcriptPath: string;
  metadataPath: string;
  aiUploadDirectory: string;
}

export interface MediaDownloadSession {
  sessionId: string;
  source: MediaUrlClassification;
  cacheRoot: string;
  sessionDirectory: string;
  artifacts: MediaDownloadArtifacts;
  dependencyDiagnostics: MediaRuntimeDependencyDiagnostics;
}

export interface DownloaderAdapter {
  prepareSession(input: MediaDownloadRequest, signal: AbortSignal): Promise<MediaDownloadSession>;
}

interface DownloaderAdapterOptions {
  dependencyChecker?: () => Promise<MediaRuntimeDependencyDiagnostics>;
  cacheRootResolver?: (configuredPath: string) => Promise<MediaCacheRootResolution>;
  urlClassifier?: (rawUrl: string) => MediaUrlClassification;
  mkdir?: (targetPath: string) => Promise<void>;
  now?: () => Date;
  randomHex?: (bytes: number) => string;
}

function sanitizeVaultId(rawVaultId: string): string {
  const trimmed = rawVaultId.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "vaultId is required for media session isolation.",
      recoverable: true
    });
  }

  return trimmed
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function buildSessionId(now: Date, randomHex: (bytes: number) => string): string {
  const y = now.getFullYear();
  const m = twoDigits(now.getMonth() + 1);
  const d = twoDigits(now.getDate());
  const hh = twoDigits(now.getHours());
  const mm = twoDigits(now.getMinutes());
  const ss = twoDigits(now.getSeconds());
  return `${y}${m}${d}-${hh}${mm}${ss}-${randomHex(4)}`;
}

function inferDownloadExtension(sourceType: MediaUrlSourceType, normalizedUrl: string): string {
  if (sourceType === "youtube") {
    return ".mp4";
  }
  if (sourceType === "podcast") {
    return ".m4a";
  }

  const ext = path.extname(new URL(normalizedUrl).pathname).toLowerCase();
  return ext.length > 0 ? ext : ".bin";
}

export function createDownloaderAdapter(options: DownloaderAdapterOptions = {}): DownloaderAdapter {
  const dependencyChecker = options.dependencyChecker ?? assertMediaDependenciesReady;
  const cacheRootResolver = options.cacheRootResolver ?? resolveMediaCacheRoot;
  const urlClassifier = options.urlClassifier ?? classifyMediaUrl;
  const mkdir =
    options.mkdir ??
    (async (targetPath: string) => {
      await fs.mkdir(targetPath, { recursive: true });
    });
  const now = options.now ?? (() => new Date());
  const randomHex = options.randomHex ?? ((bytes: number) => randomBytes(bytes).toString("hex"));

  return {
    async prepareSession(input: MediaDownloadRequest, signal: AbortSignal): Promise<MediaDownloadSession> {
      throwIfCancelled(signal);
      const dependencyDiagnostics = await dependencyChecker();
      throwIfCancelled(signal);

      const source = urlClassifier(input.sourceUrl);
      const cacheRoot = await cacheRootResolver(input.mediaCacheRoot);
      const vaultId = sanitizeVaultId(input.vaultId);
      const sessionId = buildSessionId(now(), randomHex);
      const sessionDirectory = path.join(cacheRoot.rootPath, vaultId, sessionId);

      await mkdir(sessionDirectory);
      throwIfCancelled(signal);

      const downloadExtension = inferDownloadExtension(source.sourceType, source.normalizedUrl);
      const artifacts: MediaDownloadArtifacts = {
        downloadedPath: path.join(sessionDirectory, `downloaded${downloadExtension}`),
        normalizedAudioPath: path.join(sessionDirectory, "normalized.wav"),
        transcriptPath: path.join(sessionDirectory, "transcript.srt"),
        metadataPath: path.join(sessionDirectory, "metadata.json"),
        aiUploadDirectory: path.join(sessionDirectory, "ai-upload")
      };

      return {
        sessionId,
        source,
        cacheRoot: cacheRoot.rootPath,
        sessionDirectory,
        artifacts,
        dependencyDiagnostics
      };
    }
  };
}
