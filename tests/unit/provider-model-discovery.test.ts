import { describe, expect, it } from "vitest";
import {
  mergeManagedModelSuggestions,
  normalizeSummaryModel,
  normalizeTranscriptionModelForProvider,
  searchManagedModelSuggestions
} from "@domain/provider-model-discovery";

describe("provider model discovery", () => {
  it("keeps provider-specific model defaults separate from manual entries", () => {
    expect(normalizeTranscriptionModelForProvider("gladia", " ")).toBe("default");
    expect(normalizeSummaryModel("openrouter", " ")).toBe("qwen/qwen3.6-plus");
    expect(normalizeSummaryModel("mistral", " ")).toBe("mistral-small-latest");
  });

  it("searches local or official provider suggestions with stable ranking", () => {
    const suggestions = [
      { id: "vendor/model-large", name: "Large Model" },
      { id: "vendor/model-small", name: "Small Model" },
      { id: "other/model", name: "Vendor Model" }
    ];

    expect(searchManagedModelSuggestions(suggestions, "vendor/model")).toEqual([
      { id: "vendor/model-large", name: "Large Model" },
      { id: "vendor/model-small", name: "Small Model" }
    ]);
  });

  it("merges local catalog suggestions before official API suggestions", () => {
    expect(
      mergeManagedModelSuggestions(
        [{ id: "vendor/model", name: "Local Display Name" }],
        [
          { id: "vendor/model", name: "Official Display Name" },
          { id: "vendor/new", name: "Official New" }
        ]
      )
    ).toEqual([
      { id: "vendor/model", name: "Local Display Name" },
      { id: "vendor/new", name: "Official New" }
    ]);
  });
});
