import { SummarizerError } from "@domain/errors";

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeAbortError = error as { name?: unknown; code?: unknown };
  return maybeAbortError.name === "AbortError" || maybeAbortError.code === "ABORT_ERR";
}

export function toCancellationError(
  message = "Operation cancelled by user.",
  cause?: unknown
): SummarizerError {
  return new SummarizerError({
    category: "cancellation",
    message,
    recoverable: true,
    cause
  });
}

export function throwIfCancelled(signal: AbortSignal, message?: string): void {
  if (signal.aborted) {
    throw toCancellationError(message);
  }
}

export function abortableSleep(
  ms: number,
  signal: AbortSignal,
  message = "Operation cancelled by user."
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(toCancellationError(message));
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (): void => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      signal.removeEventListener("abort", abort);
    };
    const abort = (): void => {
      cleanup();
      reject(toCancellationError(message));
    };

    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function withAbortSignal<T>(
  signal: AbortSignal,
  controller: AbortController,
  operation: (linkedSignal: AbortSignal) => Promise<T>,
  message = "Operation cancelled by user."
): Promise<T> {
  throwIfCancelled(signal, message);
  const abort = (): void => {
    controller.abort();
  };
  signal.addEventListener("abort", abort, { once: true });

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (signal.aborted) {
      throw toCancellationError(message, error);
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
