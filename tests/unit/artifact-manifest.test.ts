import { describe, expect, it } from "vitest";
import {
  buildInitialArtifactManifest,
  getRemoteFileCleanupCandidates,
  readArtifactManifest,
  updateArtifactManifestWithRemoteFile,
  updateArtifactManifestWithTranscriptArtifacts
} from "@services/media/artifact-manifest";

describe("artifact manifest", () => {
  it("records transcript and subtitle artifact lineage", async () => {
    const metadataPath = "D:\\cache\\session\\metadata.json";
    let manifestContent = `${JSON.stringify(
      buildInitialArtifactManifest({
        sessionId: "session-a",
        sourceType: "youtube",
        sourceUrl: "https://www.youtube.com/watch?v=demo",
        metadata: {
          title: "Demo",
          creatorOrAuthor: "Demo Channel",
          platform: "YouTube",
          source: "https://www.youtube.com/watch?v=demo",
          created: "2026-05-02T00:00:00.000Z"
        },
        sourceArtifactPath: "D:\\cache\\session\\downloaded.mp4",
        normalizedAudioPath: "D:\\cache\\session\\normalized.wav",
        transcriptPath: "D:\\cache\\session\\transcript.md",
        subtitlePath: "D:\\cache\\session\\subtitles.srt",
        warnings: []
      }),
      null,
      2
    )}\n`;

    await updateArtifactManifestWithTranscriptArtifacts(
      metadataPath,
      {
        transcriptPath: "D:\\cache\\session\\transcript.md",
        subtitlePath: "D:\\cache\\session\\subtitles.srt"
      },
      async (_, content) => {
        manifestContent = content;
      },
      async () => manifestContent
    );

    const manifest = JSON.parse(manifestContent) as {
      transcriptPath: string;
      subtitlePath: string;
    };
    expect(manifest.transcriptPath).toBe("D:\\cache\\session\\transcript.md");
    expect(manifest.subtitlePath).toBe("D:\\cache\\session\\subtitles.srt");
  });

  it("classifies missing, invalid, and schema-mismatched manifests as recoverable reads", async () => {
    await expect(
      readArtifactManifest("D:\\cache\\session\\metadata.json", async () => {
        const error = new Error("missing") as Error & { code: string };
        error.code = "ENOENT";
        throw error;
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "missing",
      warning: expect.stringContaining("missing")
    });

    await expect(
      readArtifactManifest("D:\\cache\\session\\metadata.json", async () => "{not-json")
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid_json",
      warning: expect.stringContaining("invalid JSON")
    });

    await expect(
      readArtifactManifest("D:\\cache\\session\\metadata.json", async () => "[]")
    ).resolves.toMatchObject({
      ok: false,
      reason: "schema_mismatch",
      warning: expect.stringContaining("does not contain an object")
    });
  });

  it("skips manifest updates with a warning when metadata JSON is corrupt", async () => {
    const warnings = await updateArtifactManifestWithRemoteFile(
      "D:\\cache\\session\\metadata.json",
      {
        provider: "Gemini",
        strategy: "files_api",
        localArtifactPath: "D:\\cache\\session\\audio.mp3",
        name: "files/demo",
        uri: "https://example.com/files/demo",
        mimeType: "audio/mpeg",
        state: "ACTIVE",
        createdAt: "2026-05-02T00:00:00.000Z"
      },
      async () => {
        throw new Error("write should not be called");
      },
      async () => "{not-json"
    );

    expect(warnings).toEqual([
      "Artifact manifest metadata.json contains invalid JSON; using recoverable fallback."
    ]);
  });

  it("returns remote files that still need cleanup compensation", () => {
    const candidates = getRemoteFileCleanupCandidates({
      remoteFiles: [
        {
          provider: "Gemini",
          strategy: "files_api",
          localArtifactPath: "D:\\cache\\session\\audio-1.mp3",
          name: "files/deleted",
          uri: "https://example.com/files/deleted",
          mimeType: "audio/mpeg",
          state: "ACTIVE",
          createdAt: "2026-05-02T00:00:00.000Z",
          deleteState: "deleted"
        },
        {
          provider: "Gemini",
          strategy: "files_api",
          localArtifactPath: "D:\\cache\\session\\audio-2.mp3",
          name: "files/failed",
          uri: "https://example.com/files/failed",
          mimeType: "audio/mpeg",
          state: "ACTIVE",
          createdAt: "2026-05-02T00:00:00.000Z",
          deleteState: "failed"
        },
        {
          provider: "Gemini",
          strategy: "files_api",
          localArtifactPath: "D:\\cache\\session\\audio-3.mp3",
          name: "files/untracked",
          uri: "https://example.com/files/untracked",
          mimeType: "audio/mpeg",
          state: "ACTIVE",
          createdAt: "2026-05-02T00:00:00.000Z"
        }
      ]
    });

    expect(candidates.map((candidate) => candidate.name)).toEqual([
      "files/failed",
      "files/untracked"
    ]);
  });
});
