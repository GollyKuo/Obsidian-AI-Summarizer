import { DEFAULT_MODEL_CATALOG, DEFAULT_SUMMARY_MODEL, DEFAULT_TRANSCRIPTION_MODEL } from "@domain/model-defaults";
import {
  isAllowedProviderPurpose,
  isModelProvider,
  isModelPurpose,
  normalizeKnownModelId,
  normalizeModelText
} from "@domain/provider-model-discovery";
import type {
  AiModelCatalogEntry,
  ModelOption,
  ModelProvider,
  ModelPurpose,
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeModelCatalog(value: unknown): AiModelCatalogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: AiModelCatalogEntry[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const provider = normalizeModelText(candidate.provider);
    const purpose = normalizeModelText(candidate.purpose);
    const rawModelId = normalizeModelText(candidate.modelId);
    if (
      !isModelProvider(provider) ||
      !isModelPurpose(purpose) ||
      !isAllowedProviderPurpose(provider, purpose) ||
      rawModelId.length === 0
    ) {
      continue;
    }

    const modelId = normalizeKnownModelId(provider, rawModelId);
    const key = `${provider}:${purpose}:${modelId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const displayName = normalizeModelText(candidate.displayName) || modelId;
    const source =
      candidate.source === "openrouter" || candidate.source === "mistral"
        ? candidate.source
        : "user";
    const updatedAt = normalizeModelText(candidate.updatedAt);
    entries.push({
      provider,
      purpose,
      displayName,
      modelId,
      source,
      ...(updatedAt ? { updatedAt } : {})
    });
  }

  return entries;
}

export function createModelCatalogEntry(input: {
  provider: ModelProvider;
  purpose: ModelPurpose;
  displayName?: string;
  modelId: string;
  source?: "user" | "openrouter" | "mistral";
  updatedAt?: string;
}): AiModelCatalogEntry | null {
  const modelId = normalizeKnownModelId(input.provider, input.modelId.trim());
  if (!isAllowedProviderPurpose(input.provider, input.purpose) || modelId.length === 0) {
    return null;
  }

  return {
    provider: input.provider,
    purpose: input.purpose,
    displayName: input.displayName?.trim() || modelId,
    modelId,
    source: input.source ?? "user",
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {})
  };
}

export function upsertModelCatalogEntry(
  catalog: readonly AiModelCatalogEntry[],
  entry: AiModelCatalogEntry
): AiModelCatalogEntry[] {
  const normalized = createModelCatalogEntry(entry);
  if (!normalized) {
    return normalizeModelCatalog(catalog);
  }

  const next = normalizeModelCatalog(catalog);
  const existingIndex = next.findIndex(
    (candidate) =>
      candidate.provider === normalized.provider &&
      candidate.purpose === normalized.purpose &&
      candidate.modelId === normalized.modelId
  );

  if (existingIndex >= 0) {
    next[existingIndex] = normalized;
    return next;
  }

  return [...next, normalized];
}

export function removeModelCatalogEntry(
  catalog: readonly AiModelCatalogEntry[],
  entry: Pick<AiModelCatalogEntry, "provider" | "purpose" | "modelId">
): AiModelCatalogEntry[] {
  return normalizeModelCatalog(catalog).filter(
    (candidate) =>
      candidate.provider !== entry.provider ||
      candidate.purpose !== entry.purpose ||
      candidate.modelId !== entry.modelId
  );
}

export function ensureSelectedModelsInCatalog(
  catalog: readonly AiModelCatalogEntry[],
  selected: {
    transcriptionProvider: TranscriptionProvider;
    transcriptionModel: TranscriptionModel;
    summaryProvider: SummaryProvider;
    summaryModel: SummaryModel;
  },
  options: { includeDefaults?: boolean } = {}
): AiModelCatalogEntry[] {
  let next = normalizeModelCatalog([...DEFAULT_MODEL_CATALOG, ...catalog]);
  const includeDefaults = options.includeDefaults ?? false;

  if (includeDefaults || selected.transcriptionModel !== DEFAULT_TRANSCRIPTION_MODEL) {
    const hasSelectedTranscriptionModel = next.some(
      (entry) =>
        entry.provider === selected.transcriptionProvider &&
        entry.purpose === "transcription" &&
        entry.modelId === selected.transcriptionModel
    );
    const entry = hasSelectedTranscriptionModel
      ? null
      : createModelCatalogEntry({
          provider: selected.transcriptionProvider,
          purpose: "transcription",
          modelId: selected.transcriptionModel
        });
    if (!hasSelectedTranscriptionModel && entry) {
      next = upsertModelCatalogEntry(next, entry);
    }
  }

  if (includeDefaults || selected.summaryModel !== DEFAULT_SUMMARY_MODEL) {
    const hasSelectedSummaryModel = next.some(
      (entry) =>
        entry.provider === selected.summaryProvider &&
        entry.purpose === "summary" &&
        entry.modelId === selected.summaryModel
    );
    const entry = hasSelectedSummaryModel
      ? null
      : createModelCatalogEntry({
          provider: selected.summaryProvider,
          purpose: "summary",
          modelId: selected.summaryModel
        });
    if (!hasSelectedSummaryModel && entry) {
      next = upsertModelCatalogEntry(next, entry);
    }
  }

  return next;
}

function toModelOption(entry: AiModelCatalogEntry): ModelOption<string> {
  return {
    value: entry.modelId,
    label: entry.displayName || entry.modelId,
    description: `${entry.provider} ${entry.purpose}: ${entry.modelId}`
  };
}

export function getModelCatalogOptions(
  catalog: readonly AiModelCatalogEntry[],
  provider: ModelProvider,
  purpose: ModelPurpose,
  selectedModel?: string
): readonly ModelOption<string>[] {
  const options = normalizeModelCatalog(catalog)
    .filter((entry) => entry.provider === provider && entry.purpose === purpose)
    .map(toModelOption);

  const selected = selectedModel?.trim();
  if (selected && !options.some((option) => option.value === selected)) {
    return [
      ...options,
      {
        value: selected,
        label: `Current: ${selected}`,
        description: "Current saved model. Add it to the model list to manage its display name."
      }
    ];
  }

  return options;
}

export function getFirstModelIdForProvider(
  catalog: readonly AiModelCatalogEntry[],
  provider: ModelProvider,
  purpose: ModelPurpose
): string | null {
  return (
    normalizeModelCatalog(catalog).find(
      (entry) => entry.provider === provider && entry.purpose === purpose
    )?.modelId ?? null
  );
}

export function getTranscriptionModelOptions(
  provider: TranscriptionProvider = "gemini",
  catalog: readonly AiModelCatalogEntry[] = DEFAULT_MODEL_CATALOG,
  selectedModel?: string
): readonly ModelOption<TranscriptionModel>[] {
  return getModelCatalogOptions(catalog, provider, "transcription", selectedModel);
}

export function getSummaryModelOptions(
  provider: SummaryProvider,
  catalog: readonly AiModelCatalogEntry[] = DEFAULT_MODEL_CATALOG,
  selectedModel?: string
): readonly ModelOption<SummaryModel>[] {
  return getModelCatalogOptions(catalog, provider, "summary", selectedModel);
}

export function getGeminiTranscriptionRiskMessage(entry: AiModelCatalogEntry): string | null {
  if (entry.provider !== "gemini" || entry.purpose !== "transcription") {
    return null;
  }

  return "Gemini transcription models must be audio-capable. The catalog stores user choices, but API checks remain the validation boundary.";
}
