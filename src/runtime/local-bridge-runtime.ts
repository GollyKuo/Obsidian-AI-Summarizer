import { SummarizerError } from "@domain/errors";
import type {
  LocalMediaRequest,
  MediaProcessResult,
  MediaUrlRequest,
  WebpageProcessResult,
  WebpageRequest
} from "@domain/types";
import { assertMediaDependenciesReady } from "@services/media/dependency-readiness";
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
  private readonly dependencyChecker: () => Promise<unknown>;
  private readonly downloaderAdapter: DownloaderAdapter;
  private readonly localMediaIngestionAdapter: LocalMediaIngestionAdapter;
  private readonly preUploadCompressor: PreUploadCompressor;
  private readonly defaultVaultId: string;

  public constructor(options: LocalBridgeRuntimeProviderOptions = {}) {
    this.dependencyChecker = options.dependencyChecker ?? (() => assertMediaDependenciesReady());
    this.downloaderAdapter = options.downloaderAdapter ?? createDownloaderAdapter();
    this.localMediaIngestionAdapter =
      options.localMediaIngestionAdapter ?? createLocalMediaIngestionAdapter();
    this.preUploadCompressor = options.preUploadCompressor ?? createPreUploadCompressor();
    this.defaultVaultId = options.defaultVaultId ?? "default-vault";
  }

  public async processMediaUrl(input: MediaUrlRequest, signal: AbortSignal): Promise<MediaProcessResult> {
    await this.dependencyChecker();

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
        vaultId: input.vaultId ?? this.defaultVaultId,
        mediaCompressionProfile: input.mediaCompressionProfile ?? "balanced"
      },
      {
        downloaderAdapter: this.downloaderAdapter,
        preUploadCompressor: this.preUploadCompressor
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
      warnings: [
        ...processResult.warnings,
        "Transcript generation is not implemented yet; returning AI-ready handoff payload only."
      ]
    };
  }

  public async processLocalMedia(input: LocalMediaRequest, signal: AbortSignal): Promise<MediaProcessResult> {
    await this.dependencyChecker();

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
        vaultId: input.vaultId ?? this.defaultVaultId,
        mediaCompressionProfile: input.mediaCompressionProfile ?? "balanced"
      },
      {
        localMediaIngestionAdapter: this.localMediaIngestionAdapter,
        preUploadCompressor: this.preUploadCompressor
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
      warnings: [
        ...processResult.warnings,
        "Transcript generation is not implemented yet; returning AI-ready handoff payload only."
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
