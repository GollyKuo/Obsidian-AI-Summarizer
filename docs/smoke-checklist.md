# Smoke Checklist

最後更新：2026-04-24 01:28

## Scope

本文件定義 release 前的手動 smoke checklist，覆蓋：

- `webpage URL`
- `media URL`
- `local media`

## Checklist Matrix

| Capability | Desktop | Mobile | Command |
|---|---|---|---|
| `webpage` | yes | yes | `npm run smoke:webpage` |
| `media_url` | yes | no | `npm run smoke:media-url` |
| `local_media` | yes | no | `npm run smoke:local-media` |
| desktop bundle | yes | n/a | `npm run smoke:desktop` |
| mobile bundle | webpage only | yes | `npm run smoke:mobile` |

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
