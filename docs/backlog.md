# Master Backlog

最後更新：2026-05-06

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

1. `CAP-202`、`CAP-203`、`CAP-206`、`CAP-207`、`CAP-306`、`CAP-401` 已完成並移入 archive。
2. `CAP-205` Gemini transcription strategy vNext 已完成：`auto` 優先 Files API 上傳抽音訊後的 AI-ready artifact，保留逐 chunk inline fallback；Files API adapter、remote file lifecycle、privacy/retention、diagnostics 與 fallback tests 已落地。
3. `CAP-303` 文件補強不再列為 active 工作；既有完成項保留在 archive。
4. `CAP-404` 保留為 queued enhancement：基線外部依賴策略、`ytDlpPath`、設定診斷與 Windows desktop managed install/update 已完成；若安裝摩擦仍高，再評估 macOS/Linux installer 或更完整的設定頁診斷 UX。
5. `CAP-304` Flow Modal minimal UI adoption 已完成並移入 archive；Settings Tab polish 先保留在 `CAP-305` parking，不納入近期執行。窄寬度檢查只處理 Flow Modal 排版、換行與長輸入，不承接 mobile runtime 或平台限制文案。
6. `CAP-208` 逐字稿校對 / 清理階段已完成實作：摘要前可選 cleanup、fallback、raw transcript artifact 與測試已落地。
7. `CAP-508` Text File Summary Input 進入 active：用既有 `transcript_file` pipeline 承接一般 `.md/.txt` 文章文字，作為知乎、登入牆、付費牆或動態網頁阻擋擷取時的替代流程。
8. `CAP-510` MarkItDown Document File Ingestion 列為 queued：未來以 optional local Python sidecar 將 PDF / DOCX / PPTX / XLSX / EPUB 等文件轉成 Markdown，再接現有文字摘要與筆記輸出流程；不取代既有媒體或網頁 pipeline。

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

狀態：`completed`

摘要：
`yt-dlp` 下載、session isolation、metadata normalization、cancellation、舊版 YouTube 下載 resilience 參數、source artifact 可辨識檔名與 artifact manifest 回寫已落地。YouTube / direct media smoke 已補，並修正 configured `ffmpegPath` 未傳給 `yt-dlp` merge 階段的問題。細節已移入 [backlog-archive.md](backlog-archive.md)。

#### CAP-203 AI-Ready Media Processing AI 可用媒體處理

狀態：`completed`

摘要：
已建立 `process-media-url`、pre-upload compressor、Opus/AAC/FLAC fallback、長媒體 chunk 與 transcript-ready payload，且 chunk artifact 命名已統一為 `chunk-0000.<ext>` 起。`balanced` profile 已完成 3 組樣本量測並達標；VAD / 轉錄品質守門移入 vNext，v1 保留 `vadApplied: false` 與 codec fallback。細節已移入 [backlog-archive.md](backlog-archive.md)。

#### CAP-204 Local Media Flow 本機媒體流程

狀態：`completed`

摘要：
本機媒體 ingestion 已共用 media pipeline 的 AI-ready artifact 與後續 handoff；source artifact 校準與 provider smoke 已隨 `CAP-202` / `CAP-205` 完成。

#### CAP-205 AI Processing Pipeline AI 處理管線

狀態：`completed`

摘要：
已落地轉錄/摘要模型拆分、provider routing、OpenRouter 診斷、Gladia pre-recorded transcription provider、Gladia media URL smoke、Gladia local media / mixed provider smoke、失敗 transcript recovery、summary final synthesis、Gemini 逐 chunk inline 轉錄合併、Gemini Files API `auto` strategy、`transcript.md` / `subtitles.srt` handoff，以及 `transcript_file` 手動只重跑摘要 UX，並移除 AI provider 自動 fallback。細節已移入 [backlog-archive.md](backlog-archive.md)。

#### CAP-208 Transcript Cleanup And Proofreading 逐字稿校對與清理

狀態：`completed`

摘要：
在 `transcribe -> summarize` 之間新增可選 AI 校對 / 清理階段，修正明顯錯字、ASR 同音誤判、標點、斷句與重複贅詞，同時保留時間軸、原意與可追溯性。第一版採 `enableTranscriptCleanup = false`、清理失敗 fallback 到原始正規化逐字稿、共用既有 summary provider/model，並將 media flow 與 `transcript_file` 重跑摘要流程納入同一能力。實作計畫見 [transcript-cleanup-plan.md](transcript-cleanup-plan.md)，prompt 契約見 [API_Instructions.md](API_Instructions.md#逐字稿校對--清理指令-transcript-cleanup-prompt)。

Done When：

- `PROMPT_CONTRACT` 支援 `transcriptCleanupPrompt`，並新增 prompt builder。
- media flow 可在轉錄正規化後、摘要前選擇性執行 cleanup。
- `transcript_file` flow 可在讀檔後、摘要前選擇性執行 cleanup。
- cleanup disabled 時既有流程行為不變。
- cleanup failure fallback 與 warnings 有 unit / integration 測試覆蓋。
- `transcript.raw.md` / `transcript.md` 或等效 artifact 可追溯策略已落地。

#### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

狀態：`completed`

摘要：
已定義 retention matrix、metadata contract、cleanup / recovery 與 artifact lifecycle；`transcript.md` / `subtitles.srt` 雙輸出、metadata lineage、cleanup 保護，以及字幕產線 v1/vNext 邊界已落地。FFmpeg 軟字幕嵌入與含字幕影片保留策略已明確移入 vNext。細節已移入 [backlog-archive.md](backlog-archive.md)。

#### CAP-207 Frontmatter Template Output 摘要模板與 Frontmatter 輸出

狀態：`completed`

摘要：
依 [template-spec.md](template-spec.md) 收斂輸出模板能力。第一版 UI 只提供 `預設通用 Frontmatter` 與 `自訂模板`；新設定使用 `builtin:universal-frontmatter`，舊空字串 `templateReference` 視為相同預設。預設模板產生通用 YAML frontmatter，自訂模板支援完整 Obsidian 模板內容與 `{{summary}}` / `{{transcript}}` 插入點。`Book`、`Author`、`Description` 第一版由摘要模型同時輸出。細節已移入 [backlog-archive.md](backlog-archive.md)。

### User Experience 使用體驗

#### CAP-301 Minimal Interaction Flow 最小互動流程

狀態：`completed`

摘要：
最小 flow modal 已可承接既有 webpage flow。介面設計導覽與後續討論入口見 [features/ui-design.md](../features/ui-design.md)。

#### CAP-302 Entry Points And Settings Experience 入口與設定體驗

狀態：`completed`

摘要：
已完成 ribbon 入口、template UX、輸入引導與錯誤文案第一版。設定頁與 flow modal 的外觀/互動改動需回鏈 [features/ui-design.md](../features/ui-design.md)。

#### CAP-303 Documentation And User Manual 文件與使用手冊

狀態：`completed`

摘要：
已完成安裝、設定、smoke test、日常操作手冊第一版，以及四種來源 walkthrough、模型選擇、轉錄/摘要拆分與 provider 設定教學。後續 provider 成本、rate limit、長媒體與 artifact retention 文件補強不再列為 active 工作；既有完成項已移入 [backlog-archive.md](backlog-archive.md)。

#### CAP-304 Flow Modal Minimal UI Adoption 摘要任務視窗 Minimal UI 導入

狀態：`completed`

摘要：
已依 [features/ui-design.md](../features/ui-design.md) 與 [features/implementation-guide.md](../features/implementation-guide.md) 將 Flow Modal 收斂為單頁分區任務介面，完成 `.ai-summarizer-flow` scope、`--ais-*` token mapping、來源 segmented control、Preflight Summary、階段列表、completed/failed/cancelled result panel，以及 dark/light、四種來源、長輸入、running/cancelled/completed/failed、narrow width 與 accessibility 實機檢查。細節已移入 [backlog-archive.md](backlog-archive.md)。

#### CAP-305 Settings Tab Minimal UI Polish 設定頁 Minimal UI 收斂

狀態：`parking`

摘要：
保留未來 Settings Tab minimal UI polish，但不納入近期工作。若之後要處理，方向仍是維持 Obsidian-native form，不做 dashboard；改善 `AI 模型`、`輸出與媒體`、`筆記模板`、`診斷` 的 active state、spacing、provider/model/API key 語意、高風險 retention/cache/tool path 說明，以及診斷頁對「現在能不能跑這個來源」的行動導向摘要。

#### CAP-306 In-App Help And HTML Tutorial Slides 內建說明與 HTML 教學簡報

狀態：`completed`

摘要：
新增新手導向的使用說明體驗：在 `Settings -> AI Summarizer` 內提供 `使用說明` 分頁，帶使用者完成安裝、API key、媒體工具檢查與四種輸入流程。`docs/Manual-slides.html` 已作為獨立下載的離線簡報，不在 settings 中開啟、嵌入或檢查檔案路徑；可作為 GitHub release 或文件頁 optional artifact。細節已移入 [backlog-archive.md](backlog-archive.md)。

### Reliability And Operations 穩定性與營運

#### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

狀態：`completed`

摘要：
已完成 capability-based 測試矩陣、smoke checklist 與 regression gate；YouTube / direct media smoke、Gladia local media / mixed provider smoke、Gemini 逐 chunk inline 轉錄、artifact manifest lineage、transcript/subtitle lifecycle regression、transcript-file summary retry integration 與長媒體全局摘要 regression gate 已補。細節已移入 [backlog-archive.md](backlog-archive.md)。

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
基線已完成：`yt-dlp`、`ffmpeg`、`ffprobe` 的版本檢查、相容性、drift gate、`ytDlpPath` 設定與診斷、Windows desktop `yt-dlp` managed install/update，以及 `ffmpeg` / `ffprobe` 多來源下載與 SHA-256 驗證更新流程。queued enhancement：若使用者安裝摩擦仍高，再評估 macOS/Linux installer 或更完整的設定頁診斷 UX。

### Expansion 擴充能力

#### CAP-501 Mobile Runtime Strategy 行動版 Runtime 策略

狀態：`parking`

摘要：
保留 mobile runtime 契約、平台策略與 mobile limitation 文案，但不是目前 release blocker。桌面限定的本機媒體、媒體 URL 依賴、檔案選擇器不可用說明、替代上傳策略與跨平台媒體處理能力，都統一在本 capability 規劃；`CAP-304` 只處理 Flow Modal 自身的桌面與窄寬度 UI 結構。

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

#### CAP-508 Text File Summary Input 文字檔案摘要輸入

狀態：`active`

摘要：
將既有 `transcript_file` 流程擴充為使用者可理解的「文字檔案」來源，支援一般 `.md` / `.txt` 文章、手動整理的網頁正文與既有逐字稿。目標是提供被網站阻擋擷取時的低風險替代流程；內部 source key 先維持 `transcript_file`，避免 settings/template/runtime contract migration。

Done When：

- Flow Modal、設定頁與錯誤提示將來源顯示為「文字檔案」，並說明可用於被阻擋網頁的手動正文。
- 檔案 picker、stage label、empty/error hint 支援一般文字檔語意。
- fallback metadata 使用 `Text File` 語意；既有 media session `metadata.json` 仍可保留原平台。
- Manual、smoke checklist、test matrix 補上 blocked webpage workaround。
- 保留既有 transcript retry tests，新增或調整文字檔案摘要測試。

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
- `document_file`：PDF / DOCX / PPTX / XLSX / EPUB 等文件先轉 Markdown，再接文字摘要 pipeline；MarkItDown 是優先評估的 optional sidecar。
- `clipboard_text`：貼上文字後直接摘要。
- `obsidian_note`：目前筆記或指定筆記摘要。
- `folder_notes`：多篇 Obsidian notes 彙整摘要。

Done When：

- 已產出 vNext input source matrix。
- 已挑選第一批低風險來源進入 active backlog。
- 架構上已有可重用的 text input pipeline 與 source descriptor contract。

#### CAP-509 Flashcard Generation 閃卡內容生成

狀態：`parking`

摘要：
保留摘要筆記完成後，依摘要內容再由 AI 產生閃卡資訊的擴充能力。第一階段只在 Flow Modal 的執行前摘要保留 `製作閃卡內容` 選項並記憶使用者偏好，不改變目前摘要、筆記寫入或 media pipeline。詳細閃卡格式、題型、數量、品質規則、輸出位置、與 Obsidian note / future spaced repetition plugin 的整合規格，先集中在 [flashcard-generation-spec.md](flashcard-generation-spec.md) 留白文件，待後續補齊。

Done When：

- 已定義閃卡生成規則、輸出格式與 note contract。
- 已定義是否與摘要筆記同檔、附檔、或獨立筆記輸出。
- 已將 Flow Modal `製作閃卡內容` 選項接入實際 AI pipeline。
- 已補 unit / integration / smoke 驗收。

#### CAP-510 MarkItDown Document File Ingestion 文件檔案轉 Markdown 匯入

狀態：`queued`

摘要：
以 Microsoft MarkItDown 作為 optional local Python sidecar，支援將本機 PDF、DOCX、PPTX、XLSX、EPUB 與其他常見文件格式轉成 Markdown，再沿用現有文字檔案摘要、chunking、summary provider、template 與 note writer 流程。第一版不取代 `webpage_url`、`media_url`、`local_media`，也不讓 MarkItDown 直接處理任意遠端 URL；定位是文件檔案 ingestion adapter。

參考來源：

- GitHub repo：https://github.com/microsoft/markitdown
- PyPI package：https://pypi.org/project/markitdown/
- OCR plugin：https://pypi.org/project/markitdown-ocr/

設計邊界：

- 新增 `document_file` 或等效 source descriptor，不直接塞進既有 `transcript_file` key，避免語意混淆。
- 第一版只接受本機檔案路徑，限制檔案大小、timeout、可用副檔名與輸出 Markdown 長度。
- 透過 `local_bridge` 檢查 Python `>=3.10`、`markitdown` 版本與必要 optional extras；未安裝時提供 diagnostics，不阻塞 `.md/.txt` 文字檔案摘要。
- 預設停用 MarkItDown plugins、Document Intelligence、任意 URI conversion 與 ZIP 遞迴；若未來開放，需先補 security / privacy / retention 規格。
- 轉換結果應寫入 session artifact 或 memory handoff，保留來源檔案 metadata、conversion warnings 與 troubleshooting 訊息。

Done When：

- 已完成 `document_file -> markdown -> summary note` 的 orchestration contract。
- 已完成 MarkItDown sidecar dependency diagnostics 與錯誤分類。
- 已補 PDF / DOCX / PPTX / XLSX 的轉換 adapter tests，並覆蓋缺少 Python / 缺少 markitdown / unsupported file / timeout。
- Manual、test matrix、smoke checklist 說明 document file 來源與安裝限制。
