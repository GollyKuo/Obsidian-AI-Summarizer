import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_CATALOG,
  DEFAULT_SUMMARY_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
  createModelCatalogEntry,
  ensureSelectedModelsInCatalog,
  getModelCatalogOptions,
  normalizeModelCatalog
} from "@domain/model-selection";

describe("model catalog", () => {
  it("normalizes entries and rejects unsupported provider-purpose pairs", () => {
    expect(
      normalizeModelCatalog([
        {
          provider: "openrouter",
          purpose: "summary",
          displayName: "Qwen",
          modelId: "qwen/model",
          source: "openrouter"
        },
        {
          provider: "openrouter",
          purpose: "transcription",
          displayName: "Invalid",
          modelId: "bad"
        },
        {
          provider: "mistral",
          purpose: "transcription",
          displayName: "Invalid",
          modelId: "bad"
        },
        {
          provider: "gladia",
          purpose: "summary",
          displayName: "Invalid",
          modelId: "bad"
        }
      ])
    ).toEqual([
      {
        provider: "openrouter",
        purpose: "summary",
        displayName: "Qwen",
        modelId: "qwen/model",
        source: "openrouter"
      }
    ]);
  });

  it("keeps selected custom models available as fallback options", () => {
    const options = getModelCatalogOptions([], "gladia", "transcription", "default");

    expect(options).toEqual([
      {
        value: "default",
        label: "Current: default",
        description: "Current saved model. Add it to the model list to manage its display name."
      }
    ]);
  });

  it("merges defaults with selected models without duplicating existing defaults", () => {
    const catalog = ensureSelectedModelsInCatalog([], {
      transcriptionProvider: "gemini",
      transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
      summaryProvider: "gemini",
      summaryModel: DEFAULT_SUMMARY_MODEL
    });

    expect(catalog).toEqual(DEFAULT_MODEL_CATALOG);

    const customCatalog = ensureSelectedModelsInCatalog([], {
      transcriptionProvider: "gladia",
      transcriptionModel: "default",
      summaryProvider: "openrouter",
      summaryModel: "vendor/model"
    });

    expect(customCatalog.map((entry) => `${entry.provider}:${entry.purpose}:${entry.modelId}`)).toContain(
      "gladia:transcription:default"
    );
    expect(customCatalog.map((entry) => `${entry.provider}:${entry.purpose}:${entry.modelId}`)).toContain(
      "openrouter:summary:vendor/model"
    );
  });

  it("normalizes manual entries through the same provider-purpose compatibility rules", () => {
    expect(
      createModelCatalogEntry({
        provider: "gladia",
        purpose: "summary",
        modelId: "bad"
      })
    ).toBeNull();

    expect(
      createModelCatalogEntry({
        provider: "gladia",
        purpose: "transcription",
        modelId: "default"
      })
    ).toMatchObject({
      provider: "gladia",
      purpose: "transcription",
      modelId: "default"
    });
  });
});
