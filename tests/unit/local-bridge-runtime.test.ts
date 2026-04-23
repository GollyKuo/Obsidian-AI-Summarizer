import { describe, expect, it } from "vitest";
import { LocalBridgeRuntimeProvider } from "@runtime/local-bridge-runtime";
import type {
  MediaDownloadResult,
  MediaDownloadSession,
  DownloaderAdapter
} from "@services/media/downloader-adapter";
import type { PreUploadCompressor } from "@services/media/pre-upload-compressor";

function makeSession(): MediaDownloadSession {
  return {
    sessionId: "20260423-011500-a1b2c3d4",
    source: {
      normalizedUrl: "https://www.youtube.com/watch?v=demo",
      sourceType: "youtube",
      host: "www.youtube.com"
    },
    cacheRoot: "D:\\media-cache",
    sessionDirectory: "D:\\media-cache\\vault-a\\20260423-011500-a1b2c3d4",
    artifacts: {
      downloadedPath: "D:\\media-cache\\vault-a\\20260423-011500-a1b2c3d4\\downloaded.mp4",
      normalizedAudioPath: "D:\\media-cache\\vault-a\\20260423-011500-a1b2c3d4\\normalized.wav",
      transcriptPath: "D:\\media-cache\\vault-a\\20260423-011500-a1b2c3d4\\transcript.srt",
      metadataPath: "D:\\media-cache\\vault-a\\20260423-011500-a1b2c3d4\\metadata.json",
      aiUploadDirectory: "D:\\media-cache\\vault-a\\20260423-011500-a1b2c3d4\\ai-upload"
    },
    dependencyDiagnostics: {
      checkedAt: "2026-04-23T01:15:00.000Z",
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

describe("LocalBridgeRuntimeProvider", () => {
  it("processes media url and returns ai-ready handoff summary", async () => {
    const session = makeSession();
    const downloadResult = makeDownloadResult(session);
    let receivedVaultId = "";

    const downloaderAdapter: DownloaderAdapter = {
      async prepareSession(input) {
        receivedVaultId = input.vaultId;
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
          aiUploadArtifactPaths: [`${session.artifacts.aiUploadDirectory}\\ai-upload.ogg`],
          selectedCodec: "opus",
          chunkCount: 1,
          chunkDurationsMs: [120000],
          vadApplied: false,
          warnings: []
        };
      }
    };

    const runtime = new LocalBridgeRuntimeProvider({
      dependencyChecker: async () => undefined,
      downloaderAdapter,
      preUploadCompressor,
      defaultVaultId: "fallback-vault"
    });

    const result = await runtime.processMediaUrl(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=demo",
        model: "gemini-2.5-flash",
        retentionMode: "none"
      },
      new AbortController().signal
    );

    expect(receivedVaultId).toBe("fallback-vault");
    expect(result.metadata.title).toBe("Demo Video");
    expect(result.normalizedText).toContain("AI-ready artifacts:");
    expect(result.transcript).toEqual([]);
    expect(
      result.warnings.some((warning) => warning.includes("Transcript generation is not implemented yet"))
    ).toBe(true);
  });
});
