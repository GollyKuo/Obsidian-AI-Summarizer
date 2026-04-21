# Active Backlog

最後更新：2026-04-21 14:20

## 使用規則

1. 只保留 active 與即將開始的 upcoming。
2. 任務順序需反映依賴關係，避免先做會被前置契約卡住的項目。
3. 每個 track 完成後，要同步更新 `docs/current-implementation-track.md` 與 `docs/dev_log.md`。

## Active

### TRACK-001 Project Foundation

目標：
先讓 plugin 專案可安裝、可編譯、可被 Obsidian 載入。

- [ ] 建立 `manifest.json`
- [ ] 建立 `package.json`
- [ ] 建立 `tsconfig.json`
- [ ] 建立 `versions.json`
- [ ] 建立 `esbuild.config.mjs`
- [ ] 建立 `main.ts`
- [ ] 安裝最低依賴並確認 `npm install` 可完成
- [ ] 建立標準 scripts：`typecheck`、`test`、`build`、`gate:local`

完成條件：

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] plugin scaffold 可產出可載入的 build artifact

### TRACK-002 Plugin Shell And Settings

目標：
先建立真正可承接功能的 plugin 外殼，而不是只有空入口。

- [ ] 建立 `src/plugin/MediaSummarizerPlugin.ts`
- [ ] 建立 `src/plugin/commands.ts`
- [ ] 建立 `src/plugin/lifecycle.ts`
- [ ] 建立 plugin settings persistence wiring
- [ ] 建立最小 settings tab
- [ ] 建立 command 註冊與基本 notice/logging wiring

完成條件：

- [ ] Obsidian 中可看到 plugin
- [ ] command 可見
- [ ] settings 可儲存與讀回

### TRACK-003 Domain Contracts

目標：
先固定型別與狀態模型，避免後續 service 與 orchestration 各自發散。

- [ ] 定義 `domain/types.ts`
- [ ] 定義 `domain/settings.ts`
- [ ] 定義 `domain/errors.ts`
- [ ] 定義 `domain/jobs.ts`
- [ ] 定義 `domain/prompts.ts`

完成條件：

- [ ] `RuntimeProvider`、`AiProvider`、`NoteWriter` 可依賴這些 types
- [ ] job state 與 error category 已明確可用

### TRACK-004 Core Contracts And Services

目標：
建立第一批關鍵服務契約，先打通 `webpage flow` 所需底座。

- [ ] 建立 `runtime/runtime-provider.ts`
- [ ] 建立 `runtime/runtime-payloads.ts`
- [ ] 建立 `runtime/placeholder-runtime.ts`
- [ ] 建立 `services/ai/ai-provider.ts`
- [ ] 建立 `services/ai/prompt-builder.ts`
- [ ] 建立 `services/obsidian/note-writer.ts`
- [ ] 建立 `services/obsidian/path-resolver.ts`
- [ ] 建立 `services/obsidian/template-resolver.ts`
- [ ] 建立 `services/web/webpage-extractor.ts`
- [ ] 建立 `services/web/metadata-extractor.ts`

完成條件：

- [ ] webpage flow 所需 interface 已齊備
- [ ] note output 與 path collision 基礎契約已固定

### TRACK-005 First End-to-End Webpage Flow

目標：
先完成第一條真正的可驗證主線。

- [ ] 建立 `orchestration/cancellation.ts`
- [ ] 建立 `orchestration/job-runner.ts`
- [ ] 建立 `orchestration/process-webpage.ts`
- [ ] 建立 mocked webpage integration test
- [ ] 驗證 `webpage URL -> extraction -> summary -> note write`

完成條件：

- [ ] mocked integration test 通過
- [ ] 手動 smoke 可完成從輸入到寫筆記

### TRACK-006 Minimal UI Flow

目標：
讓 plugin 具備最小可操作 UX。

- [ ] 建立最低可用 flow modal skeleton
- [ ] 建立 source input 畫面
- [ ] 建立 progress 畫面
- [ ] 建立 result 畫面
- [ ] 建立取消按鈕與 job state 對應 UI

完成條件：

- [ ] 使用者可透過 UI 啟動 webpage flow
- [ ] 成功、失敗、取消三種狀態可區分

## Upcoming

- [ ] 決定 `RuntimeProvider` v1 策略
- [ ] 決定 `local media` v1 支援範圍
- [ ] 決定 template 整合的第一版 UX
- [ ] 決定 `webpage flow` 哪些能力屬於 `runtime-dependent`
- [ ] 整理 prompt 資產與 note output 範本
