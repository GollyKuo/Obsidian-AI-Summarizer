import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SummarizerError } from "@domain/errors";
import type { SourceMetadata } from "@domain/types";
import { throwIfCancelled } from "@orchestration/cancellation";
import {
  assertMediaDependenciesReady,
  type MediaRuntimeDependencyDiagnostics
} from "@services/media/dependency-readiness";
import type {
  MediaDownloadArtifacts,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import {
  resolveMediaCacheRoot,
  type MediaCacheRootResolution
} from "@services/media/media-cache-root";
import {
  buildInitialArtifactManifest,
  writeArtifactManifest
} from "@services/media/artifact-manifest";

export interface LocalMediaIngestionRequest {
  sourcePath: string;
  mediaCacheRoot: string;
  vaultId: string;
}

export interface LocalMediaIngestionSession extends MediaDownloadSession {
  localSourcePath: string;
}

export interface LocalMediaIngestionAdapter {
  prepareSession(
    input: LocalMediaIngestionRequest,
    signal: AbortSignal
  ): Promise<LocalMediaIngestionSession>;
  ingestMedia(
    session: LocalMediaIngestionSession,
    signal: AbortSignal
  ): Promise<MediaDownloadResult>;
}

interface LocalMediaIngestionAdapterOptions {
  dependencyChecker?: () => Promise<MediaRuntimeDependencyDiagnostics>;
  cacheRootResolver?: (configuredPath: string) => Promise<MediaCacheRootResolution>;
  mkdir?: (targetPath: string) => Promise<void>;
  stat?: (targetPath: string) => Promise<{ isFile: () => boolean; size: number; mtimeMs: number }>;
  copyFile?: (fromPath: string, toPath: string) => Promise<void>;
  writeFile?: (targetPath: string, content: string) => Promise<void>;
  now?: () => Date;
  randomHex?: (bytes: number) => string;
}

const SUPPORTED_LOCAL_MEDIA_EXTENSIONS = new Set<string>([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".opus",
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".m4v"
]);

const SUPPORTED_LOCAL_MEDIA_EXTENSION_LABEL = Array.from(SUPPORTED_LOCAL_MEDIA_EXTENSIONS)
  .sort()
  .join(", ");
const MAX_LOCAL_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;

function sanitizeVaultId(rawVaultId: string): string {
  const trimmed = rawVaultId.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "vaultId is required for local media session isolation.",
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

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeAbortError = error as { name?: unknown; code?: unknown };
  return maybeAbortError.name === "AbortError" || maybeAbortError.code === "ABORT_ERR";
}

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === "string" && maybeCode.length > 0) {
    return maybeCode;
  }
  return null;
}

function normalizeLocalSourcePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Local media path is empty.",
      recoverable: true
    });
  }

  if (!path.isAbsolute(trimmed)) {
    throw new SummarizerError({
      category: "validation_error",
      message: `Local media path must be absolute: ${trimmed}`,
      recoverable: true
    });
  }

  return path.resolve(trimmed);
}

function inferDownloadExtension(localSourcePath: string): string {
  const extension = path.extname(localSourcePath).toLowerCase();
  if (!SUPPORTED_LOCAL_MEDIA_EXTENSIONS.has(extension)) {
    throw new SummarizerError({
      category: "validation_error",
      message: `Unsupported local media extension "${extension || "(none)"}". Supported: ${SUPPORTED_LOCAL_MEDIA_EXTENSION_LABEL}`,
      recoverable: true
    });
  }
  return extension;
}

function sanitizeFilenameSegment(rawName: string): string {
  const sanitized = rawName
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.length > 0 ? sanitized : "local-media";
}

function buildLocalSourceArtifactPath(sessionDirectory: string, localSourcePath: string): string {
  const originalName = path.basename(localSourcePath);
  const extension = path.extname(localSourcePath);
  const sanitizedName = sanitizeFilenameSegment(originalName);
  if (path.extname(sanitizedName).length > 0) {
    return path.join(sessionDirectory, sanitizedName);
  }
  return path.join(sessionDirectory, `${sanitizedName}${extension.toLowerCase()}`);
}

function normalizeTitle(localSourcePath: string): string {
  const fileStem = path.basename(localSourcePath, path.extname(localSourcePath));
  if (fileStem.trim().length > 0) {
    return fileStem.replace(/[_-]+/g, " ").trim();
  }
  return "Local Media";
}

function normalizeCreated(mtimeMs: number, now: Date): string {
  if (Number.isFinite(mtimeMs) && mtimeMs > 0) {
    return new Date(mtimeMs).toISOString();
  }
  return now.toISOString();
}

function buildLocalMediaMetadata(
  session: LocalMediaIngestionSession,
  mtimeMs: number,
  now: Date
): SourceMetadata {
  return {
    title: normalizeTitle(session.localSourcePath),
    creatorOrAuthor: "Local User",
    platform: "Local File",
    source: session.localSourcePath,
    created: normalizeCreated(mtimeMs, now)
  };
}

export function createLocalMediaIngestionAdapter(
  options: LocalMediaIngestionAdapterOptions = {}
): LocalMediaIngestionAdapter {
  const dependencyChecker = options.dependencyChecker ?? assertMediaDependenciesReady;
  const cacheRootResolver = options.cacheRootResolver ?? resolveMediaCacheRoot;
  const mkdir =
    options.mkdir ??
    (async (targetPath: string) => {
      await fs.mkdir(targetPath, { recursive: true });
    });
  const stat =
    options.stat ??
    (async (targetPath: string) => {
      return fs.stat(targetPath);
    });
  const copyFile =
    options.copyFile ??
    (async (fromPath: string, toPath: string) => {
      await fs.copyFile(fromPath, toPath);
    });
  const writeFile =
    options.writeFile ??
    (async (targetPath: string, content: string) => {
      await fs.writeFile(targetPath, content, "utf8");
    });
  const now = options.now ?? (() => new Date());
  const randomHex = options.randomHex ?? ((bytes: number) => randomBytes(bytes).toString("hex"));

  return {
    async prepareSession(
      input: LocalMediaIngestionRequest,
      signal: AbortSignal
    ): Promise<LocalMediaIngestionSession> {
      throwIfCancelled(signal);
      const dependencyDiagnostics = await dependencyChecker();
      throwIfCancelled(signal);

      const localSourcePath = normalizeLocalSourcePath(input.sourcePath);
      inferDownloadExtension(localSourcePath);
      const cacheRoot = await cacheRootResolver(input.mediaCacheRoot);
      const vaultId = sanitizeVaultId(input.vaultId);
      const sessionId = buildSessionId(now(), randomHex);
      const sessionDirectory = path.join(cacheRoot.rootPath, vaultId, sessionId);

      await mkdir(sessionDirectory);
      throwIfCancelled(signal);

      const artifacts: MediaDownloadArtifacts = {
        downloadedPath: buildLocalSourceArtifactPath(sessionDirectory, localSourcePath),
        normalizedAudioPath: path.join(sessionDirectory, "normalized.wav"),
        transcriptPath: path.join(sessionDirectory, "transcript.srt"),
        metadataPath: path.join(sessionDirectory, "metadata.json"),
        aiUploadDirectory: path.join(sessionDirectory, "ai-upload")
      };

      return {
        sessionId,
        source: {
          normalizedUrl: pathToFileURL(localSourcePath).toString(),
          sourceType: "direct_media",
          host: "localhost"
        },
        cacheRoot: cacheRoot.rootPath,
        sessionDirectory,
        artifacts,
        dependencyDiagnostics,
        localSourcePath
      };
    },

    async ingestMedia(
      session: LocalMediaIngestionSession,
      signal: AbortSignal
    ): Promise<MediaDownloadResult> {
      throwIfCancelled(signal);

      let sourceStatus: { isFile: () => boolean; size: number; mtimeMs: number };
      try {
        sourceStatus = await stat(session.localSourcePath);
      } catch (error) {
        const code = extractErrorCode(error);
        if (code === "ENOENT" || code === "ENOTDIR") {
          throw new SummarizerError({
            category: "validation_error",
            message: `Local media file does not exist: ${session.localSourcePath}`,
            recoverable: true,
            cause: error
          });
        }

        if (code === "EACCES" || code === "EPERM") {
          throw new SummarizerError({
            category: "validation_error",
            message: `Local media file is not accessible: ${session.localSourcePath}`,
            recoverable: true,
            cause: error
          });
        }

        throw new SummarizerError({
          category: "download_failure",
          message: `Local media stat failed: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: true,
          cause: error
        });
      }

      if (!sourceStatus.isFile()) {
        throw new SummarizerError({
          category: "validation_error",
          message: `Local media path must be a file: ${session.localSourcePath}`,
          recoverable: true
        });
      }

      if (sourceStatus.size <= 0) {
        throw new SummarizerError({
          category: "validation_error",
          message: `Local media file is empty: ${session.localSourcePath}`,
          recoverable: true
        });
      }

      if (sourceStatus.size > MAX_LOCAL_MEDIA_BYTES) {
        throw new SummarizerError({
          category: "validation_error",
          message: `Local media file exceeds v1 limit (${MAX_LOCAL_MEDIA_BYTES} bytes): ${session.localSourcePath}`,
          recoverable: true
        });
      }

      try {
        await copyFile(session.localSourcePath, session.artifacts.downloadedPath);
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          throw new SummarizerError({
            category: "cancellation",
            message: "Local media ingestion cancelled by user.",
            recoverable: true,
            cause: error
          });
        }

        throw new SummarizerError({
          category: "download_failure",
          message: `Local media copy failed: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: true,
          cause: error
        });
      }

      throwIfCancelled(signal);

      const warnings: string[] = [];
      const metadata = buildLocalMediaMetadata(session, sourceStatus.mtimeMs, now());
      try {
        await writeArtifactManifest(
          session.artifacts.metadataPath,
          buildInitialArtifactManifest({
            sessionId: session.sessionId,
            sourceType: "local_media",
            sourcePath: session.localSourcePath,
            metadata,
            sourceArtifactPath: session.artifacts.downloadedPath,
            normalizedAudioPath: session.artifacts.normalizedAudioPath,
            transcriptPath: session.artifacts.transcriptPath,
            warnings
          }),
          writeFile
        );
      } catch (error) {
        throw new SummarizerError({
          category: "download_failure",
          message: `Local media metadata persistence failed: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: true,
          cause: error
        });
      }

      return {
        downloadedPath: session.artifacts.downloadedPath,
        recoveredFromFailure: false,
        metadata,
        warnings
      };
    }
  };
}
