# Master Backlog

最後更新：2026-05-02 02:44

## 用途

本檔是專案能力地圖與全局排程總表，只保留 capability 級摘要，不放細部 checklist。

對應文件：

- 日常工作主入口：[backlog-active.md](backlog-active.md)
- 已完成封存：[backlog-archive.md](backlog-archive.md)
- 版本化變更摘要：[dev_log.md](dev_log.md)

讀取順序：

- 每日工作先讀 `backlog-active.md`。
- 排程、重排優先序、查能力狀態讀本檔。
- 查已完成細節讀 `backlog-archive.md`。

## 狀態定義

- `completed`：第一輪已完成，細節已移入 archive 或不再需要每日追蹤。
- `active`：正在做，或下一步就要做。
- `queued`：已排入主線，但尚未進入執行。
- `parking`：長期保留，不是目前 release blocker。

## 近期優化路線

來源：
[media-acquisition-spec.md](media-acquisition-spec.md) 的「舊版 Media Summarizer 對照檢查」已比較舊版 Python GUI 與本專案 TypeScript/Obsidian plugin。結論是新版架構方向正確，不回搬舊版 GUI 直連流程；需要吸收的是舊版已驗證過的使用者體驗與大型媒體處理經驗。

目前順序：

1. `CAP-202` source artifact 與 acquisition manifest 已完成第一輪校準，並以 YouTube / direct media smoke 驗證實機下載結果；`ffmpegPath` 現會傳給 `yt-dlp --ffmpeg-location`，避免 PATH 沒有 ffmpeg 時 YouTube merge 失敗。
2. `CAP-203` 收斂 AI-ready artifact contract：chunk 命名已統一為 `chunk-0000.<ext>` 起，`balanced` profile 3 組樣本相對 `normalized.wav` 均降低 83% 以上；VAD / 轉錄品質守門移入 vNext。
3. `CAP-205` 收斂大型媒體轉錄與摘要：summary chunking 已改為內部 partial notes 後做 final synthesis；Gladia local media 與 Gladia + OpenRouter/Qwen mixed provider smoke 已通過；Gemini inline 多 chunk 已改成逐 chunk 轉錄後合併 transcript，且單段失敗會保留已完成 partial transcript；`transcript_file` 已可讀取保留逐字稿並只重跑摘要。
4. `CAP-206` 收斂 transcript / subtitle lifecycle：完成版逐字稿與真正 SRT 已分開命名，`transcript.md` 與 `subtitles.srt` 都會進入 session artifact lifecycle；`delete_temp` 成功清理仍會保留兩者。
5. `CAP-303` / `CAP-401` 在上述策略落地後補使用手冊與 smoke matrix：覆蓋 Gemini / Gladia / OpenRouter 組合、local media、字幕與 artifact retention；摘要失敗後重跑已由 `transcript_file` flow 先落地。
6. `CAP-404` 保留為 queued enhancement：基線外部依賴策略已完成；若安裝摩擦仍高，再補 `ytDlpPath`、managed install/update 或設定頁診斷 UX。

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

狀態：`completed`

摘要：
`webpage URL -> summary note` 主線已打通。付費牆與內容不完整警語屬於後續品質補強，不阻塞目前 media release。

#### CAP-202 Media Acquisition Boundary 媒體取得邊界

狀態：`active`

摘要：
`yt-dlp` 下載、session isolation、metadata normalization、cancellation、舊版 YouTube 下載 resilience 參數、source artifact 可辨識檔名與 artifact manifest 回寫已落地。YouTube / direct media smoke 已補，並修正 configured `ffmpegPath` 未傳給 `yt-dlp` merge 階段的問題。

#### CAP-203 AI-Ready Media Processing AI 可用媒體處理

狀態：`active`

摘要：
已建立 `process-media-url`、pre-upload compressor、Opus/AAC/FLAC fallback、長媒體 chunk 與 transcript-ready payload，且 chunk artifact 命名已統一為 `chunk-0000.<ext>` 起。`balanced` profile 已完成 3 組樣本量測並達標；VAD / 轉錄品質守門移入 vNext，v1 保留 `vadApplied: false` 與 codec fallback。

#### CAP-204 Local Media Flow 本機媒體流程

狀態：`completed`

摘要：
本機媒體 ingestion 已共用 media pipeline 的 AI-ready artifact 與後續 handoff；後續只剩隨 `CAP-202` source artifact 與 `CAP-205` provider smoke 做校準。

#### CAP-205 AI Processing Pipeline AI 處理管線

狀態：`active`

摘要：
已落地轉錄/摘要模型拆分、provider routing、OpenRouter 診斷、Gladia pre-recorded transcription provider、Gladia media URL smoke、Gladia local media / mixed provider smoke、失敗 transcript recovery、summary final synthesis、Gemini 逐 chunk inline 轉錄合併、`transcript.md` / `subtitles.srt` handoff，以及 `transcript_file` 手動只重跑摘要 UX，並移除 AI provider 自動 fallback。長媒體全局摘要 regression gate 已補；下一步是補更多實機 smoke 紀錄與文件 walkthrough。

#### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

狀態：`active`

摘要：
已定義 retention matrix、metadata contract、cleanup / recovery 與 artifact lifecycle；`transcript.md` / `subtitles.srt` 雙輸出、metadata lineage、cleanup 保護，以及字幕產線 v1/vNext 邊界已落地。FFmpeg 軟字幕嵌入與含字幕影片保留策略已明確移入 vNext。

### User Experience 使用體驗

#### CAP-301 Minimal Interaction Flow 最小互動流程

狀態：`completed`

摘要：
最小 flow modal 已可承接既有 webpage flow。介面設計導覽與後續討論入口見 [ui-design.md](ui-design.md)。

#### CAP-302 Entry Points And Settings Experience 入口與設定體驗

狀態：`completed`

摘要：
已完成 ribbon 入口、template UX、輸入引導與錯誤文案第一版。設定頁與 flow modal 的外觀/互動改動需回鏈 [ui-design.md](ui-design.md)。

#### CAP-303 Documentation And User Manual 文件與使用手冊

狀態：`active`

摘要：
已完成安裝、設定、smoke test、日常操作手冊第一版，以及模型選擇、轉錄/摘要拆分與 provider 設定教學。下一步需補 Gladia、Gemini 大型媒體策略、長媒體全局摘要、重跑摘要、artifact retention、local media 與字幕輸出 walkthrough。

### Reliability And Operations 穩定性與營運

#### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

狀態：`active`

摘要：
已完成 capability-based 測試矩陣、smoke checklist 與 regression gate；YouTube / direct media smoke、Gladia local media / mixed provider smoke、Gemini 逐 chunk inline 轉錄、artifact manifest lineage、transcript/subtitle lifecycle regression、transcript-file summary retry integration 與長媒體全局摘要 regression gate 已補。下一步需補手動 smoke 補登。

#### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

狀態：`completed`

摘要：
已完成 logging policy、diagnostics summary、錯誤呈現層級、AI provider response diagnostics 與 Gladia job diagnostics。

#### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

狀態：`completed`

摘要：
已完成 build / release / vault sync SOP，並完成 release automation 規劃。

#### CAP-404 External Dependency Update Strategy 外部依賴更新策略

狀態：`queued`

摘要：
基線已完成：`yt-dlp`、`ffmpeg`、`ffprobe` 的版本檢查、相容性、drift gate、`ffmpeg` / `ffprobe` 多來源下載與 SHA-256 驗證更新流程已落地。queued enhancement：若使用者安裝摩擦仍高，再補 `ytDlpPath`、managed install/update 或設定頁診斷 UX。

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

狀態：`completed`

摘要：
已完成 provider 分層與使用者可管理的 AI 模型清單。模型清單由使用者透過設定頁維護；每筆模型記錄 provider、用途、顯示名稱與 model id。Gemini 轉錄與摘要 provider 內建 `gemini-3-flash-preview` 與 `gemini-2.5-flash`，OpenRouter 支援官方 models API 查詢、校對與驗證。

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
保留 API key、cache、外部媒體與未來 migration / retention 政策規劃。具體最終交付清理 checklist 追蹤在 `backlog-active.md` 的 `Final Handoff Gate`。

#### CAP-508 Input Source Expansion Strategy 輸入來源擴充策略

狀態：`parking`

摘要：
保留未來擴增 AI input 來源類型的能力規劃。新增來源時不得直接塞進既有 `webpage_url` / `media_url` / `local_media` 分支，而應先定義輸入分類、抽取器、AI payload contract、模型能力需求、metadata / citation 規則、retention 策略與測試矩陣。

候選第一批低風險來源：

- `transcript_file`：`.md` / `.txt` 逐字稿已先落地，跳過轉錄直接摘要；`.srt` / `.vtt` 解析保留為後續格式擴充。
- `text_file` / `markdown_file`：`.txt` / `.md`，抽文字後直接摘要。
- `clipboard_text`：貼上文字後直接摘要。
- `obsidian_note`：目前筆記或指定筆記摘要。
- `folder_notes`：多篇 Obsidian notes 彙整摘要。

Done When：

- 已產出 vNext input source matrix。
- 已挑選第一批低風險來源進入 active backlog。
- 架構上已有可重用的 text input pipeline 與 source descriptor contract。
