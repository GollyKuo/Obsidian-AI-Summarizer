import { describe, expect, it } from "vitest";
import { SummarizerError } from "@domain/errors";
import {
  processMediaUrl,
  type ProcessMediaUrlInput
} from "@orchestration/process-media-url";
import type {
  DownloaderAdapter,
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import type { PreUploadCompressor } from "@services/media/pre-upload-compressor";

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
    const preUploadWarnings = ["Compression fallback applied. Selected codec aac after 1 failed attempt(s)."];
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
    const preUploadCompressor: PreUploadCompressor = {
      async prepareForAiUpload() {
        return {
          normalizedAudioPath: session.artifacts.normalizedAudioPath,
          aiUploadArtifactPaths: [`${session.artifacts.aiUploadDirectory}\\ai-upload.m4a`],
          selectedCodec: "aac",
          chunkCount: 1,
          chunkDurationsMs: [180_000],
          vadApplied: false,
          warnings: preUploadWarnings
        };
      }
    };

    const result = await processMediaUrl(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=demo",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp",
        mediaCacheRoot: "D:\\media-cache",
        vaultId: "vault-a",
        mediaCompressionProfile: "balanced"
      },
      { downloaderAdapter, preUploadCompressor },
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
    expect(result.preUploadResult.selectedCodec).toBe("aac");
    expect(result.transcriptReadyPayload.metadata.title).toBe("Demo Video");
    expect(result.transcriptReadyPayload.aiUploadArtifactPaths).toEqual([
      `${session.artifacts.aiUploadDirectory}\\ai-upload.m4a`
    ]);
    expect(result.transcriptReadyPayload.chunkCount).toBe(1);
    expect(result.transcriptReadyPayload.chunkDurationsMs).toEqual([180_000]);
    expect(result.transcriptReadyPayload.vadApplied).toBe(false);
    expect(result.transcriptReadyPayload.selectedCodec).toBe("aac");
    expect(result.transcriptReadyPayload.aiUploadDirectory).toBe(session.artifacts.aiUploadDirectory);
    expect(result.warnings).toHaveLength(2);
    expect(warnings).toEqual(result.warnings);
    expect(stages).toEqual([
      "validating:Validating media URL input",
      "acquiring:Preparing media acquisition session",
      "acquiring:Downloading media artifact",
      "transcribing:Preparing AI-ready media artifacts"
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
    const preUploadCompressor: PreUploadCompressor = {
      async prepareForAiUpload() {
        throw new Error("should not execute");
      }
    };

    const invalidInput = {
      sourceKind: "webpage_url",
      sourceValue: "https://example.com",
      transcriptionProvider: "gemini",
      transcriptionModel: "gemini-2.5-flash",
      summaryProvider: "gemini",
      summaryModel: "gemini-2.5-flash",
      retentionMode: "delete_temp",
      mediaCacheRoot: "D:\\media-cache",
      vaultId: "vault-a"
    } as unknown as ProcessMediaUrlInput;

    await expect(
      processMediaUrl(invalidInput, { downloaderAdapter, preUploadCompressor }, new AbortController().signal)
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
    const preUploadCompressor: PreUploadCompressor = {
      async prepareForAiUpload() {
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
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp",
          mediaCacheRoot: "D:\\media-cache",
          vaultId: "vault-a",
          mediaCompressionProfile: "balanced"
        },
        { downloaderAdapter, preUploadCompressor },
        controller.signal
      )
    ).rejects.toMatchObject({
      category: "cancellation"
    });
  });

  it("throws download_failure when pre-upload compressor fails", async () => {
    const session = makeSession();
    const downloadResult = makeDownloadResult(session);
    const downloaderAdapter: DownloaderAdapter = {
      async prepareSession() {
        return session;
      },
      async downloadMedia() {
        return downloadResult;
      }
    };
    const preUploadCompressor: PreUploadCompressor = {
      async prepareForAiUpload() {
        throw new SummarizerError({
          category: "download_failure",
          message: "Pre-upload conversion failed.",
          recoverable: true
        });
      }
    };

    await expect(
      processMediaUrl(
        {
          sourceKind: "media_url",
          sourceValue: "https://www.youtube.com/watch?v=demo",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp",
          mediaCacheRoot: "D:\\media-cache",
          vaultId: "vault-a",
          mediaCompressionProfile: "balanced"
        },
        { downloaderAdapter, preUploadCompressor },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "download_failure"
    });
  });
});
