import { promises as fs } from "node:fs";
import type { RetentionMode } from "@domain/types";

export type ArtifactLifecycleStatus = "completed" | "failed" | "cancelled";

export interface MediaSessionArtifacts {
  downloadedPath: string;
  normalizedAudioPath: string;
  transcriptPath: string;
  metadataPath: string;
  aiUploadDirectory: string;
}

export interface ArtifactRetentionInput {
  retentionMode: RetentionMode;
  lifecycleStatus: ArtifactLifecycleStatus;
  artifacts: MediaSessionArtifacts;
  aiUploadArtifactPaths: string[];
}

interface CleanupTarget {
  path: string;
  recursive: boolean;
}

export interface ArtifactRetentionPlan {
  keepPaths: string[];
  removeTargets: CleanupTarget[];
}

type ArtifactRemover = (target: CleanupTarget) => Promise<void>;

export interface ArtifactRetentionManager {
  buildPlan(input: ArtifactRetentionInput): ArtifactRetentionPlan;
  cleanup(input: ArtifactRetentionInput): Promise<string[]>;
}

interface ArtifactRetentionManagerOptions {
  remover?: ArtifactRemover;
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

function toCleanupTarget(path: string, recursive: boolean): CleanupTarget {
  return {
    path,
    recursive
  };
}

function defaultRemover(target: CleanupTarget): Promise<void> {
  return fs.rm(target.path, {
    recursive: target.recursive,
    force: true
  });
}

function keepPathsForCompleted(input: ArtifactRetentionInput): string[] {
  if (input.retentionMode === "keep_temp") {
    return uniqueNonEmpty([
      input.artifacts.downloadedPath,
      input.artifacts.normalizedAudioPath,
      input.artifacts.transcriptPath
    ]);
  }
  return [];
}

function keepPathsForIncomplete(input: ArtifactRetentionInput): string[] {
  if (input.retentionMode === "keep_temp") {
    return uniqueNonEmpty([
      input.artifacts.downloadedPath,
      input.artifacts.normalizedAudioPath,
      input.artifacts.transcriptPath,
      input.artifacts.metadataPath
    ]);
  }

  // For failed/cancelled runs, keep source + metadata for recovery diagnostics.
  return uniqueNonEmpty([input.artifacts.downloadedPath, input.artifacts.metadataPath]);
}

function buildRemoveTargets(input: ArtifactRetentionInput, keepPaths: string[]): CleanupTarget[] {
  const keepSet = new Set(keepPaths);
  const candidateTargets: CleanupTarget[] = [
    toCleanupTarget(input.artifacts.downloadedPath, false),
    toCleanupTarget(input.artifacts.normalizedAudioPath, false),
    toCleanupTarget(input.artifacts.transcriptPath, false),
    toCleanupTarget(input.artifacts.metadataPath, false),
    ...input.aiUploadArtifactPaths.map((artifactPath) => toCleanupTarget(artifactPath, false)),
    toCleanupTarget(input.artifacts.aiUploadDirectory, true)
  ];

  const deduplicatedByPath = new Map<string, CleanupTarget>();
  for (const target of candidateTargets) {
    if (keepSet.has(target.path)) {
      continue;
    }
    const existing = deduplicatedByPath.get(target.path);
    if (!existing || target.recursive) {
      deduplicatedByPath.set(target.path, target);
    }
  }

  return Array.from(deduplicatedByPath.values());
}

export function createArtifactRetentionManager(
  options: ArtifactRetentionManagerOptions = {}
): ArtifactRetentionManager {
  const remover = options.remover ?? defaultRemover;

  return {
    buildPlan(input: ArtifactRetentionInput): ArtifactRetentionPlan {
      const keepPaths =
        input.lifecycleStatus === "completed"
          ? keepPathsForCompleted(input)
          : keepPathsForIncomplete(input);

      return {
        keepPaths,
        removeTargets: buildRemoveTargets(input, keepPaths)
      };
    },

    async cleanup(input: ArtifactRetentionInput): Promise<string[]> {
      const warnings: string[] = [];
      const plan = this.buildPlan(input);

      for (const target of plan.removeTargets) {
        try {
          await remover(target);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`Retention cleanup failed for ${target.path}: ${message}`);
        }
      }

      if (input.lifecycleStatus !== "completed" && input.retentionMode === "delete_temp") {
        warnings.push("Retention recovery boundary: preserved source and metadata after non-completed run.");
      }

      return warnings;
    }
  };
}
