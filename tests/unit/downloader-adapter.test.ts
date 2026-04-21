import { describe, expect, it } from "vitest";
import {
  createDownloaderAdapter,
  type MediaDownloadRequest
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
});
