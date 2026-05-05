import { SummarizerError } from "@domain/errors";
import { readProviderErrorDetail } from "@services/ai/provider-error";
import {
  buildProviderDiagnostics,
  fetchWithTimeout,
  getErrorMessage,
  getFetchImplementation,
  getKeys,
  requireApiKey
} from "@services/ai/provider-runtime";

export interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
  file_data?: {
    mime_type: string;
    file_uri: string;
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

export async function generateGeminiText(input: {
  apiKey: string;
  model: string;
  parts: GeminiPart[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
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
      input.signal,
      input.timeoutMs
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
    const detail = await readProviderErrorDetail(response);
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
