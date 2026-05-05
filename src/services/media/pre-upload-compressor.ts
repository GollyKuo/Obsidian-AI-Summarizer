import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { SummarizerError } from "@domain/errors";
import type { MediaCompressionProfile } from "@domain/settings";
import { isAbortError, throwIfCancelled } from "@orchestration/cancellation";
import type {
  MediaDownloadResult,
  MediaDownloadSession
} from "@services/media/downloader-adapter";
import { updateArtifactManifestWithCompression } from "@services/media/artifact-manifest";

const execFileAsync = promisify(execFile);

interface ExecCommandResult {
  stdout: string;
  stderr: string;
}

type CommandExecutor = (
  command: string,
  args: string[],
  signal: AbortSignal
) => Promise<ExecCommandResult>;

interface ConversionPreset {
  codec: "opus" | "aac" | "flac";
  extension: "ogg" | "m4a" | "flac";
  buildArgs: (inputPath: string, outputPath: string) => string[];
}

interface ConversionFailureDetails {
  message: string;
  stderr: string;
}

interface PreUploadCompressorOptions {
  commandExecutor?: CommandExecutor;
  ffmpegCommand?: string;
  ffprobeCommand?: string;
  mkdir?: (targetPath: string) => Promise<void>;
  readdir?: (targetPath: string) => Promise<string[]>;
  stat?: (targetPath: string) => Promise<{ isFile: () => boolean }>;
}

export interface PreUploadCompressionRequest {
  session: MediaDownloadSession;
  downloadResult: MediaDownloadResult;
  profile: MediaCompressionProfile;
  artifactMode?: "auto_chunks" | "single_artifact";
}

export interface PreUploadCompressionResult {
  normalizedAudioPath: string;
  aiUploadArtifactPaths: string[];
  selectedCodec: "opus" | "aac" | "flac";
  chunkCount: number;
  chunkDurationsMs: number[];
  vadApplied: boolean;
  warnings: string[];
}

export interface PreUploadCompressor {
  prepareForAiUpload(
    input: PreUploadCompressionRequest,
    signal: AbortSignal
  ): Promise<PreUploadCompressionResult>;
}

const BALANCED_PRESETS: ConversionPreset[] = [
  {
    codec: "opus",
    extension: "ogg",
    buildArgs: (inputPath, outputPath) => [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      "-vbr",
      "on",
      outputPath
    ]
  },
  {
    codec: "aac",
    extension: "m4a",
    buildArgs: (inputPath, outputPath) => [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      outputPath
    ]
  },
  {
    codec: "flac",
    extension: "flac",
    buildArgs: (inputPath, outputPath) => [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "flac",
      outputPath
    ]
  }
];

const QUALITY_PRESETS: ConversionPreset[] = [
  {
    codec: "flac",
    extension: "flac",
    buildArgs: (inputPath, outputPath) => [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "flac",
      outputPath
    ]
  }
];

const CHUNK_SEGMENT_SECONDS = 12 * 60;
const CHUNK_THRESHOLD_SECONDS = 15 * 60;

async function defaultCommandExecutor(
  command: string,
  args: string[],
  signal: AbortSignal
): Promise<ExecCommandResult> {
  const result = await execFileAsync(command, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
    timeout: 1000 * 60 * 10,
    signal
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function isSpawnNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode === "ENOENT") {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ENOENT");
}

function firstNonEmptyLine(...blocks: string[]): string {
  for (const block of blocks) {
    const line = block
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .find((item) => item.length > 0);
    if (line) {
      return line;
    }
  }
  return "";
}

async function fileExists(
  targetPath: string,
  stat: (targetPath: string) => Promise<{ isFile: () => boolean }>
): Promise<boolean> {
  try {
    const status = await stat(targetPath);
    return status.isFile();
  } catch {
    return false;
  }
}

function normalizeFailure(error: unknown): ConversionFailureDetails {
  const details = error as { stderr?: unknown; stdout?: unknown };
  const stderr = typeof details?.stderr === "string" ? details.stderr : "";
  const stdout = typeof details?.stdout === "string" ? details.stdout : "";
  const message =
    firstNonEmptyLine(stderr, stdout) || (error instanceof Error ? error.message : String(error));

  return { message, stderr };
}

function buildNormalizedAudioArgs(downloadedPath: string, normalizedAudioPath: string): string[] {
  return [
    "-y",
    "-i",
    downloadedPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-sample_fmt",
    "s16",
    normalizedAudioPath
  ];
}

function getPresets(profile: MediaCompressionProfile): ConversionPreset[] {
  if (profile === "quality") {
    return QUALITY_PRESETS;
  }
  return BALANCED_PRESETS;
}

function buildProbeDurationArgs(targetPath: string): string[] {
  return [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    targetPath
  ];
}

function normalizeCommand(command: string | undefined, fallback: string): string {
  const normalized = command?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function parseDurationMs(raw: string): number | null {
  const parsed = Number.parseFloat(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 1000);
}

async function probeDurationMs(
  targetPath: string,
  commandExecutor: CommandExecutor,
  signal: AbortSignal,
  ffprobeCommand: string
): Promise<number | null> {
  const probeResult = await commandExecutor(ffprobeCommand, buildProbeDurationArgs(targetPath), signal);
  return parseDurationMs(probeResult.stdout);
}

function buildChunkArgs(inputPath: string, chunkPatternPath: string): string[] {
  return [
    "-y",
    "-i",
    inputPath,
    "-f",
    "segment",
    "-segment_time",
    String(CHUNK_SEGMENT_SECONDS),
    "-reset_timestamps",
    "1",
    "-c",
    "copy",
    chunkPatternPath
  ];
}

function chunkFilenamePattern(extension: string): RegExp {
  return new RegExp(`^chunk-\\d{4}\\.${extension}$`);
}

function compareByNameAscending(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function createPreUploadCompressor(
  options: PreUploadCompressorOptions = {}
): PreUploadCompressor {
  const commandExecutor = options.commandExecutor ?? defaultCommandExecutor;
  const ffmpegCommand = normalizeCommand(options.ffmpegCommand, "ffmpeg");
  const ffprobeCommand = normalizeCommand(options.ffprobeCommand, "ffprobe");
  const mkdir =
    options.mkdir ??
    (async (targetPath: string) => {
      await fs.mkdir(targetPath, { recursive: true });
    });
  const readdir = options.readdir ?? ((targetPath: string) => fs.readdir(targetPath));
  const stat =
    options.stat ??
    (async (targetPath: string) => {
      return fs.stat(targetPath);
    });

  return {
    async prepareForAiUpload(
      input: PreUploadCompressionRequest,
      signal: AbortSignal
    ): Promise<PreUploadCompressionResult> {
      throwIfCancelled(signal);
      const warnings: string[] = [];
      const { session, downloadResult, profile } = input;

      await mkdir(session.artifacts.aiUploadDirectory);
      throwIfCancelled(signal);

      try {
        await commandExecutor(
          ffmpegCommand,
          buildNormalizedAudioArgs(downloadResult.downloadedPath, session.artifacts.normalizedAudioPath),
          signal
        );
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          throw new SummarizerError({
            category: "cancellation",
            message: "Media pre-upload compression cancelled by user.",
            recoverable: true,
            cause: error
          });
        }

        if (isSpawnNotFoundError(error)) {
          throw new SummarizerError({
            category: "runtime_unavailable",
            message: "ffmpeg is unavailable when preparing AI upload artifacts.",
            recoverable: false,
            cause: error
          });
        }

        const failure = normalizeFailure(error);
        throw new SummarizerError({
          category: "download_failure",
          message: `Normalized audio generation failed: ${failure.message}`,
          recoverable: true,
          cause: error
        });
      }

      if (!(await fileExists(session.artifacts.normalizedAudioPath, stat))) {
        throw new SummarizerError({
          category: "download_failure",
          message: "Normalized audio generation completed but normalized.wav is missing.",
          recoverable: false
        });
      }

      const presets = getPresets(profile);
      const failures: ConversionFailureDetails[] = [];

      for (const preset of presets) {
        throwIfCancelled(signal);
        const outputPath = path.join(session.artifacts.aiUploadDirectory, `ai-upload.${preset.extension}`);

        try {
          await commandExecutor(
            ffmpegCommand,
            preset.buildArgs(session.artifacts.normalizedAudioPath, outputPath),
            signal
          );
        } catch (error) {
          if (isAbortError(error) || signal.aborted) {
            throw new SummarizerError({
              category: "cancellation",
              message: "Media pre-upload compression cancelled by user.",
              recoverable: true,
              cause: error
            });
          }

          if (isSpawnNotFoundError(error)) {
            throw new SummarizerError({
              category: "runtime_unavailable",
              message: "ffmpeg is unavailable when preparing AI upload artifacts.",
              recoverable: false,
              cause: error
            });
          }

          failures.push(normalizeFailure(error));
          continue;
        }

        if (!(await fileExists(outputPath, stat))) {
          failures.push({
            message: `Output artifact missing for codec ${preset.codec}.`,
            stderr: ""
          });
          continue;
        }

        if (failures.length > 0) {
          warnings.push(
            `Compression fallback applied. Selected codec ${preset.codec} after ${failures.length} failed attempt(s).`
          );
        }

        let aiUploadArtifactPaths = [outputPath];
        let durationMs: number | null = null;
        try {
          durationMs = await probeDurationMs(outputPath, commandExecutor, signal, ffprobeCommand);
        } catch (error) {
          if (isAbortError(error) || signal.aborted) {
            throw new SummarizerError({
              category: "cancellation",
              message: "Media pre-upload compression cancelled by user.",
              recoverable: true,
              cause: error
            });
          }

          warnings.push(
            `Skipping duration probe for AI upload artifact: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        if (durationMs !== null && durationMs > CHUNK_THRESHOLD_SECONDS * 1000) {
          if (input.artifactMode === "single_artifact") {
            warnings.push(
              `Single AI upload artifact retained for long media (${Math.round(durationMs / 1000)}s) for file-upload transcription.`
            );
          } else {
            const chunkPattern = path.join(
              session.artifacts.aiUploadDirectory,
              `chunk-%04d.${preset.extension}`
            );
            try {
              await commandExecutor(ffmpegCommand, buildChunkArgs(outputPath, chunkPattern), signal);
              const entries = await readdir(session.artifacts.aiUploadDirectory);
              const chunkFiles = entries
                .filter((entry) => chunkFilenamePattern(preset.extension).test(entry))
                .sort(compareByNameAscending)
                .map((entry) => path.join(session.artifacts.aiUploadDirectory, entry));

              if (chunkFiles.length > 0) {
                aiUploadArtifactPaths = chunkFiles;
                warnings.push(
                  `Chunking applied for long media (${Math.round(durationMs / 1000)}s -> ${chunkFiles.length} chunks).`
                );
              }
            } catch (error) {
              if (isAbortError(error) || signal.aborted) {
                throw new SummarizerError({
                  category: "cancellation",
                  message: "Media pre-upload compression cancelled by user.",
                  recoverable: true,
                  cause: error
                });
              }

              warnings.push(
                `Chunking skipped after failure: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }

        const chunkDurationsMs: number[] = [];
        for (const artifactPath of aiUploadArtifactPaths) {
          try {
            const artifactDurationMs = await probeDurationMs(
              artifactPath,
              commandExecutor,
              signal,
              ffprobeCommand
            );
            chunkDurationsMs.push(artifactDurationMs ?? 0);
          } catch (error) {
            if (isAbortError(error) || signal.aborted) {
              throw new SummarizerError({
                category: "cancellation",
                message: "Media pre-upload compression cancelled by user.",
                recoverable: true,
                cause: error
              });
            }

            chunkDurationsMs.push(0);
            warnings.push(
              `Chunk duration probe failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        const result: PreUploadCompressionResult = {
          normalizedAudioPath: session.artifacts.normalizedAudioPath,
          aiUploadArtifactPaths,
          selectedCodec: preset.codec,
          chunkCount: aiUploadArtifactPaths.length,
          chunkDurationsMs,
          vadApplied: false,
          warnings
        };

        try {
          await updateArtifactManifestWithCompression(session.artifacts.metadataPath, result);
        } catch (error) {
          throw new SummarizerError({
            category: "download_failure",
            message: `Artifact manifest update failed: ${error instanceof Error ? error.message : String(error)}`,
            recoverable: true,
            cause: error
          });
        }

        return result;
      }

      const failureSummary = failures
        .map((failure, index) => `#${index + 1} ${failure.message}`)
        .join(" | ");

      throw new SummarizerError({
        category: "download_failure",
        message: `Failed to generate AI upload artifact: ${failureSummary || "unknown failure"}`,
        recoverable: true
      });
    }
  };
}
