import { Buffer } from "node:buffer";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { SummarizerError } from "@domain/errors";
import type {
  MediaTranscriptionInput,
  MediaTranscriptionResult,
  TranscriptSegment
} from "@domain/types";
import { throwIfCancelled } from "@orchestration/cancellation";
import { formatTranscriptMarkdown } from "@services/ai/transcription-provider";

const GLADIA_API_BASE_URL = "https://api.gladia.io/v2";
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLLING_MS = 10 * 60_000;

interface GladiaUploadResponse {
  audio_url?: string;
  audio_metadata?: {
    id?: string;
    filename?: string;
    extension?: string;
    size?: number;
    audio_duration?: number;
    number_of_channels?: number;
  };
}

interface GladiaJobResponse {
  id?: string;
  result_url?: string;
}

interface GladiaResultResponse {
  id?: string;
  request_id?: string;
  status?: "queued" | "processing" | "done" | "error" | string;
  error_code?: number | null;
  result?: {
    metadata?: {
      audio_duration?: number;
      billing_time?: number;
      transcription_time?: number;
    };
    transcription?: {
      full_transcript?: string;
      languages?: string[];
      utterances?: GladiaUtterance[];
    };
  } | null;
}

interface GladiaUtterance {
  start?: number;
  end?: number;
  text?: string;
  language?: string;
  speaker?: number;
}

interface GladiaErrorDetail {
  message: string;
  payload?: unknown;
  bodyExcerpt?: string;
}

export interface GladiaTranscriptionOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  maxPollingMs?: number;
}

function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (!resolvedFetch) {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Current runtime does not provide fetch for Gladia requests.",
      recoverable: false
    });
  }
  return resolvedFetch;
}

function requireGladiaApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: "Gladia API key is empty.",
      recoverable: true
    });
  }
  return trimmed;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildGladiaDiagnostics(input: {
  failureKind: string;
  status?: number;
  providerError?: string;
  bodyExcerpt?: string;
  errorMessage?: string;
  jobId?: string;
  requestId?: string;
  jobStatus?: string;
  pollingStates?: string[];
  transcriptLength?: number;
  utteranceCount?: number;
}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      provider: "Gladia",
      ...input
    }).filter(([, value]) => value !== undefined && value !== "")
  );
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timeoutMs: number
): Promise<Response> {
  throwIfCancelled(signal);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = (): void => controller.abort();
  signal.addEventListener("abort", abort, { once: true });

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (signal.aborted || controller.signal.aborted) {
      throw new SummarizerError({
        category: signal.aborted ? "cancellation" : "ai_failure",
        message: signal.aborted ? "Gladia request cancelled by user." : "Gladia request timed out.",
        recoverable: true,
        cause: error
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

async function readErrorDetail(response: Response): Promise<GladiaErrorDetail> {
  const body = await response.text();
  if (body.trim().length === 0) {
    return { message: "" };
  }

  try {
    const payload = JSON.parse(body) as {
      error?: { message?: unknown };
      message?: unknown;
      detail?: unknown;
    };
    const detail = payload.error?.message ?? payload.message ?? payload.detail;
    return {
      message: typeof detail === "string" ? detail : "",
      payload,
      bodyExcerpt: body.slice(0, 500)
    };
  } catch {
    return {
      message: body.trim(),
      bodyExcerpt: body.slice(0, 500)
    };
  }
}

function guessUploadMimeType(filePath: string): string {
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
  if (lower.endsWith(".mp4")) {
    return "video/mp4";
  }
  return "application/octet-stream";
}

async function uploadArtifact(input: {
  apiKey: string;
  artifactPath: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  requestTimeoutMs: number;
}): Promise<GladiaUploadResponse> {
  const content = await readFile(input.artifactPath);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(content)], {
    type: guessUploadMimeType(input.artifactPath)
  });
  formData.append("audio", blob, basename(input.artifactPath));

  let response: Response;
  try {
    response = await fetchWithTimeout(
      input.fetchImpl,
      `${GLADIA_API_BASE_URL}/upload`,
      {
        method: "POST",
        headers: {
          "x-gladia-key": input.apiKey
        },
        body: formData
      },
      input.signal,
      input.requestTimeoutMs
    );
  } catch (error) {
    if (error instanceof SummarizerError) {
      throw error;
    }
    throw new SummarizerError({
      category: "ai_failure",
      message: `Gladia upload failed before receiving a response: ${getErrorMessage(error)}`,
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "upload_transport_error",
        errorMessage: getErrorMessage(error)
      })
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gladia upload failed (HTTP ${response.status}): ${detail.message}`
        : `Gladia upload failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "upload_provider_error",
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt
      })
    });
  }

  const payload = (await response.json()) as GladiaUploadResponse;
  if (!payload.audio_url) {
    throw new SummarizerError({
      category: "ai_failure",
      message: "Gladia upload response did not include audio_url.",
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "upload_unexpected_response"
      })
    });
  }
  return payload;
}

async function createPreRecordedJob(input: {
  apiKey: string;
  audioUrl: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  requestTimeoutMs: number;
}): Promise<GladiaJobResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      input.fetchImpl,
      `${GLADIA_API_BASE_URL}/pre-recorded`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gladia-key": input.apiKey
        },
        body: JSON.stringify({
          audio_url: input.audioUrl,
          callback: false,
          subtitles: false,
          diarization: false,
          translation: false,
          summarization: false,
          named_entity_recognition: false,
          custom_spelling: false,
          sentiment_analysis: false,
          audio_to_llm: false,
          pii_redaction: false,
          sentences: false,
          punctuation_enhanced: false,
          language_config: {
            languages: [],
            code_switching: false
          }
        })
      },
      input.signal,
      input.requestTimeoutMs
    );
  } catch (error) {
    if (error instanceof SummarizerError) {
      throw error;
    }
    throw new SummarizerError({
      category: "ai_failure",
      message: `Gladia job creation failed before receiving a response: ${getErrorMessage(error)}`,
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "job_transport_error",
        errorMessage: getErrorMessage(error)
      })
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gladia job creation failed (HTTP ${response.status}): ${detail.message}`
        : `Gladia job creation failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "job_provider_error",
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt
      })
    });
  }

  const payload = (await response.json()) as GladiaJobResponse;
  if (!payload.id) {
    throw new SummarizerError({
      category: "ai_failure",
      message: "Gladia job creation response did not include a job id.",
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "job_unexpected_response"
      })
    });
  }
  return payload;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(
        new SummarizerError({
          category: "cancellation",
          message: "Gladia polling cancelled by user.",
          recoverable: true
        })
      );
      return;
    }

    const cleanup = (): void => {
      signal.removeEventListener("abort", abort);
    };
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = (): void => {
      clearTimeout(timeout);
      cleanup();
      reject(
        new SummarizerError({
          category: "cancellation",
          message: "Gladia polling cancelled by user.",
          recoverable: true
        })
      );
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function fetchJobResult(input: {
  apiKey: string;
  jobId: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  requestTimeoutMs: number;
}): Promise<GladiaResultResponse> {
  const response = await fetchWithTimeout(
    input.fetchImpl,
    `${GLADIA_API_BASE_URL}/pre-recorded/${encodeURIComponent(input.jobId)}`,
    {
      method: "GET",
      headers: {
        "x-gladia-key": input.apiKey
      }
    },
    input.signal,
    input.requestTimeoutMs
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gladia polling failed (HTTP ${response.status}): ${detail.message}`
        : `Gladia polling failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "poll_provider_error",
        jobId: input.jobId,
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt
      })
    });
  }

  return (await response.json()) as GladiaResultResponse;
}

async function pollJobUntilDone(input: {
  apiKey: string;
  jobId: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  requestTimeoutMs: number;
  pollIntervalMs: number;
  maxPollingMs: number;
}): Promise<{ payload: GladiaResultResponse; pollingStates: string[] }> {
  const startedAt = Date.now();
  const pollingStates: string[] = [];

  while (Date.now() - startedAt <= input.maxPollingMs) {
    throwIfCancelled(input.signal);
    const payload = await fetchJobResult(input);
    const status = payload.status ?? "unknown";
    pollingStates.push(status);

    if (status === "done") {
      return { payload, pollingStates };
    }
    if (status === "error") {
      throw new SummarizerError({
        category: "ai_failure",
        message: payload.error_code
          ? `Gladia transcription job failed (error ${payload.error_code}).`
          : "Gladia transcription job failed.",
        recoverable: true,
        cause: buildGladiaDiagnostics({
          failureKind: "job_failed",
          jobId: input.jobId,
          requestId: payload.request_id,
          jobStatus: status,
          status: payload.error_code ?? undefined,
          pollingStates
        })
      });
    }

    await sleep(input.pollIntervalMs, input.signal);
  }

  throw new SummarizerError({
    category: "ai_failure",
    message: "Gladia transcription job timed out before completion.",
    recoverable: true,
    cause: buildGladiaDiagnostics({
      failureKind: "poll_timeout",
      jobId: input.jobId,
      pollingStates
    })
  });
}

function secondsToMs(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value * 1000)) : 0;
}

function normalizeGladiaResult(
  payload: GladiaResultResponse,
  pollingStates: string[]
): MediaTranscriptionResult {
  const transcription = payload.result?.transcription;
  const fullTranscript = transcription?.full_transcript?.trim() ?? "";
  const utterances = transcription?.utterances ?? [];
  const segments: TranscriptSegment[] = utterances
    .map((utterance) => ({
      startMs: secondsToMs(utterance.start),
      endMs: secondsToMs(utterance.end),
      text: utterance.text?.trim() ?? ""
    }))
    .filter((segment) => segment.text.length > 0);

  const transcriptMarkdown = segments.length > 0
    ? formatTranscriptMarkdown(segments)
    : fullTranscript;

  if (transcriptMarkdown.trim().length === 0) {
    throw new SummarizerError({
      category: "ai_failure",
      message: "Gladia transcription result did not include transcript text.",
      recoverable: true,
      cause: buildGladiaDiagnostics({
        failureKind: "empty_output",
        jobId: payload.id,
        requestId: payload.request_id,
        jobStatus: payload.status,
        pollingStates,
        transcriptLength: fullTranscript.length,
        utteranceCount: utterances.length
      })
    });
  }

  return {
    transcript: segments.length > 0
      ? segments
      : [
          {
            startMs: 0,
            endMs: 0,
            text: transcriptMarkdown
          }
        ],
    transcriptMarkdown,
    warnings: []
  };
}

async function transcribeSingleArtifact(input: {
  apiKey: string;
  artifactPath: string;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  requestTimeoutMs: number;
  pollIntervalMs: number;
  maxPollingMs: number;
}): Promise<MediaTranscriptionResult> {
  const upload = await uploadArtifact(input);
  const job = await createPreRecordedJob({
    ...input,
    audioUrl: upload.audio_url!
  });
  const result = await pollJobUntilDone({
    ...input,
    jobId: job.id!
  });
  return normalizeGladiaResult(result.payload, result.pollingStates);
}

export async function transcribeWithGladia(
  input: MediaTranscriptionInput,
  signal: AbortSignal,
  options: GladiaTranscriptionOptions
): Promise<MediaTranscriptionResult> {
  const apiKey = requireGladiaApiKey(options.apiKey);
  const fetchImpl = getFetchImplementation(options.fetchImpl);
  const aiUploadArtifactPaths = input.aiUploadArtifactPaths ?? [];
  if (aiUploadArtifactPaths.length === 0) {
    throw new SummarizerError({
      category: "ai_failure",
      message: "Gladia transcription requires AI-ready audio artifacts, but none were provided.",
      recoverable: true
    });
  }

  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollingMs = options.maxPollingMs ?? DEFAULT_MAX_POLLING_MS;
  const results: MediaTranscriptionResult[] = [];

  for (const artifactPath of aiUploadArtifactPaths) {
    results.push(
      await transcribeSingleArtifact({
        apiKey,
        artifactPath,
        fetchImpl,
        signal,
        requestTimeoutMs,
        pollIntervalMs,
        maxPollingMs
      })
    );
  }

  if (results.length === 1) {
    return results[0];
  }

  const transcriptMarkdown = results
    .map((result, index) => `<!-- Gladia chunk ${index + 1} -->\n${result.transcriptMarkdown}`)
    .join("\n\n");
  return {
    transcript: results.flatMap((result) => result.transcript),
    transcriptMarkdown,
    warnings: [`Transcribed ${results.length} AI upload artifact chunks with Gladia.`]
  };
}
