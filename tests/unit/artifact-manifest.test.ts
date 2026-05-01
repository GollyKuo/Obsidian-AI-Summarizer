import { describe, expect, it } from "vitest";
import {
  buildInitialArtifactManifest,
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
});
