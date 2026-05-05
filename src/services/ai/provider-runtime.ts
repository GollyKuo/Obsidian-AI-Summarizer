import { SummarizerError } from "@domain/errors";
import { throwIfCancelled } from "@orchestration/cancellation";

export const DEFAULT_AI_TIMEOUT_MS = 120_000;

export type ProviderDiagnosticsName = "Gemini" | "OpenRouter" | "Mistral";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getKeys(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : [];
}

export function getValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  return value === null ? "null" : typeof value;
}

export function buildProviderDiagnostics(input: {
  provider: ProviderDiagnosticsName;
  failureKind: string;
  model?: string;
  status?: number;
  providerError?: string;
  responseShape?: Record<string, unknown>;
  bodyExcerpt?: string;
  errorMessage?: string;
  artifactPath?: string;
  remoteFileName?: string;
  remoteFileState?: string;
}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== "")
  );
}

export function getFetchImplementation(fetchImpl?: typeof fetch): typeof fetch {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (!resolvedFetch) {
    throw new SummarizerError({
      category: "runtime_unavailable",
      message: "Current runtime does not provide fetch for AI requests.",
      recoverable: false
    });
  }
  return resolvedFetch;
}

export function requireApiKey(apiKey: string, provider: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    throw new SummarizerError({
      category: "validation_error",
      message: `${provider} API key is empty.`,
      recoverable: true
    });
  }
  return trimmed;
}

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS
): Promise<Response> {
  throwIfCancelled(signal);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = (): void => controller.abort();
  signal.addEventListener("abort", abort, { once: true });

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (signal.aborted || controller.signal.aborted) {
      throw new SummarizerError({
        category: signal.aborted ? "cancellation" : "ai_failure",
        message: signal.aborted ? "AI request cancelled by user." : "AI request timed out.",
        recoverable: true,
        cause: error
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
