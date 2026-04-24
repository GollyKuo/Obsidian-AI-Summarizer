import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import { evaluateDependencyDrift } from "@services/media/dependency-drift";
import {
  runMediaDependencyReadinessCheck,
  type MediaRuntimeDependencyDiagnostics
} from "@services/media/dependency-readiness";

interface DependencyDriftMonitorOptions {
  timeoutMs?: number;
  dependencyChecker?: () => Promise<MediaRuntimeDependencyDiagnostics>;
}

const DEFAULT_TIMEOUT_MS = 5_000;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function startDependencyDriftMonitor(
  plugin: AISummarizerPlugin,
  options: DependencyDriftMonitorOptions = {}
): void {
  if (plugin.settings.runtimeStrategy !== "local_bridge") {
    return;
  }

  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const dependencyChecker = options.dependencyChecker ?? runMediaDependencyReadinessCheck;

  void (async () => {
    const timeoutToken = Symbol("timeout");
    const raceResult = await Promise.race<
      ReturnType<typeof evaluateDependencyDrift> | typeof timeoutToken
    >([
      dependencyChecker().then((diagnostics) => evaluateDependencyDrift(diagnostics)),
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
