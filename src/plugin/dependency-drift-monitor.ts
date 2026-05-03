import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import { evaluateDependencyDrift } from "@services/media/dependency-drift";
import {
  createMediaRuntimeDependencySpecs,
  runMediaDependencyReadinessCheck,
  type MediaRuntimeDependencyDiagnostics
} from "@services/media/dependency-readiness";

interface DependencyDriftMonitorOptions {
  timeoutMs?: number;
  dependencyChecker?: () => Promise<MediaRuntimeDependencyDiagnostics>;
  latestYtDlpVersionChecker?: () => Promise<string | null>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const PYPI_YT_DLP_URL = "https://pypi.org/pypi/yt-dlp/json";
const GITHUB_YT_DLP_RELEASE_URL = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function fetchJson(url: string): Promise<unknown> {
  if (!globalThis.fetch) {
    return null;
  }

  const response = await globalThis.fetch(url);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function extractPypiVersion(payload: unknown): string | null {
  const info = typeof payload === "object" && payload !== null ? (payload as { info?: unknown }).info : null;
  const version = typeof info === "object" && info !== null ? (info as { version?: unknown }).version : null;
  return typeof version === "string" && version.trim().length > 0 ? version.trim() : null;
}

function extractGithubReleaseVersion(payload: unknown): string | null {
  const tagName = typeof payload === "object" && payload !== null ? (payload as { tag_name?: unknown }).tag_name : null;
  return typeof tagName === "string" && tagName.trim().length > 0 ? tagName.trim() : null;
}

async function fetchLatestYtDlpVersion(): Promise<string | null> {
  try {
    const pypiVersion = extractPypiVersion(await fetchJson(PYPI_YT_DLP_URL));
    if (pypiVersion) {
      return pypiVersion;
    }

    return extractGithubReleaseVersion(await fetchJson(GITHUB_YT_DLP_RELEASE_URL));
  } catch {
    return null;
  }
}

export function startDependencyDriftMonitor(
  plugin: AISummarizerPlugin,
  options: DependencyDriftMonitorOptions = {}
): void {
  if (plugin.settings.runtimeStrategy !== "local_bridge") {
    return;
  }

  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const dependencyChecker =
    options.dependencyChecker ??
    (() =>
      runMediaDependencyReadinessCheck({
        specs: createMediaRuntimeDependencySpecs({
          ytDlpPath: plugin.settings.ytDlpPath,
          ffmpegPath: plugin.settings.ffmpegPath,
          ffprobePath: plugin.settings.ffprobePath
        })
      }));
  const latestYtDlpVersionChecker = options.latestYtDlpVersionChecker ?? fetchLatestYtDlpVersion;

  void (async () => {
    const timeoutToken = Symbol("timeout");
    const raceResult = await Promise.race<
      ReturnType<typeof evaluateDependencyDrift> | typeof timeoutToken
    >([
      Promise.all([dependencyChecker(), latestYtDlpVersionChecker()]).then(
        ([diagnostics, latestYtDlpVersion]) =>
          evaluateDependencyDrift(diagnostics, {
            latestYtDlpVersion: latestYtDlpVersion ?? undefined
          })
      ),
      new Promise<typeof timeoutToken>((resolve) => {
        setTimeout(() => resolve(timeoutToken), timeoutMs);
      })
    ]);

    if (raceResult === timeoutToken) {
      plugin.reportWarning(
        "dependency_drift",
        `Dependency drift background check timed out after ${timeoutMs}ms.`
      );
      return;
    }

    if (raceResult.state === "ready") {
      plugin.reportInfo("dependency_drift", raceResult.message);
      return;
    }

    plugin.reportWarning("dependency_drift", raceResult.message);
    for (const item of raceResult.items) {
      plugin.reportWarning("dependency_drift", `${item.dependency}: ${item.message}`);
    }
  })().catch((error) => {
    plugin.reportWarning(
      "dependency_drift",
      `Dependency drift background check failed: ${formatUnknownError(error)}`
    );
  });
}
