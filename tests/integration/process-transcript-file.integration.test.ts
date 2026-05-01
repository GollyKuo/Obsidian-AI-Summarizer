import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { processTranscriptFile } from "@orchestration/process-transcript-file";
import type { MediaNoteInput, MediaSummaryInput } from "@domain/types";
import type { SummaryProvider } from "@services/ai/ai-provider";
import type { NoteWriter } from "@services/obsidian/note-writer";

const tempDirectories: string[] = [];

async function makeTempDirectory(): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "ai-summarizer-transcript-"));
  tempDirectories.push(tempDirectory);
  return tempDirectory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((tempDirectory) => rm(tempDirectory, { recursive: true, force: true })));
});

describe("processTranscriptFile integration", () => {
  it("summarizes a retained transcript with adjacent manifest metadata", async () => {
    const tempDirectory = await makeTempDirectory();
    const transcriptPath = path.join(tempDirectory, "transcript.md");
    await writeFile(
      transcriptPath,
      ["<!-- Gemini chunk 1 -->", "{0m0s - 0m1s} First retained transcript line.", "{0m1s - 0m2s} Second retained transcript line."].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(tempDirectory, "metadata.json"),
      JSON.stringify({
        title: "Retained Session",
        creatorOrAuthor: "Original Channel",
        platform: "YouTube",
        sourceUrl: "https://example.com/watch?v=123",
        createdAt: "2026-05-02T01:00:00.000Z"
      }),
      "utf8"
    );

    const capturedSummaryInputs: MediaSummaryInput[] = [];
    const capturedNoteInputs: MediaNoteInput[] = [];
    const stageMessages: string[] = [];
    const emittedWarnings: string[] = [];

    const summaryProvider: SummaryProvider = {
      async summarizeMedia(input) {
        capturedSummaryInputs.push(input);
        return {
          summaryMarkdown: "# Regenerated Summary\n\nSummary from retained transcript.",
          warnings: ["summary retry warning"]
        };
      },
      async summarizeWebpage() {
        throw new Error("not used");
      }
    };
    const noteWriter: NoteWriter = {
      async writeMediaNote(input) {
        capturedNoteInputs.push(input);
        return {
          notePath: "Summaries/Retained Session.md",
          createdAt: "2026-05-02T01:05:00.000Z",
          warnings: ["note retry warning"]
        };
      },
      async writeWebpageNote() {
        throw new Error("not used");
      }
    };

    const result = await processTranscriptFile(
      {
        sourceKind: "transcript_file",
        sourceValue: transcriptPath,
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      { summaryProvider, noteWriter },
      new AbortController().signal,
      {
        onStageChange: (status, message) => stageMessages.push(`${status}:${message}`),
        onWarning: (warning) => emittedWarnings.push(warning)
      }
    );

    expect(capturedSummaryInputs[0]?.metadata).toMatchObject({
      title: "Retained Session",
      creatorOrAuthor: "Original Channel",
      platform: "YouTube",
      source: "https://example.com/watch?v=123",
      created: "2026-05-02T01:00:00.000Z"
    });
    expect(capturedSummaryInputs[0]?.normalizedText).toBe(`Transcript file: ${transcriptPath}`);
    expect(capturedSummaryInputs[0]?.transcript).toEqual([
      {
        startMs: 0,
        endMs: 1000,
        text: "{0m0s - 0m1s} First retained transcript line."
      },
      {
        startMs: 1000,
        endMs: 2000,
        text: "{0m1s - 0m2s} Second retained transcript line."
      }
    ]);
    expect(capturedNoteInputs[0]?.metadata.title).toBe("Retained Session");
    expect(capturedNoteInputs[0]?.transcriptMarkdown).toContain("First retained transcript line");
    expect(result.summary.summaryMarkdown).toContain("Regenerated Summary");
    expect(result.writeResult.notePath).toBe("Summaries/Retained Session.md");
    expect(result.warnings).toEqual(expect.arrayContaining(["summary retry warning", "note retry warning"]));
    expect(emittedWarnings).toEqual(result.warnings);
    expect(stageMessages).toEqual([
      "validating:Validating transcript file input",
      "acquiring:Reading transcript file",
      "summarizing:Regenerating summary from transcript",
      "writing:Writing regenerated summary note into vault"
    ]);
  });

  it("falls back to transcript file metadata when metadata.json is unavailable", async () => {
    const tempDirectory = await makeTempDirectory();
    const transcriptPath = path.join(tempDirectory, "manual-transcript.txt");
    await writeFile(transcriptPath, "A manually edited transcript line.", "utf8");

    const capturedSummaryInputs: MediaSummaryInput[] = [];
    const result = await processTranscriptFile(
      {
        sourceKind: "transcript_file",
        sourceValue: transcriptPath,
        summaryProvider: "gemini",
        summaryModel: "gemini-2.5-flash"
      },
      {
        summaryProvider: {
          async summarizeMedia(input) {
            capturedSummaryInputs.push(input);
            return { summaryMarkdown: "Fallback summary", warnings: [] };
          },
          async summarizeWebpage() {
            throw new Error("not used");
          }
        },
        noteWriter: {
          async writeMediaNote() {
            return { notePath: "Summaries/manual-transcript.md", createdAt: "2026-05-02T01:10:00.000Z", warnings: [] };
          },
          async writeWebpageNote() {
            throw new Error("not used");
          }
        }
      },
      new AbortController().signal
    );

    expect(capturedSummaryInputs[0]?.metadata).toMatchObject({
      title: "manual-transcript",
      creatorOrAuthor: "Unknown",
      platform: "Transcript File",
      source: transcriptPath
    });
    expect(result.warnings).toContain("Transcript retry: metadata.json was unavailable; using transcript file metadata fallback.");
  });

  it("throws validation_error for non-transcript or empty inputs", async () => {
    const tempDirectory = await makeTempDirectory();
    const emptyTranscriptPath = path.join(tempDirectory, "empty.md");
    await writeFile(emptyTranscriptPath, "   \n", "utf8");

    const dependencies = {
      summaryProvider: {
        async summarizeMedia() {
          throw new Error("not used");
        },
        async summarizeWebpage() {
          throw new Error("not used");
        }
      },
      noteWriter: {
        async writeMediaNote() {
          throw new Error("not used");
        },
        async writeWebpageNote() {
          throw new Error("not used");
        }
      }
    } satisfies {
      summaryProvider: SummaryProvider;
      noteWriter: NoteWriter;
    };

    await expect(
      processTranscriptFile(
        {
          sourceKind: "transcript_file",
          sourceValue: path.join(tempDirectory, "audio.mp3"),
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash"
        },
        dependencies,
        new AbortController().signal
      )
    ).rejects.toMatchObject({ category: "validation_error" });

    await expect(
      processTranscriptFile(
        {
          sourceKind: "transcript_file",
          sourceValue: emptyTranscriptPath,
          summaryProvider: "gemini",
          summaryModel: "gemini-2.5-flash"
        },
        dependencies,
        new AbortController().signal
      )
    ).rejects.toMatchObject({ category: "validation_error" });
  });
});
