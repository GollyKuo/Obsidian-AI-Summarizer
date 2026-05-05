# AI Summarizer 開發者手冊

最後更新：2026-05-04

## 目錄

1. [適用範圍](#適用範圍)
2. [開發環境需求](#開發環境需求)
3. [本地建置](#本地建置)
4. [同步到 Vault](#同步到-vault)
5. [啟用與驗證 Plugin](#啟用與驗證-plugin)
6. [日常開發流程](#日常開發流程)
7. [Smoke Test](#smoke-test)
8. [Release Gate](#release-gate)
9. [發版與交付](#發版與交付)
10. [設定與 Provider 策略](#設定與-provider-策略)
11. [開發者文件導航](#開發者文件導航)

## 適用範圍

這份手冊給開發者、維護者與測試者使用，內容包含：

1. npm / Node.js 建置流程
2. 測試 vault 同步
3. smoke test
4. release gate
5. release asset 檢查
6. 開發時的 provider 與媒體工具策略

一般 Windows 使用者請看 [Manual.md](Manual.md)。那份文件不以終端機操作為主。

## 開發環境需求

1. Node.js 與 npm
2. Obsidian 桌面版
3. 測試用 Obsidian vault
4. `Gemini API Key`
5. `Mistral API Key`
6. `Gladia API Key`
7. 媒體流程測試用的 `yt-dlp`、`ffmpeg`、`ffprobe`

Provider 建議：

1. Gemini 轉錄與摘要推薦模型皆為 `gemini-2.5-flash`。
2. 媒體轉錄若遇到 Gemini 429、503、timeout 或 high demand，優先切 `Gladia` / `default`。
3. 摘要若遇到 Gemini 額度不足或高負載時改用 Mistral。
4. OpenRouter/Qwen 保留為選用 transcript-first 摘要路徑。

## 本地建置

第一次 checkout 或依賴變更後：

```bash
npm install
```

一般本地檢查：

```bash
npm run typecheck
npm run test
npm run build
```

`build` 會在 repo root 產生 `main.js`，供 Obsidian plugin 載入。

## 同步到 Vault

### 同步到預設測試 Vault

專案目前預設同步到 `package.json` 中指定的測試 vault。

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

PowerShell 環境變數：

```powershell
$env:AI_SUMMARIZER_VAULT_PATH = "D:\Your\Vault"
npm run build:vault:target
```

cmd 環境變數：

```bat
set AI_SUMMARIZER_VAULT_PATH=D:\Your\Vault
npm run build:vault:target
```

同步目標：

```text
<vault>\.obsidian\plugins\<manifest.id>\
```

同步檔案：

1. `main.js`
2. `manifest.json`
3. `styles.css`，若有提供
4. `versions.json`，若有提供

## 啟用與驗證 Plugin

1. 執行 `build:vault` 或 `build:vault:target`。
2. 重新開啟 Obsidian。
3. 到 `Settings -> Community plugins`。
4. 啟用 `AI Summarizer`。
5. 確認左側 ribbon 有 `AI 摘要器`。
6. 確認 command palette 有 `開啟 AI 摘要器`。

若看不到新 UI，先完整關閉 Obsidian 再開，避免載入舊的 `main.js`。

## 日常開發流程

### 改一般程式碼

```bash
npm run gate:local
```

### 改 UI 並立刻在 Obsidian 驗證

```bash
npm run gate:local:vault
npm run smoke:desktop
```

### 影響 webpage 主線

```bash
npm run gate:regression:desktop
```

### 影響媒體流程

至少跑：

```bash
npm run gate:local
npm run smoke:media-url
npm run smoke:local-media
```

若變更也影響 Flow Modal 或設定頁，再補：

```bash
npm run smoke:desktop
```

## Smoke Test

快速入口：

```bash
npm run smoke:desktop
npm run smoke:webpage
npm run smoke:media-url
npm run smoke:local-media
npm run smoke:mobile
```

建議使用方式：

1. 只改 `webpage`：跑 `smoke:webpage`。
2. 改 `media pipeline`：跑 `smoke:media-url` 與 `smoke:local-media`。
3. 改 UI / 設定頁：跑 `smoke:desktop`。
4. 發版前：跑 `smoke:desktop` 與 `smoke:mobile`。

詳細檢查點請看 [smoke-checklist.md](smoke-checklist.md)。

## Release Gate

發版前：

```bash
npm run gate:release
```

Release gate 會串接專案定義的本地檢查、release metadata 檢查與 smoke 入口。完整放行條件請看 [release-gate.md](release-gate.md)。

若只是 docs-only 變更，可以不跑完整 npm test，但 final / commit 訊息應明確說明沒有跑測試的原因。

## 發版與交付

### 建置 release asset

```bash
npm install
npm run gate:release
npm run build
```

交付給使用者的檔案：

```text
main.js
manifest.json
styles.css
versions.json
```

`main.js` 是 build 產物。不要把 `src/`、`node_modules/`、測試檔、文件、本機暫存資料或 API key 打包給使用者。

### 使用者安裝路徑

一般使用者會把 release asset 放到：

```text
<vault>\.obsidian\plugins\ai-summarizer\
```

使用者端安裝與更新步驟請維護在 [Manual.md](Manual.md)。開發者不要把 npm 指令放回一般使用者快速開始。

更新交付時請提醒使用者只覆蓋 release asset，不要刪掉整個 `ai-summarizer` plugin 資料夾。Obsidian 的 `loadData/saveData` 設定資料通常也在 plugin 目錄中；刪掉整個資料夾可能會移除 API key、provider、模型、輸出資料夾、媒體工具路徑與其他使用者設定。

Release asset 應只包含程式與 metadata：

1. `main.js`
2. `manifest.json`
3. `styles.css`
4. `versions.json`，若需要

不要在 release zip 中放入使用者設定資料檔，例如 `data.json` 或其他由 Obsidian `saveData` 產生的檔案。

### 使用說明與簡報資產策略

設定頁已新增 `使用說明` 分頁，但不連接或開啟 `Manual-slides.html`。Obsidian Community Plugin 的標準安裝與更新流程會從 GitHub release 下載 `manifest.json`、`main.js` 與 `styles.css`，額外 HTML 檔不應被視為自動更新資產。

建議策略：

1. 設定頁內的使用說明內容打包進 `main.js`，例如以 TypeScript 資料結構或渲染函式維護。
2. `docs/Manual-slides.html` 作為獨立文件輸出，供 GitHub、手動分享、離線教學或投影使用。
3. 設定頁不要加入開啟本機 HTML 的按鈕，不處理 HTML 檔案路徑，也不要用 iframe 把簡報嵌入 settings。
4. 若手動 release 或 GitHub release 決定附上 `Manual-slides.html`，每次文件內容更新都必須重新產出並附上新版；但一般 plugin 更新不應要求使用者手動複製它。

實作時同步檢查：

1. `src/ui/settings-tab.ts` 的 `使用說明` section 是否不依賴 `Manual-slides.html`。
2. build / vault sync 是否仍只依賴必要 plugin assets。
3. GitHub release workflow 是否維持標準三檔；若附上 `Manual-slides.html`，必須明確標為獨立 optional artifact。
4. [Manual.md](Manual.md)、[distribution-guide.md](distribution-guide.md) 與 backlog 是否同步更新。

### GitHub Release

若要用 GitHub release 分享：

1. release tag 必須和 `manifest.json` 的 `version` 一致。
2. release asset 至少附上 `main.js`、`manifest.json`、`styles.css`。
3. `versions.json` 可依交付需求一起附上。
4. 發布前檢查 release asset 不含 API key、本機 vault path、暫存媒體或使用者筆記內容。

完整交付流程請看 [distribution-guide.md](distribution-guide.md)。

## 設定與 Provider 策略

### API Key

開發與測試建議準備：

1. `Gemini API Key`
2. `Mistral API Key`
3. `Gladia API Key`
4. `OpenRouter API Key`，若測 OpenRouter/Qwen 摘要路徑

### 轉錄 Provider

內建預設仍是 Gemini，但文件與測試建議要反映目前實務策略：

1. Gemini 轉錄建議模型使用 `gemini-2.5-flash`。
2. Gemini 轉錄使用 `geminiTranscriptionStrategy`，預設 `auto`：優先 Gemini Files API 上傳抽音訊後的單一 AI-ready artifact，失敗時 fallback 到逐 chunk inline。
3. `files_api` 可用於強制測試 Gemini remote file lifecycle；`inline_chunks` 可用於回歸既有逐 chunk inline 路徑。
4. Gemini 媒體轉錄 request timeout 使用專用預設 10 分鐘；一般文字摘要仍維持較短 timeout。
5. 若遇到 Gemini 429、503、timeout 或 high demand，不建議反覆重跑 Gemini，優先切 Gladia。
6. Gemini Files API remote file lifecycle 必須與本機 retention 分開看待；本機 `delete_temp` / `keep_temp` 不代表 provider 端遠端檔案保留策略。

### 摘要 Provider

1. Gemini 是內建預設摘要路徑，建議模型使用 `gemini-2.5-flash`。
2. Mistral 是建議備援摘要路徑，內建模型為 `mistral-small-latest`。
3. OpenRouter/Qwen 是選用 transcript-first 摘要路徑。

### 媒體工具

設定頁 `診斷` 分頁提供：

1. `ffmpeg` / `ffprobe` 的 `自動填入`，會在 plugin 資料夾的 `tools/ffmpeg` 中檢查、下載或更新工具。
2. `yt-dlp` 的 `自動偵測`，只會找 PATH，不會自動下載。
3. `重新檢查`，用來確認 media cache root 與 capability。

若修改媒體工具安裝或診斷 UX，請同步更新 [Manual.md](Manual.md) 的一般 Windows 使用者流程。

## 開發者文件導航

1. 一般 Windows 使用者手冊：[docs/Manual.md](Manual.md)
2. 開發者手冊：[docs/Manual-Developer.md](Manual-Developer.md)
3. 指令總表：[docs/commands-reference.md](commands-reference.md)
4. smoke checklist：[docs/smoke-checklist.md](smoke-checklist.md)
5. release gate：[docs/release-gate.md](release-gate.md)
6. 發布與交付指南：[docs/distribution-guide.md](distribution-guide.md)
7. build/release/vault SOP：[docs/release-build-vault-sop.md](release-build-vault-sop.md)
8. architecture boundary：[docs/architecture-boundary.md](architecture-boundary.md)
9. template spec：[docs/template-spec.md](template-spec.md)
