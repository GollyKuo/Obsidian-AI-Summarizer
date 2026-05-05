import { requestUrl } from "obsidian";
import type { JobStatus } from "@domain/jobs";
import type {
  LocalMediaRequest,
  MediaUrlRequest,
  SourceType,
  TranscriptFileRequest,
  WebpageRequest
} from "@domain/types";
import { processMedia } from "@orchestration/process-media";
import { processTranscriptFile } from "@orchestration/process-transcript-file";
import { processWebpage } from "@orchestration/process-webpage";
import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import {
  createConfiguredSummaryProvider,
  createConfiguredTranscriptCleanupProvider,
  createConfiguredTranscriptionProvider
} from "@services/ai/configured-ai-provider";
import { ObsidianNoteWriter } from "@services/obsidian/note-writer";
import { VaultNoteStorage } from "@services/obsidian/vault-note-storage";
import { BasicMetadataExtractor } from "@services/web/metadata-extractor";
import { FetchWebpageExtractor } from "@services/web/webpage-extractor";
import { createRuntimeProvider } from "@runtime/runtime-factory";

export interface FlowJobRunnerOptions {
  plugin: AISummarizerPlugin;
  signal: AbortSignal;
  sourceType: SourceType;
  sourceValue: string;
  onStageChange: (status: JobStatus, message: string) => void;
  onWarning: (scope: string, warning: string) => void;
}

function localizeStageMessage(message: string): string {
  const messages: Record<string, string> = {
    "Validating webpage input": "驗證網頁輸入",
    "Fetching webpage content": "取得網頁內容",
    "Generating webpage summary": "摘要網頁內容",
    "Writing webpage note into vault": "寫入筆記",
    "Validating media input": "驗證媒體輸入",
    "Processing media URL input": "取得媒體",
    "Processing local media input": "準備本機媒體",
    "Generating media transcript": "轉錄媒體內容",
    "Cleaning transcript before summary": "校對逐字稿",
    "Generating media summary": "摘要媒體內容",
    "Writing media note into vault": "寫入筆記",
    "Validating media URL input": "驗證媒體 URL",
    "Preparing media acquisition session": "準備媒體暫存工作區",
    "Downloading media artifact": "下載媒體",
    "Preparing AI-ready media artifacts": "準備 AI 可處理的媒體",
    "Validating local media input": "驗證本機媒體",
    "Preparing local media ingestion session": "準備本機媒體暫存工作區",
    "Importing local media artifact": "匯入本機媒體",
    "Validating transcript file input": "驗證逐字稿檔案",
    "Reading transcript file": "讀取逐字稿",
    "Regenerating summary from transcript": "依逐字稿重新摘要",
    "Writing regenerated summary note into vault": "寫入筆記"
  };

  return messages[message] ?? message;
}

export async function runSummarizerFlow(options: FlowJobRunnerOptions): Promise<{ notePath: string }> {
  if (options.sourceType === "webpage_url") {
    return runWebpageFlow(options);
  }

  if (options.sourceType === "transcript_file") {
    return runTranscriptFileFlow(options);
  }

  return runMediaFlow(options);
}

async function runWebpageFlow(options: FlowJobRunnerOptions): Promise<{ notePath: string }> {
  const { plugin } = options;
  const result = await processWebpage(
    {
      sourceKind: "webpage_url",
      sourceValue: options.sourceValue,
      summaryProvider: plugin.settings.summaryProvider,
      summaryModel: plugin.settings.summaryModel
    } satisfies WebpageRequest,
    {
      webpageExtractor: new FetchWebpageExtractor(undefined, requestUrl),
      metadataExtractor: new BasicMetadataExtractor(),
      summaryProvider: createConfiguredSummaryProvider(plugin.settings),
      noteWriter: createNoteWriter(plugin)
    },
    options.signal,
    {
      onStageChange: (status, message) => {
        options.onStageChange(status, localizeStageMessage(message));
      },
      onWarning: (warning) => {
        options.onWarning("webpage_flow", warning);
      }
    }
  );

  return { notePath: result.writeResult.notePath };
}

async function runTranscriptFileFlow(options: FlowJobRunnerOptions): Promise<{ notePath: string }> {
  const { plugin } = options;
  const result = await processTranscriptFile(
    {
      sourceKind: "transcript_file",
      sourceValue: options.sourceValue,
      enableTranscriptCleanup: plugin.settings.enableTranscriptCleanup,
      transcriptCleanupFailureMode: plugin.settings.transcriptCleanupFailureMode,
      summaryProvider: plugin.settings.summaryProvider,
      summaryModel: plugin.settings.summaryModel
    } satisfies TranscriptFileRequest,
    {
      summaryProvider: createConfiguredSummaryProvider(plugin.settings),
      transcriptCleanupProvider: createConfiguredTranscriptCleanupProvider(plugin.settings),
      noteWriter: createNoteWriter(plugin)
    },
    options.signal,
    {
      onStageChange: (status, message) => {
        options.onStageChange(status, localizeStageMessage(message));
      },
      onWarning: (warning) => {
        options.onWarning("transcript_file_flow", warning);
      }
    }
  );

  return { notePath: result.writeResult.notePath };
}

async function runMediaFlow(options: FlowJobRunnerOptions): Promise<{ notePath: string }> {
  const { plugin } = options;
  const result = await processMedia(
    {
      sourceKind: options.sourceType,
      sourceValue: options.sourceValue,
      transcriptionProvider: plugin.settings.transcriptionProvider,
      transcriptionModel: plugin.settings.transcriptionModel,
      geminiTranscriptionStrategy: plugin.settings.geminiTranscriptionStrategy,
      enableTranscriptCleanup: plugin.settings.enableTranscriptCleanup,
      transcriptCleanupFailureMode: plugin.settings.transcriptCleanupFailureMode,
      summaryProvider: plugin.settings.summaryProvider,
      summaryModel: plugin.settings.summaryModel,
      retentionMode: plugin.settings.retentionMode,
      mediaCacheRoot: plugin.settings.mediaCacheRoot,
      ytDlpPath: plugin.settings.ytDlpPath,
      ffmpegPath: plugin.settings.ffmpegPath,
      ffprobePath: plugin.settings.ffprobePath,
      mediaCompressionProfile: plugin.settings.mediaCompressionProfile
    } as MediaUrlRequest | LocalMediaRequest,
    {
      runtimeProvider: createRuntimeProvider(plugin.settings.runtimeStrategy),
      transcriptionProvider: createConfiguredTranscriptionProvider(plugin.settings),
      transcriptCleanupProvider: createConfiguredTranscriptCleanupProvider(plugin.settings),
      summaryProvider: createConfiguredSummaryProvider(plugin.settings),
      noteWriter: createNoteWriter(plugin)
    },
    options.signal,
    {
      onStageChange: (status, message) => {
        options.onStageChange(status, localizeStageMessage(message));
      },
      onWarning: (warning) => {
        options.onWarning("media_flow", warning);
      }
    }
  );

  return { notePath: result.writeResult.notePath };
}

function createNoteWriter(plugin: AISummarizerPlugin): ObsidianNoteWriter {
  return new ObsidianNoteWriter(new VaultNoteStorage(plugin.app.vault), {
    outputFolder: plugin.settings.outputFolder,
    templateReference: plugin.settings.templateReference,
    generateFlashcards: plugin.settings.generateFlashcards
  });
}
