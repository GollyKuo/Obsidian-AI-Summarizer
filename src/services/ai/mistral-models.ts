export interface MistralModelRecord {
  id: string;
  name: string;
}

interface MistralModelsRequest {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface MistralModelApiRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  aliases?: unknown;
  capabilities?: {
    completion_chat?: unknown;
  };
  archived?: unknown;
}

type MistralModelsApiResponse = MistralModelApiRecord[] | { data?: MistralModelApiRecord[] };

const MISTRAL_MODELS_ENDPOINT = "https://api.mistral.ai/v1/models";
const DEFAULT_TIMEOUT_MS = 15_000;

function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch | null {
  return fetchImpl ?? globalThis.fetch ?? null;
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getDisplayName(candidate: MistralModelApiRecord, id: string): string {
  if (typeof candidate.name === "string" && candidate.name.trim().length > 0) {
    return candidate.name.trim();
  }
  if (typeof candidate.description === "string" && candidate.description.trim().length > 0) {
    return candidate.description.trim();
  }
  return id;
}

function getModelAliases(candidate: MistralModelApiRecord): string[] {
  if (!Array.isArray(candidate.aliases)) {
    return [];
  }

  return candidate.aliases.filter((alias): alias is string => typeof alias === "string");
}

function isChatCompletionModel(candidate: MistralModelApiRecord): boolean {
  return candidate.capabilities?.completion_chat !== false;
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

export function normalizeMistralModels(payload: unknown): MistralModelRecord[] {
  const response = payload as MistralModelsApiResponse;
  const source = Array.isArray(response) ? response : response.data;
  if (!Array.isArray(source)) {
    return [];
  }

  const models: MistralModelRecord[] = [];
  const seen = new Set<string>();

  for (const candidate of source) {
    if (candidate.archived === true || !isChatCompletionModel(candidate)) {
      continue;
    }

    const ids = [
      typeof candidate.id === "string" ? candidate.id.trim() : "",
      ...getModelAliases(candidate).map((alias) => alias.trim())
    ].filter((id) => id.length > 0);

    for (const id of ids) {
      if (seen.has(id)) {
        continue;
      }
      models.push({ id, name: getDisplayName(candidate, id) });
      seen.add(id);
    }
  }

  return models;
}

export async function fetchMistralModels(
  request: MistralModelsRequest
): Promise<MistralModelRecord[]> {
  const apiKey = request.apiKey.trim();
  if (apiKey.length === 0) {
    return [];
  }

  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    throw new Error("fetch is not available for Mistral models API.");
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    MISTRAL_MODELS_ENDPOINT,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Mistral models API failed (HTTP ${response.status}).`);
  }

  return normalizeMistralModels(await response.json());
}

export function searchMistralModels(
  models: readonly MistralModelRecord[],
  query: string,
  limit = 8
): MistralModelRecord[] {
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
