# Media Summarizer Obsidian Plugin 重構步驟

日期：2026-04-21

本文件是將 `Media Summarizer` 重構為 Obsidian plugin 的執行手冊。
它是寫給 Codex 逐步照做的。

目前故意不先限定最終的執行方式。
因此，重構時必須優先保留目前產品架構與使用者可見行為，再把依賴執行環境的部分抽成清楚的介面。

## 1. 核心產品精神

在開始撰寫任何 plugin 程式碼之前，Codex 必須保留以下專案核心目標：

1. 這個專案不只是下載器，也不只是摘要器。它是一條把媒體或網頁內容轉成結構化 Obsidian 筆記的 intake pipeline。
2. 最終輸出比傳輸方式更重要。除非後續明確要改，plugin 必須保留目前的 Markdown、frontmatter、章節結構與 AI 撰寫風格。
3. 目前 app 支援多種內容來源：
   - 媒體 URL
   - 本機媒體檔
   - 網頁文章
4. 目前 app 的主流程如下：
   - 取得內容
   - 萃取或正規化內容
   - 在需要時產生逐字稿
   - 產生摘要
   - 以一致的筆記格式存入 Obsidian
5. Plugin 必須保留職責分離。不要把所有邏輯都塞進 `main.ts`。
6. 與執行環境綁定的操作必須抽象化：
   - 媒體下載
   - 音訊抽取 / ffmpeg
   - 語音轉文字 / 檔案上傳
   - 網頁正文擷取
7. 設定與 prompts 屬於產品行為的一部分，不是附帶實作細節。

## 2. 不可妥協的功能對等目標

Codex 必須把以下項目視為第一版 plugin 的對等需求：

1. 保留目前的來源類型：
   - YouTube / podcast URL
   - 網頁 URL
   - 本機媒體輸入
2. 保留目前的輸出類型：
   - 網頁為摘要筆記
   - 媒體為摘要 + 逐字稿筆記
3. 保留目前的 metadata 語意：
   - `Title`
   - `Creator` 或 `Author`
   - `Platform`
   - `Source`
   - `Created`
4. 保留模板支援。
5. 保留模型選擇設定。
6. 保留保留檔案策略的意圖，即使最終實作方式不同。
7. 保留可取消的工作流程。
8. 盡可能保留目前 AI prompt 行為。

## 3. 目前 Python 架構中必須保留的部分

Codex 必須把目前 Python 專案映射成 plugin 模組，而不是隨意重寫行為。

目前模組責任如下：

- `gui_app.py`
  - app 入口
  - 設定 UI
  - 使用者操作
  - 處理流程編排
  - 取消與狀態更新
- `src/downloader.py`
  - 媒體取得
  - 依 URL 類型處理下載
  - 下載恢復行為
- `src/processor.py`
  - 音訊前處理
  - Gemini 上傳
  - 逐字稿生成
  - 摘要生成
- `src/scraper.py`
  - 網頁正文擷取
  - 基本 metadata 擷取
  - 付費牆可能性判斷
- `src/obsidian.py`
  - 筆記路徑解析
  - YAML frontmatter 生成
  - 最終 Markdown 組裝
- `src/subtitle.py`
  - transcript 轉 SRT
  - 字幕嵌入
- `settings.json` / `.env`
  - 使用者設定
- `API_Instructions.md`
  - AI prompt 與風格契約
- `Obsidian_Output_Instructions.md`
  - Markdown 輸出契約

## 4. 目標 Plugin 架構

Codex 必須朝以下模組布局重構，或做出本質上等價的結構。

```text
obsidian-media-summarizer/
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ versions.json
├─ esbuild.config.mjs
├─ main.ts
└─ src/
   ├─ plugin/
   │  ├─ MediaSummarizerPlugin.ts
   │  ├─ commands.ts
   │  ├─ ribbon.ts
   │  └─ lifecycle.ts
   ├─ ui/
   │  ├─ settings-tab.ts
   │  ├─ input-modal.ts
   │  ├─ progress-modal.ts
   │  ├─ notices.ts
   │  └─ components/
   ├─ domain/
   │  ├─ types.ts
   │  ├─ jobs.ts
   │  ├─ settings.ts
   │  ├─ prompts.ts
   │  └─ errors.ts
   ├─ orchestration/
   │  ├─ process-media-url.ts
   │  ├─ process-webpage.ts
   │  ├─ process-local-media.ts
   │  ├─ cancellation.ts
   │  └─ job-runner.ts
   ├─ services/
   │  ├─ ai/
   │  │  ├─ ai-provider.ts
   │  │  ├─ gemini-provider.ts
   │  │  └─ prompt-builder.ts
   │  ├─ media/
   │  │  ├─ media-provider.ts
   │  │  ├─ downloader-adapter.ts
   │  │  ├─ audio-adapter.ts
   │  │  └─ subtitle-adapter.ts
   │  ├─ web/
   │  │  ├─ webpage-extractor.ts
   │  │  └─ metadata-extractor.ts
   │  └─ obsidian/
   │     ├─ note-writer.ts
   │     ├─ template-resolver.ts
   │     └─ path-resolver.ts
   ├─ runtime/
   │  ├─ runtime-provider.ts
   │  ├─ local-bridge.ts
   │  ├─ server-bridge.ts
   │  └─ browser-native.ts
   └─ utils/
      ├─ filenames.ts
      ├─ dates.ts
      ├─ markdown.ts
      └─ logging.ts
```

## 5. 架構規則：Runtime 必須可替換

因為執行方式還沒定案，Codex 不得把媒體處理直接寫死在 plugin orchestration 裡。

必須先建立 runtime 邊界。

必要介面：

```ts
interface RuntimeProvider {
  processMediaUrl(input: MediaUrlRequest, signal: AbortSignal): Promise<MediaProcessResult>;
  processLocalMedia(input: LocalMediaRequest, signal: AbortSignal): Promise<MediaProcessResult>;
  processWebpage(input: WebpageRequest, signal: AbortSignal): Promise<WebpageProcessResult>;
}
```

```ts
interface AiProvider {
  summarizeMedia(input: MediaAiInput, signal: AbortSignal): Promise<MediaSummaryResult>;
  summarizeWebpage(input: WebpageAiInput, signal: AbortSignal): Promise<WebpageSummaryResult>;
}
```

```ts
interface NoteWriter {
  writeMediaNote(input: MediaNoteInput): Promise<WriteResult>;
  writeWebpageNote(input: WebpageNoteInput): Promise<WriteResult>;
}
```

目前不要先決定 `RuntimeProvider` 最終是：

- 本機程序 bridge
- 本機 HTTP sidecar
- 遠端 API
- 瀏覽器原生實作

這個決策屬於後續階段。

## 6. 逐步重構計畫

Codex 必須依照以下順序執行重構。

### Phase 0. 建立基準定義

1. 閱讀並整理以下檔案中的行為契約：
   - `src/downloader.py`
   - `src/processor.py`
   - `src/scraper.py`
   - `src/obsidian.py`
   - `src/subtitle.py`
   - `API_Instructions.md`
   - `Obsidian_Output_Instructions.md`
2. 建立一份 migration baseline 文件，內容包含：
   - 來源類型
   - 輸出結構
   - metadata 欄位
   - 設定欄位
   - 取消行為
   - retention 行為
   - transcript 規則
   - summary 規則
3. 把完整 prompt 契約抽出成可重用文字資產或 TypeScript 常數。
4. 把完整筆記格式契約抽出成可重用的 template builder functions。
5. 任何不能在瀏覽器內直接保留的行為，都標記為 `runtime-dependent`，而不是 `dropped`。

完成條件：

- 已有書面 parity contract
- prompt 行為已被整理
- output 行為已被整理

### Phase 1. Plugin 骨架

1. 建立有效的 Obsidian plugin 專案骨架。
2. 加入：
   - `manifest.json`
   - `package.json`
   - `tsconfig.json`
   - `main.ts`
   - build config
3. 註冊：
   - 一個開啟處理輸入的 command
   - 一個網頁摘要 command
   - 一個媒體摘要 command
   - 一個 settings tab
4. 加入 plugin settings persistence。
5. 加入具結構化的 logging 與 debug 開關。

完成條件：

- plugin 可在 Obsidian 載入
- commands 可見
- settings 可儲存

### Phase 2. 抽取 Domain Model

1. 把目前 Python 中隱含的資料結構轉成明確的 TypeScript types：
   - source request types
   - metadata types
   - transcript result types
   - summary result types
   - note write input types
   - plugin settings types
2. 定義具型別的 job state model：
   - idle
   - validating
   - acquiring
   - transcribing
   - summarizing
   - writing
   - completed
   - failed
   - cancelled
3. 定義 error categories：
   - validation error
   - runtime unavailable
   - download failure
   - AI failure
   - note write failure
   - cancellation

完成條件：

- orchestration code 可以依賴 types，而不是鬆散的物件

### Phase 3. 保留設定與產品控制項

Codex 必須把目前設定的意圖完整帶進 plugin settings。

必要設定：

1. Gemini API key
2. model selection
3. vault 中的目標資料夾
4. template note 路徑或 template note 參照
5. retention mode
6. optional debug mode
7. optional default source type 或最後使用來源類型

實作規則：

1. 不得把 secret 存進筆記。
2. 使用 Obsidian plugin data storage 儲存設定。
3. 設定名稱要對使用者可理解。
4. 在合理範圍內保留目前預設值。

完成條件：

- settings UI 在意圖上達到桌面版對等

### Phase 4. Prompt 與輸出對等層

1. 根據 `src/processor.py` 與 `API_Instructions.md` 建立 `prompts.ts`。
2. 將 prompt 資產拆分為：
   - transcript prompt
   - media summary prompt
   - webpage summary prompt
3. 根據 `src/obsidian.py` 與 `Obsidian_Output_Instructions.md` 建立 `note-writer.ts`。
4. 保留：
   - frontmatter keys
   - 網頁摘要-only 輸出
   - 媒體摘要 + transcript 輸出
   - filename sanitization
   - collision-safe file naming
5. 保留目前 AI 風格期待：
   - 結構化輸出
   - markdown headings
   - 繁體中文
   - 必要時顯示明確 AI 註記

完成條件：

- plugin 生成的筆記能與目前 app 輸出高度接近

### Phase 5. 將桌面 GUI 重構為 Obsidian UX

要保留的是目前 GUI 的意圖，不是目前的 widget 樹。

目前 GUI 意圖如下：

1. 收集來源輸入
2. 顯示處理所需設定
3. 開始處理
4. 顯示即時進度
5. 允許取消
6. 回報完成或失敗

Plugin UI 實作步驟：

1. 用 Obsidian modal 或 multi-step modal 取代桌面表單。
2. 加入來源類型選擇：
   - media URL
   - webpage URL
   - local media
3. 加入 progress modal 或 status notice。
4. 用 `AbortController` 實作取消。
5. 最後結果要回報：
   - 建立出的 note path
   - 基本 metadata
   - 任何 warnings

完成條件：

- plugin 在不依賴桌面 GUI 的前提下，仍提供同等核心工作流

### Phase 6. 實作 Runtime 邊界

在實作媒體功能前，這個階段是強制的。

1. 建立 `RuntimeProvider` 介面。
2. 建立一個 placeholder implementation，回傳 `runtime not configured`。
3. 所有 orchestration 都必須經過這個介面。
4. 不得把媒體處理直接寫進 command handlers。
5. 定義 runtime communication 的 payload 契約。

Payload 必須包含：

1. source kind
2. source value
3. model
4. API key reference 或 raw key，視未來執行方式而定
5. retention mode
6. template behavior expectations
7. cancellation token mapping

完成條件：

- plugin 架構已經為未來 runtime 決策做好準備，不需要大改

### Phase 7. 先完成網頁流程

Codex 必須先實作網頁流程，再實作媒體流程，因為網頁流程的 runtime 複雜度較低，適合作為 plugin 架構驗證。

步驟：

1. 實作網頁輸入驗證。
2. 透過 runtime provider 或 native provider 實作網頁擷取。
3. 擷取 metadata 與 paywall suspicion。
4. 透過 AI provider 跑 summary prompt。
5. 透過 note writer 寫入筆記。
6. 補上取消覆蓋。
7. 對 partial extraction / paywall suspicion 顯示使用者可見警告。

完成條件：

- 網頁到筆記的流程能在 Obsidian 內端到端運作

### Phase 8. 媒體 URL 流程

Codex 必須分階段移植媒體 pipeline。

階段：

1. 驗證 media URL
2. 取得媒體
3. 正規化音訊
4. 透過 runtime 上傳或轉錄
5. 生成逐字稿
6. 生成摘要
7. 視需要建立字幕資產
8. 寫入 Obsidian 筆記
9. 套用 retention policy

規則：

1. 保留目前 Python 中已修正的下載恢復安全行為。
2. 在每個 stage boundary 保留可取消能力。
3. transcript 與 summary 生成必須分離。
4. media metadata 與 note-writing logic 必須與 runtime code 分離。

完成條件：

- media URL 流程達到目前 app 行為對等

### Phase 9. 本機媒體流程

1. 為 plugin v1 決定 local-media input 形式：
   - 僅支援 vault file
   - drag-and-drop
   - 透過 runtime bridge 讀取 OS path
2. 先實作最小且穩定的輸入方式。
3. 在 acquisition 之後，重用與 media URL flow 相同的 downstream orchestration。
4. 保留目前 app 對本機檔案使用的 metadata 語意。

完成條件：

- 本機媒體流程不會重複整條 orchestration pipeline

### Phase 10. 模板整合

1. 把桌面版 template-path 行為映射成 Obsidian-native template selection。
2. 支援以下其中一種形式：
   - vault file path
   - template note path
   - template folder + selected file
3. 替換 frontmatter 欄位時，不能破壞既有模板內容。
4. 生成內容必須插入在 frontmatter 之後，並與目前行為一致。

完成條件：

- plugin 產出的筆記可使用使用者模板，且欄位替換行為與目前 app 對等

### Phase 11. 取消與工作安全性

1. 用 `AbortController` 取代 thread event logic。
2. 確保每個耗時步驟都會檢查 cancellation。
3. 確保取消不會被顯示成一般錯誤。
4. 確保 partial artifacts 依 retention mode 被正確清理。
5. 確保 UI 在取消後會回到 idle。

完成條件：

- cancellation 是一條正式流程，不是例外外洩

### Phase 12. 移植 Retention Policy

桌面版目前有區分是否保留不同處理產物。
即使 plugin 最終的產物位置不同，這個概念仍必須保留。

Codex 必須先定義 artifact categories：

1. downloaded media
2. normalized audio
3. subtitles / SRT
4. processed output note

再映射目前 retention modes：

1. 不保留來源檔案
2. 保留來源檔案
3. 保留視訊 + 音訊

如果最終 runtime 模型改變了產物存放位置，Codex 必須保留使用者意圖，而不是死守原本路徑。

完成條件：

- retention 設定在 plugin 中仍有清楚且一致的意義

### Phase 13. 字幕功能隔離

字幕嵌入不是 Obsidian 筆記生成產品的核心。
Codex 不得讓這個功能扭曲主要 plugin 架構。

步驟：

1. 把字幕邏輯移到獨立 adapter 後面。
2. 把字幕嵌入視為 optional capability。
3. 即使字幕嵌入不可用，也不能阻擋筆記生成。
4. 如果 runtime 不能嵌入字幕，應顯示此功能不可用，而不是讓整個 plugin 失敗。

完成條件：

- 字幕支援是模組化且不阻塞主流程的

### Phase 14. 可觀測性與診斷

1. 為以下事件加入 structured logging：
   - source validation
   - runtime call start/end
   - AI call start/end
   - note write path
   - cancellation
   - recoverable warning
2. 視需要加入 debug panel 或 log export command。
3. 不得在 logs 中洩漏 API key。

完成條件：

- plugin 發生問題時可診斷，不會污染筆記或 UI

### Phase 15. 測試策略

Codex 不得只靠手動點擊驗證。

必要測試：

1. 單元測試：
   - filename sanitization
   - unique output path generation
   - prompt builder output
   - note writer output
   - settings parsing
2. 整合測試：
   - 以 mocked runtime 驗證 webpage flow orchestration
   - 以 mocked runtime 驗證 media flow orchestration
   - 驗證 cancellation behavior
3. 對生成的 Markdown notes 做 snapshot tests。

完成條件：

- prompt 與 note output 的回歸可被偵測

### Phase 16. 遷移完成檢查清單

在宣告重構完成之前，Codex 必須驗證：

1. plugin 可在 Obsidian 載入
2. settings 可持久化
3. 網頁流程可運作
4. 媒體 URL 流程可透過 runtime provider 運作
5. 本機媒體流程在選定範圍內可運作
6. note output 與目前專案結構一致
7. prompts 仍忠於目前專案規則
8. cancellation 可運作
9. retention behavior 已實作並有文件
10. 所有 runtime-dependent gaps 都有明確記錄

## 7. Obsidian Plugin UI 設計規範

本節補充前述 UX 流程要求，定義 plugin 在 Obsidian 內的完整 UI 視覺設計規範。
Codex 在重構時必須遵守這些規範，除非後續明確重新定義設計系統。

### 7.1 設計原則

1. UI 必須優先融入 Obsidian 的原生環境，而不是複製桌面 app 外觀。
2. UI 必須以「低干擾、高資訊密度、清楚的任務導向」為原則。
3. 視覺風格應偏向工具型介面，而非行銷頁或重裝飾設計。
4. 所有重要操作都必須讓使用者明確知道：
   - 現在在做什麼
   - 下一步會做什麼
   - 是否可取消
   - 結果會寫到哪裡
5. 視覺設計必須保證在 Obsidian 淺色與深色主題下都能正常工作。

### 7.2 資訊架構

Plugin UI 必須至少包含以下介面層級：

1. 命令入口
   - Command palette commands
   - optional ribbon icon
2. 輸入介面
   - source type selection
   - source input field
   - 進階設定入口
3. 設定介面
   - settings tab
4. 進度介面
   - progress modal 或 progress panel
5. 結果回報介面
   - success notice
   - error notice
   - created note link

### 7.3 版面規範

1. 主要互動應以 modal 為主，不建議一開始就做成複雜 side panel。
2. 單一 modal 內不應同時堆疊過多設定；必要時使用 multi-step modal。
3. 每個步驟畫面應限制在單一明確任務：
   - 選擇來源
   - 填入內容
   - 確認設定
   - 執行與觀察進度
4. 表單區塊之間應有穩定的垂直間距。
5. 長文字說明應置於次要位置，不得蓋過主要操作元件。
6. 行動按鈕區必須固定且清楚分層：
   - primary action
   - secondary action
   - cancel action

### 7.4 視覺風格規範

1. 優先使用 Obsidian 原生 design tokens、CSS variables 與互動樣式。
2. 不要把現有 Python GUI 的配色直接搬進 plugin。
3. 不要使用與 Obsidian 主題衝突的硬編碼背景色、文字色或邊框色。
4. 若需要自定義樣式，應只做輕量補強：
   - 間距
   - 區塊分層
   - 狀態顏色
   - loading 呈現
5. 除非有明確理由，不要加入裝飾性插圖、漸層大背景、品牌式 hero 區塊。

### 7.5 Typography 規範

1. 使用 Obsidian 當前主題的字型系統，不自行引入品牌字型。
2. 字級層級必須簡潔：
   - modal title
   - section title
   - body text
   - help text
3. 長段說明文字應維持易讀行長。
4. 次要說明文字應與主要操作有足夠視覺區隔，但不能低對比到難以閱讀。

### 7.6 元件規範

#### 輸入欄位

1. URL、檔案來源與模板欄位必須有明確 label。
2. placeholder 只能輔助，不可取代 label。
3. 驗證錯誤要顯示在欄位附近，不要只出現在全域 notice。

#### 下拉與選擇器

1. model selection 與 source type selection 要使用清楚的可見標籤。
2. 選項文字必須以使用者理解為主，不以內部 enum 命名直接暴露。

#### 按鈕

1. 每個畫面只能有一個 primary button。
2. 危險行為或中止操作不得與主要開始按鈕共用相同視覺權重。
3. 執行中按鈕必須反映 disabled 或 running 狀態。

#### Progress UI

1. 必須顯示目前處理階段。
2. 可以顯示非精確進度，但不得假裝有精確百分比。
3. 如果目前步驟可能很久，要明確說明：
   - 正在下載
   - 正在轉錄
   - 正在產生摘要
   - 正在寫入筆記

#### Notice 與結果回報

1. 成功訊息必須包含結果位置或可點擊 note link。
2. 錯誤訊息要盡可能可執行，不要只顯示原始例外。
3. 取消應顯示為取消，不得顯示成失敗。

### 7.7 狀態設計規範

Codex 必須把 UI 狀態視為設計系統的一部分，而不是零散布林值。

必要狀態：

1. idle
2. validating
3. ready
4. running
5. cancelling
6. completed
7. failed
8. cancelled

每個狀態都必須定義：

1. 使用者看到的標題
2. 補充說明
3. 按鈕可用性
4. 是否可返回
5. 是否可取消

### 7.8 可讀性與可用性規範

1. 所有主要操作都必須可用鍵盤完成。
2. Modal 開啟後焦點必須正確落在第一個主要互動元素。
3. Esc 關閉行為必須與取消邏輯明確區分。
4. 文字與背景的對比必須符合 Obsidian 常見主題下的可讀性要求。
5. 不得只用顏色表達成功、錯誤、警告，還要有文字。

### 7.9 響應式與尺寸適配規範

1. UI 必須能在較窄的 Obsidian 視窗下正常使用。
2. Modal 內容不可假設固定大螢幕寬度。
3. 長欄位在窄視窗下應自動換行或改成垂直堆疊。
4. 行動區按鈕在窄寬度下仍必須能完整顯示文字。

### 7.10 文案規範

1. UI 文案必須簡潔、直接、可操作。
2. 同一個概念的命名必須一致：
   - 網頁
   - 媒體
   - 逐字稿
   - 摘要
   - 模板
   - 輸出位置
3. 狀態文案應使用進行式或結果式，不要混用。
4. 錯誤文案應優先說明使用者下一步能做什麼。

### 7.11 與 Obsidian 原生體驗的一致性

1. 優先使用 Obsidian 提供的設定頁模式、按鈕風格與 modal 行為。
2. 如果使用自訂元件，不得明顯偏離 Obsidian 原生互動慣例。
3. 不要讓 plugin 看起來像獨立 web app 被塞進 Obsidian。

### 7.12 UI 技術選型建議

對這個專案，我建議優先使用 React 來設計 plugin UI，但要有邊界。

建議使用 React 的原因：

1. 這個 plugin 不是單一設定頁，而是有多步驟輸入、進度狀態、取消、結果回報的狀態型 UI。
2. React 較適合管理：
   - modal state
   - job state
   - conditional rendering
   - settings form state
   - progress updates
3. 之後若加入：
   - 歷史任務列表
   - 批次處理
   - 更細的設定面板
   - runtime 狀態檢查
   React 會比較容易維護。

但仍有幾個限制：

1. React 只應用於 UI 層，不要把 orchestration 與 runtime logic 綁進 React components。
2. plugin 核心邏輯必須保持 framework-agnostic。
3. 若最終 UI 很小且只剩 settings tab + 單一步驟 modal，也可以不用 React，但目前以這個專案的複雜度，我傾向建議使用 React。

### 7.13 React 版 Plugin UI 實作規格

如果 UI 採用 React，Codex 必須依照以下方式實作，而不是任意堆疊 component。

#### 7.13.1 元件分層

React UI 必須至少分成以下層級：

1. App Shell Layer
   - 提供 modal 掛載點
   - 提供全域 UI context
   - 提供 notices / transient feedback
2. Flow Container Layer
   - 管理單次處理流程的畫面切換
   - 管理 step state
   - 管理 job lifecycle
3. Screen Layer
   - SourceTypeScreen
   - SourceInputScreen
   - ProcessingOptionsScreen
   - ProgressScreen
   - ResultScreen
4. Presentational Component Layer
   - SourceTypeSelector
   - UrlInputField
   - LocalMediaPicker
   - ModelSelect
   - TemplateSelect
   - RetentionModeSelect
   - ProgressStageList
   - ResultSummaryCard
   - ErrorStateCard

規則：

1. Screen components 可以組合子元件，但不可直接呼叫 runtime。
2. Runtime 呼叫只能由 orchestration hooks 或 container 層負責。
3. Presentational components 必須盡可能無狀態或只保有局部 UI state。

#### 7.13.2 建議元件樹

```tsx
<MediaSummarizerPluginRoot>
  <UiFeedbackProvider>
    <CommandLauncher />
    <MediaSummarizerFlowModal>
      <FlowHeader />
      <FlowBody>
        <SourceTypeScreen />
        <SourceInputScreen />
        <ProcessingOptionsScreen />
        <ProgressScreen />
        <ResultScreen />
      </FlowBody>
      <FlowFooter />
    </MediaSummarizerFlowModal>
  </UiFeedbackProvider>
</MediaSummarizerPluginRoot>
```

如果後續拆成多個 modal，也必須維持相同職責切分：

1. 輸入收集
2. 設定確認
3. 執行進度
4. 結果回報

#### 7.13.3 State 分層規範

React state 不得全部混在單一 component 中。

應分成以下層次：

1. Local UI State
   - input focus
   - temporary field text
   - expanded/collapsed help text
2. Flow State
   - current step
   - selected source type
   - current form values
   - validation messages
3. Job State
   - job status
   - current stage
   - stage message
   - cancellable flag
   - result payload
   - error payload
4. Persisted Settings State
   - API key
   - model
   - output folder
   - template reference
   - retention mode

規則：

1. Persisted settings 不得與單次 flow state 混用。
2. Job state 必須可被序列化或至少可被清楚觀察。
3. Error state 與 result state 不可共用模糊的 union 結構；要有明確 discriminator。

#### 7.13.4 建議 Hooks 結構

若使用 React，建議拆出以下 hooks：

1. `useMediaSummarizerSettings()`
   - 讀寫 plugin persisted settings
2. `useSummarizerFlow()`
   - 管理目前 modal step 與 form state
3. `useSummarizerJob()`
   - 管理 job state、啟動、取消、完成與錯誤
4. `useProgressStages()`
   - 將 runtime/job 狀態映射為 UI 顯示文案
5. `useValidation()`
   - 管理來源輸入與設定驗證

規則：

1. hooks 可以呼叫 service 層，但 UI components 不得直接呼叫底層 service。
2. 若 hook 內含副作用，必須明確限制觸發時機。
3. 不要把整個 plugin 的所有邏輯塞進單一 `useEffect`。

#### 7.13.5 Modal 流程規範

若採 multi-step modal，建議流程如下：

1. Step 1: 選擇來源類型
   - media URL
   - webpage URL
   - local media
2. Step 2: 填入來源內容
   - 依來源類型切換輸入欄位
3. Step 3: 確認處理設定
   - model
   - template
   - retention mode
   - output folder
4. Step 4: 執行與顯示進度
5. Step 5: 顯示結果

每個 step 都必須明確定義：

1. title
2. primary action
3. secondary action
4. back behavior
5. validation gate

#### 7.13.6 資料流規範

React UI 的資料流必須保持單向：

1. 使用者輸入進入 flow state
2. flow state 經驗證後組成 request payload
3. request payload 交給 orchestration/job hook
4. orchestration 呼叫 runtime/service
5. runtime result 回寫 job state
6. job state 驅動 progress/result UI

不得發生的情況：

1. component 直接改寫 persisted settings 作為臨時 state
2. component 在 render 過程中直接觸發 runtime
3. presentational component 自己持有非局部業務邏輯

#### 7.13.7 建議 Context 邊界

若使用 React Context，最多只建議建立以下兩種：

1. `SettingsContext`
2. `UiFeedbackContext`

不要把整個 job state 全部塞進全域 context，除非未來真的有跨多個畫面的共享需求。
單次工作流程狀態優先保留在 modal container 內。

#### 7.13.8 建議型別結構

建議至少定義以下型別：

```ts
type SourceType = "media_url" | "webpage_url" | "local_media";

type FlowStep =
  | "source_type"
  | "source_input"
  | "options"
  | "progress"
  | "result";

type JobStatus =
  | "idle"
  | "validating"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";
```

```ts
interface FlowState {
  step: FlowStep;
  sourceType: SourceType | null;
  sourceValue: string;
  localMediaRef?: string;
  validationErrors: Record<string, string>;
}
```

```ts
interface JobState {
  status: JobStatus;
  stage: string | null;
  message: string | null;
  result: SummarizerJobResult | null;
  error: SummarizerJobError | null;
}
```

#### 7.13.9 Progress Screen 規格

`ProgressScreen` 必須至少包含：

1. 當前 stage title
2. 次要說明文字
3. stage list 或 stage timeline
4. cancel button
5. warning 區塊

如果不能提供精確百分比，UI 應改用：

1. stage-based progress
2. spinner + stage label
3. completed / current / pending 狀態標示

#### 7.13.10 Result Screen 規格

`ResultScreen` 必須至少包含：

1. 成功或失敗狀態標題
2. note 建立結果
3. metadata 摘要
4. warning 或 fallback 訊息
5. 下一步操作
   - open note
   - close modal
   - start another job

#### 7.13.11 實作限制

1. 不要預設引入大型 UI framework。
2. 若使用 React，優先搭配 Obsidian 原生樣式與輕量自訂 class。
3. 不要在 React component 裡直接使用複雜資料轉換；抽到 selectors 或 utils。
4. 不要讓每個 field 都自己管理不同版本的 validation 規則；驗證邏輯應集中。

#### 7.13.12 React 採用結論

對這個專案，我的建議仍是：

1. 用 React 做 UI
2. 不用 React 管理 plugin 核心業務邏輯
3. 讓 React 成為展示與互動層，而不是整個系統架構本身

#### 7.13.13 React Component Tree 與 Props 契約

若進入實作階段，Codex 應以以下 component tree 作為第一版藍圖：

```tsx
<MediaSummarizerFlowModal
  isOpen={isOpen}
  onClose={handleClose}
>
  <FlowLayout>
    <FlowHeader
      title={title}
      step={step}
      onCancel={handleCancel}
      canCancel={canCancel}
    />

    <FlowContent>
      {step === "source_type" && (
        <SourceTypeScreen
          value={sourceType}
          onChange={setSourceType}
          onNext={goToSourceInput}
        />
      )}

      {step === "source_input" && (
        <SourceInputScreen
          sourceType={sourceType}
          sourceValue={sourceValue}
          localMediaRef={localMediaRef}
          errors={validationErrors}
          onSourceValueChange={setSourceValue}
          onLocalMediaSelect={setLocalMediaRef}
          onBack={goBack}
          onNext={goToOptions}
        />
      )}

      {step === "options" && (
        <ProcessingOptionsScreen
          model={model}
          templateRef={templateRef}
          retentionMode={retentionMode}
          outputFolder={outputFolder}
          onModelChange={setModel}
          onTemplateChange={setTemplateRef}
          onRetentionChange={setRetentionMode}
          onOutputFolderChange={setOutputFolder}
          onBack={goBack}
          onSubmit={startJob}
        />
      )}

      {step === "progress" && (
        <ProgressScreen
          status={jobStatus}
          stage={currentStage}
          message={stageMessage}
          warnings={warnings}
          canCancel={canCancel}
          onCancel={handleCancel}
        />
      )}

      {step === "result" && (
        <ResultScreen
          status={jobStatus}
          result={jobResult}
          error={jobError}
          onOpenNote={openCreatedNote}
          onRestart={restartFlow}
          onClose={handleClose}
        />
      )}
    </FlowContent>
  </FlowLayout>
</MediaSummarizerFlowModal>
```

第一版 props 契約原則如下：

1. Screen component 只接收畫面需要的最小 props，不直接拿整包 store。
2. Props 命名要區分：
   - data props
   - action props
   - state props
3. 所有 action props 必須是明確意圖，而不是模糊 callback，例如：
   - `onSubmit`
   - `onCancel`
   - `onBack`
   - `onOpenNote`
4. 不要把 runtime response 原樣往下傳到所有子元件；先整理成 UI-friendly view model。

建議的主要 props 介面：

```ts
interface SourceInputScreenProps {
  sourceType: SourceType | null;
  sourceValue: string;
  localMediaRef?: string;
  errors: Record<string, string>;
  onSourceValueChange: (value: string) => void;
  onLocalMediaSelect: (ref: string) => void;
  onBack: () => void;
  onNext: () => void;
}
```

```ts
interface ProcessingOptionsScreenProps {
  model: string;
  templateRef?: string;
  retentionMode: string;
  outputFolder?: string;
  onModelChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onRetentionChange: (value: string) => void;
  onOutputFolderChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}
```

```ts
interface ProgressScreenProps {
  status: JobStatus;
  stage: string | null;
  message: string | null;
  warnings: string[];
  canCancel: boolean;
  onCancel: () => void;
}
```

```ts
interface ResultScreenProps {
  status: JobStatus;
  result: SummarizerJobResult | null;
  error: SummarizerJobError | null;
  onOpenNote: () => void;
  onRestart: () => void;
  onClose: () => void;
}
```

#### 7.13.14 UI State Machine 規格

Codex 應把 UI 流程視為明確 state machine，而不是鬆散切頁。

建議 state machine：

```text
closed
  -> source_type
  -> source_input
  -> options
  -> validating
  -> progress_running
  -> progress_cancelling
  -> result_success
  -> result_failed
  -> result_cancelled
  -> closed
```

建議轉移規則：

1. `closed -> source_type`
   - 由 command 或 ribbon action 觸發
2. `source_type -> source_input`
   - 已選定合法來源類型
3. `source_input -> options`
   - 輸入通過基本驗證
4. `options -> validating`
   - 使用者按下開始處理
5. `validating -> progress_running`
   - request payload 組裝完成，job 已啟動
6. `progress_running -> progress_cancelling`
   - 使用者請求取消
7. `progress_running -> result_success`
   - job 完成且 note 已建立
8. `progress_running -> result_failed`
   - job 發生不可恢復錯誤
9. `progress_cancelling -> result_cancelled`
   - 取消完成
10. `result_success|result_failed|result_cancelled -> source_type`
   - 使用者選擇再做一次
11. `result_success|result_failed|result_cancelled -> closed`
   - 使用者關閉 modal

狀態機規則：

1. `progress_running` 與 `progress_cancelling` 不可回上一頁。
2. `validating` 應極短暫，不應成為獨立長時間畫面。
3. `result_cancelled` 必須與 `result_failed` 視覺上不同。
4. `closed` 狀態不得殘留前一個 job 的 result 與 validation errors。

建議事件集合：

```ts
type FlowEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_SOURCE_TYPE"; value: SourceType }
  | { type: "SET_SOURCE_VALUE"; value: string }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SUBMIT" }
  | { type: "CANCEL" }
  | { type: "JOB_SUCCESS"; result: SummarizerJobResult }
  | { type: "JOB_FAILURE"; error: SummarizerJobError }
  | { type: "JOB_CANCELLED" }
  | { type: "RESTART" };
```

#### 7.13.15 第一版 UI Scaffold 任務清單

Codex 在真正開始做 React UI 時，應按以下順序落地：

1. 建立 `MediaSummarizerFlowModal` 空殼
   - 可開關
   - 有 header / content / footer
2. 建立 `FlowStep` 型別與最小 reducer
3. 建立 `SourceTypeScreen`
   - 先只做選項切換，不接 runtime
4. 建立 `SourceInputScreen`
   - 先完成 media URL / webpage URL / local media 三種輸入切換
5. 建立 `ProcessingOptionsScreen`
   - 接上 model / template / retention / output folder
6. 建立 `ProgressScreen`
   - 先用 mock stage data 驗證顯示
7. 建立 `ResultScreen`
   - 先用 mock success / failed / cancelled 三種狀態驗證
8. 建立 `useSummarizerFlow()`
   - 管理 step 跳轉與 validation
9. 建立 `useSummarizerJob()`
   - 先接 mock async job
10. 將 `useSummarizerJob()` 接到 `ProgressScreen`
11. 將 `ResultScreen` 接到真實 job result shape
12. 再把 orchestration 接進 runtime provider
13. 最後才做視覺細修與 notice polish

第一版 UI scaffold 驗收條件：

1. 不接 runtime 也能完整走完假流程
2. 每個 screen 都能獨立用 mock props 渲染
3. state machine 可正確切換
4. 取消、失敗、成功三條流程都可用 mock 驗證
5. 沒有任何 screen 直接 import runtime adapter

### 7.14 完成條件

只有在以下條件成立時，才算滿足 UI 設計規範：

1. UI 流程與目前 app 意圖一致
2. 視覺風格與 Obsidian 原生體驗一致
3. 主要狀態轉換清楚可感知
4. 深色與淺色主題都可讀
5. 取消、錯誤、完成三種情境可明確區分
6. UI 架構足以承接未來功能擴充而不需重做

## 8. 檔案對映指南

Codex 在移植行為時應使用以下對映。

- `gui_app.py`
  - 拆成：
    - plugin lifecycle
    - commands
    - settings tab
    - modal UI
    - orchestration runners
- `src/downloader.py`
  - 移植到：
    - media runtime adapter
    - media acquisition types
    - error 與 recovery handling
- `src/processor.py`
  - 移植到：
    - AI provider
    - prompt builder
    - media processing orchestrator
- `src/scraper.py`
  - 移植到：
    - webpage extractor service
    - webpage metadata service
- `src/obsidian.py`
  - 移植到：
    - note writer
    - path resolver
    - template resolver
- `src/subtitle.py`
  - 移植到：
    - optional subtitle adapter

## 9. Codex 不得做的事

1. 不要把所有行為攤平成 `main.ts`。
2. 不要在 runtime 尚未定案前，硬寫死單一執行策略。
3. 不要隨意改寫 prompts。
4. 不要為了方便而改動 note structure。
5. 不要讓字幕支援變成筆記生成的硬依賴。
6. 不要讓 UI components 耦合 runtime internals。
7. 不要因為 plugin 儲存方式不同，就刪掉 retention settings。
8. 不要把目前 Python 架構當成可隨意丟棄的東西；它是來源行為契約。

## 10. 建議 Codex 的實作順序

當 Codex 真正開始實作時，使用以下順序：

1. 撰寫 parity contract
2. scaffold plugin
3. 建立 domain types
4. 建立 settings model 與 settings tab
5. 建立 prompt assets
6. 建立 note writer
7. 建立 runtime interface
8. 實作 webpage flow
9. 實作 media URL flow
10. 實作 local media flow
11. 移植 retention behavior
12. 隔離 subtitle feature
13. 加入 tests
14. 對照原 Python 專案做 parity review

## 11. Done 定義

只有在以下條件成立時，才能視為重構完成：

1. Obsidian plugin 已可在約定功能範圍內取代目前 app
2. 目前專案行為是被有意識地映射，而不是被隨意近似
3. runtime 決策仍可替換
4. prompts 與 note output 保留了目前專案的產品辨識度
5. 架構邊界清楚到足以支撐後續執行模式討論
