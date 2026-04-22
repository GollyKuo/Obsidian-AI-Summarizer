# Backlog Archive

最後更新：2026-04-22 08:18

## 用途

本檔只保存已完成且仍有架構參考價值的能力層。

日常執行請優先讀 [backlog.md](D:\程式開發\AI Summarizer\docs\backlog.md) 與 [backlog-active.md](D:\程式開發\AI Summarizer\docs\backlog-active.md)。

## Completed Foundations 已完成基礎層

### Platform Shell 平台外殼

#### CAP-001 Plugin Host Baseline 外掛宿主基線

責任邊界：
Obsidian 能載入 plugin，且本地開發鏈可穩定建置與驗證。

- [x] 建立 `manifest.json`（完成：2026-04-21 15:02）
- [x] 建立 `package.json`（完成：2026-04-21 15:02）
- [x] 建立 `tsconfig.json`（完成：2026-04-21 15:02）
- [x] 建立 `versions.json`（完成：2026-04-21 15:02）
- [x] 建立 `esbuild.config.mjs`（完成：2026-04-21 15:02）
- [x] 建立 `main.ts`（完成：2026-04-21 15:02）
- [x] 建立標準 scripts：`typecheck`、`test`、`build`、`gate:local`（完成：2026-04-21 15:02）
- [x] 確認 `npm install`、`npm run typecheck`、`npm run build` 可完成（完成：2026-04-21 15:02）

#### CAP-002 Plugin Lifecycle And Settings Shell 外掛生命週期與設定外殼

責任邊界：
plugin 生命週期、指令註冊、設定儲存與基本 notice/logging 由 plugin shell 負責。

- [x] 建立 `src/plugin/MediaSummarizerPlugin.ts`（完成：2026-04-21 15:20）
- [x] 建立 `src/plugin/commands.ts`（完成：2026-04-21 15:20）
- [x] 建立 `src/plugin/lifecycle.ts`（完成：2026-04-21 15:20）
- [x] 建立 settings persistence wiring（完成：2026-04-21 15:20）
- [x] 建立最小 settings tab（完成：2026-04-21 15:20）
- [x] 建立 command 註冊與基本 notice/logging wiring（完成：2026-04-21 15:20）
- [x] 驗證 Obsidian 中可看到 plugin、command 與可儲存 settings（完成：2026-04-21 16:20）

### Core Contracts 核心契約

#### CAP-101 Domain Model And Prompt Contract 領域模型與提示詞契約

責任邊界：
所有 flow 共用的型別、設定、錯誤、job state、prompt contract 必須先固定。

- [x] 定義 `domain/types.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/settings.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/errors.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/jobs.ts`（完成：2026-04-21 15:32）
- [x] 定義 `domain/prompts.ts`（完成：2026-04-21 15:32）
- [x] 將 `docs/API_Instructions.md` 轉為可執行 prompt contract（完成：2026-04-22 00:17）

#### CAP-102 Runtime And Adapter Boundaries Runtime 與 Adapter 邊界

責任邊界：
runtime、AI、Obsidian、web extraction 等 adapter 必須透過明確介面解耦。

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

### User Experience 使用體驗

#### CAP-301 Minimal Interaction Flow 最小互動流程

責任邊界：
最小可用 UX 需能承接現有 webpage flow，不把流程控制塞回 command handler。

- [x] 建立 flow modal skeleton（完成：2026-04-21 16:10）
- [x] 建立 source input、progress、result 畫面（完成：2026-04-21 16:10）
- [x] 建立取消按鈕與 job state 對應 UI（完成：2026-04-21 16:10）
- [x] 驗證使用者可透過 UI 啟動 webpage flow，且成功、失敗、取消可區分（完成：2026-04-21 16:20）
