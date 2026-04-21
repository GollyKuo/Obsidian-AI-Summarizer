# Active Backlog

最後更新：2026-04-21 16:10

## 使用規則

1. 只保留 active 與即將開始的 upcoming。
2. 任務順序需反映依賴關係，避免先做會被前置契約卡住的項目。
3. 每個 track 完成後，要同步更新 `docs/current-implementation-track.md` 與 `docs/dev_log.md`。
4. 任何 `[x]` 項目都要標示完成時間，格式固定為 `（完成：YYYY-MM-DD HH:mm）`。

## Active

### TRACK-001 Project Foundation

目標：
先讓 plugin 專案可安裝、可編譯、可被 Obsidian 載入。

- [x] 建立 `manifest.json`（完成：2026-04-21 15:02）
- [x] 建立 `package.json`（完成：2026-04-21 15:02）
- [x] 建立 `tsconfig.json`（完成：2026-04-21 15:02）
- [x] 建立 `versions.json`（完成：2026-04-21 15:02）
- [x] 建立 `esbuild.config.mjs`（完成：2026-04-21 15:02）
- [x] 建立 `main.ts`（完成：2026-04-21 15:02）
- [x] 安裝最低依賴並確認 `npm install` 可完成（完成：2026-04-21 15:02）
- [x] 建立標準 scripts：`typecheck`、`test`、`build`、`gate:local`（完成：2026-04-21 15:02）

完成條件：

- [x] `npm run typecheck`（完成：2026-04-21 15:02）
- [x] `npm run build`（完成：2026-04-21 15:02）
- [x] plugin scaffold 可產出可載入的 build artifact（完成：2026-04-21 15:02）

### TRACK-002 Plugin Shell And Settings

目標：
先建立真正可承接功能的 plugin 外殼，而不是只有空入口。

- [x] 建立 `src/plugin/MediaSummarizerPlugin.ts`（完成：2026-04-21 15:20）
- [x] 建立 `src/plugin/commands.ts`（完成：2026-04-21 15:20）
- [x] 建立 `src/plugin/lifecycle.ts`（完成：2026-04-21 15:20）
- [x] 建立 plugin settings persistence wiring（完成：2026-04-21 15:20）
- [x] 建立最小 settings tab（完成：2026-04-21 15:20）
- [x] 建立 command 註冊與基本 notice/logging wiring（完成：2026-04-21 15:20）

完成條件：

- [ ] Obsidian 中可看到 plugin
- [ ] command 可見
- [ ] settings 可儲存與讀回

### TRACK-003 Domain Contracts

目標：
先固定型別與狀態模型，避免後續 service 與 orchestration 各自發散。

- [x] 定義 `domain/types.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/settings.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/errors.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/jobs.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/prompts.ts`（完成：2026-04-21 15:32）

完成條件：

- [x] `RuntimeProvider`、`AiProvider`、`NoteWriter` 可依賴這些 types（完成：2026-04-21 15:32）
- [x] job state 與 error category 已明確可用（完成：2026-04-21 15:32）

### TRACK-004 Core Contracts And Services

目標：
建立第一批關鍵服務契約，先打通 `webpage flow` 所需底座。

- [x] 建立 `runtime/runtime-provider.ts`（完成：2026-04-21 15:45）
- [x] 建立 `runtime/runtime-payloads.ts`（完成：2026-04-21 15:45）
- [x] 建立 `runtime/placeholder-runtime.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/ai/ai-provider.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/ai/prompt-builder.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/obsidian/note-writer.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/obsidian/path-resolver.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/obsidian/template-resolver.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/web/webpage-extractor.ts`（完成：2026-04-21 15:45）
- [x] 建立 `services/web/metadata-extractor.ts`（完成：2026-04-21 15:45）

完成條件：

- [x] webpage flow 所需 interface 已齊備（完成：2026-04-21 15:45）
- [x] note output 與 path collision 基礎契約已固定（完成：2026-04-21 15:45）

### TRACK-005 First End-to-End Webpage Flow

目標：
先完成第一條真正的可驗證主線。

- [x] 建立 `orchestration/cancellation.ts`（完成：2026-04-21 15:58）
- [x] 建立 `orchestration/job-runner.ts`（完成：2026-04-21 15:58）
- [x] 建立 `orchestration/process-webpage.ts`（完成：2026-04-21 15:58）
- [x] 建立 mocked webpage integration test（完成：2026-04-21 15:58）
- [x] 驗證 `webpage URL -> extraction -> summary -> note write`（完成：2026-04-21 15:58）

完成條件：

- [x] mocked integration test 通過（完成：2026-04-21 15:58）
- [ ] 手動 smoke 可完成從輸入到寫筆記

### TRACK-006 Minimal UI Flow

目標：
讓 plugin 具備最小可操作 UX。

- [x] 建立最低可用 flow modal skeleton（完成：2026-04-21 16:10）
- [x] 建立 source input 畫面（完成：2026-04-21 16:10）
- [x] 建立 progress 畫面（完成：2026-04-21 16:10）
- [x] 建立 result 畫面（完成：2026-04-21 16:10）
- [x] 建立取消按鈕與 job state 對應 UI（完成：2026-04-21 16:10）

完成條件：

- [ ] 使用者可透過 UI 啟動 webpage flow
- [ ] 成功、失敗、取消三種狀態可區分

## Upcoming

- [ ] 決定 `RuntimeProvider` v1 策略
- [ ] 決定 `local media` v1 支援範圍
- [ ] 決定 template 整合的第一版 UX
- [ ] 決定 `webpage flow` 哪些能力屬於 `runtime-dependent`
- [ ] 整理 prompt 資產與 note output 範本
