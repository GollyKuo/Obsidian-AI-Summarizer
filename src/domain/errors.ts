export type ErrorCategory =
  | "validation_error"
  | "runtime_unavailable"
  | "download_failure"
  | "ai_failure"
  | "note_write_failure"
  | "cancellation";

export interface SummarizerErrorPayload {
  category: ErrorCategory;
  message: string;
  recoverable: boolean;
  cause?: unknown;
}

export class SummarizerError extends Error {
  public readonly category: ErrorCategory;
  public readonly recoverable: boolean;
  public readonly causeValue?: unknown;

  public constructor(payload: SummarizerErrorPayload) {
    super(payload.message);
    this.name = "SummarizerError";
    this.category = payload.category;
    this.recoverable = payload.recoverable;
    this.causeValue = payload.cause;
  }
}
