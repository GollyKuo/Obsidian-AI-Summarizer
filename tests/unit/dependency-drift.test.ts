import { describe, expect, it } from "vitest";
import { evaluateDependencyDrift } from "@services/media/dependency-drift";
import type { MediaRuntimeDependencyDiagnostics } from "@services/media/dependency-readiness";

function createDiagnostics(
  overrides: Partial<MediaRuntimeDependencyDiagnostics> = {}
): MediaRuntimeDependencyDiagnostics {
  return {
    checkedAt: "2026-04-24T10:00:00.000Z",
    allReady: true,
    statuses: [
      {
        name: "yt-dlp",
        command: "yt-dlp",
        args: ["--version"],
        available: true,
        version: "2026.04.10"
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
    ],
    ...overrides
  };
}

describe("dependency drift", () => {
  it("returns ready when dependency versions are fresh and compatible", () => {
    const report = evaluateDependencyDrift(createDiagnostics());
    expect(report.state).toBe("ready");
    expect(report.items).toEqual([]);
  });

  it("returns warnings for stale yt-dlp and ffmpeg/ffprobe major mismatch", () => {
    const report = evaluateDependencyDrift(
      createDiagnostics({
        statuses: [
          {
            name: "yt-dlp",
            command: "yt-dlp",
            args: ["--version"],
            available: true,
            version: "2025.01.01"
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
            version: "ffprobe version 6.1"
          }
        ]
      })
    );

    expect(report.state).toBe("warning");
    expect(report.items.some((item) => item.dependency === "yt-dlp")).toBe(true);
    expect(report.items.some((item) => item.dependency === "ffmpeg/ffprobe")).toBe(true);
  });

  it("returns warning when latest yt-dlp version is newer than installed version", () => {
    const report = evaluateDependencyDrift(createDiagnostics(), {
      latestYtDlpVersion: "2026.04.20"
    });

    expect(report.state).toBe("warning");
    expect(
      report.items.some((item) =>
        item.message.includes("yt-dlp update available: current 2026.04.10, latest 2026.04.20")
      )
    ).toBe(true);
  });

  it("returns error when a dependency is unavailable", () => {
    const report = evaluateDependencyDrift(
      createDiagnostics({
        allReady: false,
        statuses: [
          {
            name: "yt-dlp",
            command: "yt-dlp",
            args: ["--version"],
            available: false,
            version: "unavailable",
            errorMessage: "spawn ENOENT"
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
      })
    );

    expect(report.state).toBe("error");
    expect(report.items.some((item) => item.severity === "error")).toBe(true);
  });
});
