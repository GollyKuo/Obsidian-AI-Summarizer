import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_SUMMARY_PROVIDER,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  DEFAULT_SETTINGS,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_SUMMARY_MODEL_OPTIONS,
  getSummaryModelOptions,
  isSupportedGeminiModel,
  normalizeSummaryModel,
  normalizeSummaryProvider,
  normalizeTranscriptionModel
} from "@domain/settings";

describe("settings", () => {
  it("exposes the recommended provider/model defaults", () => {
    expect(DEFAULT_SETTINGS.transcriptionProvider).toBe(DEFAULT_TRANSCRIPTION_PROVIDER);
    expect(DEFAULT_SETTINGS.transcriptionModel).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(DEFAULT_SETTINGS.summaryProvider).toBe(DEFAULT_SUMMARY_PROVIDER);
    expect(DEFAULT_SETTINGS.summaryModel).toBe(DEFAULT_SUMMARY_MODEL);
    expect(DEFAULT_SETTINGS.summaryModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(GEMINI_MODEL_OPTIONS.map((option) => option.value)).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ]);
    expect(OPENROUTER_SUMMARY_MODEL_OPTIONS.map((option) => option.value)).toEqual([
      "qwen/qwen3.6-plus"
    ]);
  });

  it("normalizes unsupported saved models to provider-specific defaults", () => {
    expect(isSupportedGeminiModel("gemini-3-flash-preview")).toBe(true);
    expect(isSupportedGeminiModel("custom-model")).toBe(false);
    expect(normalizeTranscriptionModel("custom-model")).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(normalizeSummaryProvider("unknown")).toBe(DEFAULT_SUMMARY_PROVIDER);
    expect(normalizeSummaryModel("gemini", "custom-model")).toBe(DEFAULT_GEMINI_MODEL);
    expect(normalizeSummaryModel("openrouter", "custom-model")).toBe("qwen/qwen3.6-plus");
    expect(getSummaryModelOptions("openrouter")).toEqual(OPENROUTER_SUMMARY_MODEL_OPTIONS);
  });
});
