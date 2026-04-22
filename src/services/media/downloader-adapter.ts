import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
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

export interface MediaDownloadResult {
  downloadedPath: string;
  recoveredFromFailure: boolean;
  warnings: string[];
}

export interface DownloaderAdapter {
  prepareSession(input: MediaDownloadRequest, signal: AbortSignal): Promise<MediaDownloadSession>;
  downloadMedia(session: MediaDownloadSession, signal: AbortSignal): Promise<MediaDownloadResult>;
}

interface ExecCommandResult {
  stdout: string;
  stderr: string;
}

type CommandExecutor = (
  command: string,
  args: string[],
  signal: AbortSignal
) => Promise<ExecCommandResult>;

interface DownloaderAdapterOptions {
  dependencyChecker?: () => Promise<MediaRuntimeDependencyDiagnostics>;
  cacheRootResolver?: (configuredPath: string) => Promise<MediaCacheRootResolution>;
  urlClassifier?: (rawUrl: string) => MediaUrlClassification;
  mkdir?: (targetPath: string) => Promise<void>;
  commandExecutor?: CommandExecutor;
  readdir?: (targetPath: string) => Promise<string[]>;
  stat?: (targetPath: string) => Promise<{ isFile: () => boolean; mtimeMs: number }>;
  now?: () => Date;
  randomHex?: (bytes: number) => string;
}

const execFileAsync = promisify(execFile);

async function defaultCommandExecutor(
  command: string,
  args: string[],
  signal: AbortSignal
): Promise<ExecCommandResult> {
  const result = await execFileAsync(command, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
    timeout: 1000 * 60 * 10,
    signal
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
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

function firstNonEmptyLine(...blocks: string[]): string {
  for (const block of blocks) {
    const line = block
      .split(/\r?\n/g)
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0);
    if (line) {
      return line;
    }
  }
  return "";
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeAbortError = error as { name?: unknown; code?: unknown };
  return maybeAbortError.name === "AbortError" || maybeAbortError.code === "ABORT_ERR";
}

function isSpawnNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode === "ENOENT") {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ENOENT");
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function normalizeOutputPath(outputPath: string, sessionDirectory: string): string {
  const trimmed = outputPath.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  return path.normalize(path.join(sessionDirectory, trimmed));
}

function parseDownloadedPaths(stdout: string, sessionDirectory: string): string[] {
  return uniquePaths(
    stdout
      .split(/\r?\n/g)
      .map((line) => normalizeOutputPath(line, sessionDirectory))
      .filter((candidate) => candidate.length > 0)
      .filter((candidate) => candidate.startsWith(path.normalize(sessionDirectory + path.sep)))
  );
}

function buildYtDlpDownloadArgs(sourceUrl: string, sessionDirectory: string): string[] {
  return [
    "--no-playlist",
    "--no-progress",
    "--print",
    "after_move:filepath",
    "--output",
    path.join(sessionDirectory, "downloaded.%(ext)s"),
    sourceUrl
  ];
}

async function fileExists(
  targetPath: string,
  stat: (targetPath: string) => Promise<{ isFile: () => boolean }>
): Promise<boolean> {
  try {
    const status = await stat(targetPath);
    return status.isFile();
  } catch {
    return false;
  }
}

async function resolveDownloadedArtifactPath(
  session: MediaDownloadSession,
  parsedOutputPaths: string[],
  readdir: (targetPath: string) => Promise<string[]>,
  stat: (targetPath: string) => Promise<{ isFile: () => boolean; mtimeMs: number }>
): Promise<string | null> {
  for (const parsedPath of parsedOutputPaths) {
    if (await fileExists(parsedPath, stat)) {
      return parsedPath;
    }
  }

  const files = await readdir(session.sessionDirectory);
  const candidates = await Promise.all(
    files
      .filter((name) => name.startsWith("downloaded."))
      .filter((name) => !name.endsWith(".part"))
      .filter((name) => !name.endsWith(".ytdl"))
      .map(async (name) => {
        const absolutePath = path.join(session.sessionDirectory, name);
        const status = await stat(absolutePath);
        return status.isFile() ? { absolutePath, mtimeMs: status.mtimeMs } : null;
      })
  );

  const validCandidates = candidates
    .filter((entry): entry is { absolutePath: string; mtimeMs: number } => entry !== null)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (validCandidates.length === 0) {
    return null;
  }

  return validCandidates[0].absolutePath;
}

interface CommandFailureDetails {
  stdout: string;
  stderr: string;
}

function extractCommandFailureDetails(error: unknown): CommandFailureDetails {
  const details = error as { stdout?: unknown; stderr?: unknown };
  const stdout = typeof details?.stdout === "string" ? details.stdout : "";
  const stderr = typeof details?.stderr === "string" ? details.stderr : "";
  return { stdout, stderr };
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
  const commandExecutor = options.commandExecutor ?? defaultCommandExecutor;
  const readdir = options.readdir ?? ((targetPath: string) => fs.readdir(targetPath));
  const stat =
    options.stat ??
    (async (targetPath: string) => {
      return fs.stat(targetPath);
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
    },

    async downloadMedia(session: MediaDownloadSession, signal: AbortSignal): Promise<MediaDownloadResult> {
      throwIfCancelled(signal);

      const args = buildYtDlpDownloadArgs(session.source.normalizedUrl, session.sessionDirectory);

      try {
        const result = await commandExecutor("yt-dlp", args, signal);
        throwIfCancelled(signal);

        const parsedPaths = parseDownloadedPaths(result.stdout, session.sessionDirectory);
        const resolvedPath = await resolveDownloadedArtifactPath(session, parsedPaths, readdir, stat);

        if (!resolvedPath) {
          throw new SummarizerError({
            category: "download_failure",
            message: "yt-dlp finished but no downloaded artifact was found in session directory.",
            recoverable: false
          });
        }

        return {
          downloadedPath: resolvedPath,
          recoveredFromFailure: false,
          warnings: []
        };
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          throw new SummarizerError({
            category: "cancellation",
            message: "Media download cancelled by user.",
            recoverable: true,
            cause: error
          });
        }

        if (isSpawnNotFoundError(error)) {
          throw new SummarizerError({
            category: "runtime_unavailable",
            message: "yt-dlp is unavailable when executing media download.",
            recoverable: false,
            cause: error
          });
        }

        const failureDetails = extractCommandFailureDetails(error);
        const parsedPaths = parseDownloadedPaths(failureDetails.stdout, session.sessionDirectory);
        const resolvedPath = await resolveDownloadedArtifactPath(session, parsedPaths, readdir, stat);

        if (resolvedPath) {
          const fallbackMessage =
            firstNonEmptyLine(failureDetails.stderr, failureDetails.stdout) ||
            "yt-dlp returned non-zero exit code but artifact is present.";

          return {
            downloadedPath: resolvedPath,
            recoveredFromFailure: true,
            warnings: [`Recovered download from yt-dlp failure: ${fallbackMessage}`]
          };
        }

        const failureMessage =
          firstNonEmptyLine(failureDetails.stderr, failureDetails.stdout) ||
          (error instanceof Error ? error.message : String(error));

        throw new SummarizerError({
          category: "download_failure",
          message: `Media download failed: ${failureMessage}`,
          recoverable: true,
          cause: error
        });
      }
    }
  };
}
