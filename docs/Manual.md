# Manual

最後更新：2026-04-24 16:24

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

## 設定頁

### Gemini API 金鑰

Gemini 目前同時用於：

1. 媒體轉錄 provider
2. 預設摘要 provider

只要你還使用 Gemini 做轉錄或摘要，就需要填這個 key。

### 轉錄 Provider / 轉錄模型

設定頁已拆成：

1. `transcriptionProvider`
2. `transcriptionModel`

v1 轉錄 provider 先固定為 `Gemini`。

預設建議：

1. Provider：`Gemini`
2. Model：`gemini-2.5-flash`

原因：

1. 轉錄屬於 audio/video ingestion，優先選穩定的 audio-capable 模型。
2. 摘要與轉錄已拆分，不需要讓摘要模型直接處理音訊。

### 摘要 Provider / 摘要模型

設定頁已拆成：

1. `summaryProvider`
2. `summaryModel`

預設建議：

1. Provider：`Gemini`
2. Model：`gemini-3.1-flash-lite-preview`

Gemini 摘要模型目前可選：

1. `gemini-3.1-flash-lite-preview`
2. `gemini-3-flash-preview`
3. `gemini-2.5-flash`
4. `gemini-2.5-flash-lite`

使用建議：

1. `gemini-3.1-flash-lite-preview`：預設 fast/free，適合日常摘要與高頻率使用。
2. `gemini-3-flash-preview`：偏 quality，適合較長內容、技術演講、需要更完整結構時。
3. `gemini-2.5-flash`：穩定 fallback。
4. `gemini-2.5-flash-lite`：低延遲測試或較輕量場景。

### OpenRouter API Key

當 `summaryProvider = openrouter` 時，設定頁會額外顯示 `OpenRouter API Key`。

第一版支援的 OpenRouter 摘要模型：

1. `qwen/qwen3.6-plus`

限制：

1. OpenRouter/Qwen 目前只作為 transcript-first 的文字摘要路徑。
2. 它不是 audio transcription 主路徑，不負責直接吃音訊或影片。
3. 若沒有切到 `summaryProvider = openrouter`，可以先不填 OpenRouter key。

### 為什麼拆成轉錄模型與摘要模型

完整路由圖請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。簡化規則如下：

拆分後的好處：

1. 音訊轉錄與文字摘要的責任邊界更清楚。
2. 可以用 Gemini 做轉錄，再用 Gemini 或 OpenRouter/Qwen 做摘要。
3. 後續可朝「保留 transcript、只重跑摘要」的 retry 策略前進。

成本與品質取捨：

1. 單一 provider 最簡單，設定成本最低。
2. `Gemini -> Gemini` 是目前預設主線。
3. `Gemini -> OpenRouter/Qwen` 適合已有逐字稿、只想換摘要模型的情境。

### 輸出資料夾

控制摘要筆記寫入 vault 的相對資料夾；空值表示寫到 vault 根目錄。

### 媒體暫存資料夾

提供 `media URL` / `local media` 流程的暫存路徑，建議使用 vault 外的絕對路徑。

### 產物保留模式

1. `none`：流程完成後刪除暫存產物
2. `source`：保留來源檔與 metadata
3. `all`：保留全部暫存產物

### 媒體壓縮策略

1. `balanced`：預設，優先壓低上傳量
2. `quality`：保留較高音質

### 輸出模板

v1 目前支援：

1. 預設 frontmatter
2. 內建模板
3. 自訂模板路徑

內建模板：

1. `builtin:default`
2. `builtin:webpage-brief`
3. `builtin:media-session`

自訂模板請填入 vault 內相對路徑。

### 預設輸入類型

控制開啟 flow modal 時預先選中的輸入類型：

1. `webpage_url`
2. `media_url`
3. `local_media`

### 除錯模式

啟用後會輸出更多 plugin log，包含 runtime、warning 與 error。

### 執行環境診斷

診斷區塊會檢查：

1. app surface：`desktop` 或 `mobile`
2. `media cache root` 是否可用
3. `yt-dlp` / `ffmpeg` / `ffprobe` 是否可用
4. `webpage_url` / `media_url` / `local_media` capability 是否可用

若 `media URL` 或 `local media` 無法執行，請先看這一區的結果。

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
