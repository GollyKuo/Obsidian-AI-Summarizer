import type { JobStatus } from "@domain/jobs";
import { throwIfCancelled } from "@orchestration/cancellation";

export interface JobRunHooks {
  onStageChange?: (status: JobStatus, message: string) => void;
  onWarning?: (warning: string) => void;
}

export async function runJobStep<T>(
  status: JobStatus,
  message: string,
  signal: AbortSignal,
  execute: () => Promise<T>,
  hooks?: JobRunHooks
): Promise<T> {
  throwIfCancelled(signal);
  hooks?.onStageChange?.(status, message);
  const result = await execute();
  throwIfCancelled(signal);
  return result;
}

export function emitWarnings(warnings: string[], hooks?: JobRunHooks): void {
  for (const warning of warnings) {
    hooks?.onWarning?.(warning);
  }
}
