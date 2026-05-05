import type {
  AiModelCatalogEntry,
  GeminiModel,
  ModelOption,
  OpenRouterSummaryModel,
  ProviderOption,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";

const GEMINI_2_5_FLASH_MODEL = "gemini-2.5-flash";
export const LEGACY_GEMINI_3_FLASH_PREVIEW_MODEL = "gemini-3.0-flash-preview";
export const GEMINI_3_FLASH_PREVIEW_MODEL = "gemini-3-flash-preview";
const GEMINI_3_1_FLASH_LITE_PREVIEW_MODEL = "gemini-3.1-flash-lite-preview";
const MISTRAL_SMALL_LATEST_MODEL = "mistral-small-latest";

export const GEMINI_MODEL_OPTIONS: readonly ModelOption<GeminiModel>[] = [];
export const OPENROUTER_SUMMARY_MODEL_OPTIONS: readonly ModelOption<OpenRouterSummaryModel>[] = [];

export const DEFAULT_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  {
    provider: "gemini",
    purpose: "transcription",
    displayName: GEMINI_2_5_FLASH_MODEL,
    modelId: GEMINI_2_5_FLASH_MODEL,
    source: "user"
  },
  {
    provider: "gemini",
    purpose: "transcription",
    displayName: GEMINI_3_FLASH_PREVIEW_MODEL,
    modelId: GEMINI_3_FLASH_PREVIEW_MODEL,
    source: "user"
  },
  {
    provider: "gemini",
    purpose: "summary",
    displayName: GEMINI_2_5_FLASH_MODEL,
    modelId: GEMINI_2_5_FLASH_MODEL,
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
    displayName: GEMINI_3_1_FLASH_LITE_PREVIEW_MODEL,
    modelId: GEMINI_3_1_FLASH_LITE_PREVIEW_MODEL,
    source: "user"
  },
  {
    provider: "mistral",
    purpose: "summary",
    displayName: MISTRAL_SMALL_LATEST_MODEL,
    modelId: MISTRAL_SMALL_LATEST_MODEL,
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
  },
  {
    value: "mistral",
    label: "Mistral",
    description: "Transcript-first text summarization via Mistral Chat Completions."
  }
] as const;

export const DEFAULT_TRANSCRIPTION_PROVIDER: TranscriptionProvider = "gemini";
export const DEFAULT_SUMMARY_PROVIDER: SummaryProvider = "gemini";
export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModel = GEMINI_2_5_FLASH_MODEL;
export const DEFAULT_GLADIA_TRANSCRIPTION_MODEL: TranscriptionModel = "default";
export const DEFAULT_GEMINI_SUMMARY_MODEL: GeminiModel = GEMINI_2_5_FLASH_MODEL;
export const DEFAULT_OPENROUTER_SUMMARY_MODEL: OpenRouterSummaryModel = "qwen/qwen3.6-plus";
export const DEFAULT_MISTRAL_SUMMARY_MODEL = MISTRAL_SMALL_LATEST_MODEL;
export const DEFAULT_SUMMARY_MODEL = DEFAULT_GEMINI_SUMMARY_MODEL;
