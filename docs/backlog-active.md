# Active Backlog

最後更新：2026-04-24 00:08

## 使用規則

1. 本檔只放目前正在建設或下一步就要實作的能力層。
2. 已完成且不再需要日常追蹤的內容，移到 `docs/backlog-archive.md`。
3. 新需求若屬於現行能力層，直接掛到對應 capability；不要另開平行 track。
4. 任何 `[x]` 項目都要標示完成時間，格式固定為 `（完成：YYYY-MM-DD HH:mm）`。

## 目前階段

- Phase 3：以 `CAP-202` 到 `CAP-206` 為主線，持續完成 media acquisition、AI-ready pipeline 與 note output 邊界。

## 唯一主線

1. 先完成 `CAP-202 Media Acquisition Boundary` 的實際下載、假失敗恢復、取消與 metadata normalization。
2. 接續完成 `CAP-203 AI-Ready Media Processing` 的壓縮、分段、VAD、品質回退與 `process-media-url`。
3. 同步收斂 `CAP-205 AI Processing Pipeline` 與 `CAP-206 Note Output And Artifact Retention`。

## 當前阻塞與前置依賴

- YouTube / podcast 手動 smoke 尚未補齊，CAP-202 還缺實機下載驗證。
- AI-ready artifact contract 尚未正式落地，會卡住 transcript / summary handoff。
- retention matrix 尚未定義完成，會影響 media/local media/output cleanup 的決策邊界。

## 下一個切換點

- 當 `CAP-202` 能穩定產出 session 隔離的 `downloaded.*` 且 cancellation 可用後，主線切換重心到 `CAP-203`。
- 當 `CAP-203` 完成 `ai-upload.*` 與品質回退機制後，主線切到 `CAP-204` 與 UI/手冊補強。

## Product Flows 產品流程

### CAP-201 Webpage Flow Baseline 網頁流程基線

責任邊界：
從 `webpage URL` 到 `summary note` 的第一條完整主線，先作為全系統驗證樣板。

已完成：

- [x] 建立 `orchestration/cancellation.ts`（完成：2026-04-21 15:58）
- [x] 建立 `orchestration/job-runner.ts`（完成：2026-04-21 15:58）
- [x] 建立 `orchestration/process-webpage.ts`（完成：2026-04-21 15:58）
- [x] 建立 mocked webpage integration test（完成：2026-04-21 15:58）
- [x] 驗證 `webpage URL -> extraction -> summary -> note write`（完成：2026-04-21 15:58）
- [x] 完成手動 smoke，確認可從輸入走到寫筆記（完成：2026-04-21 16:20）

待補強：

- [ ] 補上付費牆偵測與內容不完整警語的能力定義與驗收點

### CAP-202 Media Acquisition Boundary 媒體取得邊界

Why：
媒體來源是本專案從「網頁摘要器」走向「全媒體摘要器」的關鍵能力，且會牽動下載、快取、壓縮、AI 上傳成本與錯誤恢復。

Scope：
`media URL -> acquisition session -> normalized media input`，先支援 YouTube / podcast / direct media URL。

Dependencies：
`RuntimeProvider`、外部依賴 readiness、cache root policy、artifact 命名規則。

已完成：

- [x] 定義下載格式與存放路徑規格（`docs/media-acquisition-spec.md`）（完成：2026-04-21 23:32）
- [x] 定案外部可選擇 `mediaCacheRoot`，預設不寫入 vault（完成：2026-04-22 00:01）
- [x] 定案 AI 上傳前壓縮策略（抽音訊、分段、VAD、品質回退）（完成：2026-04-22 00:11）
- [x] 定案 `RuntimeProvider` v1 media strategy 採 `local_bridge`，保留 `placeholder_only` fallback（完成：2026-04-22 00:24）
- [x] 建立 runtime strategy 邊界（`runtime-factory`、`local-bridge-runtime`）（完成：2026-04-22 00:24）
- [x] 新增 settings：`mediaCacheRoot`、`mediaCompressionProfile`（完成：2026-04-22 00:26）
- [x] 建立 `mediaCacheRoot` 絕對路徑驗證與可寫性檢查（完成：2026-04-22 01:00）
- [x] 建立 cache root resolution（自訂優先，否則使用 OS 預設 cache）（完成：2026-04-22 01:00）
- [x] 建立外部依賴 readiness（`yt-dlp`、`ffmpeg`、`ffprobe`）（完成：2026-04-22 07:14）
- [x] 建立外部依賴錯誤映射到 `runtime_unavailable`（完成：2026-04-22 07:14）
- [x] 建立 media URL 驗證與來源分類（youtube / podcast / direct media）（完成：2026-04-22 07:16）
- [x] 建立 `services/media/downloader-adapter.ts` 的 session 規劃與 artifact path 規格（完成：2026-04-22 07:40）

Open Work：

- [x] 接入 `yt-dlp` 實際下載執行與 `downloaded.*` 產物落盤（完成：2026-04-22 08:54）
- [x] 建立 session isolation 與安全恢復，禁止掃整個 downloads 目錄猜測結果檔（完成：2026-04-23 00:15）
- [x] 建立 `yt-dlp` 假失敗恢復機制，若子程序報錯但 session 內已有完整媒體檔，需能判定為可恢復成功（完成：2026-04-22 08:54）
- [x] 建立下載階段 cancellation 串接（AbortSignal）（完成：2026-04-23 00:15）
- [x] 建立 media metadata 正規化（`Title`、`Creator/Author`、`Platform`、`Source`、`Created`）（完成：2026-04-23 00:15）
- [x] 建立錯誤分類與回報（`validation_error`、`download_failure`、`runtime_unavailable`、`cancellation`）（完成：2026-04-23 00:15）

Done When：

- [x] 可穩定產出 session 隔離的 `downloaded.*`，且不污染 vault（完成：2026-04-23 00:15）
- [x] 下載取消在 2 秒內停止子程序，且不殘留孤兒程序（完成：2026-04-23 00:41）
- [ ] YouTube / podcast 各至少一條手動 smoke 可完成下載

### CAP-203 AI-Ready Media Processing AI 可用媒體處理

Why：
真正消耗成本的是 AI ingestion 與後續摘要，不先把媒體整理成 AI-ready artifact，後面 STT / summary 很難穩定。

Scope：
`downloaded.* -> normalized.* -> ai-upload.* -> transcript-ready payload`

Dependencies：
`CAP-202 Media Acquisition Boundary`、prompt contract、runtime payloads。

Open Work：

- [x] 建立 `services/media/pre-upload-compressor.ts`（抽音訊、重編碼、分段、VAD）（完成：2026-04-23 00:49）
- [x] 建立壓縮品質守門與回退重跑（Opus -> AAC -> FLAC）（完成：2026-04-23 00:49）
- [x] 建立 `orchestration/process-media-url.ts`（完成：2026-04-23 00:41）
- [x] 定義 transcript-ready payload 與後續 AI processing handoff（完成：2026-04-23 00:41）
- [x] 建立 unit tests（壓縮 profile、回退條件、內容密度守門）（完成：2026-04-23 00:49）
- [x] 建立 integration tests（成功、失敗、取消、品質回退）（完成：2026-04-23 10:12）

Done When：

- [ ] `balanced` profile 對照 `normalized.wav` 可降低至少 70% 上傳量（3 組樣本）
- [x] 至少 2 個案例可驗證品質守門會觸發回退（完成：2026-04-23 10:12）
- [x] media URL flow 可把 AI-ready payload 穩定交給後續 runtime / AI pipeline（完成：2026-04-23 08:22）

### CAP-204 Local Media Flow 本機媒體流程

Why：
舊版系統已有本機檔案處理能力；在新架構中，這條主線不能只是 media URL 的附屬特例。

Scope：
本機音訊 / 影片匯入、格式檢查、快取與 artifact lifecycle，與 media URL 共用 AI-ready pipeline。

Open Work：

- [x] 定義 `local media` v1 支援範圍（audio/video、大小限制、容器格式）（完成：2026-04-23 16:24）
- [x] 定義 local file ingestion adapter 與錯誤分類（完成：2026-04-23 16:24）
- [x] 讓 local media flow 共用 `CAP-203` 的壓縮與 AI-ready handoff（完成：2026-04-23 16:24）
- [x] 補 local media 的 unit / integration 測試（完成：2026-04-23 16:24）

### CAP-205 AI Processing Pipeline AI 處理管線

Why：
目前已有 prompt contract，但還沒有明確獨立的「轉錄 -> 分段摘要 -> 最終摘要 -> note payload」能力層。

Scope：
AI provider 呼叫策略、長內容 chunking、summary merge、transcript / webpage output policy。

Open Work：

- [x] 定義 transcript generation 與 summary generation 的 orchestration 邊界（`process-media`）（完成：2026-04-23 16:24）
- [x] 定義長內容 chunking / merge 策略與 token control（`media-summary-chunking`）（完成：2026-04-23 17:49）
- [x] 定義網頁、媒體、未來多模型共用的 AI output contract（`ai-output-normalizer`）（完成：2026-04-23 18:31）
- [x] 把 `API_Instructions.md` 的規則映射到 media/webpage 兩種輸入路徑（完成：2026-04-23 18:31）

### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

Why：
舊版系統有清楚的保留策略與清理邏輯；新架構目前只有 note writer 與 path resolver，artifact lifecycle 還沒成層。

Scope：
`downloaded.*`、`normalized.*`、`ai-upload.*`、transcript、final note 的生命週期與保留模式。

Open Work：

- [x] 定義 retention modes 對各 artifact 的保留矩陣（`artifact-retention`）（完成：2026-04-23 20:38）
- [x] 定義 note output metadata contract 與 path collision policy 的進一步規格（完成：2026-04-24 00:00）
- [x] 定義 webpage metadata policy，明確規定網頁來源 `Platform` 統一輸出為 `Web`（完成：2026-04-24 00:00）
- [x] 定義 cleanup/recovery 在成功、失敗、取消三種狀態的責任分界（完成：2026-04-23 20:38）
- [ ] 決定字幕、逐字稿附件、衍生輸出是否納入同一 artifact lifecycle
- [ ] 定義字幕產線是否納入 v1/vNext，包含 `.srt` 生成、FFmpeg 軟字幕嵌入、含字幕影片保留策略

## User Experience 使用體驗

### CAP-302 Entry Points And Settings Experience 入口與設定體驗

Why：
現有最小 UI 可用，但還沒有完整的產品入口與對應設定體驗。

Open Work：

- [x] 新增 Obsidian 左側 ribbon 按鈕，點擊後開啟 `AI 摘要器`（完成：2026-04-24 00:08）
- [x] 決定 template 整合的第一版 UX（完成：2026-04-24 08:48）
- [x] 整理 prompt 資產與 note output 範本（完成：2026-04-24 08:48）
- [x] 建立 media / webpage / local media 的輸入引導與錯誤提示文案（完成：2026-04-24 08:48）

### CAP-303 Documentation And User Manual 文件與使用手冊

Open Work：

- [ ] 撰寫 `docs/user-manual.md`
- [ ] 整理安裝、設定、smoke test、vault build/sync 的操作說明

## Reliability And Operations 穩定性與營運

### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

Why：
目前已有 typecheck/test/build，但產品能力增加後，需要從「指令成功」升級成「能力矩陣驗證」。

Open Work：

- [x] 整理 webpage / media URL / local media 的 smoke checklist（完成：2026-04-24 01:28）
- [x] 建立 capability-based 測試矩陣，而不是只按檔案或服務測（完成：2026-04-24 01:28）
- [x] 定義桌面 regression gate，確保新 runtime 或新流程不破壞既有 webpage flow（完成：2026-04-24 07:35）

### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

Why：
舊版有 debug log、平台偵測除錯、下載恢復經驗；新架構應把 observability 當成正式能力，而不是臨時 log。

Open Work：

- [x] 定義 debug logging policy（user-facing、developer-facing、runtime-facing）（2026-04-24 01:18）
- [x] 建立 capability detection / diagnostics summary（desktop/mobile/runtime availability）（2026-04-24 01:00）
- [x] 統一錯誤訊息層級：notice、modal、log、test assertion（2026-04-24 01:18）

### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

Why：
目前已有本地 build，但工作流仍偏人工。舊版 dev log 顯示 release automation 與工具鏈整理是必要能力。

Open Work：

- [ ] 保持每次 build 後同步到指定 Obsidian vault 的開發工作流
- [ ] 整理 build / release / commit / test SOP 與檢查點
- [ ] 規劃 release automation（未來可接 GitHub Actions）

### CAP-404 External Dependency Update Strategy 外部依賴更新策略

Why：
`yt-dlp` 與媒體下載環境高度變動，若不提早設計更新策略，後續會頻繁被外部平台變化打斷。

Open Work：

- [ ] 規劃 `yt-dlp` update strategy（版本檢查、更新提醒、未來自動更新）
- [ ] 定義非阻塞版本檢查與更新提醒流程，要求背景執行、具 timeout，且不得阻塞 plugin 啟動
- [ ] 規劃 `ffmpeg` / `ffprobe` 相容性與平台差異檢查
- [ ] 定義 dependency drift 對 smoke / release gate 的影響
