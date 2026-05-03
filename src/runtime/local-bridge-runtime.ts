import { SummarizerError } from "@domain/errors";
import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaUrlRequest,
  WebpageProcessResult,
  WebpageRequest
} from "@domain/types";
import {
  assertMediaDependenciesReady,
  createMediaRuntimeDependencySpecs,
  type MediaRuntimeDependencyDiagnostics
} from "@services/media/dependency-readiness";
import {
  createDownloaderAdapter,
  type DownloaderAdapter
} from "@services/media/downloader-adapter";
import {
  createLocalMediaIngestionAdapter,
  type LocalMediaIngestionAdapter
} from "@services/media/local-media-ingestion-adapter";
import {
  createPreUploadCompressor,
  type PreUploadCompressor
} from "@services/media/pre-upload-compressor";
import { processLocalMedia as runProcessLocalMediaFlow } from "@orchestration/process-local-media";
import { processMediaUrl as runProcessMediaUrlFlow } from "@orchestration/process-media-url";
import type { RuntimeProvider } from "@runtime/runtime-provider";

interface LocalBridgeRuntimeProviderOptions {
  dependencyChecker?: () => Promise<unknown>;
  downloaderAdapter?: DownloaderAdapter;
  localMediaIngestionAdapter?: LocalMediaIngestionAdapter;
  preUploadCompressor?: PreUploadCompressor;
  defaultVaultId?: string;
}

export class LocalBridgeRuntimeProvider implements RuntimeProvider {
  public readonly strategy = "local_bridge";
  private readonly dependencyChecker: (() => Promise<unknown>) | null;
  private readonly downloaderAdapter: DownloaderAdapter | null;
  private readonly localMediaIngestionAdapter: LocalMediaIngestionAdapter | null;
  private readonly preUploadCompressor: PreUploadCompressor | null;
  private readonly defaultVaultId: string;

  public constructor(options: LocalBridgeRuntimeProviderOptions = {}) {
    this.dependencyChecker = options.dependencyChecker ?? null;
    this.downloaderAdapter = options.downloaderAdapter ?? null;
    this.localMediaIngestionAdapter = options.localMediaIngestionAdapter ?? null;
    this.preUploadCompressor = options.preUploadCompressor ?? null;
    this.defaultVaultId = options.defaultVaultId ?? "default-vault";
  }

  private buildMediaRuntimeDependencyChecker(
    input: Pick<MediaUrlRequest | LocalMediaRequest, "ytDlpPath" | "ffmpegPath" | "ffprobePath">
  ): () => Promise<MediaRuntimeDependencyDiagnostics> {
    return () =>
      assertMediaDependenciesReady({
        specs: createMediaRuntimeDependencySpecs({
          ytDlpPath: input.ytDlpPath,
          ffmpegPath: input.ffmpegPath,
          ffprobePath: input.ffprobePath
        })
      });
  }

  private buildDependencyChecker(
    input: Pick<MediaUrlRequest | LocalMediaRequest, "ytDlpPath" | "ffmpegPath" | "ffprobePath">
  ): () => Promise<unknown> {
    return this.dependencyChecker ?? this.buildMediaRuntimeDependencyChecker(input);
  }

  private buildPreUploadCompressor(
    input: Pick<MediaUrlRequest | LocalMediaRequest, "ffmpegPath" | "ffprobePath">
  ): PreUploadCompressor {
    return (
      this.preUploadCompressor ??
      createPreUploadCompressor({
        ffmpegCommand: input.ffmpegPath,
        ffprobeCommand: input.ffprobePath
      })
    );
  }

  public async processMediaUrl(input: MediaUrlRequest, signal: AbortSignal): Promise<MediaProcessResult> {
    const dependencyChecker = this.buildDependencyChecker(input);
    const mediaRuntimeDependencyChecker = this.buildMediaRuntimeDependencyChecker(input);
    await dependencyChecker();

    const processResult = await runProcessMediaUrlFlow(
      {
        sourceKind: "media_url",
        sourceValue: input.sourceValue,
        transcriptionProvider: input.transcriptionProvider,
        transcriptionModel: input.transcriptionModel,
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel,
        retentionMode: input.retentionMode,
        mediaCacheRoot: input.mediaCacheRoot ?? "",
        ytDlpPath: input.ytDlpPath,
        ffmpegPath: input.ffmpegPath,
        ffprobePath: input.ffprobePath,
        vaultId: input.vaultId ?? this.defaultVaultId,
        mediaCompressionProfile: input.mediaCompressionProfile ?? "balanced",
        deferCompletedCleanup: true
      },
      {
        downloaderAdapter:
          this.downloaderAdapter ??
          createDownloaderAdapter({
            dependencyChecker: mediaRuntimeDependencyChecker,
            ytDlpCommand: input.ytDlpPath,
            ffmpegCommand: input.ffmpegPath
          }),
        preUploadCompressor: this.buildPreUploadCompressor(input)
      },
      signal
    );

    const normalizedText = [
      `AI-ready artifacts: ${processResult.transcriptReadyPayload.aiUploadArtifactPaths.join(", ")}`,
      `Selected codec: ${processResult.transcriptReadyPayload.selectedCodec}`,
      `Chunk count: ${processResult.transcriptReadyPayload.chunkCount}`
    ].join("\n");

    return {
      metadata: processResult.transcriptReadyPayload.metadata,
      normalizedText,
      transcript: [],
      aiUploadArtifactPaths: processResult.transcriptReadyPayload.aiUploadArtifactPaths,
      artifactCleanup: {
        downloadedPath: processResult.session.artifacts.downloadedPath,
        normalizedAudioPath: processResult.session.artifacts.normalizedAudioPath,
        transcriptPath: processResult.session.artifacts.transcriptPath,
        subtitlePath: processResult.session.artifacts.subtitlePath,
        metadataPath: processResult.session.artifacts.metadataPath,
        aiUploadDirectory: processResult.session.artifacts.aiUploadDirectory,
        aiUploadArtifactPaths: processResult.transcriptReadyPayload.aiUploadArtifactPaths
      },
      warnings: [
        ...processResult.warnings,
        "AI-ready media artifacts prepared for transcription handoff."
      ]
    };
  }

  public async processLocalMedia(input: LocalMediaRequest, signal: AbortSignal): Promise<MediaProcessResult> {
    const dependencyChecker = this.buildDependencyChecker(input);
    const mediaRuntimeDependencyChecker = this.buildMediaRuntimeDependencyChecker(input);
    await dependencyChecker();

    const processResult = await runProcessLocalMediaFlow(
      {
        sourceKind: "local_media",
        sourceValue: input.sourceValue,
        transcriptionProvider: input.transcriptionProvider,
        transcriptionModel: input.transcriptionModel,
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel,
        retentionMode: input.retentionMode,
        mediaCacheRoot: input.mediaCacheRoot ?? "",
        ytDlpPath: input.ytDlpPath,
        ffmpegPath: input.ffmpegPath,
        ffprobePath: input.ffprobePath,
        vaultId: input.vaultId ?? this.defaultVaultId,
        mediaCompressionProfile: input.mediaCompressionProfile ?? "balanced",
        deferCompletedCleanup: true
      },
      {
        localMediaIngestionAdapter:
          this.localMediaIngestionAdapter ??
          createLocalMediaIngestionAdapter({ dependencyChecker: mediaRuntimeDependencyChecker }),
        preUploadCompressor: this.buildPreUploadCompressor(input)
      },
      signal
    );

    const normalizedText = [
      `Source path: ${processResult.transcriptReadyPayload.sourcePath}`,
      `AI-ready artifacts: ${processResult.transcriptReadyPayload.aiUploadArtifactPaths.join(", ")}`,
      `Selected codec: ${processResult.transcriptReadyPayload.selectedCodec}`,
      `Chunk count: ${processResult.transcriptReadyPayload.chunkCount}`
    ].join("\n");

    return {
      metadata: processResult.transcriptReadyPayload.metadata,
      normalizedText,
      transcript: [],
      aiUploadArtifactPaths: processResult.transcriptReadyPayload.aiUploadArtifactPaths,
      artifactCleanup: {
        downloadedPath: processResult.session.artifacts.downloadedPath,
        normalizedAudioPath: processResult.session.artifacts.normalizedAudioPath,
        transcriptPath: processResult.session.artifacts.transcriptPath,
        subtitlePath: processResult.session.artifacts.subtitlePath,
        metadataPath: processResult.session.artifacts.metadataPath,
        aiUploadDirectory: processResult.session.artifacts.aiUploadDirectory,
        aiUploadArtifactPaths: processResult.transcriptReadyPayload.aiUploadArtifactPaths
      },
      warnings: [
        ...processResult.warnings,
        "AI-ready media artifacts prepared for transcription handoff."
      ]
    };
  }

  public async processWebpage(_: WebpageRequest, __: AbortSignal): Promise<WebpageProcessResult> {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Local bridge runtime does not handle webpage flow.",
      recoverable: false
    });
  }
}
