import {
  DEFAULT_GEMINI_SUMMARY_MODEL,
  DEFAULT_GLADIA_TRANSCRIPTION_MODEL,
  DEFAULT_MISTRAL_SUMMARY_MODEL,
  DEFAULT_OPENROUTER_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  GEMINI_3_FLASH_PREVIEW_MODEL,
  LEGACY_GEMINI_3_FLASH_PREVIEW_MODEL
} from "@domain/model-defaults";
import type {
  GeminiModel,
  MistralSummaryModel,
  ModelProvider,
  ModelPurpose,
  OpenRouterSummaryModel,
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";

export interface ManagedModelSuggestion {
  id: string;
  name: string;
}

export function normalizeModelText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeKnownModelId(provider: ModelProvider, modelId: string): string {
  if (provider === "gemini" && modelId === LEGACY_GEMINI_3_FLASH_PREVIEW_MODEL) {
    return GEMINI_3_FLASH_PREVIEW_MODEL;
  }

  return modelId;
}

export function isModelProvider(value: string): value is ModelProvider {
  return value === "gemini" || value === "openrouter" || value === "mistral" || value === "gladia";
}

export function isModelPurpose(value: string): value is ModelPurpose {
  return value === "transcription" || value === "summary";
}

export function isAllowedProviderPurpose(provider: ModelProvider, purpose: ModelPurpose): boolean {
  if (purpose === "transcription") {
    return provider === "gemini" || provider === "gladia";
  }

  return provider === "gemini" || provider === "openrouter" || provider === "mistral";
}

export function isSupportedGeminiModel(model: string): model is GeminiModel {
  return model.trim().length > 0;
}

export function isSupportedOpenRouterSummaryModel(model: string): model is OpenRouterSummaryModel {
  return model.trim().length > 0;
}

export function isSupportedMistralSummaryModel(model: string): model is MistralSummaryModel {
  return model.trim().length > 0;
}

export function normalizeTranscriptionProvider(provider: string): TranscriptionProvider {
  return provider === "gemini" || provider === "gladia" ? provider : DEFAULT_TRANSCRIPTION_PROVIDER;
}

export function normalizeSummaryProvider(provider: string): SummaryProvider {
  return provider === "gemini" || provider === "openrouter" || provider === "mistral"
    ? provider
    : DEFAULT_SUMMARY_PROVIDER;
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

  if (provider === "openrouter") {
    return DEFAULT_OPENROUTER_SUMMARY_MODEL;
  }
  if (provider === "mistral") {
    return DEFAULT_MISTRAL_SUMMARY_MODEL;
  }
  return DEFAULT_GEMINI_SUMMARY_MODEL;
}

export function searchManagedModelSuggestions(
  suggestions: readonly ManagedModelSuggestion[],
  query: string,
  limit = 8
): ManagedModelSuggestion[] {
  const normalizedQuery = normalizeComparable(query);
  if (normalizedQuery.length === 0) {
    return [];
  }

  return [...suggestions]
    .map((suggestion) => {
      const normalizedId = normalizeComparable(suggestion.id);
      const normalizedName = normalizeComparable(suggestion.name);

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

      return { suggestion, rank };
    })
    .filter((candidate) => candidate.rank < 99)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.suggestion.id.localeCompare(right.suggestion.id);
    })
    .slice(0, limit)
    .map((candidate) => candidate.suggestion);
}

export function mergeManagedModelSuggestions(
  primary: readonly ManagedModelSuggestion[],
  secondary: readonly ManagedModelSuggestion[],
  limit = 8
): ManagedModelSuggestion[] {
  const merged: ManagedModelSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of [...primary, ...secondary]) {
    if (seen.has(suggestion.id)) {
      continue;
    }
    merged.push(suggestion);
    seen.add(suggestion.id);
    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}
