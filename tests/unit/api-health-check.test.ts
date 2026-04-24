import { describe, expect, it, vi } from "vitest";
import { testAiApiAvailability } from "@services/ai/api-health-check";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("api-health-check", () => {
  it("does not call fetch when the API key is empty", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await testAiApiAvailability({
      kind: "transcription",
      provider: "gemini",
      model: "gemini-2.5-flash",
      apiKey: " ",
      fetchImpl
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("API Key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("tests Gemini with the selected model and key", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ candidates: [] }));

    const result = await testAiApiAvailability({
      kind: "summary",
      provider: "gemini",
      model: "gemini-3.1-flash-lite-preview",
      apiKey: "gemini-key",
      fetchImpl
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent"
    );
    expect(String(url)).toContain("key=gemini-key");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8
      }
    });
  });

  it("tests OpenRouter with chat completions", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ choices: [] }));

    const result = await testAiApiAvailability({
      kind: "summary",
      provider: "openrouter",
      model: "qwen/qwen3.6-plus",
      apiKey: "openrouter-key",
      fetchImpl
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer openrouter-key",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "qwen/qwen3.6-plus",
      max_tokens: 8
    });
  });

  it("returns provider error detail on failed requests", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: { message: "API key not valid" } }, 400));

    const result = await testAiApiAvailability({
      kind: "transcription",
      provider: "gemini",
      model: "gemini-2.5-flash",
      apiKey: "bad-key",
      fetchImpl
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("HTTP 400");
    expect(result.message).toContain("API key not valid");
  });
});
