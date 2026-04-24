import type { RetentionMode, SourceType } from "@domain/types";
import {
  DEFAULT_GEMINI_SUMMARY_MODEL,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  isSupportedGeminiModel,
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel,
  normalizeTranscriptionProvider,
  type GeminiModel,
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
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  outputFolder: string;
  mediaCacheRoot: string;
  mediaCompressionProfile: MediaCompressionProfile;
  templateReference: string;
  retentionMode: RetentionMode;
  runtimeStrategy: RuntimeStrategy;
  debugMode: boolean;
  lastSourceType: SourceType;
}

export const DEFAULT_SETTINGS: AISummarizerPluginSettings = {
  apiKey: "",
  openRouterApiKey: "",
  transcriptionProvider: DEFAULT_TRANSCRIPTION_PROVIDER,
  transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
  summaryProvider: DEFAULT_SUMMARY_PROVIDER,
  summaryModel: DEFAULT_SUMMARY_MODEL,
  outputFolder: "",
  mediaCacheRoot: "",
  mediaCompressionProfile: "balanced",
  templateReference: "",
  retentionMode: "none",
  runtimeStrategy: "local_bridge",
  debugMode: false,
  lastSourceType: "webpage_url"
};

export {
  DEFAULT_GEMINI_SUMMARY_MODEL as DEFAULT_GEMINI_MODEL,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  SUMMARY_PROVIDER_OPTIONS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  isSupportedGeminiModel,
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel,
  normalizeTranscriptionProvider
};

export type {
  GeminiModel,
  OpenRouterSummaryModel,
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
};
