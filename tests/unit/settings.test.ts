import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GLADIA_TRANSCRIPTION_MODEL,
  DEFAULT_MISTRAL_SUMMARY_MODEL,
  DEFAULT_MODEL_CATALOG,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  DEFAULT_SETTINGS,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  createModelCatalogEntry,
  ensureSelectedModelsInCatalog,
  getGeminiTranscriptionRiskMessage,
  getSummaryModelOptions,
  getTranscriptionModelOptions,
  isSupportedGeminiModel,
  normalizeModelCatalog,
  normalizeRetentionMode,
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel,
  normalizeTranscriptionModelForProvider,
  removeModelCatalogEntry,
  upsertModelCatalogEntry
} from "@domain/settings";

describe("settings", () => {
  it("preloads the supported Gemini transcription and summary models into the default catalog", () => {
    expect(DEFAULT_SETTINGS.transcriptionProvider).toBe(DEFAULT_TRANSCRIPTION_PROVIDER);
    expect(DEFAULT_SETTINGS.transcriptionModel).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(DEFAULT_SETTINGS.summaryProvider).toBe(DEFAULT_SUMMARY_PROVIDER);
    expect(DEFAULT_SETTINGS.summaryModel).toBe(DEFAULT_SUMMARY_MODEL);
    expect(DEFAULT_SETTINGS.generateFlashcards).toBe(false);
    expect(DEFAULT_SETTINGS.summaryModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_SETTINGS.modelCatalog.map((entry) => entry.modelId)).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "mistral-small-latest"
    ]);
    expect(DEFAULT_SETTINGS.modelCatalog.map((entry) => entry.displayName)).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "mistral-small-latest"
    ]);
    expect(DEFAULT_MODEL_CATALOG).toEqual(DEFAULT_SETTINGS.modelCatalog);
    expect(getTranscriptionModelOptions().map((option) => option.value)).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ]);
    expect(getTranscriptionModelOptions().map((option) => option.label)).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ]);
    expect(getSummaryModelOptions("gemini").map((option) => option.value)).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ]);
    expect(getSummaryModelOptions("gemini").map((option) => option.label)).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ]);
    expect(GEMINI_MODEL_OPTIONS).toEqual([]);
    expect(OPENROUTER_SUMMARY_MODEL_OPTIONS).toEqual([]);
  });

  it("keeps arbitrary user-managed model ids instead of forcing a built-in list", () => {
    expect(isSupportedGeminiModel("gemini-custom-audio")).toBe(true);
    expect(isSupportedGeminiModel(" ")).toBe(false);
    expect(normalizeTranscriptionModel("custom-model")).toBe("custom-model");
    expect(normalizeTranscriptionModel(" ")).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(normalizeTranscriptionModel("gemini-3.0-flash-preview")).toBe("gemini-3-flash-preview");
    expect(normalizeTranscriptionModelForProvider("gladia", " ")).toBe(DEFAULT_GLADIA_TRANSCRIPTION_MODEL);
    expect(normalizeSummaryModel("gemini", "gemini-3.0-flash-preview")).toBe(
      "gemini-3-flash-preview"
    );
    expect(normalizeSummaryProvider("unknown")).toBe(DEFAULT_SUMMARY_PROVIDER);
    expect(normalizeSummaryModel("gemini", "custom-summary")).toBe("custom-summary");
    expect(normalizeSummaryModel("openrouter", "vendor/model")).toBe("vendor/model");
    expect(normalizeSummaryModel("openrouter", " ")).toBe("qwen/qwen3.6-plus");
    expect(normalizeSummaryProvider("mistral")).toBe("mistral");
    expect(normalizeSummaryModel("mistral", "mistral-large-latest")).toBe("mistral-large-latest");
    expect(normalizeSummaryModel("mistral", " ")).toBe(DEFAULT_MISTRAL_SUMMARY_MODEL);
  });

  it("normalizes legacy retention settings into the two current choices", () => {
    expect(DEFAULT_SETTINGS.retentionMode).toBe("delete_temp");
    expect(normalizeRetentionMode("delete_temp")).toBe("delete_temp");
    expect(normalizeRetentionMode("keep_temp")).toBe("keep_temp");
    expect(normalizeRetentionMode("source")).toBe("keep_temp");
    expect(normalizeRetentionMode("all")).toBe("keep_temp");
    expect(normalizeRetentionMode("none")).toBe("delete_temp");
  });

  it("normalizes, upserts, removes, and exposes catalog options", () => {
    const geminiTranscript = createModelCatalogEntry({
      provider: "gemini",
      purpose: "transcription",
      displayName: "Gemini Audio",
      modelId: "gemini-audio"
    });
    const openRouterSummary = createModelCatalogEntry({
      provider: "openrouter",
      purpose: "summary",
      displayName: "Qwen",
      modelId: "qwen/qwen3.6-plus"
    });
    const gladiaTranscript = createModelCatalogEntry({
      provider: "gladia",
      purpose: "transcription",
      displayName: "Gladia Default",
      modelId: "default"
    });
    const mistralSummary = createModelCatalogEntry({
      provider: "mistral",
      purpose: "summary",
      displayName: "Mistral Small",
      modelId: "mistral-small-latest"
    });

    expect(geminiTranscript).not.toBeNull();
    expect(openRouterSummary).not.toBeNull();
    expect(gladiaTranscript).not.toBeNull();
    expect(mistralSummary).not.toBeNull();

    let catalog = normalizeModelCatalog([
      geminiTranscript,
      gladiaTranscript,
      mistralSummary,
      openRouterSummary,
      { provider: "openrouter", purpose: "transcription", modelId: "bad" },
      { provider: "mistral", purpose: "transcription", modelId: "bad" }
    ]);

    expect(catalog).toHaveLength(4);
    catalog = upsertModelCatalogEntry(catalog, {
      provider: "openrouter",
      purpose: "summary",
      displayName: "Qwen Updated",
      modelId: "qwen/qwen3.6-plus"
    });

    expect(getTranscriptionModelOptions("gemini", catalog).map((option) => option.value)).toEqual([
      "gemini-audio"
    ]);
    expect(getTranscriptionModelOptions("gladia", catalog).map((option) => option.value)).toEqual([
      "default"
    ]);
    expect(getSummaryModelOptions("openrouter", catalog).map((option) => option.label)).toEqual([
      "Qwen Updated"
    ]);
    expect(getSummaryModelOptions("mistral", catalog).map((option) => option.value)).toEqual([
      "mistral-small-latest"
    ]);

    catalog = removeModelCatalogEntry(catalog, {
      provider: "openrouter",
      purpose: "summary",
      modelId: "qwen/qwen3.6-plus"
    });
    expect(getSummaryModelOptions("openrouter", catalog)).toEqual([]);
    expect(getSummaryModelOptions("mistral", catalog).map((option) => option.label)).toEqual([
      "Mistral Small"
    ]);
  });

  it("keeps built-in Gemini transcription models while migrating selected custom models", () => {
    expect(
      ensureSelectedModelsInCatalog([], {
        transcriptionProvider: "gemini",
        transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
        summaryProvider: "gemini",
        summaryModel: DEFAULT_SUMMARY_MODEL
      })
    ).toEqual(DEFAULT_MODEL_CATALOG);

    expect(
      ensureSelectedModelsInCatalog(
        [],
        {
          transcriptionProvider: "gemini",
          transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
          summaryProvider: "gemini",
          summaryModel: DEFAULT_SUMMARY_MODEL
        },
        { includeDefaults: true }
      )
    ).toHaveLength(6);

    expect(
      ensureSelectedModelsInCatalog([], {
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-custom-audio",
        summaryProvider: "gemini",
        summaryModel: DEFAULT_SUMMARY_MODEL
      }).map((entry) => entry.modelId)
    ).toEqual([
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "mistral-small-latest",
      "gemini-custom-audio"
    ]);

    expect(
      ensureSelectedModelsInCatalog(
        [
          {
            provider: "gemini",
            purpose: "summary",
            displayName: "Gemini 3.0 Flash Preview",
            modelId: "gemini-3.0-flash-preview"
          }
        ],
        {
          transcriptionProvider: "gemini",
          transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
          summaryProvider: "gemini",
          summaryModel: "gemini-3.0-flash-preview"
        }
      ).filter((entry) => entry.modelId === "gemini-3-flash-preview")
    ).toHaveLength(2);
  });

  it("keeps Gemini transcription audio-capable validation as a warning boundary", () => {
    const entry = createModelCatalogEntry({
      provider: "gemini",
      purpose: "transcription",
      modelId: "gemini-maybe-audio"
    });

    expect(entry).not.toBeNull();
    expect(getGeminiTranscriptionRiskMessage(entry!)).toContain("audio-capable");
  });
});
