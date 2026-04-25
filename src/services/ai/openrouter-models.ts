import {
  createModelCatalogEntry,
  normalizeModelCatalog,
  upsertModelCatalogEntry,
  type AiModelCatalogEntry
} from "@domain/settings";

export interface OpenRouterModelRecord {
  id: string;
  name: string;
}

export interface OpenRouterModelSyncResult {
  catalog: AiModelCatalogEntry[];
  messages: string[];
}

interface OpenRouterModelsRequest {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface OpenRouterModelApiRecord {
  id?: unknown;
  name?: unknown;
}

interface OpenRouterModelsApiResponse {
  data?: OpenRouterModelApiRecord[];
}

const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const DEFAULT_TIMEOUT_MS = 15_000;

function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch | null {
  return fetchImpl ?? globalThis.fetch ?? null;
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

export function normalizeOpenRouterModels(payload: unknown): OpenRouterModelRecord[] {
  const response = payload as OpenRouterModelsApiResponse;
  if (!Array.isArray(response.data)) {
    return [];
  }

  const models: OpenRouterModelRecord[] = [];
  const seen = new Set<string>();

  for (const candidate of response.data) {
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    if (id.length === 0 || seen.has(id)) {
      continue;
    }

    const name = typeof candidate.name === "string" && candidate.name.trim().length > 0
      ? candidate.name.trim()
      : id;
    models.push({ id, name });
    seen.add(id);
  }

  return models;
}

export async function fetchOpenRouterModels(
  request: OpenRouterModelsRequest = {}
): Promise<OpenRouterModelRecord[]> {
  const fetchImpl = getFetchImplementation(request.fetchImpl);
  if (!fetchImpl) {
    throw new Error("fetch is not available for OpenRouter models API.");
  }

  const apiKey = request.apiKey?.trim() ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  if (apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetchWithTimeout(
    fetchImpl,
    OPENROUTER_MODELS_ENDPOINT,
    {
      method: "GET",
      headers
    },
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`OpenRouter models API failed (HTTP ${response.status}).`);
  }

  return normalizeOpenRouterModels(await response.json());
}

export function syncOpenRouterModelCatalog(
  catalog: readonly AiModelCatalogEntry[],
  models: readonly OpenRouterModelRecord[],
  now: Date = new Date()
): OpenRouterModelSyncResult {
  const normalizedCatalog = normalizeModelCatalog(catalog);
  const byId = new Map(models.map((model) => [model.id, model]));
  const byName = new Map(models.map((model) => [normalizeComparable(model.name), model]));
  const updatedAt = now.toISOString();
  let next = normalizedCatalog;
  const messages: string[] = [];

  for (const entry of normalizedCatalog) {
    if (entry.provider !== "openrouter" || entry.purpose !== "summary") {
      continue;
    }

    const officialById = byId.get(entry.modelId);
    if (officialById) {
      if (entry.displayName !== officialById.name || entry.source !== "openrouter") {
        const updated = createModelCatalogEntry({
          ...entry,
          displayName: officialById.name,
          source: "openrouter",
          updatedAt
        });
        if (updated) {
          next = upsertModelCatalogEntry(next, updated);
          messages.push(`Updated OpenRouter model name for ${entry.modelId}.`);
        }
      }
      continue;
    }

    const officialByName = byName.get(normalizeComparable(entry.displayName));
    if (officialByName) {
      const updated = createModelCatalogEntry({
        provider: "openrouter",
        purpose: "summary",
        displayName: officialByName.name,
        modelId: officialByName.id,
        source: "openrouter",
        updatedAt
      });
      if (updated) {
        next = next
          .filter(
            (candidate) =>
              candidate.provider !== entry.provider ||
              candidate.purpose !== entry.purpose ||
              candidate.modelId !== entry.modelId
          );
        next = upsertModelCatalogEntry(next, updated);
        messages.push(`Corrected OpenRouter model id for ${entry.displayName}: ${officialByName.id}.`);
      }
      continue;
    }

    messages.push(`OpenRouter model was not found: ${entry.displayName} (${entry.modelId}).`);
  }

  return {
    catalog: normalizeModelCatalog(next),
    messages
  };
}
