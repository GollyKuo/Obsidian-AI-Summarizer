import {
  getModelCatalogOptions,
  type AiModelCatalogEntry,
  type ModelProvider,
  type ModelPurpose
} from "@domain/model-selection";
import {
  type ManagedModelSuggestion,
  mergeManagedModelSuggestions,
  searchManagedModelSuggestions
} from "@domain/provider-model-discovery";

export type { ManagedModelSuggestion };
export { mergeManagedModelSuggestions, searchManagedModelSuggestions };

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
