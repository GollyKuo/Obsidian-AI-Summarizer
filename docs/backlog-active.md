# Active Backlog

最後更新：2026-05-02 01:50

## 用途

本檔是日常工作入口，只追蹤目前 release 仍需要處理的開放項目。

規則：

- 只放 `active` capability 的待辦與驗收點。
- 已完成且不需要每日追蹤的內容移到 [backlog-archive.md](backlog-archive.md)。
- 全局能力地圖與長期排程放在 [backlog.md](backlog.md)。
- 任何 `[x]` 項目都必須標示完成時間，格式為 `（完成：YYYY-MM-DD HH:mm）`。

## 目前主線

1. 收尾媒體取得與 AI-ready artifact：`CAP-202`、`CAP-203`。
2. 收斂大型媒體轉錄與摘要：`CAP-205`。
3. 落地逐字稿與字幕檔生命週期：`CAP-206`。
4. 補齊使用手冊與 smoke gate：`CAP-303`、`CAP-401`。

## 當前阻塞與決策

- `CAP-202` 的 YouTube / direct media 下載 smoke 已補，可重現紀錄已寫入 smoke matrix。
- `CAP-203` 的 `balanced` profile 3 組量測已達標；VAD 與轉錄品質守門移入 vNext，不再阻塞 v1。
- 字幕檔已定案：`subtitles.srt` 必須保留在 session 暫存資料夾，不得被 `delete_temp` 成功清理移除。
- 長媒體摘要已定案：chunk 只能是內部 token control / diagnostics，不得以 `chunk`、`part`、`分段` 等技術字樣出現在最終筆記。
- Gemini 大型媒體 v1 優先採「逐 chunk inline 轉錄 -> 合併 transcript -> 全局摘要」；Gemini file upload 保留為 vNext 可選策略。
- 舊版 `Media Summarizer` 只吸收行為與經驗，不回搬 GUI 直連式架構，也不修改舊版專案內容。

## Release Checklist

### CAP-202 Media Acquisition Boundary 媒體取得邊界

目標：
媒體來源進入 session 後，能保留可追蹤的 source artifact，後續所有轉檔、壓縮與分段都從 source artifact 衍生。

- [x] 完成 YouTube 至少一條手動 smoke 下載驗證，記錄輸入 URL、來源類型、輸出 artifact、metadata 與成功/失敗原因。（完成：2026-05-02 01:50）
- [x] 完成 podcast / direct media 至少一條手動 smoke 下載驗證，記錄同上。（完成：2026-05-02 01:50）
- [x] media URL 下載完成後，session 內保留 yt-dlp 實際輸出的原始檔與原始/安全化檔名，不再只以 `downloaded.<ext>` 作為唯一可辨識來源。（完成：2026-05-02 00:22）
- [x] local media 匯入 session 時，保留原始檔名或安全化後的原始檔名，並在 metadata 中記錄原始絕對路徑與 session 內 source artifact 路徑。（完成：2026-05-02 00:22）
- [x] 將 `metadata.json` 校準為 artifact manifest：補 `originalFilename`、`sourceArtifactPath`、`derivedArtifactPaths`、`uploadArtifactPaths`、`chunkCount`、`chunkDurationsMs`、`vadApplied`、`selectedCodec`。（完成：2026-05-02 00:22）
- [x] 同步更新 [media-acquisition-spec.md](media-acquisition-spec.md)：定義 source artifact 命名、路徑安全化、同名衝突、清理與 recovery 規則。（完成：2026-05-02 00:22）

### CAP-203 AI-Ready Media Processing AI 可用媒體處理

目標：
把 source artifact 穩定轉成 transcript-ready payload，並讓成本、品質與 chunk 命名可驗證。

- [x] 完成 `balanced` profile 對 `normalized.wav` 的 3 組樣本量測，目標上傳量降低至少 70%。（完成：2026-05-02 01:50）
- [x] 決定 VAD 與轉錄品質守門屬於 vNext 規格；v1 保留 chunking、codec fallback 與 `vadApplied: false` manifest 欄位。（完成：2026-05-02 01:50）
- [x] 統一 chunk 命名起點：規格、測試與產物一致使用 `chunk-0000.<ext>` 起。（完成：2026-05-02 01:01）
- [x] 將 `balanced` profile 壓縮量測結果同步到 [media-acquisition-spec.md](media-acquisition-spec.md)。（完成：2026-05-02 01:50）

### CAP-205 AI Processing Pipeline AI 處理管線

目標：
轉錄、摘要與錯誤恢復都走明確 provider contract；大型媒體不能因單次 payload 過大或 chunk 標記外洩破壞輸出品質。

- [ ] 補 Gladia local media 實機 smoke：驗證本機音訊/影片可成功轉錄，並覆蓋取消與設定缺漏錯誤。
- [ ] 補 Gladia 混合 provider smoke：驗證 Gladia 轉錄 + OpenRouter/Qwen 摘要可完整寫入筆記。
- [ ] 實作 Gemini 逐 chunk inline 轉錄合併：每個 `ai-upload` chunk 各自送 Gemini `inline_data` request，成功後依順序合併 transcript。
- [ ] Gemini 逐 chunk inline 轉錄需保留 chunk-level diagnostics、partial transcript recovery、單段 retry 邊界與合併後的 `transcript.md` / `subtitles.srt` handoff。
- [ ] 校準 `media-summary-chunking`：移除最終輸出的 `## Chunk N` 合併格式，改為合併 transcript 後做整體摘要。
- [ ] 若 transcript 過長必須二階段處理，只能產生內部 partial notes，再以 final synthesis 輸出單一連貫摘要。
- [ ] 最終摘要不得出現 `chunk`、`Chunk 1`、`part`、`Part 1`、`分段` 等技術標記，除非原始內容本身就在談這些詞。
- [ ] 定義手動 retry：轉錄成功但摘要失敗時，保留 transcript，並讓使用者明確選擇只重跑摘要。
- [ ] Gemini file upload vNext 保留為可選 transcription strategy，另行定義 remote file lifecycle、取消、cleanup、privacy/retention 與錯誤診斷。

### CAP-206 Note Output And Artifact Retention 筆記輸出與產物保留

目標：
筆記、逐字稿、字幕與暫存 artifact 有一致生命週期；該保留的檔案不會被清理流程刪掉。

- [ ] 完成逐字稿雙輸出：逐字稿除寫入 Obsidian 筆記外，也要在 session 資料夾中保留完成版 `transcript.md`。
- [ ] 實作真正 UTF-8 `subtitles.srt` 產生與保留，不得把 markdown transcript 寫入 `.srt`。
- [ ] `transcript.md` 與 `subtitles.srt` 都要納入 `metadata.json` lineage。
- [ ] `retentionMode: delete_temp` 成功清理時，仍不得移除必保留的逐字稿與字幕檔。
- [ ] 補 cleanup / recovery / final handoff 安全檢查，確認字幕檔與逐字稿保留策略沒有被清理流程破壞。
- [ ] 定義字幕產線 v1/vNext 邊界：`.srt` 生成、FFmpeg 軟字幕嵌入、含字幕影片保留策略。

### CAP-303 Documentation And User Manual 文件與使用手冊

目標：
使用者能理解 provider 選擇、長媒體策略、保留策略與失敗後怎麼恢復。

- [ ] 補 Gladia 轉錄 provider 使用說明：API key 設定、建議使用情境、與 Gemini 轉錄取捨、常見錯誤與成本注意事項。
- [ ] 補 Gemini 大型媒體策略說明：v1 逐 chunk inline 轉錄、vNext file upload、兩者風險與適用情境。
- [ ] 補長媒體摘要說明：chunk 是內部處理，不會出現在最終摘要；必要時採 partial notes + final synthesis。
- [ ] 補常見問題與疑難排解：轉錄失敗、摘要失敗、只重跑摘要、模型不可用、rate limit、成本預估。
- [ ] 補使用情境 walkthrough：網頁摘要、YouTube/podcast、本機音訊、本機影片、已有逐字稿重跑摘要。
- [ ] 補 artifact retention 說明：`transcript.md`、`subtitles.srt`、source artifact、derived artifact、upload artifact 在不同 retention mode 下的保留行為。

### CAP-401 Test Matrix And Smoke Gates 測試矩陣與 Smoke Gate

目標：
每個 release blocker 都要有可重跑的驗證入口。

- [x] 將 YouTube / direct media smoke 結果補入 smoke matrix。（完成：2026-05-02 01:50）
- [ ] 將 local media + Gladia 轉錄成功路徑補入 provider smoke matrix。
- [ ] 將 Gladia 轉錄 + OpenRouter/Qwen 摘要混合 provider 路徑補入 smoke matrix。
- [ ] 新增 artifact manifest 驗證：source artifact、derived artifact、upload artifact、transcript、subtitle lineage 都可追蹤。
- [ ] 新增 Gemini 逐 chunk inline 轉錄合併 regression gate。
- [ ] 新增長媒體全局摘要 regression gate，確認最終輸出不含 chunk/part 技術標記。
- [ ] 新增 transcript/subtitle lifecycle regression gate，確認 `delete_temp` 不會移除必保留字幕與逐字稿。

## 下一個切換點

當 `CAP-202`、`CAP-203` 的驗收點關閉，且 `CAP-205` / `CAP-206` 的長媒體與字幕策略落地後：

- 將本檔已完成項目移入 [backlog-archive.md](backlog-archive.md)。
- 重新評估 `CAP-404` 的 `ytDlpPath` / managed install/update 是否進入 active。
- 決定下一輪主線要走 `CAP-508` 輸入來源擴充，或先補 `CAP-505` 批次與佇列。

## Final Handoff Gate 最終交付檢查

- [ ] 最終專案交付前安全重置：確認 repo 與同步到 vault 的 plugin 副本都已回復乾淨狀態，並清空任何使用者輸入、本機測試資料、媒體產物、cache、API key、provider key、token，以及 settings、logs、drafts、build outputs、ignored local files 中可能殘留的 secrets。
