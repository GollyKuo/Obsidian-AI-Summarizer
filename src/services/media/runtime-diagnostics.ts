import type { AISummarizerPluginSettings, RuntimeStrategy } from "@domain/settings";
import { SummarizerError } from "@domain/errors";
import type { SourceType } from "@domain/types";
import {
  createMediaRuntimeDependencySpecs,
  runMediaDependencyReadinessCheck,
  type MediaRuntimeDependencyDiagnostics
} from "@services/media/dependency-readiness";
import {
  evaluateDependencyDrift,
  type DependencyDriftReport
} from "@services/media/dependency-drift";
import {
  resolveMediaCacheRoot,
  type MediaCacheRootResolution
} from "@services/media/media-cache-root";

export type DiagnosticsState = "ready" | "warning" | "error" | "skipped";
export type AppSurface = "desktop" | "mobile" | "unknown";

export interface CapabilityDiagnostics {
  sourceType: SourceType;
  available: boolean;
  state: DiagnosticsState;
  reason: string;
}

export interface CacheRootDiagnostics {
  state: DiagnosticsState;
  message: string;
  resolution?: MediaCacheRootResolution;
}

export interface DependencyDiagnosticsSummary {
  state: DiagnosticsState;
  message: string;
  diagnostics?: MediaRuntimeDependencyDiagnostics;
}

export interface DependencyDriftDiagnosticsSummary {
  state: DiagnosticsState;
  message: string;
  report?: DependencyDriftReport;
}

export interface RuntimeDiagnosticsSummary {
  checkedAt: string;
  overallState: Exclude<DiagnosticsState, "skipped">;
  environment: {
    appSurface: AppSurface;
    platform: NodeJS.Platform;
    runtimeStrategy: RuntimeStrategy;
  };
  cacheRoot: CacheRootDiagnostics;
  dependencies: DependencyDiagnosticsSummary;
  dependencyDrift: DependencyDriftDiagnosticsSummary;
  capabilities: CapabilityDiagnostics[];
}

interface RuntimeDiagnosticsOptions {
  appSurface?: AppSurface;
  platform?: NodeJS.Platform;
  cacheRootResolver?: (configuredPath: string) => Promise<MediaCacheRootResolution>;
  dependencyChecker?: () => Promise<MediaRuntimeDependencyDiagnostics>;
}

function formatMissingDependencies(diagnostics: MediaRuntimeDependencyDiagnostics): string {
  return diagnostics.statuses
    .filter((status) => !status.available)
    .map((status) => status.name)
    .join(", ");
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof SummarizerError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function collectCacheRootDiagnostics(
  settings: AISummarizerPluginSettings,
  resolver: (configuredPath: string) => Promise<MediaCacheRootResolution>
): Promise<CacheRootDiagnostics> {
  if (settings.runtimeStrategy !== "local_bridge") {
    return {
      state: "skipped",
      message: "Skipped because runtime strategy is placeholder_only."
    };
  }

  try {
    const resolution = await resolver(settings.mediaCacheRoot);
    return {
      state: "ready",
      message: resolution.usedDefault
        ? `Using default cache root: ${resolution.rootPath}`
        : `Using configured cache root: ${resolution.rootPath}`,
      resolution
    };
  } catch (error) {
    return {
      state: "error",
      message: formatErrorMessage(error)
    };
  }
}

async function collectDependencyDiagnostics(
  strategy: RuntimeStrategy,
  checker: () => Promise<MediaRuntimeDependencyDiagnostics>
): Promise<DependencyDiagnosticsSummary> {
  if (strategy !== "local_bridge") {
    return {
      state: "skipped",
      message: "Skipped because runtime strategy is placeholder_only."
    };
  }

  try {
    const diagnostics = await checker();
    if (diagnostics.allReady) {
      return {
        state: "ready",
        message: "All media runtime dependencies are available.",
        diagnostics
      };
    }

    return {
      state: "error",
      message: `Missing media runtime dependencies: ${formatMissingDependencies(diagnostics)}`,
      diagnostics
    };
  } catch (error) {
    return {
      state: "error",
      message: formatErrorMessage(error)
    };
  }
}

function collectDependencyDriftDiagnostics(
  strategy: RuntimeStrategy,
  dependencies: DependencyDiagnosticsSummary
): DependencyDriftDiagnosticsSummary {
  if (strategy !== "local_bridge") {
    return {
      state: "skipped",
      message: "Skipped because runtime strategy is placeholder_only."
    };
  }

  if (!dependencies.diagnostics) {
    return {
      state: "skipped",
      message: "Skipped because dependency diagnostics are unavailable."
    };
  }

  const report = evaluateDependencyDrift(dependencies.diagnostics);
  return {
    state: report.state,
    message: report.message,
    report
  };
}

function buildMediaCapabilityReason(
  settings: AISummarizerPluginSettings,
  cacheRoot: CacheRootDiagnostics,
  dependencies: DependencyDiagnosticsSummary
): Pick<CapabilityDiagnostics, "available" | "state" | "reason"> {
  if (settings.runtimeStrategy !== "local_bridge") {
    return {
      available: false,
      state: "warning",
      reason: "Runtime strategy placeholder_only disables media processing."
    };
  }

  if (cacheRoot.state !== "ready") {
    return {
      available: false,
      state: "error",
      reason: `Media cache root is unavailable: ${cacheRoot.message}`
    };
  }

  if (dependencies.state !== "ready") {
    return {
      available: false,
      state: "error",
      reason: `Media runtime is unavailable: ${dependencies.message}`
    };
  }

  return {
    available: true,
    state: "ready",
    reason: "Media runtime is ready."
  };
}

function buildTranscriptFileCapabilityReason(
  appSurface: AppSurface
): Pick<CapabilityDiagnostics, "available" | "state" | "reason"> {
  if (appSurface === "mobile") {
    return {
      available: false,
      state: "warning",
      reason: "Transcript file summary retry requires desktop filesystem access."
    };
  }

  return {
    available: true,
    state: "ready",
    reason: "Transcript file summary retry is available."
  };
}

function computeOverallState(
  cacheRoot: CacheRootDiagnostics,
  dependencies: DependencyDiagnosticsSummary,
  dependencyDrift: DependencyDriftDiagnosticsSummary,
  capabilities: CapabilityDiagnostics[]
): Exclude<DiagnosticsState, "skipped"> {
  if (
    cacheRoot.state === "error" ||
    dependencies.state === "error" ||
    dependencyDrift.state === "error" ||
    capabilities.some((capability) => capability.state === "error")
  ) {
    return "error";
  }

  if (
    cacheRoot.state === "warning" ||
    dependencies.state === "warning" ||
    dependencyDrift.state === "warning" ||
    capabilities.some((capability) => capability.state === "warning")
  ) {
    return "warning";
  }

  return "ready";
}

export async function collectRuntimeDiagnostics(
  settings: AISummarizerPluginSettings,
  options: RuntimeDiagnosticsOptions = {}
): Promise<RuntimeDiagnosticsSummary> {
  const cacheRootResolver = options.cacheRootResolver ?? resolveMediaCacheRoot;
  const dependencyChecker =
    options.dependencyChecker ??
    (() =>
      runMediaDependencyReadinessCheck({
        specs: createMediaRuntimeDependencySpecs({
          ffmpegPath: settings.ffmpegPath,
          ffprobePath: settings.ffprobePath
        })
      }));
  const cacheRoot = await collectCacheRootDiagnostics(settings, cacheRootResolver);
  const dependencies = await collectDependencyDiagnostics(settings.runtimeStrategy, dependencyChecker);
  const dependencyDrift = collectDependencyDriftDiagnostics(settings.runtimeStrategy, dependencies);
  const mediaCapability = buildMediaCapabilityReason(settings, cacheRoot, dependencies);
  const appSurface = options.appSurface ?? "unknown";
  const transcriptFileCapability = buildTranscriptFileCapabilityReason(appSurface);

  const capabilities: CapabilityDiagnostics[] = [
    {
      sourceType: "webpage_url",
      available: true,
      state: "ready",
      reason: "Webpage flow is available."
    },
    {
      sourceType: "media_url",
      ...mediaCapability
    },
    {
      sourceType: "local_media",
      ...mediaCapability
    },
    {
      sourceType: "transcript_file",
      ...transcriptFileCapability
    }
  ];

  return {
    checkedAt: new Date().toISOString(),
    overallState: computeOverallState(cacheRoot, dependencies, dependencyDrift, capabilities),
    environment: {
      appSurface,
      platform: options.platform ?? process.platform,
      runtimeStrategy: settings.runtimeStrategy
    },
    cacheRoot,
    dependencies,
    dependencyDrift,
    capabilities
  };
}

function stateLabel(state: DiagnosticsState): string {
  if (state === "ready") {
    return "ready";
  }
  if (state === "warning") {
    return "warning";
  }
  if (state === "error") {
    return "error";
  }
  return "skipped";
}

export function formatRuntimeDiagnosticsSummary(summary: RuntimeDiagnosticsSummary): string[] {
  const lines = [
    `Overall: ${stateLabel(summary.overallState)}`,
    `App surface: ${summary.environment.appSurface}`,
    `Platform: ${summary.environment.platform}`,
    `Runtime strategy: ${summary.environment.runtimeStrategy}`,
    `Cache root: ${stateLabel(summary.cacheRoot.state)} - ${summary.cacheRoot.message}`,
    `Dependencies: ${stateLabel(summary.dependencies.state)} - ${summary.dependencies.message}`,
    `Dependency drift: ${stateLabel(summary.dependencyDrift.state)} - ${summary.dependencyDrift.message}`,
    "Capabilities:"
  ];

  if (summary.dependencies.diagnostics) {
    for (const status of summary.dependencies.diagnostics.statuses) {
      const dependencyState = status.available ? "ready" : "error";
      const detail = status.available ? status.version : status.errorMessage ?? "unavailable";
      lines.push(`  - dependency ${status.name}: ${dependencyState} - ${detail}`);
    }
  }

  if (summary.dependencyDrift.report) {
    for (const item of summary.dependencyDrift.report.items) {
      lines.push(`  - drift ${item.dependency}: ${item.severity} - ${item.message}`);
    }
  }

  for (const capability of summary.capabilities) {
    lines.push(
      `  - ${capability.sourceType}: ${stateLabel(capability.state)} - ${capability.reason}`
    );
  }

  return lines;
}
