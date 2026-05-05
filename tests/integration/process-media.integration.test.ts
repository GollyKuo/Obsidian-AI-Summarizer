import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SummarizerError } from "@domain/errors";
import { processMedia } from "@orchestration/process-media";
import type { MediaSummaryInput } from "@domain/types";
import type { RuntimeProvider } from "@runtime/runtime-provider";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";
import type { TranscriptionProvider } from "@services/ai/transcription-provider";

describe("processMedia integration", () => {
  it("runs media_url pipeline: runtime -> summary -> note", async () => {
    const stages: string[] = [];
    const warnings: string[] = [];
    let mediaUrlCallCount = 0;
    let localMediaCallCount = 0;

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        mediaUrlCallCount += 1;
        return {
          metadata: {
            title: "Media URL Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=demo",
            created: "2026-04-23T00:00:00.000Z"
          },
          normalizedText: "ai-ready artifact text",
          transcript: [],
          warnings: ["runtime-warning"]
        };
      },
      async processLocalMedia() {
        localMediaCallCount += 1;
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia() {
        return {
          transcript: [],
          transcriptMarkdown: "No transcript",
          warnings: ["transcription-warning"]
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        return {
          summaryMarkdown: "# Summary\n\nMedia URL summary",
          warnings: ["ai-warning"]
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        return {
          notePath: "Summaries/Media URL Demo.md",
          createdAt: "2026-04-23T00:00:00.000Z",
          warnings: ["write-warning"]
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=demo",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp",
        mediaCompressionProfile: "balanced"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal,
      {
        onStageChange: (status, message) => {
          stages.push(`${status}:${message}`);
        },
        onWarning: (warning) => {
          warnings.push(warning);
        }
      }
    );

    expect(mediaUrlCallCount).toBe(1);
    expect(localMediaCallCount).toBe(0);
    expect(result.summary.summaryMarkdown).toContain("Media URL summary");
    expect(result.writeResult.notePath).toBe("Summaries/Media URL Demo.md");
    expect(result.warnings).toContain("runtime-warning");
    expect(result.warnings).toContain("transcription-warning");
    expect(result.warnings).toContain("ai-warning");
    expect(result.warnings).toContain("write-warning");
    expect(
      result.warnings.some((warning) => warning.includes("AI output contract: normalized summary heading"))
    ).toBe(true);
    expect(warnings).toEqual(result.warnings);
    expect(stages).toEqual([
      "validating:Validating media input",
      "acquiring:Processing media URL input",
      "transcribing:Generating media transcript",
      "summarizing:Generating media summary",
      "writing:Writing media note into vault"
    ]);
  });

  it("normalizes fenced YAML summary output before writing the media note", async () => {
    let capturedSummaryMarkdown = "";
    let capturedDescription = "";

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Agentic Workflow Demo",
            creatorOrAuthor: "Gary Chen",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=demo",
            created: "2026-05-04T00:00:00.000Z"
          },
          normalizedText: "ai-ready artifact text",
          transcript: [],
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia() {
        return {
          transcript: [],
          transcriptMarkdown: "{0-1000} transcript",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        return {
          summaryMarkdown: [
            "```yaml",
            "---",
            'Book: ""',
            'Author: ""',
            'Description: "Agentic workflow course summary"',
            "---",
            "## 一、大型語言模型的限制與強化方向",
            "LLM 可以透過 RAG、Fine-tuning 與 Agentic Workflow 補強。"
          ].join("\n"),
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote(input) {
        capturedSummaryMarkdown = input.summaryMarkdown;
        capturedDescription = input.summaryMetadata?.description ?? "";
        return {
          notePath: "Summaries/Agentic Workflow Demo.md",
          createdAt: "2026-05-04T00:00:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=demo",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal
    );

    expect(capturedSummaryMarkdown).toBe(
      "## 一、大型語言模型的限制與強化方向\nLLM 可以透過 RAG、Fine-tuning 與 Agentic Workflow 補強。"
    );
    expect(capturedSummaryMarkdown).not.toContain("```");
    expect(capturedSummaryMarkdown).not.toContain("Book:");
    expect(capturedDescription).toBe("Agentic workflow course summary");
    expect(result.warnings.some((warning) => warning.includes("removed code fence"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("extracted summary metadata block"))).toBe(true);
  });

  it("runs local_media pipeline: runtime -> summary -> note", async () => {
    let mediaUrlCallCount = 0;
    let localMediaCallCount = 0;

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        mediaUrlCallCount += 1;
        throw new Error("should not execute");
      },
      async processLocalMedia() {
        localMediaCallCount += 1;
        return {
          metadata: {
            title: "Local Demo",
            creatorOrAuthor: "Local User",
            platform: "Local File",
            source: "D:\\source\\demo.mp3",
            created: "2026-04-23T00:00:00.000Z"
          },
          normalizedText: "local ai-ready artifact text",
          transcript: [],
          warnings: []
        };
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia() {
        return {
          transcript: [],
          transcriptMarkdown: "No transcript",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia() {
        return {
          summaryMarkdown: "# Summary\n\nLocal summary",
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        return {
          notePath: "Summaries/Local Demo.md",
          createdAt: "2026-04-23T00:00:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "local_media",
        sourceValue: "D:\\source\\demo.mp3",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp",
        mediaCompressionProfile: "balanced"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal
    );

    expect(mediaUrlCallCount).toBe(0);
    expect(localMediaCallCount).toBe(1);
    expect(result.writeResult.notePath).toBe("Summaries/Local Demo.md");
    expect(
      result.warnings.some((warning) => warning.includes("AI output contract: normalized summary heading"))
    ).toBe(true);
  });

  it("cleans transcript before summary and preserves the raw transcript artifact", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "ai-summarizer-cleanup-"));
    try {
      const transcriptPath = path.join(tempDirectory, "transcript.md");
      const subtitlePath = path.join(tempDirectory, "subtitles.srt");
      const metadataPath = path.join(tempDirectory, "metadata.json");
      const aiUploadDirectory = path.join(tempDirectory, "ai-upload");
      await mkdir(aiUploadDirectory, { recursive: true });
      await writeFile(
        metadataPath,
        JSON.stringify({
          sessionId: "cleanup-demo",
          sourceType: "media_url",
          title: "Cleanup Demo",
          creatorOrAuthor: "Demo",
          platform: "YouTube",
          createdAt: "2026-05-05T00:00:00.000Z",
          originalFilename: "source.mp3",
          downloadedPath: path.join(tempDirectory, "source.mp3"),
          sourceArtifactPath: path.join(tempDirectory, "source.mp3"),
          normalizedAudioPath: path.join(tempDirectory, "normalized.wav"),
          transcriptPath,
          subtitlePath,
          derivedArtifactPaths: [],
          uploadArtifactPaths: [],
          chunkCount: 0,
          chunkDurationsMs: [],
          vadApplied: false,
          selectedCodec: null,
          warnings: []
        }),
        "utf8"
      );

      const capturedSummaryInputs: MediaSummaryInput[] = [];
      const capturedNoteInputs: string[] = [];
      const stageMessages: string[] = [];

      const result = await processMedia(
        {
          sourceKind: "media_url",
          sourceValue: "https://www.youtube.com/watch?v=cleanup",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          enableTranscriptCleanup: true,
          transcriptCleanupFailureMode: "fallback_to_original",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "keep_temp",
          mediaCompressionProfile: "balanced"
        },
        {
          runtimeProvider: {
            strategy: "local_bridge",
            async processMediaUrl() {
              return {
                metadata: {
                  title: "Cleanup Demo",
                  creatorOrAuthor: "Demo",
                  platform: "YouTube",
                  source: "https://www.youtube.com/watch?v=cleanup",
                  created: "2026-05-05T00:00:00.000Z"
                },
                normalizedText: "cleanup normalized text",
                transcript: [],
                artifactCleanup: {
                  downloadedPath: path.join(tempDirectory, "source.mp3"),
                  normalizedAudioPath: path.join(tempDirectory, "normalized.wav"),
                  transcriptPath,
                  subtitlePath,
                  metadataPath,
                  aiUploadDirectory,
                  aiUploadArtifactPaths: []
                },
                warnings: []
              };
            },
            async processLocalMedia() {
              throw new Error("not used");
            },
            async processWebpage() {
              throw new Error("not used");
            }
          },
          transcriptionProvider: {
            async transcribeMedia() {
              return {
                transcript: [{ startMs: 0, endMs: 1000, text: "原始錯字逐字稿" }],
                transcriptMarkdown: "{0m0s - 0m1s} 原始錯字逐字稿",
                warnings: []
              };
            }
          },
          transcriptCleanupProvider: {
            async cleanupTranscript(input) {
              expect(input.cleanupProvider).toBe("gemini");
              expect(input.cleanupModel).toBe("gemini-2.5-flash");
              expect(input.transcriptMarkdown).toContain("原始錯字逐字稿");
              return {
                transcript: [{ startMs: 0, endMs: 1000, text: "清理後逐字稿" }],
                transcriptMarkdown: "{0m0s - 0m1s} 清理後逐字稿",
                warnings: []
              };
            }
          },
          summaryProvider: {
            async summarizeMedia(input) {
              capturedSummaryInputs.push(input);
              return { summaryMarkdown: "Cleanup summary", warnings: [] };
            },
            async summarizeWebpage() {
              throw new Error("not used");
            }
          },
          noteWriter: {
            async writeMediaNote(input) {
              capturedNoteInputs.push(input.transcriptMarkdown);
              return { notePath: "Summaries/Cleanup Demo.md", createdAt: "2026-05-05T00:00:00.000Z", warnings: [] };
            },
            async writeWebpageNote() {
              throw new Error("not used");
            }
          }
        },
        new AbortController().signal,
        {
          onStageChange: (status, message) => stageMessages.push(`${status}:${message}`)
        }
      );

      expect(capturedSummaryInputs[0]?.transcript).toEqual([
        { startMs: 0, endMs: 1000, text: "清理後逐字稿" }
      ]);
      expect(capturedNoteInputs[0]).toContain("清理後逐字稿");
      expect(result.warnings).toContain("Transcript cleanup applied before summary.");
      await expect(readFile(transcriptPath, "utf8")).resolves.toContain("清理後逐字稿");
      await expect(readFile(path.join(tempDirectory, "transcript.raw.md"), "utf8")).resolves.toContain("原始錯字逐字稿");
      expect(stageMessages).toContain("cleaning:Cleaning transcript before summary");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("applies chunking strategy when transcript is large", async () => {
    let summarizeMediaCalls = 0;
    let capturedSummaryMarkdown = "";

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Chunk Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=chunk",
            created: "2026-04-23T00:00:00.000Z"
          },
          normalizedText: "normalized-context",
          transcript: [
            { startMs: 0, endMs: 1000, text: "1234567890".repeat(700) },
            { startMs: 1000, endMs: 2000, text: "abcdefghij".repeat(700) }
          ],
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia(input) {
        return {
          transcript: input.transcript,
          transcriptMarkdown: "Chunk transcript content",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia(input) {
        summarizeMediaCalls += 1;
        if (input.transcript.length === 0) {
          return {
            summaryMarkdown: "Final synthesized chunk summary",
            warnings: []
          };
        }

        return {
          summaryMarkdown: `Internal chunk summary ${summarizeMediaCalls}`,
          warnings: []
        };
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote(input) {
        capturedSummaryMarkdown = input.summaryMarkdown;
        return {
          notePath: "Summaries/Chunk Demo.md",
          createdAt: "2026-04-23T00:00:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    const result = await processMedia(
      {
        sourceKind: "media_url",
        sourceValue: "https://www.youtube.com/watch?v=chunk",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash",
        retentionMode: "delete_temp"
      },
      {
        runtimeProvider,
        transcriptionProvider,
        summaryProvider,
        noteWriter
      },
      new AbortController().signal
    );

    expect(summarizeMediaCalls).toBeGreaterThan(1);
    expect(capturedSummaryMarkdown).toBe("## 一、重點摘要\nFinal synthesized chunk summary");
    expect(capturedSummaryMarkdown).not.toContain("## Chunk 1");
    expect(result.warnings.some((warning) => warning.includes("Chunked media summary into"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("Final synthesis generated"))).toBe(true);
  });

  it("reports OpenRouter summary failures without retrying Gemini", async () => {
    const summaryProviders: string[] = [];

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Fallback Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=openrouter-failure",
            created: "2026-04-29T00:00:00.000Z"
          },
          normalizedText: "normalized-context",
          transcript: [],
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    const transcriptionProvider: TranscriptionProvider = {
      async transcribeMedia() {
        return {
          transcript: [{ startMs: 0, endMs: 1000, text: "hello transcript" }],
          transcriptMarkdown: "{0m0s - 0m1s} hello transcript",
          warnings: []
        };
      }
    };

    const summaryProvider: SummaryProvider = {
      async summarizeMedia(input) {
        summaryProviders.push(input.summaryProvider);
        if (input.summaryProvider === "openrouter") {
          throw new SummarizerError({
            category: "ai_failure",
            message: "OpenRouter response did not include text output.",
            recoverable: true
          });
        }

        throw new Error("Gemini should not be called");
      },
      async summarizeWebpage() {
        throw new Error("should not execute");
      }
    };

    const noteWriter: NoteWriter = {
      async writeMediaNote() {
        return {
          notePath: "Summaries/Fallback Demo.md",
          createdAt: "2026-04-29T00:00:00.000Z",
          warnings: []
        };
      },
      async writeWebpageNote() {
        throw new Error("should not execute");
      }
    };

    await expect(
      processMedia(
        {
          sourceKind: "media_url",
          sourceValue: "https://www.youtube.com/watch?v=openrouter-failure",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "openrouter",
          summaryModel: "qwen/qwen3.6-plus",
          retentionMode: "delete_temp"
        },
        {
          runtimeProvider,
          transcriptionProvider,
          summaryProvider,
          noteWriter
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "ai_failure",
      message: "OpenRouter response did not include text output."
    });

    expect(summaryProviders).toEqual(["openrouter"]);
  });

  it("preserves transcript artifact when summary fails", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "process-media-recovery-"));
    const transcriptPath = path.join(tempDirectory, "transcript.md");
    const subtitlePath = path.join(tempDirectory, "subtitles.srt");
    const warnings: string[] = [];

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Recovery Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=recovery",
            created: "2026-04-29T00:00:00.000Z"
          },
          normalizedText: "normalized-context",
          transcript: [],
          artifactCleanup: {
            downloadedPath: path.join(tempDirectory, "downloaded.mp4"),
            normalizedAudioPath: path.join(tempDirectory, "normalized.wav"),
            transcriptPath,
            subtitlePath,
            metadataPath: path.join(tempDirectory, "metadata.json"),
            aiUploadDirectory: path.join(tempDirectory, "ai-upload"),
            aiUploadArtifactPaths: [path.join(tempDirectory, "ai-upload", "ai-upload.ogg")]
          },
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    try {
      await expect(
        processMedia(
          {
            sourceKind: "media_url",
            sourceValue: "https://www.youtube.com/watch?v=recovery",
            transcriptionProvider: "gemini",
            transcriptionModel: "gemini-2.5-flash",
            summaryProvider: "openrouter",
            summaryModel: "qwen/qwen3.6-plus",
            retentionMode: "delete_temp"
          },
          {
            runtimeProvider,
            transcriptionProvider: {
              async transcribeMedia() {
                return {
                  transcript: [{ startMs: 0, endMs: 1000, text: "recovered transcript" }],
                  transcriptMarkdown: "{0m0s - 0m1s} recovered transcript",
                  warnings: []
                };
              }
            },
            summaryProvider: {
              async summarizeMedia(input) {
                throw new SummarizerError({
                  category: "ai_failure",
                  message: `${input.summaryProvider} summary failed`,
                  recoverable: true
                });
              },
              async summarizeWebpage() {
                throw new Error("should not execute");
              }
            },
            noteWriter: {
              async writeMediaNote() {
                throw new Error("should not execute");
              },
              async writeWebpageNote() {
                throw new Error("should not execute");
              }
            }
          },
          new AbortController().signal,
          {
            onWarning: (warning) => {
              warnings.push(warning);
            }
          }
        )
      ).rejects.toMatchObject({
        category: "ai_failure",
        message: "openrouter summary failed"
      });

      expect(await readFile(transcriptPath, "utf8")).toContain("recovered transcript");
      expect(await readFile(subtitlePath, "utf8")).toContain("00:00:00,000 --> 00:00:01,000");
      expect(await readFile(subtitlePath, "utf8")).toContain("recovered transcript");
      expect(warnings.some((warning) => warning.includes("Recovery transcript preserved"))).toBe(true);
      expect(
        warnings.some((warning) => warning.includes("preserved source, transcript, subtitles, and metadata"))
      ).toBe(true);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("writes transcript and subtitle artifacts and preserves them after completed cleanup", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "process-media-artifacts-"));
    const transcriptPath = path.join(tempDirectory, "transcript.md");
    const subtitlePath = path.join(tempDirectory, "subtitles.srt");
    const metadataPath = path.join(tempDirectory, "metadata.json");

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        await mkdir(path.join(tempDirectory, "ai-upload"), { recursive: true });
        await writeFile(
          metadataPath,
          `${JSON.stringify({
            sessionId: "artifact-session",
            sourceType: "youtube",
            title: "Artifact Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            createdAt: "2026-05-02T00:00:00.000Z",
            originalFilename: "downloaded.mp4",
            downloadedPath: path.join(tempDirectory, "downloaded.mp4"),
            sourceArtifactPath: path.join(tempDirectory, "downloaded.mp4"),
            normalizedAudioPath: path.join(tempDirectory, "normalized.wav"),
            transcriptPath,
            subtitlePath,
            derivedArtifactPaths: [],
            uploadArtifactPaths: [],
            chunkCount: 0,
            chunkDurationsMs: [],
            vadApplied: false,
            selectedCodec: null,
            warnings: []
          }, null, 2)}\n`,
          "utf8"
        );

        return {
          metadata: {
            title: "Artifact Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=artifacts",
            created: "2026-05-02T00:00:00.000Z"
          },
          normalizedText: "normalized-context",
          transcript: [],
          artifactCleanup: {
            downloadedPath: path.join(tempDirectory, "downloaded.mp4"),
            normalizedAudioPath: path.join(tempDirectory, "normalized.wav"),
            transcriptPath,
            subtitlePath,
            metadataPath,
            aiUploadDirectory: path.join(tempDirectory, "ai-upload"),
            aiUploadArtifactPaths: [path.join(tempDirectory, "ai-upload", "ai-upload.ogg")]
          },
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    try {
      const result = await processMedia(
        {
          sourceKind: "media_url",
          sourceValue: "https://www.youtube.com/watch?v=artifacts",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp"
        },
        {
          runtimeProvider,
          transcriptionProvider: {
            async transcribeMedia() {
              return {
                transcript: [
                  { startMs: 0, endMs: 0, text: "{0m0s - 0m1s} first artifact transcript" },
                  { startMs: 0, endMs: 0, text: "{0m1s - 0m2s} second artifact transcript" }
                ],
                transcriptMarkdown: "{0m0s - 0m1s} first artifact transcript\n{0m1s - 0m2s} second artifact transcript",
                warnings: []
              };
            }
          },
          summaryProvider: {
            async summarizeMedia() {
              return {
                summaryMarkdown: "Artifact summary",
                warnings: []
              };
            },
            async summarizeWebpage() {
              throw new Error("should not execute");
            }
          },
          noteWriter: {
            async writeMediaNote() {
              return {
                notePath: "Summaries/Artifact Demo.md",
                createdAt: "2026-05-02T00:00:00.000Z",
                warnings: []
              };
            },
            async writeWebpageNote() {
              throw new Error("should not execute");
            }
          }
        },
        new AbortController().signal
      );

      expect(result.writeResult.notePath).toBe("Summaries/Artifact Demo.md");
      expect(await readFile(transcriptPath, "utf8")).toContain("first artifact transcript");
      const subtitleContent = await readFile(subtitlePath, "utf8");
      expect(subtitleContent).toContain("1\n00:00:00,000 --> 00:00:01,000");
      expect(subtitleContent).toContain("2\n00:00:01,000 --> 00:00:02,000");
      expect(subtitleContent).toContain("second artifact transcript");

      await expect(readFile(metadataPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("preserves partial transcript artifact when chunked transcription fails", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "process-media-partial-recovery-"));
    const transcriptPath = path.join(tempDirectory, "transcript.md");
    const subtitlePath = path.join(tempDirectory, "subtitles.srt");
    const warnings: string[] = [];

    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        return {
          metadata: {
            title: "Partial Recovery Demo",
            creatorOrAuthor: "Demo Channel",
            platform: "YouTube",
            source: "https://www.youtube.com/watch?v=partial-recovery",
            created: "2026-05-02T00:00:00.000Z"
          },
          normalizedText: "normalized-context",
          transcript: [],
          artifactCleanup: {
            downloadedPath: path.join(tempDirectory, "downloaded.mp4"),
            normalizedAudioPath: path.join(tempDirectory, "normalized.wav"),
            transcriptPath,
            subtitlePath,
            metadataPath: path.join(tempDirectory, "metadata.json"),
            aiUploadDirectory: path.join(tempDirectory, "ai-upload"),
            aiUploadArtifactPaths: [
              path.join(tempDirectory, "ai-upload", "chunk-0000.ogg"),
              path.join(tempDirectory, "ai-upload", "chunk-0001.ogg")
            ]
          },
          aiUploadArtifactPaths: [
            path.join(tempDirectory, "ai-upload", "chunk-0000.ogg"),
            path.join(tempDirectory, "ai-upload", "chunk-0001.ogg")
          ],
          warnings: []
        };
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    try {
      await expect(
        processMedia(
          {
            sourceKind: "media_url",
            sourceValue: "https://www.youtube.com/watch?v=partial-recovery",
            transcriptionProvider: "gemini",
            transcriptionModel: "gemini-2.5-flash",
            summaryProvider: "gemini",
            summaryModel: "gemini-2.5-flash",
            retentionMode: "delete_temp"
          },
          {
            runtimeProvider,
            transcriptionProvider: {
              async transcribeMedia() {
                throw new SummarizerError({
                  category: "ai_failure",
                  message: "Gemini transcription failed for AI upload chunk 2/2",
                  recoverable: true,
                  cause: {
                    provider: "Gemini",
                    failureKind: "chunk_transcription_failed",
                    partialTranscriptMarkdown: "{0-1000} first chunk transcript"
                  }
                });
              }
            },
            summaryProvider: {
              async summarizeMedia() {
                throw new Error("should not execute");
              },
              async summarizeWebpage() {
                throw new Error("should not execute");
              }
            },
            noteWriter: {
              async writeMediaNote() {
                throw new Error("should not execute");
              },
              async writeWebpageNote() {
                throw new Error("should not execute");
              }
            }
          },
          new AbortController().signal,
          {
            onWarning: (warning) => {
              warnings.push(warning);
            }
          }
        )
      ).rejects.toMatchObject({
        category: "ai_failure",
        message: "Gemini transcription failed for AI upload chunk 2/2"
      });

      expect(await readFile(transcriptPath, "utf8")).toContain("first chunk transcript");
      expect(warnings.some((warning) => warning.includes("Partial transcript preserved"))).toBe(true);
      expect(
        warnings.some((warning) => warning.includes("preserved source, transcript, subtitles, and metadata"))
      ).toBe(true);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("throws validation_error when media source value is empty", async () => {
    const runtimeProvider: RuntimeProvider = {
      strategy: "local_bridge",
      async processMediaUrl() {
        throw new Error("should not execute");
      },
      async processLocalMedia() {
        throw new Error("should not execute");
      },
      async processWebpage() {
        throw new Error("should not execute");
      }
    };

    await expect(
      processMedia(
        {
          sourceKind: "media_url",
          sourceValue: "   ",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash",
          retentionMode: "delete_temp"
        },
        {
          runtimeProvider,
          transcriptionProvider: {
            async transcribeMedia() {
              throw new Error("should not execute");
            }
          },
          summaryProvider: {
            async summarizeMedia() {
              throw new Error("should not execute");
            },
            async summarizeWebpage() {
              throw new Error("should not execute");
            }
          },
          noteWriter: {
            async writeMediaNote() {
              throw new Error("should not execute");
            },
            async writeWebpageNote() {
              throw new Error("should not execute");
            }
          }
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      category: "validation_error"
    });
  });
});
