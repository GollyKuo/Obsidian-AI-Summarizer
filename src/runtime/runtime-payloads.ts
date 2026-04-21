import type { RetentionMode, SourceType } from "@domain/types";

export interface RuntimeRequestPayload {
  sourceKind: SourceType;
  sourceValue: string;
  model: string;
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
