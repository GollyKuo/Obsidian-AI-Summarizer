# UI Design And Interaction Notes

最後更新：2026-05-02 13:51

## 用途

本檔是 AI Summarizer 外觀介面與互動設計的討論入口。它不取代架構、媒體處理或使用手冊文件，而是把介面相關決策集中成導覽層，避免後續討論散落在 backlog、spec 與程式碼註解中。

## 導覽地圖

- 架構邊界：[architecture-boundary.md](../docs/architecture-boundary.md)
  - 定義 `plugin/`、`ui/`、`orchestration/`、`runtime/` 的責任邊界。
  - UI 可以呈現 modal、settings tab、progress、result feedback，但不得直接操作 runtime adapter。
- 技術選型：[project-setup-sop.md](../docs/project-setup-sop.md)
  - 記錄 TypeScript、Obsidian plugin scaffold、React UI 層與 Vitest 的早期決策。
  - React 只限於 `ui/`，不得接管 orchestration 與 runtime。
- 能力地圖：[backlog.md](../docs/backlog.md)
  - `CAP-301` 記錄最小互動流程。
  - `CAP-302` 記錄入口與設定體驗。
  - `CAP-502` 保留 UI 字串資源化與多語輸出契約。
- 日常追蹤：[backlog-active.md](../docs/backlog-active.md)
  - 目前 release 的文件、smoke gate 與手冊補齊工作。
  - 若 UI 設計變成 release blocker，應在這裡新增 active checklist。
- 已完成 UX：[backlog-archive.md](../docs/backlog-archive.md)
  - flow modal skeleton、source input、progress、result、cancel。
  - ribbon 入口、template UX、輸入引導與錯誤提示。
- 媒體 UX：[media-acquisition-spec.md](../docs/media-acquisition-spec.md)
  - retention UX、舊版 GUI 對照、下載/轉檔/字幕/逐字稿 artifact 語意。
  - 設計媒體來源、保留策略、recovery action 時必須參照這份規格。
- 使用者手冊：[Manual.md](../docs/Manual.md)
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
5. 媒體與暫存檔相關文案必須對齊 [media-acquisition-spec.md](../docs/media-acquisition-spec.md) 的 artifact lifecycle。
6. UI 文案改動需同步 [Manual.md](../docs/Manual.md) 與必要測試。

## 2026-05-02 畫面檢視結論

本節討論對象是截圖中的 `AI 摘要器` 任務 Flow Modal，也就是 [src/ui/flow-modal/SummarizerFlowModal.ts](../src/ui/flow-modal/SummarizerFlowModal.ts)，不是 Obsidian plugin settings 頁面。

目前畫面已能完成任務，但視覺與互動層級仍偏像「除錯用表單」。下一輪不建議先改成完整 wizard，因為四種來源共用同一個入口、且使用者通常只想快速貼 URL 或選檔開始；更適合先保留單一 modal，將內容重排成幾個固定區塊。

### 核心判斷

1. 入口應維持輕量，但要讓來源差異一眼可見。
2. 技術細節要存在，但不應佔據主視覺，例如 acquisition / extraction pipeline、local media ingestion、retention policy 應放在輔助說明或 details。
3. 長任務的可信度來自清楚狀態，而不是更多說明文字；媒體流程尤其需要把下載、轉檔、轉錄、摘要、寫入筆記拆成可讀階段。
4. 成功與失敗畫面都應提供下一步，而不只是顯示訊息。
5. Flow modal 不應變成設定頁；缺 API key、缺 ffmpeg、runtime 不可用等問題應提供「前往設定 / 診斷」的 action。

### 建議版面

建議把 Flow Modal 分成五個區塊：

1. `來源選擇`
   - 將 dropdown 改為分段控制或四個 compact option button：網頁 URL、媒體 URL、本機媒體、逐字稿檔案。
   - 每個來源只顯示短 label；完整說明放在下方來源說明區。
   - 保留 `lastSourceType` 作為預設選取。

2. `來源輸入`
   - 只保留一個主要輸入欄與一個輔助 action。
   - URL 類來源的輔助 action 是「填入範例」。
   - 檔案類來源的輔助 action 是「選擇檔案」。
   - placeholder 應是可直接理解的格式範例，不要承載規格說明。

3. `執行前摘要`
   - 顯示目前會使用的 note 模板、輸出位置、媒體暫存策略。
   - 媒體來源額外顯示簡短 dependency readiness，例如 `媒體工具：可用 / 需設定`。
   - 詳細 artifact lifecycle 不放在主畫面，只提供可展開說明。

4. `執行狀態`
   - idle 時只顯示「等待開始」。
   - running 時顯示階段列表或 stepper：驗證、取得內容、轉檔、轉錄、摘要、寫入筆記。
   - cancellation 時顯示「正在取消」與目前正在停止的階段，避免使用者以為按鈕無效。

5. `結果操作`
   - completed：顯示筆記路徑，並提供「開啟筆記」「複製路徑」「再摘要一次」。
   - failed：顯示錯誤摘要、建議動作，並依錯誤類型提供「重新檢查設定」「改用逐字稿檔案」「重試」。
   - cancelled：顯示「已取消」，若有 recovery artifact 則提示可改用逐字稿重跑摘要。

### 文案方向

- 主畫面文案應改短，避免每段都出現 implementation terms。
- 專有詞可保留在 details，例如 `acquisition / extraction pipeline`、`local media ingestion`、`delete_temp / keep_temp`。
- 使用者可見文案優先使用行動語氣：例如「先到診斷頁確認 ffmpeg」比「runtime_unavailable」更有用。
- 技術狀態仍要保留在 log / diagnostics，modal 只顯示足以讓使用者決定下一步的資訊。

### 實作優先序

1. 先調整 modal 資訊架構與文案，不改 orchestration。
2. 將來源選擇從 dropdown 換成更清楚的分段控制，仍沿用 `SourceType` 與 `source-guidance`。
3. 把 note 模板、暫存策略、dependency readiness 收斂成執行前摘要。
4. 將 `stageMessage` 升級為可對應 job stage 的顯示模型，讓媒體流程的長任務更可追蹤。
5. 成功後補上開啟筆記與複製路徑；失敗後依 `ErrorCategory` 補下一步 action。

### 暫不做

- 暫不改成多頁 wizard；除非之後加入批次、佇列或多來源混合輸入。
- 暫不在 flow modal 內做完整設定管理；設定與診斷仍放在 Settings Tab。
- 暫不把 artifact 清單全部攤開在主畫面；只在完成或失敗時顯示與下一步有關的產物。

## 實作參考文件

本檔保留 UI 決策與討論結論；可執行的 token、元件、layout 與導入批次集中在 [implementation-guide.md](implementation-guide.md)，驗收清單集中在 [visual-qa-checklist.md](visual-qa-checklist.md)。

實作時請以這個分工為準：

- `features/ui-design.md`：記錄「為什麼這樣設計」與目前已同意的 Flow Modal 方向。
- `features/implementation-guide.md`：記錄「如何實作」，包含 `.ai-summarizer-flow` scope、`--ais-*` token、source selector、preflight summary、stage list、result panel 與批次導入順序。
- `features/visual-qa-checklist.md`：記錄「如何驗收」，包含 dark/light、長路徑、running/cancelled/completed/failed、Settings Tab 與 mobile-like narrow width。

目前採用結論：

1. Flow Modal 採單頁分區，不先做完整 wizard。
2. 來源選擇優先改為 compact segmented control。
3. 主畫面保留短文案，技術細節移到 details。
4. 狀態呈現從單行 `status | stage` 升級成階段列表。
5. completed / failed / cancelled 都需要明確下一步 action。
6. CSS scope 只作用於 AI Summarizer UI，不污染 Obsidian 全域。

## 驗證入口

- UI / 設定頁變更後，優先跑：

```bash
npm run smoke:desktop
```

- 需要把 plugin 同步到測試 vault 並立即查看 UI 時，參照 [Manual.md](../docs/Manual.md) 的「改 UI 並要立刻在 Obsidian 驗證」。
- 若改到 source guidance、template、runtime diagnostics，需同步檢查 [test-matrix.md](../docs/test-matrix.md) 中的 UI/source/template wiring 測試。

## 待討論項

- 分段控制要用純 Obsidian `Setting` 組出來，還是引入 flow modal 專用 CSS class。
- 執行前 dependency readiness 要即時檢查，還是只顯示最近一次 settings diagnostics 結果。
- `retentionMode` 在 flow modal 中是否只顯示目前設定，或允許本次任務臨時覆寫。
- completed result 是否只提供筆記操作，或也顯示 `transcript.md`、`subtitles.srt`、source artifact 的可用狀態。
- failed result 的 action 是否先只做文字導引，或直接接設定頁 / 診斷頁 / transcript retry 入口。
