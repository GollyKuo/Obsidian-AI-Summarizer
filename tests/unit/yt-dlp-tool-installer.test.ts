import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ensureLatestProjectYtDlpTool,
  getProjectYtDlpToolPaths
} from "@services/media/yt-dlp-tool-installer";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function makeTempDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "yt-dlp-tool-installer-"));
}

function releaseJson(version: string): string {
  return JSON.stringify({ tag_name: version });
}

function checksumText(body: string): string {
  return `${sha256(body)}  yt-dlp.exe\n`;
}

describe("yt-dlp tool installer", () => {
  it("downloads and installs project-local yt-dlp on Windows", async () => {
    const tempDirectory = await makeTempDirectory();
    const executableBody = "fake-yt-dlp";
    const downloadAttempts: string[] = [];

    try {
      const result = await ensureLatestProjectYtDlpTool(tempDirectory, {
        platform: "win32",
        fetchText: async (url) =>
          url.endsWith("SHA2-256SUMS") ? checksumText(executableBody) : releaseJson("2026.04.30"),
        downloadFile: async (source, destinationPath) => {
          downloadAttempts.push(source.name);
          await writeFile(destinationPath, executableBody, "utf8");
        },
        now: () => new Date("2026-05-05T00:00:00.000Z")
      });

      expect(result.installed).toBe(true);
      expect(result.version).toBe("2026.04.30");
      expect(result.sourceName).toBe("GitHub release");
      expect(result.sourceUrl).toBe(
        "https://github.com/yt-dlp/yt-dlp/releases/download/2026.04.30/yt-dlp.exe"
      );
      expect(downloadAttempts).toEqual(["GitHub release"]);
      expect(await readFile(result.ytDlpPath, "utf8")).toBe(executableBody);

      const metadata = JSON.parse(
        await readFile(path.join(result.installRoot, "install-metadata.json"), "utf8")
      ) as { source: string; version: string; sha256: string; installedAt: string };
      expect(metadata).toMatchObject({
        source: result.sourceUrl,
        version: "2026.04.30",
        sha256: sha256(executableBody),
        installedAt: "2026-05-05T00:00:00.000Z"
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("skips download when project-local yt-dlp matches latest metadata", async () => {
    const tempDirectory = await makeTempDirectory();
    const executableBody = "existing-yt-dlp";
    const executableSha256 = sha256(executableBody);
    const paths = getProjectYtDlpToolPaths(tempDirectory, "win32");

    try {
      await mkdir(paths.binDirectory, { recursive: true });
      await writeFile(paths.ytDlpPath, executableBody, "utf8");
      await writeFile(
        path.join(paths.installRoot, "install-metadata.json"),
        JSON.stringify({
          source: "https://github.com/yt-dlp/yt-dlp/releases/download/2026.04.30/yt-dlp.exe",
          version: "2026.04.30",
          sha256: executableSha256,
          installedAt: "2026-05-05T00:00:00.000Z"
        }),
        "utf8"
      );

      const result = await ensureLatestProjectYtDlpTool(tempDirectory, {
        platform: "win32",
        fetchText: async (url) =>
          url.endsWith("SHA2-256SUMS") ? checksumText(executableBody) : releaseJson("2026.04.30"),
        downloadFile: async () => {
          throw new Error("download should not be called");
        }
      });

      expect(result.installed).toBe(false);
      expect(result.sourceName).toBe("existing install");
      expect(result.ytDlpPath).toBe(paths.ytDlpPath);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("rejects checksum mismatches and cleans temporary downloads", async () => {
    const tempDirectory = await makeTempDirectory();

    try {
      await expect(
        ensureLatestProjectYtDlpTool(tempDirectory, {
          platform: "win32",
          fetchText: async (url) =>
            url.endsWith("SHA2-256SUMS") ? checksumText("expected") : releaseJson("2026.04.30"),
          downloadFile: async (_source, destinationPath) => {
            await writeFile(destinationPath, "actual", "utf8");
          }
        })
      ).rejects.toThrow(/SHA-256 mismatch/);

      await expect(readFile(path.join(tempDirectory, "tools", "yt-dlp", ".download", "yt-dlp.exe"))).rejects.toThrow();
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("stops before download when the install is cancelled", async () => {
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      ensureLatestProjectYtDlpTool("unused", {
        platform: "win32",
        signal: abortController.signal,
        fetchText: async () => {
          throw new Error("fetch should not be called");
        },
        downloadFile: async () => {
          throw new Error("download should not be called");
        }
      })
    ).rejects.toThrow(/cancelled/);
  });

  it("rejects automatic install outside Windows", async () => {
    await expect(
      ensureLatestProjectYtDlpTool("unused", {
        platform: "darwin"
      })
    ).rejects.toThrow(/Windows desktop/);
  });
});
