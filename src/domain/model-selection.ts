export type GeminiModel = string;
export type OpenRouterSummaryModel = string;
export type MistralSummaryModel = string;

export type TranscriptionProvider = "gemini" | "gladia";
export type SummaryProvider = "gemini" | "openrouter" | "mistral";
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
  source?: "user" | "openrouter" | "mistral";
  updatedAt?: string;
}

export * from "@domain/model-defaults";
export * from "@domain/provider-model-discovery";
export * from "@domain/model-catalog";
