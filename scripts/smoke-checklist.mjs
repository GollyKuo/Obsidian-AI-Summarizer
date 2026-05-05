const capabilities = {
  webpage: {
    label: "Webpage",
    surfaces: ["desktop", "mobile"],
    prerequisites: [
      "Plugin 已安裝並可在 Obsidian 載入",
      "Gemini API 金鑰已填入設定",
      "已開啟 AI 摘要器 modal"
    ],
    steps: [
      "選擇來源類型為 webpage URL",
      "輸入一個可公開讀取的文章網址",
      "啟動流程並等待摘要完成",
      "確認 Vault 內產生新筆記",
      "確認 metadata 中 Source 對齊輸入 URL，Platform 為 Web"
    ],
    expected: [
      "流程狀態從 validating -> acquiring -> summarizing -> writing",
      "最終 modal 顯示成功 note path",
      "warnings 若出現，應同時可在 modal/log 觀測"
    ]
  },
  media_url: {
    label: "Media URL",
    surfaces: ["desktop"],
    prerequisites: [
      "桌面版 Obsidian",
      "Runtime diagnostics 顯示 local_bridge ready",
      "系統可用 yt-dlp / ffmpeg / ffprobe",
      "已設定可寫入的 media cache root 或接受預設 cache"
    ],
    steps: [
      "選擇來源類型為 media URL",
      "輸入 YouTube 或 podcast URL",
      "啟動流程並觀察 runtime diagnostics 與流程 warning",
      "確認下載/壓縮/摘要後 Vault 內產生筆記",
      "依 retention mode 檢查 cache root 中的 artifact 是否符合預期"
    ],
    expected: [
      "AI-ready handoff 成功建立",
      "note 產出成功，metadata/source/path 正常",
      "缺依賴時應得到 runtime_unavailable，而非未知錯誤"
    ]
  },
  local_media: {
    label: "Local Media",
    surfaces: ["desktop"],
    prerequisites: [
      "桌面版 Obsidian",
      "Runtime diagnostics 顯示 local_bridge ready",
      "本機存在受支援的 audio/video 檔案",
      "檔案大小低於 local media v1 限制"
    ],
    steps: [
      "選擇來源類型為 local media",
      "輸入本機媒體路徑",
      "啟動流程並等待 ingestion / compression / summary 完成",
      "確認 Vault 內產生筆記",
      "依 retention mode 檢查 source / metadata / ai-upload artifact 是否符合預期"
    ],
    expected: [
      "本機媒體成功複製到 session 並產生 metadata",
      "note 產出成功且 warning 可觀測",
      "不支援格式或超限時應得到 validation_error"
    ]
  }
};

const surfacePresets = {
  desktop: ["webpage", "media_url", "local_media"],
  mobile: ["webpage"]
};

const smokeResults = new Set(["pending", "pass", "fail"]);

function parseArgs(argv) {
  const result = {
    capability: null,
    notes: "",
    operator: process.env.USERNAME ?? process.env.USER ?? "unknown",
    recordPath: null,
    smokeResult: "pending",
    surface: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--capability") {
      result.capability = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--surface") {
      result.surface = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--record") {
      result.recordPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--operator") {
      result.operator = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--result") {
      result.smokeResult = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--notes") {
      result.notes = argv[index + 1] ?? "";
      index += 1;
    }
  }
  if (result.recordPath === "") {
    result.recordPath = null;
  }
  return result;
}

function validateRecordOptions(options) {
  if (!options.recordPath) {
    return;
  }
  if (!options.operator.trim()) {
    throw new Error("--operator must not be empty when --record is used");
  }
  if (!smokeResults.has(options.smokeResult)) {
    throw new Error("--result must be one of: pending, pass, fail");
  }
}

function resolveSelectedCapabilities(options) {
  if (options.capability) {
    if (!(options.capability in capabilities)) {
      throw new Error(`Unknown capability: ${options.capability}`);
    }
    return [options.capability];
  }

  if (options.surface) {
    if (!(options.surface in surfacePresets)) {
      throw new Error(`Unknown surface: ${options.surface}`);
    }
    return surfacePresets[options.surface];
  }

  return surfacePresets.desktop;
}

function printChecklist(capabilityKey) {
  const capability = capabilities[capabilityKey];
  console.log(`\n[${capability.label}]`);
  console.log(`Supported surfaces: ${capability.surfaces.join(", ")}`);
  console.log("Prerequisites:");
  for (const item of capability.prerequisites) {
    console.log(`- ${item}`);
  }
  console.log("Steps:");
  capability.steps.forEach((item, index) => {
    console.log(`${index + 1}. ${item}`);
  });
  console.log("Expected results:");
  for (const item of capability.expected) {
    console.log(`- ${item}`);
  }
}

function printHeader(options, selectedCapabilities) {
  const scope = options.capability
    ? `capability=${options.capability}`
    : options.surface
      ? `surface=${options.surface}`
      : "surface=desktop";

  console.log("AI Summarizer Smoke Checklist");
  console.log(`Scope: ${scope}`);
  console.log(`Selected capabilities: ${selectedCapabilities.join(", ")}`);
  console.log("Reference doc: docs/smoke-checklist.md");
}

function buildRecord(options, selectedCapabilities) {
  const scope = options.capability
    ? { type: "capability", value: options.capability }
    : options.surface
      ? { type: "surface", value: options.surface }
      : { type: "surface", value: "desktop" };

  return {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    operator: options.operator.trim(),
    scope,
    result: options.smokeResult,
    notes: options.notes,
    capabilities: selectedCapabilities.map((capabilityKey) => {
      const capability = capabilities[capabilityKey];
      return {
        capability: capabilityKey,
        label: capability.label,
        surfaces: capability.surfaces,
        result: options.smokeResult,
        notes: options.notes,
        prerequisites: capability.prerequisites,
        steps: capability.steps,
        expected: capability.expected
      };
    })
  };
}

async function writeRecord(recordPath, record) {
  const [{ mkdir, writeFile }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path")
  ]);
  const resolvedPath = path.resolve(recordPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`\n[smoke-checklist] wrote record: ${resolvedPath}`);
}

try {
  const options = parseArgs(process.argv.slice(2));
  validateRecordOptions(options);
  const selectedCapabilities = resolveSelectedCapabilities(options);
  printHeader(options, selectedCapabilities);
  for (const capabilityKey of selectedCapabilities) {
    printChecklist(capabilityKey);
  }
  if (options.recordPath) {
    await writeRecord(options.recordPath, buildRecord(options, selectedCapabilities));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
