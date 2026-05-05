import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

const RELEASE_ASSETS = [
  "main.js",
  "manifest.json",
  "styles.css",
  "versions.json"
];

const PACKAGE_METADATA = [
  "package.json",
  "package-lock.json"
];

const CHECKS = [
  {
    name: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{12,}\b/g
  },
  {
    name: "OpenAI/OpenRouter style API key",
    pattern: /\bsk-[0-9A-Za-z_-]{8,}\b/g
  },
  {
    name: "Bearer token",
    pattern: /\bBearer\s+[0-9A-Za-z._~+/-]{12,}=*/gi
  },
  {
    name: "private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g
  },
  {
    name: "Windows user/vault path",
    pattern: /\b[A-Za-z]:\\(?:Users\\[^\\\r\n]+|[^\\\r\n]*(?:Obsidian Test|Vault|vault|程式開發)[^\\\r\n]*)/g
  },
  {
    name: "Unix user path",
    pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/[^\s"'`<>)]*)?/g
  },
  {
    name: "test vault artifact",
    pattern: /(?:Obsidian Test|ai-summarizer-transcript-|configured-ai-provider-|ffmpeg-tool-installer-)/g
  }
];

async function readRequiredText(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  try {
    await access(absolutePath);
  } catch {
    throw new Error(`missing ${relativePath}; run npm run build before privacy verification`);
  }
  return readFile(absolutePath, "utf8");
}

function makeExcerpt(text, index) {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + 80);
  return text.slice(start, end).replace(/\s+/g, " ");
}

async function scanFile(relativePath) {
  const content = await readRequiredText(relativePath);
  const findings = [];

  for (const check of CHECKS) {
    check.pattern.lastIndex = 0;
    for (const match of content.matchAll(check.pattern)) {
      findings.push({
        file: relativePath,
        check: check.name,
        excerpt: makeExcerpt(content, match.index ?? 0)
      });
    }
  }

  return findings;
}

async function main() {
  const files = [...RELEASE_ASSETS, ...PACKAGE_METADATA];
  const findings = (await Promise.all(files.map(scanFile))).flat();
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `[release-privacy] ${finding.file}: ${finding.check}: ${finding.excerpt}`
      );
    }
    throw new Error(`privacy scan found ${findings.length} issue(s)`);
  }

  console.log(`[release-privacy] scanned ${files.length} release/package file(s); no private material detected.`);
}

try {
  await main();
} catch (error) {
  console.error(`[release-privacy] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
