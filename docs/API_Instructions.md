# AI Summarizer - API 指令規範

最後更新：2026-05-05

本文件定義 AI Summarizer 的提示詞契約、AI 處理流程、provider 邊界與輸出格式。若規格變更，需同步更新 `src/domain/prompts.ts`、`src/services/ai/prompt-builder.ts` 與相關 orchestration 實作。

---

## AI 工作流程

### 媒體來源

```text
media_url / local_media
-> acquire media
-> transcribeMedia
-> normalizeMediaTranscriptionResult
-> optional cleanupTranscript
-> normalizeMediaTranscriptionResult
-> summarizeMediaWithChunking
-> normalizeMediaSummaryResult
-> writeMediaNote
```

### 逐字稿檔案來源

```text
transcript_file
-> read .md / .txt transcript
-> normalizeToTraditionalChinese
-> optional cleanupTranscript
-> normalizeMediaTranscriptionResult
-> summarizeMediaWithChunking
-> normalizeMediaSummaryResult
-> writeMediaNote
```

### 網頁來源

```text
webpage_url
-> extract webpage content and metadata
-> summarizeWebpage
-> normalizeWebpageSummaryResult
-> writeWebpageNote
```

媒體與逐字稿檔案可進入逐字稿校對 / 清理階段；網頁來源不產生逐字稿，也不執行逐字稿清理。

---

## 共用輸出規則

1. 所有 AI 可見輸出必須使用繁體中文。
2. 輸出不得包含 emoji 或圖示。
3. 不得附加前言、解釋、模型自述或與指定格式無關的內容。
4. AI 若需要補充或標示風險，使用固定註記格式：

| 情境 | 格式 |
|------|------|
| 需要補充說明 | `(AI補充：補充的內容)` |
| 發現可能有錯誤、過時或需查證的觀點 | `(AI註記：查證後的內容)` |

---

## 逐字稿產生指令 (Transcript Prompt)

逐字稿產生階段負責從音訊或影片內容產出可寫入 Obsidian 的逐字稿。

### 要求

1. 仔細聆聽音訊內容，保留語意完整，不要只寫摘要式短句。
2. 無論原始音訊是中文、英文、日文、韓文或其他語言，都直接以繁體中文輸出逐字稿。
3. 若原始音訊已經是中文，直接轉錄為繁體中文文字。
4. 每段逐字稿都必須包含時間軸，格式固定為 `{開始時間 - 結束時間}`。
5. 時間軸範例：`{0m8s - 0m13s} 內容文字`。
6. 如果可辨識不同發言者，可保留發言者標記。
7. 不要使用方括號 `[ ]` 作為時間標記，只使用大括號 `{ }`。
8. 只輸出逐字稿結果，不附加前言、解釋或模型自述。

---

## 逐字稿校對 / 清理指令 (Transcript Cleanup Prompt)

逐字稿校對 / 清理階段是摘要前的可選 AI 階段，用於降低 ASR 錯字、同音誤判、斷句不良、重複贅詞對摘要品質的影響。完整實作計畫見 [transcript-cleanup-plan.md](transcript-cleanup-plan.md)。

### 校對範圍

1. 只修正明顯錯字、ASR 同音誤判、標點、斷句、換行與重複贅詞。
2. 可整理中英日韓等語音轉寫後的繁體中文表述一致性。
3. 可修正發言者標記的基本格式，但不得憑空新增說話者身分。
4. 不補不存在的資訊。
5. 不把逐字稿改寫成摘要。
6. 不刪除會影響理解的原始內容。
7. 不因模型推測而改變專有名詞、數字、日期、引用、URL 或結論。

### 格式要求

1. 保留原始段落順序、發言脈絡與時間軸。
2. 時間軸格式必須維持 `{開始時間 - 結束時間}`。
3. 只輸出清理後逐字稿。
4. 若遇到不確定內容，保留原文或以 `(疑似：...)` 標記，不硬猜。

### 錯誤與 fallback

第一版預設採保守 fallback：

```text
cleanup success -> use cleaned transcript
cleanup failure -> warn and use normalized original transcript
```

若未來加入嚴格模式，才允許在 cleanup 失敗時中止流程。

### Artifact 原則

若啟用逐字稿校對 / 清理，第一版建議保留可追溯性：

- `transcript.raw.md`：轉錄 provider 的原始轉錄結果，僅做必要格式正規化。
- `transcript.md`：清理後逐字稿，供摘要與最終筆記使用。

---

## 媒體摘要指令 (Media Summary Prompt)

媒體摘要階段根據 metadata、逐字稿與正規化內容產出可直接寫入 Obsidian 的摘要。

### 核心要求

1. 摘要不可遺漏關鍵內容。
2. 主要議題、論點、數據、案例與可執行建議都必須完整呈現。
3. 不要過度簡化，需保留完整脈絡與閱讀流暢度。
4. 若內容包含業配、贊助商廣告、產品推銷、折扣碼推廣等商業推廣段落，直接忽略，不納入重點摘要。
5. 若有零碎但重要的觀念，可在最後以「其他說明」集中討論。

### 長媒體整合規則

1. 音訊或逐字稿的 chunk 只屬於內部 token control 或 diagnostics，不可成為摘要章節名稱或正文內容。
2. 最終摘要必須以合併後的完整逐字稿作為整體脈絡整理。
3. 即使內部因 token control 需要 partial summary，最後也必須再做一次全局整合摘要。
4. 最終輸出不得出現 `chunk`、`Chunk 1`、`Part 1`、`分段 1` 等技術分段字樣，除非原始內容本身真的在討論這些詞。

### 標題與 Markdown 規則

1. 從二級標題 `##` 開始編排，視內容結構依序向下。
2. 二級標題使用中文數字標號，例如 `## 一、標題內容`。
3. 三級標題使用阿拉伯數字標號，例如 `### 1. 標題內容`。
4. 四級標題使用括號數字，例如 `#### (1) 內容`。
5. 五級標題使用英文標號，例如 `##### a. 內容`。
6. 標題與下方段落之間不需要空一行。
7. 無順序性的內容使用無序列表；有順序性的內容才使用有序列表。
8. 可使用 Markdown 粗體或斜體強調重點，但標題本身不需要使用粗體或斜體。

### Metadata 輸出

摘要正文前必須先輸出一段 YAML metadata block，且只包含：

- `Book`
- `Author`
- `Description`

輸出順序固定為：

```text
YAML metadata block
summary markdown
```

---

## 網頁摘要指令 (Webpage Summary Prompt)

網頁摘要階段根據 metadata 與網頁正文產出重點摘要，不產生逐字稿。

### 核心要求

1. 網頁來源只輸出重點摘要，不輸出逐字稿或逐段時間軸。
2. 摘要規則沿用「媒體摘要指令」中的完整性、標題、Markdown、metadata 與 AI 註記要求。
3. 若文章內容明顯中斷，或僅能讀取公開片段，請在摘要開頭加入：

```text
(AI註記：本文可能包含付費內容或無法完整讀取，以下摘要僅基於公開可見部分)
```

4. 若文章中有明確引用的數據、報告或來源，摘要中應盡量保留來源說明。
5. 若內容包含業配、贊助商廣告、產品推銷、折扣碼推廣等商業推廣段落，直接忽略，不納入重點摘要。

---

## 大型媒體轉錄 Strategy

目前 Gemini 轉錄路徑：

```text
single ai-upload artifact -> Gemini generateContent inline_data -> transcript markdown
multiple ai-upload chunks -> per-chunk Gemini generateContent inline_data -> merge transcript markdown
```

保留為 vNext 可選 strategy 的 Gemini Files API 路徑：

```text
compressed audio -> Gemini file upload -> wait processing -> generate transcript
```

### 規則

1. `inline_data` 符合目前 `TranscriptionProvider` contract，取消與測試流程較單純。
2. 單一 `ai-upload` artifact 可維持單次 Gemini inline request。
3. 多個 `ai-upload` chunk 不得一次塞進同一個 Gemini inline request；需逐 chunk 呼叫 Gemini，再依 chunk 順序合併 transcript。
4. 逐 chunk inline 需保留 chunk-level diagnostics、partial transcript recovery 與單段重試邊界。
5. Gemini Files API strategy 必須實作在 `TranscriptionProvider` 內，不得讓 summary provider 或 note writer 直接知道 Gemini file handle。
6. Files API strategy 必須支援 cancellation；若 API 支援刪除 remote file，需納入 cleanup。
7. 不同 transcription strategy 都必須輸出相同的 `MediaTranscriptionResult`，後續 `summarizeMediaWithChunking`、`normalizeMediaSummaryResult` 與 `NoteWriter` 不應分支。
8. diagnostics 需區分 inline chunk failure、upload failure、remote processing timeout、remote processing failed、transcript empty output。
9. 成本與大小策略由 `media-acquisition-spec.md` 的 AI-ready artifact 控制；file upload 只改變傳輸方式，不改變 prompt contract。

---

## Provider 邊界與錯誤回報

### 通用規則

1. 新安裝預設轉錄模型使用 `gemini-3-flash-preview`。
2. 若 Gemini、Gladia、OpenRouter 或 Mistral 回傳錯誤，流程直接呈現原 provider 的錯誤原因，不自動換 provider 或模型重跑。
3. 轉錄成功但摘要失敗時，流程保留 recovery transcript，方便使用者之後手動重跑摘要。
4. API key、模型不存在、容量不足、空輸出、安全阻擋、音訊不可讀等錯誤都應忠實回報為當下 provider 的 `ai_failure`。
5. 逐字稿校對 / 清理若啟用，預設失敗時 fallback 到原始正規化逐字稿並記錄 warning。

### Gladia 轉錄 Provider

Gladia 只作為 `TranscriptionProvider`，不作為摘要 provider。摘要仍由 `summaryProvider` 處理逐字稿文字。

1. Gladia 使用官方 v2 pre-recorded 流程：`POST /v2/upload` 上傳 AI-ready artifact，`POST /v2/pre-recorded` 建立 job，`GET /v2/pre-recorded/{id}` 輪詢結果。
2. Gladia API key 獨立保存為 `gladiaApiKey`，透過 `x-gladia-key` header 傳送；debug log 不得記錄 API key。
3. Gladia 第一版 `transcriptionModel` 使用 `default` 佔位，實際請求不傳模型 id；模型欄位只用於 provider/model catalog 與 UI 一致性。
4. Gladia job 完成後，優先把 `result.transcription.utterances` 正規化為 transcript segments；若沒有 utterances，才使用 `full_transcript` 形成單段逐字稿。
5. diagnostics 需區分 upload failure、job creation failure、polling timeout、job failed、empty transcript output，並保留 HTTP status、provider error payload excerpt、job id、request id 與 polling status。

---

## 技術實作位置

- **提示詞規約常數**: `src/domain/prompts.ts` (`PROMPT_CONTRACT`)
- **摘要提示詞組裝**: `src/services/ai/prompt-builder.ts` (`buildMediaSummaryPrompt`、`buildWebpageSummaryPrompt`)
- **逐字稿提示詞組裝**: `src/services/ai/prompt-builder.ts` (`buildTranscriptPrompt`)
- **逐字稿校對 / 清理提示詞組裝**: `src/services/ai/prompt-builder.ts` (`buildTranscriptCleanupPrompt`)
- **AI 輸出契約正規化**: `src/services/ai/ai-output-normalizer.ts`
- **media orchestration**: `src/orchestration/process-media.ts`
- **transcript_file orchestration**: `src/orchestration/process-transcript-file.ts`
- **webpage orchestration**: `src/orchestration/process-webpage.ts`
- **逐字稿校對 / 清理計畫**: `docs/transcript-cleanup-plan.md`

完整來源路由、模型選擇與 Obsidian 寫入流程請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。

---

## 版本歷程

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| v1.24 | 2026-05-05 | 統整 API 指令規範，納入逐字稿校對 / 清理契約、流程位置、artifact 原則與 fallback 策略 |
| v1.23 | 2026-02-03 | 新增 H5 標題、無序列表、粗體/斜體強調、標題後不空行、「其他說明」 |
| v1.22 | 2026-02-03 | 明確定義標號規則（一、/ 1. / (1)），保留流暢度 |
| v1.21 | 2026-02-03 | 標題層級允許 H3/H4，強化結構化呈現與編號 |
| v1.2 | 2026-02-03 | 新增完整性要求、純文字輸出、AI 註記格式、H2 標題層級 |
