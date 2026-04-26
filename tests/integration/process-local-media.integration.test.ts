import { describe, expect, it } from "vitest";
import { SummarizerError } from "@domain/errors";
import {
  processLocalMedia,
  type ProcessLocalMediaInput
} from "@orchestration/process-local-media";
import type { MediaDownloadResult } from "@services/media/downloader-adapter";
import type {
  LocalMediaIngestionAdapter,
  LocalMediaIngestionSession
} from "@services/media/local-media-ingestion-adapter";
import type { PreUploadCompressor } from "@services/media/pre-upload-compressor";

function makeSession(): LocalMediaIngestionSession {
  return {
    sessionId: "20260423-140000-a1b2c3d4",
    source: {
      normalizedUrl: "file:///D:/source/demo.mp3",
      sourceType: "direct_media",
      host: "localhost"
    },
    cacheRoot: "D:\\media-cache",
    sessionDirectory: "D:\\media-cache\\vault-a\\20260423-140000-a1b2c3d4",
    artifacts: {
      downloadedPath: "D:\\media-cache\\vault-a\\20260423-140000-a1b2c3d4\\downloaded.mp3",
      normalizedAudioPath: "D:\\media-cache\\vault-a\\20260423-140000-a1b2c3d4\\normalized.wav",
      transcriptPath: "D:\\media-cache\\vault-a\\20260423-140000-a1b2c3d4\\transcript.srt",
      metadataPath: "D:\\media-cache\\vault-a\\20260423-140000-a1b2c3d4\\metadata.json",
      aiUploadDirectory: "D:\\media-cache\\vault-a\\20260423-140000-a1b2c3d4\\ai-upload"
    },
    dependencyDiagnostics: {
      checkedAt: "2026-04-23T14:00:00.000Z",
      allReady: true,
      statuses: []
    },
    localSourcePath: "D:\\source\\demo.mp3"
  };
}

function makeIngestionResult(session: LocalMediaIngestionSession): MediaDownloadResult {
  return {
    downloadedPath: session.artifacts.downloadedPath,
    recoveredFromFailure: false,
    metadata: {
      title: "demo",
      creatorOrAuthor: "Local User",
      platform: "Local File",
      source: session.localSourcePath,
      created: "2026-04-20T00:00:00.000Z"
    },
    warnings: ["Local metadata fallback applied."]
  };
}

describe("processLocalMedia integration", () => {
  it("prepares session, ingests local media, and returns transcript-ready payload", async () => {
    const session = makeSession();
    const ingestionResult = makeIngestionResult(session);
    const preUploadWarnings = ["Compression fallback applied. Selected codec aac after 1 failed attempt(s)."];
    const stages: string[] = [];
    const warnings: string[] = [];

    const localMediaIngestionAdapter: LocalMediaIngestionAdapter = {
      async prepareSession() {
        return session;
      },
      async ingestMedia() {
        return ingestionResult;
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

    const result = await processLocalMedia(
      {
        sourceKind: "local_media",
        sourceValue: "D:\\source\\demo.mp3",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp",
        mediaCacheRoot: "D:\\media-cache",
        vaultId: "vault-a",
        mediaCompressionProfile: "balanced"
      },
      { localMediaIngestionAdapter, preUploadCompressor },
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
    expect(result.ingestionResult.downloadedPath).toBe(session.artifacts.downloadedPath);
    expect(result.preUploadResult.selectedCodec).toBe("aac");
    expect(result.transcriptReadyPayload.sourceType).toBe("local_media");
    expect(result.transcriptReadyPayload.sourcePath).toBe(session.localSourcePath);
    expect(result.transcriptReadyPayload.metadata.platform).toBe("Local File");
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
      "validating:Validating local media input",
      "acquiring:Preparing local media session",
      "acquiring:Ingesting local media artifact",
      "transcribing:Preparing AI-ready media artifacts"
    ]);
  });

  it("throws validation_error when sourceKind is not local_media", async () => {
    const localMediaIngestionAdapter: LocalMediaIngestionAdapter = {
      async prepareSession() {
        throw new Error("should not execute");
      },
      async ingestMedia() {
        throw new Error("should not execute");
      }
    };
    const preUploadCompressor: PreUploadCompressor = {
      async prepareForAiUpload() {
        throw new Error("should not execute");
      }
    };

    const invalidInput = {
      sourceKind: "media_url",
      sourceValue: "D:\\source\\demo.mp3",
      transcriptionProvider: "gemini",
      transcriptionModel: "gemini-2.5-flash",
      summaryProvider: "gemini",
      summaryModel: "gemini-2.5-flash",
      retentionMode: "delete_temp",
      mediaCacheRoot: "D:\\media-cache",
      vaultId: "vault-a"
    } as unknown as ProcessLocalMediaInput;

    await expect(
      processLocalMedia(
        invalidInput,
        { localMediaIngestionAdapter, preUploadCompressor },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "validation_error"
    });
  });

  it("throws cancellation when signal is already aborted", async () => {
    const localMediaIngestionAdapter: LocalMediaIngestionAdapter = {
      async prepareSession() {
        throw new Error("should not execute");
      },
      async ingestMedia() {
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
      processLocalMedia(
        {
          sourceKind: "local_media",
          sourceValue: "D:\\source\\demo.mp3",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp",
          mediaCacheRoot: "D:\\media-cache",
          vaultId: "vault-a",
          mediaCompressionProfile: "balanced"
        },
        { localMediaIngestionAdapter, preUploadCompressor },
        controller.signal
      )
    ).rejects.toMatchObject({
      category: "cancellation"
    });
  });

  it("throws download_failure when pre-upload compressor fails", async () => {
    const session = makeSession();
    const ingestionResult = makeIngestionResult(session);
    const localMediaIngestionAdapter: LocalMediaIngestionAdapter = {
      async prepareSession() {
        return session;
      },
      async ingestMedia() {
        return ingestionResult;
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
      processLocalMedia(
        {
          sourceKind: "local_media",
          sourceValue: "D:\\source\\demo.mp3",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp",
          mediaCacheRoot: "D:\\media-cache",
          vaultId: "vault-a",
          mediaCompressionProfile: "balanced"
        },
        { localMediaIngestionAdapter, preUploadCompressor },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "download_failure"
    });
  });
});
