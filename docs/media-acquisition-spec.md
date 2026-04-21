# Media Acquisition Spec (TRACK-007)

最後更新：2026-04-21 23:32

## 目的

為 `TRACK-007 Media URL Acquisition` 先固定「下載格式」與「存放位置」規格，避免後續 adapter/orchestration 反覆改動。

## 適用範圍

1. YouTube URL
2. podcast URL / feed episode URL
3. direct media URL

## Session 目錄規格

每次任務建立獨立 session 目錄，不可跨任務共用下載目錄。

```text
<vault>/.obsidian/plugins/obsidian-ai-summarizer/runtime-cache/media/<session-id>/
```

`<session-id>` 格式：

- `YYYYMMDD-HHmmss-<8hex>`

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

## Retention 模式對應

- `none`
  - 完成後刪除：`downloaded.*`、`normalized.wav`、`transcript.srt`
  - 保留：筆記輸出與必要 metadata 摘要（可落在 note/frontmatter）

- `source`
  - 保留：`downloaded.*`
  - 刪除：`normalized.wav`、`transcript.srt`

- `all`
  - 保留：`downloaded.*`、`normalized.wav`、`transcript.srt`、`metadata.json`

## 安全恢復規格

1. 恢復只允許在同一個 `<session-id>` 目錄內尋找候選檔案。
2. 禁止掃描整個 `runtime-cache/media/` 後挑最大檔作為回復來源。
3. 若 session 內無合法產物，直接回報 `download_failure`，不做跨 session fallback。

## 錯誤分類對齊

1. URL 不合法：`validation_error`
2. 下載失敗：`download_failure`
3. runtime 未配置：`runtime_unavailable`
4. 使用者取消：`cancellation`

## 備註

1. 此規格先定義 v1 行為，後續若 runtime 策略改為 sidecar/remote，仍需維持同等 artifact 語意。
2. 筆記輸出路徑仍由 `outputFolder` 決定，與 session cache 路徑分離。
