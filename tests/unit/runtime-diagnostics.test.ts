import { describe, expect, it } from "vitest";
import { SummarizerError } from "@domain/errors";
import { DEFAULT_SETTINGS, type AISummarizerPluginSettings } from "@domain/settings";
import type { MediaRuntimeDependencyDiagnostics } from "@services/media/dependency-readiness";
import {
  collectRuntimeDiagnostics,
  formatRuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";

function createSettings(
  overrides: Partial<AISummarizerPluginSettings> = {}
): AISummarizerPluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides
  };
}

function createDependencyDiagnostics(allReady: boolean): MediaRuntimeDependencyDiagnostics {
  return {
    checkedAt: "2026-04-24T00:30:00.000Z",
    allReady,
    statuses: [
      {
        name: "yt-dlp",
        command: "yt-dlp",
        args: ["--version"],
        available: allReady,
        version: allReady ? "2026.04.01" : "unavailable",
        errorMessage: allReady ? undefined : "spawn ENOENT"
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

describe("runtime diagnostics", () => {
  it("reports ready state when local runtime dependencies and cache root are available", async () => {
    const summary = await collectRuntimeDiagnostics(createSettings(), {
      appSurface: "desktop",
      platform: "win32",
      cacheRootResolver: async () => ({
        rootPath: "D:\\AI-Summarizer\\cache",
        usedDefault: false
      }),
      dependencyChecker: async () => createDependencyDiagnostics(true)
    });

    expect(summary.overallState).toBe("ready");
    expect(summary.environment.appSurface).toBe("desktop");
    expect(summary.cacheRoot.state).toBe("ready");
    expect(summary.dependencies.state).toBe("ready");
    expect(summary.dependencyDrift.state).toBe("ready");
    expect(summary.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "media_url",
          available: true,
          state: "ready"
        }),
        expect.objectContaining({
          sourceType: "local_media",
          available: true,
          state: "ready"
        }),
        expect.objectContaining({
          sourceType: "transcript_file",
          available: true,
          state: "ready"
        })
      ])
    );
  });

  it("downgrades to warning when runtime strategy is placeholder_only", async () => {
    let cacheRootResolverCalled = false;

    const summary = await collectRuntimeDiagnostics(
      createSettings({ runtimeStrategy: "placeholder_only" }),
      {
        appSurface: "mobile",
        platform: "linux",
        cacheRootResolver: async () => ({
          rootPath: (() => {
            cacheRootResolverCalled = true;
            return "/tmp/ai-summarizer-cache";
          })(),
          usedDefault: true
        })
      }
    );

    expect(summary.overallState).toBe("warning");
    expect(summary.cacheRoot.state).toBe("skipped");
    expect(summary.dependencies.state).toBe("skipped");
    expect(summary.dependencyDrift.state).toBe("skipped");
    expect(cacheRootResolverCalled).toBe(false);
    expect(summary.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "media_url",
          available: false,
          state: "warning"
        }),
        expect.objectContaining({
          sourceType: "transcript_file",
          available: false,
          state: "warning"
        })
      ])
    );
  });

  it("reports error when cache root validation fails", async () => {
    const summary = await collectRuntimeDiagnostics(createSettings(), {
      cacheRootResolver: async () => {
        throw new SummarizerError({
          category: "validation_error",
          message: "mediaCacheRoot must be an absolute path: relative/path",
          recoverable: true
        });
      },
      dependencyChecker: async () => createDependencyDiagnostics(true)
    });

    expect(summary.overallState).toBe("error");
    expect(summary.cacheRoot.state).toBe("error");
    expect(summary.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "media_url",
          available: false,
          state: "error"
        })
      ])
    );
  });

  it("formats a readable diagnostics summary", async () => {
    const summary = await collectRuntimeDiagnostics(createSettings(), {
      appSurface: "desktop",
      platform: "win32",
      cacheRootResolver: async () => ({
        rootPath: "D:\\AI-Summarizer\\cache",
        usedDefault: false
      }),
      dependencyChecker: async () => createDependencyDiagnostics(false)
    });

    expect(formatRuntimeDiagnosticsSummary(summary)).toEqual(
      expect.arrayContaining([
        "Overall: error",
        "App surface: desktop",
        expect.stringContaining("Dependency drift: error"),
        expect.stringContaining("dependency yt-dlp: error"),
        expect.stringContaining("media_url: error")
      ])
    );
  });
});
