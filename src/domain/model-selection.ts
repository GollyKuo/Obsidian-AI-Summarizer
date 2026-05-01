export type GeminiModel = string;
export type OpenRouterSummaryModel = string;

export type TranscriptionProvider = "gemini" | "gladia";
export type SummaryProvider = "gemini" | "openrouter";
export type ModelProvider = TranscriptionProvider | SummaryProvider;
export type ModelPurpose = "transcription" | "summary";

export type TranscriptionModel = string;
export type SummaryModel = string;

export interface ModelOption<TValue extends string> {
  value: TValue;
  label: string;
  description: string;
}

export interface ProviderOption<TValue extends string> {
  value: TValue;
  label: string;
  description: string;
}

export interface AiModelCatalogEntry {
  provider: ModelProvider;
  purpose: ModelPurpose;
  displayName: string;
  modelId: string;
  source?: "user" | "openrouter";
  updatedAt?: string;
}

export const GEMINI_MODEL_OPTIONS: readonly ModelOption<GeminiModel>[] = [];
export const OPENROUTER_SUMMARY_MODEL_OPTIONS: readonly ModelOption<OpenRouterSummaryModel>[] = [];
const LEGACY_GEMINI_3_FLASH_PREVIEW_MODEL = "gemini-3.0-flash-preview";
const GEMINI_3_FLASH_PREVIEW_MODEL = "gemini-3-flash-preview";

export const DEFAULT_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  {
    provider: "gemini",
    purpose: "transcription",
    displayName: GEMINI_3_FLASH_PREVIEW_MODEL,
    modelId: GEMINI_3_FLASH_PREVIEW_MODEL,
    source: "user"
  },
  {
    provider: "gemini",
    purpose: "transcription",
    displayName: "gemini-2.5-flash",
    modelId: "gemini-2.5-flash",
    source: "user"
  },
  {
    provider: "gemini",
    purpose: "summary",
    displayName: GEMINI_3_FLASH_PREVIEW_MODEL,
    modelId: GEMINI_3_FLASH_PREVIEW_MODEL,
    source: "user"
  },
  {
    provider: "gemini",
    purpose: "summary",
    displayName: "gemini-2.5-flash",
    modelId: "gemini-2.5-flash",
    source: "user"
  }
];

export const TRANSCRIPTION_PROVIDER_OPTIONS: readonly ProviderOption<TranscriptionProvider>[] = [
  {
    value: "gemini",
    label: "Gemini",
    description: "Audio-capable provider for media transcription."
  },
  {
    value: "gladia",
    label: "Gladia",
    description: "Async pre-recorded speech-to-text provider for audio and video transcription."
  }
] as const;

export const SUMMARY_PROVIDER_OPTIONS: readonly ProviderOption<SummaryProvider>[] = [
  {
    value: "gemini",
    label: "Gemini",
    description: "Recommended default summary provider."
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Transcript-first text summarization via OpenRouter."
  }
] as const;

export const DEFAULT_TRANSCRIPTION_PROVIDER: TranscriptionProvider = "gemini";
export const DEFAULT_SUMMARY_PROVIDER: SummaryProvider = "gemini";
export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModel = GEMINI_3_FLASH_PREVIEW_MODEL;
export const DEFAULT_GLADIA_TRANSCRIPTION_MODEL: TranscriptionModel = "default";
export const DEFAULT_GEMINI_SUMMARY_MODEL: GeminiModel = "gemini-3.1-flash-lite-preview";
export const DEFAULT_OPENROUTER_SUMMARY_MODEL: OpenRouterSummaryModel = "qwen/qwen3.6-plus";
export const DEFAULT_SUMMARY_MODEL: SummaryModel = DEFAULT_GEMINI_SUMMARY_MODEL;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeModelText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKnownModelId(provider: ModelProvider, modelId: string): string {
  if (provider === "gemini" && modelId === LEGACY_GEMINI_3_FLASH_PREVIEW_MODEL) {
    return GEMINI_3_FLASH_PREVIEW_MODEL;
  }

  return modelId;
}

function isModelProvider(value: string): value is ModelProvider {
  return value === "gemini" || value === "openrouter" || value === "gladia";
}

function isModelPurpose(value: string): value is ModelPurpose {
  return value === "transcription" || value === "summary";
}

function isAllowedProviderPurpose(provider: ModelProvider, purpose: ModelPurpose): boolean {
  if (purpose === "transcription") {
    return provider === "gemini" || provider === "gladia";
  }

  return provider === "gemini" || provider === "openrouter";
}

export function isSupportedGeminiModel(model: string): model is GeminiModel {
  return model.trim().length > 0;
}

export function isSupportedOpenRouterSummaryModel(model: string): model is OpenRouterSummaryModel {
  return model.trim().length > 0;
}

export function normalizeTranscriptionProvider(provider: string): TranscriptionProvider {
  return provider === "gemini" || provider === "gladia" ? provider : DEFAULT_TRANSCRIPTION_PROVIDER;
}

export function normalizeSummaryProvider(provider: string): SummaryProvider {
  return provider === "gemini" || provider === "openrouter" ? provider : DEFAULT_SUMMARY_PROVIDER;
}

export function normalizeTranscriptionModel(model: string): TranscriptionModel {
  const normalizedModel = normalizeModelText(model);
  return normalizedModel
    ? normalizeKnownModelId("gemini", normalizedModel)
    : DEFAULT_TRANSCRIPTION_MODEL;
}

export function normalizeTranscriptionModelForProvider(
  provider: TranscriptionProvider,
  model: string
): TranscriptionModel {
  const normalizedModel = normalizeKnownModelId(provider, normalizeModelText(model));
  if (normalizedModel.length > 0) {
    return normalizedModel;
  }

  return provider === "gladia" ? DEFAULT_GLADIA_TRANSCRIPTION_MODEL : DEFAULT_TRANSCRIPTION_MODEL;
}

export function normalizeSummaryModel(provider: SummaryProvider, model: string): SummaryModel {
  const normalizedModel = normalizeKnownModelId(provider, normalizeModelText(model));
  if (normalizedModel.length > 0) {
    return normalizedModel;
  }

  return provider === "openrouter"
    ? DEFAULT_OPENROUTER_SUMMARY_MODEL
    : DEFAULT_GEMINI_SUMMARY_MODEL;
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
    const source = candidate.source === "openrouter" ? "openrouter" : "user";
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
  source?: "user" | "openrouter";
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
  provider: TranscriptionProvider = DEFAULT_TRANSCRIPTION_PROVIDER,
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
