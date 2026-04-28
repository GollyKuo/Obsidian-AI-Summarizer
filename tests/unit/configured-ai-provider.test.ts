import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@domain/settings";
import {
  createConfiguredSummaryProvider,
  createConfiguredTranscriptionProvider
} from "@services/ai/configured-ai-provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("configured AI providers", () => {
  it("summarizes webpages with Gemini generateContent", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "## Summary\n\nGemini summary" }] } }]
      })
    );
    const provider = createConfiguredSummaryProvider(
      {
        ...DEFAULT_SETTINGS,
        apiKey: "gemini-key"
      },
      { fetchImpl }
    );

    const result = await provider.summarizeWebpage(
      {
        metadata: {
          title: "Article",
          creatorOrAuthor: "Author",
          platform: "Web",
          source: "https://example.com",
          created: "2026-04-25T00:00:00.000Z"
        },
        webpageText: "Article body",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      new AbortController().signal
    );

    expect(result.summaryMarkdown).toContain("Gemini summary");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("gemini-2.5-flash:generateContent");
    expect(String(url)).toContain("key=gemini-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      contents: [
        {
          role: "user"
        }
      ]
    });
  });

  it("summarizes media with OpenRouter chat completions", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "## Summary\n\nOpenRouter summary" } }]
      })
    );
    const provider = createConfiguredSummaryProvider(
      {
        ...DEFAULT_SETTINGS,
        openRouterApiKey: "openrouter-key"
      },
      { fetchImpl }
    );

    const result = await provider.summarizeMedia(
      {
        metadata: {
          title: "Media",
          creatorOrAuthor: "Creator",
          platform: "YouTube",
          source: "https://youtube.example/demo",
          created: "2026-04-25T00:00:00.000Z"
        },
        normalizedText: "normalized",
        transcript: [{ startMs: 0, endMs: 1000, text: "hello" }],
        summaryProvider: "openrouter",
        summaryModel: "qwen/qwen3.6-plus"
      },
      new AbortController().signal
    );

    expect(result.summaryMarkdown).toContain("OpenRouter summary");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer openrouter-key"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "qwen/qwen3.6-plus"
    });
  });

  it("uses existing transcript segments without calling Gemini transcription", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = createConfiguredTranscriptionProvider(
      {
        ...DEFAULT_SETTINGS,
        apiKey: "gemini-key"
      },
      { fetchImpl }
    );

    const result = await provider.transcribeMedia(
      {
        metadata: {
          title: "Media",
          creatorOrAuthor: "Creator",
          platform: "Local File",
          source: "D:\\media\\demo.mp3",
          created: "2026-04-25T00:00:00.000Z"
        },
        normalizedText: "",
        transcript: [{ startMs: 0, endMs: 1000, text: "hello" }],
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash"
      },
      new AbortController().signal
    );

    expect(result.transcriptMarkdown).toContain("hello");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails media transcription when no transcript or AI upload artifact is available", async () => {
    const provider = createConfiguredTranscriptionProvider({
      ...DEFAULT_SETTINGS,
      apiKey: "gemini-key"
    });

    await expect(
      provider.transcribeMedia(
        {
          metadata: {
            title: "Media",
            creatorOrAuthor: "Creator",
            platform: "Local File",
            source: "D:\\media\\demo.mp3",
            created: "2026-04-25T00:00:00.000Z"
          },
          normalizedText: "",
          transcript: [],
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash"
        },
        new AbortController().signal
      )
    ).rejects.toThrow(/AI-ready audio artifacts/);
  });

  it("transcribes AI upload artifacts as Gemini inline audio data", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.ogg");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: "{00:00:00-00:00:01} hello" }] } }]
        })
      );
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key"
        },
        { fetchImpl }
      );

      const result = await provider.transcribeMedia(
        {
          metadata: {
            title: "Media",
            creatorOrAuthor: "Creator",
            platform: "Local File",
            source: audioPath,
            created: "2026-04-25T00:00:00.000Z"
          },
          normalizedText: "",
          transcript: [],
          aiUploadArtifactPaths: [audioPath],
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash"
        },
        new AbortController().signal
      );

      expect(result.transcriptMarkdown).toContain("hello");
      const [, init] = fetchImpl.mock.calls[0];
      const body = JSON.parse(String(init?.body));
      expect(body.contents[0].parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            inline_data: {
              mime_type: "audio/ogg",
              data: Buffer.from("audio").toString("base64")
            }
          })
        ])
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
