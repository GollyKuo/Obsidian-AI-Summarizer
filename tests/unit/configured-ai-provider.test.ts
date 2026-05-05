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

  it("redacts provider secrets from thrown errors and diagnostics", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: "API key AIzaSySecretValue12345 is invalid"
          },
          token: "sk-secretToken123"
        },
        401
      )
    );
    const provider = createConfiguredSummaryProvider(
      {
        ...DEFAULT_SETTINGS,
        apiKey: "gemini-key"
      },
      { fetchImpl }
    );

    await expect(
      provider.summarizeWebpage(
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
      )
    ).rejects.toMatchObject({
      category: "ai_failure",
      message: expect.stringContaining("[REDACTED_API_KEY]"),
      causeValue: expect.objectContaining({
        providerError: expect.not.stringContaining("AIzaSySecretValue12345"),
        bodyExcerpt: expect.not.stringContaining("sk-secretToken123")
      })
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
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "inline_chunks"
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

  it("transcribes Gemini audio with Files API in auto strategy and deletes the remote file", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.ogg");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response("", {
            status: 200,
            headers: {
              "x-goog-upload-url": "https://upload.example/session-1"
            }
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            file: {
              name: "files/audio-1",
              uri: "https://generativelanguage.googleapis.com/v1beta/files/audio-1",
              mimeType: "audio/ogg",
              state: "ACTIVE"
            }
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: "{00:00:00-00:00:01} file api transcript" }] } }]
          })
        )
        .mockResolvedValueOnce(new Response("", { status: 200 }));
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "auto"
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

      expect(result.transcriptMarkdown).toContain("file api transcript");
      expect(result.warnings).toContain(
        "Gemini Files API transcription completed 1 AI upload artifact(s)."
      );
      expect(fetchImpl).toHaveBeenCalledTimes(4);
      expect(fetchImpl.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/upload/v1beta/files");
      expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
        "x-goog-api-key": "gemini-key",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Type": "audio/ogg"
      });
      expect(fetchImpl.mock.calls[1][0]).toBe("https://upload.example/session-1");
      const generateBody = JSON.parse(String(fetchImpl.mock.calls[2][1]?.body));
      expect(generateBody.contents[0].parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file_data: {
              mime_type: "audio/ogg",
              file_uri: "https://generativelanguage.googleapis.com/v1beta/files/audio-1"
            }
          })
        ])
      );
      expect(fetchImpl.mock.calls[3][0]).toBe("https://generativelanguage.googleapis.com/v1beta/files/audio-1");
      expect(fetchImpl.mock.calls[3][1]?.method).toBe("DELETE");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("falls back to Gemini inline chunks when Files API fails in auto strategy", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.ogg");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                message: "Files API unavailable"
              }
            },
            503
          )
        )
        .mockResolvedValueOnce(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: "{00:00:00-00:00:01} inline fallback" }] } }]
          })
        );
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "auto"
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

      expect(result.transcriptMarkdown).toContain("inline fallback");
      expect(result.warnings[0]).toContain("fell back to inline chunk transcription");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(String(fetchImpl.mock.calls[1][0])).toContain("gemini-2.5-flash:generateContent");
      const inlineBody = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
      expect(inlineBody.contents[0].parts).toEqual(
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

  it("preserves Gemini Files API failure context when inline fallback also fails", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.ogg");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                message: "Files API unavailable"
              }
            },
            503
          )
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                message: "Inline model overloaded"
              }
            },
            503
          )
        );
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "auto"
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
        message: expect.stringContaining("Gemini Files API transcription failed: Gemini Files API upload start failed"),
        causeValue: expect.objectContaining({
          provider: "Gemini",
          failureKind: "files_api_fallback_inline_failed",
          filesApiErrorMessage: expect.stringContaining("Files API unavailable"),
          inlineErrorMessage: expect.stringContaining("Inline model overloaded")
        })
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("applies a configurable Gemini transcription request timeout", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const audioPath = path.join(tempDirectory, "ai-upload.ogg");
    await writeFile(audioPath, Buffer.from("audio"));

    try {
      let callCount = 0;
      const fetchImpl = vi.fn<typeof fetch>(async (_, init) => {
        callCount += 1;
        if (callCount === 1) {
          return new Response("", {
            status: 200,
            headers: {
              "x-goog-upload-url": "https://upload.example/session-1"
            }
          });
        }
        if (callCount === 2) {
          return jsonResponse({
            file: {
              name: "files/audio-1",
              uri: "https://generativelanguage.googleapis.com/v1beta/files/audio-1",
              mimeType: "audio/ogg",
              state: "ACTIVE"
            }
          });
        }
        if (callCount === 3) {
          return await new Promise<Response>((_, reject) => {
            const requestSignal = init?.signal;
            if (requestSignal instanceof AbortSignal) {
              requestSignal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
            }
          });
        }
        return new Response("", { status: 200 });
      });
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "files_api"
        },
        {
          fetchImpl,
          geminiTranscriptionRequestTimeoutMs: 5
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
            transcriptionProvider: "gemini",
            transcriptionModel: "gemini-2.5-flash"
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        category: "ai_failure",
        message: "AI request timed out."
      });
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("transcribes Gemini AI upload chunks with separate requests and merges transcripts", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const firstAudioPath = path.join(tempDirectory, "chunk-0000.ogg");
    const secondAudioPath = path.join(tempDirectory, "chunk-0001.ogg");
    await writeFile(firstAudioPath, Buffer.from("first-audio"));
    await writeFile(secondAudioPath, Buffer.from("second-audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: "{00:00:00-00:00:01} first chunk" }] } }]
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: "{00:00:01-00:00:02} second chunk" }] } }]
          })
        );
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "inline_chunks"
        },
        { fetchImpl }
      );

      const result = await provider.transcribeMedia(
        {
          metadata: {
            title: "Media",
            creatorOrAuthor: "Creator",
            platform: "Local File",
            source: firstAudioPath,
            created: "2026-04-25T00:00:00.000Z"
          },
          normalizedText: "",
          transcript: [],
          aiUploadArtifactPaths: [firstAudioPath, secondAudioPath],
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash"
        },
        new AbortController().signal
      );

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(result.transcriptMarkdown).toContain("first chunk");
      expect(result.transcriptMarkdown).toContain("second chunk");
      expect(result.transcript).toHaveLength(2);
      expect(result.warnings).toContain(
        "Gemini transcription completed 2 AI upload artifact chunks with separate requests."
      );

      const firstBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
      const secondBody = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
      expect(firstBody.contents[0].parts.filter((part: unknown) => "inline_data" in (part as object))).toHaveLength(1);
      expect(secondBody.contents[0].parts.filter((part: unknown) => "inline_data" in (part as object))).toHaveLength(1);
      expect(firstBody.contents[0].parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            inline_data: {
              mime_type: "audio/ogg",
              data: Buffer.from("first-audio").toString("base64")
            }
          })
        ])
      );
      expect(secondBody.contents[0].parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            inline_data: {
              mime_type: "audio/ogg",
              data: Buffer.from("second-audio").toString("base64")
            }
          })
        ])
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("reports Gemini chunk transcription failures with partial transcript diagnostics", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "configured-ai-provider-"));
    const firstAudioPath = path.join(tempDirectory, "chunk-0000.ogg");
    const secondAudioPath = path.join(tempDirectory, "chunk-0001.ogg");
    await writeFile(firstAudioPath, Buffer.from("first-audio"));
    await writeFile(secondAudioPath, Buffer.from("second-audio"));

    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: "{00:00:00-00:00:01} first chunk" }] } }]
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                message: "Gemini quota exhausted"
              }
            },
            429
          )
        );
      const provider = createConfiguredTranscriptionProvider(
        {
          ...DEFAULT_SETTINGS,
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "inline_chunks"
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
              source: firstAudioPath,
              created: "2026-04-25T00:00:00.000Z"
            },
            normalizedText: "",
            transcript: [],
            aiUploadArtifactPaths: [firstAudioPath, secondAudioPath],
            transcriptionProvider: "gemini",
            transcriptionModel: "gemini-2.5-flash"
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        category: "ai_failure",
        message: expect.stringContaining("Gemini transcription failed for AI upload chunk 2/2"),
        causeValue: expect.objectContaining({
          provider: "Gemini",
          failureKind: "chunk_transcription_failed",
          failedChunkIndex: 1,
          totalChunks: 2,
          completedChunkCount: 1,
          partialTranscriptMarkdown: expect.stringContaining("first chunk")
        })
      } satisfies Partial<SummarizerError>);

      expect(fetchImpl).toHaveBeenCalledTimes(2);
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
          apiKey: "gemini-key",
          geminiTranscriptionStrategy: "inline_chunks"
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
