# Master Backlog

最後更新：2026-04-24 09:57

## 用途

這份文件是完整任務清單總表。

它涵蓋：

- 現在
- 未來
- 長期

但只保留 capability 級摘要，不放細 checklist。

對應文件：

- 日常工作主入口：
  [backlog-active.md](D:\程式開發\AI Summarizer\docs\backlog-active.md)
- 已完成封存：
  [backlog-archive.md](D:\程式開發\AI Summarizer\docs\backlog-archive.md)
- 版本化變更摘要：
  [dev_log.md](D:\程式開發\AI Summarizer\docs\dev_log.md)

## 讀取順序

- 每日工作：先讀 `backlog-active.md`
- 排程與重排優先序：讀這份文件
- 查完成歷史：讀 `backlog-archive.md`

## 狀態說明

- `completed`：第一輪已完成，細節在 `backlog-archive.md`
- `active`：正在做或下一步就要做
- `queued`：已排入主線，但尚未進入執行
- `parking`：長期保留，不是 release blocker

## Capability 總表

### Platform Shell 平台外殼

#### CAP-001 Plugin Host Baseline 外掛宿主基線

狀態：`completed`

摘要：
建立可載入的 Obsidian plugin 基線與最小建置鏈。

#### CAP-002 Plugin Lifecycle And Settings Shell 外掛生命週期與設定外殼

狀態：`completed`

摘要：
完成 command、settings、lifecycle 與基本 notice/logging wiring。

### Core Contracts 核心契約

#### CAP-101 Domain Model And Prompt Contract 領域模型與提示詞契約

狀態：`completed`

摘要：
固定全 flow 共用型別、設定、錯誤、job state 與 prompt contract。

#### CAP-102 Runtime And Adapter Boundaries Runtime 與 Adapter 邊界

狀態：`completed`

摘要：
建立 runtime、AI、Obsidian、web extraction 的解耦介面。

### Product Flows 產品流程

#### CAP-201 Webpage Flow Baseline 網頁流程基線

狀態：`active`

摘要：
`webpage URL -> summary note` 主線已打通，剩付費牆與內容不完整警語定義。

#### CAP-202 Media Acquisition Boundary 媒體取得邊界

狀態：`active`

摘要：
`yt-dlp` 下載、session isolation、metadata normalization 與 cancellation 驗證已落地，剩 YouTube / podcast 手動 smoke 收尾。

#### CAP-203 AI-Ready Media Processing AI 可用媒體處理

狀態：`active`

摘要：
已建立 `process-media-url`、pre-upload compressor 與 transcript-ready payload，剩整合驗證與品質守門量測。

#### CAP-204 Local Media Flow 本機媒體流程

狀態：`active`

摘要：
本機媒體 ingestion 會共用 `CAP-203` 的 AI-ready artifact 與後續 handoff。

#### CAP-205 AI Processing Pipeline AI 處理管線

狀態：`active`

摘要：
收斂 transcript、summary、chunking 與跨輸入來源共用的 AI output contract。

#### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

狀態：`active`

摘要：
定義 retention matrix、metadata contract、cleanup / recovery 與 artifact lifecycle。

### User Experience 使用體驗

#### CAP-301 Minimal Interaction Flow 最小互動流程

狀態：`completed`

摘要：
最小 flow modal 已可承接既有 webpage flow。

#### CAP-302 Entry Points And Settings Experience 入口與設定體驗

狀態：`completed`

摘要：
已完成 ribbon 入口、template UX、輸入引導與錯誤文案第一版。

#### CAP-303 Documentation And User Manual 文件與使用手冊

狀態：`completed`

摘要：
已完成安裝、設定、smoke test 與日常操作手冊整理。

### Reliability And Operations 穩定性與營運

#### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

狀態：`completed`

摘要：
已完成 capability-based 測試矩陣、smoke checklist 與 regression gate。

#### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

狀態：`completed`

摘要：
已完成 logging policy、diagnostics summary 與錯誤呈現層級收斂。

#### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

狀態：`completed`

摘要：
已完成 build / release / vault sync SOP，並完成 release automation 規劃。

#### CAP-404 External Dependency Update Strategy 外部依賴更新策略

狀態：`completed`

摘要：
已完成 `yt-dlp`、`ffmpeg`、`ffprobe` 的版本檢查、相容性與 drift gate 策略。

### Expansion 擴充能力

#### CAP-501 Mobile Runtime Strategy 行動版 Runtime 策略

狀態：`parking`

摘要：
保留 mobile runtime 契約與平台策略，但不是目前 release blocker。

#### CAP-502 Internationalization 多國語系

狀態：`parking`

摘要：
保留 UI 字串資源化與多語輸出契約規劃。

#### CAP-503 Commercialization 商業化

狀態：`parking`

摘要：
保留授權、訂閱、feature gating 與支付 provider 介面抽象。

#### CAP-504 Multi-Model Provider Strategy 多模型 Provider 策略

狀態：`parking`

摘要：
保留多模型 provider contract 與 transcript-first / multimodal-first strategy。

#### CAP-505 Batch And Queueing 批次與佇列

狀態：`parking`

摘要：
保留多 URL / 多檔案排程、concurrency、retry 與結果彙整能力。

#### CAP-506 Custom Prompt Library 自訂 Prompt 資產庫

狀態：`parking`

摘要：
保留 prompt profile / template library 與 guardrails 邊界。

#### CAP-507 Security, Privacy, And Migration 安全、隱私與遷移

狀態：`parking`

摘要：
保留 API key、cache、外部媒體與未來 migration / retention 政策規劃。
