import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import { createPreUploadCompressor } from "@services/media/pre-upload-compressor";

async function withTempDirectory<T>(run: (tempDirectory: string) => Promise<T>): Promise<T> {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "pre-upload-compressor-"));
  try {
    return await run(tempDirectory);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function makeSession(tempDirectory: string): MediaDownloadSession {
  const sessionDirectory = path.join(tempDirectory, "vault-a", "20260423-010000-a1b2c3d4");
  return {
    sessionId: "20260423-010000-a1b2c3d4",
    source: {
      normalizedUrl: "https://www.youtube.com/watch?v=demo",
      sourceType: "youtube",
      host: "www.youtube.com"
    },
    cacheRoot: tempDirectory,
    sessionDirectory,
    artifacts: {
      downloadedPath: path.join(sessionDirectory, "downloaded.mp4"),
      normalizedAudioPath: path.join(sessionDirectory, "normalized.wav"),
      transcriptPath: path.join(sessionDirectory, "transcript.srt"),
      metadataPath: path.join(sessionDirectory, "metadata.json"),
      aiUploadDirectory: path.join(sessionDirectory, "ai-upload")
    },
    dependencyDiagnostics: {
      checkedAt: "2026-04-23T00:00:00.000Z",
      allReady: true,
      statuses: []
    }
  };
}

function makeDownloadResult(session: MediaDownloadSession): MediaDownloadResult {
  return {
    downloadedPath: session.artifacts.downloadedPath,
    recoveredFromFailure: false,
    metadata: {
      title: "Demo Video",
      creatorOrAuthor: "Demo Channel",
      platform: "YouTube",
      source: session.source.normalizedUrl,
      created: "2026-04-20T00:00:00.000Z"
    },
    warnings: []
  };
}

describe("pre-upload compressor", () => {
  it("generates opus ai-upload artifact for balanced profile", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = makeSession(tempDirectory);
      await fs.mkdir(session.sessionDirectory, { recursive: true });
      await fs.writeFile(session.artifacts.downloadedPath, "downloaded", "utf8");

      const compressor = createPreUploadCompressor({
        commandExecutor: async (_, args) => {
          const outputPath = args[args.length - 1];
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, "ok", "utf8");
          return { stdout: "", stderr: "" };
        }
      });

      const result = await compressor.prepareForAiUpload(
        {
          session,
          downloadResult: makeDownloadResult(session),
          profile: "balanced"
        },
        new AbortController().signal
      );

      expect(result.selectedCodec).toBe("opus");
      expect(result.aiUploadArtifactPaths[0].endsWith("ai-upload.ogg")).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  it("falls back to aac when opus conversion fails", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = makeSession(tempDirectory);
      await fs.mkdir(session.sessionDirectory, { recursive: true });
      await fs.writeFile(session.artifacts.downloadedPath, "downloaded", "utf8");

      const compressor = createPreUploadCompressor({
        commandExecutor: async (_, args) => {
          const outputPath = args[args.length - 1];
          if (outputPath.endsWith("ai-upload.ogg")) {
            const error = new Error("opus failed") as Error & { stderr: string };
            error.stderr = "Unknown encoder 'libopus'";
            throw error;
          }

          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, "ok", "utf8");
          return { stdout: "", stderr: "" };
        }
      });

      const result = await compressor.prepareForAiUpload(
        {
          session,
          downloadResult: makeDownloadResult(session),
          profile: "balanced"
        },
        new AbortController().signal
      );

      expect(result.selectedCodec).toBe("aac");
      expect(result.aiUploadArtifactPaths[0].endsWith("ai-upload.m4a")).toBe(true);
      expect(result.warnings[0]).toContain("Compression fallback applied");
    });
  });

  it("throws download_failure when all conversion presets fail", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = makeSession(tempDirectory);
      await fs.mkdir(session.sessionDirectory, { recursive: true });
      await fs.writeFile(session.artifacts.downloadedPath, "downloaded", "utf8");

      const compressor = createPreUploadCompressor({
        commandExecutor: async (_, args) => {
          const outputPath = args[args.length - 1];
          if (outputPath.endsWith("normalized.wav")) {
            await fs.writeFile(outputPath, "ok", "utf8");
            return { stdout: "", stderr: "" };
          }

          const error = new Error("convert failed") as Error & { stderr: string };
          error.stderr = "encoder failed";
          throw error;
        }
      });

      await expect(
        compressor.prepareForAiUpload(
          {
            session,
            downloadResult: makeDownloadResult(session),
            profile: "balanced"
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        category: "download_failure"
      });
    });
  });

  it("throws runtime_unavailable when ffmpeg command is missing", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = makeSession(tempDirectory);
      await fs.mkdir(session.sessionDirectory, { recursive: true });
      await fs.writeFile(session.artifacts.downloadedPath, "downloaded", "utf8");

      const compressor = createPreUploadCompressor({
        commandExecutor: async () => {
          const error = new Error("spawn ENOENT") as Error & { code: string };
          error.code = "ENOENT";
          throw error;
        }
      });

      await expect(
        compressor.prepareForAiUpload(
          {
            session,
            downloadResult: makeDownloadResult(session),
            profile: "balanced"
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        category: "runtime_unavailable"
      });
    });
  });

  it("throws cancellation when signal is already aborted", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = makeSession(tempDirectory);
      await fs.mkdir(session.sessionDirectory, { recursive: true });
      await fs.writeFile(session.artifacts.downloadedPath, "downloaded", "utf8");

      const compressor = createPreUploadCompressor({
        commandExecutor: async () => {
          throw new Error("should not execute");
        }
      });
      const controller = new AbortController();
      controller.abort();

      await expect(
        compressor.prepareForAiUpload(
          {
            session,
            downloadResult: makeDownloadResult(session),
            profile: "balanced"
          },
          controller.signal
        )
      ).rejects.toMatchObject({
        category: "cancellation"
      });
    });
  });
});
