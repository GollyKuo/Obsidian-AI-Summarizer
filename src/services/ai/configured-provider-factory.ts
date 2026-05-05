import { SummarizerError } from "@domain/errors";
import type { AISummarizerPluginSettings } from "@domain/settings";
import type {
  MediaSummaryDraft,
  MediaSummaryInput,
  MediaTranscriptionInput,
  MediaTranscriptionResult,
  TranscriptCleanupInput,
  WebpageAiInput,
  WebpageSummaryResult
} from "@domain/types";
import type { SummaryProvider, TranscriptCleanupProvider } from "@services/ai/ai-provider";
import { generateGeminiText } from "@services/ai/gemini-client";
import { transcribeWithGemini } from "@services/ai/gemini-transcription-provider";
import { transcribeWithGladia } from "@services/ai/gladia-transcription-provider";
import { generateMistralText } from "@services/ai/mistral-client";
import { generateOpenRouterText } from "@services/ai/openrouter-client";
import {
  buildMediaSummaryPrompt,
  buildTranscriptCleanupPrompt,
  buildWebpageSummaryPrompt
} from "@services/ai/prompt-builder";
import {
  formatTranscriptMarkdown,
  parseTranscriptMarkdownToSegments,
  type TranscriptionProvider
} from "@services/ai/transcription-provider";

const DEFAULT_GEMINI_TRANSCRIPTION_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_GEMINI_FILE_POLL_INTERVAL_MS = 3_000;
const DEFAULT_GEMINI_FILE_MAX_POLLING_MS = 10 * 60_000;

export interface ConfiguredAiProviderOptions {
  fetchImpl?: typeof fetch;
  gladiaPollIntervalMs?: number;
  gladiaMaxPollingMs?: number;
  gladiaRequestTimeoutMs?: number;
  geminiFilePollIntervalMs?: number;
  geminiFileMaxPollingMs?: number;
  geminiTranscriptionRequestTimeoutMs?: number;
}

export function createConfiguredSummaryProvider(
  settings: AISummarizerPluginSettings,
  options: ConfiguredAiProviderOptions = {}
): SummaryProvider {
  async function generateConfiguredSummaryText(input: {
    summaryProvider: MediaSummaryInput["summaryProvider"];
    summaryModel: string;
    prompt: string;
    signal: AbortSignal;
  }): Promise<string> {
    if (input.summaryProvider === "openrouter") {
      return generateOpenRouterText({
        apiKey: settings.openRouterApiKey,
        model: input.summaryModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    if (input.summaryProvider === "mistral") {
      return generateMistralText({
        apiKey: settings.mistralApiKey,
        model: input.summaryModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    return generateGeminiText({
      apiKey: settings.apiKey,
      model: input.summaryModel,
      parts: [{ text: input.prompt }],
      signal: input.signal,
      fetchImpl: options.fetchImpl
    });
  }

  return {
    async summarizeMedia(input: MediaSummaryInput, signal: AbortSignal): Promise<MediaSummaryDraft> {
      const prompt = buildMediaSummaryPrompt(input);
      const summaryMarkdown = await generateConfiguredSummaryText({
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel,
        prompt,
        signal
      });

      return { summaryMarkdown, warnings: [] };
    },

    async summarizeWebpage(input: WebpageAiInput, signal: AbortSignal): Promise<WebpageSummaryResult> {
      const prompt = buildWebpageSummaryPrompt(input);
      const summaryMarkdown = await generateConfiguredSummaryText({
        summaryProvider: input.summaryProvider,
        summaryModel: input.summaryModel,
        prompt,
        signal
      });

      return { summaryMarkdown, warnings: [] };
    }
  };
}

export function createConfiguredTranscriptCleanupProvider(
  settings: AISummarizerPluginSettings,
  options: ConfiguredAiProviderOptions = {}
): TranscriptCleanupProvider {
  async function generateConfiguredCleanupText(input: {
    cleanupProvider: TranscriptCleanupInput["cleanupProvider"];
    cleanupModel: string;
    prompt: string;
    signal: AbortSignal;
  }): Promise<string> {
    if (input.cleanupProvider === "openrouter") {
      return generateOpenRouterText({
        apiKey: settings.openRouterApiKey,
        model: input.cleanupModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    if (input.cleanupProvider === "mistral") {
      return generateMistralText({
        apiKey: settings.mistralApiKey,
        model: input.cleanupModel,
        prompt: input.prompt,
        signal: input.signal,
        fetchImpl: options.fetchImpl
      });
    }

    return generateGeminiText({
      apiKey: settings.apiKey,
      model: input.cleanupModel,
      parts: [{ text: input.prompt }],
      signal: input.signal,
      fetchImpl: options.fetchImpl
    });
  }

  return {
    async cleanupTranscript(
      input: TranscriptCleanupInput,
      signal: AbortSignal
    ): Promise<MediaTranscriptionResult> {
      const transcriptMarkdown = await generateConfiguredCleanupText({
        cleanupProvider: input.cleanupProvider,
        cleanupModel: input.cleanupModel,
        prompt: buildTranscriptCleanupPrompt(input),
        signal
      });

      return {
        transcript: parseTranscriptMarkdownToSegments(transcriptMarkdown, { requireTiming: true }),
        transcriptMarkdown,
        warnings: []
      };
    }
  };
}

export function createConfiguredTranscriptionProvider(
  settings: AISummarizerPluginSettings,
  options: ConfiguredAiProviderOptions = {}
): TranscriptionProvider {
  return {
    async transcribeMedia(
      input: MediaTranscriptionInput,
      signal: AbortSignal
    ): Promise<MediaTranscriptionResult> {
      if (input.transcript.length > 0) {
        return {
          transcript: input.transcript,
          transcriptMarkdown: formatTranscriptMarkdown(input.transcript),
          warnings: []
        };
      }

      const aiUploadArtifactPaths = input.aiUploadArtifactPaths ?? [];
      if (aiUploadArtifactPaths.length === 0) {
        throw new SummarizerError({
          category: "ai_failure",
          message: "Media transcription requires AI-ready audio artifacts, but none were provided.",
          recoverable: true
        });
      }

      if (input.transcriptionProvider === "gladia") {
        return transcribeWithGladia(input, signal, {
          apiKey: settings.gladiaApiKey,
          fetchImpl: options.fetchImpl,
          requestTimeoutMs: options.gladiaRequestTimeoutMs,
          pollIntervalMs: options.gladiaPollIntervalMs,
          maxPollingMs: options.gladiaMaxPollingMs
        });
      }

      return transcribeWithGemini({
        apiKey: settings.apiKey,
        model: input.transcriptionModel,
        normalizedText: input.normalizedText,
        artifactPaths: aiUploadArtifactPaths,
        signal,
        fetchImpl: options.fetchImpl,
        artifactMetadataPath: input.artifactMetadataPath,
        strategy: settings.geminiTranscriptionStrategy,
        filePollIntervalMs: options.geminiFilePollIntervalMs ?? DEFAULT_GEMINI_FILE_POLL_INTERVAL_MS,
        fileMaxPollingMs: options.geminiFileMaxPollingMs ?? DEFAULT_GEMINI_FILE_MAX_POLLING_MS,
        requestTimeoutMs: options.geminiTranscriptionRequestTimeoutMs ?? DEFAULT_GEMINI_TRANSCRIPTION_TIMEOUT_MS
      });
    }
  };
}
