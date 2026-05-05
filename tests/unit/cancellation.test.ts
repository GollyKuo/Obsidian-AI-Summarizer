import { describe, expect, it, vi } from "vitest";
import {
  abortableSleep,
  isAbortError,
  throwIfCancelled,
  toCancellationError,
  withAbortSignal
} from "@orchestration/cancellation";

describe("cancellation helpers", () => {
  it("normalizes aborted signals into cancellation errors", () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => throwIfCancelled(controller.signal, "Stopped")).toThrow(
      expect.objectContaining({
        category: "cancellation",
        message: "Stopped"
      })
    );
    expect(toCancellationError("Stopped")).toMatchObject({
      category: "cancellation",
      message: "Stopped",
      recoverable: true
    });
  });

  it("detects platform abort errors", () => {
    expect(isAbortError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(true);
    expect(isAbortError(Object.assign(new Error("aborted"), { code: "ABORT_ERR" }))).toBe(true);
    expect(isAbortError(new Error("other"))).toBe(false);
  });

  it("cancels sleep when the signal aborts", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const sleep = abortableSleep(10_000, controller.signal, "Polling stopped");

    controller.abort();
    await expect(sleep).rejects.toMatchObject({
      category: "cancellation",
      message: "Polling stopped"
    });

    vi.useRealTimers();
  });

  it("links a parent abort signal to an operation signal", async () => {
    const parent = new AbortController();
    const child = new AbortController();

    const operation = withAbortSignal(
      parent.signal,
      child,
      async (linkedSignal) => {
        parent.abort();
        expect(linkedSignal.aborted).toBe(true);
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
      "Request stopped"
    );

    await expect(operation).rejects.toMatchObject({
      category: "cancellation",
      message: "Request stopped"
    });
  });
});
