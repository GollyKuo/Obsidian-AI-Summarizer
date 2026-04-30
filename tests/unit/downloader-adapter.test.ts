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

async function prepareClassifiedSession(
  tempDirectory: string,
  classification: MediaUrlClassification
): Promise<MediaDownloadSession> {
  const adapter = createDownloaderAdapter({
    dependencyChecker: async () => makeDependencyDiagnostics(),
    cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
      rootPath: tempDirectory,
      usedDefault: false
    }),
    urlClassifier: (): MediaUrlClassification => classification,
    now: () => new Date(2026, 3, 22, 7, 20, 30),
    randomHex: () => "cafecafe"
  });

  return adapter.prepareSession(
    {
      sourceUrl: classification.normalizedUrl,
      mediaCacheRoot: tempDirectory,
      vaultId: "Smoke Vault"
    },
    new AbortController().signal
  );
}

async function prepareYoutubeSession(tempDirectory: string): Promise<MediaDownloadSession> {
  return prepareClassifiedSession(tempDirectory, {
    normalizedUrl: "https://www.youtube.com/watch?v=demo",
    sourceType: "youtube",
    host: "www.youtube.com"
  });
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
        },
        now: () => new Date("2026-04-22T08:00:00.000Z")
      });

      const result = await adapter.downloadMedia(session, new AbortController().signal);
      expect(result.downloadedPath).toBe(downloadedPath);
      expect(result.recoveredFromFailure).toBe(false);
      expect(result.metadata.platform).toBe("YouTube");
      expect(result.warnings).toHaveLength(0);

      const metadataRaw = await fs.readFile(session.artifacts.metadataPath, "utf8");
      const metadata = JSON.parse(metadataRaw) as { downloadedPath: string };
      expect(metadata.downloadedPath).toBe(downloadedPath);
    });
  });

  it("normalizes metadata from yt-dlp prints", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const downloadedPath = path.join(session.sessionDirectory, "downloaded.mp4");

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          await fs.writeFile(downloadedPath, "ok", "utf8");
          return {
            stdout: [
              "__META_TITLE__Unit Test Video",
              "__META_CREATOR__Test Channel",
              "__META_PLATFORM__youtube",
              "__META_CREATED__20260421",
              `__DOWNLOADED_PATH__${downloadedPath}`
            ].join("\n"),
            stderr: ""
          };
        },
        now: () => new Date("2026-04-22T08:00:00.000Z")
      });

      const result = await adapter.downloadMedia(session, new AbortController().signal);
      expect(result.metadata.title).toBe("Unit Test Video");
      expect(result.metadata.creatorOrAuthor).toBe("Test Channel");
      expect(result.metadata.platform).toBe("YouTube");
      expect(result.metadata.created).toBe("2026-04-21T00:00:00.000Z");

      const metadataRaw = await fs.readFile(session.artifacts.metadataPath, "utf8");
      const metadata = JSON.parse(metadataRaw) as {
        title: string;
        creatorOrAuthor: string;
        platform: string;
        sourceUrl: string;
      };
      expect(metadata.title).toBe("Unit Test Video");
      expect(metadata.creatorOrAuthor).toBe("Test Channel");
      expect(metadata.platform).toBe("YouTube");
      expect(metadata.sourceUrl).toBe("https://www.youtube.com/watch?v=demo");
    });
  });

  it("applies legacy YouTube resilience options to yt-dlp", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const downloadedPath = path.join(session.sessionDirectory, "downloaded.mp4");
      let capturedArgs: string[] = [];

      const adapter = createDownloaderAdapter({
        commandExecutor: async (_command, args) => {
          capturedArgs = args;
          await fs.writeFile(downloadedPath, "ok", "utf8");
          return {
            stdout: `__DOWNLOADED_PATH__${downloadedPath}\n`,
            stderr: ""
          };
        }
      });

      await adapter.downloadMedia(session, new AbortController().signal);

      expect(capturedArgs).toEqual(
        expect.arrayContaining([
          "--format",
          "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
          "--merge-output-format",
          "mp4",
          "--retries",
          "10",
          "--fragment-retries",
          "10",
          "--socket-timeout",
          "30",
          "--http-chunk-size",
          "10485760",
          "--continue"
        ])
      );
    });
  });

  it("does not apply YouTube-only yt-dlp options to podcast or direct media", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const sources: MediaUrlClassification[] = [
        {
          normalizedUrl: "https://feeds.example.com/episode.mp3",
          sourceType: "podcast",
          host: "feeds.example.com"
        },
        {
          normalizedUrl: "https://cdn.example.com/audio/clip.ogg",
          sourceType: "direct_media",
          host: "cdn.example.com"
        }
      ];

      for (const source of sources) {
        const session = await prepareClassifiedSession(tempDirectory, source);
        const extension = path.extname(session.artifacts.downloadedPath);
        const downloadedPath = path.join(session.sessionDirectory, `downloaded${extension}`);
        let capturedArgs: string[] = [];

        const adapter = createDownloaderAdapter({
          commandExecutor: async (_command, args) => {
            capturedArgs = args;
            await fs.writeFile(downloadedPath, "ok", "utf8");
            return {
              stdout: `__DOWNLOADED_PATH__${downloadedPath}\n`,
              stderr: ""
            };
          }
        });

        await adapter.downloadMedia(session, new AbortController().signal);

        expect(capturedArgs).not.toContain("--format");
        expect(capturedArgs).not.toContain("--merge-output-format");
        expect(capturedArgs).not.toContain("--fragment-retries");
        expect(capturedArgs).not.toContain("--http-chunk-size");
        expect(capturedArgs).toContain(source.normalizedUrl);
      }
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
      expect(result.metadata.platform).toBe("YouTube");
      expect(result.warnings[0]).toContain("Recovered download");
    });
  });

  it("does not recover from artifact paths outside current session", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const outsideDirectory = path.join(tempDirectory, "outside-session");
      const outsidePath = path.join(outsideDirectory, "downloaded.mp4");
      await fs.mkdir(outsideDirectory, { recursive: true });
      await fs.writeFile(outsidePath, "outside", "utf8");

      const adapter = createDownloaderAdapter({
        commandExecutor: async () => {
          const error = new Error("exit code 1") as Error & { stdout: string; stderr: string };
          error.stdout = `${outsidePath}\n`;
          error.stderr = "Network reset";
          throw error;
        }
      });

      await expect(adapter.downloadMedia(session, new AbortController().signal)).rejects.toMatchObject({
        category: "download_failure"
      });
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

  it("throws cancellation when signal aborts during download", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const session = await prepareYoutubeSession(tempDirectory);
      const controller = new AbortController();

      const adapter = createDownloaderAdapter({
        commandExecutor: async (_, __, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                const abortError = new Error("aborted") as Error & { name: string; code: string };
                abortError.name = "AbortError";
                abortError.code = "ABORT_ERR";
                reject(abortError);
              },
              { once: true }
            );
          })
      });

      const pending = adapter.downloadMedia(session, controller.signal);
      controller.abort();

      await expect(pending).rejects.toMatchObject({
        category: "cancellation"
      });
    });
  });

  it("maps metadata write failure to download_failure", async () => {
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
        },
        writeFile: async () => {
          throw new Error("disk full");
        }
      });

      await expect(adapter.downloadMedia(session, new AbortController().signal)).rejects.toMatchObject({
        category: "download_failure"
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
