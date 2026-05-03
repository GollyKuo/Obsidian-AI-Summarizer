import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CATALOG } from "@domain/settings";
import {
  getLocalManagedModelSuggestions,
  mergeManagedModelSuggestions,
  searchManagedModelSuggestions
} from "@ui/model-autocomplete";

describe("model autocomplete", () => {
  it("uses local catalog entries for Mistral suggestions without requiring a models API response", () => {
    const suggestions = getLocalManagedModelSuggestions(
      DEFAULT_MODEL_CATALOG,
      "mistral",
      "summary",
      "mistral-small-latest"
    );

    expect(searchManagedModelSuggestions(suggestions, "mis")).toEqual([
      { id: "mistral-small-latest", name: "mistral-small-latest" }
    ]);
  });

  it("adds the current selected model as a local autocomplete candidate", () => {
    const suggestions = getLocalManagedModelSuggestions([], "gladia", "transcription", "default");

    expect(searchManagedModelSuggestions(suggestions, "def")).toEqual([
      { id: "default", name: "Current: default" }
    ]);
  });

  it("merges local and official suggestions without duplicating model ids", () => {
    expect(
      mergeManagedModelSuggestions(
        [{ id: "mistral-small-latest", name: "Mistral Small" }],
        [
          { id: "mistral-small-latest", name: "Mistral Small Official" },
          { id: "mistral-large-latest", name: "Mistral Large" }
        ]
      )
    ).toEqual([
      { id: "mistral-small-latest", name: "Mistral Small" },
      { id: "mistral-large-latest", name: "Mistral Large" }
    ]);
  });
});
