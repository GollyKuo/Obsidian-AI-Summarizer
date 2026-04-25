import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
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
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel,
  removeModelCatalogEntry,
  upsertModelCatalogEntry
} from "@domain/settings";

describe("settings", () => {
  it("does not preload built-in model options into the user catalog", () => {
    expect(DEFAULT_SETTINGS.transcriptionProvider).toBe(DEFAULT_TRANSCRIPTION_PROVIDER);
    expect(DEFAULT_SETTINGS.transcriptionModel).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(DEFAULT_SETTINGS.summaryProvider).toBe(DEFAULT_SUMMARY_PROVIDER);
    expect(DEFAULT_SETTINGS.summaryModel).toBe(DEFAULT_SUMMARY_MODEL);
    expect(DEFAULT_SETTINGS.summaryModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(DEFAULT_SETTINGS.modelCatalog).toEqual([]);
    expect(DEFAULT_MODEL_CATALOG).toEqual([]);
    expect(GEMINI_MODEL_OPTIONS).toEqual([]);
    expect(OPENROUTER_SUMMARY_MODEL_OPTIONS).toEqual([]);
  });

  it("keeps arbitrary user-managed model ids instead of forcing a built-in list", () => {
    expect(isSupportedGeminiModel("gemini-custom-audio")).toBe(true);
    expect(isSupportedGeminiModel(" ")).toBe(false);
    expect(normalizeTranscriptionModel("custom-model")).toBe("custom-model");
    expect(normalizeTranscriptionModel(" ")).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(normalizeSummaryProvider("unknown")).toBe(DEFAULT_SUMMARY_PROVIDER);
    expect(normalizeSummaryModel("gemini", "custom-summary")).toBe("custom-summary");
    expect(normalizeSummaryModel("openrouter", "vendor/model")).toBe("vendor/model");
    expect(normalizeSummaryModel("openrouter", " ")).toBe("qwen/qwen3.6-plus");
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

    expect(geminiTranscript).not.toBeNull();
    expect(openRouterSummary).not.toBeNull();

    let catalog = normalizeModelCatalog([
      geminiTranscript,
      openRouterSummary,
      { provider: "openrouter", purpose: "transcription", modelId: "bad" }
    ]);

    expect(catalog).toHaveLength(2);
    catalog = upsertModelCatalogEntry(catalog, {
      provider: "openrouter",
      purpose: "summary",
      displayName: "Qwen Updated",
      modelId: "qwen/qwen3.6-plus"
    });

    expect(getTranscriptionModelOptions("gemini", catalog).map((option) => option.value)).toEqual([
      "gemini-audio"
    ]);
    expect(getSummaryModelOptions("openrouter", catalog).map((option) => option.label)).toEqual([
      "Qwen Updated"
    ]);

    catalog = removeModelCatalogEntry(catalog, {
      provider: "openrouter",
      purpose: "summary",
      modelId: "qwen/qwen3.6-plus"
    });
    expect(getSummaryModelOptions("openrouter", catalog)).toEqual([]);
  });

  it("can migrate saved selected models into the catalog without doing that for defaults", () => {
    expect(
      ensureSelectedModelsInCatalog([], {
        transcriptionProvider: "gemini",
        transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
        summaryProvider: "gemini",
        summaryModel: DEFAULT_SUMMARY_MODEL
      })
    ).toEqual([]);

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
