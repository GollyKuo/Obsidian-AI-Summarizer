import { randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SummarizerError } from "@domain/errors";

export interface MediaCacheRootResolution {
  rootPath: string;
  usedDefault: boolean;
}

interface ResolveMediaCacheRootOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
}

const MEDIA_CACHE_SUBDIR_WIN32 = path.join("ObsidianAI-Summarizer", "media-cache");
const MEDIA_CACHE_SUBDIR_POSIX = path.join("obsidian-ai-summarizer", "media-cache");

export function validateMediaCacheRootPath(configuredPath: string): string {
  const trimmed = configuredPath.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (!path.isAbsolute(trimmed)) {
    throw new SummarizerError({
      category: "validation_error",
      message: `mediaCacheRoot must be an absolute path: ${trimmed}`,
      recoverable: true
    });
  }

  return path.resolve(trimmed);
}

export function resolveDefaultMediaCacheRoot(options: ResolveMediaCacheRootOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir();

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || path.join(homedir, "AppData", "Local");
    return path.join(localAppData, MEDIA_CACHE_SUBDIR_WIN32);
  }

  if (platform === "darwin") {
    return path.join(homedir, "Library", "Caches", MEDIA_CACHE_SUBDIR_POSIX);
  }

  const xdgCacheHome = env.XDG_CACHE_HOME || path.join(homedir, ".cache");
  return path.join(xdgCacheHome, MEDIA_CACHE_SUBDIR_POSIX);
}

export async function assertDirectoryWritable(directoryPath: string): Promise<void> {
  await fs.mkdir(directoryPath, { recursive: true });
  await fs.access(directoryPath, constants.W_OK);

  const probeFilePath = path.join(directoryPath, `.write-probe-${randomUUID()}.tmp`);
  await fs.writeFile(probeFilePath, "ok", { encoding: "utf8" });
  await fs.rm(probeFilePath, { force: true });
}

export async function resolveMediaCacheRoot(
  configuredPath: string,
  options: ResolveMediaCacheRootOptions = {}
): Promise<MediaCacheRootResolution> {
  const normalizedConfigured = validateMediaCacheRootPath(configuredPath);
  const usedDefault = normalizedConfigured.length === 0;
  const rootPath = usedDefault
    ? resolveDefaultMediaCacheRoot(options)
    : normalizedConfigured;

  try {
    await assertDirectoryWritable(rootPath);
  } catch (error) {
    throw new SummarizerError({
      category: usedDefault ? "runtime_unavailable" : "validation_error",
      message: usedDefault
        ? `Default media cache root is not writable: ${rootPath}`
        : `Configured media cache root is not writable: ${rootPath}`,
      recoverable: !usedDefault,
      cause: error
    });
  }

  return {
    rootPath,
    usedDefault
  };
}
