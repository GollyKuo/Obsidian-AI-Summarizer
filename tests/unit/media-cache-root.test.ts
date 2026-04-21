import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveDefaultMediaCacheRoot,
  resolveMediaCacheRoot,
  validateMediaCacheRootPath
} from "@services/media/media-cache-root";

describe("media cache root", () => {
  it("rejects non-absolute configured path", () => {
    try {
      validateMediaCacheRootPath("relative/path");
      expect.fail("Expected validation error for relative path");
    } catch (error) {
      expect(error).toMatchObject({
        category: "validation_error"
      });
    }
  });

  it("resolves win32 default path from LOCALAPPDATA", () => {
    const resolved = resolveDefaultMediaCacheRoot({
      platform: "win32",
      env: {
        LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local"
      } as NodeJS.ProcessEnv,
      homedir: "C:\\Users\\tester"
    });

    expect(resolved).toBe(
      path.join("C:\\Users\\tester\\AppData\\Local", "ObsidianAI-Summarizer", "media-cache")
    );
  });

  it("resolves configured absolute path and marks non-default", async () => {
    const tempBaseDir = await mkdtemp(path.join(os.tmpdir(), "ai-summarizer-cache-"));
    const configuredDir = path.join(tempBaseDir, "custom-cache-root");

    const result = await resolveMediaCacheRoot(configuredDir);
    expect(result.usedDefault).toBe(false);
    expect(result.rootPath).toBe(path.resolve(configuredDir));

    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it("resolves default cache root from XDG_CACHE_HOME when configured path is empty", async () => {
    const tempBaseDir = await mkdtemp(path.join(os.tmpdir(), "ai-summarizer-cache-default-"));
    const xdgCacheHome = path.join(tempBaseDir, "xdg-cache");

    const result = await resolveMediaCacheRoot("", {
      platform: "linux",
      env: {
        XDG_CACHE_HOME: xdgCacheHome
      } as NodeJS.ProcessEnv,
      homedir: path.join(tempBaseDir, "home")
    });

    expect(result.usedDefault).toBe(true);
    expect(result.rootPath).toBe(path.join(xdgCacheHome, "obsidian-ai-summarizer", "media-cache"));

    await rm(tempBaseDir, { recursive: true, force: true });
  });
});
