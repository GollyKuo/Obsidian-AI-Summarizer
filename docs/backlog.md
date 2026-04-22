# Master Backlog

最後更新：2026-04-22 08:54

## 用途

本檔是完整待辦總表，包含：

1. 目前正在做的能力層。
2. 下一步與中期待開發能力。
3. 長期擴充能力。

已完成項目請看 [backlog-archive.md](D:\程式開發\AI Summarizer\docs\backlog-archive.md)。  
目前正在執行與近期細節請看 [backlog-active.md](D:\程式開發\AI Summarizer\docs\backlog-active.md)。

## 系統能力分層

1. `Platform Shell / 平台外殼`
2. `Core Contracts / 核心契約`
3. `Product Flows / 產品流程`
4. `User Experience / 使用體驗`
5. `Reliability And Operations / 穩定性與營運`
6. `Expansion / 擴充能力`

## Active 現行任務

### Product Flows 產品流程

#### CAP-201 Webpage Flow Baseline 網頁流程基線

狀態：`active`

- [ ] 補上付費牆偵測與內容不完整警語的能力定義與驗收點

#### CAP-202 Media Acquisition Boundary 媒體取得邊界

狀態：`active`

- [x] 接入 `yt-dlp` 實際下載執行與 `downloaded.*` 產物落盤（完成：2026-04-22 08:54）
- [ ] 建立 session isolation 與安全恢復，禁止掃整個 downloads 目錄猜測結果檔
- [x] 建立 `yt-dlp` 假失敗恢復機制，若子程序報錯但 session 內已有完整媒體檔，需能判定為可恢復成功（完成：2026-04-22 08:54）
- [ ] 建立下載階段 cancellation 串接（AbortSignal）
- [ ] 建立 media metadata 正規化（`Title`、`Creator/Author`、`Platform`、`Source`、`Created`）
- [ ] 建立錯誤分類與回報（`validation_error`、`download_failure`、`runtime_unavailable`、`cancellation`）

#### CAP-203 AI-Ready Media Processing AI 可用媒體處理

狀態：`active`

- [ ] 建立 `services/media/pre-upload-compressor.ts`（抽音訊、重編碼、分段、VAD）
- [ ] 建立壓縮品質守門與回退重跑（Opus -> AAC -> FLAC）
- [ ] 建立 `orchestration/process-media-url.ts`
- [ ] 定義 transcript-ready payload 與後續 AI processing handoff
- [ ] 建立 unit tests（壓縮 profile、回退條件、內容密度守門）
- [ ] 建立 integration tests（成功、失敗、取消、品質回退）

#### CAP-204 Local Media Flow 本機媒體流程

狀態：`active`

- [ ] 定義 `local media` v1 支援範圍（audio/video、大小限制、容器格式）
- [ ] 定義 local file ingestion adapter 與錯誤分類
- [ ] 讓 local media flow 共用 `CAP-203` 的壓縮與 AI-ready handoff
- [ ] 補 local media 的 unit / smoke 測試

#### CAP-205 AI Processing Pipeline AI 處理管線

狀態：`active`

- [ ] 定義 transcript generation 與 summary generation 的 orchestration 邊界
- [ ] 定義長內容 chunking / merge 策略與 token control
- [ ] 定義網頁、媒體、未來多模型共用的 AI output contract
- [ ] 把 `API_Instructions.md` 的規則映射到 media / webpage 兩種輸入路徑

#### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

狀態：`active`

- [ ] 定義 retention modes 對各 artifact 的保留矩陣
- [ ] 定義 note output metadata contract 與 path collision policy 的進一步規格
- [ ] 定義 webpage metadata policy，明確規定網頁來源 `Platform` 統一輸出為 `Web`
- [ ] 定義 cleanup / recovery 在成功、失敗、取消三種狀態的責任分界
- [ ] 決定字幕、逐字稿附件、衍生輸出是否納入同一 artifact lifecycle
- [ ] 定義字幕產線是否納入 v1 / vNext，包含 `.srt` 生成、FFmpeg 軟字幕嵌入、含字幕影片保留策略

### User Experience 使用體驗

#### CAP-302 Entry Points And Settings Experience 入口與設定體驗

狀態：`active`

- [ ] 新增 Obsidian 左側 ribbon 按鈕，點擊後開啟 `AI 摘要器`
- [ ] 決定 template 整合的第一版 UX
- [ ] 整理 prompt 資產與 note output 範本
- [ ] 建立 media / webpage / local media 的輸入引導與錯誤提示文案

#### CAP-303 Documentation And User Manual 文件與使用手冊

狀態：`active`

- [ ] 撰寫 `docs/user-manual.md`
- [ ] 整理安裝、設定、smoke test、vault build / sync 的操作說明

### Reliability And Operations 穩定性與營運

#### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

狀態：`active`

- [ ] 整理 webpage / media URL / local media 的 smoke checklist
- [ ] 建立 capability-based 測試矩陣，而不是只按檔案或服務測
- [ ] 定義桌面 regression gate，確保新 runtime 或新流程不破壞既有 webpage flow

#### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

狀態：`active`

- [ ] 定義 debug logging policy（user-facing、developer-facing、runtime-facing）
- [ ] 建立 capability detection / diagnostics summary（desktop / mobile / runtime availability）
- [ ] 統一錯誤訊息層級：notice、modal、log、test assertion

#### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

狀態：`active`

- [ ] 保持每次 build 後同步到指定 Obsidian vault 的開發工作流
- [ ] 整理 build / release / commit / test SOP 與檢查點
- [ ] 規劃 release automation（未來可接 GitHub Actions）

#### CAP-404 External Dependency Update Strategy 外部依賴更新策略

狀態：`active`

- [ ] 規劃 `yt-dlp` update strategy（版本檢查、更新提醒、未來自動更新）
- [ ] 定義非阻塞版本檢查與更新提醒流程，要求背景執行、具 timeout，且不得阻塞 plugin 啟動
- [ ] 規劃 `ffmpeg` / `ffprobe` 相容性與平台差異檢查
- [ ] 定義 dependency drift 對 smoke / release gate 的影響

## Future 後續與長期任務

### Expansion 擴充能力

#### CAP-501 Mobile Runtime Strategy 行動版 Runtime 策略

狀態：`future`

- [ ] 定義 `mobile_runtime` 契約（remote API payload、錯誤映射、取消機制）
- [ ] 新增 runtime strategy selector（`auto` / `local_bridge` / `mobile_runtime` / `placeholder_only`）
- [ ] 建立平台預設策略（mobile -> `mobile_runtime`，desktop -> `local_bridge`）
- [ ] 建立桌面回歸驗證，確保 mobile runtime 不影響桌面既有流程
- [ ] 建立 mobile smoke checklist（webpage / media 基本流程）

#### CAP-502 Internationalization 多國語系

狀態：`future`

- [ ] 啟動 UI 字串資源化、語系切換、fallback 策略
- [ ] 定義多國語言輸出契約（輸入語言偵測、輸出語言指定、翻譯 / 原文保留規則）
- [ ] 建立 i18n 測試與驗證清單（至少 `zh-TW` / `en-US`）

#### CAP-503 Commercialization 商業化

狀態：`future`

- [ ] 定義授權 / 訂閱狀態抽象與功能分級邊界
- [ ] 定義 free / pro / team 的 feature gating 與審計點
- [ ] 建立支付 / 授權 provider 介面（web checkout、行動平台 billing 可替換）

#### CAP-504 Multi-Model Provider Strategy 多模型 Provider 策略

狀態：`future`

- [ ] 定義多模型 provider contract（Gemini / OpenAI / Anthropic 可替換）
- [ ] 定義多模型下的 transcript-first 與 multimodal-first 兩種 processing strategy
- [ ] 定義不同模型的 prompt compatibility 與能力旗標

#### CAP-505 Batch And Queueing 批次與佇列

狀態：`future`

- [ ] 規劃多 URL / 多檔案排程處理能力
- [ ] 定義 queue、concurrency、retry policy 與取消粒度
- [ ] 定義批次模式下的 note naming 與結果彙整策略

#### CAP-506 Custom Prompt Library 自訂 Prompt 資產庫

狀態：`future`

- [ ] 規劃 prompt profile / template library
- [ ] 定義使用者可調 prompt 與系統保留 guardrails 的邊界
- [ ] 定義不同情境模板（會議、課程、Podcast、文章摘要）

#### CAP-507 Security, Privacy, And Migration 安全、隱私與遷移

狀態：`future`

- [ ] 定義 API key、cache root、外部媒體、AI 上傳邊界的安全與隱私規則
- [ ] 定義 settings schema migration 與 note format migration 策略
- [ ] 定義未來 remote runtime / commercialization 的資料保留與刪除政策
