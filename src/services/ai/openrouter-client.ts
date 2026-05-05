import { SummarizerError } from "@domain/errors";
import { readProviderErrorDetail } from "@services/ai/provider-error";
import {
  buildProviderDiagnostics,
  fetchWithTimeout,
  getErrorMessage,
  getFetchImplementation,
  getKeys,
  getValueType,
  requireApiKey
} from "@services/ai/provider-runtime";

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

export async function generateOpenRouterText(input: {
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
    const detail = await readProviderErrorDetail(response);
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
