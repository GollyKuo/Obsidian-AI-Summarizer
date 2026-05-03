# Manual

最後更新：2026-05-02 02:44

## 適用範圍

這份手冊提供 `AI Summarizer` Obsidian plugin 的日常使用入口，涵蓋：

1. 安裝與建置
2. 啟用 plugin
3. 設定頁說明
4. 三種輸入流程
5. smoke test
6. vault build / sync

工程側指令與 release 規範請搭配：
1. `docs/commands-reference.md`
2. `docs/release-gate.md`

## 目前支援的輸入

1. `webpage URL`
2. `media URL`
3. `local media`

完整的 AI 路由與 Obsidian 寫入流程圖請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。

## 需求

### 基本需求

1. Obsidian 桌面版
2. Node.js 與 npm
3. Gemini API key

### 媒體流程額外需求

若要跑 `media URL` 或 `local media`，還需要：

1. `yt-dlp`
2. `ffmpeg`
3. `ffprobe`

缺少依賴時，設定頁的 diagnostics 區塊會顯示 `warning` 或 `error`。

## 安裝與建置

### 本地建置

```bash
npm install
npm run typecheck
npm run test
npm run build
```

`build` 會產生 repo 內的 `main.js`，供 plugin 載入。

### 直接同步到測試 Vault

專案目前預設同步到 `package.json` 內指定的測試 vault。

```bash
npm run dev:vault
npm run build:vault
npm run gate:local:vault
```

差異：

1. `dev:vault`：watch build 並同步到測試 vault。
2. `build:vault`：production build 後同步到測試 vault。
3. `gate:local:vault`：`typecheck + test + build:vault`。

### 同步到自訂 Vault

```bash
npm run build:vault:target -- --vault "D:\Your\Vault"
npm run dev:vault:target -- --vault "D:\Your\Vault"
```

也可使用環境變數：

```bash
set AI_SUMMARIZER_VAULT_PATH=D:\Your\Vault
npm run build:vault:target
```

同步目標路徑：

```text
<vault>\.obsidian\plugins\<manifest.id>\
```

主要同步檔案：

1. `main.js`
2. `manifest.json`
3. `styles.css`，若有提供
4. `versions.json`，若有提供

## 啟用 Plugin

1. 先執行一次 `build:vault` 或 `build:vault:target`
2. 重新開啟 Obsidian
3. 到 `Settings -> Community plugins`
4. 啟用 `AI Summarizer`

啟用後可從以下入口開啟：

1. 左側 ribbon 的 `AI 摘要器`
2. command palette 的 `開啟 AI 摘要器`

開發者若要調整 flow modal、設定頁、進度與結果畫面，請先參照 [features/ui-design.md](../features/ui-design.md)，再同步更新本手冊的使用者可見流程。

## 設定頁

### Gemini API 金鑰

Gemini 目前同時用於：

1. 媒體轉錄 provider
2. 預設摘要 provider

只要你還使用 Gemini 做轉錄或摘要，就需要填這個 key。Gemini 的模型 autocomplete 與模型清單更新也會使用這個 key 去抓官方 models API。

### 轉錄 Provider / 轉錄模型

設定頁已拆成：

1. `transcriptionProvider`
2. `transcriptionModel`

目前轉錄 provider 以 `Gemini` 為預設主線；也可切換到 `Gladia`，使用 Gladia 的非同步預錄音訊/影片轉錄 API。

預設建議：

1. Provider：`Gemini`
2. Model：`gemini-3-flash-preview`

Gemini 轉錄模型下拉選單會預先內建兩個官方 model ID：

1. `gemini-3-flash-preview`
2. `gemini-2.5-flash`

原因：

1. 轉錄屬於 audio/video ingestion，優先選穩定的 audio-capable 模型。
2. 摘要與轉錄已拆分，不需要讓摘要模型直接處理音訊。

轉錄模型建議：

| 任務情境 | 建議模型 | 說明 |
| --- | --- | --- |
| 預設轉錄、一般 YouTube / podcast / 本機音訊影片 | `gemini-3-flash-preview` | 目前實測對長媒體轉錄比 `gemini-2.5-flash` 更穩。若 provider 回傳錯誤，程式會直接呈現原錯誤，不自動換模型重跑。 |
| 既有設定或穩定模型 | `gemini-2.5-flash` | 仍可使用；若遇到 Gemini high demand / 503，請手動切到 `gemini-3-flash-preview` 或等待後重試。 |
| 大量短音訊、成本或延遲優先 | `gemini-2.5-flash-lite` | 適合較乾淨、較短、結構單純的內容；正式使用前先用自己的音訊樣本測試準確度。 |
| 低延遲即時語音互動 | `gemini-2.5-flash-live` 或 Live 類模型 | 這類模型偏即時互動，不是目前檔案轉錄主線；除非之後要做 real-time voice flow，否則不建議放進一般轉錄下拉選單。 |
| Preview / 新版 Flash 或 Flash-Lite | 只在 autocomplete 顯示且 API 測試通過時使用 | Preview 模型可用性、rate limit 與退場時間較容易變動；適合測試，不適合當唯一穩定轉錄設定。 |
| Pro 類模型 | 通常不作為轉錄預設 | 成本與延遲較高；除非內容非常困難且 Flash 轉錄品質不足，否則轉錄不優先用 Pro。 |

轉錄模型的實際可用性以 Gemini models API、設定頁 API 測試與一次真實轉錄請求為準；文件只提供選型建議。

### Gladia 轉錄 Provider

Gladia 支援預錄音訊與影片的非同步轉錄。設定頁提供獨立的 Gladia API Key，媒體來源仍會先走本專案既有的下載、壓縮與 AI-ready artifact 流程，再上傳到 Gladia 建立轉錄 job。

第一版邊界：

1. Gladia 只負責轉錄，不負責摘要。
2. 摘要仍交給 `summaryProvider`，可搭配 Gemini 或 OpenRouter/Qwen。
3. Gladia 轉錄會使用 upload -> pre-recorded job -> polling result 流程。
4. 若 Gladia job 失敗、逾時、空逐字稿或 API key 不可用，會回報為轉錄階段錯誤，不會直接進入摘要。

目前的使用方式：

1. `模型` 欄位只負責從你已加入的轉錄模型下拉選單中選擇。
2. Gemini 轉錄已內建 `gemini-3-flash-preview` 與 `gemini-2.5-flash`；其他模型可透過 `管理模型` 輸入框新增或刪除。
3. `管理模型` 輸入框有 autocomplete；輸入時會依目前 provider 從共用 model datalist 帶出候選。

### 摘要 Provider / 摘要模型

設定頁已拆成：

1. `summaryProvider`
2. `summaryModel`

預設建議：

1. Provider：`Gemini`
2. Model：`gemini-3.1-flash-lite-preview`

Gemini 摘要模型建議：

Gemini 摘要模型下拉選單也會預先內建兩個官方 model ID：

1. `gemini-3-flash-preview`
2. `gemini-2.5-flash`

| 任務情境 | 建議模型 | 說明 |
| --- | --- | --- |
| 預設摘要、日常筆記、高頻率使用 | `gemini-3.1-flash-lite-preview` | 目前專案預設摘要模型。適合快速整理逐字稿、網頁與一般筆記；注意 preview 模型可能變動。 |
| 長內容、技術演講、需要較完整層級與結構 | `gemini-3-flash-preview` | 偏品質與結構化輸出；適合比日常摘要更重的內容整理。 |
| 穩定模型、避免 preview 風險 | `gemini-2.5-flash` | 官方文件定位為低延遲、高流量且價格/效能平衡的模型；適合需要穩定性的摘要主線。 |
| 很短的摘要、低成本或低延遲優先 | `gemini-2.5-flash-lite` | 適合短網頁、短逐字稿、批次草稿；若需要細緻結構或長內容推理，優先改用 Flash。 |
| 複雜長文、研究型整理、多文件交叉推理 | Pro 類模型，例如 autocomplete 中可用的 `gemini-2.5-pro` / `gemini-3.1-pro-preview` | 品質與推理能力通常較強，但成本與延遲較高；適合少量高價值內容，不建議作為大量批次摘要預設。 |

摘要模型選型原則：

1. 大量日常摘要先選 Flash-Lite 或目前預設模型。
2. 需要穩定、不想承擔 preview 退場風險時選 `gemini-2.5-flash`。
3. 需要更完整結構、長內容整理或較強推理時選 Flash 或 Pro 類模型。
4. 摘要模型只處理文字輸入；媒體來源會先由轉錄模型產生逐字稿，再交給摘要模型。

目前的使用方式：

1. `模型` 欄位只負責從你已加入的摘要模型下拉選單中選擇。
2. Gemini 摘要已內建 `gemini-3-flash-preview` 與 `gemini-2.5-flash`；其他模型可透過 `管理模型` 輸入框新增或刪除。
3. `管理模型` 輸入框與轉錄模型共用同一套 model datalist。
4. 當 `summaryProvider = gemini` 時，autocomplete 會顯示 Gemini 官方模型候選。
5. 當 `summaryProvider = openrouter` 時，autocomplete 會顯示 OpenRouter 官方模型候選，新增前也會再做一次官方資料校驗。
6. 當 `summaryProvider = mistral` 且已填 `Mistral API Key` 時，autocomplete 會顯示 Mistral 官方模型候選，新增前也會再做一次官方資料校驗。

### OpenRouter API Key

當 `summaryProvider = openrouter` 時，設定頁會額外顯示 `OpenRouter API Key`。OpenRouter 的 autocomplete、模型清單更新與新增前校驗都會使用這個 key。

第一版支援的 OpenRouter 摘要模型：

1. `qwen/qwen3.6-plus`

限制：

1. OpenRouter/Qwen 目前只作為 transcript-first 的文字摘要路徑。
2. 它不是 audio transcription 主路徑，不負責直接吃音訊或影片。
3. 若沒有切到 `summaryProvider = openrouter`，可以先不填 OpenRouter key。

### Mistral API Key

當 `summaryProvider = mistral` 時，設定頁會額外顯示 `Mistral API Key`。Mistral 的 autocomplete、模型清單更新與新增前校驗都會使用這個 key。

第一版內建的 Mistral 摘要模型：

1. `mistral-small-latest`

Mistral 摘要模型建議：

1. 實際可選模型以 `Mistral API Key` 呼叫 [`GET /v1/models`](https://docs.mistral.ai/api/endpoint/models) 回傳的清單為準；這個 API 會列出目前使用者可用的模型。
2. 免費 `Experiment plan` 適合評估與原型，rate limit 較低；長文摘要先以可穩定跑完為優先，避免一開始就把高品質模型當大量批次預設。
3. 日常長文摘要、免費帳號穩定使用：優先用 `mistral-small-latest`，或 autocomplete 顯示的 `mistral-small-2603`。Mistral Small 4 的 context 為 256k，價格壓力也低於 Large。
4. 少量高價值長文、需要較完整結構與品質：若 autocomplete 顯示 `mistral-large-2512` 或 Large latest alias，可改用 Mistral Large 3；它同樣是 256k context，官方定位為 general-purpose 高性能模型，但免費帳號較容易遇到 rate limit。
5. `mistral-medium-*` 不作為免費帳號預設建議；只有在你的帳號清單可見、實測摘要品質明顯優於 Small，且 rate limit 可接受時再加入。
6. 若遇到 429、timeout 或長文摘要中斷，先退回 `mistral-small-latest`，並優先使用專案既有的 transcript-first / 分段摘要流程。

限制：

1. Mistral 目前只作為 transcript-first 的文字摘要路徑。
2. 它不是 audio transcription 主路徑，不負責直接吃音訊或影片。
3. 若沒有切到 `summaryProvider = mistral`，可以先不填 Mistral key。

### 模型清單更新與自動完成

AI 模型頁有一個 `模型清單更新` 區塊。

1. `更新` 會手動抓取 Gemini / OpenRouter / Mistral 官方模型清單。
2. 轉錄與摘要的 `管理模型` 輸入框共用同一個 datalist。
3. 每次 focus、輸入、變更時都會即時觸發 autocomplete。
4. 模型資料平常會快取 1 天；手動更新或 API key 變更會刷新對應資料。

### 為什麼拆成轉錄模型與摘要模型

完整路由圖請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。簡化規則如下：

拆分後的好處：

1. 音訊轉錄與文字摘要的責任邊界更清楚。
2. 可以用 Gemini 做轉錄，再用 Gemini、OpenRouter/Qwen 或 Mistral 做摘要。
3. `transcript_file` 可讀取已保留或手動修正的逐字稿，跳過轉錄，只重跑摘要與筆記輸出。

成本與品質取捨：

1. 單一 provider 最簡單，設定成本最低。
2. `Gemini -> Gemini` 是目前預設主線。
3. `Gemini -> OpenRouter/Qwen` 或 `Gemini -> Mistral` 適合已有逐字稿、只想換摘要模型的情境；此時可直接選 `逐字稿檔案`。

### 長媒體摘要策略

長媒體可能會先被切成多段處理，但這些段落只屬於內部 token control 與錯誤恢復，不是最終筆記結構。

1. 轉錄階段會先合併逐字稿，再交給摘要階段。
2. 如果逐字稿過長，摘要階段會先產生內部 partial notes。
3. partial notes 之後一定會再做 final synthesis，輸出單一連貫摘要。
4. 最終筆記不應出現 `Chunk 1`、`Part 1`、`分段 1` 這類處理標記。

### 輸出資料夾

控制摘要筆記寫入 vault 的相對資料夾；空值表示寫到 vault 根目錄。

### 媒體暫存資料夾

媒體流程的暫存目錄。請填入絕對路徑，避免寫進 vault。

### 媒體暫存檔保留

1. `delete_temp`：流程完成後刪除 source artifact、`normalized.wav`、`ai-upload/` 與 `metadata.json`，但保留完成版 `transcript.md` 與 `subtitles.srt`
2. `keep_temp`：流程完成後保留 source artifact、`normalized.wav`、`transcript.md` 與 `subtitles.srt`，並刪除 `ai-upload/` 與 `metadata.json`

`transcript.md` 是完成版逐字稿；`subtitles.srt` 是 UTF-8 SRT 字幕檔。兩者都保留在 session 暫存資料夾，供摘要失敗 recovery、檢查轉錄結果與後續手動重跑使用。

### Flow Modal 媒體工具診斷

在 `媒體 URL` 或 `本機媒體` 來源中，Flow Modal 的 `媒體工具` chip 可用來檢查本機媒體處理能力。點擊後會確認 `yt-dlp`、`ffmpeg`、`ffprobe` 與媒體暫存資料夾是否可用。

若狀態顯示不可用或檢查失敗，chip 旁會出現 `診斷` 入口，可前往設定頁查看媒體工具路徑、暫存資料夾與診斷細節。`網頁 URL` 與 `逐字稿檔案` 通常不需要這些媒體工具。

### 媒體壓縮策略

1. `balanced`：預設，優先壓低上傳量
2. `quality`：保留較高音質

### 輸出模板

模板的完整規格、內建模板內容、placeholder 與輸出結構，請以 [template-spec.md](template-spec.md) 為準。本手冊只保留操作導覽，避免兩處文件不同步。

目前支援：

1. `預設通用 Frontmatter`：使用 `builtin:universal-frontmatter`，輸出統一 YAML frontmatter 後接摘要；媒體與逐字稿檔案會在最後追加 `## Transcript`
2. `自訂模板`：使用 `custom:<path>` 指向 vault 內模板檔

操作方式：

1. 在 Settings Tab 的 `模板與提示` 設定預設模板，或在 Flow Modal 的 `執行前摘要` 臨時切換並記憶為下次預設。
2. 選 `自訂模板` 時，請填入 vault 內相對路徑，例如 `Templates/ai-summary-template.md`；若檔案尚未存在，可在 Settings Tab 按 `建立範本` 產生含 `{{summary}}` / `{{transcript}}` 的起始模板。
3. 自訂模板可使用 `{{title}}`、`{{book}}`、`{{author}}`、`{{creator}}`、`{{description}}`、`{{tags}}`、`{{platform}}`、`{{source}}`、`{{createdDate}}`、`{{created}}`、`{{summary}}`、`{{transcript}}` placeholder；詳細規則見 [template-spec.md](template-spec.md)。

### 預設輸入類型

控制開啟 flow modal 時預先選中的輸入類型：

1. `webpage_url`
2. `media_url`
3. `local_media`
4. `transcript_file`

### 除錯模式

啟用後會輸出更多 plugin log，包含 runtime、warning 與 error。

### 執行環境診斷

診斷區塊會檢查：

1. app surface：`desktop` 或 `mobile`
2. `media cache root` 是否可用
3. `yt-dlp` / `ffmpeg` / `ffprobe` 是否可用
4. `webpage_url` / `media_url` / `local_media` / `transcript_file` capability 是否可用

若 `media URL` 或 `local media` 無法執行，請先看這一區的結果。`transcript_file` 不需要 `yt-dlp` / `ffmpeg` / `ffprobe`，只需要可讀取逐字稿並可使用摘要 provider。

## 使用流程

### Webpage URL

1. 開啟 `AI 摘要器`
2. 選 `網頁 URL`
3. 輸入 `http` 或 `https` 網址
4. 按 `開始摘要`
5. 流程會依序經過 `Extracting webpage content -> Generating webpage summary -> Writing note into vault`

常見錯誤：

1. `validation_error`：URL 不是合法的 `http/https`
2. `runtime_unavailable`：網頁擷取階段失敗

### Media URL

1. 開啟 `AI 摘要器`
2. 選 `媒體 URL`
3. 輸入 YouTube、podcast 或直接媒體網址
4. 按 `開始摘要`
5. 流程會經過 acquisition、transcription、summary，最後寫入 note

常見錯誤：

1. `validation_error`：URL 格式錯誤
2. `runtime_unavailable`：缺少 `yt-dlp` / `ffmpeg` / `ffprobe`
3. `download_failure`：下載或轉檔失敗

### Local Media

1. 開啟 `AI 摘要器`
2. 選 `本機媒體`
3. 輸入絕對路徑，或點 `選擇檔案`
4. 按 `開始摘要`
5. 流程會經過 local ingestion、transcription、summary，最後寫入 note

常見錯誤：

1. `validation_error`：路徑不是合法絕對路徑，或格式不支援
2. `runtime_unavailable`：本機 runtime 或 media cache root 不可用

### Transcript File

1. 開啟 `AI 摘要器`
2. 選 `逐字稿檔案`
3. 輸入 `transcript.md` 或 `.txt` 的絕對路徑，或點 `選擇檔案`
4. 按 `開始摘要`
5. 流程會讀取逐字稿，跳過轉錄，直接重跑 summary 與 note 輸出

常見錯誤：

1. `validation_error`：路徑不是合法絕對路徑、檔案不是 `.md` / `.txt`，或逐字稿內容為空
2. `ai_failure`：摘要 provider 或模型不可用
3. `note_write_failure`：輸出資料夾不可寫入或筆記輸出失敗

## Smoke Test

### 快速入口

```bash
npm run smoke:desktop
npm run smoke:webpage
npm run smoke:media-url
npm run smoke:local-media
npm run smoke:mobile
```

### 建議使用方式

1. 只改 `webpage`：跑 `smoke:webpage`
2. 改 `media pipeline`：跑 `smoke:media-url` 與 `smoke:local-media`
3. 改 UI / 設定：跑 `smoke:desktop`
4. 發版前：跑 `smoke:desktop` 與 `smoke:mobile`

詳細檢查點請看 `docs/smoke-checklist.md`。

## 日常開發建議流程

### 改一般程式碼

```bash
npm run gate:local
```

### 改 UI 並要立刻在 Obsidian 驗證

```bash
npm run gate:local:vault
npm run smoke:desktop
```

### 影響 webpage 主線

```bash
npm run gate:regression:desktop
```

### 發版前

```bash
npm run gate:release
```

## Vault Build / Sync 實務規則

1. `build` 只更新 repo 內的 `main.js`
2. `build:vault` 會把 plugin 同步到預設測試 vault
3. `dev:vault` 適合一邊改一邊用 Obsidian 驗證
4. 需要即時看 UI、modal 或設定頁時，優先用 `gate:local:vault`
5. 發版前先跑 `build`，再到 Obsidian 做最後確認

## 文件導航

1. 使用手冊：`docs/Manual.md`
2. 指令總表：`docs/commands-reference.md`
3. smoke checklist：`docs/smoke-checklist.md`
4. release gate：`docs/release-gate.md`
5. 目前主線：`docs/backlog-active.md`
6. build/release/vault SOP：`docs/release-build-vault-sop.md`
