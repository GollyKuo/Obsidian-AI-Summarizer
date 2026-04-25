import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GYAN_RELEASE_BASE_URL = "https://www.gyan.dev/ffmpeg/builds";
const RELEASE_PACKAGE_NAME = "ffmpeg-release-essentials.zip";
const METADATA_FILE_NAME = "install-metadata.json";
const REQUEST_TIMEOUT_MS = 120_000;

export interface FfmpegToolInstallPaths {
  installRoot: string;
  binDirectory: string;
  ffmpegPath: string;
  ffprobePath: string;
}

export interface FfmpegToolInstallResult extends FfmpegToolInstallPaths {
  installed: boolean;
  version: string;
  sourceName: string;
  sourceUrl: string;
}

export interface FfmpegDownloadSource {
  name: string;
  url: string;
}

interface InstallMetadata {
  source: string;
  version: string;
  sha256: string;
  installedAt: string;
}

interface FfmpegToolInstallerOptions {
  platform?: NodeJS.Platform;
  signal?: AbortSignal;
  fetchText?: (url: string, signal?: AbortSignal) => Promise<string>;
  downloadFile?: (
    source: FfmpegDownloadSource,
    destinationPath: string,
    signal?: AbortSignal
  ) => Promise<void>;
  extractZip?: (archivePath: string, destinationDirectory: string) => Promise<void>;
  now?: () => Date;
  onDownloadAttempt?: (source: FfmpegDownloadSource) => void;
}

function getReleaseUrls(): { version: string; sha256: string; archive: string } {
  return {
    version: `${GYAN_RELEASE_BASE_URL}/${RELEASE_PACKAGE_NAME}.ver`,
    sha256: `${GYAN_RELEASE_BASE_URL}/${RELEASE_PACKAGE_NAME}.sha256`,
    archive: `${GYAN_RELEASE_BASE_URL}/${RELEASE_PACKAGE_NAME}`
  };
}

function getArchiveSources(version: string): FfmpegDownloadSource[] {
  return [
    {
      name: "GitHub mirror",
      url: `https://github.com/GyanD/codexffmpeg/releases/download/${version}/ffmpeg-${version}-essentials_build.zip`
    },
    {
      name: "gyan.dev",
      url: `${GYAN_RELEASE_BASE_URL}/${RELEASE_PACKAGE_NAME}`
    }
  ];
}

export function getProjectFfmpegToolPaths(
  pluginDirectory: string,
  platform: NodeJS.Platform = process.platform
): FfmpegToolInstallPaths {
  const installRoot = path.join(pluginDirectory, "tools", "ffmpeg");
  const binDirectory = path.join(installRoot, "bin");
  return {
    installRoot,
    binDirectory,
    ffmpegPath: path.join(binDirectory, platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    ffprobePath: path.join(binDirectory, platform === "win32" ? "ffprobe.exe" : "ffprobe")
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readInstallMetadata(installRoot: string): Promise<InstallMetadata | null> {
  try {
    const raw = await readFile(path.join(installRoot, METADATA_FILE_NAME), "utf8");
    const parsed = JSON.parse(raw) as Partial<InstallMetadata>;
    if (
      typeof parsed.version === "string" &&
      typeof parsed.sha256 === "string" &&
      typeof parsed.source === "string" &&
      typeof parsed.installedAt === "string"
    ) {
      return parsed as InstallMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeInstallMetadata(
  installRoot: string,
  metadata: InstallMetadata
): Promise<void> {
  await writeFile(path.join(installRoot, METADATA_FILE_NAME), JSON.stringify(metadata, null, 2), "utf8");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("ffmpeg/ffprobe install cancelled by user.");
  }
}

function requestUrl(url: string, signal?: AbortSignal): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("ffmpeg/ffprobe install cancelled by user."));
      return;
    }

    const request = (url.startsWith("https:") ? httpsGet : httpGet)(url, (response) => {
      const statusCode = response.statusCode ?? 0;
      const redirectUrl = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && redirectUrl) {
        response.resume();
        requestUrl(new URL(redirectUrl, url).toString(), signal).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Request failed (${statusCode}) for ${url}`));
        return;
      }

      resolve(response);
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${url}`));
    });
    const abortRequest = () => {
      request.destroy(new Error("ffmpeg/ffprobe install cancelled by user."));
    };
    signal?.addEventListener("abort", abortRequest, { once: true });
    request.on("error", reject);
  });
}

async function defaultFetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await requestUrl(url, signal);
  const chunks: Buffer[] = [];
  for await (const chunk of response) {
    throwIfAborted(signal);
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function defaultDownloadFile(
  source: FfmpegDownloadSource,
  destinationPath: string,
  signal?: AbortSignal
): Promise<void> {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  const response = await requestUrl(source.url, signal);
  await pipeline(response, createWriteStream(destinationPath), { signal });
}

async function defaultExtractZip(archivePath: string, destinationDirectory: string): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });
  try {
    await execFileAsync("tar", ["-xf", archivePath, "-C", destinationDirectory], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });
    return;
  } catch (tarError) {
    try {
      await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          "& { param($archive, $destination) Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force }",
          archivePath,
          destinationDirectory
        ],
        {
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
          windowsHide: true
        }
      );
      return;
    } catch (powershellError) {
      const tarMessage = tarError instanceof Error ? tarError.message : String(tarError);
      const powershellMessage =
        powershellError instanceof Error ? powershellError.message : String(powershellError);
      throw new Error(
        `Unable to extract ffmpeg ZIP. tar failed: ${tarMessage}; PowerShell failed: ${powershellMessage}`
      );
    }
  }
}

async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function normalizeSha256(raw: string): string {
  return raw.trim().split(/\s+/g)[0]?.toLowerCase() ?? "";
}

async function findFileByName(rootDirectory: string, fileName: string): Promise<string | null> {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDirectory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const found = await findFileByName(entryPath, fileName);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

async function hasCurrentInstall(
  paths: FfmpegToolInstallPaths,
  latestVersion: string,
  latestSha256: string
): Promise<boolean> {
  const [hasFfmpeg, hasFfprobe, metadata] = await Promise.all([
    pathExists(paths.ffmpegPath),
    pathExists(paths.ffprobePath),
    readInstallMetadata(paths.installRoot)
  ]);

  return (
    hasFfmpeg &&
    hasFfprobe &&
    metadata?.version === latestVersion &&
    metadata.sha256.toLowerCase() === latestSha256.toLowerCase()
  );
}

async function downloadVerifiedArchive(
  sources: FfmpegDownloadSource[],
  archivePath: string,
  expectedSha256: string,
  downloadFile: NonNullable<FfmpegToolInstallerOptions["downloadFile"]>,
  signal: AbortSignal | undefined,
  onDownloadAttempt: FfmpegToolInstallerOptions["onDownloadAttempt"]
): Promise<FfmpegDownloadSource> {
  const failures: string[] = [];

  for (const source of sources) {
    throwIfAborted(signal);
    onDownloadAttempt?.(source);

    try {
      await rm(archivePath, { force: true });
      await downloadFile(source, archivePath, signal);
      throwIfAborted(signal);

      const archiveSha256 = await hashFileSha256(archivePath);
      if (archiveSha256 !== expectedSha256) {
        throw new Error(
          `SHA-256 mismatch for ${source.name}: expected ${expectedSha256}, got ${archiveSha256}.`
        );
      }

      return source;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${source.name}: ${message}`);
    }
  }

  throw new Error(`Unable to download verified ffmpeg package. ${failures.join(" | ")}`);
}

export async function ensureLatestProjectFfmpegTools(
  pluginDirectory: string,
  options: FfmpegToolInstallerOptions = {}
): Promise<FfmpegToolInstallResult> {
  const signal = options.signal;
  throwIfAborted(signal);

  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    throw new Error("Automatic ffmpeg/ffprobe download is currently supported on Windows desktop only.");
  }

  const fetchText = options.fetchText ?? defaultFetchText;
  const downloadFile = options.downloadFile ?? defaultDownloadFile;
  const extractZip = options.extractZip ?? defaultExtractZip;
  const now = options.now ?? (() => new Date());
  const urls = getReleaseUrls();
  const latestVersion = (await fetchText(urls.version, signal)).trim();
  const latestSha256 = normalizeSha256(await fetchText(urls.sha256, signal));
  if (!latestVersion || !latestSha256) {
    throw new Error("Unable to read latest ffmpeg release metadata.");
  }

  const paths = getProjectFfmpegToolPaths(pluginDirectory, platform);
  await mkdir(paths.installRoot, { recursive: true });

  if (await hasCurrentInstall(paths, latestVersion, latestSha256)) {
    return {
      ...paths,
      installed: false,
      version: latestVersion,
      sourceName: "existing install",
      sourceUrl: ""
    };
  }

  const tempDirectory = path.join(paths.installRoot, ".download");
  const stagingDirectory = path.join(tempDirectory, "staging");
  const archivePath = path.join(tempDirectory, RELEASE_PACKAGE_NAME);
  await rm(tempDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });

  try {
    const selectedSource = await downloadVerifiedArchive(
      getArchiveSources(latestVersion),
      archivePath,
      latestSha256,
      downloadFile,
      signal,
      options.onDownloadAttempt
    );

    throwIfAborted(signal);
    await extractZip(archivePath, stagingDirectory);
    const ffmpegSource = await findFileByName(stagingDirectory, "ffmpeg.exe");
    const ffprobeSource = await findFileByName(stagingDirectory, "ffprobe.exe");
    if (!ffmpegSource || !ffprobeSource) {
      throw new Error("Downloaded ffmpeg package did not contain ffmpeg.exe and ffprobe.exe.");
    }

    await mkdir(paths.binDirectory, { recursive: true });
    await copyFile(ffmpegSource, paths.ffmpegPath);
    await copyFile(ffprobeSource, paths.ffprobePath);
    await writeInstallMetadata(paths.installRoot, {
      source: selectedSource.url,
      version: latestVersion,
      sha256: latestSha256,
      installedAt: now().toISOString()
    });

    return {
      ...paths,
      installed: true,
      version: latestVersion,
      sourceName: selectedSource.name,
      sourceUrl: selectedSource.url
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
