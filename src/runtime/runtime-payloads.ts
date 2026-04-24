import type {
  SummaryModel,
  SummaryProvider,
  TranscriptionModel,
  TranscriptionProvider
} from "@domain/model-selection";
import type { RetentionMode, SourceType } from "@domain/types";

export interface RuntimeRequestPayload {
  sourceKind: SourceType;
  sourceValue: string;
  transcriptionProvider: TranscriptionProvider;
  transcriptionModel: TranscriptionModel;
  summaryProvider: SummaryProvider;
  summaryModel: SummaryModel;
  apiKey: string;
  retentionMode: RetentionMode;
  templateReference: string;
  cancellationTokenId: string;
}

export interface RuntimeResponsePayload {
  ok: boolean;
  warnings: string[];
  message?: string;
}
