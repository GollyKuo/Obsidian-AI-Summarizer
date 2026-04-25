export interface GeminiModelRecord {
  id: string;
  name: string;
}

interface GeminiModelsRequest {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface GeminiModelApiRecord {
  name?: unknown;
  displayName?: unknown;
  supportedGenerationMethods?: unknown;
}

interface GeminiModelsApiResponse {
  models?: GeminiModelApiRecord[];
}

const GEMINI_MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch | null {
  return fetchImpl ?? globalThis.fetch ?? null;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeGeminiModels(payload: unknown): GeminiModelRecord[] {
  const response = payload as GeminiModelsApiResponse;
  if (!Array.isArray(response.models)) {
    return [];
  }

  const models: GeminiModelRecord[] = [];
  const seen = new Set<string>();

  for (const candidate of response.models) {
    const rawName = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const supportedMethods = Array.isArray(candidate.supportedGenerationMethods)
      ? candidate.supportedGenerationMethods.filter((method): method is string => typeof method === "string")
      : [];
    if (rawName.length === 0 || !supportedMethods.includes("generateContent")) {
      continue;
    }

    const id = rawName.startsWith("models/") ? rawName.slice("models/".length) : rawName;
    if (id.length === 0 || seen.has(id)) {
      continue;
    }

    const displayName =
      typeof candidate.displayName === "string" && candidate.displayName.trim().length > 0
        ? candidate.displayName.trim()
        : id;
    models.push({ id, name: displayName });
    seen.add(id);
  }

  return models;
}

export async function fetchGeminiModels(
  request: GeminiModelsRequest
): Promise<GeminiModelRecord[]> {
  const apiKey = request.apiKey.trim();
  if (apiKey.length === 0) {
    return [];
  }

  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    throw new Error("fetch is not available for Gemini models API.");
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    `${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Gemini models API failed (HTTP ${response.status}).`);
  }

  return normalizeGeminiModels(await response.json());
}

export function searchGeminiModels(
  models: readonly GeminiModelRecord[],
  query: string,
  limit = 8
): GeminiModelRecord[] {
  const normalizedQuery = normalizeComparable(query);
  if (normalizedQuery.length === 0) {
    return [];
  }

  return [...models]
    .map((model) => {
      const normalizedId = normalizeComparable(model.id);
      const normalizedName = normalizeComparable(model.name);

      let rank = 99;
      if (normalizedId === normalizedQuery) {
        rank = 0;
      } else if (normalizedName === normalizedQuery) {
        rank = 1;
      } else if (normalizedId.startsWith(normalizedQuery)) {
        rank = 2;
      } else if (normalizedName.startsWith(normalizedQuery)) {
        rank = 3;
      } else if (normalizedId.includes(normalizedQuery)) {
        rank = 4;
      } else if (normalizedName.includes(normalizedQuery)) {
        rank = 5;
      }

      return { model, rank };
    })
    .filter((candidate) => candidate.rank < 99)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.model.id.localeCompare(right.model.id);
    })
    .slice(0, limit)
    .map((candidate) => candidate.model);
}
