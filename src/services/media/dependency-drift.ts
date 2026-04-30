import type {
  MediaRuntimeDependencyDiagnostics,
  MediaRuntimeDependencyStatus
} from "@services/media/dependency-readiness";

export interface DependencyDriftPolicy {
  ytDlpMaxAgeDays: number;
  minimumFfmpegMajor: number;
  minimumFfprobeMajor: number;
}

export interface DependencyDriftItem {
  dependency: string;
  severity: "warning" | "error";
  message: string;
}

export interface DependencyDriftReport {
  checkedAt: string;
  state: "ready" | "warning" | "error";
  message: string;
  items: DependencyDriftItem[];
}

interface DependencyDriftOptions {
  policy?: Partial<DependencyDriftPolicy>;
  referenceTime?: string;
  latestYtDlpVersion?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_DEPENDENCY_DRIFT_POLICY: DependencyDriftPolicy = {
  ytDlpMaxAgeDays: 120,
  minimumFfmpegMajor: 6,
  minimumFfprobeMajor: 6
};

function resolvePolicy(overrides: Partial<DependencyDriftPolicy> = {}): DependencyDriftPolicy {
  return {
    ...DEFAULT_DEPENDENCY_DRIFT_POLICY,
    ...overrides
  };
}

function findStatus(
  diagnostics: MediaRuntimeDependencyDiagnostics,
  dependencyName: string
): MediaRuntimeDependencyStatus | null {
  return diagnostics.statuses.find((status) => status.name === dependencyName) ?? null;
}

function parseYtDlpReleaseDate(version: string): Date | null {
  const match = version.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseMajorVersion(version: string): number | null {
  const versionWithKeyword = version.match(/\bversion\s+(\d+)(?:\.\d+)?/i);
  if (versionWithKeyword) {
    return Number(versionWithKeyword[1]);
  }

  const plainVersion = version.match(/\b(\d+)\.(\d+)(?:\.\d+)?/);
  if (plainVersion) {
    return Number(plainVersion[1]);
  }

  return null;
}

function buildSummary(items: DependencyDriftItem[]): Pick<DependencyDriftReport, "state" | "message"> {
  const errorCount = items.filter((item) => item.severity === "error").length;
  const warningCount = items.filter((item) => item.severity === "warning").length;

  if (errorCount > 0) {
    return {
      state: "error",
      message: `Dependency drift check found ${errorCount} error(s) and ${warningCount} warning(s).`
    };
  }

  if (warningCount > 0) {
    return {
      state: "warning",
      message: `Dependency drift check found ${warningCount} warning(s).`
    };
  }

  return {
    state: "ready",
    message: "Dependency drift check passed."
  };
}

function pushMissingDependencyErrors(
  diagnostics: MediaRuntimeDependencyDiagnostics,
  items: DependencyDriftItem[]
): void {
  for (const status of diagnostics.statuses) {
    if (status.available) {
      continue;
    }

    items.push({
      dependency: status.name,
      severity: "error",
      message: `Dependency is unavailable: ${status.errorMessage ?? "unknown error"}.`
    });
  }
}

function pushYtDlpDriftWarnings(
  diagnostics: MediaRuntimeDependencyDiagnostics,
  policy: DependencyDriftPolicy,
  referenceTime: Date,
  latestYtDlpVersion: string | undefined,
  items: DependencyDriftItem[]
): void {
  const ytDlp = findStatus(diagnostics, "yt-dlp");
  if (!ytDlp || !ytDlp.available) {
    return;
  }

  const latestVersion = latestYtDlpVersion?.trim();
  if (latestVersion && ytDlp.version.trim() !== latestVersion) {
    items.push({
      dependency: "yt-dlp",
      severity: "warning",
      message: `yt-dlp update available: current ${ytDlp.version}, latest ${latestVersion}.`
    });
  }

  const releaseDate = parseYtDlpReleaseDate(ytDlp.version);
  if (!releaseDate) {
    items.push({
      dependency: "yt-dlp",
      severity: "warning",
      message: `Cannot parse yt-dlp release date from version: ${ytDlp.version}.`
    });
    return;
  }

  const ageDays = Math.floor((referenceTime.getTime() - releaseDate.getTime()) / DAY_MS);
  if (ageDays > policy.ytDlpMaxAgeDays) {
    items.push({
      dependency: "yt-dlp",
      severity: "warning",
      message: `yt-dlp is ${ageDays} days old (max ${policy.ytDlpMaxAgeDays} days).`
    });
  }
}

function pushFfmpegCompatibilityWarnings(
  diagnostics: MediaRuntimeDependencyDiagnostics,
  policy: DependencyDriftPolicy,
  items: DependencyDriftItem[]
): void {
  const ffmpeg = findStatus(diagnostics, "ffmpeg");
  const ffprobe = findStatus(diagnostics, "ffprobe");

  const ffmpegMajor = ffmpeg?.available ? parseMajorVersion(ffmpeg.version) : null;
  const ffprobeMajor = ffprobe?.available ? parseMajorVersion(ffprobe.version) : null;

  if (ffmpeg?.available && ffmpegMajor === null) {
    items.push({
      dependency: "ffmpeg",
      severity: "warning",
      message: `Cannot parse ffmpeg major version from: ${ffmpeg.version}.`
    });
  }

  if (ffprobe?.available && ffprobeMajor === null) {
    items.push({
      dependency: "ffprobe",
      severity: "warning",
      message: `Cannot parse ffprobe major version from: ${ffprobe.version}.`
    });
  }

  if (ffmpegMajor !== null && ffmpegMajor < policy.minimumFfmpegMajor) {
    items.push({
      dependency: "ffmpeg",
      severity: "warning",
      message: `ffmpeg major version ${ffmpegMajor} is below minimum ${policy.minimumFfmpegMajor}.`
    });
  }

  if (ffprobeMajor !== null && ffprobeMajor < policy.minimumFfprobeMajor) {
    items.push({
      dependency: "ffprobe",
      severity: "warning",
      message: `ffprobe major version ${ffprobeMajor} is below minimum ${policy.minimumFfprobeMajor}.`
    });
  }

  if (ffmpegMajor !== null && ffprobeMajor !== null && ffmpegMajor !== ffprobeMajor) {
    items.push({
      dependency: "ffmpeg/ffprobe",
      severity: "warning",
      message: `ffmpeg major ${ffmpegMajor} does not match ffprobe major ${ffprobeMajor}.`
    });
  }
}

export function evaluateDependencyDrift(
  diagnostics: MediaRuntimeDependencyDiagnostics,
  options: DependencyDriftOptions = {}
): DependencyDriftReport {
  const policy = resolvePolicy(options.policy);
  const referenceTime = new Date(options.referenceTime ?? diagnostics.checkedAt);
  const safeReferenceTime = Number.isNaN(referenceTime.getTime()) ? new Date(diagnostics.checkedAt) : referenceTime;

  const items: DependencyDriftItem[] = [];
  pushMissingDependencyErrors(diagnostics, items);
  pushYtDlpDriftWarnings(diagnostics, policy, safeReferenceTime, options.latestYtDlpVersion, items);
  pushFfmpegCompatibilityWarnings(diagnostics, policy, items);

  const summary = buildSummary(items);
  return {
    checkedAt: diagnostics.checkedAt,
    state: summary.state,
    message: summary.message,
    items
  };
}
