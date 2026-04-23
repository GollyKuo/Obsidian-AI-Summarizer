import { describe, expect, it } from "vitest";
import {
  createArtifactRetentionManager,
  type ArtifactRetentionInput
} from "@services/media/artifact-retention";

function makeInput(overrides: Partial<ArtifactRetentionInput> = {}): ArtifactRetentionInput {
  return {
    retentionMode: "none",
    lifecycleStatus: "completed",
    artifacts: {
      downloadedPath: "D:\\cache\\session\\downloaded.mp4",
      normalizedAudioPath: "D:\\cache\\session\\normalized.wav",
      transcriptPath: "D:\\cache\\session\\transcript.srt",
      metadataPath: "D:\\cache\\session\\metadata.json",
      aiUploadDirectory: "D:\\cache\\session\\ai-upload"
    },
    aiUploadArtifactPaths: [
      "D:\\cache\\session\\ai-upload\\ai-upload.ogg",
      "D:\\cache\\session\\ai-upload\\chunk-0001.ogg"
    ],
    ...overrides
  };
}

describe("artifact retention manager", () => {
  it("removes all intermediate artifacts when retention mode is none on completed run", async () => {
    const removed: string[] = [];
    const manager = createArtifactRetentionManager({
      remover: async (target) => {
        removed.push(target.path);
      }
    });

    const warnings = await manager.cleanup(makeInput());

    expect(warnings).toEqual([]);
    expect(removed).toContain("D:\\cache\\session\\downloaded.mp4");
    expect(removed).toContain("D:\\cache\\session\\normalized.wav");
    expect(removed).toContain("D:\\cache\\session\\transcript.srt");
    expect(removed).toContain("D:\\cache\\session\\metadata.json");
    expect(removed).toContain("D:\\cache\\session\\ai-upload");
  });

  it("keeps source and metadata when retention mode is source on completed run", () => {
    const manager = createArtifactRetentionManager();
    const plan = manager.buildPlan(
      makeInput({
        retentionMode: "source"
      })
    );

    expect(plan.keepPaths).toEqual([
      "D:\\cache\\session\\downloaded.mp4",
      "D:\\cache\\session\\metadata.json"
    ]);
    expect(plan.removeTargets.some((target) => target.path.endsWith("downloaded.mp4"))).toBe(false);
    expect(plan.removeTargets.some((target) => target.path.endsWith("metadata.json"))).toBe(false);
    expect(plan.removeTargets.some((target) => target.path.endsWith("normalized.wav"))).toBe(true);
  });

  it("preserves source and metadata for recovery on failed run even with retention none", async () => {
    const removed: string[] = [];
    const manager = createArtifactRetentionManager({
      remover: async (target) => {
        removed.push(target.path);
      }
    });

    const warnings = await manager.cleanup(
      makeInput({
        lifecycleStatus: "failed",
        retentionMode: "none"
      })
    );

    expect(removed.some((target) => target.endsWith("downloaded.mp4"))).toBe(false);
    expect(removed.some((target) => target.endsWith("metadata.json"))).toBe(false);
    expect(removed.some((target) => target.endsWith("normalized.wav"))).toBe(true);
    expect(
      warnings.some((warning) => warning.includes("Retention recovery boundary: preserved source and metadata"))
    ).toBe(true);
  });

  it("returns cleanup warning when remover fails", async () => {
    const manager = createArtifactRetentionManager({
      remover: async () => {
        throw new Error("permission denied");
      }
    });

    const warnings = await manager.cleanup(makeInput());
    expect(
      warnings.some((warning) => warning.includes("Retention cleanup failed"))
    ).toBe(true);
  });
});
