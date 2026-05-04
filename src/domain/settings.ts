import type {
  GeminiTranscriptionStrategy,
  RetentionMode,
  SourceType
} from "@domain/types";
import {
  DEFAULT_GEMINI_SUMMARY_MODEL,
  DEFAULT_GLADIA_TRANSCRIPTION_MODEL,
  DEFAULT_MISTRAL_SUMMARY_MODEL,
  DEFAULT_MODEL_CATALOG,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  createModelCatalogEntry,
  ensureSelectedModelsInCatalog,
  getFirstModelIdForProvider,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  getGeminiTranscriptionRiskMessage,
  isSupportedGeminiModel,
  isSupportedMistralSummaryModel,
  normalizeModelCatalog,
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel,
  normalizeTranscriptionModelForProvider,
  normalizeTranscriptionProvider,
  removeModelCatalogEntry,
  upsertModelCatalogEntry,
  type AiModelCatalogEntry,
  type GeminiModel,
  type MistralSummaryModel,
  type ModelProvider,
  type ModelPurpose,
  type OpenRouterSummaryModel,
  type SummaryModel,
  type SummaryProvider,
  type TranscriptionModel,
  type TranscriptionProvider
} from "@domain/model-selection";

export type RuntimeStrategy = "local_bridge" | "placeholder_only";
export type MediaCompressionProfile = "balanced" | "quality";

export interface AISummarizerPluginSettings {
  apiKey: string;
  openRouterApiKey: string;
  mistralApiKey: string;
  gladiaApiKey: string;
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
  geminiTranscriptionStrategy: GeminiTranscriptionStrategy;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  modelCatalog: AiModelCatalogEntry[];
  outputFolder: string;
  mediaCacheRoot: string;
  ytDlpPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  mediaCompressionProfile: MediaCompressionProfile;
  templateReference: string;
  retentionMode: RetentionMode;
  generateFlashcards: boolean;
  runtimeStrategy: RuntimeStrategy;
  debugMode: boolean;
  lastSourceType: SourceType;
}

export const DEFAULT_SETTINGS: AISummarizerPluginSettings = {
  apiKey: "",
  openRouterApiKey: "",
  mistralApiKey: "",
  gladiaApiKey: "",
  transcriptionProvider: DEFAULT_TRANSCRIPTION_PROVIDER,
  transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
  geminiTranscriptionStrategy: "auto",
  summaryProvider: DEFAULT_SUMMARY_PROVIDER,
  summaryModel: DEFAULT_SUMMARY_MODEL,
  modelCatalog: [...DEFAULT_MODEL_CATALOG],
  outputFolder: "",
  mediaCacheRoot: "",
  ytDlpPath: "",
  ffmpegPath: "",
  ffprobePath: "",
  mediaCompressionProfile: "balanced",
  templateReference: "builtin:universal-frontmatter",
  retentionMode: "delete_temp",
  generateFlashcards: false,
  runtimeStrategy: "local_bridge",
  debugMode: false,
  lastSourceType: "webpage_url"
};

export function normalizeRetentionMode(rawMode: unknown): RetentionMode {
  const mode = String(rawMode ?? "").trim();
  if (mode === "keep_temp" || mode === "source" || mode === "all") {
    return "keep_temp";
  }
  return "delete_temp";
}

export function normalizeGeminiTranscriptionStrategy(
  rawStrategy: unknown
): GeminiTranscriptionStrategy {
  const strategy = String(rawStrategy ?? "").trim();
  if (strategy === "files_api" || strategy === "inline_chunks") {
    return strategy;
  }
  return "auto";
}

export {
  DEFAULT_GEMINI_SUMMARY_MODEL as DEFAULT_GEMINI_MODEL,
  DEFAULT_GLADIA_TRANSCRIPTION_MODEL,
  DEFAULT_MISTRAL_SUMMARY_MODEL,
  DEFAULT_MODEL_CATALOG,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  createModelCatalogEntry,
  ensureSelectedModelsInCatalog,
  getFirstModelIdForProvider,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  getGeminiTranscriptionRiskMessage,
  isSupportedGeminiModel,
  isSupportedMistralSummaryModel,
  normalizeModelCatalog,
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel,
  normalizeTranscriptionModelForProvider,
  normalizeTranscriptionProvider,
  removeModelCatalogEntry,
  upsertModelCatalogEntry
};

export type {
  AiModelCatalogEntry,
  GeminiModel,
  MistralSummaryModel,
  ModelProvider,
  ModelPurpose,
  OpenRouterSummaryModel,
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
};
