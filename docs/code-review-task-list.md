# Code Review Task List

最後更新：2026-05-05 23:29

本清單來自一次全 repo 程式碼檢查。檢查範圍包含 `src/`、`tests/`、`scripts/`、建置設定與 package metadata。

已執行驗證：

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check:release-metadata`

目前 gate 結果皆通過；以下項目是我會想後續修改的程式碼工作，不代表目前 build 已壞。

## P0：先修正使用者可見或行為契約不一致

- [x] 將 Gemini 預設模型與文件推薦模型對齊為 `gemini-2.5-flash`。
  - 檔案：`src/domain/model-selection.ts`、`src/domain/settings.ts`、`src/ui/settings-tab.ts`、`tests/unit/settings.test.ts`、`tests/unit/api-health-check.test.ts`、`tests/regression/media-summary-global.regression.test.ts`
  - 目前問題：文件已統一建議轉錄與摘要使用 `gemini-2.5-flash`，但程式預設仍包含 `gemini-3-flash-preview` 與 `gemini-3.1-flash-lite-preview`。新安裝或空模型輸入可能走到與文件不同的路徑。
  - 建議作法：保留 preview 模型於 catalog / migration，但將 `DEFAULT_TRANSCRIPTION_MODEL`、`DEFAULT_GEMINI_SUMMARY_MODEL`、placeholder 與測試期望改為 `gemini-2.5-flash`。
  - 驗證：`npm run typecheck`、`npm run test -- tests/unit/settings.test.ts tests/unit/api-health-check.test.ts tests/regression/media-summary-global.regression.test.ts`、`npm run build`。

- [x] 修正 Flow Modal 標題拼字。
  - 檔案：`src/ui/flow-modal/SummarizerFlowModal.ts`
  - 目前問題：modal title 使用 `AI Summerizer`，應為 `AI Summarizer`。
  - 建議作法：修正字串並補一個簡單 UI smoke 或 DOM-level regression，避免之後再漂移。
  - 驗證：`npm run typecheck`、`npm run smoke:desktop`。

- [x] 移除或正式採用 React 依賴。
  - 檔案：`package.json`、`package-lock.json`、可能的未來 `src/ui/**`
  - 目前問題：`react`、`react-dom`、`@types/react`、`@types/react-dom` 在 package 中存在，但 `src/` 沒有使用。這會增加安裝與審查成本，也讓 UI 技術方向看起來不明確。
  - 建議作法：若短期仍用 Obsidian DOM API，移除 React 依賴與 JSX 設定；若要採 React，先建立明確的 UI migration plan。
  - 驗證：`npm install` 或 `npm prune` 後跑 `npm run typecheck`、`npm run test`、`npm run build`。

## P1：可靠性與安全邊界

- [x] 拆分 `src/services/ai/configured-ai-provider.ts`。
  - 檔案：`src/services/ai/configured-ai-provider.ts`
  - 目前問題：單檔約 1300 行，混合 Gemini/OpenRouter/Mistral/Gladia routing、HTTP timeout、Gemini Files API、remote file lifecycle、diagnostics 與 provider factory。任何 provider 修改都容易牽動整個檔案。
  - 建議作法：拆成 `gemini-client.ts`、`openrouter-client.ts`、`mistral-client.ts`、`gemini-files.ts`、`configured-provider-factory.ts`，保留現有 public factory API。
  - 驗證：`tests/unit/configured-ai-provider.test.ts` 先不改行為；拆分後補 provider-specific unit tests。

- [x] 統一 AI provider HTTP error parsing 與 secret redaction。
  - 檔案：`src/services/ai/configured-ai-provider.ts`、`src/services/ai/gladia-transcription-provider.ts`、`src/services/ai/api-health-check.ts`
  - 目前問題：多個 provider 各自實作 `readErrorDetail`、timeout 與 diagnostics；錯誤 body excerpt 會進 diagnostics，未集中定義 redaction 規則。
  - 建議作法：新增共用 `http-ai-client` 或 `provider-error.ts`，統一 timeout、JSON parse、body excerpt 長度、header/key redaction、response shape diagnostics。
  - 驗證：補測 provider error body 包含 key/token 時不會出現在 thrown error、log message 或 warning 中。

- [x] 強化 Gemini Files API remote file cleanup 的可觀測性與補償策略。
  - 檔案：`src/services/ai/configured-ai-provider.ts`、`src/services/media/artifact-manifest.ts`
  - 目前問題：remote file lifecycle 已寫入 manifest，但刪除失敗、取消、或 manifest 不存在時的後續補償仍偏 best-effort。長媒體測試若大量使用 Files API，可能留下 provider-side remote files。
  - 建議作法：將 remote file delete 狀態納入明確 result/warning，提供可重跑 cleanup 的 manifest-driven helper。
  - 驗證：補測 Files API 上傳成功但 generate/cancel/delete 失敗時，manifest 仍有足夠資料追蹤與補償。

- [x] 修正 `ffmpeg-tool-installer` 的 abort listener lifecycle。
  - 檔案：`src/services/media/ffmpeg-tool-installer.ts`
  - 目前問題：`requestUrl` 會註冊 `signal?.addEventListener("abort", ...)`，但沒有在 request 成功、錯誤或 redirect 完成後移除 listener。
  - 建議作法：包一層 cleanup，於 `response` resolve、`error` reject、timeout、redirect handoff 後移除 listener。
  - 驗證：新增 abort listener cleanup unit test；保留取消下載與 timeout 測試。

- [x] 對 manifest JSON parse 增加 graceful failure。
  - 檔案：`src/services/media/artifact-manifest.ts`、`src/orchestration/process-transcript-file.ts`
  - 目前問題：manifest 不存在會被容忍，但 JSON 損壞會直接 throw 或 fallback 不一致。這對 recovery / transcript retry 來說太脆弱。
  - 建議作法：manifest 讀取集中成 helper，區分 `missing`、`invalid_json`、`schema_mismatch`，回傳 warning 而不是讓可恢復流程直接中斷。
  - 驗證：補 corrupt `metadata.json` 的 artifact update 與 transcript-file retry tests。

## P1：使用者輸入與輸出品質

- [x] 強化 Webpage extraction。
  - 檔案：`src/services/web/webpage-extractor.ts`、`src/services/web/metadata-extractor.ts`、`src/orchestration/process-webpage.ts`
  - 目前問題：目前以簡單 regex strip HTML；metadata extractor 永遠回 `Untitled Webpage`。真實網站的 title、description、article text、HTML entity、動態內容與 charset 會很容易退化。
  - 建議作法：至少解析 `<title>`、`meta[name=description]`、OpenGraph、canonical URL；HTML entity 改用可靠 decode；正文抽取加入 length gate 與 fallback warnings。
  - 驗證：新增含 title/meta/script/style/entity/empty article 的 unit tests 與 webpage regression。

- [x] 對 transcript file 的 pseudo timing segmentation 增加更清楚的語意。
  - 檔案：`src/orchestration/process-transcript-file.ts`
  - 目前問題：`.md/.txt` 逐字稿沒有時間軸時，目前每行用 1 秒 pseudo segment。這對 summary chunking 足夠，但對 cleanup prompt 的「保留 timing marker」語意不夠真實。
  - 建議作法：新增 `timingSource: "synthetic" | "explicit"` 或 equivalent metadata，讓 cleanup prompt / chunking 可以用不同策略。
  - 驗證：補 transcript file 無 timing、已有 `{HH:MM:SS}` timing、混合空行與註解的 tests。

- [x] 改善 note writer 的 template/frontmatter 邊界。
  - 檔案：`src/services/obsidian/note-writer.ts`、`src/services/obsidian/template-resolver.ts`
  - 目前問題：預設 frontmatter 與 custom template path 都由 note writer 同時處理；custom template 如果自行包含 frontmatter，placeholder 插入與 fallback append 容易產生雙 frontmatter 或重複 summary。
  - 建議作法：拆出 `renderBuiltinNote` / `renderCustomTemplateNote`，新增 frontmatter detection 與 warnings。
  - 驗證：補 custom template 已含 frontmatter、沒有 `{{summary}}`、沒有 `{{transcript}}`、unknown placeholder 的 tests。

- [x] 將 `generateFlashcards` 從 note tag placeholder 擴展成明確 capability boundary。
  - 檔案：`src/services/obsidian/note-writer.ts`、`src/ui/flow-modal/SummarizerFlowModal.ts`、`docs/flashcard-generation-spec.md`
  - 目前問題：目前只影響 tags placeholder，還沒有真正 flashcard 生成 pipeline；UI 上若讓使用者理解成已生成閃卡會有落差。
  - 建議作法：短期把 UI 文案明確標示為「預留/標記」；中期實作獨立 flashcard generation output contract。
  - 驗證：補 `generateFlashcards` on/off 的 note output tests 與 UI smoke。

## P2：架構與可維護性

- [x] 拆分 Settings Tab。
  - 檔案：`src/ui/settings-tab.ts`
  - 目前問題：單檔約 2600 行，混合 section navigation、model catalog、provider API tests、template picker、diagnostics、ffmpeg installer、help content。這會讓任何 settings 小改都很難審。
  - 建議作法：依 section 拆成 `settings/ai-models-section.ts`、`settings/output-media-section.ts`、`settings/templates-section.ts`、`settings/help-section.ts`、`settings/diagnostics-section.ts`，保留同一 PluginSettingTab shell。
  - 驗證：先補 section-level smoke helpers，再拆檔，最後跑 `npm run typecheck`、`npm run build`、`npm run smoke:desktop`。

- [x] 拆分 Flow Modal。
  - 檔案：`src/ui/flow-modal/SummarizerFlowModal.ts`
  - 目前問題：單檔約 1400 行，混合 state machine、rendering、folder picker、template controls、runtime diagnostics、job execution。任務取消、close gate、result panel 與 source switching 容易互相影響。
  - 建議作法：抽出 `flow-state.ts`、`flow-renderer.ts`、`flow-job-runner.ts`、`folder-picker-modal.ts`，保留 public modal class 薄化。
  - 驗證：補 state transition unit tests，尤其 running/cancelling/completed/failed/close gate。

- [x] 把 media acquisition 三段流程整理成共用 session pipeline。
  - 檔案：`src/orchestration/process-media-url.ts`、`src/orchestration/process-local-media.ts`、`src/runtime/local-bridge-runtime.ts`
  - 目前問題：media URL 與 local media 在 session、pre-upload、cleanup、transcript-ready payload 結構上高度相似，但目前各自維護。
  - 建議作法：抽出 common `prepareMediaForTranscription` pipeline，source-specific adapter 只負責 acquisition。
  - 驗證：保留現有 integration tests，再新增 shared behavior tests：completed cleanup、failed cleanup、single artifact mode、auto chunks。

- [ ] 統一 cancellation handling。
  - 檔案：`src/orchestration/job-runner.ts`、`src/services/media/downloader-adapter.ts`、`src/services/media/pre-upload-compressor.ts`、`src/services/ai/**`
  - 目前問題：各層用 `AbortSignal`，但 timeout、child process、fetch、polling loop、installer request 的 cancellation 包裝不同。
  - 建議作法：建立共用 `abortableTimeout`、`withAbortSignal`、`toCancellationError` helpers，統一 `SummarizerError` category 與 recoverable semantics。
  - 驗證：補 fetch timeout、polling abort、child process abort、ffmpeg install abort 的共同測試。

- [ ] 加入 lint / dependency hygiene gate。
  - 檔案：`package.json`、`tsconfig.json`、CI 或 release docs
  - 目前問題：沒有 ESLint、unused dependency check、unused exports check。React 未使用這類問題只能靠人工掃描。
  - 建議作法：加入 ESLint TypeScript config，至少啟用 no-unused-vars、no-floating-promises、consistent-type-imports；另加 `depcheck` 或等效腳本。
  - 驗證：新增 `npm run lint`，再納入 `gate:local` 或 release gate。

## P2：測試補強

- [x] 補 UI 字串與主要中文文案 regression。
  - 檔案：`src/ui/settings-tab.ts`、`src/ui/flow-modal/SummarizerFlowModal.ts`、`src/ui/source-guidance.ts`
  - 目前問題：大量使用者可見中文文案直接散在 UI 檔案中；拼字、模型建議或文案漂移不一定被 tests 抓到。
  - 建議作法：把重要 label/placeholder/help copy 移到集中常數，新增 snapshot-like unit tests。
  - 驗證：跑 UI copy tests，並保留 `npm run smoke:desktop`。

- [x] 補 release asset privacy test。
  - 檔案：`scripts/verify-release-metadata.mjs`、`docs/distribution-guide.md`
  - 目前問題：release metadata 只檢查版本一致，沒有掃 `main.js` / `manifest.json` / `styles.css` 是否含本機 vault path、cache path、API key pattern 或測試資料。
  - 建議作法：新增 `scripts/verify-release-privacy.mjs`，檢查 release assets 與 package metadata。
  - 驗證：把 privacy script 加進 `gate:release`。

- [x] 補 smoke scripts 的自動化回寫或 evidence 模式。
  - 檔案：`scripts/smoke-checklist.mjs`、`docs/smoke-checklist.md`、`docs/test-matrix.md`
  - 目前問題：smoke script 只列 checklist，不能記錄結果或產生 evidence artifact。
  - 建議作法：新增 `--record <path>`，輸出 timestamp、operator、capability、pass/fail、notes。
  - 驗證：script unit test 或 fixture snapshot。

## P3：產品後續

- [ ] 完成 `CAP-404` yt-dlp managed install/update。
  - 檔案：`src/services/media/dependency-drift.ts`、`src/plugin/dependency-drift-monitor.ts`、`src/ui/settings-tab.ts`
  - 目前問題：ffmpeg/ffprobe 已有 managed install，yt-dlp 仍主要依賴 path/PATH 與 drift monitor。
  - 建議作法：新增 yt-dlp managed installer、checksum/source policy、settings action 與 diagnostics。
  - 驗證：Windows path、PATH fallback、managed install、update available、download failure tests。

- [ ] 將 model catalog 建議、官方 API 查詢與預設模型策略分層。
  - 檔案：`src/domain/model-selection.ts`、`src/ui/model-autocomplete.ts`、`src/ui/settings-tab.ts`
  - 目前問題：default catalog、user catalog、official models API、manual entry 與 selected fallback 混在同一組 helper。後續 provider 增加時會變重。
  - 建議作法：拆成 `model-defaults.ts`、`model-catalog.ts`、`provider-model-discovery.ts`。
  - 驗證：保留 settings unit tests，新增 catalog merge / selected fallback / provider purpose compatibility tests。
