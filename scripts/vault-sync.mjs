import { spawn } from "node:child_process";
import process from "node:process";

function parseArgs(argv) {
  const parsed = {
    mode: "build",
    vaultPath: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mode" && argv[index + 1]) {
      parsed.mode = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--vault" && argv[index + 1]) {
      parsed.vaultPath = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return parsed;
}

function printUsageAndExit(message) {
  console.error(`[vault-sync] ${message}`);
  console.error("[vault-sync] usage: node scripts/vault-sync.mjs --mode <build|watch> --vault \"D:\\Your\\Vault\"");
  console.error("[vault-sync] fallback: set AI_SUMMARIZER_VAULT_PATH environment variable");
  process.exit(1);
}

const parsed = parseArgs(process.argv.slice(2));
const mode = parsed.mode.trim().toLowerCase();
const vaultPath = (parsed.vaultPath || process.env.AI_SUMMARIZER_VAULT_PATH || "").trim();

if (!["build", "watch"].includes(mode)) {
  printUsageAndExit(`unsupported mode: ${parsed.mode}`);
}

if (vaultPath.length === 0) {
  printUsageAndExit("missing vault path");
}

const esbuildArgs = ["esbuild.config.mjs", "--vault", vaultPath];
if (mode === "watch") {
  esbuildArgs.push("--watch");
} else {
  esbuildArgs.push("--production");
}

const child = spawn(process.execPath, esbuildArgs, {
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

