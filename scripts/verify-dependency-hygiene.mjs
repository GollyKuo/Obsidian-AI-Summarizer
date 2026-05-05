import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const tsconfigJson = await readJsonIfExists(path.join(rootDir, "tsconfig.json"));

const ignoredDirectories = new Set([".git", "build", "dist", "node_modules"]);
const ignoredFiles = new Set(["main.js", "package-lock.json"]);
const scannedExtensions = new Set([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"]);
const workspaceAliases = new Set([
  "@domain",
  "@orchestration",
  "@plugin",
  "@runtime",
  "@services",
  "@ui",
  "@utils"
]);

const commandPackageMap = new Map([
  ["eslint", "eslint"],
  ["esbuild", "esbuild"],
  ["tsc", "typescript"],
  ["vitest", "vitest"]
]);

const configPackagePatterns = new Map([
  ["@eslint/js", /from\s+["']@eslint\/js["']/],
  ["typescript-eslint", /from\s+["']typescript-eslint["']/],
  ["@types/node", /"types"\s*:\s*\[[^\]]*"node"/s],
  ["obsidian", /from\s+["']obsidian["']/]
]);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await listSourceFiles(path.join(directory, entry.name))));
      }
      continue;
    }

    if (ignoredFiles.has(entry.name)) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (scannedExtensions.has(extension)) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

function extractPackageName(specifier) {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("node:") ||
    specifier.startsWith("/") ||
    workspaceAliases.has(specifier.split("/")[0])
  ) {
    return null;
  }

  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : null;
  }

  return specifier.split("/")[0] ?? null;
}

function collectImports(contents, usedPackages) {
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^"']+\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const packageName = extractPackageName(match[1]);
      if (packageName) {
        usedPackages.add(packageName);
      }
    }
  }
}

function collectScriptPackages(usedPackages) {
  const scripts = packageJson.scripts ?? {};

  for (const command of Object.values(scripts)) {
    for (const [binary, packageName] of commandPackageMap) {
      if (new RegExp(`(^|\\s|&&|\\|\\|)${binary}(\\s|$)`).test(command)) {
        usedPackages.add(packageName);
      }
    }
  }
}

function collectConfigPackages(workspaceText, usedPackages) {
  for (const [packageName, pattern] of configPackagePatterns) {
    if (pattern.test(workspaceText)) {
      usedPackages.add(packageName);
    }
  }
}

const sourceFiles = await listSourceFiles(rootDir);
const usedPackages = new Set();
const workspaceChunks = [JSON.stringify(packageJson, null, 2), JSON.stringify(tsconfigJson, null, 2)];

for (const file of sourceFiles) {
  const contents = await readFile(file, "utf8");
  workspaceChunks.push(contents);
  collectImports(contents, usedPackages);
}

collectScriptPackages(usedPackages);
collectConfigPackages(workspaceChunks.join("\n"), usedPackages);

const declaredPackages = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

const unusedPackages = Object.keys(declaredPackages).filter((packageName) => !usedPackages.has(packageName));

if (unusedPackages.length > 0) {
  console.error("Unused dependencies detected:");
  for (const packageName of unusedPackages) {
    console.error(`- ${packageName}`);
  }
  process.exitCode = 1;
} else {
  console.log("Dependency hygiene check passed.");
}
