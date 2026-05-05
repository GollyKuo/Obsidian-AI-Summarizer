# Active Backlog

最後更新：2026-05-06

## 用途

本檔是日常工作入口，只追蹤目前 release 仍需要處理的開放項目。

規則：

- 只放 `active` capability 的待辦與驗收點。
- 已完成且不需要每日追蹤的內容移到 [backlog-archive.md](backlog-archive.md)。
- 全局能力地圖與長期排程放在 [backlog.md](backlog.md)。
- 任何 `[x]` 項目都必須標示完成時間，格式為 `（完成：YYYY-MM-DD HH:mm）`。

## 目前主線

1. `CAP-508` Text File Summary Input：把既有逐字稿檔案流程擴充成一般文字檔案摘要，作為被阻擋網頁的替代入口。
2. 收尾最終交付前安全重置。

## 當前阻塞與決策

- Gladia local media 與 Gladia + OpenRouter/Qwen mixed provider 實機 smoke 已由使用者回報通過，最終摘要未出現 chunk 標記。
- 字幕檔已落地：`subtitles.srt` 會在轉錄完成後產生並保留在 session 暫存資料夾，不得被 `delete_temp` 成功清理移除。
- 長媒體摘要已定案：chunk 只能是內部 token control / diagnostics，不得以 `chunk`、`part`、`分段` 等技術字樣出現在最終筆記。
- Gemini 大型媒體 v1 已採「逐 chunk inline 轉錄 -> 合併 transcript -> 全局摘要」；單段失敗時會保留已完成 partial transcript 作為 recovery artifact。
- 舊版 `Media Summarizer` 只吸收行為與經驗，不回搬 GUI 直連式架構，也不修改舊版專案內容。
- `features/` 已收斂為 UI 決策、實作指南與 visual QA；`CAP-304` Flow Modal minimal UI adoption 已完成並移入 archive，Settings Tab polish 留在 `CAP-305` parking，不納入近期執行。
- 設定頁使用說明與 HTML 簡報策略已完成：內建使用說明已加入 `Settings -> AI Summarizer`；`docs/Manual-slides.html` 作為獨立下載文件，不在 settings 中開啟、嵌入或檢查檔案路徑。
- `CAP-208` 第一版已完成並封存到 [backlog-archive.md](backlog-archive.md#cap-208-transcript-cleanup-and-proofreading-逐字稿校對與清理)；目前 active backlog 只保留最終交付檢查。
- 知乎等網站可能直接回傳 `403 Forbidden`，Obsidian `requestUrl` 也不能帶瀏覽器登入 session；本輪用「文字檔案」流程承接「複製正文 -> 存成 `.txt/.md` -> 摘要」。

## 下一個切換點

當 Final Handoff Gate 收斂後：

- `CAP-404` 的 `ytDlpPath` 與 Windows desktop `yt-dlp` managed install/update 已落地；後續只需依使用者回饋評估 macOS/Linux installer。
- `CAP-508` 文字檔案摘要完成後，決定下一輪主線要走貼上文字 inline input，或先補 `CAP-505` 批次與佇列。

## CAP-508 Text File Summary Input 文字檔案摘要輸入

- [x] 將 Flow Modal `transcript_file` 使用者文案改為「文字檔案」，並保留 `.md` / `.txt` 選檔。（完成：2026-05-06 00:31）
- [x] 將 stage label、錯誤提示、診斷能力名稱調整為文字檔語意。（完成：2026-05-06 00:31）
- [x] 調整 fallback metadata，沒有 media session `metadata.json` 時使用 `Text File` 平台。（完成：2026-05-06 00:31）
- [x] 更新 Manual、smoke checklist、test matrix，說明被擋網頁的文字檔替代流程。（完成：2026-05-06 00:31）
- [x] 跑 targeted tests、`gate:local`、build to vault。（完成：2026-05-06 00:31）

## Final Handoff Gate 最終交付檢查

- [ ] 最終專案交付前安全重置：確認 repo 與同步到 vault 的 plugin 副本都已回復乾淨狀態，並清空任何使用者輸入、本機測試資料、媒體產物、cache、API key、provider key、token，以及 settings、logs、drafts、build outputs、ignored local files 中可能殘留的 secrets。
