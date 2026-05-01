# Active Backlog

最後更新：2026-05-01 20:52

## 使用規則

1. 本檔只放目前正在建設或下一步就要實作的能力層。
2. 已完成且不再需要日常追蹤的內容，移到 `docs/backlog-archive.md`。
3. 新需求若屬於現行能力層，直接掛到對應 capability；不要另開平行 track。
4. 任何 `[x]` 項目都要標示完成時間，格式固定為 `（完成：YYYY-MM-DD HH:mm）`。

## 目前階段

- Phase 3 收斂：`CAP-202` 到 `CAP-206` 已完成主體實作，剩實機 smoke、量測與 retention 邊界收尾。
- Phase 4 準備：`CAP-302`、`CAP-401` 到 `CAP-404` 已完成，待移入 archive；`CAP-303` 重新打開，用於完善使用者手冊。

## 唯一主線

1. 收尾 `CAP-202`：完成 YouTube / podcast 各至少一條手動 smoke 下載驗證。
2. 收尾 `CAP-203`：完成 `balanced` profile 對 `normalized.wav` 的 3 組樣本上傳量量測（目標至少 70%）。
3. 推進 `CAP-205`：規劃並落地「轉錄模型」與「摘要模型」拆分，支援 Gemini / Gladia 轉錄 + OpenRouter/Qwen 摘要。
4. 收尾 `CAP-206`：定案字幕與逐字稿衍生輸出的 artifact lifecycle（v1/vNext 邊界）。
5. 推進 `CAP-303`：補齊使用者手冊，涵蓋模型選擇、多 provider、轉錄/摘要拆分與常見問題。

## 當前阻塞與前置依賴

- 缺少可重現的 YouTube / podcast 手動 smoke 結果與紀錄格式。
- 缺少 `balanced` profile 的基準樣本與量測紀錄，無法關閉 CAP-203 最後驗收點。
- 字幕產線（`.srt` / 軟字幕嵌入）是否納入 v1 尚未定案，影響 CAP-206 lifecycle 收斂。
- Gladia 第一版 provider 已接入，API key / health check 可用，且 media URL 實機 smoke 已成功；仍缺 local media 實機 smoke、混合 provider smoke 與使用手冊細節補強。

## 下一個切換點

- 當 `CAP-202` 與 `CAP-203` 的最後驗收點完成後，將 `CAP-302`、`CAP-401` 到 `CAP-404` 移入封存並清理 active backlog。
- `CAP-504` 已完成：模型清單改為使用者自訂維護，轉錄/摘要共用 autocomplete model datalist；Gemini 轉錄與摘要都內建 `gemini-3-flash-preview` 與 `gemini-2.5-flash`，並支援 Gemini / OpenRouter 官方模型清單更新與 OpenRouter models API 校對。
- 當 `CAP-206` 字幕/逐字稿策略定案後，切換到下一輪 capability 排程（Expansion 或新主線）。

## 舊版能力吸收任務清單

以下任務來自舊版 `Media Summarizer` 的實戰能力。這些項目要吸收行為與經驗，但不能把舊版 GUI 直連式架構搬回新版；實作時仍需走既有 `runtime / orchestration / services / note writer` 邊界。

- [x] `CAP-202` 下載穩定性：把舊版 YouTube 下載參數納入新版 `downloader-adapter` 評估與測試，包含 1080p 內格式選擇、`retries`、`fragment_retries`、`socket_timeout`、`continuedl`、`http_chunk_size`，並確認 podcast / direct media 不被 YouTube 參數誤傷。（完成：2026-05-01 01:38）
- [x] `CAP-404` 外部依賴更新：把舊版非阻塞 `yt-dlp` 版本檢查經驗落成新版 diagnostics 任務，要求背景檢查、有 timeout、使用者可讀提醒，並與現有 dependency drift / release gate 策略對齊。（完成：2026-05-01 01:40）
- [x] `CAP-205` 大型媒體轉錄策略：評估 Gemini file upload 作為 `TranscriptionProvider` 的可選 strategy，和目前 inline `inline_data` 路徑比較檔案大小限制、長媒體穩定性、取消流程、錯誤診斷與成本風險。（完成：2026-05-01 01:42）
- [x] `CAP-206` 字幕衍生輸出：將舊版 SRT 與影片字幕嵌入能力整理為可選 artifact lifecycle，先定義 `.srt` 生成、軟字幕嵌入、保留策略與失敗時是否影響主筆記輸出。（完成：2026-05-01 01:42）
- [x] `CAP-206` retention UX：參考舊版「不保留來源檔案 / 保留來源檔案 / 保留視訊 + 音訊」語意，重新檢查新版 `delete_temp / keep_temp` 是否足夠；若不足，定義進階 retention mode 與設定頁文案。（完成：2026-05-01 01:42）
- [x] `CAP-201` 網頁抽取品質：評估舊版 `trafilatura` 經驗是否應轉為新版 readability / sidecar / runtime extractor strategy，特別針對動態頁、付費牆疑似內容、metadata 品質與擷取不足警語。（完成：2026-05-01 01:42）

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
- [x] 將 media pipeline 明確拆成 `acquiring -> transcribing -> summarizing -> writing`（完成：2026-04-24 16:24）
- [x] 新增 `TranscriptionProvider` 介面，負責 audio/video artifact 到 transcript markdown / transcript segments（完成：2026-04-24 16:24）
- [x] 將現有 `AiProvider` 收斂為 summary provider，避免摘要模型承擔音訊輸入責任（完成：2026-04-24 16:24）
- [x] 設定頁拆分模型選擇：`transcriptionProvider/transcriptionModel` 與 `summaryProvider/summaryModel`（完成：2026-04-24 16:24）
- [x] 支援預設組合：Gemini audio-capable model 轉錄，Gemini summary model 摘要（完成：2026-04-24 16:24）
- [x] 支援 OpenRouter summary provider，第一版可用 `qwen/qwen3.6-plus` 處理已有逐字稿的文字摘要（完成：2026-04-24 16:24）
- [x] 調研並定義 Gladia `TranscriptionProvider` contract：採官方 `POST /v2/upload`、`POST /v2/pre-recorded`、`GET /v2/pre-recorded/{id}` 流程，確認 `x-gladia-key` 驗證、job lifecycle、輪詢/timeout/cancel 規則、回傳逐字稿與 utterance segments 格式。（完成：2026-05-01 19:35）
- [x] 實作 Gladia 轉錄 provider：由既有 AI-ready audio/video artifact 建立 Gladia pre-recorded transcription job，輪詢完成狀態，將結果正規化為現有 transcript markdown / transcript segments contract。（完成：2026-05-01 19:35）
- [x] 新增 Gladia 設定：`gladiaApiKey`、`transcriptionProvider: gladia`、`transcriptionModel: default`，並確保 provider 切換不影響 summary provider 設定。（完成：2026-05-01 19:35）
- [x] 定義 Gladia 錯誤映射與恢復策略：auth failure、quota/rate limit、file too large、unsupported media、empty transcript、polling timeout、job failure 映射到使用者可讀錯誤與 debug log diagnostics。（完成：2026-05-01 19:35）
- [x] 手動確認 Gladia API key / health check 可用，設定頁可用 Gladia API 測試驗證連線。（完成：2026-05-01 19:53）
- [x] 完成 Gladia media URL 實機 smoke：YouTube 媒體 URL 下載後進入 AI-ready pipeline，1106s 媒體分成 2 個 AI upload chunks，Gladia 成功轉錄並進入 3 段 chunked media summary，最後寫入 Obsidian 筆記。（完成：2026-05-01 19:59）
- [ ] 補 Gladia local media 實機 smoke：本機音訊/影片流程需驗證 Gladia 轉錄成功、取消與設定缺漏。
- [ ] 補 Gladia 混合 provider smoke：驗證 Gladia 轉錄 + OpenRouter/Qwen 摘要可完整寫入筆記。
- [ ] 定義手動 retry：轉錄成功但摘要失敗時，可保留 transcript 並由使用者明確選擇只重跑摘要
- [x] 強化 OpenRouter 摘要空回應處理：當 response 沒有 `message.content` 時，保留 HTTP status、provider error detail 與 response shape 到 debug log，modal 顯示可行診斷方向（quota / rate limit / model unsupported / empty output）（完成：2026-04-29 00:36）
- [x] 補摘要階段 recovery：轉錄成功但 OpenRouter 摘要失敗時，保留 transcript 與 media artifacts 狀態；自動 fallback 到 Gemini 的行為已於 2026-05-01 20:52 移除，改由使用者手動重跑。（完成：2026-04-29 00:36，更新：2026-05-01 20:52）
- [x] 補長逐字稿 + OpenRouter 空輸出 regression test，覆蓋 chunked transcript summary request 與使用者可讀錯誤訊息（完成：2026-04-29 00:36）
- [x] 補 Gemini 轉錄預設模型調整：將新安裝預設轉錄模型改為 `gemini-3-flash-preview`；自動 retry 行為已於 2026-05-01 20:52 移除，HTTP 503 high demand 會直接回報原錯誤。（完成：2026-05-01 02:19，更新：2026-05-01 20:52）
- [x] 內建 Gemini 轉錄與摘要模型清單：預設 catalog 固定提供 `gemini-3-flash-preview` 與 `gemini-2.5-flash` 給 Gemini 轉錄、Gemini 摘要兩種用途，讓新安裝與舊設定載入時都可直接在對應下拉選單選用。（完成：2026-05-01 20:16）
- [x] 校正 Gemini 3 Flash Preview 官方 model id：將錯誤的 `gemini-3.0-flash-preview` 改為官方 `gemini-3-flash-preview`，並在設定載入時自動遷移舊值。（完成：2026-05-01 20:32）
- [x] 將 Gemini 內建模型下拉顯示文字改為官方 model ID：`gemini-3-flash-preview`、`gemini-2.5-flash`，避免 display name 與 API model id 混淆。（完成：2026-05-01 20:40）
- [x] 移除 AI provider 自動 fallback：Gemini 轉錄容量錯誤不再自動改用其他 Gemini 模型，OpenRouter 摘要失敗不再自動改用 Gemini；錯誤直接呈現原 provider 的實際原因，並保留轉錄 recovery artifact 供後續手動重跑。（完成：2026-05-01 20:52）
- [x] 補上 unit / integration tests，覆蓋轉錄模型與摘要模型不同 provider 的 routing 行為（完成：2026-04-24 16:24）

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
- [ ] 完成逐字稿雙輸出：逐字稿除依規則寫入 Obsidian 筆記外，也需在下載媒體的 session 資料夾中保留一份完成版逐字稿檔案；此保留不應被 `retentionMode: delete_temp` 成功清理移除，並需納入 cleanup / final handoff 安全檢查。
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

- [x] 撰寫 `docs/Manual.md`（完成：2026-04-24 09:08）
- [x] 整理安裝、設定、smoke test、vault build/sync 的操作說明（完成：2026-04-24 09:08）
- [x] 補齊模型選擇章節：Gemini 四模型下拉選單、推薦預設、quality / fast 使用情境（完成：2026-04-24 16:24）
- [x] 補齊轉錄模型與摘要模型拆分說明：為何拆分、建議組合、成本與品質取捨（完成：2026-04-24 16:24）
- [x] 補齊 OpenRouter / Qwen 摘要模型使用限制：可做文字摘要，不作為 audio transcription 主路徑（完成：2026-04-24 16:24）
- [x] 補齊 API key 與 provider 設定教學：Gemini、OpenRouter，以及未來 OpenAI API 與 ChatGPT/Codex Pro 訂閱差異（完成：2026-04-24 16:24）
- [ ] 補齊 Gladia 轉錄 provider 使用說明：API key 設定、建議使用情境、與 Gemini 轉錄的取捨、常見錯誤與成本注意事項
- [ ] 補齊常見問題與疑難排解：轉錄失敗、摘要失敗、重跑摘要、模型不可用、rate limit、成本預估
- [ ] 補齊使用情境 walkthrough：網頁摘要、YouTube/podcast、本機音訊、本機影片、已有逐字稿重跑摘要

## Reliability And Operations 穩定性與營運

### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

Why：
目前已有 typecheck/test/build，但產品能力增加後，需要從「指令成功」升級成「能力矩陣驗證」。

Open Work：

- [x] 整理 webpage / media URL / local media 的 smoke checklist（完成：2026-04-24 01:28）
- [x] 建立 capability-based 測試矩陣，而不是只按檔案或服務測（完成：2026-04-24 01:28）
- [x] 定義桌面 regression gate，確保新 runtime 或新流程不破壞既有 webpage flow（完成：2026-04-24 07:35）
- [ ] 將 Gladia 加入 provider smoke matrix：已完成 media URL + Gladia 轉錄 + 摘要 + 寫筆記路徑；仍需覆蓋 local media 成功路徑，以及 Gladia 轉錄 + OpenRouter/Qwen 摘要的混合 provider 路徑

### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

Why：
舊版有 debug log、平台偵測除錯、下載恢復經驗；新架構應把 observability 當成正式能力，而不是臨時 log。

Open Work：

- [x] 定義 debug logging policy（user-facing、developer-facing、runtime-facing）（2026-04-24 01:18）
- [x] 建立 capability detection / diagnostics summary（desktop/mobile/runtime availability）（2026-04-24 01:00）
- [x] 統一錯誤訊息層級：notice、modal、log、test assertion（2026-04-24 01:18）
- [x] 補 AI provider response diagnostics：OpenRouter / Gemini 失敗時需能從 debug log 分辨 transport error、provider error payload、empty output、unexpected response shape（完成：2026-04-29 00:36）
- [x] 補 Gladia provider diagnostics：debug log 需保留 request/job id、HTTP status、provider error payload、polling 狀態轉換與 transcript 正規化結果摘要，且不得記錄 API key 或原始敏感內容。（完成：2026-05-01 19:35）

### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

Why：
目前已有本地 build，但工作流仍偏人工。舊版 dev log 顯示 release automation 與工具鏈整理是必要能力。

Open Work：

- [x] 保持每次 build 後同步到指定 Obsidian vault 的開發工作流（完成：2026-04-24 09:26）
- [x] 整理 build / release / commit / test SOP 與檢查點（完成：2026-04-24 09:26）
- [x] 規劃 release automation（GitHub Actions）（完成：2026-04-24 09:26）

### CAP-404 External Dependency Update Strategy 外部依賴更新策略

Why：
`yt-dlp` 與媒體下載環境高度變動，若不提早設計更新策略，後續會頻繁被外部平台變化打斷。

Open Work：

- [x] 規劃 `yt-dlp` update strategy（版本檢查、更新提醒、未來自動更新）（完成：2026-04-24 10:06）
- [x] 定義非阻塞版本檢查與更新提醒流程，要求背景執行、具 timeout，且不得阻塞 plugin 啟動（完成：2026-04-24 10:06）
- [x] 規劃 `ffmpeg` / `ffprobe` 相容性與平台差異檢查（完成：2026-04-24 10:06）
- [x] 定義 dependency drift 對 smoke / release gate 的影響（完成：2026-04-24 10:06）
- [x] 實作 `ffmpeg` / `ffprobe` 多來源下載、SHA-256 驗證、失敗 fallback 與下載取消流程（完成：2026-04-25 13:53）

## Final Handoff Gate 最終交付檢查

- [ ] 最終專案交付前安全重置：確認 repo 與同步到 vault 的 plugin 副本都已回復原始乾淨狀態，並清空任何使用者輸入、本機測試資料、媒體產物、產生的 cache、API key、provider key、token，以及 settings、logs、drafts、build outputs、ignored local files 中可能殘留的 secrets。
