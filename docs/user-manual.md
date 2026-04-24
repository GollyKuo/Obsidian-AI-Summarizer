# User Manual

最後更新：2026-04-24 09:08

## 適用範圍

本手冊說明 `AI Summarizer` Obsidian plugin 目前可用的：

1. 安裝與建置
2. 設定頁欄位
3. 三種輸入流程
4. smoke test
5. vault build / sync 開發流程

若你要看工程側放行條件，改讀 `docs/commands-reference.md`、`docs/release-gate.md`。

## 目前支援的輸入

1. `webpage URL`
2. `media URL`
3. `local media`

## 需求

### 基本需求

1. Obsidian 桌面版
2. Node.js 與 npm
3. Gemini API key

### 媒體流程額外需求

若要使用 `media URL` 或 `local media`，建議在桌面環境準備：

1. `yt-dlp`
2. `ffmpeg`
3. `ffprobe`

若缺少這些依賴，設定頁的「執行環境診斷」會顯示 `warning` 或 `error`。

## 安裝與建置

### 本地建置

```bash
npm install
npm run typecheck
npm run test
npm run build
```

這會在 repo 根目錄產生 `main.js`，但不會自動同步到 Obsidian vault。

### 直接同步到測試 Vault

目前 `package.json` 內建的測試 vault 路徑是：

```text
D:\程式開發\Obsidian Test
```

可用指令：

```bash
npm run dev:vault
npm run build:vault
npm run gate:local:vault
```

說明：

1. `dev:vault`: watch build，檔案變更後自動同步到測試 vault
2. `build:vault`: production build 後同步到測試 vault
3. `gate:local:vault`: `typecheck + test + build:vault`

### 同步到自訂 Vault

若不是使用內建測試 vault，直接執行：

```bash
npm run build:vault:target -- --vault "D:\Your\Vault"
npm run dev:vault:target -- --vault "D:\Your\Vault"
```

也可使用環境變數：

```bash
set AI_SUMMARIZER_VAULT_PATH=D:\Your\Vault
npm run build:vault:target
```

同步目標會是：

```text
<vault>\.obsidian\plugins\<manifest.id>\
```

會同步的檔案：

1. `main.js`
2. `manifest.json`
3. `styles.css`（若存在）
4. `versions.json`（若存在）

## 啟用 Plugin

1. 先完成一次 `build:vault` 或自訂 vault sync
2. 打開 Obsidian
3. 到 `Settings -> Community plugins`
4. 啟用 `AI Summarizer`

啟用後可從兩個入口打開：

1. 左側 ribbon 的 `AI 摘要器`
2. command palette 的 `開啟 AI 摘要器`

## 設定頁

### Gemini API 金鑰

填入目前摘要流程使用的 API key。

### 模型

預設為 `gemini-2.5-flash`。若你要切換模型，直接在設定頁修改。

### 輸出資料夾

控制最後寫回 vault 的 note 位置。留空時寫到 vault 根目錄。

### 媒體暫存資料夾

用於 `media URL` / `local media` 的中介產物，建議設在 vault 外的絕對路徑。

### 產物保留模式

1. `none`: 不保留中介產物
2. `source`: 保留來源與 metadata
3. `all`: 保留所有產物

### 媒體壓縮策略

1. `balanced`: 預設推薦，優先平衡體積與品質
2. `quality`: 盡量保留較高品質

### 輸出模板

目前 v1 支援三種模式：

1. 預設 frontmatter
2. 內建模板
3. 自訂模板路徑

內建模板：

1. `builtin:default`
2. `builtin:webpage-brief`
3. `builtin:media-session`

若自訂模板找不到，會退回預設 frontmatter。

### 預設輸入類型

控制每次打開 modal 時預設落在哪一種輸入：

1. `webpage_url`
2. `media_url`
3. `local_media`

### 除錯模式

開啟後會增加 plugin log，方便對照 runtime / warning / error。

### 執行環境診斷

這一區用來確認：

1. app surface 是 `desktop` 或 `mobile`
2. `media cache root` 是否有效
3. `yt-dlp` / `ffmpeg` / `ffprobe` 是否就緒
4. `webpage_url` / `media_url` / `local_media` capability 是否可用

若 `media URL` 或 `local media` 不能用，先看這裡，不要直接猜是哪個依賴壞掉。

## 使用流程

### Webpage URL

1. 打開 `AI 摘要器`
2. 選 `網頁 URL`
3. 貼上 `http` 或 `https` 網址
4. 按 `開始摘要`
5. 等待 `Extracting webpage content -> Generating webpage summary -> Writing note into vault`

常見問題：

1. `validation_error`: URL 不是合法的 `http/https`
2. `runtime_unavailable`: 網頁阻擋擷取或內容不可讀

### Media URL

1. 打開 `AI 摘要器`
2. 選 `媒體 URL`
3. 貼上 YouTube / podcast / 直接媒體網址
4. 按 `開始摘要`
5. 等待下載、壓縮、摘要與 note 輸出

常見問題：

1. `validation_error`: URL 不是合法來源
2. `runtime_unavailable`: 缺 `yt-dlp` / `ffmpeg` / `ffprobe`
3. `download_failure`: 來源失效、受限制或上游拒絕

### Local Media

1. 打開 `AI 摘要器`
2. 選 `本機媒體`
3. 直接輸入絕對路徑，或在桌面版按 `選擇檔案`
4. 按 `開始摘要`
5. 等待 local ingestion、壓縮、摘要與 note 輸出

常見問題：

1. `validation_error`: 路徑不是絕對路徑、檔案不存在、格式不支援、超出大小限制
2. `runtime_unavailable`: 本機 runtime 或 media cache root 未就緒

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

1. 只改 `webpage`：至少跑 `smoke:webpage`
2. 改 `media pipeline`：跑 `smoke:media-url` 與 `smoke:local-media`
3. 改 UI / 設定：跑 `smoke:desktop`
4. 發版前：跑 `smoke:desktop` 與 `smoke:mobile`

完整人工檢查內容請看 `docs/smoke-checklist.md`。

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

1. `build` 只產出 repo 內的 `main.js`
2. `build:vault` 才會把 plugin 檔案同步到指定測試 vault
3. `dev:vault` 適合邊改邊在 Obsidian 重載 plugin
4. 變更 UI、設定頁或 modal 時，優先用 `gate:local:vault`
5. 不要假設一般 `build` 之後 Obsidian 內會自動更新

## 文件導航

1. 使用者操作：`docs/user-manual.md`
2. 指令總表：`docs/commands-reference.md`
3. smoke 檢查：`docs/smoke-checklist.md`
4. release 放行：`docs/release-gate.md`
5. 目前主線進度：`docs/backlog-active.md`
6. build/release/vault SOP：`docs/release-build-vault-sop.md`
