import { describe, expect, it, vi } from "vitest";
import {
  fetchMistralModels,
  normalizeMistralModels,
  searchMistralModels
} from "@services/ai/mistral-models";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("mistral models", () => {
  it("normalizes chat-capable Mistral models and aliases", () => {
    expect(
      normalizeMistralModels([
        {
          id: "mistral-small-latest",
          name: "Mistral Small",
          aliases: ["mistral-small-2603"],
          capabilities: { completion_chat: true }
        },
        {
          id: "codestral-embed",
          name: "Codestral Embed",
          capabilities: { completion_chat: false }
        },
        {
          id: "archived-model",
          capabilities: { completion_chat: true },
          archived: true
        },
        { name: "missing id" }
      ])
    ).toEqual([
      { id: "mistral-small-latest", name: "Mistral Small" },
      { id: "mistral-small-2603", name: "Mistral Small" }
    ]);
  });

  it("fetches the authenticated Mistral models endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: "mistral-large-latest", name: "Mistral Large", capabilities: { completion_chat: true } }]
      })
    );

    await expect(fetchMistralModels({ apiKey: "mistral-key", fetchImpl })).resolves.toEqual([
      { id: "mistral-large-latest", name: "Mistral Large" }
    ]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.mistral.ai/v1/models");
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer mistral-key"
    });
  });

  it("returns ranked autocomplete matches for ids and names", () => {
    expect(
      searchMistralModels(
        [
          { id: "mistral-small-latest", name: "Mistral Small" },
          { id: "mistral-large-latest", name: "Mistral Large" },
          { id: "codestral-latest", name: "Codestral" }
        ],
        "large"
      )
    ).toEqual([{ id: "mistral-large-latest", name: "Mistral Large" }]);
  });
});
