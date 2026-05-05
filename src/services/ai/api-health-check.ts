import type {
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/settings";
import { readProviderErrorDetail } from "@services/ai/provider-error";

export type ApiHealthCheckRequest =
  | ApiHealthCheckGeminiRequest
  | ApiHealthCheckGladiaRequest
  | ApiHealthCheckMistralRequest
  | ApiHealthCheckOpenRouterRequest;

interface ApiHealthCheckBaseRequest {
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

type ApiHealthCheckGeminiRequest =
  | (ApiHealthCheckBaseRequest & {
      kind: "transcription";
      provider: "gemini";
      model: TranscriptionModel;
    })
  | (ApiHealthCheckBaseRequest & {
      kind: "summary";
      provider: "gemini";
      model: SummaryModel;
    });

interface ApiHealthCheckOpenRouterRequest extends ApiHealthCheckBaseRequest {
  kind: "summary";
  provider: "openrouter";
  model: SummaryModel;
}

interface ApiHealthCheckMistralRequest extends ApiHealthCheckBaseRequest {
  kind: "summary";
  provider: "mistral";
  model: SummaryModel;
}

interface ApiHealthCheckGladiaRequest extends ApiHealthCheckBaseRequest {
  kind: "transcription";
  provider: "gladia";
  model: TranscriptionModel;
}

export interface ApiHealthCheckResult {
  ok: boolean;
  provider: TranscriptionProvider | SummaryProvider;
  model: TranscriptionModel | SummaryModel;
  message: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch | null {
  return fetchImpl ?? globalThis.fetch ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

async function readErrorMessage(response: Response): Promise<string> {
  const detail = await readProviderErrorDetail(response);
  return detail.message || detail.bodyExcerpt || "";
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function testGeminiApi(
  request: ApiHealthCheckGeminiRequest
): Promise<ApiHealthCheckResult> {
  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: "目前環境不支援 fetch，無法測試 Gemini API。"
    };
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      request.model
    )}:generateContent?key=${encodeURIComponent(request.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Reply with OK." }]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8
        }
      })
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: detail
        ? `Gemini API 測試失敗（HTTP ${response.status}）：${detail}`
        : `Gemini API 測試失敗（HTTP ${response.status}）。`
    };
  }

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    message: `Gemini API 可用：${request.model}`
  };
}

async function testOpenRouterApi(
  request: ApiHealthCheckOpenRouterRequest
): Promise<ApiHealthCheckResult> {
  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: "目前環境不支援 fetch，無法測試 OpenRouter API。"
    };
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "AI Summarizer"
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: "user", content: "Reply with OK." }],
        temperature: 0,
        max_tokens: 8
      })
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: detail
        ? `OpenRouter API 測試失敗（HTTP ${response.status}）：${detail}`
        : `OpenRouter API 測試失敗（HTTP ${response.status}）。`
    };
  }

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    message: `OpenRouter API 可用：${request.model}`
  };
}

async function testMistralApi(
  request: ApiHealthCheckMistralRequest
): Promise<ApiHealthCheckResult> {
  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: "目前環境不支援 fetch，無法測試 Mistral API。"
    };
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: "user", content: "Reply with OK." }],
        temperature: 0,
        max_tokens: 8
      })
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: detail
        ? `Mistral API 測試失敗（HTTP ${response.status}）：${detail}`
        : `Mistral API 測試失敗（HTTP ${response.status}）。`
    };
  }

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    message: `Mistral API 可用：${request.model}`
  };
}

async function testGladiaApi(
  request: ApiHealthCheckGladiaRequest
): Promise<ApiHealthCheckResult> {
  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: "目前環境不支援 fetch，無法測試 Gladia API。"
    };
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    "https://api.gladia.io/v2/pre-recorded?limit=1",
    {
      method: "GET",
      headers: {
        "x-gladia-key": request.apiKey
      }
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: detail
        ? `Gladia API 測試失敗（HTTP ${response.status}）：${detail}`
        : `Gladia API 測試失敗（HTTP ${response.status}）。`
    };
  }

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    message: "Gladia API Key 可用。"
  };
}

export async function testAiApiAvailability(
  request: ApiHealthCheckRequest
): Promise<ApiHealthCheckResult> {
  const apiKey = request.apiKey.trim();
  if (apiKey.length === 0) {
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message: "請先輸入 API Key，再執行測試。"
    };
  }

  try {
    if (request.provider === "openrouter") {
      return await testOpenRouterApi({ ...request, apiKey });
    }
    if (request.provider === "mistral") {
      return await testMistralApi({ ...request, apiKey });
    }
    if (request.provider === "gladia") {
      return await testGladiaApi({ ...request, apiKey });
    }

    return await testGeminiApi({ ...request, apiKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      provider: request.provider,
      model: request.model,
      message:
        isAbortError(error)
          ? `${request.provider} API 測試逾時，請稍後再試。`
          : `${request.provider} API 測試失敗：${message}`
    };
  }
}
