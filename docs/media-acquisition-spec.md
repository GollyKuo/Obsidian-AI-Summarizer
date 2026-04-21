# Media Acquisition Spec (TRACK-007)

最後更新：2026-04-22 00:11

## 目的

為 `TRACK-007 Media URL Acquisition` 固定「下載格式」、「存放位置」與「上傳前壓縮」規格，並確保預設不污染 vault。

## 適用範圍

1. YouTube URL
2. podcast URL / feed episode URL
3. direct media URL

## 存放根目錄策略

`media URL` 下載產物預設放在 vault 外，並允許使用者在 settings 指定自訂路徑。

- 設定欄位：`mediaCacheRoot`
- 值為「絕對路徑」時：使用該路徑作為下載根目錄
- 值為空時：使用 OS 預設 cache 目錄（plugin 專用子目錄）
  - Windows：`%LOCALAPPDATA%/ObsidianAI-Summarizer/media-cache`
  - macOS：`~/Library/Caches/obsidian-ai-summarizer/media-cache`
  - Linux：`~/.cache/obsidian-ai-summarizer/media-cache`

## Session 目錄規格

每次任務建立獨立 session 目錄，不可跨任務共用下載目錄。

```text
<media-cache-root>/<vault-id>/<session-id>/
```

- `<vault-id>`：由 vault 路徑衍生的穩定識別值（避免多 vault 衝突）
- `<session-id>` 格式：`YYYYMMDD-HHmmss-<8hex>`

範例：

- `20260421-233200-a1b2c3d4`

## 產物格式規格

### 1) downloaded media

- 檔名：`downloaded.<ext>`
- 預設：
  - YouTube 視訊來源：`downloaded.mp4`
  - podcast / audio-only：`downloaded.m4a`
  - direct media：保留可辨識副檔名，無法判斷時 fallback `downloaded.bin`

### 2) normalized audio

- 檔名：`normalized.wav`
- 格式：`WAV PCM 16-bit mono 16kHz`

### 3) transcript artifact

- 檔名：`transcript.srt`
- 格式：`UTF-8 SRT`

### 4) metadata

- 檔名：`metadata.json`
- 最低欄位：
  - `sessionId`
  - `sourceType`
  - `sourceUrl`
  - `title`
  - `creatorOrAuthor`
  - `platform`
  - `createdAt`
  - `downloadedPath`
  - `normalizedAudioPath`
  - `transcriptPath`
  - `warnings`

### 5) ai upload artifacts

- 目錄：`ai-upload/`
- 檔名：
  - 單檔模式：`ai-upload.<ext>`
  - 分段模式：`chunk-0001.<ext>`、`chunk-0002.<ext>`...
- 說明：
  - AI 預設只接收 `ai-upload` 產物，不直接上傳 `downloaded.*`
  - `metadata.json` 需記錄 `uploadArtifactPaths`

## AI 上傳前壓縮策略

### 核心原則

1. 先抽音訊，不上傳影片影像軌。
2. 優先壓縮 `ai-upload` 檔案，而不是變更 `downloaded.*` 原檔語意。
3. 在可維持轉錄品質前提下，最小化檔案大小與傳輸量。

### 預設 Profile（v1）

- profile 名稱：`balanced`（預設）
- 音訊通道：`mono`
- 採樣率：`16kHz`
- 編碼：`Opus`
- 目標位元率：`24~32 kbps VBR`
- 容器：`ogg` 或 `webm`（以 runtime 相容性優先）

### 分段與靜音處理

1. 單段長度上限：`10~15 分鐘`（預設 12 分鐘）
2. 超過上限即切 chunk，並為每段建立獨立上傳檔。
3. 可啟用 VAD 去除長靜音區間，降低無效音訊傳輸量。
4. metadata 需記錄 `chunkCount`、`chunkDurationsMs`、`vadApplied`。

### 品質保護與回退

若任一條件成立，判定為「壓縮過度風險」，需自動升級重跑：

1. 轉錄文字密度異常低於閾值（例如每分鐘字數顯著偏低）。
2. 語言偵測與使用者設定語言明顯不符。
3. runtime 回報音訊不可解碼或識別信心過低。

回退順序：

1. `Opus 24~32 kbps`（balanced）
2. `AAC 64 kbps mono 16kHz`
3. `FLAC mono 16kHz`（精度優先，體積較大）

### 成本對齊

1. 壓縮策略主要降低「上傳頻寬與音訊處理成本」。
2. 摘要 token 成本另由「chunk summary -> final summary」策略控制，不與音訊壓縮耦合。

## Retention 模式對應

- `none`
  - 完成後刪除：`downloaded.*`、`normalized.wav`、`transcript.srt`
  - 保留：筆記輸出與必要 metadata 摘要（可落在 note/frontmatter）
- `source`
  - 保留：`downloaded.*`
  - 刪除：`normalized.wav`、`transcript.srt`
- `all`
  - 保留：`downloaded.*`、`normalized.wav`、`ai-upload/`、`transcript.srt`、`metadata.json`

## 安全恢復規格

1. 恢復只允許在同一個 `<session-id>` 目錄內尋找候選檔案。
2. 禁止掃描整個 `<media-cache-root>/<vault-id>/` 後挑最大檔作為回復來源。
3. 若 session 內無合法產物，直接回報 `download_failure`，不做跨 session fallback。
4. 若 `ai-upload` 遺失但 `downloaded.*` 存在，可在同 session 內重建；不可跨 session 借檔。

## 錯誤分類對齊

1. URL 不合法：`validation_error`
2. 下載失敗：`download_failure`
3. runtime 未配置：`runtime_unavailable`
4. 使用者取消：`cancellation`

## 備註

1. 此規格先定義 v1 行為，後續若 runtime 策略改為 sidecar/remote，仍需維持同等 artifact 語意。
2. 筆記輸出路徑仍由 `outputFolder` 決定，與 `mediaCacheRoot` 分離。
