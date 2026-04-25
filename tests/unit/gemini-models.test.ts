import { describe, expect, it, vi } from "vitest";
import {
  fetchGeminiModels,
  normalizeGeminiModels,
  searchGeminiModels
} from "@services/ai/gemini-models";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("gemini models", () => {
  it("normalizes the Gemini models API response", () => {
    expect(
      normalizeGeminiModels({
        models: [
          {
            name: "models/gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            supportedGenerationMethods: ["generateContent"]
          },
          {
            name: "models/embedding-001",
            displayName: "Embedding 001",
            supportedGenerationMethods: ["embedContent"]
          },
          {
            name: "models/gemini-2.5-flash",
            displayName: "Duplicate",
            supportedGenerationMethods: ["generateContent"]
          }
        ]
      })
    ).toEqual([{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }]);
  });

  it("fetches Gemini models from the official API", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        models: [
          {
            name: "models/gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            supportedGenerationMethods: ["generateContent"]
          }
        ]
      })
    );

    await expect(fetchGeminiModels({ apiKey: "gemini-key", fetchImpl })).resolves.toEqual([
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }
    ]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("https://generativelanguage.googleapis.com/v1beta/models?key=gemini-key");
    expect(init?.method).toBe("GET");
  });

  it("returns ranked autocomplete matches", () => {
    expect(
      searchGeminiModels(
        [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
          { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
          { id: "imagen-4", name: "Imagen 4" }
        ],
        "gemini-2.5-f"
      ).map((model) => model.id)
    ).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });
});
