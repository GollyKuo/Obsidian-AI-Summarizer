# UI Implementation Guide

這份文件是 AI Summarizer UI 重構的實作指南。它合併設計原則、token contract、component recipe、layout pattern 與導入順序，目標是讓實作時只需要先看這一份，再搭配 [ui-design.md](ui-design.md) 的決策背景與 [visual-qa-checklist.md](visual-qa-checklist.md) 的驗收清單。

## 實作定位

AI Summarizer 是 Obsidian plugin 裡的 operational tool。UI 重構應優先改善使用者完成任務的效率：

1. 選擇來源。
2. 貼 URL 或選檔。
3. 確認模板、輸出與暫存策略。
4. 看懂長任務階段。
5. 成功後開啟筆記，失敗後知道下一步。

不要把 Flow Modal 做成 landing page、完整 settings page 或獨立 dashboard。

## 導入原則

1. 先做 Flow Modal，再做 Settings Tab。
2. 先調整資訊架構與 class scope，再補 CSS。
3. 使用 Obsidian CSS variables 作為底層，不覆寫全域 theme。
4. UI 只處理呈現、輸入、狀態與 action，不碰 runtime、file writing 或 orchestration。
5. 每一批改動都要能用 `smoke:desktop` 或手動 Obsidian 檢查驗證。

## Scope 與 Token

第一批實作應在 Flow Modal root 加上局部 scope：

```text
ai-summarizer-flow
```

若新增 CSS，所有 rule 都應掛在這個 scope 下。不要覆寫 `body`、`.modal`、`.setting-item`、`.theme-dark`、`.theme-light`。

建議 token mapping：

```css
.ai-summarizer-flow {
  --ais-bg: var(--background-primary);
  --ais-surface: var(--background-primary);
  --ais-surface-muted: var(--background-secondary);
  --ais-surface-elevated: var(--background-primary);

  --ais-border: var(--background-modifier-border);
  --ais-border-strong: var(--background-modifier-border-hover);

  --ais-text: var(--text-normal);
  --ais-text-muted: var(--text-muted);
  --ais-text-faint: var(--text-faint);

  --ais-accent: var(--interactive-accent);
  --ais-accent-hover: var(--interactive-accent-hover);
  --ais-on-accent: var(--text-on-accent);
  --ais-danger: var(--text-error);

  --ais-space-1: 4px;
  --ais-space-2: 8px;
  --ais-space-3: 12px;
  --ais-space-4: 16px;
  --ais-section-gap: var(--ais-space-4);
  --ais-inline-gap: var(--ais-space-2);

  --ais-radius-sm: 6px;
  --ais-radius-md: 8px;
  --ais-radius-pill: 999px;

  --ais-control-height: 34px;
  --ais-control-height-mobile: 44px;
  --ais-row-height: 36px;
  --ais-panel-padding: 14px;

  --ais-motion-fast: 120ms ease;
}
```

Token rules:

- 使用 `--ais-*`，不要在實作中引入外部 namespace。
- 優先映射 Obsidian variable，再補自訂 token。
- 狀態不可只靠顏色，必須搭配文字。
- Light/dark 都要驗收。

## Flow Modal Layout

採單頁分區，不先做完整 wizard：

```text
AI 摘要器 Modal
  Header
  Source Selector
  Source Input
  Preflight Summary
  Stage Status
  Warning / Result
  Action Row
```

建議寬度：

```css
.ai-summarizer-flow {
  width: min(760px, calc(100vw - 48px));
  max-width: 100%;
}
```

窄視窗規則：

- source selector 可換行。
- input row 改上下排列。
- button touch target 至少 44px。
- preflight chips、stage list、result actions 都可換行。
- 不依賴 hover 顯示關鍵操作。

## Design Principles

### Obsidian-Native First

- 使用 Obsidian theme variables。
- 保持 modal 與 settings form 的 Obsidian 語氣。
- 不讓 AI Summarizer 看起來像外部網頁嵌入。

### Source-Aware, Not Source-Noisy

- 四種來源要同時可見。
- active source 才顯示完整說明。
- 主畫面不塞滿 pipeline technical terms。
- `source-guidance.ts` 是來源 label、placeholder、hint、error hint 的主要來源。

### Status Before Explanation

- running 時顯示目前階段與階段列表。
- cancelling 是獨立狀態。
- warning、failed、completed 不混在同一行。
- failed result 要有下一步 action。

### Quiet Controls

- `開始摘要` 是 idle 時唯一 primary CTA。
- completed 時 `開啟筆記` 成為 primary CTA。
- 其他操作保持 secondary。
- danger 只用於失敗或破壞性操作。

### Compact But Legible

- 桌面控制高度約 32px 到 38px。
- modal 內標題保持緊湊，不做 hero-style。
- 長 URL、Windows path、template path 必須 wrap 或 truncate。

## Component Recipes

### Header

內容：

```text
AI 摘要器
選擇來源並建立 Obsidian 摘要筆記
```

規則：

- subtitle 可省略。
- 不在 header 解釋四種 pipeline。
- close button 使用 Obsidian modal 原生行為。

### Source Selector

取代 dropdown，讓來源一眼可見：

```text
網頁 URL | 媒體 URL | 本機媒體 | 逐字稿檔案
```

建議結構：

```html
<div class="ai-summarizer-source-tabs" role="tablist" aria-label="輸入來源">
  <button data-active="true">網頁 URL</button>
  <button>媒體 URL</button>
  <button>本機媒體</button>
  <button>逐字稿檔案</button>
</div>
```

規則：

- active state 明確但低調。
- label 保持短。
- keyboard focus 可見。
- 切換來源時清除不適用的 result / warning。

### Source Input

不同來源 action：

- `webpage_url`: `填入範例`
- `media_url`: `填入範例`
- `local_media`: `選擇檔案`
- `transcript_file`: `選擇檔案`

規則：

- input 佔主要寬度。
- action 固定最小寬度。
- 窄視窗時 button 可換到下一行。
- placeholder 是格式範例，不是完整規格。

### Preflight Summary

開始前用 compact metadata 顯示：

- note template
- output folder
- retention mode
- media dependency readiness
- provider/model，可視需要顯示

範例：

```text
[模板：自訂] [輸出：01 Input] [暫存：刪除] [媒體工具：可用]
```

規則：

- 使用 chip 或 compact metadata row。
- 不顯示與目前來源無關的資訊。
- artifact lifecycle 詳細內容放在 details。

### Details Disclosure

適合放：

- 支援格式與大小限制。
- retention artifact lifecycle。
- dependency diagnostics raw detail。
- provider/model technical info。

規則：

- 預設關閉。
- summary 使用使用者語意，例如「查看來源限制」。
- technical terms 可以放在 details，不要放主畫面。

### Stage List

建議階段：

```text
驗證輸入
取得內容
準備媒體
轉錄
摘要
寫入筆記
完成
```

來源差異：

- `webpage_url`: 不顯示媒體準備與轉錄。
- `transcript_file`: 不顯示取得媒體與轉錄。
- `media_url` / `local_media`: 顯示媒體準備與轉錄。

規則：

- current stage 使用 accent indicator。
- completed stage 使用 muted check 或文字。
- cancellation 顯示正在停止，不直接跳回 idle。

### Warning Area

- warning 與 failed result 分開。
- 多個 warning 用 compact list。
- warning 不應搶過 primary action。

### Result Panel

Completed：

```text
已建立摘要筆記
01 Input/GEM 3.md

[開啟筆記] [複製路徑] [再摘要一次]
```

Failed：

```text
媒體處理環境尚未準備完成
缺少 ffmpeg，音訊與影片轉錄目前無法使用。

[前往診斷] [重試] [改用逐字稿檔案]
```

Cancelled：

```text
已取消
若已產生 transcript.md，可改用逐字稿檔案重新摘要。

[改用逐字稿檔案] [關閉]
```

規則：

- result 不只是一行訊息。
- note path 可複製、可 wrap。
- failed panel 不直接貼 raw stack。

### Action Row

狀態規則：

- idle: `開始摘要` enabled, `取消` disabled。
- running: `摘要中...` disabled, `取消` enabled。
- cancelling: start/cancel disabled，顯示正在取消。
- completed: `開啟筆記` / `再摘要一次`。
- failed: `重試` / source-aware action。

規則：

- action row 位置固定。
- primary action 只有一個。
- disabled state 清楚。

## Settings Tab Guidance

Settings Tab 可以晚於 Flow Modal 處理。方向是 Obsidian-native form，不是 dashboard。

優先改善：

1. `AI 模型`、`輸出與媒體`、`筆記模板`、`診斷` 的 active state 與 spacing。
2. provider/model/API key 的目前使用中與管理清單語意。
3. retention mode、media cache root、ffmpeg/ffprobe 的高風險說明。
4. 診斷頁直接回答「現在能不能跑這個來源」。

診斷摘要應包含：

- overall state: 正常 / 需注意 / 異常
- per source capability: 網頁摘要、媒體 URL、本機媒體、逐字稿重跑摘要
- action: 重新檢查、自動填入 ffmpeg/ffprobe、選擇工具路徑

## Implementation Batches

### Batch 1：文件與 Class Scope

- 更新 `features/ui-design.md`。
- 建立 Flow Modal root class。
- 建立 styles scope 或 placeholder。
- 不改使用者流程。

### Batch 2：來源與輸入區

- dropdown -> segmented control。
- source guidance 文案縮短。
- input row 穩定寬度與換行。
- 長 path / URL 處理。

### Batch 3：Preflight 與狀態

- template、output folder、retention mode、dependency readiness 收斂成摘要。
- stage message 改成階段列表。
- cancellation 狀態獨立。

### Batch 4：結果 Action

- completed：開啟筆記、複製路徑、再跑一次。
- failed：重試、前往診斷、改用逐字稿檔案。
- cancelled：保留 recovery guidance。

### Batch 5：Settings Tab Polish

- 設定頁 tab 視覺穩定。
- 診斷摘要更行動導向。
- API/model 管理降低雜訊。

## Anti-Patterns

- 把 Flow Modal 拆成每頁只有一個欄位的 wizard。
- 每個資訊段落都包成 card。
- 主畫面出現大量 raw artifact path。
- 在 Flow Modal 內嵌完整 Settings Tab。
- 只用單行 `status | stage` 表達長任務。
- 所有 action 都用 primary button。
- 將 runtime 或 file writing 邏輯放進 UI。
