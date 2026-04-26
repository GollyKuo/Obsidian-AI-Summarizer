# Media Acquisition Spec (TRACK-007)

最後更新：2026-04-23 20:38

## 目的

為 `TRACK-007 Media URL Acquisition` 固定「下載格式」、「存放位置」與「上傳前壓縮」規格，並確保預設不污染 vault。

## 適用範圍

1. YouTube URL
2. podcast URL / feed episode URL
3. direct media URL

本文件只定義 media acquisition / AI-ready artifact；端到端 AI 模型路由與 Obsidian 寫入流程請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。

## Local Media v1 支援範圍

本機媒體流程在 v1 採「先安全匯入到 session，再共用 AI-ready 壓縮主線」。

1. 支援容器/副檔名：
   - audio：`.mp3`、`.wav`、`.m4a`、`.aac`、`.flac`、`.ogg`、`.opus`
   - video：`.mp4`、`.mov`、`.mkv`、`.webm`、`.m4v`
2. 檔案大小上限：`2 GiB`（`2147483648` bytes）
3. source path 必須是「可存取的絕對檔案路徑」，不接受資料夾或相對路徑。
4. ingest 成功後，會在當前 session 複製為 `downloaded.<ext>`，後續流程與 media URL 共用 `normalized.wav -> ai-upload.*`。

### Local Media v1 錯誤分類

1. 路徑為空、非絕對路徑、格式不支援、檔案不存在/不可存取/超過大小上限：`validation_error`
2. 複製檔案或 metadata 落盤失敗：`download_failure`
3. 取消流程：`cancellation`
4. 缺少 `yt-dlp` / `ffmpeg` / `ffprobe`：`runtime_unavailable`

## 存放根目錄策略

`media URL` 下載產物預設放在 vault 外，並允許使用者在 settings 指定自訂路徑。

- 設定欄位：`mediaCacheRoot`
- 值為「絕對路徑」時：使用該路徑作為下載根目錄
- 值為空時：使用 OS 預設 cache 目錄（plugin 專用子目錄）
  - Windows：`%LOCALAPPDATA%/ObsidianAI-Summarizer/media-cache`
  - macOS：`~/Library/Caches/obsidian-ai-summarizer/media-cache`
  - Linux：`~/.cache/obsidian-ai-summarizer/media-cache`

## 外部依賴 Readiness（v1 必要）

`local_bridge` 策略在任務開始前必須先做外部依賴檢查：

1. `yt-dlp` 可執行，且 `--version` 有回傳內容。
2. `ffmpeg` 可執行，且 `-version` 有回傳內容。
3. `ffprobe` 可執行，且 `-version` 有回傳內容。
4. 檢查結果需寫入 runtime diagnostics（供 UI 與 log 顯示）。

錯誤映射：

1. 缺依賴或不可執行：`runtime_unavailable`
2. 權限不足或程序啟動失敗：`runtime_unavailable`
3. 下載或轉檔流程內部失敗：`download_failure`

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

### 品質守門量化門檻（v1）

1. 單一 chunk 若音訊時長大於 30 秒且 transcript 為空，必須觸發回退。
2. 全任務 transcript 內容密度低於 40 字/分鐘，必須觸發回退。
3. 若觸發回退，最多允許連續升級重跑 2 次（最終到 `FLAC`）。
4. 回退後仍不達門檻，回報 `download_failure` 並附 diagnostics。

### 成本對齊

1. 壓縮策略主要降低「上傳頻寬與音訊處理成本」。
2. 摘要 token 成本另由「chunk summary -> final summary」策略控制，不與音訊壓縮耦合。
3. `balanced` profile 的目標是相較 `normalized.wav` 降低至少 70% 上傳量（以樣本驗證）。

## 媒體暫存檔模式對應

- `delete_temp`
  - 成功完成 (`completed`)：刪除 `downloaded.*`、`normalized.wav`、`transcript.srt`、`ai-upload/`、`metadata.json`
  - 失敗或取消 (`failed` / `cancelled`)：為了 recovery 保留 `downloaded.*`、`metadata.json`；刪除其餘中間產物
- `keep_temp`
  - 成功完成 (`completed`)：保留 `downloaded.*`、`normalized.wav`、`transcript.srt`；刪除 `ai-upload/`、`metadata.json`
  - 失敗或取消 (`failed` / `cancelled`)：保留 `downloaded.*`、`normalized.wav`、`transcript.srt`、`metadata.json`；刪除 `ai-upload/`

## Cleanup/Recovery 責任分界（v1）

1. cleanup 決策由 orchestration 依 `retentionMode + lifecycleStatus` 統一執行，不由單一 adapter 各自判斷。
2. `process-media-url` / `process-local-media` 皆在流程結束（成功或丟錯）後觸發 retention cleanup。
3. `completed` 依 retention mode 套用最終保留矩陣。
4. `failed` / `cancelled` 優先保留 recovery 所需最小集合（至少 source + metadata；`keep_temp` 另保留轉檔音訊與逐字稿）。

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
