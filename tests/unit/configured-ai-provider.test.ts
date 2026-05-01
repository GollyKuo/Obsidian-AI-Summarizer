import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SummarizerError } from "@domain/errors";
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

  it("summarizes webpages with Mistral chat completions", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "## Summary\n\nMistral summary" } }]
      })
    );
    const provider = createConfiguredSummaryProvider(
      {
        ...DEFAULT_SETTINGS,
        mistralApiKey: "mistral-key"
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
        summaryProvider: "mistral",
        summaryModel: "mistral-small-latest"
      },
      new AbortController().signal
    );

    expect(result.summaryMarkdown).toContain("Mistral summary");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer mistral-key",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "mistral-small-latest",
      messages: [{ role: "user" }],
      temperature: 0.2
    });
  });

  it("reports OpenRouter empty output with response diagnostics", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { role: "assistant" } }]
      })
    );
    const provider = createConfiguredSummaryProvider(
      {
        ...DEFAULT_SETTINGS,
        openRouterApiKey: "openrouter-key"
      },
      { fetchImpl }
    );

    await expect(
      provider.summarizeMedia(
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
      )
    ).rejects.toMatchObject({
      category: "ai_failure",
      message: expect.stringContaining("OpenRouter response did not include text output"),
      causeValue: expect.objectContaining({
        provider: "OpenRouter",
        failureKind: "empty_output",
        responseShape: expect.objectContaining({
          choiceCount: 1,
          contentType: "undefined"
        })
      })
    } satisfies Partial<SummarizerError>);
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

  it("reports Gemini transcription capacity errors without retrying another model", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.ogg");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              message:
                "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
            }
          },
          503
        )
      );
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key"
        },
        { fetchImpl }
      );

      await expect(
        provider.transcribeMedia(
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
        )
      ).rejects.toMatchObject({
        category: "ai_failure",
        message: expect.stringContaining("HTTP 503")
      });

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(String(fetchImpl.mock.calls[0][0])).toContain("gemini-2.5-flash:generateContent");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("transcribes AI upload artifacts with Gladia pre-recorded polling", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.wav");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse({
            audio_url: "https://api.gladia.io/file/audio-1",
            audio_metadata: {
              id: "audio-1",
              filename: "ai-upload.wav",
              size: 5,
              audio_duration: 1
            }
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              id: "job-1",
              result_url: "https://api.gladia.io/v2/pre-recorded/job-1"
            },
            201
          )
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: "job-1",
            request_id: "G-job-1",
            status: "queued",
            result: null
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: "job-1",
            request_id: "G-job-1",
            status: "done",
            result: {
              transcription: {
                full_transcript: "hello from Gladia",
                utterances: [{ start: 0, end: 1.25, text: "hello from Gladia" }]
              }
            }
          })
        );

      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          gladiaApiKey: "gladia-key"
        },
        {
          fetchImpl,
          gladiaPollIntervalMs: 1,
          gladiaMaxPollingMs: 100
        }
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
          transcriptionProvider: "gladia",
          transcriptionModel: "default"
        },
        new AbortController().signal
      );

      expect(result.transcriptMarkdown).toContain("hello from Gladia");
      expect(result.transcript[0]).toMatchObject({
        startMs: 0,
        endMs: 1250,
        text: "hello from Gladia"
      });
      expect(fetchImpl).toHaveBeenCalledTimes(4);
      expect(fetchImpl.mock.calls[0][0]).toBe("https://api.gladia.io/v2/upload");
      expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
        "x-gladia-key": "gladia-key"
      });
      expect(fetchImpl.mock.calls[1][0]).toBe("https://api.gladia.io/v2/pre-recorded");
      expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toMatchObject({
        audio_url: "https://api.gladia.io/file/audio-1",
        callback: false,
        summarization: false
      });
      expect(fetchImpl.mock.calls[2][0]).toBe("https://api.gladia.io/v2/pre-recorded/job-1");
      expect(fetchImpl.mock.calls[3][0]).toBe("https://api.gladia.io/v2/pre-recorded/job-1");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("reports Gladia empty transcription output with diagnostics", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.wav");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ audio_url: "https://api.gladia.io/file/audio-1" }))
        .mockResolvedValueOnce(jsonResponse({ id: "job-1" }, 201))
        .mockResolvedValueOnce(
          jsonResponse({
            id: "job-1",
            request_id: "G-job-1",
            status: "done",
            result: {
              transcription: {
                full_transcript: "",
                utterances: []
              }
            }
          })
        );

      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          gladiaApiKey: "gladia-key"
        },
        {
          fetchImpl,
          gladiaPollIntervalMs: 1,
          gladiaMaxPollingMs: 100
        }
      );

      await expect(
        provider.transcribeMedia(
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
            transcriptionProvider: "gladia",
            transcriptionModel: "default"
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        category: "ai_failure",
        message: expect.stringContaining("Gladia transcription result did not include transcript text"),
        causeValue: expect.objectContaining({
          provider: "Gladia",
          failureKind: "empty_output",
          jobId: "job-1",
          requestId: "G-job-1",
          utteranceCount: 0
        })
      } satisfies Partial<SummarizerError>);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
