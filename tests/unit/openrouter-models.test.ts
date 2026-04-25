import { describe, expect, it, vi } from "vitest";
import {
  fetchOpenRouterModels,
  normalizeOpenRouterModels,
  searchOpenRouterModels,
  syncOpenRouterModelCatalog
} from "@services/ai/openrouter-models";
import type { AiModelCatalogEntry } from "@domain/settings";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("openrouter models", () => {
  it("normalizes the OpenRouter models API response", () => {
    expect(
      normalizeOpenRouterModels({
        data: [
          { id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" },
          { id: "qwen/qwen3.6-plus", name: "Duplicate" },
          { id: "anthropic/claude", name: "" },
          { name: "missing id" }
        ]
      })
    ).toEqual([
      { id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" },
      { id: "anthropic/claude", name: "anthropic/claude" }
    ]);
  });

  it("fetches the official OpenRouter models endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" }]
      })
    );

    await expect(fetchOpenRouterModels({ fetchImpl })).resolves.toEqual([
      { id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" }
    ]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/models");
    expect(init?.method).toBe("GET");
  });

  it("sends the OpenRouter API key when one is available", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }));

    await fetchOpenRouterModels({ apiKey: "openrouter-key", fetchImpl });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer openrouter-key"
    });
  });

  it("returns ranked autocomplete matches for ids and names", () => {
    expect(
      searchOpenRouterModels(
        [
          { id: "nvidia/nemotron-3-super:free", name: "NVIDIA Nemotron 3 Super Free" },
          { id: "meta/llama-3", name: "Llama 3" },
          { id: "openai/gpt-4.1", name: "GPT-4.1" }
        ],
        "nvid"
      )
    ).toEqual([{ id: "nvidia/nemotron-3-super:free", name: "NVIDIA Nemotron 3 Super Free" }]);
  });

  it("updates stale OpenRouter display names by model id", () => {
    const catalog: AiModelCatalogEntry[] = [
      {
        provider: "openrouter",
        purpose: "summary",
        displayName: "Old Name",
        modelId: "qwen/qwen3.6-plus"
      }
    ];

    const result = syncOpenRouterModelCatalog(
      catalog,
      [{ id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" }],
      new Date("2026-04-25T00:00:00.000Z")
    );

    expect(result.catalog[0]).toMatchObject({
      displayName: "Qwen 3.6 Plus",
      modelId: "qwen/qwen3.6-plus",
      source: "openrouter",
      updatedAt: "2026-04-25T00:00:00.000Z"
    });
    expect(result.messages[0]).toContain("Updated OpenRouter model name");
  });

  it("corrects OpenRouter model ids when the display name matches", () => {
    const catalog: AiModelCatalogEntry[] = [
      {
        provider: "openrouter",
        purpose: "summary",
        displayName: "Qwen 3.6 Plus",
        modelId: "qwen/old-id"
      }
    ];

    const result = syncOpenRouterModelCatalog(
      catalog,
      [{ id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" }],
      new Date("2026-04-25T00:00:00.000Z")
    );

    expect(result.catalog).toEqual([
      {
        provider: "openrouter",
        purpose: "summary",
        displayName: "Qwen 3.6 Plus",
        modelId: "qwen/qwen3.6-plus",
        source: "openrouter",
        updatedAt: "2026-04-25T00:00:00.000Z"
      }
    ]);
    expect(result.messages[0]).toContain("Corrected OpenRouter model id");
  });
});
