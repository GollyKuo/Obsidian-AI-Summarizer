# Visual QA Checklist

這份清單用於驗收 AI Summarizer UI 重構，尤其是 `AI 摘要器` Flow Modal。若只改文件不實作，不需要跑本清單；若改到 UI、CSS、source guidance 或 result action，應至少手動檢查相關項目。

## Scope

- [ ] 新樣式只作用在 AI Summarizer plugin UI。
- [ ] Flow Modal 有明確 root scope，例如 `ai-summarizer-flow`。
- [ ] 沒有覆寫全域 `body`、`.modal`、`.setting-item`、`.theme-dark`、`.theme-light`。
- [ ] 沒有引入外部專案 namespace，例如 `.mt-shell`、`.afc-*`。
- [ ] Settings Tab 若使用共用 token，也有自己的窄 scope。

## Obsidian Theme Compatibility

- [ ] Obsidian dark theme 可讀。
- [ ] Obsidian light theme 可讀。
- [ ] 文字、border、surface 使用 Obsidian variables 或 `--ais-*` token。
- [ ] Accent button 在 dark/light 都有足夠對比。
- [ ] Warning / danger / success 狀態不只靠顏色辨識。
- [ ] Focus-visible 狀態在 dark/light 都清楚。

## Flow Modal Structure

- [ ] 第一眼能看出這是 `AI 摘要器` 任務 modal，不是 settings。
- [ ] 來源選擇四個入口同時可見。
- [ ] active source state 明確。
- [ ] source description 只顯示目前來源相關內容。
- [ ] input row 與 action button 對齊且不跳動。
- [ ] preflight summary 與 stage status 是不同區塊。
- [ ] action row 在不同狀態下位置穩定。

## Source Coverage

逐一切換並檢查：

- [ ] `webpage_url`：placeholder、hint、範例、錯誤提示符合網頁摘要。
- [ ] `media_url`：提示 yt-dlp / ffmpeg readiness，不把完整 pipeline 塞主畫面。
- [ ] `local_media`：檔案選擇 action 明確，長 Windows path 不撐破 modal。
- [ ] `transcript_file`：清楚表達跳過轉錄、只重跑摘要。
- [ ] 切換來源會清除或更新不適用的提示與 result。
- [ ] `lastSourceType` 預設選取仍正常。

## Input Stress Cases

- [ ] 空值顯示 source-specific empty value hint。
- [ ] 很長的 URL 不造成水平 overflow。
- [ ] 很長的 Windows path 不撐破 input row。
- [ ] 很長的 vault template path 可讀或可截斷。
- [ ] 本機檔案選擇器不可用時，有可理解的手動輸入提示。
- [ ] URL 類來源的「填入範例」不會誤導成真實預設值。

## Preflight Summary

- [ ] 顯示 note template。
- [ ] 顯示輸出位置或能理解輸出目的地。
- [ ] 顯示 retention mode 的使用者語意，而不只顯示 `delete_temp / keep_temp`。
- [ ] 媒體來源顯示 dependency readiness 或尚未檢查狀態。
- [ ] 非媒體來源不顯示不必要的媒體工具狀態。
- [ ] artifact lifecycle 詳細說明在 details 中，不佔主畫面。

## Running State

- [ ] 按下 `開始摘要` 後 primary action 進入 disabled/loading state。
- [ ] `取消` 在 running 時可用。
- [ ] 目前階段可辨識。
- [ ] 媒體流程顯示下載/準備媒體/轉錄/摘要/寫入筆記等階段。
- [ ] 網頁流程不顯示不適用的媒體階段。
- [ ] 逐字稿流程不顯示不適用的轉錄階段。
- [ ] warning 出現時不擠掉 action row。
- [ ] loading state 不造成明顯 layout shift。

## Cancellation State

- [ ] 按下取消後顯示正在取消。
- [ ] 取消中不允許重複開始同一任務。
- [ ] 已取消結果與失敗結果視覺不同。
- [ ] 若有 recovery artifact，能提示改用逐字稿檔案。

## Completed State

- [ ] 顯示 `已建立摘要筆記`。
- [ ] 顯示 note path，且長路徑不 overflow。
- [ ] 有 `開啟筆記` action。
- [ ] 有 `複製路徑` 或等效定位 action。
- [ ] 可重新摘要或重新開始，不需要關閉再開 modal。
- [ ] warning 若存在，仍可被看見但不壓過成功結果。

## Failed State

- [ ] 顯示使用者可理解的錯誤摘要。
- [ ] 顯示 source-aware 建議。
- [ ] validation error 指向修正輸入。
- [ ] runtime unavailable 指向診斷或設定。
- [ ] download failure 指向重試或改用其他來源。
- [ ] ai failure 指向 API/model/provider 設定或重試。
- [ ] note write failure 指向輸出資料夾或同名筆記問題。
- [ ] raw stack trace 不直接顯示在主畫面。

## Settings Tab

- [ ] `AI 模型`、`輸出與媒體`、`模板與提示`、`診斷` 分段清楚。
- [ ] active section 明確。
- [ ] AI provider/model/API key 的目前使用中與管理清單語意分開。
- [ ] retention mode 文案說明保留/刪除語意。
- [ ] media cache root 顯示為暫存位置，不暗示會寫入 vault。
- [ ] 診斷頁能回答每個來源目前是否可用。
- [ ] 詳細 diagnostics 可展開，但 overview 足夠行動導向。

## Narrow Width / Mobile-Like View

- [ ] source selector 可換行。
- [ ] input row 可換成上下排列。
- [ ] button touch target 至少 44px。
- [ ] preflight chips 可換行。
- [ ] stage list 不水平 overflow。
- [ ] result actions 可換行。
- [ ] 不依賴 hover 才能發現關鍵 action。

## Accessibility

- [ ] Source selector 有 keyboard focus。
- [ ] Icon-only action 若存在，有 aria label 或 tooltip。
- [ ] Disabled state 明確且不可點。
- [ ] Error/warning 不只靠紅色或黃色。
- [ ] 文字對比在 dark/light 都足夠。
- [ ] Modal 內容順序符合鍵盤操作期待。

## Regression Checks

改 UI 後至少確認：

- [ ] `npm run smoke:desktop`
- [ ] 若牽涉 mobile limitation 文案，跑 `npm run smoke:mobile`
- [ ] 若改 source guidance，檢查所有 `SourceType` 文案。
- [ ] 若改 diagnostics 顯示，檢查 runtime diagnostics summary。
- [ ] 若改 result action，檢查 completed / failed / cancelled 三種狀態。

## Pass Criteria

這套 UI 可以視為通過 minimal adoption，當：

- Flow Modal 不再像除錯表單。
- 四種來源一眼可見。
- 開始前摘要、執行中狀態、完成/失敗結果彼此分明。
- Obsidian dark/light 都可讀。
- 長 URL/path 不破版。
- 任務 action 有清楚主次層級。
- CSS scope 沒有污染 Obsidian 全域。
