import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { SummarizerError } from "@domain/errors";
import type { AISummarizerPluginSettings } from "@domain/settings";
import type {
  MediaSummaryDraft,
  MediaSummaryInput,
  MediaTranscriptionInput,
  MediaTranscriptionResult,
  TranscriptCleanupInput,
  TranscriptSegment,
  WebpageAiInput,
  WebpageSummaryResult
} from "@domain/types";
import { throwIfCancelled } from "@orchestration/cancellation";
import type { SummaryProvider, TranscriptCleanupProvider } from "@services/ai/ai-provider";
import {
  generateGeminiText,
  type GeminiPart
} from "@services/ai/gemini-client";
import { transcribeWithGladia } from "@services/ai/gladia-transcription-provider";
import { generateMistralText } from "@services/ai/mistral-client";
import { generateOpenRouterText } from "@services/ai/openrouter-client";
import {
  buildMediaSummaryPrompt,
  buildTranscriptCleanupPrompt,
  buildTranscriptPrompt,
  buildWebpageSummaryPrompt
} from "@services/ai/prompt-builder";
import { readProviderErrorDetail } from "@services/ai/provider-error";
import {
  buildProviderDiagnostics,
  fetchWithTimeout,
  getErrorMessage,
  getFetchImplementation,
  getKeys,
  requireApiKey
} from "@services/ai/provider-runtime";
import {
  formatTranscriptMarkdown,
  parseTranscriptMarkdownToSegments,
  type TranscriptionProvider
} from "@services/ai/transcription-provider";
import { updateArtifactManifestWithRemoteFile } from "@services/media/artifact-manifest";

const DEFAULT_GEMINI_TRANSCRIPTION_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_GEMINI_FILE_POLL_INTERVAL_MS = 3_000;
const DEFAULT_GEMINI_FILE_MAX_POLLING_MS = 10 * 60_000;

interface GeminiFile {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: "PROCESSING" | "ACTIVE" | "FAILED" | string;
  error?: {
    message?: string;
  };
}

interface GeminiFileResponse {
  file?: GeminiFile;
  error?: {
    message?: string;
  };
}

function guessAudioMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".ogg") || lower.endsWith(".opus")) {
    return "audio/ogg";
  }
  if (lower.endsWith(".m4a") || lower.endsWith(".aac")) {
    return "audio/mp4";
  }
  if (lower.endsWith(".flac")) {
    return "audio/flac";
  }
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  return "application/octet-stream";
}

async function readAudioPart(filePath: string): Promise<GeminiPart> {
  const content = await readFile(filePath);
  return {
    inline_data: {
      mime_type: guessAudioMimeType(filePath),
      data: Buffer.from(content).toString("base64")
    }
  };
}

function buildGeminiFileEndpoint(fileName: string): string {
  const normalizedName = fileName.trim();
  if (normalizedName.startsWith("files/")) {
    return `https://generativelanguage.googleapis.com/v1beta/${normalizedName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
  }
  return `https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(normalizedName)}`;
}

function requireGeminiFile(input: {
  payload: GeminiFileResponse;
  artifactPath: string;
}): Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile {
  const file = input.payload.file;
  if (!file?.name || !file.uri || !file.mimeType) {
    throw new SummarizerError({
      category: "ai_failure",
      message: "Gemini Files API response did not include file name, uri, or mime type.",
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "file_upload_unexpected_response",
        providerError: input.payload.error?.message,
        artifactPath: input.artifactPath,
        remoteFileState: file?.state,
        responseShape: {
          rootKeys: getKeys(input.payload),
          fileKeys: getKeys(file),
          errorKeys: getKeys(input.payload.error)
        }
      })
    });
  }
  return file as Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile;
}

async function uploadGeminiFile(input: {
  apiKey: string;
  artifactPath: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}): Promise<Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile> {
  const content = await readFile(input.artifactPath);
  const mimeType = guessAudioMimeType(input.artifactPath);
  const displayName = input.artifactPath.split(/[\\/]/).pop() ?? "ai-upload";

  const startResponse = await fetchWithTimeout(
    input.fetchImpl,
    "https://generativelanguage.googleapis.com/upload/v1beta/files",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": input.apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(content.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: {
          display_name: displayName
        }
      })
    },
    input.signal
  );

  if (!startResponse.ok) {
    const detail = await readProviderErrorDetail(startResponse);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gemini Files API upload start failed (HTTP ${startResponse.status}): ${detail.message}`
        : `Gemini Files API upload start failed (HTTP ${startResponse.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "file_upload_start_provider_error",
        status: startResponse.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt,
        artifactPath: input.artifactPath
      })
    });
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new SummarizerError({
      category: "ai_failure",
      message: "Gemini Files API upload start did not return an upload URL.",
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "file_upload_missing_upload_url",
        artifactPath: input.artifactPath
      })
    });
  }

  const uploadResponse = await fetchWithTimeout(
    input.fetchImpl,
    uploadUrl,
    {
      method: "POST",
      headers: {
        "Content-Length": String(content.byteLength),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: new Blob([new Uint8Array(content)], { type: mimeType })
    },
    input.signal
  );

  if (!uploadResponse.ok) {
    const detail = await readProviderErrorDetail(uploadResponse);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gemini Files API upload failed (HTTP ${uploadResponse.status}): ${detail.message}`
        : `Gemini Files API upload failed (HTTP ${uploadResponse.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "file_upload_provider_error",
        status: uploadResponse.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt,
        artifactPath: input.artifactPath
      })
    });
  }

  return requireGeminiFile({
    payload: (await uploadResponse.json()) as GeminiFileResponse,
    artifactPath: input.artifactPath
  });
}

async function getGeminiFile(input: {
  apiKey: string;
  fileName: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}): Promise<GeminiFile> {
  const response = await fetchWithTimeout(
    input.fetchImpl,
    buildGeminiFileEndpoint(input.fileName),
    {
      method: "GET",
      headers: {
        "x-goog-api-key": input.apiKey
      }
    },
    input.signal
  );

  if (!response.ok) {
    const detail = await readProviderErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gemini Files API metadata request failed (HTTP ${response.status}): ${detail.message}`
        : `Gemini Files API metadata request failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "file_metadata_provider_error",
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt,
        remoteFileName: input.fileName
      })
    });
  }

  const payload = (await response.json()) as GeminiFileResponse;
  return payload.file ?? payload as GeminiFile;
}

async function waitForGeminiFileActive(input: {
  apiKey: string;
  file: Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  pollIntervalMs: number;
  maxPollingMs: number;
}): Promise<Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile> {
  const startedAt = Date.now();
  let currentFile = input.file;

  while (Date.now() - startedAt <= input.maxPollingMs) {
    throwIfCancelled(input.signal);
    const state = currentFile.state ?? "ACTIVE";
    if (state === "ACTIVE") {
      return currentFile;
    }
    if (state === "FAILED") {
      throw new SummarizerError({
        category: "ai_failure",
        message: currentFile.error?.message
          ? `Gemini Files API processing failed: ${currentFile.error.message}`
          : "Gemini Files API processing failed.",
        recoverable: true,
        cause: buildProviderDiagnostics({
          provider: "Gemini",
          failureKind: "file_processing_failed",
          providerError: currentFile.error?.message,
          remoteFileName: currentFile.name,
          remoteFileState: currentFile.state
        })
      });
    }

    await new Promise((resolve) => setTimeout(resolve, input.pollIntervalMs));
    currentFile = {
      ...currentFile,
      ...(await getGeminiFile({
        apiKey: input.apiKey,
        fileName: currentFile.name,
        fetchImpl: input.fetchImpl,
        signal: input.signal
      }))
    };
  }

  throw new SummarizerError({
    category: "ai_failure",
    message: "Gemini Files API processing timed out before the file became ACTIVE.",
    recoverable: true,
    cause: buildProviderDiagnostics({
      provider: "Gemini",
      failureKind: "file_processing_timeout",
      remoteFileName: currentFile.name,
      remoteFileState: currentFile.state
    })
  });
}

async function deleteGeminiFile(input: {
  apiKey: string;
  fileName: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}): Promise<void> {
  const response = await fetchWithTimeout(
    input.fetchImpl,
    buildGeminiFileEndpoint(input.fileName),
    {
      method: "DELETE",
      headers: {
        "x-goog-api-key": input.apiKey
      }
    },
    input.signal
  );

  if (!response.ok && response.status !== 404) {
    const detail = await readProviderErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gemini Files API delete failed (HTTP ${response.status}): ${detail.message}`
        : `Gemini Files API delete failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "file_delete_provider_error",
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt,
        remoteFileName: input.fileName
      })
    });
  }
}

async function safeUpdateRemoteFileManifest(
  metadataPath: string | undefined,
  input: Parameters<typeof updateArtifactManifestWithRemoteFile>[1],
  warnings: string[]
): Promise<void> {
  if (!metadataPath) {
    if (input.deleteState !== "deleted") {
      warnings.push(
        `Gemini remote file manifest unavailable; remote file ${input.name} cannot be tracked for retry cleanup.`
      );
    }
    return;
  }

  try {
    const manifestWarnings = await updateArtifactManifestWithRemoteFile(metadataPath, input);
    warnings.push(
      ...manifestWarnings.map((warning) => `Gemini remote file manifest update warning: ${warning}`)
    );
  } catch (error) {
    warnings.push(`Gemini remote file manifest update failed: ${getErrorMessage(error)}`);
  }
}

interface GeminiChunkTranscriptionFailureDiagnostics {
  provider: "Gemini";
  failureKind: "chunk_transcription_failed";
  model: string;
  failedChunkIndex: number;
  totalChunks: number;
  artifactPath: string;
  completedChunkCount: number;
  partialTranscriptMarkdown?: string;
  upstreamCause?: unknown;
}

async function transcribeGeminiInlineArtifacts(input: {
  apiKey: string;
  model: string;
  normalizedText: string;
  artifactPaths: string[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  requestTimeoutMs: number;
}): Promise<MediaTranscriptionResult> {
  const transcriptChunks: string[] = [];
  const transcriptSegments: TranscriptSegment[] = [];

  for (let index = 0; index < input.artifactPaths.length; index += 1) {
    const artifactPath = input.artifactPaths[index];
    const audioPart = await readAudioPart(artifactPath);

    try {
      const transcriptMarkdown = await generateGeminiText({
        apiKey: input.apiKey,
        model: input.model,
        parts: [{ text: buildTranscriptPrompt(input.normalizedText) }, audioPart],
        signal: input.signal,
        fetchImpl: input.fetchImpl,
        timeoutMs: input.requestTimeoutMs
      });

      transcriptChunks.push(transcriptMarkdown);
      transcriptSegments.push({
        startMs: 0,
        endMs: 0,
        text: transcriptMarkdown
      });
    } catch (error) {
      const upstreamCause = error instanceof SummarizerError ? error.causeValue : error;
      const partialTranscriptMarkdown = transcriptChunks.join("\n\n").trim();
      throw new SummarizerError({
        category: error instanceof SummarizerError ? error.category : "ai_failure",
        message: `Gemini transcription failed for AI upload chunk ${index + 1}/${input.artifactPaths.length}: ${getErrorMessage(error)}`,
        recoverable: true,
        cause: {
          provider: "Gemini",
          failureKind: "chunk_transcription_failed",
          model: input.model,
          failedChunkIndex: index,
          totalChunks: input.artifactPaths.length,
          artifactPath,
          completedChunkCount: transcriptChunks.length,
          partialTranscriptMarkdown: partialTranscriptMarkdown.length > 0 ? partialTranscriptMarkdown : undefined,
          upstreamCause
        } satisfies GeminiChunkTranscriptionFailureDiagnostics
      });
    }
  }

  const transcriptMarkdown = transcriptChunks.join("\n\n").trim();
  return {
    transcript: transcriptSegments,
    transcriptMarkdown,
    warnings: [
      ...(input.artifactPaths.length > 1
        ? [`Gemini transcription completed ${input.artifactPaths.length} AI upload artifact chunks with separate requests.`]
        : [])
    ]
  };
}

async function transcribeGeminiFilesApiArtifacts(input: {
  apiKey: string;
  model: string;
  normalizedText: string;
  artifactPaths: string[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  artifactMetadataPath?: string;
  pollIntervalMs: number;
  maxPollingMs: number;
  requestTimeoutMs: number;
}): Promise<MediaTranscriptionResult> {
  const apiKey = requireApiKey(input.apiKey, "Gemini");
  const fetchImpl = getFetchImplementation(input.fetchImpl);
  const transcriptChunks: string[] = [];
  const transcriptSegments: TranscriptSegment[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < input.artifactPaths.length; index += 1) {
    const artifactPath = input.artifactPaths[index];
    let uploadedFile: (Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile) | null = null;

    try {
      uploadedFile = await uploadGeminiFile({
        apiKey,
        artifactPath,
        fetchImpl,
        signal: input.signal
      });
      uploadedFile = await waitForGeminiFileActive({
        apiKey,
        file: uploadedFile,
        fetchImpl,
        signal: input.signal,
        pollIntervalMs: input.pollIntervalMs,
        maxPollingMs: input.maxPollingMs
      });

      await safeUpdateRemoteFileManifest(
        input.artifactMetadataPath,
        {
          provider: "Gemini",
          strategy: "files_api",
          localArtifactPath: artifactPath,
          name: uploadedFile.name,
          uri: uploadedFile.uri,
          mimeType: uploadedFile.mimeType,
          state: uploadedFile.state ?? "ACTIVE",
          createdAt: new Date().toISOString()
        },
        warnings
      );

      const transcriptMarkdown = await generateGeminiText({
        apiKey,
        model: input.model,
        parts: [
          { text: buildTranscriptPrompt(input.normalizedText) },
          {
            file_data: {
              mime_type: uploadedFile.mimeType,
              file_uri: uploadedFile.uri
            }
          }
        ],
        signal: input.signal,
        fetchImpl,
        timeoutMs: input.requestTimeoutMs
      });

      transcriptChunks.push(transcriptMarkdown);
      transcriptSegments.push({
        startMs: 0,
        endMs: 0,
        text: transcriptMarkdown
      });
    } finally {
      if (uploadedFile) {
        try {
          await deleteGeminiFile({
            apiKey,
            fileName: uploadedFile.name,
            fetchImpl,
            signal: input.signal
          });
          await safeUpdateRemoteFileManifest(
            input.artifactMetadataPath,
            {
              provider: "Gemini",
              strategy: "files_api",
              localArtifactPath: artifactPath,
              name: uploadedFile.name,
              uri: uploadedFile.uri,
              mimeType: uploadedFile.mimeType,
              state: uploadedFile.state ?? "ACTIVE",
              createdAt: new Date().toISOString(),
              deletedAt: new Date().toISOString(),
              deleteState: "deleted"
            },
            warnings
          );
        } catch (error) {
          const warning = `Gemini remote file cleanup failed for ${uploadedFile.name}: ${getErrorMessage(error)}`;
          warnings.push(warning);
          await safeUpdateRemoteFileManifest(
            input.artifactMetadataPath,
            {
              provider: "Gemini",
              strategy: "files_api",
              localArtifactPath: artifactPath,
              name: uploadedFile.name,
              uri: uploadedFile.uri,
              mimeType: uploadedFile.mimeType,
              state: uploadedFile.state ?? "ACTIVE",
              createdAt: new Date().toISOString(),
              deleteState: "failed",
              warning
            },
            warnings
          );
        }
      }
    }
  }

  const transcriptMarkdown = transcriptChunks.join("\n\n").trim();
  return {
    transcript: transcriptSegments,
    transcriptMarkdown,
    warnings: [
      ...warnings,
      `Gemini Files API transcription completed ${input.artifactPaths.length} AI upload artifact(s).`
    ]
  };
}

async function transcribeGeminiAudioArtifacts(input: {
  apiKey: string;
  model: string;
  normalizedText: string;
  artifactPaths: string[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  artifactMetadataPath?: string;
  strategy: AISummarizerPluginSettings["geminiTranscriptionStrategy"];
  filePollIntervalMs: number;
  fileMaxPollingMs: number;
  requestTimeoutMs: number;
}): Promise<MediaTranscriptionResult> {
  if (input.strategy === "inline_chunks") {
    return transcribeGeminiInlineArtifacts(input);
  }

  try {
    return await transcribeGeminiFilesApiArtifacts({
      apiKey: input.apiKey,
      model: input.model,
      normalizedText: input.normalizedText,
      artifactPaths: input.artifactPaths,
      signal: input.signal,
      fetchImpl: input.fetchImpl,
      artifactMetadataPath: input.artifactMetadataPath,
      pollIntervalMs: input.filePollIntervalMs,
      maxPollingMs: input.fileMaxPollingMs,
      requestTimeoutMs: input.requestTimeoutMs
    });
  } catch (error) {
    if (input.strategy === "files_api" || (error instanceof SummarizerError && error.category === "cancellation")) {
      throw error;
    }

    const filesApiErrorMessage = getErrorMessage(error);
    try {
      const inlineResult = await transcribeGeminiInlineArtifacts(input);
      return {
        ...inlineResult,
        warnings: [
          `Gemini Files API transcription failed; fell back to inline chunk transcription: ${filesApiErrorMessage}`,
          ...inlineResult.warnings
        ]
      };
    } catch (inlineError) {
      throw new SummarizerError({
        category: inlineError instanceof SummarizerError ? inlineError.category : "ai_failure",
        message: `Gemini Files API transcription failed: ${filesApiErrorMessage}; inline chunk fallback also failed: ${getErrorMessage(inlineError)}`,
        recoverable: true,
        cause: {
          provider: "Gemini",
          failureKind: "files_api_fallback_inline_failed",
          model: input.model,
          strategy: input.strategy,
          totalArtifacts: input.artifactPaths.length,
          filesApiErrorMessage,
          inlineErrorMessage: getErrorMessage(inlineError),
          filesApiCause: error instanceof SummarizerError ? error.causeValue : error,
          inlineCause: inlineError instanceof SummarizerError ? inlineError.causeValue : inlineError
        }
      });
    }
  }
}

export interface ConfiguredAiProviderOptions {
  fetchImpl?: typeof fetch;
  gladiaPollIntervalMs?: number;
  gladiaMaxPollingMs?: number;
  gladiaRequestTimeoutMs?: number;
  geminiFilePollIntervalMs?: number;
  geminiFileMaxPollingMs?: number;
  geminiTranscriptionRequestTimeoutMs?: number;
}

export function createConfiguredSummaryProvider(
  settings: AISummarizerPluginSettings,
  options: ConfiguredAiProviderOptions = {}
): SummaryProvider {
  async function generateConfiguredSummaryText(input: {
    summaryProvider: MediaSummaryInput["summaryProvider"];
    summaryModel: string;
    prompt: string;
    signal: AbortSignal;
  }): Promise<string> {
    if (input.summaryProvider === "openrouter") {
      return generateOpenRouterText({
        apiKey: settings.openRouterApiKey,
        model: input.summaryModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    if (input.summaryProvider === "mistral") {
      return generateMistralText({
        apiKey: settings.mistralApiKey,
        model: input.summaryModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    return generateGeminiText({
      apiKey: settings.apiKey,
      model: input.summaryModel,
      parts: [{ text: input.prompt }],
      signal: input.signal,
      fetchImpl: options.fetchImpl
    });
  }

  return {
    async summarizeMedia(input: MediaSummaryInput, signal: AbortSignal): Promise<MediaSummaryDraft> {
      const prompt = buildMediaSummaryPrompt(input);
      const summaryMarkdown = await generateConfiguredSummaryText({
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel,
        prompt,
        signal
      });

      return { summaryMarkdown, warnings: [] };
    },

    async summarizeWebpage(input: WebpageAiInput, signal: AbortSignal): Promise<WebpageSummaryResult> {
      const prompt = buildWebpageSummaryPrompt(input);
      const summaryMarkdown = await generateConfiguredSummaryText({
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel,
        prompt,
        signal
      });

      return { summaryMarkdown, warnings: [] };
    }
  };
}

export function createConfiguredTranscriptCleanupProvider(
  settings: AISummarizerPluginSettings,
  options: ConfiguredAiProviderOptions = {}
): TranscriptCleanupProvider {
  async function generateConfiguredCleanupText(input: {
    cleanupProvider: TranscriptCleanupInput["cleanupProvider"];
    cleanupModel: string;
    prompt: string;
    signal: AbortSignal;
  }): Promise<string> {
    if (input.cleanupProvider === "openrouter") {
      return generateOpenRouterText({
        apiKey: settings.openRouterApiKey,
        model: input.cleanupModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    if (input.cleanupProvider === "mistral") {
      return generateMistralText({
        apiKey: settings.mistralApiKey,
        model: input.cleanupModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    return generateGeminiText({
      apiKey: settings.apiKey,
      model: input.cleanupModel,
      parts: [{ text: input.prompt }],
      signal: input.signal,
      fetchImpl: options.fetchImpl
    });
  }

  return {
    async cleanupTranscript(
      input: TranscriptCleanupInput,
      signal: AbortSignal
    ): Promise<MediaTranscriptionResult> {
      const transcriptMarkdown = await generateConfiguredCleanupText({
        cleanupProvider: input.cleanupProvider,
        cleanupModel: input.cleanupModel,
        prompt: buildTranscriptCleanupPrompt(input),
        signal
      });

      return {
        transcript: parseTranscriptMarkdownToSegments(transcriptMarkdown, { requireTiming: true }),
        transcriptMarkdown,
        warnings: []
      };
    }
  };
}

export function createConfiguredTranscriptionProvider(
  settings: AISummarizerPluginSettings,
  options: ConfiguredAiProviderOptions = {}
): TranscriptionProvider {
  return {
    async transcribeMedia(
      input: MediaTranscriptionInput,
      signal: AbortSignal
    ): Promise<MediaTranscriptionResult> {
      if (input.transcript.length > 0) {
        return {
          transcript: input.transcript,
          transcriptMarkdown: formatTranscriptMarkdown(input.transcript),
          warnings: []
        };
      }

      const aiUploadArtifactPaths = input.aiUploadArtifactPaths ?? [];
      if (aiUploadArtifactPaths.length === 0) {
        throw new SummarizerError({
          category: "ai_failure",
          message: "Media transcription requires AI-ready audio artifacts, but none were provided.",
          recoverable: true
        });
      }

      if (input.transcriptionProvider === "gladia") {
        return transcribeWithGladia(input, signal, {
          apiKey: settings.gladiaApiKey,
          fetchImpl: options.fetchImpl,
          requestTimeoutMs: options.gladiaRequestTimeoutMs,
          pollIntervalMs: options.gladiaPollIntervalMs,
          maxPollingMs: options.gladiaMaxPollingMs
        });
      }

      return transcribeGeminiAudioArtifacts({
        apiKey: settings.apiKey,
        model: input.transcriptionModel,
        normalizedText: input.normalizedText,
        artifactPaths: aiUploadArtifactPaths,
        signal,
        fetchImpl: options.fetchImpl,
        artifactMetadataPath: input.artifactMetadataPath,
        strategy: settings.geminiTranscriptionStrategy,
        filePollIntervalMs: options.geminiFilePollIntervalMs ?? DEFAULT_GEMINI_FILE_POLL_INTERVAL_MS,
        fileMaxPollingMs: options.geminiFileMaxPollingMs ?? DEFAULT_GEMINI_FILE_MAX_POLLING_MS,
        requestTimeoutMs: options.geminiTranscriptionRequestTimeoutMs ?? DEFAULT_GEMINI_TRANSCRIPTION_TIMEOUT_MS
      });
    }
  };
}
