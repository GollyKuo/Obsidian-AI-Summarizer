import { SummarizerError } from "@domain/errors";

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new SummarizerError({
      category: "cancellation",
      message: "Operation cancelled by user.",
      recoverable: true
    });
  }
}
