# UI Design And Interaction Notes

最後更新：2026-05-02 03:18

## 用途

本檔是 AI Summarizer 外觀介面與互動設計的討論入口。它不取代架構、媒體處理或使用手冊文件，而是把介面相關決策集中成導覽層，避免後續討論散落在 backlog、spec 與程式碼註解中。

## 導覽地圖

- 架構邊界：[architecture-boundary.md](architecture-boundary.md)
  - 定義 `plugin/`、`ui/`、`orchestration/`、`runtime/` 的責任邊界。
  - UI 可以呈現 modal、settings tab、progress、result feedback，但不得直接操作 runtime adapter。
- 技術選型：[project-setup-sop.md](project-setup-sop.md)
  - 記錄 TypeScript、Obsidian plugin scaffold、React UI 層與 Vitest 的早期決策。
  - React 只限於 `ui/`，不得接管 orchestration 與 runtime。
- 能力地圖：[backlog.md](backlog.md)
  - `CAP-301` 記錄最小互動流程。
  - `CAP-302` 記錄入口與設定體驗。
  - `CAP-502` 保留 UI 字串資源化與多語輸出契約。
- 日常追蹤：[backlog-active.md](backlog-active.md)
  - 目前 release 的文件、smoke gate 與手冊補齊工作。
  - 若 UI 設計變成 release blocker，應在這裡新增 active checklist。
- 已完成 UX：[backlog-archive.md](backlog-archive.md)
  - flow modal skeleton、source input、progress、result、cancel。
  - ribbon 入口、template UX、輸入引導與錯誤提示。
- 媒體 UX：[media-acquisition-spec.md](media-acquisition-spec.md)
  - retention UX、舊版 GUI 對照、下載/轉檔/字幕/逐字稿 artifact 語意。
  - 設計媒體來源、保留策略、recovery action 時必須參照這份規格。
- 使用者手冊：[Manual.md](Manual.md)
  - 使用者可見入口、設定頁、日常操作、smoke command。
  - UI 文案或流程改動後，需同步手冊。

## 目前介面範圍

### Flow Modal

目前由 [src/ui/flow-modal/SummarizerFlowModal.ts](../src/ui/flow-modal/SummarizerFlowModal.ts) 實作，承接主要任務入口：

1. 選擇輸入來源：`webpage_url`、`media_url`、`local_media`、`transcript_file`
2. 顯示來源輸入欄、檔案選擇或範例填入
3. 顯示目前 note 模板
4. 顯示任務狀態、stage message、warning、result
5. 提供開始與取消操作

設計討論重點：

- 來源選擇是否維持 dropdown，或改成更清楚的分段控制 / tab。
- 來源說明、範例、錯誤提示是否要收斂成更短的 progressive disclosure。
- 進度狀態是否要呈現明確階段，例如下載、轉檔、轉錄、摘要、寫入筆記。
- 完成後是否提供直接開啟筆記、複製路徑、重跑摘要等操作。
- 失敗後是否根據錯誤類型提供下一步 action，例如開啟設定頁診斷、改用 `transcript_file`、重試。

### Settings Tab

目前由 [src/ui/settings-tab.ts](../src/ui/settings-tab.ts) 實作，分成：

1. `AI 模型`
2. `輸出與媒體`
3. `模板與提示`
4. `診斷`

設計討論重點：

- 設定頁資訊密度高，應維持 Obsidian-native 表單感，不做行銷式版面。
- provider、model、API key、API test、model catalog 管理需要清楚區分「目前使用中」與「可管理清單」。
- 媒體 cache、ffmpeg/ffprobe、retention mode 屬於操作風險較高的設定，文案需明確說明保留與刪除語意。
- 診斷頁應直接回答「現在能不能跑這個來源」，而不是只列 raw dependency status。

### Source Guidance

目前由 [src/ui/source-guidance.ts](../src/ui/source-guidance.ts) 集中來源引導與錯誤提示。

設計討論重點：

- `source-guidance` 是 flow modal 與設定頁共同參照的 UI 文案來源。
- 若新增來源類型，需同步來源 label、placeholder、input hint、examples、empty value hint、error hint。
- 錯誤提示應保持 action-oriented，避免只重複底層錯誤。

## 介面原則

1. 優先使用 Obsidian-native interaction pattern。
2. 關鍵操作不得只靠 hover 才能發現。
3. UI 只負責呈現、輸入收集、狀態回饋與使用者 action，不直接處理 runtime、檔案寫入或 orchestration 細節。
4. 長任務必須可看出狀態，且取消、失敗、成功要有可區分的結果。
5. 媒體與暫存檔相關文案必須對齊 [media-acquisition-spec.md](media-acquisition-spec.md) 的 artifact lifecycle。
6. UI 文案改動需同步 [Manual.md](Manual.md) 與必要測試。

## 驗證入口

- UI / 設定頁變更後，優先跑：

```bash
npm run smoke:desktop
```

- 需要把 plugin 同步到測試 vault 並立即查看 UI 時，參照 [Manual.md](Manual.md) 的「改 UI 並要立刻在 Obsidian 驗證」。
- 若改到 source guidance、template、runtime diagnostics，需同步檢查 [test-matrix.md](test-matrix.md) 中的 UI/source/template wiring 測試。

## 待討論項

- Flow modal 是否需要從單頁表單改成「來源 -> 設定確認 -> 執行狀態 -> 結果」的分段流程。
- 媒體來源是否要在開始前顯示依賴診斷摘要，降低使用者到中途才失敗的機率。
- retention mode 是否要在 UI 上用使用者語意呈現，底層仍保存 `delete_temp / keep_temp`。
- `transcript_file` recovery 是否要在失敗畫面直接提供入口。
- 完成後是否要顯示產物清單：Obsidian note、`transcript.md`、`subtitles.srt`、source artifact。
