# AI Summarizer 使用手冊（Windows）

最後更新：2026-05-04

## 目錄

1. [這份文件給誰看](#這份文件給誰看)
2. [你需要準備的東西](#你需要準備的東西)
3. [安裝 Plugin](#安裝-plugin)
4. [更新 Plugin](#更新-plugin)
5. [第一次設定](#第一次設定)
6. [開始前檢查媒體工具](#開始前檢查媒體工具)
7. [支援的輸入類型](#支援的輸入類型)
8. [使用流程](#使用流程)
9. [設定頁說明](#設定頁說明)
10. [按鈕功能索引](#按鈕功能索引)
11. [常見問題](#常見問題)
12. [文件導航](#文件導航)

## 這份文件給誰看

這份手冊給一般 Windows 使用者，不假設你熟悉程式開發、Node.js、npm 或終端機。

你只需要會做這些事：

1. 下載並解壓縮 zip 檔。
2. 用 Windows 檔案總管複製檔案。
3. 在 Obsidian 裡開啟設定頁。
4. 貼上 API key。

如果你是開發者，要從原始碼建置、跑測試、同步測試 vault 或發版，請看 [Manual-Developer.md](Manual-Developer.md)。

## 你需要準備的東西

### 必要項目

1. Windows 版 Obsidian 桌面程式。
2. 一個 Obsidian vault。
3. `AI Summarizer` 的 release zip 或已建置好的 plugin 檔案。
4. `Gemini API Key`。
5. `Mistral API Key`。
6. `Gladia API Key`。

建議一開始就準備 Gemini、Mistral 與 Gladia 三組 API key。Gemini API 常會遇到配額或高負載問題；Gladia 建議優先用於媒體轉錄，Mistral 可作為摘要備援。

### Release 檔案

安裝包裡至少應該有：

1. `main.js`
2. `manifest.json`
3. `styles.css`

如果安裝包也提供 `versions.json`，可以一起放進 plugin 資料夾。

如果安裝包另外提供 `Manual-slides.html`，它是方便離線閱讀或投影的新手簡報，不是 Obsidian Community Plugin 自動更新的必要檔案。一般使用者能正常使用外掛時，不需要另外複製這個檔案。

### 媒體流程額外需求

如果只使用 `網頁 URL` 或 `逐字稿檔案`，通常不需要額外媒體工具。

如果要使用 `媒體 URL` 或 `本機媒體`，還需要：

1. `ffmpeg`
2. `ffprobe`
3. `yt-dlp`
4. 一個放在 vault 外面的媒體暫存資料夾

`ffmpeg` / `ffprobe` 可在 plugin 設定頁自動下載或更新。`yt-dlp` 目前不會自動下載，需要你先自行安裝，或指定已存在的 `yt-dlp.exe`。

## 安裝 Plugin

### 1. 解壓縮安裝包

1. 下載 `AI Summarizer` 的 release zip。
2. 在 Windows 檔案總管中右鍵 zip 檔。
3. 選 `全部解壓縮`。
4. 確認解壓後可以看到 `main.js`、`manifest.json`、`styles.css`。

### 2. 找到你的 Obsidian vault

Vault 是放你筆記的資料夾。你可以用其中一種方式找到它：

1. 如果你知道筆記資料夾在哪裡，直接用 Windows 檔案總管開啟。
2. 在 Obsidian 裡右鍵任一筆記，選擇在系統檔案總管中顯示，然後回到 vault 根資料夾。

Vault 根資料夾裡通常會有一個 `.obsidian` 資料夾。

如果看不到 `.obsidian`：

1. 在 Windows 檔案總管上方選 `檢視`。
2. 開啟 `顯示 -> 隱藏的項目`。

### 3. 建立 plugin 資料夾

在你的 vault 裡建立這個資料夾：

```text
<你的 vault>\.obsidian\plugins\ai-summarizer\
```

如果 `.obsidian\plugins` 不存在，請手動建立。

### 4. 複製檔案

把解壓後的檔案複製到：

```text
<你的 vault>\.obsidian\plugins\ai-summarizer\
```

至少要放入：

1. `main.js`
2. `manifest.json`
3. `styles.css`

### 5. 在 Obsidian 啟用

1. 關閉並重新開啟 Obsidian。
2. 打開 `Settings`。
3. 進入 `Community plugins`。
4. 如果 Obsidian 要求關閉 Restricted mode，請先依畫面提示允許 Community plugins。
5. 在 Installed plugins 找到 `AI Summarizer`。
6. 啟用 `AI Summarizer`。

啟用後，你可以從左側 ribbon 的 `AI 摘要器` 或 command palette 的 `開啟 AI 摘要器` 開啟。

## 更新 Plugin

一般 Windows 使用者更新時不需要使用終端機。

API key 與使用者設定不在 `main.js`、`manifest.json`、`styles.css` 裡。正常更新時只覆蓋這些 plugin 程式檔，不會清掉 API key。

不要先刪掉整個 `ai-summarizer` 資料夾再重裝。Obsidian 的 plugin 設定檔通常也放在同一個 plugin 資料夾中；如果整個資料夾被刪除，原本的 API key、provider、模型、輸出資料夾與工具路徑設定可能會一起消失。

### 使用 release zip 更新

1. 關閉 Obsidian。
2. 下載新版 `AI Summarizer` release zip。
3. 解壓縮 zip。
4. 打開你的 vault plugin 資料夾：

```text
<你的 vault>\.obsidian\plugins\ai-summarizer\
```

5. 只用新版 `main.js`、`manifest.json`、`styles.css` 覆蓋同名舊檔案。
6. 如果新版有提供 `versions.json`，也一起覆蓋。
7. 不要刪除其他檔案，特別是設定資料檔。
8. 重新開啟 Obsidian。
9. 到 `Settings -> Community plugins` 確認 `AI Summarizer` 仍然啟用。
10. 到 `Settings -> AI Summarizer -> AI 模型` 確認 API key 還在。
11. 到 `Settings -> AI Summarizer -> 診斷` 按 `重新檢查`。

更新通常不會清掉 API key。如果更新後設定看起來不對，請先完整關閉 Obsidian 後再開一次。

`Settings -> AI Summarizer` 內的 `使用說明` 分頁會跟著 plugin 程式一起更新，不需要你額外更新 `Manual-slides.html`。

如果你是手動下載離線簡報 `Manual-slides.html` 來教學或投影，想看到新版教學內容時，請另外下載新版簡報檔。這個 HTML 檔只作為額外文件，不會保存 API key，也不應取代 plugin 更新步驟。

### 更新後建議檢查

1. 打開 `AI 摘要器`。
2. 跑一次 `網頁 URL` 測試。
3. 如果你使用媒體功能，到 `診斷` 分頁確認 `ffmpeg`、`ffprobe`、`yt-dlp` 都可用。
4. 如果模型 autocomplete 沒有候選，到 `AI 模型` 分頁按 `更新`。

## 第一次設定

### 1. 填 API key

1. 打開 Obsidian `Settings`。
2. 進入 `AI Summarizer`。
3. 到 `AI 模型` 分頁。
4. 填入 `Gemini API Key`。
5. 將摘要 Provider 切到 `Mistral` 時，填入 `Mistral API Key`。
6. 將轉錄 Provider 切到 `Gladia` 時，填入 `Gladia API Key`。
7. 分別按 API key 旁的 `測試`，確認 key 可用。

建議日常媒體設定：

1. 轉錄 Provider：`Gladia`
2. 轉錄 Model：`default`
3. 摘要 Provider：`Gemini` 或 `Mistral`
4. Mistral 摘要 Model：先用 `mistral-small-latest`

### 2. 設定輸出位置

1. 到 `輸出與媒體` 分頁。
2. `輸出資料夾` 可留空，表示摘要筆記寫到 vault 根目錄。
3. 也可以按 `搜尋資料夾`，選擇想放摘要筆記的資料夾。

### 3. 設定媒體暫存資料夾

如果你要處理 YouTube、podcast 或本機影片音訊：

1. 到 `輸出與媒體` 分頁。
2. 找到 `媒體暫存資料夾`。
3. 按 `選擇資料夾`。
4. 選一個 vault 外面的資料夾，例如：

```text
D:\AI-Summarizer\media-cache
```

不要把媒體暫存資料夾放在 vault 裡，避免大量暫存檔進入筆記同步。

## 開始前檢查媒體工具

在第一次使用 `媒體 URL` 或 `本機媒體` 前，請先做這一段。

1. 打開 `Settings -> AI Summarizer -> 診斷`。
2. 找到 `媒體工具路徑`。
3. 在 `ffmpeg` 或 `ffprobe` 列按 `自動填入`。
4. 等待外掛下載或更新 `ffmpeg` / `ffprobe`。
5. 在 `yt-dlp` 列按 `自動偵測`。
6. 如果找不到 `yt-dlp`，請先自行安裝 `yt-dlp`，再用 `選擇檔案` 指到 `yt-dlp.exe`。
7. 按 `媒體功能檢查` 的 `重新檢查`。
8. 確認 `media_url` 與 `local_media` 顯示可用後，再開始媒體摘要。

注意：

1. `ffmpeg` / `ffprobe` 自動下載主要支援 Windows 桌面版。
2. `yt-dlp` 目前不會自動下載。
3. 如果 `media cache root` 顯示不可用，請重新設定媒體暫存資料夾。

## 支援的輸入類型

| 輸入類型 | 適合情境 | 是否需要媒體工具 |
| --- | --- | --- |
| `網頁 URL` | 網頁文章、文件頁、部落格文章 | 不需要 |
| `媒體 URL` | YouTube、podcast、直接音訊或影片網址 | 需要 |
| `本機媒體` | 本機音訊或影片檔 | 需要 |
| `逐字稿檔案` | 已有 `transcript.md` 或 `.txt`，只想重跑摘要 | 不需要 |

## 使用流程

### 網頁 URL

1. 開啟 `AI 摘要器`。
2. 選 `網頁 URL`。
3. 輸入 `http` 或 `https` 網址。
4. 按 `開始摘要`。
5. 完成後按 `開啟筆記` 檢查結果。

### 媒體 URL

1. 到設定頁確認轉錄 Provider 已切到 `Gladia`。
2. 到 `診斷` 分頁確認媒體工具可用。
3. 開啟 `AI 摘要器`。
4. 選 `媒體 URL`。
5. 輸入 YouTube、podcast 或直接媒體網址。
6. 按 `開始摘要`。
7. 完成後按 `開啟筆記`。

### 本機媒體

1. 到設定頁確認轉錄 Provider 已切到 `Gladia`。
2. 到 `診斷` 分頁確認媒體工具可用。
3. 開啟 `AI 摘要器`。
4. 選 `本機媒體`。
5. 輸入檔案絕對路徑，或按 `選擇檔案`。
6. 按 `開始摘要`。

### 逐字稿檔案

1. 開啟 `AI 摘要器`。
2. 選 `逐字稿檔案`。
3. 輸入 `.md` 或 `.txt` 逐字稿路徑，或按 `選擇檔案`。
4. 按 `開始摘要`。

這個流程會跳過轉錄，直接用目前摘要 Provider 產生筆記。適合在媒體轉錄已完成、摘要失敗、想手動修正逐字稿，或想改用 Mistral 重新摘要時使用。

## 設定頁說明

### AI 模型

這裡設定轉錄與摘要使用的服務。

建議：

1. 媒體轉錄優先用 `Gladia` / `default`。
2. 一般摘要可用 Gemini。
3. Gemini 額度不足時，摘要可改用 Mistral。
4. OpenRouter 是選用，只有切到 OpenRouter 摘要時才需要填 key。

`模型清單更新` 的 `更新` 會重新抓取 Gemini、OpenRouter、Mistral 的官方模型清單，供 autocomplete 使用。

### 輸出與媒體

1. `輸出資料夾`：摘要筆記寫入 vault 的相對資料夾；空值表示 vault 根目錄。
2. `媒體暫存檔保留`：控制媒體處理完成後保留哪些暫存檔。
3. `媒體暫存資料夾`：媒體流程暫存目錄，請放在 vault 外。
4. `媒體壓縮策略`：`balanced` 優先壓低上傳量，`quality` 保留較高音質。
5. `預設輸入類型`：開啟 `AI 摘要器` 時預先選中的來源。

### 筆記模板

1. `預設通用 Frontmatter`：使用內建格式輸出摘要筆記。
2. `自訂模板`：使用 vault 裡的模板檔。

自訂模板可使用 `{{title}}`、`{{source}}`、`{{summary}}`、`{{transcript}}` 等 placeholder。完整規格請看 [template-spec.md](template-spec.md)。

### 診斷

診斷分頁會檢查：

1. Obsidian 目前環境。
2. 媒體暫存資料夾是否可用。
3. `yt-dlp`、`ffmpeg`、`ffprobe` 是否可用。
4. `網頁 URL`、`媒體 URL`、`本機媒體`、`逐字稿檔案` 是否可執行。

媒體流程失敗時，請先看這一頁。

### 使用說明與 HTML 簡報

設定頁的 `使用說明` 分頁是新手入口，會帶你完成第一次安裝、API key 設定、媒體工具檢查與四種輸入流程。

使用說明分頁的內容應以外掛內建內容為準，並隨 `main.js` 一起更新。獨立的 `Manual-slides.html` 適合拿來離線瀏覽、課堂投影或分享給尚未安裝外掛的人，但它不應是設定頁能否顯示說明的必要條件。

簡單判斷：

1. 在 Obsidian 設定頁看說明：更新 plugin 即可。
2. 用瀏覽器開 `Manual-slides.html`：需要拿到新版 HTML 才會看到新版簡報。
3. 查完整細節：仍以本手冊與 [Manual-Developer.md](Manual-Developer.md) 為準。

## 按鈕功能索引

### AI 摘要器視窗

| 按鈕 | 功能 |
| --- | --- |
| `網頁 URL` / `媒體 URL` / `本機媒體` / `逐字稿檔案` | 切換輸入來源 |
| `填入範例` | 填入目前來源類型的範例 |
| `選擇檔案` | 選擇本機媒體或逐字稿檔案 |
| `媒體工具：...` | 檢查媒體工具狀態 |
| `診斷` | 前往設定頁的診斷分頁 |
| `選擇` | 選擇本次輸出的 vault 資料夾 |
| `開始摘要` | 開始產生摘要 |
| `取消` | 取消正在執行的流程 |

### 成功、失敗與取消畫面

| 按鈕 | 功能 |
| --- | --- |
| `開啟筆記` | 開啟剛建立的摘要筆記 |
| `複製路徑` | 複製摘要筆記路徑 |
| `再摘要一次` | 用目前設定重新執行 |
| `重試` | 失敗後重新執行 |
| `前往診斷` | 開啟診斷分頁 |
| `改用逐字稿檔案` | 使用已保留的逐字稿重跑摘要 |
| `關閉` | 關閉視窗 |

### 設定頁

| 按鈕 | 功能 |
| --- | --- |
| `測試` | 測試目前 API key、provider 與模型是否可用 |
| `新增` | 新增模型 ID 到目前模型清單 |
| `刪除目前模型` | 刪除目前選中的模型 |
| `更新` | 更新官方模型清單 |
| `搜尋資料夾` | 選擇摘要輸出資料夾 |
| `選擇資料夾` | 選擇媒體暫存資料夾 |
| `選資料夾與模板` | 選擇自訂模板檔 |
| `建立範本` | 建立起始模板檔 |
| `選擇檔案` | 指定 `yt-dlp` / `ffmpeg` / `ffprobe` 執行檔 |
| `自動偵測` | 從 PATH 尋找 `yt-dlp` |
| `自動填入` | 下載或更新 `ffmpeg` / `ffprobe` |
| `取消下載` | 取消正在下載的 `ffmpeg` / `ffprobe` |
| `重新檢查` | 重新執行媒體功能診斷 |

## 常見問題

### 我看不到 `.obsidian` 資料夾

請在 Windows 檔案總管開啟 `檢視 -> 顯示 -> 隱藏的項目`。

### Obsidian 裡找不到 AI Summarizer

請檢查：

1. 檔案是否放在 `<vault>\.obsidian\plugins\ai-summarizer\`。
2. `manifest.json` 是否在這個資料夾裡。
3. Obsidian 是否已重新啟動。
4. `Settings -> Community plugins` 是否允許 Community plugins。

### Gemini 常常失敗或額度不足

媒體轉錄建議改用 Gladia。摘要可以保留 Gemini，或改用 Mistral。

### 媒體 URL 或本機媒體不能用

先到 `Settings -> AI Summarizer -> 診斷`：

1. 按 `重新檢查`。
2. 確認 `ffmpeg`、`ffprobe`、`yt-dlp` 可用。
3. 確認媒體暫存資料夾可用。
4. 確認轉錄 Provider 已切到 `Gladia`。

### 摘要失敗，但已經有逐字稿

選 `逐字稿檔案`，指定 `transcript.md`，再按 `開始摘要`。這樣會跳過轉錄，只重跑摘要與筆記輸出。

### 常見錯誤代碼

| 錯誤 | 意思 | 處理方式 |
| --- | --- | --- |
| `validation_error` | 輸入格式不合法 | 檢查 URL、檔案路徑或副檔名 |
| `runtime_unavailable` | 目前環境或工具不可用 | 到診斷分頁重新檢查 |
| `download_failure` | 媒體下載或轉檔失敗 | 檢查網址、`yt-dlp` 與 `ffmpeg` |
| `ai_failure` | API key、provider、模型或額度問題 | 測試 API key，或換 provider / 模型 |
| `note_write_failure` | 筆記寫入失敗 | 檢查輸出資料夾是否存在且可寫入 |

## 文件導航

1. 一般 Windows 使用者手冊：[docs/Manual.md](Manual.md)
2. 開發者手冊：[docs/Manual-Developer.md](Manual-Developer.md)
3. 發布與交付指南：[docs/distribution-guide.md](distribution-guide.md)
4. 模板規格：[docs/template-spec.md](template-spec.md)
5. 架構邊界：[docs/architecture-boundary.md](architecture-boundary.md)
