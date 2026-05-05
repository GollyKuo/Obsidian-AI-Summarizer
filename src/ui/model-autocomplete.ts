import {
  getModelCatalogOptions,
  type AiModelCatalogEntry,
  type ModelProvider,
  type ModelPurpose
} from "@domain/model-selection";

export interface ManagedModelSuggestion {
  id: string;
  name: string;
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getLocalManagedModelSuggestions(
  catalog: readonly AiModelCatalogEntry[],
  provider: ModelProvider,
  purpose: ModelPurpose,
  selectedModel?: string
): ManagedModelSuggestion[] {
  return getModelCatalogOptions(catalog, provider, purpose, selectedModel).map((option) => ({
    id: option.value,
    name: option.label
  }));
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
