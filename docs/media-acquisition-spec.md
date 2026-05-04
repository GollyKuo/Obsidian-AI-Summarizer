# Media Acquisition Spec (TRACK-007)

最後更新：2026-05-02 02:44

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
4. ingest 成功後，會在當前 session 複製為安全化後的原始檔名，例如 `interview 01.mp3`；後續流程與 media URL 共用 `normalized.wav -> ai-upload.*`。

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

### 1) source media artifact

- 檔名：保留可辨識的原始/安全化名稱，不再固定為 `downloaded.<ext>`。
- 預設：
  - media URL：使用 `yt-dlp` 解析出的 title-based 安全檔名，例如 `<title>.<ext>`。
  - local media：使用本機來源檔的原始檔名，並將路徑不安全字元替換為安全字元。
  - 下載工具或來源無法提供可辨識名稱時，才 fallback 到 adapter 既有推斷名稱。
- 說明：
  - 程式欄位仍保留 `downloadedPath` 以相容既有流程，但語意已收斂為 session 內的 `sourceArtifactPath`。
  - 後續轉檔、壓縮、分段都必須從這份 source artifact 衍生，不可覆寫 source artifact 本身。

### 2) normalized audio

- 檔名：`normalized.wav`
- 格式：`WAV PCM 16-bit mono 16kHz`

### 3) transcript / subtitle artifacts

- 完成版逐字稿檔名：`transcript.md`
  - 格式：`UTF-8 Markdown`
  - 說明：供摘要失敗 recovery、`transcript_file` 手動重跑摘要與完成版逐字稿雙輸出使用。
- 影音字幕檔名：`subtitles.srt`
  - 格式：`UTF-8 SRT`
  - 說明：`media_url` / `local_media` 成功完成轉錄後必須保留在 session 暫存資料夾；不可因 `retentionMode: delete_temp` 成功清理而刪除。

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
  - `originalFilename`
  - `downloadedPath`
  - `sourceArtifactPath`
  - `normalizedAudioPath`
  - `transcriptPath`
  - `subtitlePath`
  - `derivedArtifactPaths`
  - `uploadArtifactPaths`
  - `chunkCount`
  - `chunkDurationsMs`
  - `vadApplied`
  - `selectedCodec`
  - `warnings`

### 5) ai upload artifacts

- 目錄：`ai-upload/`
- 檔名：
  - 單檔模式：`ai-upload.<ext>`
  - 分段模式：`chunk-0000.<ext>`、`chunk-0001.<ext>`...
- 說明：
  - AI 預設只接收 `ai-upload` 產物，不直接上傳 source artifact
  - `metadata.json` 需記錄 `uploadArtifactPaths`

## 下載穩定性參數

`media_url` 下載一律經過 `DownloaderAdapter` 組裝 `yt-dlp` 參數，不由 UI 或 orchestration 直接組命令。

### YouTube

YouTube 來源吸收舊版實戰參數，目標是降低分段下載、網路抖動與格式合併失敗風險：

1. 格式限制在 1080p 以內，優先 `mp4 + m4a`，再 fallback 到 1080p 內可用格式。
2. `--merge-output-format mp4`
3. `--retries 10`
4. `--fragment-retries 10`
5. `--socket-timeout 30`
6. `--http-chunk-size 10485760`
7. `--continue`

若使用者設定 `ytDlpPath`，`DownloaderAdapter` 必須使用該路徑執行 `yt-dlp`；若未設定，才使用系統 PATH 的 `yt-dlp`。若使用者設定 `ffmpegPath`，`DownloaderAdapter` 必須同步把該路徑傳給 `yt-dlp --ffmpeg-location`。這讓 YouTube 的音訊/影片 merge 不依賴系統 PATH，避免 diagnostics 已通過但下載階段仍只留下分離 stream artifact。

### Podcast / Direct Media

podcast 與 direct media 不套用 YouTube 專屬格式選擇與 chunk retry 參數。這些來源維持通用 `yt-dlp` 下載參數，避免把影片平台假設帶進 audio/feed/direct file。

## AI 上傳前壓縮策略

### 核心原則

1. 先抽音訊，不上傳影片影像軌。
2. 優先壓縮 `ai-upload` 檔案，而不是變更 source artifact 原檔語意。
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
3. v1 不啟用 VAD；metadata 仍需記錄 `vadApplied: false`，讓後續 vNext 可無破壞擴充。
4. VAD 去除長靜音區間屬 vNext，需另補品質驗證與 transcript 對齊測試後才能進入 release gate。
5. metadata 需記錄 `chunkCount`、`chunkDurationsMs`、`vadApplied`。

### 品質保護與回退

v1 已實作編碼層級 fallback：Opus 產物失敗時升級到 AAC，AAC 失敗時升級到 FLAC。

轉錄品質守門屬 vNext。若任一條件成立，可判定為「壓縮過度風險」，再自動升級重跑：

1. 轉錄文字密度異常低於閾值（例如每分鐘字數顯著偏低）。
2. 語言偵測與使用者設定語言明顯不符。
3. runtime 回報音訊不可解碼或識別信心過低。

回退順序：

1. `Opus 24~32 kbps`（balanced）
2. `AAC 64 kbps mono 16kHz`
3. `FLAC mono 16kHz`（精度優先，體積較大）

### 品質守門量化門檻（vNext）

1. 單一 chunk 若音訊時長大於 30 秒且 transcript 為空，必須觸發回退。
2. 全任務 transcript 內容密度低於 40 字/分鐘，必須觸發回退。
3. 若觸發回退，最多允許連續升級重跑 2 次（最終到 `FLAC`）。
4. 回退後仍不達門檻，回報 `download_failure` 並附 diagnostics。

### 成本對齊

1. 壓縮策略主要降低「上傳頻寬與音訊處理成本」。
2. 摘要 token 成本另由「合併 transcript -> 整體摘要；必要時 partial notes -> final synthesis」策略控制，不與音訊壓縮耦合。
3. `balanced` profile 的目標是相較 `normalized.wav` 降低至少 70% 上傳量（以樣本驗證）。

### `balanced` profile 量測紀錄

2026-05-02 使用 `ffmpeg 8.1 essentials` 與 `yt-dlp 2026.02.21` 量測，`ai-upload.ogg` 以 Opus 32 kbps VBR 產生：

| 樣本 | 來源類型 | source artifact | `normalized.wav` | `ai-upload.ogg` | 降低比例 |
| --- | --- | --- | ---: | ---: | ---: |
| `youtube-me-at-the-zoo` | YouTube | `Me at the zoo.mp4` / 533,932 bytes | 610,112 bytes | 74,881 bytes | 87.73% |
| `direct-sample-15s` | direct media | `sample-15s.mp3` / 307,453 bytes | 613,642 bytes | 88,120 bytes | 85.64% |
| `direct-sample-12s` | direct media | `sample-12s.mp3` / 205,470 bytes | 409,122 bytes | 66,364 bytes | 83.78% |

三組樣本皆達成相較 `normalized.wav` 降低至少 70% 的 v1 目標。

## 長媒體摘要整合策略

1. 音訊 chunk 與 transcript chunk 只屬於內部處理、token control、diagnostics 與 recovery，不是內容章節。
2. 轉錄完成後，摘要階段應優先使用合併後的完整 transcript 作為整體脈絡，產出單一連貫摘要。
3. 若合併 transcript 超過摘要模型可承受長度，允許先產生內部 partial notes；partial notes 不得直接拼接為最終筆記。
4. partial notes 完成後必須再做 final synthesis，由模型重新整合主題脈絡、重複論點、時間順序與結論。
5. 最終摘要不得出現 `chunk`、`Chunk 1`、`part`、`Part 1`、`分段 1` 等技術分段字樣，除非原始內容本身真的在討論這些詞。
6. chunk index、artifact path、chunk duration 等資訊只可出現在 diagnostics、metadata 或 debug log，不可進入使用者可見摘要正文。

## Gemini 大型媒體轉錄策略

### v1：逐 chunk inline 轉錄

1. 若 `aiUploadArtifactPaths` 只有單一 artifact，Gemini 可用既有 `inline_data` 單次 request 轉錄。
2. 若有多個 `ai-upload` chunk，不得把所有 chunk 一次塞進同一個 Gemini `generateContent` request。
3. Gemini v1 逐 chunk 送出 `inline_data` request，取得每段 transcript 後依 `aiUploadArtifactPaths` 順序合併。
4. 每段 chunk 有獨立 diagnostics：artifact path、chunk index、request failure、empty output、provider error excerpt；chunk duration 由 artifact manifest 補充。
5. partial transcript recovery 會保留已成功 chunk，避免單段失敗時整份長媒體轉錄結果全部丟失。
6. 合併後 transcript 仍需走同一套 `MediaTranscriptionResult` 與 summary handoff；`transcript.md`、`subtitles.srt` 雙輸出與 metadata lineage 已在 `CAP-206` 落地，不得讓 note writer 或 summary provider 分支處理 Gemini chunk 細節，也不得讓 chunk 標記進入摘要 prompt 的使用者可見內容。

### vNext：Gemini file upload strategy

目標：
Gemini file upload 是 Gemini 轉錄 provider 的 vNext 傳輸策略，不是摘要 provider 的行為。使用者選 `Gemini` 作為轉錄 Provider 時，才會進入 Gemini transcription strategy；使用者選 `Gemini` 作為摘要 Provider 時，只影響摘要模型，不決定媒體上傳方式。

#### Provider routing

1. `transcriptionProvider = Gladia`：維持目前流程，先抽音訊、壓縮成 AI-ready audio，必要時切 chunk，逐段上傳 Gladia，輪詢結果後合併 transcript。
2. `transcriptionProvider = Gemini`：進入 Gemini transcription strategy。預設建議採 `auto`，由策略決定使用 Files API 或逐 chunk inline fallback。
3. `summaryProvider = Gemini` / `Mistral` / `OpenRouter`：只影響摘要階段，不得反向改變媒體轉錄傳輸方式。

#### Gemini transcription strategy: `auto`

1. 所有 Gemini 轉錄 strategy 都必須沿用既有 media pipeline：source artifact -> `normalized.wav` -> `ai-upload.*`；不可直接把原始影片作為 Gemini video input 上傳。
2. Files API 優先上傳抽音訊後的 AI-ready audio artifact，例如 `ai-upload.ogg`、`ai-upload.m4a` 或 `ai-upload.flac`。
3. 中長音訊，例如一小時媒體，優先評估 Files API，避免大量 `inline_data` request 與 base64 payload overhead。
4. 若 Files API upload、processing polling、generateContent 或 delete 發生 timeout、provider error、rate limit 或不支援錯誤，必須可 fallback 到現有逐 chunk inline strategy。
5. 若檔案已被切成多個 `chunk-0000.*` artifact，`auto` 可以選擇：
   - 每個 chunk 各自 Files API upload，再依序轉錄與合併。
   - 或直接走既有逐 chunk inline fallback。
6. fallback 不得改變使用者可見輸出：最終仍產生合併 transcript、`transcript.md`、`subtitles.srt` 與同一套 summary handoff。

#### Remote file lifecycle

1. Files API 上傳成功後，必須記錄 remote file `name`、`uri`、`mimeType`、本機 artifact path、建立時間與目前 state。
2. remote file lifecycle 需回寫 `metadata.json`，但不得進入最終摘要正文或 Obsidian note。
3. 成功完成 (`completed`)：若 provider 支援 delete，應主動刪除 remote file；若 delete 失敗，流程可視為成功但必須留下 warning 與 diagnostics。
4. 失敗 (`failed`)：若 remote file 已建立，應嘗試 delete；delete 失敗時保留 remote file id / name 於 diagnostics，讓使用者理解它會依 provider policy 自動過期。
5. 取消 (`cancelled`)：若 upload 尚未完成，應中止 request；若 remote file 已建立，應嘗試 delete。
6. Files API 目前官方文件描述檔案會自動保存 48 小時後刪除；UI / manual 若暴露此策略，必須明確說明遠端暫存與本機 retention 是兩件事。

#### Privacy and retention policy

1. `delete_temp` / `keep_temp` 只控制本機 source、derived、upload artifacts 與 final handoff artifacts，不直接控制 Gemini remote file 保存期。
2. 使用 Gemini Files API 時，設定頁或使用說明應提醒：媒體音訊會上傳到 Gemini API，遠端檔案依 provider policy 暫存；免費層內容可能被用於產品改善，付費層政策依 Gemini API pricing / terms 為準。
3. 若使用者不接受遠端暫存，應建議改用既有 inline strategy 或 Gladia，並在實作時保留可配置 strategy。

#### Diagnostics

1. upload 階段需區分：本機檔案讀取失敗、MIME type 不支援、upload transport error、provider upload error、file state polling timeout。
2. generateContent 階段需區分：file state 非 ACTIVE、model 不支援、provider error payload、empty transcript、rate limit / quota / high demand。
3. cleanup 階段需區分：delete success、delete provider error、delete timeout、remote file already expired。
4. diagnostics 不得記錄 API key、原始逐字稿全文或敏感媒體內容；可記錄 artifact path、remote file name、provider request id、state 與錯誤摘要。

#### Implementation task list

1. 擴充 Gemini transcription strategy 設定：至少支援 `auto`、`files_api`、`inline_chunks`，並定義 migration fallback。
2. 建立 Gemini Files API client adapter：upload、get metadata / poll ACTIVE、delete、generateContent with file reference。
3. 擴充 artifact manifest：記錄 remote file lifecycle 與 cleanup warnings。
4. 將 Gemini `auto` strategy 接入 `TranscriptionProvider`，保留現有逐 chunk inline fallback。
5. 補取消與 cleanup 測試：upload 中取消、ACTIVE 後取消、generateContent 失敗後 delete、delete 失敗 warning。
6. 補 privacy / retention 文案：Settings、Manual 或 Developer Manual 只在功能實作後公開給使用者。
7. 補 smoke / regression：一段短音訊 Files API 成功路徑、一段長音訊 fallback 路徑、逐字稿與摘要輸出不含 strategy / chunk 技術標記。

## 媒體暫存檔模式對應

- `delete_temp`
  - 成功完成 (`completed`)：刪除 source artifact、`normalized.wav`、`ai-upload/`、`metadata.json`；保留 `transcript.md`、`subtitles.srt`
  - 失敗或取消 (`failed` / `cancelled`)：為了 recovery 保留 source artifact、`metadata.json`；若 `transcript.md`、`subtitles.srt` 已產生也必須保留；刪除其餘中間產物
- `keep_temp`
  - 成功完成 (`completed`)：保留 source artifact、`normalized.wav`、`transcript.md`、`subtitles.srt`；刪除 `ai-upload/`、`metadata.json`
  - 失敗或取消 (`failed` / `cancelled`)：保留 source artifact、`normalized.wav`、`transcript.md`、`subtitles.srt`、`metadata.json`；刪除 `ai-upload/`

### Retention UX 對應

舊版使用者語意對應如下；新版設定頁可用這些文案呈現，但底層仍以 artifact lifecycle 執行：

介面呈現與後續 flow modal / settings tab 設計討論集中在 [features/ui-design.md](../features/ui-design.md)；本節只定義 retention 與 artifact lifecycle 語意。

1. `不保留來源檔案`：對應 `delete_temp`，成功後保留 Obsidian 筆記、完成版逐字稿與 session 暫存資料夾內的 `subtitles.srt`。
2. `保留來源檔案`：對應 `keep_temp` 的基本模式，保留 source artifact 與必要 recovery artifact。
3. `保留視訊 + 音訊`：vNext 進階模式，需同時保留來源影片與 AI-ready / normalized audio；目前不直接映射到 `keep_temp`，避免誤保留大量中間檔。

在 v1 設定仍只暴露 `delete_temp / keep_temp`；若要新增第三種模式，需先擴充 `RetentionMode`、artifact matrix、settings migration 與 manual。

## 字幕衍生輸出策略

舊版具備 SRT 與影片字幕嵌入能力；新版將真正 SRT 字幕檔納入 v1 必備 artifact lifecycle，影片軟字幕嵌入仍維持可選 post-processing。

### v1 邊界

1. `subtitles.srt` 是 media workflow 成功完成後必須存在的 session 內最終衍生 artifact。
2. `subtitles.srt` 必須是真正 UTF-8 SRT，不可把 transcript markdown 寫入 `.srt` 檔。
3. 若 provider 沒有回傳細緻時間碼，仍需用可取得的 transcript segment / chunk duration 產生 best-effort SRT；不可靜默略過字幕檔。
4. `.srt` 生成或保留失敗時，流程不可標記為完整成功；需回報可讀 diagnostics，並保留已完成的 transcript recovery artifact。
5. `delete_temp` 成功後不得刪除 `subtitles.srt`；它屬於 final handoff artifact，不是可清除的中間暫存檔。
6. v1 不產生含字幕影片，不呼叫 FFmpeg mux/subtitle burn-in，也不把字幕嵌入 source artifact；`subtitles.srt` 是唯一字幕衍生輸出。
7. v1 不新增第三種 retention mode；`delete_temp` 與 `keep_temp` 只控制 source/derived/upload artifacts，不能改變 `transcript.md` 與 `subtitles.srt` 的 final handoff 保留義務。
8. v1 note writer 不負責產生字幕；字幕生成屬於 media orchestration final handoff，避免 Obsidian 輸出與媒體 artifact lifecycle 耦合。

### transcript_file retry

1. `transcript_file` 只接受 `.md` / `.txt` 絕對路徑，讀取後跳過 media acquisition、compression 與 transcription。
2. 若逐字稿同資料夾存在 `metadata.json`，重跑摘要需沿用其 `title`、`creatorOrAuthor`、`platform`、`sourceUrl/sourcePath/source` 與 `createdAt`。
3. 若 `metadata.json` 不存在或不可解析，使用逐字稿檔名、檔案路徑與 `Transcript File` metadata fallback，並回報 warning。
4. `.srt` / `.vtt` 逐字稿解析屬 vNext 格式擴充；目前不可把字幕檔路徑偽裝成 `.txt` 以繞過驗證。

### vNext 邊界

1. 軟字幕嵌入影片屬於可選 post-processing，不屬於 transcription provider。
2. 含字幕影片保留需獨立 retention mode，不能混用 `keep_temp` 的全部中間檔保留語意。
3. 含字幕影片輸出需定義新 artifact 欄位，例如 `subtitledVideoPath`，並寫入 `metadata.json` lineage；不可覆寫 source artifact。
4. 若要支援 hard subtitle burn-in，需另定義輸出格式、編碼成本、品質損失、取消行為與失敗後 cleanup。
5. 若要支援 soft subtitle mux，需定義容器限制、字幕 track metadata、平台相容性與 fallback。
6. 字幕輸出需有自己的 smoke checklist，覆蓋 `subtitles.srt` 產生、保留、cleanup 保護、重跑摘要情境，以及 vNext 含字幕影片輸出。
7. `.srt` / `.vtt` 作為 `transcript_file` 輸入屬於文字解析能力，不等同於 media workflow 的字幕衍生輸出；兩者需分開驗收。

## Cleanup/Recovery 責任分界（v1）

1. cleanup 決策由 orchestration 依 `retentionMode + lifecycleStatus` 統一執行，不由單一 adapter 各自判斷。
2. `process-media-url` / `process-local-media` 皆在流程結束（成功或丟錯）後觸發 retention cleanup。
3. `completed` 依 retention mode 套用最終保留矩陣。
4. `failed` / `cancelled` 優先保留 recovery 所需最小集合（至少 source + metadata；`keep_temp` 另保留轉檔音訊與逐字稿）。

## 安全恢復規格

1. 恢復只允許在同一個 `<session-id>` 目錄內尋找候選檔案。
2. 禁止掃描整個 `<media-cache-root>/<vault-id>/` 後挑最大檔作為回復來源。
3. 若 session 內無合法產物，直接回報 `download_failure`，不做跨 session fallback。
4. 若 `ai-upload` 遺失但 source artifact 存在，可在同 session 內重建；不可跨 session 借檔。

## 錯誤分類對齊

1. URL 不合法：`validation_error`
2. 下載失敗：`download_failure`
3. runtime 未配置：`runtime_unavailable`
4. 使用者取消：`cancellation`

## 舊版 Media Summarizer 對照檢查

比較對象為本 repo 內 `Media Summarizer/` Python GUI 版；已用 `gui_app.py` 與 `src/downloader.py` 的 SHA-256 確認它與外層 `D:\程式開發\Media Summarizer` 同版。此節只記錄流程差異與可吸收經驗，不能把舊版 GUI 直連式架構搬回新版。

### 端到端流程差異

| 面向 | 舊版 `Media Summarizer` | 本專案 `AI Summarizer` | 判斷 |
| --- | --- | --- | --- |
| 入口判斷 | GUI 以 local file、已知影音平台網域、其他 URL 判斷本機媒體、影音 URL、網頁。direct media URL 若不在白名單內，容易被當成網頁。 | 明確分成 `media_url`、`local_media`、`webpage_url`，`media_url` 再分類為 YouTube / podcast / direct media。 | 新版來源邊界較清楚，direct media 支援較完整。 |
| 下載方式 | 直接使用 `yt_dlp.YoutubeDL` Python API。YouTube 套用 1080p 內格式、mp4 merge、retry、fragment retry、socket timeout、chunk size、continuedl。非 YouTube 走 `bestaudio/best` 並用 postprocessor 轉 `mp3 192k`。 | 以 `yt-dlp` subprocess 執行。YouTube 吸收舊版穩定參數；podcast/direct media 不套用 YouTube 專屬格式假設，以通用參數下載到 session 內的 title-based source artifact。 | 新版隔離性與可診斷性較好；舊版 podcast 直接轉 mp3，對使用者較直覺但會把下載與轉檔耦合。 |
| 下載暫存位置 | `downloads/<uuid8>/%(title)s.%(ext)s`，相對於 app 工作目錄。 | `<mediaCacheRoot>/<vault-id>/<session-id>/<title>.<ext>`，預設在 vault 外 OS cache。 | 新版不污染 vault，且已保留可辨識來源檔名。 |
| 下載恢復 | YouTube 下載失敗時，只在當次 session 內找大於 1 MB 的最大檔案，並補抓 metadata。 | 只接受同 session 中 `yt-dlp` 印出的路徑或合法 source artifact 候選，排除 `.part` / `.ytdl` 與中間產物，依 mtime 選最新。 | 新版比舊版更安全，避免錯拿同 cache root 的舊檔。 |
| 本機媒體 | 直接使用使用者選取的原始檔；影片才進字幕流程；缺少副檔名、大小與絕對路徑邊界。 | 只接受支援副檔名與絕對檔案路徑，大小上限 2 GiB，先複製到 session 並保留安全化後的原始檔名。 | 新版較安全，也能讓本機與 URL 流程共用後段 lifecycle。 |
| 上傳前音訊處理 | `ffmpeg -vn -ac 1 -ar 16000 -b:a 32k` 輸出 `<base>_compressed.mp3`；失敗時直接上傳原始檔。 | 先建立 `normalized.wav`，再依 profile 產生 `ai-upload/ai-upload.ogg`，失敗 fallback 到 `m4a`、`flac`；長媒體再切成 chunk。 | 新版成本與格式控制較完整；舊版 fallback 到原始檔的行為簡單但可能造成高成本。 |
| 長媒體處理 | 不分段；整個壓縮音訊上傳到 Gemini file upload。 | 超過門檻先切 `ai-upload/chunk-0000.<ext>` 起的多段；Gladia 已逐段上傳輪詢；Gemini 已定案 v1 改為逐 chunk inline 轉錄後合併；摘要階段再以合併 transcript 做全局整合。 | 新版對長媒體的恢復性較好；chunk 不應成為最終摘要結構；Gemini file upload 保留為 vNext 大型媒體策略。 |
| 轉錄與摘要 | 同一個 Gemini model/file handle 先轉錄再摘要。 | `TranscriptionProvider` 與 `SummaryProvider` 已拆分，支援 Gemini/Gladia 轉錄與 Gemini/OpenRouter 摘要。 | 新版模型路由彈性明顯較好。 |
| AI 傳輸方式 | Gemini file upload，輪詢 `PROCESSING` 到完成後再 `generate_content([myfile, prompt])`。 | Gemini v1 使用逐 chunk `inline_data`；Gladia 走 `POST /upload`、`POST /pre-recorded`、輪詢結果。 | 逐 chunk inline 先降低 payload 與重試成本；file upload 待 remote lifecycle 與 retention policy 清楚後再做。 |
| 逐字稿格式 | prompt 要求 `{0m8s - 0m13s}`；影片會用 regex 轉 SRT。 | transcript provider 回傳 markdown/segments；Gladia segments 會格式化為 `{startMs-endMs}`；Gemini inline 目前保留模型文字輸出。 | 新版 provider contract 較乾淨，但 `.srt` artifact 名稱與實際內容仍需校準。 |
| 字幕產物 | 影片可產生 `<video>.srt`，再用 ffmpeg copy mux 成 `<video>_subtitled.mkv`。 | `subtitles.srt` 已定案為 v1 必保留 artifact；軟字幕嵌入仍是 vNext 可選 post-processing。 | 新版需先補齊獨立 SRT 保留；含字幕影片保留模式可後續再做。 |
| Obsidian 輸出 | 直接寫進使用者選擇的 vault path，frontmatter 為 Title/Creator/Platform/Source/Created，支援讀模板後覆寫固定欄位並插入 Summary/Transcript。 | `NoteWriter` 負責 path collision、metadata normalize、內建模板或自訂模板，輸出 summary + `## Transcript`。 | 新版更符合 Obsidian plugin 架構，也較容易測試。 |
| 保留策略 | 三種 UI 語意：不保留來源檔案、保留來源檔案、保留視訊 + 音訊。media URL 可優先保留含字幕影片；local media 不刪原始檔，只清中間產物。 | `delete_temp` / `keep_temp` 兩種底層模式；成功、失敗、取消由 `artifact-retention` 集中決策。 | 新版 lifecycle 較一致；舊版第三種模式與含字幕影片保留語意仍可作為 vNext UX。 |
| 取消與清理 | `stop_event` + yt-dlp progress hook；Gemini SDK 呼叫用 polling future 包住，但已送出的 SDK request 不一定能強制中止。清理由 GUI 分支直接處理。 | `AbortSignal` 串接 downloader、ffmpeg/ffprobe、fetch、Gladia polling；yt-dlp 取消會 kill process tree；清理由 orchestration 統一執行。 | 新版取消與清理責任邊界較完整。 |
| 外部依賴 | PyInstaller 可帶 `ffmpeg.exe`；`yt-dlp` 以 Python package 使用，啟動背景檢查 PyPI/GitHub 最新版本。 | 任務開始前檢查 `yt-dlp`、`ffmpeg`、`ffprobe`；可設定 ffmpeg/ffprobe 路徑，並有 dependency drift / release gate 策略。 | 新版診斷較正式；若要降低使用者安裝成本，可補 `yt-dlp` 路徑或安裝 UX。 |
| 測試性 | 主要靠 GUI 實機流程與 dev log。 | 已有 downloader、compressor、retention、provider routing、media integration 測試。 | 新版工程品質較高。 |

### 暫存與衍生產物矩陣

| 產物 | 舊版 URL 媒體 | 舊版本機媒體 | 本專案目前設計 |
| --- | --- | --- | --- |
| 原始下載/匯入 | `downloads/<uuid8>/<title>.<ext>`；YouTube 通常 mp4，podcast/audio 轉成 mp3。 | 使用原始檔路徑，不複製。 | session 內 source artifact；media URL 使用 title-based 檔名，本機檔使用安全化後原始檔名。 |
| 正規化音訊 | 無獨立 normalized 檔。 | 無獨立 normalized 檔。 | `normalized.wav`，PCM 16-bit mono 16kHz。 |
| AI 上傳檔 | `<base>_compressed.mp3`，32 kbps mono 16kHz。 | `<base>_compressed.mp3`，位於原始檔同資料夾。 | `ai-upload/ai-upload.ogg`，fallback `ai-upload.m4a`、`ai-upload.flac`。 |
| 分段檔 | 無。 | 無。 | `ai-upload/chunk-0000.<ext>` 起，多段時取代單一 `ai-upload.<ext>` 交給 provider。 |
| metadata | 只在記憶體 dict 中流動。 | 只在記憶體 dict 中流動。 | `metadata.json`，記錄 session/source/source artifact/derived artifacts/upload artifacts/chunk metadata/transcript/warnings。 |
| 逐字稿檔 | 只寫入 Obsidian；影片另可生成 SRT。 | 只寫入 Obsidian；影片另可生成 SRT。 | `transcript.md` 必須保留在 session 暫存資料夾，供 recovery 與手動重跑摘要使用。 |
| 字幕檔 | `<video>.srt`。 | `<video>.srt`，位於原始檔同資料夾。 | `subtitles.srt` 必須保留在 session 暫存資料夾，且不得被 `delete_temp` 成功清理移除。 |
| 含字幕影片 | `<video>_subtitled.mkv`。 | `<video>_subtitled.mkv`，位於原始檔同資料夾。 | vNext 尚未接入。 |
| 最終筆記 | `<title>.md`，同名加 `(2)`。 | `<title>.md`，同名加 `(2)`。 | 由 `outputFolder`、path resolver、note writer 決定。 |

### 優缺點結論

舊版的優點是單機 EXE 心智模型簡單、Gemini file upload 對大型媒體直覺、字幕嵌入與三段 retention UX 已具體可用，且背景檢查 `yt-dlp` 版本能提醒使用者處理平台變動。

舊版的主要風險是 GUI、下載、AI、Obsidian 寫入高度耦合；本機媒體中間檔會寫在原始檔旁邊；非 YouTube URL 入口判斷較粗；缺少正式錯誤分類、測試與 provider 抽象；長媒體無 chunk strategy，失敗後較難 recovery。

新版的優點是 session isolation、vault 外 cache、typed error、runtime diagnostics、local media safe copy、AI-ready artifact、provider 拆分、長媒體內部分段處理與測試覆蓋都已成形。整體架構不需要回頭套用舊版流程。

新版目前的校準狀態已轉成 `docs/backlog.md` 的「近期優化路線：舊版對照後」，並在 `docs/backlog-active.md` 保留 release 收斂所需 checklist：

1. `metadata.json` 已開始作為 artifact manifest：acquisition 寫入 source artifact，compression 回寫 `derivedArtifactPaths`、`uploadArtifactPaths`、chunk metadata、`selectedCodec` 與 `vadApplied`；轉錄完成後會回寫 `transcript.md` 與 `subtitles.srt` lineage。
2. chunk 命名起點已統一為 `chunk-0000.<ext>`，與 ffmpeg `chunk-%04d` 預設、實作與測試一致。
3. `transcript.srt` 命名錯位已校正為 `transcript.md` 與必保留的 `subtitles.srt`；`.srt` 內容由 transcript segments 產生真正 SRT cue。
4. VAD 與「轉錄品質守門後自動升級重跑」已移入 vNext；現行 compressor 只做編碼失敗 fallback、長度 chunking 與 `vadApplied: false` manifest 記錄。
5. Gemini inline 對多 chunk 已改成逐 chunk request 後合併 transcript，避免一次送出所有 `inline_data` 造成 payload、timeout、503 或整批重試風險；單段失敗時會把已完成 partial transcript 寫入 recovery transcript path。
6. media summary chunking 已改為內部 partial notes + final synthesis，使用者可見摘要不再由 `## Chunk N` 中間結果拼接而成。
7. 舊版可見的「保留含字幕影片」與「保留視訊 + 音訊」尚未映射成新版進階 retention mode；但獨立 `subtitles.srt` 已定案為 v1 必保留產物。

## 備註

1. 此規格先定義 v1 行為，後續若 runtime 策略改為 sidecar/remote，仍需維持同等 artifact 語意。
2. 筆記輸出路徑仍由 `outputFolder` 決定，與 `mediaCacheRoot` 分離。
