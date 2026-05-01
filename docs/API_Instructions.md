# AI Summarizer - API 指令規範

> 本文件記錄所有關於利用 Gemini API 整理媒體內容的要求及指令。
> 如有任何變更，請同步更新此檔案。

---

## 摘要產生指令 (Summary Prompt)

### 核心要求

1. **完整性**
   - 絕對不可遺漏任何內容
   - 所有關鍵細節、主要議題、論點、數據、案例以及任何可執行的建議都必須完整呈現

2. **標題層級與標號規則**
   - 從二級標題（##）開始編排，視結構內容需求依序向下
   - **二級標題 (##)**：使用中文數字標號（例如「一、標題內容」）
   - **三級標題 (###)**：使用阿拉伯數字標號（例如「1. 標題內容」）
   - **四級標題 (####)**：使用括號數字（例如「(1) 內容」）
   - **五級標題 (#####)**：使用英文標號（例如「a. 內容」）
   - 標題與下方段落之間不需要空一行

3. **列表使用**
   - 如果內文整理沒有順序性，可使用無序列表（-），不強制使用有序列表
   - 有順序性的內容才使用有序列表

4. **強調重點**
   - 可靈活使用 Markdown 語法的**粗體**或*斜體*來強調內容重點
   - 標題本身不需要使用粗體或斜體

5. **閱讀體驗**
   - 不要過度簡化，保持文章的流暢度
   - 對於冗長的內容，請提供重點整理但保留完整脈絡

6. **其他說明**
   - 如果有較為零碎或獨立的觀念，請在最後以獨立段落「其他說明」集中討論

7. **純文字輸出**
   - 產出的文字中絕對不可以包含任何表情符號（emoji）或圖示
   - 只使用純文字

8. **語言**
   - 無論原始語言為何，請務必以「繁體中文 (Traditional Chinese)」撰寫

9. **業配與廣告過濾** (V1.7 新增)
   - 若內容中包含業配、贊助商廣告、產品推銷、折扣碼推廣等商業推廣段落，請直接忽略，不納入重點摘要中

10. **長媒體摘要整合**
   - 音訊或逐字稿的 chunk 只屬於內部處理技術，不可成為摘要輸出的章節名稱或內容標記
   - 最終摘要必須以合併後的完整逐字稿作為整體脈絡來整理
   - 即使內部因 token control 需要 partial summary，最後也必須再做一次全局整合摘要
   - 最終輸出不得出現 `chunk`、`Chunk 1`、`Part 1`、`分段 1` 等技術分段字樣，除非原始內容本身真的在討論這些詞

---

## AI 註記格式

在整理完成後，AI 應自行驗證內容，並在適當位置加入註記：

| 情境 | 格式 |
|------|------|
| 需要補充說明 | `(AI補充：補充的內容)` |
| 發現可能有錯誤或過時的觀點 | `(AI註記：查證後的內容)` |

---

## 逐字稿產生指令 (Transcript Prompt)

### 要求

1. 仔細聆聽音訊內容
2. 無論原始音訊是什麼語言（中文、英文、日文、韓文等），請直接以繁體中文輸出逐字稿
3. 如果原始音訊已經是中文，請直接轉錄為繁體中文文字
4. 時間軸格式請使用 `{開始時間 - 結束時間}` 的形式
   - 例如：`{0m8s - 0m13s} 內容文字`
5. 如果可能，請辨識不同的發言者
6. 不要使用方括號 `[ ]`，只使用大括號 `{ }`

---

## 大型媒體轉錄 Strategy 評估

目前新版 Gemini 預設轉錄路徑是：

```text
single ai-upload artifact -> Gemini generateContent inline_data -> transcript markdown
multiple ai-upload chunks -> per-chunk Gemini generateContent inline_data -> merge transcript markdown
```

舊版使用 Gemini file upload：

```text
compressed audio -> Gemini file upload -> wait processing -> generate transcript
```

評估結論：

1. v1 預設維持 `inline_data`，因為它符合目前 `TranscriptionProvider` 的最小 contract，測試與取消流程較單純。
2. 單一 `ai-upload` artifact 可維持單次 Gemini inline request。
3. 多個 `ai-upload` chunk 不得一次塞進同一個 Gemini inline request；需逐 chunk 呼叫 Gemini，再依 chunk 順序合併 transcript。
4. 逐 chunk inline 需保留 chunk-level diagnostics、partial transcript recovery 與單段重試邊界，避免單段失敗導致整份長媒體轉錄結果全部丟失。
5. Gemini file upload 應保留為 vNext 可選 transcription strategy，適合超長媒體、單一 chunk 仍過大、或 inline 穩定性不足的情境。
6. file upload strategy 必須實作在 `TranscriptionProvider` 內，不得讓 summary provider 或 note writer 直接知道 Gemini file handle。
7. file upload 必須支援 cancellation：取消時不可繼續等待 remote processing；若 API 支援刪除 remote file，需納入 cleanup。
8. file upload 必須輸出與 inline strategy 相同的 `MediaTranscriptionResult`，後續 `summarizeMediaWithChunking`、`normalizeMediaSummaryResult` 與 `NoteWriter` 不應分支。
9. diagnostics 需區分 inline chunk failure、upload failure、remote processing timeout、remote processing failed、transcript empty output。
10. 成本與大小策略由 `media-acquisition-spec.md` 的 AI-ready artifact 控制；file upload 只改變傳輸方式，不改變 prompt contract。

暫不直接落地 file upload 的原因：

1. v1 可先用逐 chunk inline 解決多 chunk 單 request 的 payload、timeout 與整批重試風險，改動較小且與現有 Gemini inline provider 相容。
2. file upload 涉及遠端檔案生命週期與額外 cleanup，需先有明確 privacy / retention policy。
3. 若 provider 不支援 file upload，仍需保留 inline strategy 作為可測 baseline。

---

## AI Provider 錯誤回報原則

實機觀察：`gemini-2.5-flash` 在媒體轉錄時可能回傳 HTTP 503 high demand，但同一份 AI-ready artifact 改用 `gemini-3-flash-preview` 可成功。

目前規則：

1. 新安裝預設轉錄模型使用 `gemini-3-flash-preview`。
2. 若 Gemini、Gladia 或 OpenRouter 回傳錯誤，流程會直接呈現原 provider 的錯誤原因，不自動換 provider 或模型重跑。
3. 轉錄成功但摘要失敗時，流程會保留 recovery transcript，方便使用者之後手動重跑摘要。
4. API key、模型不存在、容量不足、空輸出、安全阻擋、音訊不可讀等錯誤都應忠實回報為當下 provider 的 `ai_failure`。

---

## Gladia 轉錄 Provider

Gladia 只作為 `TranscriptionProvider`，不作為摘要 provider。摘要仍由 `summaryProvider` 處理既有逐字稿文字。

目前規則：

1. Gladia 使用官方 v2 pre-recorded 流程：`POST /v2/upload` 上傳 AI-ready artifact，`POST /v2/pre-recorded` 建立 job，`GET /v2/pre-recorded/{id}` 輪詢結果。
2. Gladia API key 獨立保存為 `gladiaApiKey`，透過 `x-gladia-key` header 傳送；debug log 不得記錄 API key。
3. Gladia 第一版 `transcriptionModel` 使用 `default` 佔位，實際請求不傳模型 id；模型欄位只用於既有 provider/model catalog 與 UI 一致性。
4. Gladia job 完成後，優先把 `result.transcription.utterances` 正規化為 transcript segments；若沒有 utterances，才使用 `full_transcript` 形成單段逐字稿。
5. diagnostics 需區分 upload failure、job creation failure、polling timeout、job failed、empty transcript output，並保留 HTTP status、provider error payload excerpt、job id、request id 與 polling status。

---

## 版本歷程

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| v1.23 | 2026-02-03 | 新增 H5 標題、無序列表、粗體/斜體強調、標題後不空行、「其他說明」 |
| v1.22 | 2026-02-03 | 明確定義標號規則（一、/ 1. / (1)），保留流暢度 |
| v1.21 | 2026-02-03 | 標題層級允許 H3/H4，強化結構化呈現與編號 |
| v1.2 | 2026-02-03 | 新增完整性要求、純文字輸出、AI 註記格式、H2 標題層級 |

---

## 技術實作位置

- **提示詞規約常數**: `src/domain/prompts.ts` (`PROMPT_CONTRACT`)
- **摘要提示詞組裝**: `src/services/ai/prompt-builder.ts` (`buildMediaSummaryPrompt`、`buildWebpageSummaryPrompt`)
- **逐字稿提示詞組裝**: `src/services/ai/prompt-builder.ts` (`buildTranscriptPrompt`)
- **AI 輸出契約正規化**: `src/services/ai/ai-output-normalizer.ts`
  - media / webpage 共用輸出規則（H2 起始、emoji 過濾、heading 空行收斂）
  - transcript 時間標記格式正規化（`[]` 轉 `{}`）
- **映射入口（media）**: `src/orchestration/process-media.ts`
- **映射入口（webpage）**: `src/orchestration/process-webpage.ts`
- **本檔定位**: 本文件為提示詞規範來源，若規範變更，需同步更新上述 TypeScript 實作

完整的來源路由、轉錄模型、摘要模型與 Obsidian 寫入流程請看 [Architecture Boundary: AI 工作流程](architecture-boundary.md#ai-工作流程)。本文件只定義提示詞與 AI 輸出格式。

---

## 網頁文章摘要 (V1.6 新增)

### 1. 內容完整性檢查
- 若發現文章內容明顯中斷（例如只有第一段，後續為「訂閱閱讀全文」），請在摘要開頭加入以下警語：
  > ⚠️ (AI 註記：本文可能包含付費內容或無法完整讀取，以下摘要僅基於公開可見部分)

### 2. 資料來源引用
- 若文章中有明確引用的數據或報告，請盡量在摘要中保留其來源說明。

### 3. AI 註記
- 網頁來源同樣適用「AI 註記格式」，可在摘要內容中加入 `(AI補充：...)` 或 `(AI註記：...)` 進行補充說明與查證。

### 4. 輸出結構
- 網頁文章**不需要逐字稿**，僅輸出「重點摘要」區塊。

