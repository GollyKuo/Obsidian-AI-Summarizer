import { readFile } from "node:fs/promises";
import { SummarizerError } from "@domain/errors";
import { abortableSleep, throwIfCancelled } from "@orchestration/cancellation";
import { readProviderErrorDetail } from "@services/ai/provider-error";
import {
  buildProviderDiagnostics,
  fetchWithTimeout,
  getKeys
} from "@services/ai/provider-runtime";

export interface GeminiFile {
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

export type GeminiRemoteFile = Required<Pick<GeminiFile, "name" | "uri" | "mimeType">> & GeminiFile;

export function guessAudioMimeType(filePath: string): string {
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
}): GeminiRemoteFile {
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
  return file as GeminiRemoteFile;
}

export async function uploadGeminiFile(input: {
  apiKey: string;
  artifactPath: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}): Promise<GeminiRemoteFile> {
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
      body: new Uint8Array(content)
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

export async function waitForGeminiFileActive(input: {
  apiKey: string;
  file: GeminiRemoteFile;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  pollIntervalMs: number;
  maxPollingMs: number;
}): Promise<GeminiRemoteFile> {
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

    await abortableSleep(
      input.pollIntervalMs,
      input.signal,
      "Gemini Files API polling cancelled by user."
    );
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

export async function deleteGeminiFile(input: {
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
