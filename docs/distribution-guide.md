# Distribution Guide

最後更新：2026-05-04

## 適用範圍

本文件整理 `AI Summarizer` Obsidian plugin 要交給其他人使用時的交付方式、發布前檢查、外部工具放置方式，以及 release asset 的隱私檢查重點。

## 建議放置位置

完整教學放在本文件，README 只保留導覽連結。

理由：

1. README 適合作為專案入口，不適合放太長的 release SOP。
2. `docs/Manual.md` 偏向一般使用與本機操作。
3. `docs/release-gate.md` 偏向放行條件。
4. 本文件專門回答「如何把外掛交給別人使用」與「發布前要確認什麼」。

## 手動交付給測試者

這是目前最適合的交付方式。先讓少數使用者手動安裝，確認 API key、媒體工具、Windows/macOS 路徑與 Obsidian 行為都穩定，再考慮公開上架。

### Maintainer 端

```bash
npm ci
npm run gate:release
npm run build
npm run check:release-privacy
```

打包以下 release assets：

```text
main.js
manifest.json
styles.css
versions.json
```

`main.js` 是 build 產物，不需要把 `src/`、`node_modules/`、測試檔、文件或本機暫存資料交給使用者。

若額外提供 `Manual-slides.html`，它只作為離線教學或投影文件，不是 plugin 必要 asset。不要讓設定頁使用說明依賴或開啟這個檔案。

### 使用者端

把 release assets 放到使用者 vault 的 plugin 目錄：

```text
<vault>/.obsidian/plugins/ai-summarizer/
```

放置後，使用者在 Obsidian 啟用：

```text
Settings -> Community plugins -> Installed plugins -> AI Summarizer
```

使用者需要自行設定自己的 provider key：

1. Gemini API key
2. OpenRouter API key，若使用 OpenRouter 摘要 provider
3. Mistral API key，若使用 Mistral 摘要 provider
4. Gladia API key，若使用 Gladia 轉錄 provider

使用者只用 `webpage URL` 或 `transcript_file` 時，不需要 `yt-dlp`、`ffmpeg`、`ffprobe`。使用 `media URL` 或 `local media` 時才需要這些媒體工具。

## GitHub Release

若要用 GitHub release 分享，release tag 必須和 `manifest.json` 的 `version` 完全一致。以目前版本為例，tag 應為：

```text
0.1.75
```

Release attachments 放：

```text
main.js
manifest.json
styles.css
```

`versions.json` 建議保留在 repository root。若要讓手動安裝包更完整，也可以一起附上。

### 使用說明與 HTML 簡報

Obsidian Community Plugin 的標準安裝與更新流程只會下載 `manifest.json`、`main.js` 與 `styles.css`。因此，`Settings -> AI Summarizer` 內的 `使用說明` 分頁必須打包進 `main.js` 或由程式內建資料渲染，不應依賴、尋找或開啟獨立的 `Manual-slides.html`。

交付策略：

1. `Manual-slides.html` 可作為 GitHub release 或文件頁的 optional artifact，供使用者自行下載後離線開啟或教學投影。
2. 若 release zip 額外包含 `Manual-slides.html`，文件內容更新時必須重新產出並附上新版。
3. 官方 Community Plugin 更新不應要求使用者手動覆蓋 `Manual-slides.html`。
4. 設定頁說明只保留快速上手內容；完整簡報作為獨立文件維護。

建立 release tag 的本地指令：

```bash
git tag 0.1.75
git push origin 0.1.75
```

請把上方版本號替換成當前 `manifest.json` 的 `version`。本 repo 已加入 `.github/workflows/release-assets.yml`。當推送 `x.y.z` 格式的 tag，例如 `0.1.75`，workflow 會：

1. 跑 `npm ci`
2. 跑 `npm run check:release-metadata`
3. 跑 `npm run build`
4. 建立 GitHub release
5. 附上 `main.js`、`manifest.json`、`styles.css`

## 官方 Community Plugin 發布前檢查

正式提交 Obsidian community plugin 前，先處理以下項目：

1. `manifest.json` 的 `id` 不應包含 `obsidian`。目前已設定為 `ai-summarizer`。
2. `manifest.json` 的 `version` 必須是 SemVer `x.y.z`，例如 `0.2.0`。目前已設定為 `0.1.75`。
3. repository root 需要 `LICENSE`。
4. README 需要改成使用者導向，清楚說明用途、安裝、設定、支援來源、外部依賴與限制。
5. GitHub release tag 必須和 `manifest.json` 的 `version` 一致。
6. GitHub release 必須上傳 `main.js`、`manifest.json`，有樣式時也上傳 `styles.css`。
7. 到 `obsidianmd/obsidian-releases` 對 `community-plugins.json` 提 PR。

## yt-dlp 放置方式

目前 v1 實作不會把 `yt-dlp` 打包進 plugin。使用者可以在設定頁填入 `ytDlpPath`，若留空則程式會直接使用系統 PATH：

```text
yt-dlp --version
yt-dlp ...
```

因此 `yt-dlp` 可以放在使用者系統的 `PATH` 裡，或在 plugin settings 的 `媒體工具路徑 -> yt-dlp` 手動指定完整路徑。建議方式：

### Windows

建議放在穩定路徑，例如：

```text
C:\Tools\yt-dlp\yt-dlp.exe
```

然後把資料夾加入使用者或系統 `PATH`：

```text
C:\Tools\yt-dlp
```

啟用後，在新的 terminal 驗證，或在設定頁按 `yt-dlp` 的 `自動偵測`：

```bash
yt-dlp --version
```

### macOS / Linux

可用系統套件管理器或固定工具目錄安裝，只要新的 shell 可以找到 `yt-dlp` 即可：

```bash
yt-dlp --version
```

### 不建議的方式

不要只把 `yt-dlp.exe` 丟進 plugin release 目錄後期待自動生效。若要放在 plugin 目錄或其他固定資料夾，必須在設定頁指定 `ytDlpPath`，或把該資料夾加入 PATH。自動下載 / 更新 `yt-dlp` 仍是後續功能。

## ffmpeg / ffprobe 放置方式

`ffmpeg` 與 `ffprobe` 和 `yt-dlp` 不完全相同：

1. 使用者可以放在系統 `PATH`。
2. 使用者可以在 plugin settings 設定 `ffmpegPath` / `ffprobePath`。
3. 專案已有 Windows desktop 的 `tools/ffmpeg` installer 設計，目標路徑會在 plugin 目錄下的 `tools/ffmpeg`。

若使用者設定了 `ffmpegPath`，下載媒體時程式會把該路徑傳給 `yt-dlp --ffmpeg-location`，避免 `yt-dlp` 在 merge YouTube media 時找不到 ffmpeg。

## 打包前隱私檢查

每次交付前，至少檢查 release assets：

```text
main.js
manifest.json
styles.css
versions.json
```

檢查重點：

1. 不應包含 API keys、tokens、private keys。
2. 不應包含本機 vault path，例如 `D:\...`、`C:\Users\...`、`/Users/...`。
3. 不應包含測試資料、暫存媒體、逐字稿、摘要結果或使用者筆記內容。
4. `manifest.json` 的 `author` 是公開 metadata，不算 secret，但正式發布前要確認是否願意公開。
5. 不要把 `.env`、`node_modules/`、`tools/`、`cache`、測試 vault 或 media artifact 放進交付包。

建議交付前再跑一次：

```bash
npm run gate:release
npm run build
npm run check:release-privacy
```

`check:release-privacy` 會掃描 `main.js`、`manifest.json`、`styles.css`、`versions.json`、`package.json` 與 `package-lock.json`，阻擋常見 API key、token、private key、本機 vault path、測試 vault artifact path。若要同步到個人測試 vault，請用 `AI_SUMMARIZER_VAULT_PATH` 或 `scripts/vault-sync.mjs --vault` 傳入，不要把本機路徑寫進 package scripts。
