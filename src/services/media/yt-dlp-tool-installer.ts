import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
const GITHUB_RELEASE_BASE_URL = "https://github.com/yt-dlp/yt-dlp/releases/download";
const EXECUTABLE_FILE_NAME = "yt-dlp.exe";
const CHECKSUM_FILE_NAME = "SHA2-256SUMS";
const METADATA_FILE_NAME = "install-metadata.json";
const REQUEST_TIMEOUT_MS = 120_000;

export interface YtDlpToolInstallPaths {
  installRoot: string;
  binDirectory: string;
  ytDlpPath: string;
}

export interface YtDlpToolInstallResult extends YtDlpToolInstallPaths {
  installed: boolean;
  version: string;
  sourceName: string;
  sourceUrl: string;
}

export interface YtDlpDownloadSource {
  name: string;
  url: string;
}

interface InstallMetadata {
  source: string;
  version: string;
  sha256: string;
  installedAt: string;
}

interface YtDlpToolInstallerOptions {
  platform?: NodeJS.Platform;
  signal?: AbortSignal;
  fetchText?: (url: string, signal?: AbortSignal) => Promise<string>;
  downloadFile?: (
    source: YtDlpDownloadSource,
    destinationPath: string,
    signal?: AbortSignal
  ) => Promise<void>;
  now?: () => Date;
  onDownloadAttempt?: (source: YtDlpDownloadSource) => void;
}

export function getProjectYtDlpToolPaths(
  pluginDirectory: string,
  platform: NodeJS.Platform = process.platform
): YtDlpToolInstallPaths {
  const installRoot = path.join(pluginDirectory, "tools", "yt-dlp");
  const binDirectory = path.join(installRoot, "bin");
  return {
    installRoot,
    binDirectory,
    ytDlpPath: path.join(binDirectory, platform === "win32" ? EXECUTABLE_FILE_NAME : "yt-dlp")
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("yt-dlp install cancelled by user.");
  }
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
  } catch {
    return null;
  }
  return null;
}

async function writeInstallMetadata(installRoot: string, metadata: InstallMetadata): Promise<void> {
  await writeFile(path.join(installRoot, METADATA_FILE_NAME), JSON.stringify(metadata, null, 2), "utf8");
}

function requestUrl(url: string, signal?: AbortSignal): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("yt-dlp install cancelled by user."));
      return;
    }

    let abortRequest: (() => void) | null = null;
    let settled = false;
    const cleanupAbortListener = () => {
      if (abortRequest) {
        signal?.removeEventListener("abort", abortRequest);
        abortRequest = null;
      }
    };
    const rejectWithCleanup = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupAbortListener();
      reject(error);
    };
    const resolveWithCleanup = (response: NodeJS.ReadableStream) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupAbortListener();
      resolve(response);
    };

    const request = (url.startsWith("https:") ? httpsGet : httpGet)(url, (response) => {
      const statusCode = response.statusCode ?? 0;
      const redirectUrl = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && redirectUrl) {
        response.resume();
        cleanupAbortListener();
        requestUrl(new URL(redirectUrl, url).toString(), signal).then(
          resolveWithCleanup,
          rejectWithCleanup
        );
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        rejectWithCleanup(new Error(`Request failed (${statusCode}) for ${url}`));
        return;
      }

      resolveWithCleanup(response);
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${url}`));
    });
    abortRequest = () => {
      request.destroy(new Error("yt-dlp install cancelled by user."));
    };
    signal?.addEventListener("abort", abortRequest, { once: true });
    request.on("error", rejectWithCleanup);
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
  source: YtDlpDownloadSource,
  destinationPath: string,
  signal?: AbortSignal
): Promise<void> {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  const response = await requestUrl(source.url, signal);
  await pipeline(response, createWriteStream(destinationPath), { signal });
}

function extractLatestVersion(rawReleaseJson: string): string {
  const parsed = JSON.parse(rawReleaseJson) as { tag_name?: unknown };
  const tagName = typeof parsed.tag_name === "string" ? parsed.tag_name.trim() : "";
  if (!tagName) {
    throw new Error("Unable to read latest yt-dlp release version.");
  }
  return tagName;
}

function getReleaseUrls(version: string): { checksum: string; executable: string } {
  const releaseBaseUrl = `${GITHUB_RELEASE_BASE_URL}/${version}`;
  return {
    checksum: `${releaseBaseUrl}/${CHECKSUM_FILE_NAME}`,
    executable: `${releaseBaseUrl}/${EXECUTABLE_FILE_NAME}`
  };
}

function extractExecutableSha256(rawChecksum: string): string {
  for (const line of rawChecksum.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.endsWith(EXECUTABLE_FILE_NAME)) {
      continue;
    }

    const checksum = trimmed.split(/\s+/g)[0]?.toLowerCase() ?? "";
    if (/^[a-f0-9]{64}$/.test(checksum)) {
      return checksum;
    }
  }

  throw new Error(`Unable to find ${EXECUTABLE_FILE_NAME} checksum in ${CHECKSUM_FILE_NAME}.`);
}

async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function hasCurrentInstall(
  paths: YtDlpToolInstallPaths,
  latestVersion: string,
  latestSha256: string
): Promise<boolean> {
  const [hasYtDlp, metadata] = await Promise.all([
    pathExists(paths.ytDlpPath),
    readInstallMetadata(paths.installRoot)
  ]);

  return (
    hasYtDlp &&
    metadata?.version === latestVersion &&
    metadata.sha256.toLowerCase() === latestSha256.toLowerCase()
  );
}

async function downloadVerifiedExecutable(
  source: YtDlpDownloadSource,
  executablePath: string,
  expectedSha256: string,
  downloadFile: NonNullable<YtDlpToolInstallerOptions["downloadFile"]>,
  signal: AbortSignal | undefined,
  onDownloadAttempt: YtDlpToolInstallerOptions["onDownloadAttempt"]
): Promise<void> {
  throwIfAborted(signal);
  onDownloadAttempt?.(source);
  await rm(executablePath, { force: true });
  await downloadFile(source, executablePath, signal);
  throwIfAborted(signal);

  const executableSha256 = await hashFileSha256(executablePath);
  if (executableSha256 !== expectedSha256) {
    throw new Error(`SHA-256 mismatch for yt-dlp: expected ${expectedSha256}, got ${executableSha256}.`);
  }
}

export async function ensureLatestProjectYtDlpTool(
  pluginDirectory: string,
  options: YtDlpToolInstallerOptions = {}
): Promise<YtDlpToolInstallResult> {
  const signal = options.signal;
  throwIfAborted(signal);

  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    throw new Error("Automatic yt-dlp download is currently supported on Windows desktop only.");
  }

  const fetchText = options.fetchText ?? defaultFetchText;
  const downloadFile = options.downloadFile ?? defaultDownloadFile;
  const now = options.now ?? (() => new Date());
  const latestVersion = extractLatestVersion(await fetchText(GITHUB_LATEST_RELEASE_URL, signal));
  const urls = getReleaseUrls(latestVersion);
  const latestSha256 = extractExecutableSha256(await fetchText(urls.checksum, signal));

  const paths = getProjectYtDlpToolPaths(pluginDirectory, platform);
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
  const downloadPath = path.join(tempDirectory, EXECUTABLE_FILE_NAME);
  const source = {
    name: "GitHub release",
    url: urls.executable
  };

  await rm(tempDirectory, { recursive: true, force: true });
  await mkdir(tempDirectory, { recursive: true });

  try {
    await downloadVerifiedExecutable(
      source,
      downloadPath,
      latestSha256,
      downloadFile,
      signal,
      options.onDownloadAttempt
    );
    await mkdir(paths.binDirectory, { recursive: true });
    await copyFile(downloadPath, paths.ytDlpPath);
    await writeInstallMetadata(paths.installRoot, {
      source: source.url,
      version: latestVersion,
      sha256: latestSha256,
      installedAt: now().toISOString()
    });

    return {
      ...paths,
      installed: true,
      version: latestVersion,
      sourceName: source.name,
      sourceUrl: source.url
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
