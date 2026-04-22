import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDownloaderAdapter,
  type MediaDownloadRequest,
  type MediaDownloadSession
} from "@services/media/downloader-adapter";
import type { MediaRuntimeDependencyDiagnostics } from "@services/media/dependency-readiness";
import type { MediaUrlClassification } from "@services/media/url-classifier";
import type { MediaCacheRootResolution } from "@services/media/media-cache-root";

function makeDependencyDiagnostics(): MediaRuntimeDependencyDiagnostics {
  return {
    checkedAt: "2026-04-22T00:00:00.000Z",
    allReady: true,
    statuses: []
  };
}

async function withTempDirectory<T>(
  run: (tempDirectory: string) => Promise<T>
): Promise<T> {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "downloader-adapter-"));
  try {
    return await run(tempDirectory);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

async function prepareYoutubeSession(tempDirectory: string): Promise<MediaDownloadSession> {
  const adapter = createDownloaderAdapter({
    dependencyChecker: async () => makeDependencyDiagnostics(),
    cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
      rootPath: tempDirectory,
      usedDefault: false
    }),
    urlClassifier: (): MediaUrlClassification => ({
      normalizedUrl: "https://www.youtube.com/watch?v=demo",
      sourceType: "youtube",
      host: "www.youtube.com"
    }),
    now: () => new Date(2026, 3, 22, 7, 20, 30),
    randomHex: () => "cafecafe"
  });

  return adapter.prepareSession(
    {
      sourceUrl: "https://www.youtube.com/watch?v=demo",
      mediaCacheRoot: tempDirectory,
      vaultId: "Smoke Vault"
    },
    new AbortController().signal
  );
}

describe("downloader adapter", () => {
  const baseRequest: MediaDownloadRequest = {
    sourceUrl: "https://www.youtube.com/watch?v=demo",
    mediaCacheRoot: "D:\\cache-root",
    vaultId: "My Vault"
  };

  it("prepares session directory and artifact paths", async () => {
    const mkdirCalls: string[] = [];
    const adapter = createDownloaderAdapter({
      dependencyChecker: async () => makeDependencyDiagnostics(),
      cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
        rootPath: "D:\\cache-root",
        usedDefault: false
      }),
      urlClassifier: (): MediaUrlClassification => ({
        normalizedUrl: "https://www.youtube.com/watch?v=demo",
        sourceType: "youtube",
        host: "www.youtube.com"
      }),
      mkdir: async (targetPath) => {
        mkdirCalls.push(targetPath);
      },
      now: () => new Date(2026, 3, 22, 7, 20, 30),
      randomHex: () => "a1b2c3d4"
    });

    const result = await adapter.prepareSession(baseRequest, new AbortController().signal);

    expect(result.sessionId).toBe("20260422-072030-a1b2c3d4");
    expect(result.sessionDirectory).toContain("my-vault");
    expect(result.artifacts.downloadedPath.endsWith("downloaded.mp4")).toBe(true);
    expect(result.artifacts.aiUploadDirectory.endsWith("ai-upload")).toBe(true);
    expect(mkdirCalls).toHaveLength(1);
  });

  it("uses direct-media extension from classified url", async () => {
    const adapter = createDownloaderAdapter({
      dependencyChecker: async () => makeDependencyDiagnostics(),
      cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
        rootPath: "/tmp/cache-root",
        usedDefault: false
      }),
      urlClassifier: (): MediaUrlClassification => ({
        normalizedUrl: "https://cdn.example.com/audio/ep1.ogg",
        sourceType: "direct_media",
        host: "cdn.example.com"
      }),
      mkdir: async () => undefined,
      now: () => new Date(2026, 3, 22, 7, 20, 30),
      randomHex: () => "deadbeef"
    });

    const result = await adapter.prepareSession(
      {
        ...baseRequest,
        sourceUrl: "https://cdn.example.com/audio/ep1.ogg",
        vaultId: "Mobile Vault"
      },
      new AbortController().signal
    );

    expect(result.artifacts.downloadedPath.endsWith("downloaded.ogg")).toBe(true);
  });

  it("throws validation_error when vaultId is empty", async () => {
    const adapter = createDownloaderAdapter({
      dependencyChecker: async () => makeDependencyDiagnostics(),
      cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
        rootPath: "/tmp/cache-root",
        usedDefault: false
      }),
      urlClassifier: (): MediaUrlClassification => ({
        normalizedUrl: "https://www.youtube.com/watch?v=demo",
        sourceType: "youtube",
        host: "www.youtube.com"
      }),
      mkdir: async () => undefined
    });

    await expect(
      adapter.prepareSession(
        {
          ...baseRequest,
          vaultId: "   "
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "validation_error"
    });
  });

  it("returns downloaded path when yt-dlp succeeds", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const downloadedPath = path.join(session.sessionDirectory, "downloaded.mp4");

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          await fs.writeFile(downloadedPath, "ok", "utf8");
          return {
            stdout: `${downloadedPath}\n`,
            stderr: ""
          };
        }
      });

      const result = await adapter.downloadMedia(session, new AbortController().signal);
      expect(result.downloadedPath).toBe(downloadedPath);
      expect(result.recoveredFromFailure).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });

  it("recovers when yt-dlp exits with failure but artifact exists", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const downloadedPath = path.join(session.sessionDirectory, "downloaded.mp4");

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          await fs.writeFile(downloadedPath, "ok", "utf8");
          const error = new Error("exit code 1") as Error & { stdout: string; stderr: string };
          error.stdout = `${downloadedPath}\n`;
          error.stderr = "HTTP 500 from upstream";
          throw error;
        }
      });

      const result = await adapter.downloadMedia(session, new AbortController().signal);
      expect(result.downloadedPath).toBe(downloadedPath);
      expect(result.recoveredFromFailure).toBe(true);
      expect(result.warnings[0]).toContain("Recovered download");
    });
  });

  it("throws download_failure when yt-dlp fails and artifact is missing", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          const error = new Error("exit code 1") as Error & { stdout: string; stderr: string };
          error.stdout = "";
          error.stderr = "403 Forbidden";
          throw error;
        }
      });

      await expect(adapter.downloadMedia(session, new AbortController().signal)).rejects.toMatchObject({
        category: "download_failure"
      });
    });
  });

  it("throws cancellation when signal is already aborted", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const controller = new AbortController();
      controller.abort();

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          throw new Error("should not execute");
        }
      });

      await expect(adapter.downloadMedia(session, controller.signal)).rejects.toMatchObject({
        category: "cancellation"
      });
    });
  });

  it("throws runtime_unavailable when yt-dlp command is missing", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          const error = new Error("spawn ENOENT") as Error & { code: string };
          error.code = "ENOENT";
          throw error;
        }
      });

      await expect(adapter.downloadMedia(session, new AbortController().signal)).rejects.toMatchObject({
        category: "runtime_unavailable"
      });
    });
  });
});
