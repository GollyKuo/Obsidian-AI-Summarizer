import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { SummarizerError } from "@domain/errors";
import type { AISummarizerPluginSettings } from "@domain/settings";
import type {
  MediaSummaryDraft,
  MediaSummaryInput,
  MediaTranscriptionInput,
  MediaTranscriptionResult,
  TranscriptSegment,
  WebpageAiInput,
  WebpageSummaryResult
} from "@domain/types";
import { throwIfCancelled } from "@orchestration/cancellation";
import type { SummaryProvider } from "@services/ai/ai-provider";
import { transcribeWithGladia } from "@services/ai/gladia-transcription-provider";
import { buildMediaSummaryPrompt, buildTranscriptPrompt, buildWebpageSummaryPrompt } from "@services/ai/prompt-builder";
import { formatTranscriptMarkdown, type TranscriptionProvider } from "@services/ai/transcription-provider";

const DEFAULT_AI_TIMEOUT_MS = 120_000;

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface MistralResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface AiErrorDetail {
  message: string;
  payload?: unknown;
  bodyExcerpt?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getKeys(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : [];
}

function getValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  return value === null ? "null" : typeof value;
}

function describeGeminiResponseShape(payload: GeminiResponse): Record<string, unknown> {
  return {
    rootKeys: getKeys(payload),
    candidateCount: payload.candidates?.length ?? 0,
    firstCandidateKeys: getKeys(payload.candidates?.[0]),
    firstContentKeys: getKeys(payload.candidates?.[0]?.content),
    firstPartsCount: payload.candidates?.[0]?.content?.parts?.length ?? 0,
    firstPartKeys: getKeys(payload.candidates?.[0]?.content?.parts?.[0]),
    errorKeys: getKeys(payload.error)
  };
}

function describeOpenRouterResponseShape(payload: OpenRouterResponse): Record<string, unknown> {
  const firstChoice = payload.choices?.[0];
  const content = firstChoice?.message?.content;
  return {
    rootKeys: getKeys(payload),
    choiceCount: payload.choices?.length ?? 0,
    firstChoiceKeys: getKeys(firstChoice),
    firstMessageKeys: getKeys(firstChoice?.message),
    contentType: getValueType(content),
    contentArrayLength: Array.isArray(content) ? content.length : null,
    errorKeys: getKeys(payload.error)
  };
}

function describeMistralResponseShape(payload: MistralResponse): Record<string, unknown> {
  const firstChoice = payload.choices?.[0];
  const content = firstChoice?.message?.content;
  return {
    rootKeys: getKeys(payload),
    choiceCount: payload.choices?.length ?? 0,
    firstChoiceKeys: getKeys(firstChoice),
    firstMessageKeys: getKeys(firstChoice?.message),
    contentType: getValueType(content),
    contentArrayLength: Array.isArray(content) ? content.length : null,
    errorKeys: getKeys(payload.error)
  };
}

function buildProviderDiagnostics(input: {
  provider: "Gemini" | "OpenRouter" | "Mistral";
  failureKind: string;
  model?: string;
  status?: number;
  providerError?: string;
  responseShape?: Record<string, unknown>;
  bodyExcerpt?: string;
  errorMessage?: string;
}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== "")
  );
}

function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (!resolvedFetch) {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Current runtime does not provide fetch for AI requests.",
      recoverable: false
    });
  }
  return resolvedFetch;
}

function requireApiKey(apiKey: string, provider: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: `${provider} API key is empty.`,
      recoverable: true
    });
  }
  return trimmed;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS
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
        message: signal.aborted ? "AI request cancelled by user." : "AI request timed out.",
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

async function readErrorDetail(response: Response): Promise<AiErrorDetail> {
  const body = await response.text();
  if (body.trim().length === 0) {
    return { message: "" };
  }

  try {
    const payload = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const detail = payload.error?.message ?? payload.message;
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

function extractGeminiText(payload: GeminiResponse): string {
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new SummarizerError({
      category: "ai_failure",
      message:
        "Gemini response did not include text output. Check model support, safety blocks, quota, or empty output details in debug logs.",
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "empty_output",
        providerError: payload.error?.message,
        responseShape: describeGeminiResponseShape(payload)
      })
    });
  }
  return text;
}

function extractOpenRouterText(payload: OpenRouterResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part.text ?? "").join("")
    : content ?? "";

  const trimmed = text.trim();
  if (!trimmed) {
    throw new SummarizerError({
      category: "ai_failure",
      message:
        "OpenRouter response did not include text output. Check provider quota, rate limits, selected model support, or provider-side empty output details in debug logs.",
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "OpenRouter",
        failureKind: "empty_output",
        providerError: payload.error?.message,
        responseShape: describeOpenRouterResponseShape(payload)
      })
    });
  }
  return trimmed;
}

function extractMistralText(payload: MistralResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part.text ?? "").join("")
    : content ?? "";

  const trimmed = text.trim();
  if (!trimmed) {
    throw new SummarizerError({
      category: "ai_failure",
      message:
        "Mistral response did not include text output. Check provider quota, rate limits, selected model support, or provider-side empty output details in debug logs.",
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Mistral",
        failureKind: "empty_output",
        providerError: payload.error?.message,
        responseShape: describeMistralResponseShape(payload)
      })
    });
  }
  return trimmed;
}

async function generateGeminiText(input: {
  apiKey: string;
  model: string;
  parts: GeminiPart[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const apiKey = requireApiKey(input.apiKey, "Gemini");
  const fetchImpl = getFetchImplementation(input.fetchImpl);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: input.parts }],
          generationConfig: {
            temperature: 0.2
          }
        })
      },
      input.signal
    );
  } catch (error) {
    if (error instanceof SummarizerError) {
      throw error;
    }
    throw new SummarizerError({
      category: "ai_failure",
      message: `Gemini request failed before receiving a response: ${getErrorMessage(error)}`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "transport_error",
        model: input.model,
        errorMessage: getErrorMessage(error)
      })
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Gemini request failed (HTTP ${response.status}): ${detail.message}`
        : `Gemini request failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Gemini",
        failureKind: "provider_error",
        model: input.model,
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt
      })
    });
  }

  return extractGeminiText((await response.json()) as GeminiResponse);
}

async function generateOpenRouterText(input: {
  apiKey: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const apiKey = requireApiKey(input.apiKey, "OpenRouter");
  const fetchImpl = getFetchImplementation(input.fetchImpl);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "AI Summarizer"
        },
        body: JSON.stringify({
          model: input.model,
          messages: [{ role: "user", content: input.prompt }],
          temperature: 0.2
        })
      },
      input.signal
    );
  } catch (error) {
    if (error instanceof SummarizerError) {
      throw error;
    }
    throw new SummarizerError({
      category: "ai_failure",
      message: `OpenRouter request failed before receiving a response: ${getErrorMessage(error)}`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "OpenRouter",
        failureKind: "transport_error",
        model: input.model,
        errorMessage: getErrorMessage(error)
      })
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `OpenRouter request failed (HTTP ${response.status}): ${detail.message}`
        : `OpenRouter request failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "OpenRouter",
        failureKind: "provider_error",
        model: input.model,
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt
      })
    });
  }

  return extractOpenRouterText((await response.json()) as OpenRouterResponse);
}

async function generateMistralText(input: {
  apiKey: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const apiKey = requireApiKey(input.apiKey, "Mistral");
  const fetchImpl = getFetchImplementation(input.fetchImpl);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: input.model,
          messages: [{ role: "user", content: input.prompt }],
          temperature: 0.2
        })
      },
      input.signal
    );
  } catch (error) {
    if (error instanceof SummarizerError) {
      throw error;
    }
    throw new SummarizerError({
      category: "ai_failure",
      message: `Mistral request failed before receiving a response: ${getErrorMessage(error)}`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Mistral",
        failureKind: "transport_error",
        model: input.model,
        errorMessage: getErrorMessage(error)
      })
    });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new SummarizerError({
      category: "ai_failure",
      message: detail.message
        ? `Mistral request failed (HTTP ${response.status}): ${detail.message}`
        : `Mistral request failed (HTTP ${response.status}).`,
      recoverable: true,
      cause: buildProviderDiagnostics({
        provider: "Mistral",
        failureKind: "provider_error",
        model: input.model,
        status: response.status,
        providerError: detail.message,
        bodyExcerpt: detail.bodyExcerpt
      })
    });
  }

  return extractMistralText((await response.json()) as MistralResponse);
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

async function transcribeGeminiAudioArtifacts(input: {
  apiKey: string;
  model: string;
  normalizedText: string;
  artifactPaths: string[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
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
        fetchImpl: input.fetchImpl
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

export interface ConfiguredAiProviderOptions {
  fetchImpl?: typeof fetch;
  gladiaPollIntervalMs?: number;
  gladiaMaxPollingMs?: number;
  gladiaRequestTimeoutMs?: number;
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
        fetchImpl: options.fetchImpl
      });
    }
  };
}
