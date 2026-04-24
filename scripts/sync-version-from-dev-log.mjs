import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEV_LOG_PATH = path.resolve("docs", "dev_log.md");
const PACKAGE_JSON_PATH = path.resolve("package.json");
const PACKAGE_LOCK_PATH = path.resolve("package-lock.json");
const MANIFEST_PATH = path.resolve("manifest.json");
const VERSIONS_PATH = path.resolve("versions.json");

const VERSION_ENTRY_PATTERN =
  /^###\s+([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)\s+-\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s*$/m;

function parseLatestVersion(devLogContent) {
  const match = devLogContent.match(VERSION_ENTRY_PATTERN);
  if (!match) {
    throw new Error("Cannot find a version entry in docs/dev_log.md.");
  }

  return match[1];
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, ""));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function prependVersionMapping(versions, version, minAppVersion) {
  return {
    [version]: minAppVersion,
    ...Object.fromEntries(Object.entries(versions).filter(([key]) => key !== version))
  };
}

async function main() {
  const devLog = await readFile(DEV_LOG_PATH, "utf8");
  const version = parseLatestVersion(devLog);

  const [packageJson, packageLock, manifest, versions] = await Promise.all([
    readJson(PACKAGE_JSON_PATH),
    readJson(PACKAGE_LOCK_PATH),
    readJson(MANIFEST_PATH),
    readJson(VERSIONS_PATH)
  ]);

  packageJson.version = version;
  packageLock.version = version;
  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = version;
  }
  manifest.version = version;

  const nextVersions = prependVersionMapping(versions, version, manifest.minAppVersion);

  await Promise.all([
    writeJson(PACKAGE_JSON_PATH, packageJson),
    writeJson(PACKAGE_LOCK_PATH, packageLock),
    writeJson(MANIFEST_PATH, manifest),
    writeJson(VERSIONS_PATH, nextVersions)
  ]);

  console.log(`[version-sync] synced version ${version} from docs/dev_log.md`);
}

await main();
