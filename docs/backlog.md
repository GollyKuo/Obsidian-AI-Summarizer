# Master Backlog

最後更新：2026-05-01 23:45

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

## 近期優化路線：舊版對照後

來源：
`docs/media-acquisition-spec.md` 的「舊版 Media Summarizer 對照檢查」已把舊版 Python GUI 與本專案 TypeScript/Obsidian plugin 流程逐項比較。結論是新版架構方向正確，不應回搬舊版 GUI 直連流程；需要吸收的是舊版已驗證過的使用者體驗與大型媒體處理經驗。

優化順序：

1. `CAP-202` 先收斂原始來源檔與 acquisition manifest：media URL 下載與 local media 匯入都要在 session 內保留原始檔案與原始/安全化檔名，後續轉檔與壓縮只產生衍生 artifact；同時完成 YouTube / podcast smoke 基線，並決定 `metadata.json` 是否成為完整 artifact manifest。如果是，需補入 source artifact path、original filename、`uploadArtifactPaths`、chunk metadata、selected codec 與 VAD 狀態。
2. `CAP-203` 再收斂 AI-ready artifact contract：統一 chunk 命名起點，量測 `balanced` profile 對 `normalized.wav` 的壓縮比例，並決定 VAD / 轉錄品質守門是 v1 實作還是 vNext 規格。
3. `CAP-205` 接著處理大型媒體轉錄與摘要穩定性：Gemini inline 多 chunk 不能長期維持「一次 request 塞所有 inline_data」；優先改成逐 chunk inline 轉錄後合併 transcript，降低單次 payload、timeout 與重試成本。摘要階段必須以乾淨合併 transcript 做全局整合輸出，不得把 chunk / part 等技術分段標記暴露到最終筆記。Gemini file upload strategy 保留為 vNext 可選策略，處理超長媒體、單 chunk 仍過大或 inline 穩定性不足的情境。
4. `CAP-206` 同步整理 transcript / subtitle lifecycle：完成版逐字稿應與真正 SRT 分開命名，避免 `transcript.srt` 內放 markdown；`subtitles.srt` 已定案為 session 暫存資料夾內必保留產物，舊版的 `_subtitled.mkv` 則作為可選輸出與進階 retention mode 評估。
5. `CAP-303` / `CAP-401` 在上述決策後補使用手冊與 smoke matrix：把 Gemini / Gladia / OpenRouter 組合、摘要失敗後重跑、local media、字幕與 artifact retention 的操作路徑寫成可驗證情境。
6. `CAP-404` 保留為 queued enhancement：基線外部依賴策略已完成，但若使用者安裝摩擦仍高，再補 `ytDlpPath`、managed install/update 或設定頁診斷 UX；此項不阻塞目前 media pipeline 收斂。

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
`webpage URL -> summary note` 主線已打通，已定義舊版 `trafilatura` / readability 類抽取經驗的 vNext adapter 邊界；剩付費牆與內容不完整警語落地。

#### CAP-202 Media Acquisition Boundary 媒體取得邊界

狀態：`active`

摘要：
`yt-dlp` 下載、session isolation、metadata normalization、cancellation 與舊版 YouTube 下載 resilience 參數回收已落地。下一步是用 YouTube / podcast 手動 smoke 固定基線，將 media URL 與 local media 的 session source artifact 改為保留原始檔案與原始/安全化檔名，並把 `metadata.json` 是否升級為完整 artifact manifest 的決策與實作收斂。

#### CAP-203 AI-Ready Media Processing AI 可用媒體處理

狀態：`active`

摘要：
已建立 `process-media-url`、pre-upload compressor、Opus/AAC/FLAC fallback、長媒體 chunk 與 transcript-ready payload。下一步是統一 chunk 命名、完成 `balanced` profile 上傳量量測，並決定 VAD / 轉錄品質守門屬於 v1 實作或 vNext 規格。

#### CAP-204 Local Media Flow 本機媒體流程

狀態：`active`

摘要：
本機媒體 ingestion 會共用 `CAP-203` 的 AI-ready artifact 與後續 handoff。

#### CAP-205 AI Processing Pipeline AI 處理管線

狀態：`active`

摘要：
收斂 transcript、summary、chunking、跨輸入來源共用的 AI output contract，已落地轉錄/摘要模型拆分、provider routing、OpenRouter 空回應診斷、Gladia pre-recorded transcription provider、Gladia media URL 實機 smoke、失敗 transcript recovery，並移除 AI provider 自動 fallback 以忠實呈現原 provider 錯誤。下一步是補 Gladia local media / mixed provider smoke、手動只重跑摘要 UX，把 Gemini 多 chunk inline 改成逐 chunk inline 轉錄後合併 transcript，並把媒體摘要 chunking 改成「內部分段、最終全局整合」以禁止 chunk 標記外洩；Gemini file upload 作為 vNext 可選策略保留。

#### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

狀態：`active`

摘要：
定義 retention matrix、metadata contract、cleanup / recovery 與 artifact lifecycle；已定案 `subtitles.srt` 必須保留在 session 暫存資料夾。下一步是把完成版 transcript markdown 與真正 UTF-8 SRT 分開，完成逐字稿雙輸出與字幕檔保留實作，並決定舊版 `_subtitled.mkv` 是否納入 v1 或延後為 vNext 可選輸出。

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

狀態：`active`

摘要：
已完成安裝、設定、smoke test 與日常操作手冊第一版，並補上多模型、轉錄/摘要拆分與 provider 設定教學。下一步需配合舊版對照後的媒體優化路線，補 Gladia、Gemini 逐 chunk inline / file upload 差異、長媒體全局摘要整合、重跑摘要、artifact retention、local media 與字幕輸出的 walkthrough。

### Reliability And Operations 穩定性與營運

#### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

狀態：`active`

摘要：
已完成 capability-based 測試矩陣、smoke checklist 與 regression gate；Gladia media URL smoke 已通過。下一步需補 local media、Gladia + OpenRouter/Qwen mixed provider smoke，並在 artifact manifest、chunk 命名、Gemini 逐 chunk inline 轉錄合併、長媒體全局摘要整合與 transcript/subtitle lifecycle 落地後補對應 regression gate。

#### CAP-402 Diagnostics And Error Reporting 診斷與錯誤回報

狀態：`completed`

摘要：
已完成 logging policy、diagnostics summary、錯誤呈現層級收斂與 AI provider response diagnostics；OpenRouter / Gemini 失敗時可從 debug log 分辨 transport error、provider error payload、empty output 與 unexpected response shape，Gladia 失敗時可保留 job id、polling status 與 provider error payload diagnostics。

#### CAP-403 Release, Build, And Vault Sync 發布、建置與 Vault 同步

狀態：`completed`

摘要：
已完成 build / release / vault sync SOP，並完成 release automation 規劃。

說明：CAP-403 負責可重複的 release / build / vault sync 流程，不承擔隱私政策、資料保留、secret handling 或最終交付清理。
#### CAP-404 External Dependency Update Strategy 外部依賴更新策略

狀態：`queued`

摘要：
基線已完成：`yt-dlp`、`ffmpeg`、`ffprobe` 的版本檢查、相容性、drift gate 策略、`ffmpeg` / `ffprobe` 多來源下載與 SHA-256 驗證更新流程已落地，並吸收舊版非阻塞 `yt-dlp` 最新版本提醒 UX 到新版 diagnostics。舊版對照後新增 queued enhancement：若安裝摩擦仍高，再補 `ytDlpPath`、managed install/update 或設定頁診斷 UX。

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
已完成 provider 分層與使用者可管理的 AI 模型清單。模型清單由使用者透過設定頁的下拉選單與管理輸入維護；每筆模型記錄 provider、用途（轉錄 / 摘要）、顯示名稱與 model id。Gemini 轉錄與摘要 provider 都內建 `gemini-3-flash-preview` 與 `gemini-2.5-flash` 兩個官方 model ID，並以 model ID 作為下拉顯示文字，轉錄與摘要共用同一套管理模型 autocomplete/datalist，會依目前 provider 動態切換 Gemini 或 OpenRouter 候選來源；OpenRouter 路徑支援從官方 models API 查詢、校對與驗證 model id / 名稱，Gemini 與 OpenRouter 模型清單支援手動更新，並採 1 天快取。Gemini 轉錄模型保留 audio-capable 風險提示與 API 驗證邊界；Gladia 使用 `default` 轉錄模型佔位，接入 CAP-205 provider routing，不改變 CAP-504 已完成的 catalog 邊界。（完成：2026-04-26）

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
說明：CAP-507 負責安全與隱私政策工作，例如 API key handling、cache / media retention、外部資料清理與 migration safety。具體的最終專案清理 checklist 追蹤在 `backlog-active.md` 最後的 `Final Handoff Gate`。

#### CAP-508 Input Source Expansion Strategy 輸入來源擴充策略

狀態：`parking`

摘要：
保留未來擴增 AI input 來源類型的能力規劃。新增來源時不得直接塞進既有 `webpage_url` / `media_url` / `local_media` 分支，而應先定義輸入分類、抽取器、AI payload contract、模型能力需求、metadata / citation 規則、retention 策略與測試矩陣。

執行策略：
目前不先做完整架構重構。`SourceDescriptor`、generic acquisition result、共用 text pipeline、generic note output contract、vision / OCR / connector routing 等前置調整，等 CAP-508 正式進入 active backlog 並選定第一批來源後再實作。近期只保留文件規則與邊界提醒：不要把新來源特殊判斷混進既有三條流程，後續修改 `SourceType`、`source-guidance`、runtime diagnostics 時也不要假設來源永遠只有目前三種。

候選來源：

- 容易優先：`transcript_file`（`.srt` / `.vtt` / `.txt` 逐字稿，跳過轉錄直接摘要）
- 容易優先：`text_file` / `markdown_file`（`.txt` / `.md`，抽文字後直接摘要）
- 容易優先：`clipboard_text`（貼上文字後直接摘要）
- 容易優先：`obsidian_note`（目前筆記或指定筆記摘要）
- 容易優先：`folder_notes`（多篇 Obsidian notes 彙整摘要）
- 中等成本：`pdf_file` / `pdf_url`（先限定可選取文字的 PDF；掃描 PDF 需另走 OCR / vision）
- 中等成本：`rss_feed`（feed entry 內容抽取後走 webpage / text summary）
- 中等成本：Office 文件（`.docx` / `.pptx` / `.xlsx`，需要文件 parser 與表格/投影片輸出規則）
- 高成本：`image_file`（需要 vision-capable provider、OCR 或 multimodal prompt contract）
- 高成本：動態網站、登入網站、付費牆內容（需要 browser/session/cookie 策略與隱私邊界）
- 高成本：多檔案專案摘要（需要 chunking、排序、來源引用、去重與批次排程）
- 高成本：Email / Notion / Google Drive 等 connector（需要 OAuth/connector 權限、同步範圍、隱私與資料保留政策）

架構前置調整：

- 定義 generic `SourceDescriptor` / `SourceAcquisitionResult`，讓每種來源都能描述 `sourceKind`、原始位置、可引用 metadata、輸入大小、需要的 runtime 能力與 cleanup policy。
- 將現有 `process-webpage`、`process-media-url`、`process-local-media` 的共同階段抽成可重用 use-case building blocks：validate、acquire/extract、normalize、summarize/transcribe、write note、cleanup。
- 建立文字型輸入的共用 pipeline：`TextExtractionResult -> TextAiInput -> summarizeTextWithChunking -> TextNoteInput`，避免每種非媒體來源各自複製 webpage flow。
- 將模型能力從 provider 名稱拆出：`text_summary`、`audio_transcription`、`vision_understanding`、`ocr`、`long_context` 等 capability，用來決定 UI 提示、驗證與 routing。
- 擴充 `NoteWriter` / note output contract，支援 generic source note，同時保留 media transcript 與 webpage metadata 的專屬欄位。
- 擴充 diagnostics 與 smoke matrix，讓每個 source kind 都能有自己的 readiness、錯誤提示、範例輸入與 regression gate。
- 與 `CAP-505 Batch And Queueing` 協調多來源/多檔案排程；與 `CAP-507 Security, Privacy, And Migration` 協調 connector、cookie、OAuth、cache retention 與 secret handling。

Done When：

- 已產出 vNext input source matrix，列出每種來源的輸入格式、抽取方式、AI 模型需求、metadata contract、retention policy、錯誤分類與測試策略。
- 已挑選第一批低風險來源（建議 `transcript_file`、`text_file` / `markdown_file`、`clipboard_text`）進入 active backlog。
- 架構上已有可重用的 text input pipeline 與 source descriptor contract，新增來源不需要複製整條 orchestration。
