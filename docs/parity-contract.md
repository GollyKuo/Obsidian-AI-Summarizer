# Parity Contract

## 目的

本文件定義 `Media Summarizer` 從 Python app 遷移到 Obsidian plugin 時，必須保留的產品行為。

## 來源類型

第一版架構必須保留以下三種輸入類型：

1. `media URL`
2. `webpage URL`
3. `local media`

## 輸出型態

- 網頁
  - 產出摘要筆記
- 媒體
  - 產出摘要筆記
  - 視情況產出逐字稿內容或獨立 transcript 區段

## metadata 契約

必須保留以下 metadata 語意：

1. `Title`
2. `Creator` 或 `Author`
3. `Platform`
4. `Source`
5. `Created`

## 筆記輸出契約

以下行為不得隨意改寫：

1. 維持結構化 Markdown 輸出
2. 維持 frontmatter keys 的語意一致
3. 媒體與網頁輸出可有不同區段，但都必須維持穩定格式
4. 檔名需經過 sanitization
5. 路徑撞名時需自動避開覆蓋

## Prompt 契約

第一版至少要保留：

1. 繁體中文輸出
2. 結構化摘要
3. 與現行 app 風格一致的標題與段落節奏
4. 必要時保留 AI 生成註記

## Settings 契約

plugin settings 至少需要：

1. API key
2. model selection
3. output folder
4. template reference
5. retention mode
6. debug mode
7. 最後使用的來源類型或合理預設值

## Cancellation 契約

取消流程不是例外處理的副產品，而是正式能力。

必須保留：

1. 使用者可主動取消
2. 長時間步驟需檢查 cancellation
3. 取消後 UI 狀態回到可預期狀態
4. 取消不得顯示為一般失敗

## Retention 契約

即使 runtime 改變，仍要保留以下使用者意圖：

1. 不保留來源檔案
2. 保留來源檔案
3. 保留更多中間產物（例如視訊 + 音訊）

## Runtime-Dependent 區域

以下能力若不能在 plugin 內原生實作，必須標記為 `runtime-dependent`，不可直接視為刪除：

1. 媒體下載
2. 音訊正規化 / ffmpeg
3. 語音轉文字或上傳處理
4. 字幕嵌入
5. 某些進階網頁擷取能力

## 第一版產品範圍建議

架構先以以下順序落地：

1. settings persistence
2. prompt assets
3. note writer
4. webpage flow
5. placeholder runtime
6. media URL flow
7. local media flow
