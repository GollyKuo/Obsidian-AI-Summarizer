# Transcript Cleanup Plan

最後更新：2026-05-05

## 目標

在轉錄完成、摘要開始前，新增一個可選的「逐字稿校對 / 清理」階段，降低 ASR 錯字、同音誤判、斷句不良、重複贅詞對摘要品質的影響。

第一版目標不是重寫逐字稿，而是做最小必要修正，並保留可追溯性。

## 範圍

### 應修正

- 明顯錯字與 ASR 同音誤判。
- 標點、斷句、換行與段落可讀性。
- 明顯重複的口頭贅詞或連續重複片段。
- 中英日韓等語音轉寫後的繁體中文表述一致性。
- 發言者標記的基本一致性，但不憑空新增說話者身分。

### 不應修正

- 不補不存在的資訊。
- 不把逐字稿改寫成摘要。
- 不刪除會影響理解的原始內容。
- 不因模型推測而改變專有名詞、數字、日期、引用或結論。
- 不硬猜聽不清楚或語意不確定的內容。

### 不確定內容

遇到不確定內容時，第一版採保守策略：

- 若原文仍可理解，保留原文。
- 若可提出低風險註記，使用 `(疑似：...)`。
- 若涉及數字、姓名、地名、產品名、URL 或引用，除非上下文高度明確，否則不改。

## 建議流程

媒體來源：

```text
acquire media
-> transcribeMedia
-> normalizeMediaTranscriptionResult
-> optional cleanupTranscript
-> normalizeMediaTranscriptionResult
-> summarizeMediaWithChunking
-> normalizeMediaSummaryResult
-> writeMediaNote
```

逐字稿檔案來源：

```text
read transcript file
-> normalizeToTraditionalChinese
-> optional cleanupTranscript
-> normalizeMediaTranscriptionResult
-> summarizeMediaWithChunking
-> normalizeMediaSummaryResult
-> writeMediaNote
```

## 設定

第一版建議新增下列設定：

- `enableTranscriptCleanup`: 是否啟用逐字稿校對 / 清理。
- `transcriptCleanupFailureMode`: 清理失敗時的處理方式。

建議預設：

- `enableTranscriptCleanup = false`
- `transcriptCleanupFailureMode = "fallback_to_original"`

原因：

- 這是 AI 會改動逐字稿內容的新階段，預設關閉較保守。
- 清理失敗不應讓既有摘要流程無法使用。
- 使用者可先針對長媒體或轉錄品質差的來源手動啟用。

第一版先共用既有 `summaryProvider` / `summaryModel`，不新增獨立 cleanup model 設定。待品質與成本穩定後，再評估是否拆出 `transcriptCleanupProvider` / `transcriptCleanupModel`。

## Prompt Contract

新增 `transcriptCleanupPrompt`，要求模型：

- 只做逐字稿校對、清理與最小必要修正。
- 保留原始時間軸與段落順序。
- 保留 `{開始時間 - 結束時間}` 格式。
- 只輸出清理後逐字稿，不輸出摘要、前言、解釋或模型自述。
- 不使用 emoji 或圖示。
- 輸出繁體中文。
- 對不確定內容採保守處理。

輸入建議：

```markdown
## Metadata
title:
creatorOrAuthor:
platform:
source:
created:

## Transcript
{0m8s - 0m13s} 原始逐字稿內容
```

輸出建議：

```markdown
{0m8s - 0m13s} 清理後逐字稿內容
```

## API / Provider 設計

建議新增介面：

```ts
interface TranscriptCleanupProvider {
  cleanupTranscript(
    input: TranscriptCleanupInput,
    signal: AbortSignal
  ): Promise<MediaTranscriptionResult>;
}
```

第一版也可以先把方法放在既有 `SummaryProvider`，但長期較建議獨立介面，避免「摘要 provider」同時承擔逐字稿校對語意。

建議資料型別：

```ts
interface TranscriptCleanupInput {
  metadata: SourceMetadata;
  transcript: TranscriptSegment[];
  transcriptMarkdown: string;
  cleanupProvider: SummaryProviderKind;
  cleanupModel: string;
}
```

## Artifact 與可追溯性

建議保留兩份逐字稿：

- `transcript.raw.md`: 轉錄 provider 的原始轉錄結果，僅做必要格式正規化。
- `transcript.md`: 清理後逐字稿，供摘要與最終筆記使用。

若 cleanup disabled：

- 可只產生既有 `transcript.md`。
- 或產生 `transcript.raw.md` 並讓 `transcript.md` 與 raw 內容相同，取決於 artifact retention 政策。

若 cleanup failed 且 fallback：

- `transcript.md` 使用原始正規化轉錄。
- warnings 記錄 cleanup failure 與 fallback。

## 流程插入點

### `process-media.ts`

位置：

- `normalizeMediaTranscriptionResult(transcriptionRaw)` 之後。
- `writeTranscriptArtifacts(...)` 與 `summarizeMediaWithChunking(...)` 之前。

原因：

- 清理應使用已正規化的時間標記與繁中內容。
- 清理後的 transcript 應同時影響 artifact、摘要與筆記輸出。

### `process-transcript-file.ts`

位置：

- `readTranscriptFile(...)` 之後。
- `summarizeMediaWithChunking(...)` 之前。

原因：

- 使用者以逐字稿檔案重跑摘要時，應能使用同一套清理能力。
- 這也能讓 recovery transcript 之後再摘要時補上清理階段。

## 錯誤策略

第一版建議採 fallback：

```text
cleanup success -> use cleaned transcript
cleanup failure -> warn and use normalized original transcript
```

後續可加嚴格模式：

```text
cleanup failure -> stop flow with ai_failure
```

錯誤分類建議：

- `ai_failure`: provider 回傳錯誤、空輸出、安全阻擋。
- `validation_error`: cleanup output 破壞時間軸或輸出空逐字稿。
- `cancellation`: 使用者取消。

## 測試計畫

### Unit Tests

- cleanup disabled 時不呼叫 cleanup provider。
- cleanup enabled 時摘要使用 cleaned transcript。
- cleanup 成功後 transcript markdown 與 segments 都維持繁體中文。
- cleanup output 若含 `[]` 時會再被正規化為 `{}`。
- cleanup 失敗且 fallback 時摘要使用原始正規化 transcript，並產生 warning。
- cleanup output 空內容或破壞時間軸時 fallback 或報錯符合設定。

### Integration Tests

- media flow: `transcribe -> cleanup -> summarize -> write note`。
- transcript file flow: `read file -> cleanup -> summarize -> write note`。
- cleanup disabled regression: 既有流程結果不變。

### Regression Tests

- 長媒體 chunking 不得把 `chunk`、`part`、`分段` 等內部技術字樣帶進最終摘要。
- 清理階段不得把逐字稿改寫成摘要。
- 清理階段不得移除時間軸。
- 清理階段不得破壞 `transcript.md` / `subtitles.srt` handoff。

## 第一版 Done When

- `docs/API_Instructions.md` 已定義 Transcript Cleanup Prompt 契約。
- `PROMPT_CONTRACT` 支援 `transcriptCleanupPrompt`。
- provider 層有 cleanup transcript 方法或獨立 cleanup provider 介面。
- media flow 與 transcript_file flow 可在摘要前選擇性執行 cleanup。
- cleanup disabled 時完全維持既有行為。
- cleanup failure fallback 有 warnings 與測試覆蓋。
- 原始與清理後逐字稿的 artifact 策略已明確。

## 後續決策

- 是否預設啟用 cleanup。
- 是否拆獨立 cleanup provider/model 設定。
- 是否要求模型輸出 JSON segments，再由程式重建 markdown，提升時間軸穩定性。
- 是否在 UI 顯示「逐字稿已清理」與 fallback 狀態。
- 是否提供 raw transcript / cleaned transcript 的筆記輸出選項。
