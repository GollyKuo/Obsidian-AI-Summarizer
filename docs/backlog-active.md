# Active Backlog

最後更新：2026-05-05

## 用途

本檔是日常工作入口，只追蹤目前 release 仍需要處理的開放項目。

規則：

- 只放 `active` capability 的待辦與驗收點。
- 已完成且不需要每日追蹤的內容移到 [backlog-archive.md](backlog-archive.md)。
- 全局能力地圖與長期排程放在 [backlog.md](backlog.md)。
- 任何 `[x]` 項目都必須標示完成時間，格式為 `（完成：YYYY-MM-DD HH:mm）`。

## 目前主線

1. 收尾最終交付前安全重置。

## 當前阻塞與決策

- Gladia local media 與 Gladia + OpenRouter/Qwen mixed provider 實機 smoke 已由使用者回報通過，最終摘要未出現 chunk 標記。
- 字幕檔已落地：`subtitles.srt` 會在轉錄完成後產生並保留在 session 暫存資料夾，不得被 `delete_temp` 成功清理移除。
- 長媒體摘要已定案：chunk 只能是內部 token control / diagnostics，不得以 `chunk`、`part`、`分段` 等技術字樣出現在最終筆記。
- Gemini 大型媒體 v1 已採「逐 chunk inline 轉錄 -> 合併 transcript -> 全局摘要」；單段失敗時會保留已完成 partial transcript 作為 recovery artifact。
- 舊版 `Media Summarizer` 只吸收行為與經驗，不回搬 GUI 直連式架構，也不修改舊版專案內容。
- `features/` 已收斂為 UI 決策、實作指南與 visual QA；`CAP-304` Flow Modal minimal UI adoption 已完成並移入 archive，Settings Tab polish 留在 `CAP-305` parking，不納入近期執行。
- 設定頁使用說明與 HTML 簡報策略已完成：內建使用說明已加入 `Settings -> AI Summarizer`；`docs/Manual-slides.html` 作為獨立下載文件，不在 settings 中開啟、嵌入或檢查檔案路徑。
- `CAP-208` 第一版已完成並封存到 [backlog-archive.md](backlog-archive.md#cap-208-transcript-cleanup-and-proofreading-逐字稿校對與清理)；目前 active backlog 只保留最終交付檢查。

## 下一個切換點

當 Final Handoff Gate 收斂後：

- `CAP-404` 的 `ytDlpPath` 已落地；後續只需評估 `yt-dlp` managed install/update 是否進入 active。
- 決定下一輪主線要走 `CAP-508` 輸入來源擴充，或先補 `CAP-505` 批次與佇列。

## Final Handoff Gate 最終交付檢查

- [ ] 最終專案交付前安全重置：確認 repo 與同步到 vault 的 plugin 副本都已回復乾淨狀態，並清空任何使用者輸入、本機測試資料、媒體產物、cache、API key、provider key、token，以及 settings、logs、drafts、build outputs、ignored local files 中可能殘留的 secrets。
