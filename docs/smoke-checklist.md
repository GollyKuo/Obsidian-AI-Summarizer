# Smoke Checklist

最後更新：2026-05-05 22:25

## Scope

本文件定義 release 前的手動 smoke checklist，覆蓋：

- `webpage URL`
- `media URL`
- `local media`
- `text file`
- Flow Modal minimal UI visual QA

若需確認每個 smoke 項目對應的端到端 AI 路由，請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。

## Checklist Matrix

| Capability | Desktop | Mobile | Command |
|---|---|---|---|
| `webpage` | yes | yes | `npm run smoke:webpage` |
| `media_url` | yes | no | `npm run smoke:media-url` |
| `local_media` | yes | no | `npm run smoke:local-media` |
| `transcript_file` | yes | no | manual via flow modal |
| `flow_modal_minimal_ui` | yes | mobile-like narrow viewport | manual via visual QA |
| desktop bundle | yes | n/a | `npm run smoke:desktop` |
| mobile bundle | webpage only | yes | `npm run smoke:mobile` |

## Evidence Records

Smoke commands print the manual checklist by default. Add `--record <path>` to write a JSON evidence artifact with timestamp, operator, selected capability scope, result and notes:

```bash
node scripts/smoke-checklist.mjs --capability webpage --record smoke-records/webpage.json --operator "Release Tester" --result pass --notes "desktop smoke completed"
```

Valid `--result` values are `pending`, `pass` and `fail`. When `--record` is omitted, the script remains checklist-only and does not write files.

## Recent Smoke Records

### 2026-05-02 Media URL Download

| Case | Input URL | Source type | Output artifact | Metadata | Result |
|---|---|---|---|---|---|
| YouTube | `https://www.youtube.com/watch?v=jNQXAC9IVRw` | `youtube` | `Me at the zoo.mp4` | `Me at the zoo` / `jawed` / `YouTube` / `2005-04-24` | pass; `ffmpegPath` passed to `yt-dlp --ffmpeg-location`; JS runtime warning observed but non-blocking |
| Direct media | `https://samplelib.com/lib/preview/mp3/sample-15s.mp3` | `direct_media` | `sample-15s.mp3` | `sample-15s` / `Unknown` / `Direct Media` / `2026-05-01` | pass |

### 2026-05-02 Gladia Provider

| Case | Transcription provider | Summary provider | Result |
|---|---|---|---|
| Local media | Gladia / `default` | Gemini / `gemini-2.5-flash` | pass; completed summary |
| Mixed provider | Gladia / `default` | OpenRouter/Qwen | pass; completed summary |

Additional check: final summaries did not show chunk processing markers.

## Webpage

前置：

- plugin 可正常載入
- API key 已設定
- 可開啟 `AI 摘要器` modal

步驟：

1. 選擇 `webpage URL`
2. 輸入可公開讀取的文章網址
3. 執行摘要流程
4. 確認 Vault 內新增筆記
5. 確認 frontmatter 的 `Platform=Web`、`Source=input URL`

驗收：

- 流程可走完 `validating -> acquiring -> summarizing -> writing`
- 成功訊息與 note path 可在 modal 看見
- 若有 warning，可在 UI 與 log 觀測

## Flow Modal Minimal UI

前置：

- plugin 可正常載入
- 可開啟 `AI 摘要器` modal
- 參照 [features/visual-qa-checklist.md](../features/visual-qa-checklist.md)

步驟：

1. 依序切換 `webpage_url`、`media_url`、`local_media`、`transcript_file`
2. 檢查來源選擇、來源說明、placeholder、輸入 action 是否跟著來源更新
3. 輸入長 URL、長 Windows path、長 template path，確認不 overflow
4. 執行一條可成功的 smoke flow，確認 running stage、completed result 與 note path action
5. 觸發一條 validation error 或 runtime unavailable，確認 failed result 有使用者可行的下一步
6. 在較窄視窗或 mobile-like 寬度重看 source selector、input row、action row、result panel

驗收：

- Flow Modal 不再像除錯表單，四種來源一眼可見
- preflight summary、stage status、warning/result、action row 視覺層級清楚
- completed / failed / cancelled 有不同結果呈現
- dark/light theme 文字、border、accent 都可讀
- 不依賴 hover 才能發現關鍵 action

## Media URL

前置：

- 僅桌面版
- settings diagnostics 顯示 `local_bridge` ready
- `yt-dlp`、`ffmpeg`、`ffprobe` 可用
- media cache root 可寫

步驟：

1. 選擇 `media URL`
2. 輸入 YouTube 或 podcast URL
3. 執行流程
4. 確認 Vault 內新增筆記
5. 依 retention mode 檢查 cache root artifact

驗收：

- AI-ready handoff 建立成功
- note 正常寫入
- 依賴缺失時顯示 `runtime_unavailable`

## Local Media

前置：

- 僅桌面版
- settings diagnostics 顯示 `local_bridge` ready
- 準備受支援且未超限的本機媒體檔

步驟：

1. 選擇 `local media`
2. 輸入本機媒體路徑
3. 執行流程
4. 確認 Vault 內新增筆記
5. 依 retention mode 檢查 source / metadata / ai-upload artifact

驗收：

- ingestion / compression / summary 主線可完成
- note 正常寫入
- 不支援格式或超限時顯示 `validation_error`

## Text File

前置：

- 僅桌面版
- 已有 `.md` 或 `.txt` 文字檔絕對路徑；內容可以是手動複製的網頁正文，也可以是既有 `transcript.md`
- 摘要 provider API key 已設定

步驟：

1. 選擇 `transcript_file`，確認 UI 顯示 `文字檔案`
2. 輸入文字檔案絕對路徑，或用 `選擇檔案`
3. 執行流程
4. 確認流程跳過媒體擷取與轉錄，直接進入 summary
5. 確認 Vault 內新增筆記；一般文字檔會以 `Source Text` 保留原文，`transcript.md` 仍可重跑摘要

驗收：

- `.md` / `.txt` 文字檔可直接摘要
- 同資料夾 `metadata.json` 存在時沿用原 media metadata
- 缺少 `metadata.json` 時會用文字檔名 fallback，並顯示 warning
- 空文字檔或非支援副檔名顯示 `validation_error`
