import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const PACKAGE_LOCK_PATH = path.join(ROOT, "package-lock.json");
const VERSIONS_PATH = path.join(ROOT, "versions.json");

const OBSIDIAN_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [manifest, packageJson, packageLock, versions] = await Promise.all([
    readJson(MANIFEST_PATH),
    readJson(PACKAGE_JSON_PATH),
    readJson(PACKAGE_LOCK_PATH),
    readJson(VERSIONS_PATH)
  ]);

  assert(manifest.id === "ai-summarizer", `manifest id must be ai-summarizer, got ${manifest.id}`);
  assert(!manifest.id.includes("obsidian"), "manifest id must not contain obsidian");
  assert(
    OBSIDIAN_VERSION_PATTERN.test(manifest.version),
    `manifest version must use x.y.z format, got ${manifest.version}`
  );
  assert(packageJson.version === manifest.version, "package.json version must match manifest version");
  assert(packageLock.version === manifest.version, "package-lock.json version must match manifest version");
  if (packageLock.packages?.[""]) {
    assert(
      packageLock.packages[""].version === manifest.version,
      "package-lock root package version must match manifest version"
    );
  }
  assert(
    versions[manifest.version] === manifest.minAppVersion,
    "versions.json must map manifest version to manifest minAppVersion"
  );

  if (process.env.GITHUB_REF_TYPE === "tag") {
    assert(
      process.env.GITHUB_REF_NAME === manifest.version,
      `GitHub release tag must match manifest version: tag=${process.env.GITHUB_REF_NAME}, manifest=${manifest.version}`
    );
  }

  console.log(`[release-metadata] ${manifest.id} ${manifest.version} is ready for release assets.`);
}

try {
  await main();
} catch (error) {
  console.error(`[release-metadata] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

