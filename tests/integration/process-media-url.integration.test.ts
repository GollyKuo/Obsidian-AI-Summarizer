import { describe, expect, it } from "vitest";
import {
  processMediaUrl,
  type ProcessMediaUrlInput
} from "@orchestration/process-media-url";
import type {
  DownloaderAdapter,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";

function makeSession(): MediaDownloadSession {
  return {
    sessionId: "20260423-003000-a1b2c3d4",
    source: {
      normalizedUrl: "https://www.youtube.com/watch?v=demo",
      sourceType: "youtube",
      host: "www.youtube.com"
    },
    cacheRoot: "D:\\media-cache",
    sessionDirectory: "D:\\media-cache\\vault-a\\20260423-003000-a1b2c3d4",
    artifacts: {
      downloadedPath: "D:\\media-cache\\vault-a\\20260423-003000-a1b2c3d4\\downloaded.mp4",
      normalizedAudioPath: "D:\\media-cache\\vault-a\\20260423-003000-a1b2c3d4\\normalized.wav",
      transcriptPath: "D:\\media-cache\\vault-a\\20260423-003000-a1b2c3d4\\transcript.srt",
      metadataPath: "D:\\media-cache\\vault-a\\20260423-003000-a1b2c3d4\\metadata.json",
      aiUploadDirectory: "D:\\media-cache\\vault-a\\20260423-003000-a1b2c3d4\\ai-upload"
    },
    dependencyDiagnostics: {
      checkedAt: "2026-04-23T00:30:00.000Z",
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
    warnings: ["Recovered download from yt-dlp failure: HTTP 500"]
  };
}

describe("processMediaUrl integration", () => {
  it("prepares session, downloads media, and returns transcript-ready payload", async () => {
    const session = makeSession();
    const downloadResult = makeDownloadResult(session);
    const stages: string[] = [];
    const warnings: string[] = [];

    const downloaderAdapter: DownloaderAdapter = {
      async prepareSession() {
        return session;
      },
      async downloadMedia() {
        return downloadResult;
      }
    };

    const result = await processMediaUrl(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=demo",
        model: "gemini-2.5-flash",
        retentionMode: "none",
        mediaCacheRoot: "D:\\media-cache",
        vaultId: "vault-a"
      },
      { downloaderAdapter },
      new AbortController().signal,
      {
        onStageChange: (status, message) => {
          stages.push(`${status}:${message}`);
        },
        onWarning: (warning) => {
          warnings.push(warning);
        }
      }
    );

    expect(result.session.sessionId).toBe(session.sessionId);
    expect(result.downloadResult.downloadedPath).toBe(session.artifacts.downloadedPath);
    expect(result.transcriptReadyPayload.metadata.title).toBe("Demo Video");
    expect(result.transcriptReadyPayload.aiUploadDirectory).toBe(session.artifacts.aiUploadDirectory);
    expect(result.warnings).toHaveLength(1);
    expect(warnings).toEqual(result.warnings);
    expect(stages).toEqual([
      "validating:Validating media URL input",
      "acquiring:Preparing media acquisition session",
      "acquiring:Downloading media artifact"
    ]);
  });

  it("throws validation_error when sourceKind is not media_url", async () => {
    const downloaderAdapter: DownloaderAdapter = {
      async prepareSession() {
        throw new Error("should not execute");
      },
      async downloadMedia() {
        throw new Error("should not execute");
      }
    };

    const invalidInput = {
      sourceKind: "webpage_url",
      sourceValue: "https://example.com",
      model: "gemini-2.5-flash",
      retentionMode: "none",
      mediaCacheRoot: "D:\\media-cache",
      vaultId: "vault-a"
    } as unknown as ProcessMediaUrlInput;

    await expect(
      processMediaUrl(invalidInput, { downloaderAdapter }, new AbortController().signal)
    ).rejects.toMatchObject({
      category: "validation_error"
    });
  });

  it("throws cancellation when signal is already aborted", async () => {
    const downloaderAdapter: DownloaderAdapter = {
      async prepareSession() {
        throw new Error("should not execute");
      },
      async downloadMedia() {
        throw new Error("should not execute");
      }
    };
    const controller = new AbortController();
    controller.abort();

    await expect(
      processMediaUrl(
        {
          sourceKind: "media_url",
          sourceValue: "https://www.youtube.com/watch?v=demo",
          model: "gemini-2.5-flash",
          retentionMode: "none",
          mediaCacheRoot: "D:\\media-cache",
          vaultId: "vault-a"
        },
        { downloaderAdapter },
        controller.signal
      )
    ).rejects.toMatchObject({
      category: "cancellation"
    });
  });
});
