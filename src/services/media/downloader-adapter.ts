import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import type { SourceMetadata } from "@domain/types";
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
import {
  buildInitialArtifactManifest,
  writeArtifactManifest
} from "@services/media/artifact-manifest";

export interface MediaDownloadRequest {
  sourceUrl: string;
  mediaCacheRoot: string;
  vaultId: string;
}

export interface MediaDownloadArtifacts {
  downloadedPath: string;
  normalizedAudioPath: string;
  transcriptPath: string;
  subtitlePath: string;
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
  metadata: SourceMetadata;
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
  ffmpegCommand?: string;
  mkdir?: (targetPath: string) => Promise<void>;
  writeFile?: (targetPath: string, content: string) => Promise<void>;
  commandExecutor?: CommandExecutor;
  readdir?: (targetPath: string) => Promise<string[]>;
  stat?: (targetPath: string) => Promise<{ isFile: () => boolean; mtimeMs: number }>;
  now?: () => Date;
  randomHex?: (bytes: number) => string;
}

const MAX_COMMAND_OUTPUT_CHARS = 1024 * 1024 * 8;
const COMMAND_TIMEOUT_MS = 1000 * 60 * 10;
const DOWNLOAD_PATH_PREFIX = "__DOWNLOADED_PATH__";
const METADATA_TITLE_PREFIX = "__META_TITLE__";
const METADATA_CREATOR_PREFIX = "__META_CREATOR__";
const METADATA_PLATFORM_PREFIX = "__META_PLATFORM__";
const METADATA_CREATED_PREFIX = "__META_CREATED__";

async function defaultCommandExecutor(
  command: string,
  args: string[],
  signal: AbortSignal
): Promise<ExecCommandResult> {
  return new Promise<ExecCommandResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const child = spawn(command, args, {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1"
      },
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    const finish = (finalizer: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      signal.removeEventListener("abort", onAbort);
      finalizer();
    };

    const rejectWithError = (error: unknown): void => {
      finish(() => reject(error));
    };

    const appendOutput = (existing: string, chunk: Buffer): string => {
      const merged = existing + chunk.toString("utf8");
      if (merged.length <= MAX_COMMAND_OUTPUT_CHARS) {
        return merged;
      }
      return merged.slice(merged.length - MAX_COMMAND_OUTPUT_CHARS);
    };

    const onAbort = (): void => {
      void terminateProcessTree(child.pid).finally(() => {
        const abortError = new Error("Command aborted by signal.") as Error & {
          name: string;
          code: string;
          stdout: string;
          stderr: string;
        };
        abortError.name = "AbortError";
        abortError.code = "ABORT_ERR";
        abortError.stdout = stdout;
        abortError.stderr = stderr;
        rejectWithError(abortError);
      });
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });

    timeoutHandle = setTimeout(() => {
      void terminateProcessTree(child.pid).finally(() => {
        const timeoutError = new Error(`Command timed out after ${COMMAND_TIMEOUT_MS}ms.`) as Error & {
          code: string;
          stdout: string;
          stderr: string;
        };
        timeoutError.code = "ETIMEDOUT";
        timeoutError.stdout = stdout;
        timeoutError.stderr = stderr;
        rejectWithError(timeoutError);
      });
    }, COMMAND_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk);
    });

    child.on("error", (error) => {
      rejectWithError(error);
    });

    child.on("close", (code, closeSignal) => {
      if (code === 0) {
        finish(() =>
          resolve({
            stdout,
            stderr
          })
        );
        return;
      }

      const commandError = new Error(
        `Command "${command}" failed with exit code ${code ?? "unknown"}${closeSignal ? ` (${closeSignal})` : ""}.`
      ) as Error & {
        code: number | string | null;
        stdout: string;
        stderr: string;
      };
      commandError.code = code ?? closeSignal ?? "UNKNOWN";
      commandError.stdout = stdout;
      commandError.stderr = stderr;
      rejectWithError(commandError);
    });
  });
}

async function terminateProcessTree(pid: number | undefined): Promise<void> {
  if (!pid || pid <= 0) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore"
      });
      killer.on("error", () => resolve());
      killer.on("close", () => resolve());
    });
    return;
  }

  const tryKill = (signal: NodeJS.Signals): void => {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // Fall through to direct pid kill.
    }

    try {
      process.kill(pid, signal);
    } catch {
      // Ignore when process has already exited.
    }
  };

  tryKill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 250));
  tryKill("SIGKILL");
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

interface ParsedYtDlpOutput {
  downloadedPaths: string[];
  metadata: {
    title?: string;
    creatorOrAuthor?: string;
    platform?: string;
    created?: string;
  };
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

function parseYtDlpOutput(stdout: string, sessionDirectory: string): ParsedYtDlpOutput {
  const metadata: ParsedYtDlpOutput["metadata"] = {};
  const pathLines: string[] = [];

  for (const line of stdout.split(/\r?\n/g).map((entry) => entry.trim())) {
    if (line.length === 0) {
      continue;
    }

    if (line.startsWith(DOWNLOAD_PATH_PREFIX)) {
      pathLines.push(line.slice(DOWNLOAD_PATH_PREFIX.length));
      continue;
    }

    if (line.startsWith(METADATA_TITLE_PREFIX)) {
      metadata.title = line.slice(METADATA_TITLE_PREFIX.length).trim();
      continue;
    }

    if (line.startsWith(METADATA_CREATOR_PREFIX)) {
      metadata.creatorOrAuthor = line.slice(METADATA_CREATOR_PREFIX.length).trim();
      continue;
    }

    if (line.startsWith(METADATA_PLATFORM_PREFIX)) {
      metadata.platform = line.slice(METADATA_PLATFORM_PREFIX.length).trim();
      continue;
    }

    if (line.startsWith(METADATA_CREATED_PREFIX)) {
      metadata.created = line.slice(METADATA_CREATED_PREFIX.length).trim();
      continue;
    }

    pathLines.push(line);
  }

  const downloadedPaths = uniquePaths(
    pathLines
      .map((line) => normalizeOutputPath(line, sessionDirectory))
      .filter((candidate) => candidate.length > 0)
      .filter((candidate) => candidate.startsWith(path.normalize(sessionDirectory + path.sep)))
  );

  return {
    downloadedPaths,
    metadata
  };
}

function buildYtDlpDownloadArgs(
  sourceUrl: string,
  sourceType: MediaUrlSourceType,
  sessionDirectory: string,
  ffmpegCommand: string
): string[] {
  const ffmpegLocationArgs =
    ffmpegCommand.trim().length > 0 ? ["--ffmpeg-location", ffmpegCommand.trim()] : [];
  const args = [
    "--encoding",
    "utf-8",
    "--no-playlist",
    "--no-progress",
    ...ffmpegLocationArgs,
    "--print",
    `before_dl:${METADATA_TITLE_PREFIX}%(title)s`,
    "--print",
    `before_dl:${METADATA_CREATOR_PREFIX}%(uploader|channel|creator|artist)s`,
    "--print",
    `before_dl:${METADATA_PLATFORM_PREFIX}%(extractor_key|extractor)s`,
    "--print",
    `before_dl:${METADATA_CREATED_PREFIX}%(upload_date|release_date)s`,
    "--print",
    `after_move:${DOWNLOAD_PATH_PREFIX}%(filepath)s`,
    "--output",
    path.join(sessionDirectory, "%(title).200B.%(ext)s"),
    sourceUrl
  ];

  if (sourceType !== "youtube") {
    return args;
  }

  return [
    "--format",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
    "--merge-output-format",
    "mp4",
    "--retries",
    "10",
    "--fragment-retries",
    "10",
    "--socket-timeout",
    "30",
    "--http-chunk-size",
    "10485760",
    "--continue",
    ...args
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
      .filter((name) => !name.endsWith(".part"))
      .filter((name) => !name.endsWith(".ytdl"))
      .filter((name) => name !== "metadata.json")
      .filter((name) => name !== "normalized.wav")
      .filter((name) => name !== "transcript.srt")
      .filter((name) => name !== "transcript.md")
      .filter((name) => name !== "subtitles.srt")
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

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (!value) {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function isYtDlpPlaceholderValue(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (lower === "na" || lower === "n/a" || lower === "none" || lower === "unknown") {
    return true;
  }

  return lower.includes("|") && /^[a-z_|]+$/.test(lower);
}

function containsUnicodeReplacementCharacter(value: string): boolean {
  return value.includes("\uFFFD");
}

function normalizeSourceTypePlatform(sourceType: MediaUrlSourceType): string {
  if (sourceType === "youtube") {
    return "YouTube";
  }
  if (sourceType === "podcast") {
    return "Podcast";
  }
  return "Direct Media";
}

function normalizePlatform(rawPlatform: string | undefined, sourceType: MediaUrlSourceType): string {
  const trimmed = rawPlatform?.trim() ?? "";
  if (trimmed.length === 0) {
    return normalizeSourceTypePlatform(sourceType);
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("youtube")) {
    return "YouTube";
  }
  if (lower.includes("spotify")) {
    return "Spotify";
  }
  if (lower.includes("soundcloud")) {
    return "SoundCloud";
  }
  if (lower === "generic") {
    return normalizeSourceTypePlatform(sourceType);
  }

  return trimmed;
}

function normalizeCreated(rawCreated: string | undefined, now: Date): string {
  const trimmed = rawCreated?.trim() ?? "";
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}T00:00:00.000Z`;
  }

  if (trimmed.length > 0) {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return now.toISOString();
}

function normalizeTitle(
  rawTitle: string | undefined,
  downloadedPath: string,
  sourceType: MediaUrlSourceType
): string {
  const explicitTitle = rawTitle?.trim() ?? "";
  if (
    explicitTitle.length > 0 &&
    !isYtDlpPlaceholderValue(explicitTitle) &&
    !containsUnicodeReplacementCharacter(explicitTitle)
  ) {
    return explicitTitle;
  }

  const fileStem = path.basename(downloadedPath, path.extname(downloadedPath));
  if (
    fileStem.length > 0 &&
    fileStem.toLowerCase() !== "downloaded" &&
    !containsUnicodeReplacementCharacter(fileStem)
  ) {
    return fileStem.replace(/[_-]+/g, " ").trim();
  }

  if (sourceType === "youtube") {
    return "YouTube Media";
  }
  if (sourceType === "podcast") {
    return "Podcast Episode";
  }
  return "Direct Media";
}

function normalizeCreatorOrAuthor(rawCreatorOrAuthor: string | undefined): string {
  const normalized = firstNonEmpty(rawCreatorOrAuthor);
  if (!normalized || isYtDlpPlaceholderValue(normalized)) {
    return "Unknown";
  }
  return normalized;
}

function normalizeMediaMetadata(
  session: MediaDownloadSession,
  downloadedPath: string,
  rawMetadata: ParsedYtDlpOutput["metadata"],
  now: Date
): SourceMetadata {
  return {
    title: normalizeTitle(rawMetadata.title, downloadedPath, session.source.sourceType),
    creatorOrAuthor: normalizeCreatorOrAuthor(rawMetadata.creatorOrAuthor),
    platform: normalizePlatform(rawMetadata.platform, session.source.sourceType),
    source: session.source.normalizedUrl,
    created: normalizeCreated(rawMetadata.created, now)
  };
}

async function buildDownloadResultWithMetadata(
  session: MediaDownloadSession,
  downloadedPath: string,
  recoveredFromFailure: boolean,
  warnings: string[],
  rawMetadata: ParsedYtDlpOutput["metadata"],
  signal: AbortSignal,
  writeFile: (targetPath: string, content: string) => Promise<void>,
  now: () => Date
): Promise<MediaDownloadResult> {
  try {
    throwIfCancelled(signal);
    const metadata = normalizeMediaMetadata(session, downloadedPath, rawMetadata, now());
    session.artifacts.downloadedPath = downloadedPath;

    await writeArtifactManifest(
      session.artifacts.metadataPath,
      buildInitialArtifactManifest({
        sessionId: session.sessionId,
        sourceType: session.source.sourceType,
        sourceUrl: session.source.normalizedUrl,
        metadata,
        sourceArtifactPath: downloadedPath,
        normalizedAudioPath: session.artifacts.normalizedAudioPath,
        transcriptPath: session.artifacts.transcriptPath,
        subtitlePath: session.artifacts.subtitlePath,
        warnings
      }),
      writeFile
    );
    throwIfCancelled(signal);

    return {
      downloadedPath,
      recoveredFromFailure,
      metadata,
      warnings
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

    if (error instanceof SummarizerError) {
      throw error;
    }

    const failureMessage = error instanceof Error ? error.message : String(error);
    throw new SummarizerError({
      category: "download_failure",
      message: `Media metadata persistence failed: ${failureMessage}`,
      recoverable: true,
      cause: error
    });
  }
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
  const writeFile =
    options.writeFile ??
    (async (targetPath: string, content: string) => {
      await fs.writeFile(targetPath, content, "utf8");
    });
  const commandExecutor = options.commandExecutor ?? defaultCommandExecutor;
  const ffmpegCommand = options.ffmpegCommand ?? "";
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
        transcriptPath: path.join(sessionDirectory, "transcript.md"),
        subtitlePath: path.join(sessionDirectory, "subtitles.srt"),
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

      const args = buildYtDlpDownloadArgs(
        session.source.normalizedUrl,
        session.source.sourceType,
        session.sessionDirectory,
        ffmpegCommand
      );
      let commandResult: ExecCommandResult;

      try {
        commandResult = await commandExecutor("yt-dlp", args, signal);
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
        const parsedOutput = parseYtDlpOutput(failureDetails.stdout, session.sessionDirectory);
        const resolvedPath = await resolveDownloadedArtifactPath(
          session,
          parsedOutput.downloadedPaths,
          readdir,
          stat
        );

        if (resolvedPath) {
          const fallbackMessage =
            firstNonEmptyLine(failureDetails.stderr, failureDetails.stdout) ||
            "yt-dlp returned non-zero exit code but artifact is present.";

          return buildDownloadResultWithMetadata(
            session,
            resolvedPath,
            true,
            [`Recovered download from yt-dlp failure: ${fallbackMessage}`],
            parsedOutput.metadata,
            signal,
            writeFile,
            now
          );
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

      throwIfCancelled(signal);
      const parsedOutput = parseYtDlpOutput(commandResult.stdout, session.sessionDirectory);
      const resolvedPath = await resolveDownloadedArtifactPath(
        session,
        parsedOutput.downloadedPaths,
        readdir,
        stat
      );

      if (!resolvedPath) {
        throw new SummarizerError({
          category: "download_failure",
          message: "yt-dlp finished but no downloaded artifact was found in session directory.",
          recoverable: false
        });
      }

      return buildDownloadResultWithMetadata(
        session,
        resolvedPath,
        false,
        [],
        parsedOutput.metadata,
        signal,
        writeFile,
        now
      );
    }
  };
}
