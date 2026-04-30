import { describe, expect, it, vi } from "vitest";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import { startDependencyDriftMonitor } from "@plugin/dependency-drift-monitor";
import type { MediaRuntimeDependencyDiagnostics } from "@services/media/dependency-readiness";

function createDiagnostics(version: string): MediaRuntimeDependencyDiagnostics {
  return {
    checkedAt: "2026-04-24T10:00:00.000Z",
    allReady: true,
    statuses: [
      {
        name: "yt-dlp",
        command: "yt-dlp",
        args: ["--version"],
        available: true,
        version
      },
      {
        name: "ffmpeg",
        command: "ffmpeg",
        args: ["-version"],
        available: true,
        version: "ffmpeg version 7.0"
      },
      {
        name: "ffprobe",
        command: "ffprobe",
        args: ["-version"],
        available: true,
        version: "ffprobe version 7.0"
      }
    ]
  };
}

describe("dependency drift monitor", () => {
  it("does not run when runtime strategy is placeholder_only", async () => {
    const warnings: string[] = [];
    const infos: string[] = [];
    let checkerCalled = false;

    const plugin = {
      settings: {
        runtimeStrategy: "placeholder_only"
      },
      reportWarning: (_context: string, warning: string) => warnings.push(warning),
      reportInfo: (_context: string, info: string) => infos.push(info)
    } as unknown as AISummarizerPlugin;

    startDependencyDriftMonitor(plugin, {
      dependencyChecker: async () => {
        checkerCalled = true;
        return createDiagnostics("2026.04.10");
      }
    });

    await Promise.resolve();
    expect(checkerCalled).toBe(false);
    expect(warnings).toEqual([]);
    expect(infos).toEqual([]);
  });

  it("reports drift warnings in background without blocking startup", async () => {
    const warnings: string[] = [];

    const plugin = {
      settings: {
        runtimeStrategy: "local_bridge"
      },
      reportWarning: (_context: string, warning: string) => warnings.push(warning),
      reportInfo: () => undefined
    } as unknown as AISummarizerPlugin;

    startDependencyDriftMonitor(plugin, {
      timeoutMs: 5_000,
      dependencyChecker: async () => createDiagnostics("2025.01.01"),
      latestYtDlpVersionChecker: async () => null
    });

    await vi.waitFor(() => {
      expect(warnings.some((warning) => warning.includes("Dependency drift check found"))).toBe(true);
      expect(warnings.some((warning) => warning.includes("yt-dlp is"))).toBe(true);
    });
  });

  it("reports available yt-dlp update from latest version check", async () => {
    const warnings: string[] = [];

    const plugin = {
      settings: {
        runtimeStrategy: "local_bridge"
      },
      reportWarning: (_context: string, warning: string) => warnings.push(warning),
      reportInfo: () => undefined
    } as unknown as AISummarizerPlugin;

    startDependencyDriftMonitor(plugin, {
      timeoutMs: 5_000,
      dependencyChecker: async () => createDiagnostics("2026.04.10"),
      latestYtDlpVersionChecker: async () => "2026.04.20"
    });

    await vi.waitFor(() => {
      expect(warnings.some((warning) => warning.includes("yt-dlp update available"))).toBe(true);
    });
  });

  it("reports timeout warning when background check exceeds timeout", async () => {
    vi.useFakeTimers();
    try {
      const warnings: string[] = [];

      const plugin = {
        settings: {
          runtimeStrategy: "local_bridge"
        },
        reportWarning: (_context: string, warning: string) => warnings.push(warning),
        reportInfo: () => undefined
      } as unknown as AISummarizerPlugin;

      startDependencyDriftMonitor(plugin, {
        timeoutMs: 1_000,
        dependencyChecker: () => new Promise<MediaRuntimeDependencyDiagnostics>(() => undefined),
        latestYtDlpVersionChecker: async () => null
      });

      await vi.advanceTimersByTimeAsync(1_100);

      expect(warnings.some((warning) => warning.includes("timed out"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
