import type {
  MediaSummaryResult,
  SourceType,
  WebpageSummaryResult,
  WriteResult
} from "@domain/types";
import type { ErrorCategory } from "@domain/errors";

export type JobStatus =
  | "idle"
  | "validating"
  | "acquiring"
  | "transcribing"
  | "cleaning"
  | "summarizing"
  | "writing"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobFailure {
  category: ErrorCategory;
  message: string;
}

export interface JobResult {
  sourceType: SourceType;
  noteWriteResult: WriteResult;
  mediaSummaryResult?: MediaSummaryResult;
  webpageSummaryResult?: WebpageSummaryResult;
}

export interface SummarizerJobState {
  status: JobStatus;
  stageMessage: string | null;
  warnings: string[];
  result: JobResult | null;
  failure: JobFailure | null;
}

export const INITIAL_JOB_STATE: SummarizerJobState = {
  status: "idle",
  stageMessage: null,
  warnings: [],
  result: null,
  failure: null
};
