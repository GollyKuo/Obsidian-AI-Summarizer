import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("smoke checklist script", () => {
  it("writes an evidence record for a selected capability", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ai-summarizer-smoke-"));
    const recordPath = path.join(tempDir, "records", "webpage.json");

    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          "scripts/smoke-checklist.mjs",
          "--capability",
          "webpage",
          "--record",
          recordPath,
          "--operator",
          "Release Tester",
          "--result",
          "pass",
          "--notes",
          "desktop smoke completed"
        ],
        { cwd: process.cwd() }
      );

      const record = JSON.parse(await readFile(recordPath, "utf8"));
      expect(stdout).toContain("[smoke-checklist] wrote record:");
      expect(record).toMatchObject({
        schemaVersion: 1,
        operator: "Release Tester",
        scope: { type: "capability", value: "webpage" },
        result: "pass",
        notes: "desktop smoke completed"
      });
      expect(Date.parse(record.recordedAt)).not.toBeNaN();
      expect(record.capabilities).toHaveLength(1);
      expect(record.capabilities[0]).toMatchObject({
        capability: "webpage",
        label: "Webpage",
        result: "pass",
        notes: "desktop smoke completed"
      });
      expect(record.capabilities[0].steps.length).toBeGreaterThan(0);
      expect(record.capabilities[0].expected.length).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid evidence results", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "scripts/smoke-checklist.mjs",
          "--capability",
          "webpage",
          "--record",
          path.join(tmpdir(), "ai-summarizer-smoke-invalid.json"),
          "--result",
          "skipped"
        ],
        { cwd: process.cwd() }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--result must be one of: pending, pass, fail")
    });
  });
});
