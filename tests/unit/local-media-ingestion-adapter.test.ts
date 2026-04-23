import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createLocalMediaIngestionAdapter,
  type LocalMediaIngestionRequest
} from "@services/media/local-media-ingestion-adapter";
import type { MediaRuntimeDependencyDiagnostics } from "@services/media/dependency-readiness";
import type { MediaCacheRootResolution } from "@services/media/media-cache-root";

function makeDependencyDiagnostics(): MediaRuntimeDependencyDiagnostics {
  return {
    checkedAt: "2026-04-23T12:00:00.000Z",
    allReady: true,
    statuses: []
  };
}

async function withTempDirectory<T>(run: (tempDirectory: string) => Promise<T>): Promise<T> {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "local-ingestion-adapter-"));
  try {
    return await run(tempDirectory);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

describe("local media ingestion adapter", () => {
  const baseRequest: LocalMediaIngestionRequest = {
    sourcePath: "D:\\source\\demo.mp3",
    mediaCacheRoot: "D:\\cache-root",
    vaultId: "My Vault"
  };

  it("prepares session directory and artifact paths", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const sourceFile = path.join(tempDirectory, "source", "demo.MP3");
      await fs.mkdir(path.dirname(sourceFile), { recursive: true });
      await fs.writeFile(sourceFile, "media", "utf8");

      const mkdirCalls: string[] = [];
      const adapter = createLocalMediaIngestionAdapter({
        dependencyChecker: async () => makeDependencyDiagnostics(),
        cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
          rootPath: tempDirectory,
          usedDefault: false
        }),
        mkdir: async (targetPath) => {
          mkdirCalls.push(targetPath);
          await fs.mkdir(targetPath, { recursive: true });
        },
        now: () => new Date(2026, 3, 23, 12, 34, 56),
        randomHex: () => "a1b2c3d4"
      });

      const session = await adapter.prepareSession(
        {
          ...baseRequest,
          sourcePath: sourceFile
        },
        new AbortController().signal
      );

      expect(session.sessionId).toBe("20260423-123456-a1b2c3d4");
      expect(session.localSourcePath).toBe(path.resolve(sourceFile));
      expect(session.sessionDirectory).toContain("my-vault");
      expect(session.artifacts.downloadedPath.endsWith("downloaded.mp3")).toBe(true);
      expect(mkdirCalls).toHaveLength(1);
    });
  });

  it("throws validation_error when local source path extension is unsupported", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const sourceFile = path.join(tempDirectory, "source", "demo.txt");
      await fs.mkdir(path.dirname(sourceFile), { recursive: true });
      await fs.writeFile(sourceFile, "media", "utf8");

      const adapter = createLocalMediaIngestionAdapter({
        dependencyChecker: async () => makeDependencyDiagnostics(),
        cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
          rootPath: tempDirectory,
          usedDefault: false
        }),
        mkdir: async (targetPath) => {
          await fs.mkdir(targetPath, { recursive: true });
        }
      });

      await expect(
        adapter.prepareSession(
          {
            ...baseRequest,
            sourcePath: sourceFile
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        category: "validation_error"
      });
    });
  });

  it("ingests local media and persists metadata artifact", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const sourceFile = path.join(tempDirectory, "source", "demo.mp3");
      await fs.mkdir(path.dirname(sourceFile), { recursive: true });
      await fs.writeFile(sourceFile, "demo-media", "utf8");

      const adapter = createLocalMediaIngestionAdapter({
        dependencyChecker: async () => makeDependencyDiagnostics(),
        cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
          rootPath: tempDirectory,
          usedDefault: false
        }),
        now: () => new Date("2026-04-23T12:00:00.000Z"),
        randomHex: () => "cafecafe"
      });

      const session = await adapter.prepareSession(
        {
          ...baseRequest,
          sourcePath: sourceFile
        },
        new AbortController().signal
      );
      const result = await adapter.ingestMedia(session, new AbortController().signal);

      expect(result.downloadedPath).toBe(session.artifacts.downloadedPath);
      expect(result.metadata.platform).toBe("Local File");
      expect(result.metadata.source).toBe(path.resolve(sourceFile));
      expect(result.warnings).toEqual([]);

      const copiedRaw = await fs.readFile(session.artifacts.downloadedPath, "utf8");
      expect(copiedRaw).toBe("demo-media");

      const metadataRaw = await fs.readFile(session.artifacts.metadataPath, "utf8");
      const metadata = JSON.parse(metadataRaw) as {
        sourceType: string;
        sourcePath: string;
        downloadedPath: string;
      };
      expect(metadata.sourceType).toBe("local_media");
      expect(metadata.sourcePath).toBe(path.resolve(sourceFile));
      expect(metadata.downloadedPath).toBe(session.artifacts.downloadedPath);
    });
  });

  it("throws validation_error when source file does not exist", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const sourceFile = path.join(tempDirectory, "source", "missing.mp3");
      const adapter = createLocalMediaIngestionAdapter({
        dependencyChecker: async () => makeDependencyDiagnostics(),
        cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
          rootPath: tempDirectory,
          usedDefault: false
        }),
        mkdir: async (targetPath) => {
          await fs.mkdir(targetPath, { recursive: true });
        }
      });

      const session = await adapter.prepareSession(
        {
          ...baseRequest,
          sourcePath: sourceFile
        },
        new AbortController().signal
      );

      await expect(adapter.ingestMedia(session, new AbortController().signal)).rejects.toMatchObject({
        category: "validation_error"
      });
    });
  });

  it("throws validation_error when source file exceeds v1 size limit", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const sourceFile = path.join(tempDirectory, "source", "demo.mp3");
      await fs.mkdir(path.dirname(sourceFile), { recursive: true });
      await fs.writeFile(sourceFile, "demo-media", "utf8");

      const adapter = createLocalMediaIngestionAdapter({
        dependencyChecker: async () => makeDependencyDiagnostics(),
        cacheRootResolver: async (): Promise<MediaCacheRootResolution> => ({
          rootPath: tempDirectory,
          usedDefault: false
        }),
        stat: async (targetPath) => {
          if (targetPath === path.resolve(sourceFile)) {
            return {
              isFile: () => true,
              size: 3 * 1024 * 1024 * 1024,
              mtimeMs: Date.parse("2026-04-20T00:00:00.000Z")
            };
          }
          return fs.stat(targetPath);
        }
      });

      const session = await adapter.prepareSession(
        {
          ...baseRequest,
          sourcePath: sourceFile
        },
        new AbortController().signal
      );

      await expect(adapter.ingestMedia(session, new AbortController().signal)).rejects.toMatchObject({
        category: "validation_error"
      });
    });
  });
});
