import { describe, expect, it } from "vitest";
import {
  assertMediaDependenciesReady,
  createMediaRuntimeDependencySpecs,
  runMediaDependencyReadinessCheck,
  type DependencyCommandExecutor
} from "@services/media/dependency-readiness";

describe("media dependency readiness", () => {
  it("returns allReady when all dependencies are available", async () => {
    const executor: DependencyCommandExecutor = async (command) => {
      if (command === "yt-dlp") {
        return { stdout: "2026.04.01\n", stderr: "" };
      }
      if (command === "ffmpeg") {
        return { stdout: "ffmpeg version 7.0\n", stderr: "" };
      }
      return { stdout: "", stderr: "ffprobe version 7.0\n" };
    };

    const result = await runMediaDependencyReadinessCheck({ executor });
    expect(result.allReady).toBe(true);
    expect(result.statuses.every((status) => status.available)).toBe(true);
  });

  it("marks dependency unavailable when executor throws", async () => {
    const executor: DependencyCommandExecutor = async (command) => {
      if (command === "ffprobe") {
        throw new Error("spawn ENOENT");
      }
      return { stdout: "ok\n", stderr: "" };
    };

    const result = await runMediaDependencyReadinessCheck({ executor });
    expect(result.allReady).toBe(false);

    const ffprobe = result.statuses.find((status) => status.name === "ffprobe");
    expect(ffprobe?.available).toBe(false);
    expect(ffprobe?.errorMessage).toContain("ENOENT");
  });

  it("throws runtime_unavailable when any dependency is missing", async () => {
    const executor: DependencyCommandExecutor = async (command) => {
      if (command === "yt-dlp") {
        throw new Error("not found");
      }
      return { stdout: "ok\n", stderr: "" };
    };

    await expect(assertMediaDependenciesReady({ executor })).rejects.toMatchObject({
      category: "runtime_unavailable"
    });
  });

  it("uses configured ffmpeg and ffprobe executable paths when provided", () => {
    const specs = createMediaRuntimeDependencySpecs({
      ffmpegPath: "C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe",
      ffprobePath: "C:\\Tools\\ffmpeg\\bin\\ffprobe.exe"
    });

    expect(specs.find((spec) => spec.name === "yt-dlp")?.command).toBe("yt-dlp");
    expect(specs.find((spec) => spec.name === "ffmpeg")?.command).toBe(
      "C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe"
    );
    expect(specs.find((spec) => spec.name === "ffprobe")?.command).toBe(
      "C:\\Tools\\ffmpeg\\bin\\ffprobe.exe"
    );
  });
});
