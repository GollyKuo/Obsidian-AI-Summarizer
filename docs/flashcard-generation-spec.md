# Flashcard Generation Spec 閃卡生成規格

狀態：marker-only placeholder

## 目的

本文件保留未來 `CAP-509 Flashcard Generation` 的詳細規格位置。

目標能力：

- 在摘要內容成功寫入 Obsidian 後，可選擇再由 AI 產生閃卡資訊。
- Flow Modal 先保留 `加入 Flashcard 標記` 選項，實際生成規則後續補上。

## 待定規則

- 閃卡題型。
- 每份摘要的預設張數與上限。
- 問題、答案、補充說明與來源引用格式。
- 是否支援 cloze deletion。
- 是否支援難度、標籤、章節或主題分組。
- 與摘要筆記的輸出關係：同檔區塊、附檔、或獨立筆記。
- 與 Obsidian spaced repetition / Anki 類工具的相容格式。
- AI prompt contract 與品質檢查規則。
- 失敗、重試與 partial output 策略。

## Flow Modal 接口

目前預留介面：

- `執行前摘要` 顯示 `加入 Flashcard 標記` checkbox。
- 預設值來自 plugin settings。
- 使用者在 Flow Modal 中變更後會自動記憶為下次預設。
- 目前不改變摘要流程，也不產生閃卡內容。
- 開啟時只會在 note frontmatter 的 `tags` placeholder 加入 `Flashcard`，作為未來閃卡流程的標記。

## 目前輸出契約

- `generateFlashcards: false`：不新增 `Flashcard` tag。
- `generateFlashcards: true`：只新增 `Flashcard` tag。
- 不呼叫額外 AI provider。
- 不新增閃卡區塊、附檔或獨立筆記。

## 實作待辦

- 定義 domain request / result 型別。
- 定義 flashcard prompt builder。
- 定義 note writer 對閃卡輸出的寫入策略。
- 定義 setting migration 與 UI 文案。
- 補測試矩陣與 smoke checklist。
