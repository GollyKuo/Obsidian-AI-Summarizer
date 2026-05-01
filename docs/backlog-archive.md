# Backlog Archive

最後更新：2026-05-01 23:55

## 用途

本檔保存已完成且仍有架構參考價值的能力層與重要決策。

日常工作請讀 [backlog-active.md](backlog-active.md)，排程與全局優先序請讀 [backlog.md](backlog.md)。

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

- [x] 建立 `src/plugin/AISummarizerPlugin.ts`（完成：2026-04-21 15:20）
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

## Completed Product Flows 已完成產品流程

### CAP-201 Webpage Flow Baseline 網頁流程基線

責任邊界：
從 `webpage URL` 到 `summary note` 的第一條完整主線，作為全系統驗證樣板。

- [x] 建立 `orchestration/cancellation.ts`（完成：2026-04-21 15:58）
- [x] 建立 `orchestration/job-runner.ts`（完成：2026-04-21 15:58）
- [x] 建立 `orchestration/process-webpage.ts`（完成：2026-04-21 15:58）
- [x] 建立 mocked webpage integration test（完成：2026-04-21 15:58）
- [x] 驗證 `webpage URL -> extraction -> summary -> note write`（完成：2026-04-21 15:58）
- [x] 完成手動 smoke，確認可從輸入走到寫筆記（完成：2026-04-21 16:20）
- [x] 評估舊版 `trafilatura` 經驗，轉為 readability / sidecar / runtime extractor strategy 的 vNext 邊界；付費牆與內容不完整警語列為品質補強。（完成：2026-05-01 01:42）

### CAP-204 Local Media Flow 本機媒體流程

責任邊界：
本機音訊 / 影片匯入、格式檢查、快取與 artifact lifecycle，與 media URL 共用 AI-ready pipeline。

- [x] 定義 `local media` v1 支援範圍：audio/video、大小限制、容器格式。（完成：2026-04-23 16:24）
- [x] 定義 local file ingestion adapter 與錯誤分類。（完成：2026-04-23 16:24）
- [x] 讓 local media flow 共用 `CAP-203` 的壓縮與 AI-ready handoff。（完成：2026-04-23 16:24）
- [x] 補 local media 的 unit / integration 測試。（完成：2026-04-23 16:24）

## Completed User Experience 已完成使用體驗

### CAP-301 Minimal Interaction Flow 最小互動流程

責任邊界：
最小可用 UX 需能承接既有 webpage flow，不把流程控制塞回 command handler。

- [x] 建立 flow modal skeleton（完成：2026-04-21 16:10）
- [x] 建立 source input、progress、result 畫面（完成：2026-04-21 16:10）
- [x] 建立取消按鈕與 job state 對應 UI（完成：2026-04-21 16:10）
- [x] 驗證使用者可透過 UI 啟動 webpage flow，且成功、失敗、取消可區分（完成：2026-04-21 16:20）

### CAP-302 Entry Points And Settings Experience 入口與設定體驗

責任邊界：
產品入口與設定體驗。

- [x] 新增 Obsidian 左側 ribbon 按鈕，點擊後開啟 `AI 摘要器`。（完成：2026-04-24 00:08）
- [x] 決定 template 整合的第一版 UX。（完成：2026-04-24 08:48）
- [x] 整理 prompt 資產與 note output 範本。（完成：2026-04-24 08:48）
- [x] 建立 media / webpage / local media 的輸入引導與錯誤提示文案。（完成：2026-04-24 08:48）

## Completed Reliability And Operations 已完成穩定性與營運

### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

責任邊界：
debug log、平台偵測、錯誤呈現與 provider diagnostics。

- [x] 定義 debug logging policy：user-facing、developer-facing、runtime-facing。（完成：2026-04-24 01:18）
- [x] 建立 capability detection / diagnostics summary：desktop/mobile/runtime availability。（完成：2026-04-24 01:00）
- [x] 統一錯誤訊息層級：notice、modal、log、test assertion。（完成：2026-04-24 01:18）
- [x] 補 AI provider response diagnostics：OpenRouter / Gemini 失敗時可從 debug log 分辨 transport error、provider error payload、empty output、unexpected response shape。（完成：2026-04-29 00:36）
- [x] 補 Gladia provider diagnostics：debug log 保留 request/job id、HTTP status、provider error payload、polling 狀態轉換與 transcript 正規化結果摘要，且不得記錄 API key 或原始敏感內容。（完成：2026-05-01 19:35）

### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

責任邊界：
可重複的 release / build / vault sync 流程。

- [x] 保持每次 build 後同步到指定 Obsidian vault 的開發工作流。（完成：2026-04-24 09:26）
- [x] 整理 build / release / commit / test SOP 與檢查點。（完成：2026-04-24 09:26）
- [x] 規劃 release automation：GitHub Actions。（完成：2026-04-24 09:26）

### CAP-404 External Dependency Update Strategy 外部依賴更新策略：基線

責任邊界：
外部工具版本檢查、相容性策略、drift gate 與下載驗證。

- [x] 規劃 `yt-dlp` update strategy：版本檢查、更新提醒、未來自動更新。（完成：2026-04-24 10:06）
- [x] 定義非阻塞版本檢查與更新提醒流程，要求背景執行、具 timeout，且不得阻塞 plugin 啟動。（完成：2026-04-24 10:06）
- [x] 規劃 `ffmpeg` / `ffprobe` 相容性與平台差異檢查。（完成：2026-04-24 10:06）
- [x] 定義 dependency drift 對 smoke / release gate 的影響。（完成：2026-04-24 10:06）
- [x] 實作 `ffmpeg` / `ffprobe` 多來源下載、SHA-256 驗證、失敗 fallback 與下載取消流程。（完成：2026-04-25 13:53）
- [x] 吸收舊版非阻塞 `yt-dlp` 版本檢查經驗，轉為新版 diagnostics 任務與 queued enhancement。（完成：2026-05-01 01:40）

## Completed Expansion 已完成擴充能力

### CAP-504 Multi-Model Provider Strategy 多模型 Provider 策略

責任邊界：
provider 分層、模型清單、使用者可管理模型與 provider routing 的設定基礎。

- [x] 完成轉錄 provider 與摘要 provider 的設定拆分。（完成：2026-04-24 16:24）
- [x] 支援 Gemini 轉錄、Gemini 摘要與 OpenRouter 摘要的基本 routing。（完成：2026-04-24 16:24）
- [x] 模型清單改為使用者自訂維護，轉錄/摘要共用 autocomplete model datalist。（完成：2026-04-26）
- [x] Gemini 轉錄與摘要都內建 `gemini-3-flash-preview` 與 `gemini-2.5-flash`。（完成：2026-05-01 20:16）
- [x] 校正 Gemini 3 Flash Preview 官方 model id：由錯誤的 `gemini-3.0-flash-preview` 改為 `gemini-3-flash-preview`，並在設定載入時自動遷移舊值。（完成：2026-05-01 20:32）
- [x] 將 Gemini 內建模型下拉顯示文字改為官方 model ID，避免 display name 與 API model id 混淆。（完成：2026-05-01 20:40）
- [x] OpenRouter 支援從官方 models API 查詢、校對與驗證 model id / 名稱。（完成：2026-04-26）

## Completed Media Decisions 已完成媒體決策

這些項目屬於已完成的規格決策或調研結果；後續實作仍追蹤在 active backlog。

- [x] 舊新版 media URL、本機媒體、暫存產物、下載方式、AI 傳輸、字幕、retention 與輸出格式比較已寫入 [media-acquisition-spec.md](media-acquisition-spec.md)。（完成：2026-05-01 22:07）
- [x] 舊版 YouTube 下載參數已納入新版 `downloader-adapter` 評估與測試：1080p 內格式選擇、`retries`、`fragment_retries`、`socket_timeout`、`continuedl`、`http_chunk_size`。（完成：2026-05-01 01:38）
- [x] Gemini file upload 已評估為 `TranscriptionProvider` 的 vNext 可選 strategy，用於超長媒體、單 chunk 仍過大或 inline 穩定性不足的情境。（完成：2026-05-01 01:42）
- [x] 字幕衍生輸出已納入 artifact lifecycle 決策：`.srt` 生成與保留是必要能力；軟字幕嵌入與含字幕影片保留為可選能力。（完成：2026-05-01 01:42）
- [x] retention UX 已重新檢查：`delete_temp / keep_temp` 是目前主線；若未來需要舊版「保留視訊 + 音訊」語意，再定義進階 retention mode。（完成：2026-05-01 01:42）
- [x] `subtitles.srt` 已定案為 session 暫存資料夾內必保留產物，不得被 `delete_temp` 成功清理移除。（完成：2026-05-01 23:18）
- [x] 長媒體摘要策略已定案：chunk 只可作為內部 token control / diagnostics，最終摘要必須以合併 transcript 做全局整合，不得暴露 chunk / part / 分段等技術標記。（完成：2026-05-01 23:45）
