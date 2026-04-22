import esbuild from "esbuild";
import { copyFile, mkdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

function getArgValue(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  const withEquals = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) {
    return withEquals.slice(flag.length + 1);
  }

  return "";
}

const vaultPath = getArgValue("vault").trim();
const shouldSyncToVault = vaultPath.length > 0;

let pluginDir = "";
let manifestPath = "";
if (shouldSyncToVault) {
  manifestPath = path.resolve("manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  pluginDir = path.join(vaultPath, ".obsidian", "plugins", manifest.id);
}

async function tryCopyFile(source, destination) {
  try {
    await access(source);
    await copyFile(source, destination);
    return true;
  } catch {
    return false;
  }
}

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2021",
  outfile: "main.js",
  sourcemap: isProduction ? false : "inline",
  minify: isProduction,
  logLevel: "info",
  external: ["obsidian", "electron", "@codemirror/*", "node:*"],
  plugins: shouldSyncToVault
    ? [
        {
          name: "obsidian-vault-sync",
          setup(build) {
            build.onEnd(async (result) => {
              if (result.errors.length > 0) {
                console.error("[vault-sync] build has errors, skip syncing.");
                return;
              }

              await mkdir(pluginDir, { recursive: true });
              await copyFile(path.resolve("main.js"), path.join(pluginDir, "main.js"));
              await copyFile(path.resolve("manifest.json"), path.join(pluginDir, "manifest.json"));
              await tryCopyFile(path.resolve("styles.css"), path.join(pluginDir, "styles.css"));
              await tryCopyFile(path.resolve("versions.json"), path.join(pluginDir, "versions.json"));
              console.log(`[vault-sync] synced to ${pluginDir}`);
            });
          }
        }
      ]
    : []
});

if (isWatch) {
  await context.watch();
  console.log("[esbuild] watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
