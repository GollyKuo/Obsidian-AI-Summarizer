import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ensureLatestProjectFfmpegTools,
  getProjectFfmpegToolPaths
} from "@services/media/ffmpeg-tool-installer";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function makeTempDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ffmpeg-tool-installer-"));
}

describe("ffmpeg tool installer", () => {
  it("downloads and installs project-local ffmpeg and ffprobe when missing", async () => {
    const tempDirectory = await makeTempDirectory();
    const archiveBody = "fake-archive";

    try {
      const result = await ensureLatestProjectFfmpegTools(tempDirectory, {
        platform: "win32",
        fetchText: async (url) => (url.endsWith(".sha256") ? sha256(archiveBody) : "8.1"),
        downloadFile: async (_url, destinationPath) => {
          await writeFile(destinationPath, archiveBody, "utf8");
        },
        extractZip: async (_archivePath, destinationDirectory) => {
          const binDirectory = path.join(destinationDirectory, "ffmpeg-8.1-essentials_build", "bin");
          await mkdir(binDirectory, { recursive: true });
          await writeFile(path.join(binDirectory, "ffmpeg.exe"), "ffmpeg", "utf8");
          await writeFile(path.join(binDirectory, "ffprobe.exe"), "ffprobe", "utf8");
        },
        now: () => new Date("2026-04-25T00:00:00.000Z")
      });

      expect(result.installed).toBe(true);
      expect(result.version).toBe("8.1");
      expect(await readFile(result.ffmpegPath, "utf8")).toBe("ffmpeg");
      expect(await readFile(result.ffprobePath, "utf8")).toBe("ffprobe");

      const metadata = JSON.parse(
        await readFile(path.join(result.installRoot, "install-metadata.json"), "utf8")
      ) as { version: string; sha256: string; installedAt: string };
      expect(metadata).toMatchObject({
        version: "8.1",
        sha256: sha256(archiveBody),
        installedAt: "2026-04-25T00:00:00.000Z"
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("skips download when project-local tools already match latest metadata", async () => {
    const tempDirectory = await makeTempDirectory();
    const paths = getProjectFfmpegToolPaths(tempDirectory, "win32");
    const archiveSha256 = sha256("archive");

    try {
      await mkdir(paths.binDirectory, { recursive: true });
      await writeFile(paths.ffmpegPath, "ffmpeg", "utf8");
      await writeFile(paths.ffprobePath, "ffprobe", "utf8");
      await writeFile(
        path.join(paths.installRoot, "install-metadata.json"),
        JSON.stringify({
          source: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
          version: "8.1",
          sha256: archiveSha256,
          installedAt: "2026-04-25T00:00:00.000Z"
        }),
        "utf8"
      );

      const result = await ensureLatestProjectFfmpegTools(tempDirectory, {
        platform: "win32",
        fetchText: async (url) => (url.endsWith(".sha256") ? archiveSha256 : "8.1"),
        downloadFile: async () => {
          throw new Error("download should not be called");
        }
      });

      expect(result.installed).toBe(false);
      expect(result.ffmpegPath).toBe(paths.ffmpegPath);
      expect(result.ffprobePath).toBe(paths.ffprobePath);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("rejects automatic install outside Windows", async () => {
    await expect(
      ensureLatestProjectFfmpegTools("unused", {
        platform: "darwin"
      })
    ).rejects.toThrow(/Windows desktop/);
  });
});
