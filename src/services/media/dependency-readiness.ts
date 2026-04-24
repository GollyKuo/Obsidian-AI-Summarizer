import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SummarizerError } from "@domain/errors";

const execFileAsync = promisify(execFile);

export interface MediaRuntimeDependencySpec {
  name: string;
  command: string;
  args: string[];
}

export interface MediaRuntimeDependencyStatus {
  name: string;
  command: string;
  args: string[];
  available: boolean;
  version: string;
  errorMessage?: string;
}

export interface MediaRuntimeDependencyDiagnostics {
  checkedAt: string;
  allReady: boolean;
  statuses: MediaRuntimeDependencyStatus[];
}

export interface MediaRuntimeToolPaths {
  ffmpegPath?: string;
  ffprobePath?: string;
}

interface ExecCommandResult {
  stdout: string;
  stderr: string;
}

export type DependencyCommandExecutor = (
  command: string,
  args: string[]
) => Promise<ExecCommandResult>;

interface DependencyReadinessOptions {
  specs?: MediaRuntimeDependencySpec[];
  executor?: DependencyCommandExecutor;
}

export const DEFAULT_MEDIA_RUNTIME_DEPENDENCIES: MediaRuntimeDependencySpec[] = [
  {
    name: "yt-dlp",
    command: "yt-dlp",
    args: ["--version"]
  },
  {
    name: "ffmpeg",
    command: "ffmpeg",
    args: ["-version"]
  },
  {
    name: "ffprobe",
    command: "ffprobe",
    args: ["-version"]
  }
];

function normalizeCommand(command: string | undefined, fallback: string): string {
  const normalized = command?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function createMediaRuntimeDependencySpecs(
  paths: MediaRuntimeToolPaths = {}
): MediaRuntimeDependencySpec[] {
  return DEFAULT_MEDIA_RUNTIME_DEPENDENCIES.map((spec) => {
    if (spec.name === "ffmpeg") {
      return {
        ...spec,
        command: normalizeCommand(paths.ffmpegPath, spec.command)
      };
    }

    if (spec.name === "ffprobe") {
      return {
        ...spec,
        command: normalizeCommand(paths.ffprobePath, spec.command)
      };
    }

    return spec;
  });
}

async function defaultExecutor(command: string, args: string[]): Promise<ExecCommandResult> {
  const result = await execFileAsync(command, args, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function firstNonEmptyLine(...blocks: string[]): string {
  for (const block of blocks) {
    const line = block
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .find((item) => item.length > 0);
    if (line) {
      return line;
    }
  }
  return "unknown";
}

async function checkDependency(
  spec: MediaRuntimeDependencySpec,
  executor: DependencyCommandExecutor
): Promise<MediaRuntimeDependencyStatus> {
  try {
    const result = await executor(spec.command, spec.args);
    return {
      ...spec,
      available: true,
      version: firstNonEmptyLine(result.stdout, result.stderr)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...spec,
      available: false,
      version: "unavailable",
      errorMessage: message
    };
  }
}

export async function runMediaDependencyReadinessCheck(
  options: DependencyReadinessOptions = {}
): Promise<MediaRuntimeDependencyDiagnostics> {
  const specs = options.specs ?? DEFAULT_MEDIA_RUNTIME_DEPENDENCIES;
  const executor = options.executor ?? defaultExecutor;

  const statuses = await Promise.all(specs.map((spec) => checkDependency(spec, executor)));
  const allReady = statuses.every((status) => status.available);

  return {
    checkedAt: new Date().toISOString(),
    allReady,
    statuses
  };
}

export async function assertMediaDependenciesReady(
  options: DependencyReadinessOptions = {}
): Promise<MediaRuntimeDependencyDiagnostics> {
  const diagnostics = await runMediaDependencyReadinessCheck(options);
  if (diagnostics.allReady) {
    return diagnostics;
  }

  const missing = diagnostics.statuses
    .filter((status) => !status.available)
    .map((status) => status.name);

  throw new SummarizerError({
    category: "runtime_unavailable",
    message: `Missing media runtime dependencies: ${missing.join(", ")}`,
    recoverable: false,
    cause: diagnostics
  });
}
