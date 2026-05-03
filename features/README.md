# AI Summarizer Minimal UI Guide

這個資料夾記錄 AI Summarizer 專案可採用的 minimal UI 設計規格。它已從原本的通用 theme extract 改寫成本專案專用內容，重點是 Obsidian plugin 內的 `AI 摘要器` Flow Modal、Settings Tab、診斷與長任務狀態呈現。

本文件包不是一組已實作的 CSS，也不是要求整個 Obsidian 套用新 theme。它是設計契約：當後續要重構 `src/ui/flow-modal/SummarizerFlowModal.ts`、`src/ui/settings-tab.ts` 或新增 `styles.css` 時，應以這裡的原則、token 與元件 recipe 為準。

## 專案 UI 目標

AI Summarizer 的 UI 是 operational interface，不是 landing page。使用者開啟 modal 後通常只想完成以下任務：

1. 選擇輸入來源。
2. 貼上 URL 或選擇本機檔案。
3. 確認摘要會使用的模板、輸出位置與媒體暫存策略。
4. 看懂長任務目前在哪個階段。
5. 成功後開啟筆記，失敗後知道下一步該做什麼。

因此介面應該安靜、緊湊、清楚、有狀態感。不要把 Flow Modal 做成設定頁、行銷頁或大型卡片展示。

## 主要適用範圍

- `AI 摘要器` Flow Modal
  - 來源選擇
  - 來源輸入
  - 執行前摘要
  - 進度與取消
  - 成功、失敗、取消結果
- Settings Tab
  - AI 模型
  - 輸出與媒體
  - 筆記模板
  - 診斷
- 共用 UI 文案與狀態
  - `src/ui/source-guidance.ts`
  - `ErrorCategory`
  - runtime diagnostics summary
  - artifact retention 語意

## 不適用範圍

- 不定義 AI provider、runtime、note writer 或 media pipeline 的業務邏輯。
- 不改變 `architecture-boundary.md` 的依賴方向。
- 不要求把 Obsidian 全域 theme 改掉。
- 不要求從 `Setting` API 一次改成 React component tree。
- 不把 `.mt-shell` 或任何外部專案 class 原樣套進本專案。

## 設計關鍵字

推薦：

- Obsidian-native
- quiet
- compact
- source-aware
- status-first
- action-oriented
- readable
- scoped

避免：

- marketing-like
- card-heavy
- oversized
- gradient-heavy
- hover-only
- debug-form-only
- global CSS override

## 文件結構

1. [ui-design.md](ui-design.md)
   - UI 決策入口，記錄 Flow Modal、Settings Tab、source guidance 與目前採用結論。
2. [implementation-guide.md](implementation-guide.md)
   - 實作指南，合併設計原則、token、元件 recipe、layout pattern 與導入批次。
3. [visual-qa-checklist.md](visual-qa-checklist.md)
   - UI 重構後的手動驗收清單。
4. [README.md](README.md)
   - 本文件，作為 `features/` 導覽。

## 最小導入方向

如果後續要開始實作，最小導入不應先建立完整 design system，而是：

1. 先依 [ui-design.md](ui-design.md) 確認本次要採用的 UI 決策。
2. 依 [implementation-guide.md](implementation-guide.md) 的 batch 順序導入。
3. 用 [visual-qa-checklist.md](visual-qa-checklist.md) 驗收 dark/light、長路徑、狀態與錯誤 action。

## 建議 CSS Scope

未來若新增 CSS，應以 plugin 局部 scope 為準：

```css
.ai-summarizer-flow {
  --ais-surface: var(--background-primary);
  --ais-surface-muted: var(--background-secondary);
  --ais-border: var(--background-modifier-border);
  --ais-text: var(--text-normal);
  --ais-text-muted: var(--text-muted);
  --ais-accent: var(--interactive-accent);
}

.ai-summarizer-flow * {
  box-sizing: border-box;
}
```

不要使用全域 reset，不要覆寫 `body`、`.theme-dark`、`.modal` 或所有 `.setting-item`，除非該 rule 有更窄的 AI Summarizer scope。

## 與現有文件的關係

- UI 總決策集中在 [ui-design.md](ui-design.md)。
- 媒體 artifact lifecycle 仍以 [../docs/media-acquisition-spec.md](../docs/media-acquisition-spec.md) 為準。
- UI 不得跨越 [../docs/architecture-boundary.md](../docs/architecture-boundary.md) 定義的 runtime / orchestration 邊界。
- 使用者可見流程改動後，需同步 [../docs/Manual.md](../docs/Manual.md)。

## 成功標準

一個符合本 guide 的 AI Summarizer UI 應該：

- 第一眼能分辨目前選的是哪種來源。
- 不需要理解 runtime 細節也能知道下一步怎麼做。
- 長任務期間能看出目前階段與取消狀態。
- 成功後能直接開啟或定位筆記。
- 失敗後能依錯誤類型提供可行建議。
- 在 Obsidian dark/light theme 下都可長時間閱讀。
- 沒有把專案外的 theme class 或全域樣式污染帶進來。
