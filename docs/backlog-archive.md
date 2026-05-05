# Backlog Archive

最後更新：2026-05-05 00:45

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

### CAP-202 Media Acquisition Boundary 媒體取得邊界

責任邊界：
媒體來源進入 session 後，能保留可追蹤的 source artifact，後續所有轉檔、壓縮與分段都從 source artifact 衍生。

- [x] 完成 YouTube 至少一條手動 smoke 下載驗證，記錄輸入 URL、來源類型、輸出 artifact、metadata 與成功/失敗原因。（完成：2026-05-02 01:50）
- [x] 完成 podcast / direct media 至少一條手動 smoke 下載驗證，記錄同上。（完成：2026-05-02 01:50）
- [x] media URL 下載完成後，session 內保留 yt-dlp 實際輸出的原始檔與原始/安全化檔名，不再只以 `downloaded.<ext>` 作為唯一可辨識來源。（完成：2026-05-02 00:22）
- [x] local media 匯入 session 時，保留原始檔名或安全化後的原始檔名，並在 metadata 中記錄原始絕對路徑與 session 內 source artifact 路徑。（完成：2026-05-02 00:22）
- [x] 將 `metadata.json` 校準為 artifact manifest：補 `originalFilename`、`sourceArtifactPath`、`derivedArtifactPaths`、`uploadArtifactPaths`、`chunkCount`、`chunkDurationsMs`、`vadApplied`、`selectedCodec`。（完成：2026-05-02 00:22）
- [x] 同步更新 [media-acquisition-spec.md](media-acquisition-spec.md)：定義 source artifact 命名、路徑安全化、同名衝突、清理與 recovery 規則。（完成：2026-05-02 00:22）

### CAP-203 AI-Ready Media Processing AI 可用媒體處理

責任邊界：
把 source artifact 穩定轉成 transcript-ready payload，並讓成本、品質與 chunk 命名可驗證。

- [x] 完成 `balanced` profile 對 `normalized.wav` 的 3 組樣本量測，目標上傳量降低至少 70%。（完成：2026-05-02 01:50）
- [x] 決定 VAD 與轉錄品質守門屬於 vNext 規格；v1 保留 chunking、codec fallback 與 `vadApplied: false` manifest 欄位。（完成：2026-05-02 01:50）
- [x] 統一 chunk 命名起點：規格、測試與產物一致使用 `chunk-0000.<ext>` 起。（完成：2026-05-02 01:01）
- [x] 將 `balanced` profile 壓縮量測結果同步到 [media-acquisition-spec.md](media-acquisition-spec.md)。（完成：2026-05-02 01:50）

### CAP-204 Local Media Flow 本機媒體流程

責任邊界：
本機音訊 / 影片匯入、格式檢查、快取與 artifact lifecycle，與 media URL 共用 AI-ready pipeline。

- [x] 定義 `local media` v1 支援範圍：audio/video、大小限制、容器格式。（完成：2026-04-23 16:24）
- [x] 定義 local file ingestion adapter 與錯誤分類。（完成：2026-04-23 16:24）
- [x] 讓 local media flow 共用 `CAP-203` 的壓縮與 AI-ready handoff。（完成：2026-04-23 16:24）
- [x] 補 local media 的 unit / integration 測試。（完成：2026-04-23 16:24）

### CAP-205 AI Processing Pipeline：v1 Completed Scope AI 處理管線 v1 完成範圍

責任邊界：
轉錄、摘要與錯誤恢復走明確 provider contract；大型媒體 v1 以 chunk inline 轉錄、合併 transcript 與 final synthesis 控制輸出品質。Gemini file upload vNext strategy 仍留在 active backlog。

- [x] 補 Gladia local media 實機 smoke：驗證本機音訊/影片可成功轉錄。（完成：2026-05-02 02:22）
- [x] 補 Gladia 混合 provider smoke：驗證 Gladia 轉錄 + OpenRouter/Qwen 摘要可完整寫入筆記。（完成：2026-05-02 02:22）
- [x] 實作 Gemini 逐 chunk inline 轉錄合併：每個 `ai-upload` chunk 各自送 Gemini `inline_data` request，成功後依順序合併 transcript。（完成：2026-05-02 02:28）
- [x] Gemini 逐 chunk inline 轉錄需完成合併後的 `transcript.md` / `subtitles.srt` handoff；chunk-level diagnostics、partial transcript recovery 與單段 retry 邊界已先在 provider/orchestration 層落地。（完成：2026-05-02 02:44）
- [x] 校準 `media-summary-chunking`：移除最終輸出的 `## Chunk N` 合併格式，改為內部 partial notes 後做 final synthesis。（完成：2026-05-02 01:55）
- [x] 若 transcript 過長必須二階段處理，只能產生內部 partial notes，再以 final synthesis 輸出單一連貫摘要。（完成：2026-05-02 03:12）
- [x] 最終摘要不得出現 `chunk`、`Chunk 1`、`part`、`Part 1`、`分段` 等技術標記，除非原始內容本身就在談這些詞。（完成：2026-05-02 02:22）
- [x] 定義並落地手動 retry：轉錄成功但摘要失敗時，可選 `transcript_file` 讀取保留的 `transcript.md` 或 `.txt`，跳過轉錄只重跑摘要與 note 輸出。（完成：2026-05-02 03:05）

### CAP-205 Gemini Files API vNext Strategy Gemini Files API 轉錄策略

責任邊界：
Gemini 轉錄 provider 的 vNext 傳輸策略。`auto` 優先 Files API 上傳抽音訊後的 AI-ready artifact，並保留逐 chunk inline fallback；摘要 provider 不決定媒體上傳方式。

- [x] 定義 Gemini transcription strategy 設定：`auto` 優先 Files API 上傳抽音訊後的 AI-ready artifact，保留 `inline_chunks` fallback；摘要 Provider 不得決定媒體上傳方式。（完成：2026-05-05 01:31）
- [x] 建立 Gemini Files API adapter：upload、get / poll ACTIVE、generateContent with file reference、delete。（完成：2026-05-05 01:31）
- [x] 擴充 remote file lifecycle：metadata manifest 記錄 remote file name / uri / state / local artifact path，並處理 completed / failed / cancelled cleanup。（完成：2026-05-05 01:31）
- [x] 補 privacy / retention policy：說明 Gemini remote file 暫存、本機 `delete_temp` / `keep_temp` 的邊界，以及 free / paid tier 資料使用差異。（完成：2026-05-05 01:31）
- [x] 補 diagnostics：upload、polling、generateContent、delete、rate limit、quota、empty transcript 與 provider error payload 分類。（完成：2026-05-05 01:31）
- [x] 補 fallback 與測試：Files API 失敗時回到逐 chunk inline；轉錄、`transcript.md`、`subtitles.srt`、summary handoff 與最終摘要不暴露 strategy / chunk 技術標記。（完成：2026-05-05 01:31）

### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

責任邊界：
筆記、逐字稿、字幕與暫存 artifact 有一致生命週期；該保留的檔案不會被清理流程刪掉。

- [x] 完成逐字稿雙輸出：逐字稿除寫入 Obsidian 筆記外，也要在 session 資料夾中保留完成版 `transcript.md`。（完成：2026-05-02 02:44）
- [x] 實作真正 UTF-8 `subtitles.srt` 產生與保留，不得把 markdown transcript 寫入 `.srt`。（完成：2026-05-02 02:44）
- [x] `transcript.md` 與 `subtitles.srt` 都要納入 `metadata.json` lineage。（完成：2026-05-02 02:44）
- [x] `retentionMode: delete_temp` 成功清理時，仍不得移除必保留的逐字稿與字幕檔。（完成：2026-05-02 02:44）
- [x] 補 cleanup / recovery / final handoff 安全檢查，確認字幕檔與逐字稿保留策略沒有被清理流程破壞。（完成：2026-05-02 02:44）
- [x] 定義字幕產線 v1/vNext 邊界：`.srt` 生成、FFmpeg 軟字幕嵌入、含字幕影片保留策略。（完成：2026-05-02 03:18）

### CAP-207 Frontmatter Template Output 摘要模板與 Frontmatter 輸出

責任邊界：
依 [template-spec.md](template-spec.md) 將輸出模板收斂為 `預設通用 Frontmatter` 與 `自訂模板`。預設模板產生通用 YAML frontmatter；自訂模板支援完整 Obsidian 模板內容與 `{{summary}}` / `{{transcript}}` 插入點；`Book`、`Author`、`Description` 第一版由摘要模型同時輸出，但保留未來 metadata enrichment 擴充性。

- [x] 更新 template model：新增 `builtin:universal-frontmatter` reference，保留空字串設定相容，移除舊 `builtin:default`、`builtin:webpage-brief`、`builtin:media-session` 的使用者可見路徑。（完成：2026-05-03 23:24）
- [x] 更新 Template Library / Resolver：支援預設通用 frontmatter 欄位、`custom:<path>` 自訂模板、placeholder 置換、空模板 fallback，以及未來新增內建模板的資料結構。（完成：2026-05-03 23:24）
- [x] 更新 Note Writer：預設模板輸出 YAML frontmatter 後接 AI 摘要；自訂模板可控制 frontmatter 與 Markdown body；沒有 `{{summary}}` 時摘要接在模板後方，沒有 `{{transcript}}` 時逐字稿維持最後追加。（完成：2026-05-03 23:24）
- [x] 更新 summary prompt / AI output contract：讓摘要模型同時產生摘要正文、`Book`、`Author`、`Description`，並保留可替換為 metadata enrichment 的內部邊界。（完成：2026-05-03 23:24）
- [x] 補 metadata normalization：`Platform` 正規化為 YouTube、Podcast、Web、本機檔案；`Created` 輸出 `YYYY-MM-DD`；`tags` 固定保留，未製作 Flashcard 時輸出 `tags:` 留白。（完成：2026-05-03 23:24）
- [x] 更新 Flow Modal / Settings Tab：模板選項只顯示 `預設通用 Frontmatter` 與 `自訂模板`，自訂模板支援選擇既有 vault 模板與新增模板內容。（完成：2026-05-03 23:24）
- [x] 更新文件：同步 `docs/Manual.md`、template 操作導覽、疑難排解與 migration 說明。（完成：2026-05-03 23:24）
- [x] 補測試：template library / resolver / note writer unit tests，webpage、media、local media、transcript file integration coverage，以及自訂模板 `{{summary}}` / `{{transcript}}` 插入行為。（完成：2026-05-03 23:24）

Done When：

- UI 只顯示兩種模板選項，且既有空字串設定可無痛轉成預設通用 Frontmatter。
- 四種來源都能輸出符合 `template-spec.md` 的 YAML frontmatter、摘要正文與 transcript 位置。
- 自訂模板可包含完整 Obsidian 模板內容，並正確處理 `{{summary}}` / `{{transcript}}`。
- `Book`、`Author`、`Description`、`tags`、`Platform`、`Created` 欄位有測試覆蓋。
- 手冊、規格與測試矩陣已同步。

### CAP-208 Transcript Cleanup And Proofreading 逐字稿校對與清理

責任邊界：
在 `transcribe -> summarize` 之間新增可選 AI 校對 / 清理階段，修正明顯錯字、ASR 同音誤判、標點、斷句與重複贅詞，同時保留時間軸、原意與可追溯性。第一版採 `enableTranscriptCleanup = false`、清理失敗 fallback 到原始正規化逐字稿、共用既有 summary provider/model，並將 media flow 與 `transcript_file` 重跑摘要流程納入同一能力。

文件：

- [transcript-cleanup-plan.md](transcript-cleanup-plan.md)
- [API_Instructions.md](API_Instructions.md#逐字稿校對--清理指令-transcript-cleanup-prompt)
- [backlog.md](backlog.md#cap-208-transcript-cleanup-and-proofreading-逐字稿校對與清理)

- [x] 在 `PROMPT_CONTRACT` 新增 `transcriptCleanupPrompt`，並新增 `buildTranscriptCleanupPrompt`。（完成：2026-05-05 08:20）
- [x] 定義 cleanup provider 介面或在既有 provider 層新增 cleanup 方法。（完成：2026-05-05 08:20）
- [x] 新增 `enableTranscriptCleanup` 與 cleanup failure mode 設定。（完成：2026-05-05 08:20）
- [x] 將 media flow 接入 `transcribe -> normalize -> cleanup -> normalize -> summarize`。（完成：2026-05-05 08:20）
- [x] 將 `transcript_file` flow 接入 `read -> cleanup -> summarize`。（完成：2026-05-05 08:20）
- [x] 實作 cleanup failure fallback 與 warnings。（完成：2026-05-05 08:20）
- [x] 落地 `transcript.raw.md` / `transcript.md` 或等效 artifact 可追溯策略。（完成：2026-05-05 08:20）
- [x] 補 unit、integration 與長媒體 regression 測試。（完成：2026-05-05 08:20）

Done When：

- `PROMPT_CONTRACT` 支援 `transcriptCleanupPrompt`，並新增 prompt builder。
- media flow 可在轉錄正規化後、摘要前選擇性執行 cleanup。
- `transcript_file` flow 可在讀檔後、摘要前選擇性執行 cleanup。
- cleanup disabled 時既有流程行為不變。
- cleanup failure fallback 與 warnings 有 unit / integration 測試覆蓋。
- `transcript.raw.md` / `transcript.md` 或等效 artifact 可追溯策略已落地。

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

### CAP-303 Documentation And User Manual：Completed Items 文件與使用手冊完成項

責任邊界：
保存已完成的文件基礎與 walkthrough；provider、長媒體與 artifact retention 額外文件補強已取消，不再列為 active 工作。

- [x] 建立 UI 設計導覽文件，並從架構邊界、setup SOP、能力地圖、媒體規格與手冊加入引用。（完成：2026-05-02 03:18）
- [x] 記錄設定頁使用說明與 HTML 簡報更新策略：settings 內說明打包進 `main.js`，`Manual-slides.html` 作為 optional 離線文件，不作為 plugin 更新必要檔。（完成：2026-05-04 22:55）
- [x] 補使用情境 walkthrough：已有逐字稿重跑摘要。（完成：2026-05-02 03:05）
- [x] 補使用情境 walkthrough：網頁摘要、YouTube/podcast、本機音訊、本機影片。（完成：2026-05-05 00:45）

### CAP-304 Flow Modal Minimal UI Adoption 摘要任務視窗 Minimal UI 導入

責任邊界：
依 [features/implementation-guide.md](../features/implementation-guide.md) 將 `AI 摘要器` Flow Modal 重構成單頁分區任務介面，改善來源可見性、執行前摘要、長任務階段、完成/失敗/取消 action 與 Obsidian dark/light 可讀性；不得把 runtime、file writing 或 orchestration 邏輯放進 UI。

- [x] Batch 1：建立 Flow Modal root scope class `.ai-summarizer-flow`，新增或整理只作用於 AI Summarizer UI 的 style scope，不覆寫 Obsidian 全域 `.modal`、`.setting-item`、`body`、`.theme-dark` 或 `.theme-light`。（完成：2026-05-02 14:11）
- [x] Batch 1：建立第一版 `--ais-*` token mapping，底層使用 Obsidian CSS variables；確認 dark/light theme 下基本文字、surface、border、accent、danger 都可讀。（完成：2026-05-02 14:11）
- [x] Batch 2：將來源 dropdown 改成 compact segmented control，四個來源 `webpage_url`、`media_url`、`local_media`、`transcript_file` 同時可見，active state 與 keyboard focus 可辨識。（完成：2026-05-02 14:30）
- [x] Batch 2：重排 Source Input 區塊，讓 URL/path input 佔主要寬度，`填入範例` / `選擇檔案` action 在窄視窗可換行，長 URL 與 Windows path 不造成 overflow。（完成：2026-05-02 14:30）
- [x] Batch 2：收斂 `source-guidance.ts` 與 Flow Modal 主畫面文案；主畫面只保留短說明，支援格式、artifact lifecycle、dependency detail 放到 details disclosure。（完成：2026-05-02 14:30）
- [x] Batch 3：新增 Preflight Summary，顯示 note template、output folder、retention mode 使用者語意，以及媒體來源的 dependency readiness / 尚未檢查狀態。（完成：2026-05-02 14:37）
- [x] Batch 3：將單行 `status | stage` 改成來源感知 stage list；`webpage_url` 不顯示媒體階段，`transcript_file` 不顯示轉錄階段，`media_url` / `local_media` 顯示媒體準備與轉錄。（完成：2026-05-02 14:37）
- [x] Batch 3：取消流程顯示獨立 `cancelling` 狀態，保留 action row 位置穩定，避免使用者以為取消按鈕無效。（完成：2026-05-02 14:37）
- [x] Batch 4：completed result panel 顯示 note path，並提供 `開啟筆記`、`複製路徑`、`再摘要一次` 或等效 action。（完成：2026-05-02 14:57）
- [x] Batch 4：failed result panel 依 `ErrorCategory` 顯示 action-oriented 建議，至少覆蓋 validation、runtime unavailable、download failure、AI failure、note write failure；不要直接顯示 raw stack。（完成：2026-05-02 14:57）
- [x] Batch 4：cancelled result panel 與 failed 視覺區分；若有 recovery artifact，提示可改用 `transcript_file` 重跑摘要。（完成：2026-05-02 14:57）
- [x] 驗收：依 [features/visual-qa-checklist.md](../features/visual-qa-checklist.md) 實機檢查 dark/light、四種來源、長輸入、running/cancelled/completed/failed、narrow width、accessibility；scope 與 source guidance 已完成靜態 / unit 檢查。（完成：2026-05-03 23:08）
- [x] 驗收：UI 變更後跑 `npm run smoke:desktop`；窄寬度以 visual QA 檢查，mobile runtime / limitation 文案改由 `CAP-501` 驗收。（完成：2026-05-02 15:37）

### CAP-306 In-App Help And HTML Tutorial Slides 內建說明與 HTML 教學簡報

責任邊界：
讓新手在 Obsidian settings 內就能找到最短操作路徑；完整 `Manual-slides.html` 簡報作為獨立文件另行下載。

- [x] 在 `Settings -> AI Summarizer` 新增 `使用說明` 分頁。（完成：2026-05-04 23:05）
- [x] 使用說明分頁提供第一次使用、plugin 更新步驟，以及 `前往 AI 模型` / `前往診斷` 快速入口。（完成：2026-05-04 23:28）
- [x] 將使用說明分頁改成緊湊 action row 與兩欄步驟 layout，移除大卡片式堆疊觀感。（完成：2026-05-04 23:42）
- [x] 移除 settings 內的 `Manual-slides.html` 開啟入口與本機檔案檢查，定案為獨立下載文件。（完成：2026-05-04 23:14）
- [x] 產生 `docs/Manual-slides.html` 單檔簡報，供離線瀏覽與教學投影。（完成：2026-05-05 00:03）
- [x] 決定 `Manual-slides.html` 可作為 GitHub release 或文件頁的 optional artifact；同步 [Manual.md](Manual.md)、[Manual-Developer.md](Manual-Developer.md) 與 [distribution-guide.md](distribution-guide.md)，不納入 Community Plugin 必要更新資產。（完成：2026-05-05 00:45）

## Completed Reliability And Operations 已完成穩定性與營運

### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

責任邊界：
每個 release blocker 都要有可重跑的驗證入口。

- [x] 將 YouTube / direct media smoke 結果補入 smoke matrix。（完成：2026-05-02 01:50）
- [x] 將 local media + Gladia 轉錄成功路徑補入 provider smoke matrix。（完成：2026-05-02 02:22）
- [x] 將 Gladia 轉錄 + OpenRouter/Qwen 摘要混合 provider 路徑補入 smoke matrix。（完成：2026-05-02 02:22）
- [x] 新增 artifact manifest 驗證：source artifact、derived artifact、upload artifact、transcript、subtitle lineage 都可追蹤。（完成：2026-05-02 02:44）
- [x] 新增 Gemini 逐 chunk inline 轉錄合併 regression gate。（完成：2026-05-02 02:28）
- [x] 新增長媒體全局摘要 regression gate，確認最終輸出不含 chunk/part 技術標記。（完成：2026-05-02 03:12）
- [x] 新增 transcript/subtitle lifecycle regression gate，確認 `delete_temp` 不會移除必保留字幕與逐字稿。（完成：2026-05-02 02:44）

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
