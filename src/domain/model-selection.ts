export type GeminiModel =
  | "gemini-3.1-flash-lite-preview"
  | "gemini-3-flash-preview"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite";

export type OpenRouterSummaryModel = "qwen/qwen3.6-plus";

export type TranscriptionProvider = "gemini";
export type SummaryProvider = "gemini" | "openrouter";

export type TranscriptionModel = GeminiModel;
export type SummaryModel = GeminiModel | OpenRouterSummaryModel;

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

export const GEMINI_MODEL_OPTIONS: readonly ModelOption<GeminiModel>[] = [
  {
    value: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite Preview",
    description: "Default fast/free option for daily summaries and high-volume media processing."
  },
  {
    value: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    description: "Quality mode for longer media, technical talks, and more complex summary structure."
  },
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Stable fallback with strong multimodal support."
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description: "Stable lightweight fallback for lower-latency or lower-volume testing."
  }
] as const;

export const OPENROUTER_SUMMARY_MODEL_OPTIONS: readonly ModelOption<OpenRouterSummaryModel>[] = [
  {
    value: "qwen/qwen3.6-plus",
    label: "Qwen 3.6 Plus",
    description: "OpenRouter text summary model for transcript-first summarization."
  }
] as const;

export const TRANSCRIPTION_PROVIDER_OPTIONS: readonly ProviderOption<TranscriptionProvider>[] = [
  {
    value: "gemini",
    label: "Gemini",
    description: "Audio-capable provider for media transcription."
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
export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModel = "gemini-2.5-flash";
export const DEFAULT_GEMINI_SUMMARY_MODEL: GeminiModel = "gemini-3.1-flash-lite-preview";
export const DEFAULT_OPENROUTER_SUMMARY_MODEL: OpenRouterSummaryModel = "qwen/qwen3.6-plus";
export const DEFAULT_SUMMARY_MODEL: SummaryModel = DEFAULT_GEMINI_SUMMARY_MODEL;

export function isSupportedGeminiModel(model: string): model is GeminiModel {
  return GEMINI_MODEL_OPTIONS.some((option) => option.value === model);
}

export function isSupportedOpenRouterSummaryModel(model: string): model is OpenRouterSummaryModel {
  return OPENROUTER_SUMMARY_MODEL_OPTIONS.some((option) => option.value === model);
}

export function normalizeTranscriptionProvider(provider: string): TranscriptionProvider {
  return provider === "gemini" ? provider : DEFAULT_TRANSCRIPTION_PROVIDER;
}

export function normalizeSummaryProvider(provider: string): SummaryProvider {
  return provider === "gemini" || provider === "openrouter" ? provider : DEFAULT_SUMMARY_PROVIDER;
}

export function normalizeTranscriptionModel(model: string): TranscriptionModel {
  return isSupportedGeminiModel(model) ? model : DEFAULT_TRANSCRIPTION_MODEL;
}

export function normalizeSummaryModel(provider: SummaryProvider, model: string): SummaryModel {
  if (provider === "openrouter") {
    return isSupportedOpenRouterSummaryModel(model) ? model : DEFAULT_OPENROUTER_SUMMARY_MODEL;
  }

  return isSupportedGeminiModel(model) ? model : DEFAULT_GEMINI_SUMMARY_MODEL;
}

export function getTranscriptionModelOptions(): readonly ModelOption<TranscriptionModel>[] {
  return GEMINI_MODEL_OPTIONS;
}

export function getSummaryModelOptions(
  provider: SummaryProvider
): readonly ModelOption<SummaryModel>[] {
  return provider === "openrouter" ? OPENROUTER_SUMMARY_MODEL_OPTIONS : GEMINI_MODEL_OPTIONS;
}
