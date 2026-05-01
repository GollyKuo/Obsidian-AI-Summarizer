# 開發日誌

最後更新：2026-05-02 00:43

## 版本紀錄

### 0.1.53-cap-202-artifact-manifest - 2026-05-02 00:43

範圍：
- 完成 `CAP-202` source artifact 與 artifact manifest 第一輪校準。

主要變更：
- 新增 `src/services/media/artifact-manifest.ts`
- media URL 下載改用 `yt-dlp` title-based source artifact，不再以固定 `downloaded.<ext>` 作為唯一可辨識來源檔名
- local media 匯入改為保留安全化後的原始檔名，例如 `demo.MP3`
- acquisition 階段寫入 `metadata.json` artifact manifest
- compression 階段回寫 `derivedArtifactPaths`、`uploadArtifactPaths`、`chunkCount`、`chunkDurationsMs`、`vadApplied`、`selectedCodec`
- 更新 `src/services/media/downloader-adapter.ts`
- 更新 `src/services/media/local-media-ingestion-adapter.ts`
- 更新 `src/services/media/pre-upload-compressor.ts`
- 更新 `tests/unit/downloader-adapter.test.ts`
- 更新 `tests/unit/local-media-ingestion-adapter.test.ts`
- 更新 `tests/unit/pre-upload-compressor.test.ts`
- 更新 `docs/media-acquisition-spec.md`
- 更新 `docs/backlog.md`、`docs/backlog-active.md`
- 補強 `docs/documentation-maintenance.md` 與 `.codex/references/documentation-maintenance.md`：若變更包含 `src/**`、`tests/**`、版本檔、backlog 或正式規格文件，完成前必須檢查是否需要更新 `docs/dev_log.md`，若不更新需明確說明原因

驗證：
- `npm run typecheck`
- `npx vitest run tests/unit/downloader-adapter.test.ts tests/unit/local-media-ingestion-adapter.test.ts tests/unit/pre-upload-compressor.test.ts tests/integration/process-media-url.integration.test.ts tests/integration/process-local-media.integration.test.ts --passWithNoTests`
- `npm run test`
- `npm run build`
- `git diff --check`

### 0.1.52-documentation-maintenance-policy - 2026-05-02 00:15

範圍：
- 建立正式文件維護規範，將 backlog 與相關文件同步規則集中管理。

主要變更：
- 新增 `docs/documentation-maintenance.md`
- 新增 `.codex/references/documentation-maintenance.md`
- 刪除 `docs/docs-governance.md`
- 刪除 `.codex/references/docs-governance.md`
- 更新 `.codex/SKILL.md`，改讀 `references/documentation-maintenance.md`
- 更新 `README.md`，新增文件維護規範入口
- 更新 `docs/workflow-sop.md`
- 整理 `docs/backlog.md`、`docs/backlog-active.md`、`docs/backlog-archive.md` 三層 backlog 分工

驗證：
- `git diff --check`
- 以 `rg` 確認現行引用不再指向被刪除的 `docs-governance` reference；僅保留 `docs/dev_log.md` 歷史紀錄與正式規範中的停用說明

### 0.1.51-long-media-summary-contract - 2026-05-01 23:45

範圍：
- 定案長媒體 chunk、transcript 與最終摘要的整合規範。

主要變更：
- 更新 `docs/API_Instructions.md`
- 更新 `src/domain/prompts.ts`
- 明確規定 audio/transcript chunk 僅供內部 token control、diagnostics 與 recovery 使用
- 最終摘要必須以合併 transcript 做全局整合
- 若 transcript 過長，允許 partial notes，但必須再做 final synthesis
- 最終輸出不得暴露 `chunk`、`part`、`分段` 等技術標記，除非原始內容本身就在討論這些詞
- 更新 `docs/media-acquisition-spec.md`
- 更新 `docs/backlog.md`、`docs/backlog-active.md`

驗證：
- `npm run typecheck`
- `git diff --check -- docs\API_Instructions.md docs\backlog.md docs\backlog-active.md docs\media-acquisition-spec.md src\domain\prompts.ts`

### 0.1.50-gladia-and-legacy-media-alignment - 2026-05-01 20:52

範圍：
- 接入 Gladia transcription provider，並吸收舊版 `Media Summarizer` 的媒體可靠性經驗。

主要變更：
- 新增 Gladia pre-recorded transcription provider
- 更新 `src/services/ai/gladia-transcription-provider.ts`
- 更新 provider/model settings，加入 `gladiaApiKey`、`transcriptionProvider: gladia`、`transcriptionModel: default`
- 更新 API health check 與設定頁 Gladia 測試入口
- 更新 `src/orchestration/process-media.ts`
- 更新 `src/services/ai/configured-ai-provider.ts`
- 更新 `tests/integration/process-media.integration.test.ts`
- 更新 `tests/unit/api-health-check.test.ts`
- 更新 `tests/unit/configured-ai-provider.test.ts`
- 更新 `tests/unit/settings.test.ts`
- 吸收舊版 YouTube 下載穩定參數到新版 downloader：1080p 內格式、retry、fragment retry、socket timeout、http chunk size、continued download
- 新增 dependency drift monitor 與 `yt-dlp` 非阻塞更新提醒策略
- 更新 `docs/dependency-update-strategy.md`
- 更新 `docs/media-acquisition-spec.md`
- 更新 `docs/API_Instructions.md`、`docs/Manual.md`、`docs/architecture-boundary.md`
- 更新 `docs/backlog.md`、`docs/backlog-active.md`

驗證：
- 追溯補登：此條整理自既有 commit `a737796`、`1916892`、`2030f70` 與當時文件/測試更新
- 當前工作樹已於 `0.1.53` 回歸執行 `npm run typecheck`、`npm run test`、`npm run build`

### 0.1.49-transcription-node-import-fix - 2026-04-29 00:04

範圍：
- 修正 media transcription 階段在 Obsidian renderer 內讀取 AI-ready audio artifact 時，誤以 dynamic import 載入 Node 模組造成失敗的問題。

主要變更：
- 更新 `src/services/ai/configured-ai-provider.ts`
- 將 `node:fs/promises` 與 `node:buffer` 改為靜態 import，避免 Electron renderer 將 `import("node:fs/promises")` 當成瀏覽器 dynamic module fetch
- 保留原本 Gemini inline audio payload 組裝行為
- 更新 `tests/unit/configured-ai-provider.test.ts`
- 新增 AI upload artifact 讀檔與 Gemini `inline_data` payload 測試

驗證：
- `npm run typecheck`
- `npx vitest run tests/unit/configured-ai-provider.test.ts --passWithNoTests`
- `npm run test`
- `npm run build`
- `npm run build:vault`

### 0.1.48-cap-504-model-catalog - 2026-04-26 02:00

範圍：
- 完成 `CAP-504 Multi-Model Provider Strategy`，把模型選項改為使用者可管理的 provider/model catalog。

主要變更：
- 更新 `src/domain/model-selection.ts`
- 模型型別改為可保存任意使用者自訂 model id
- 新增 `modelCatalog` settings contract，每筆模型保存 provider、用途、顯示名稱與 model id
- 新安裝預設不預載內建模型清單，既有設定會把已選模型 migration 進 catalog
- 更新 `src/ui/settings-tab.ts`
- AI 模型頁改為以使用者可維護的下拉選單為主，透過「管理模型」新增或刪除轉錄 / 摘要模型
- 轉錄與摘要的管理模型輸入共用同一套 autocomplete datalist，候選依當前 provider 動態切換 Gemini / OpenRouter
- 新增「模型清單更新」操作，可手動抓取 Gemini / OpenRouter 官方模型資料
- 模型 autocomplete 採 1 天快取；對應 API key 變更時會清快取並在下次輸入時重抓
- 新增 `src/services/ai/openrouter-models.ts`
- 支援 OpenRouter official models API 讀取、名稱更新、model id 校正與找不到模型提示
- 新增 `src/services/ai/gemini-models.ts`
- 支援 Gemini official models API 讀取與 Gemini model autocomplete
- OpenRouter 管理模型輸入支援輸入名稱 / model id 後自動比對官方 models API 防呆
- Gemini 轉錄模型保留 audio-capable 風險提示，實際可用性仍以 API 測試與轉錄請求為驗證邊界
- 更新 `tests/unit/settings.test.ts`
- 新增 `tests/unit/gemini-models.test.ts`
- 新增 `tests/unit/openrouter-models.test.ts`
- 更新 `docs/backlog.md`、`docs/backlog-active.md`、`docs/Manual.md`

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build:vault`

### 0.1.47-settings-diagnostics-and-version-sync - 2026-04-24 23:16

範圍：
- 收斂設定頁資訊架構與診斷 UX，並讓 plugin 版本號可跟隨 `docs/dev_log.md` 自動同步。

主要變更：
- 重寫 `src/ui/settings-tab.ts`
- 設定頁改為分頁式結構：`AI 模型`、`輸出與媒體`、`模板與提示`、`診斷`
- AI 模型設定改為兩段式結構：`轉錄模型  媒體轉文字` 與 `摘要模型  文字轉摘要`
- 轉錄與摘要欄位統一為 `Provider`、`模型`、`API Key`
- 摘要 provider 為 Gemini 時，API Key 自動共用轉錄模型的 Gemini API Key
- 診斷頁改為先顯示使用者可讀的狀態摘要與功能可用性，再以 `詳細資訊` 收納 technical log
- 新增 `scripts/sync-version-from-dev-log.mjs`
- 從 `docs/dev_log.md` 最新版本條目同步 `manifest.json`、`package.json`、`package-lock.json`、`versions.json`
- 更新 `package.json`
- 新增 `version:sync`，並接入 `predev`、`prebuild`、`prebuild:vault` 等前置流程
- 更新 `manifest.json`、`versions.json`、`package-lock.json`
- plugin 顯示版本改由 dev log 最新版本驅動，現已同步為 `0.1.47-settings-diagnostics-and-version-sync`

驗證：
- `npm run typecheck`
- `npm run test -- tests/unit/settings.test.ts`
- `npm run build:vault`
- `git diff`

### 0.1.46-cap-205-model-split-and-provider-routing - 2026-04-24 16:24

範圍：
- 推進 `CAP-205`，將單一 `model` 設定拆成「轉錄模型」與「摘要模型」，並補齊 provider routing 與設定頁。

主要變更：
- 新增 `src/domain/model-selection.ts`
- 定義 `transcriptionProvider/transcriptionModel` 與 `summaryProvider/summaryModel`
- 新增 Gemini 與 OpenRouter/Qwen 的 provider/model option、預設值與 normalization 規則
- 更新 `src/domain/settings.ts`
- plugin settings 改為保存 Gemini API key、OpenRouter API key、轉錄 provider/model、摘要 provider/model
- 更新 `src/domain/types.ts`
- request/input contract 拆分轉錄與摘要模型欄位，新增 `MediaTranscriptionInput/Result` 與 `MediaSummaryDraft`
- 新增 `src/services/ai/transcription-provider.ts`
- 建立 `TranscriptionProvider` 介面與 transcript markdown formatter
- 更新 `src/services/ai/ai-provider.ts`
- 將既有 `AiProvider` 收斂為 summary provider alias
- 更新 `src/orchestration/process-media.ts`
- media 主流程正式拆成 `acquiring -> transcribing -> summarizing -> writing`
- 更新 `src/orchestration/process-webpage.ts`
- webpage flow 改走 `summaryProvider/summaryModel`
- 更新 `src/services/ai/media-summary-chunking.ts`、`src/services/ai/prompt-builder.ts`
- chunking 與 prompt input 改對齊 summary-only provider contract
- 更新 `src/plugin/AISummarizerPlugin.ts`
- settings loading 支援新欄位，並對舊版單一 `model` 設定做相容 migration
- 重寫 `src/ui/settings-tab.ts`
- 設定頁改為 provider/model 雙層設定，支援 OpenRouter API key 顯示條件
- 更新 `src/ui/flow-modal/SummarizerFlowModal.ts`
- mock flow 對齊轉錄 provider 與摘要 provider 的新 contract
- 更新測試：
  - `tests/integration/process-media.integration.test.ts`
  - `tests/integration/process-webpage.integration.test.ts`
  - `tests/integration/process-media-url.integration.test.ts`
  - `tests/integration/process-local-media.integration.test.ts`
  - `tests/regression/webpage-flow.regression.test.ts`
  - `tests/unit/media-summary-chunking.test.ts`
  - `tests/unit/local-bridge-runtime.test.ts`
  - `tests/unit/settings.test.ts`
- 更新 `docs/Manual.md`、`docs/backlog.md`、`docs/backlog-active.md`
- 補齊 provider/model split 的使用說明與 backlog 狀態

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff`

### 0.1.45-cap-404-dependency-drift-strategy - 2026-04-24 10:06

範圍：
- 完成 `CAP-404`，落地外部依賴 drift 檢查策略，加入非阻塞背景檢查、版本相容性規則與 release gate 文件規範。

主要變更：
- 新增 `src/services/media/dependency-drift.ts`
- 定義 `yt-dlp` 版本老化（release date）與 `ffmpeg/ffprobe` major 相容性檢查
- 新增 `src/plugin/dependency-drift-monitor.ts`
- plugin 啟動後背景執行 dependency drift 檢查，含 timeout，不阻塞 onload
- 更新 `src/plugin/AISummarizerPlugin.ts`
- 啟動流程接入 dependency drift monitor
- 更新 `src/services/media/runtime-diagnostics.ts`
- diagnostics summary 新增 `Dependency drift` 狀態與明細
- 新增單元測試：
  - `tests/unit/dependency-drift.test.ts`
  - `tests/unit/dependency-drift-monitor.test.ts`
- 更新 `tests/unit/runtime-diagnostics.test.ts`
- 新增 `docs/dependency-update-strategy.md`
- 更新 `docs/release-gate.md` 與 `docs/test-matrix.md`
- 定義 drift 對 smoke/release gate 的放行規則
- 更新 `docs/commands-reference.md`、`README.md`
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-404` 四個未完成項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff`

### 0.1.44-cap-403-release-build-vault-sync - 2026-04-24 09:26

範圍：
- 完成 `CAP-403`，固定 vault sync 開發流程、補齊 release/build/commit/test SOP，並落地 GitHub Actions release gate。

主要變更：
- 新增 `scripts/vault-sync.mjs`
- 提供可指定 vault 的標準入口（`--vault` 或 `AI_SUMMARIZER_VAULT_PATH`）
- 更新 `package.json`
- 新增 `dev:vault:target` 與 `build:vault:target`
- 新增 `.github/workflows/release-gate.yml`
- 在 PR / push / 手動觸發執行 `npm run gate:release`
- 新增 `docs/release-build-vault-sop.md`
- 固化 build / release / commit / test / vault sync SOP 與檢查點
- 更新 `docs/release-gate.md`
- 補 CI automation 與 vault sync gate 說明
- 更新 `docs/commands-reference.md`
- 納入 target vault sync 指令
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-403` 三個未完成項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff`

### 0.1.43-user-manual-and-vault-ops-docs - 2026-04-24 09:08

範圍：
- 完成 `CAP-303`，補齊 user manual，並收斂安裝、設定、smoke test、vault build/sync 的使用說明。

主要變更：
- 新增 `docs/Manual.md`
- 整理安裝、建置、啟用 plugin、三種輸入流程與常見錯誤
- 明確說明 `build`、`build:vault`、`dev:vault`、自訂 vault sync 的差異
- 更新 `docs/commands-reference.md`
- 補上第一輪安裝指令與自訂 vault sync 指令
- 更新 `README.md`
- 將 `docs/Manual.md`、`docs/commands-reference.md`、`docs/release-gate.md` 納入主要入口
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-303` 兩個未完成項

驗證：
- 手動比對 `package.json` script 與 `esbuild.config.mjs` 的 vault sync 行為
- `git diff`

### 0.1.42-cap-302-settings-and-guidance - 2026-04-24 08:48

範圍：
- 完成 `CAP-302` 剩餘三項，補齊 template v1 UX、prompt/template 資產整理，以及三種輸入的引導與錯誤提示。

主要變更：
- 重寫 `src/ui/flow-modal/SummarizerFlowModal.ts`
- modal 改為支援 `webpage_url`、`media_url`、`local_media` 三種輸入
- 新增輸入類型切換、來源提示、常見來源範例、source-specific error hint
- local media 在桌面版支援檔案挑選
- 重寫 `src/ui/settings-tab.ts`
- 新增 template v1 UX：預設 frontmatter、內建模板、自訂模板路徑
- 新增 prompt 資產清單與輸入引導區塊
- 新增 `src/services/obsidian/template-library.ts`
- 建立內建 note output template catalog
- 新增 `src/services/ai/prompt-assets.ts`
- 整理固定 prompt asset inventory
- 新增 `src/ui/source-guidance.ts`
- 收斂 `webpage / media_url / local_media` 的 label、placeholder、hint 與 error copy
- 更新 `src/services/obsidian/note-writer.ts`
- 讓 builtin template 經由既有安全 frontmatter 輸出，不繞過 quote/escape
- 新增單元測試：
  - `tests/unit/template-library.test.ts`
  - `tests/unit/prompt-assets.test.ts`
  - `tests/unit/source-guidance.test.ts`
- 更新 `tests/unit/note-writer.test.ts`
- 驗證 builtin template 解析不依賴 custom template storage
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-302` 剩餘三項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`

### 0.1.41-harden-encoding-safety-rules - 2026-04-24 08:28

範圍：
- 針對 `docs/backlog-active.md` 亂碼事故補強正式編碼安全規範，限制高風險修改方式。

主要變更：
- 重寫 `docs/encoding-safety.md`
- 從單純要求 UTF-8，提升為限制允許的中文文件修改方式
- 明確禁止 PowerShell 5.1 對中文文件做 `Get-Content` / `Set-Content` round-trip
- 明確禁止 `Out-File`、`>`、`>>` 覆寫 repo 中文文件
- 新增 mojibake 停損規則、驗證流程與修復 SOP
- 在規範中記錄 `docs/backlog-active.md` 事故根因與修復方式
- 重寫 `.codex/references/encoding-safety.md`
- 將 Codex 執行規則收斂為可直接操作的短版摘要

驗證：
- 手動比對此次事故 root cause 與規範內容一致
- `git diff`
- 必要時 `Format-Hex`

### 0.1.40-webpage-regression-gate - 2026-04-24 07:35

範圍：
- 完成 `CAP-401` 最後一項，建立桌面 regression gate，明確守住 `webpage` 主線。

主要變更：
- 新增 `tests/regression/webpage-flow.regression.test.ts`
- 補 `webpage` happy path invariants 與 invalid URL fail-fast regression coverage
- 更新 `tests/README.md`
- 新增 `regression/` 測試層說明
- 更新 `package.json`
- 新增 `test:regression:webpage` 與 `gate:regression:desktop`
- `gate:release` 改為先跑 regression gate，再跑 smoke checklist
- 更新 `docs/test-matrix.md`
- 將 `webpage` desktop gate 標記為 `gate:regression:desktop`
- 更新 `docs/commands-reference.md`
- 更新 `docs/release-gate.md`

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:regression:webpage`
- `npm run gate:regression:desktop`
- `npm run gate:release`

### 0.1.39-smoke-checklist-and-test-matrix - 2026-04-24 01:28

範圍：
- 推進 `CAP-401`，建立手動 smoke checklist 與 capability-based test matrix，並接入 package scripts。

主要變更：
- 新增 `scripts/smoke-checklist.mjs`
- 提供 `--capability` / `--surface` 兩種手動 smoke checklist 入口
- 更新 `package.json`
- 新增 `smoke:webpage`、`smoke:media-url`、`smoke:local-media`、`smoke:desktop`、`smoke:mobile`
- `gate:release` 改為串接 desktop/mobile smoke checklist
- 新增 `docs/smoke-checklist.md`
- 新增 `docs/test-matrix.md`
- 更新 `docs/commands-reference.md`
- 更新 `docs/release-gate.md`
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-401` 的 smoke checklist 與 capability-based test matrix 完成項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke:desktop`
- `npm run smoke:mobile`

### 0.1.38-error-reporting-and-logging-policy - 2026-04-24 01:18

範圍：
- 完成 `CAP-402` 剩餘兩項：debug logging policy 與錯誤訊息層級統一。

主要變更：
- 新增 `src/services/diagnostics/issue-reporting.ts`
- 建立統一的 info / warning / error formatting 與 `SummarizerError` category 映射
- 更新 `src/plugin/AISummarizerPlugin.ts`
- 新增 `reportInfo`、`reportWarning`、`reportError`
- 更新 `src/plugin/commands.ts`、`src/plugin/lifecycle.ts`
- plugin command / lifecycle log 改走統一 reporting API
- 更新 `src/ui/flow-modal/SummarizerFlowModal.ts`
- 流程 warning / error 顯示改走統一 notice / modal / log 分層
- 更新 `src/ui/settings-tab.ts`
- runtime diagnostics 失敗訊息改走同一套 error reporting
- 新增 `tests/unit/issue-reporting.test.ts`
- 覆蓋 deterministic report formatting 與 unknown error fallback
- 新增 `docs/diagnostics-policy.md`
- 文件化 logging policy 與 notice / modal / log / test assertion 分層
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-402` 的兩個剩餘完成項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`

### 0.1.37-runtime-diagnostics-summary - 2026-04-24 01:00

範圍：
- 推進 `CAP-402`，新增 capability detection / diagnostics summary，讓設定頁可直接檢查桌面/行動端環境、cache root 與本機依賴狀態。

主要變更：
- 新增 `src/services/media/runtime-diagnostics.ts`
- 建立 runtime diagnostics 聚合層，收斂 app surface、runtime strategy、cache root、dependency readiness 與 capability summary
- 更新 `src/ui/settings-tab.ts`
- 在設定頁新增「執行環境診斷」區塊與重新檢查按鈕
- 顯示 `webpage_url` / `media_url` / `local_media` 可用性摘要
- 新增 `tests/unit/runtime-diagnostics.test.ts`
- 覆蓋 ready、placeholder_only、cache root validation error 與 summary formatting
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-402` 的 capability detection / diagnostics summary 完成項

驗證：
- `npm run typecheck`
- `npm run test -- tests/unit/runtime-diagnostics.test.ts`

### 0.1.36-ai-summarizer-brand-rename - 2026-04-24 00:17

範圍：
- 將程式與文件中的舊名稱 `Media Summarizer` / `MediaSummarizer...` 全面對齊為 `AI Summarizer` / `AISummarizer...`。

主要變更：
- `src/plugin/MediaSummarizerPlugin.ts` 改名為 `src/plugin/AISummarizerPlugin.ts`
- 更新 `main.ts`、`src/plugin/commands.ts`、`src/plugin/lifecycle.ts`
- 更新 `src/ui/settings-tab.ts`、`src/ui/flow-modal/SummarizerFlowModal.ts`
- `MediaSummarizerPluginSettings` 改名為 `AISummarizerPluginSettings`
- 更新 `package.json` 描述文字與多份專案文件內的舊產品名稱
- 更新 `README.md`、`docs/API_Instructions.md`、`docs/architecture-boundary.md`
- 更新 `docs/backlog-archive.md`、`docs/dev_log.md`、`docs/parity-contract.md`
- 更新 `OBSIDIAN_PLUGIN_REFACTOR_STEPS.md`、`REVIEW_2026-04-21.md`

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`

### 0.1.35-ribbon-entrypoint - 2026-04-24 00:08

範圍：
- 推進 `CAP-302`，新增 Obsidian 左側 ribbon 入口以開啟 `AI 摘要器`。

主要變更：
- 更新 `src/plugin/AISummarizerPlugin.ts`
- 新增 `openFlowModal()`，讓 command/ribbon 共用同一入口行為
- 更新 `src/plugin/commands.ts`
- 新增 `addRibbonIcon("sparkles", "開啟 AI 摘要器", ...)`
- 原有開啟命令改為呼叫 `plugin.openFlowModal()`，消除重複 modal 開啟邏輯
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-302` 的 ribbon 入口完成項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`

### 0.1.34-note-output-and-webpage-metadata-policy - 2026-04-24 00:00

範圍：
- 推進 `CAP-206`，落地 note output metadata contract / path collision policy，並完成 webpage metadata policy。

主要變更：
- 新增 `src/services/web/webpage-metadata-policy.ts`
- 定義網頁 metadata policy：`Platform` 強制 `Web`、`Source` 強制 input URL、`Created` 無效時重建
- 更新 `src/orchestration/process-webpage.ts`
- 在 metadata extractor 後導入 policy，並把 policy warning 併入 job warnings
- 新增 `src/services/obsidian/note-output-contract.ts`
- 定義 note metadata 正規化（title/creator/platform/source/created）與 warning 回傳
- 更新 `src/services/obsidian/path-resolver.ts`
- 新增 `resolveUniqueNotePathWithDiagnostics`，回傳 `collisionCount` 與 `normalizedTitle`
- 更新 `src/services/obsidian/note-writer.ts`
- 導入 metadata contract + path collision diagnostics，將 warning 回傳到 `WriteResult`
- 更新 `src/services/obsidian/template-resolver.ts`
- default frontmatter 改為安全引號輸出（避免未轉義字元破壞格式）
- 新增單元測試：
  - `tests/unit/webpage-metadata-policy.test.ts`
  - `tests/unit/note-output-contract.test.ts`
  - `tests/unit/path-resolver.test.ts`
  - `tests/unit/note-writer.test.ts`
- 更新 `tests/integration/process-webpage.integration.test.ts`
- 驗證 metadata policy warning 可在整合流程中觀測
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-206` 的 note metadata/path collision 與 webpage metadata policy 兩項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`

### 0.1.33-artifact-retention-lifecycle - 2026-04-23 20:38

範圍：
- 推進 `CAP-206`，落地 retention matrix 與 cleanup/recovery 成功/失敗/取消責任分界。

主要變更：
- 新增 `src/services/media/artifact-retention.ts`
- 建立 retention 決策與 cleanup 執行器（`none` / `source` / `all` + `completed` / `failed` / `cancelled`）
- 更新 `src/orchestration/process-media-url.ts`
- 導入 artifact retention cleanup，成功流程與例外流程都會執行對應 lifecycle cleanup
- 更新 `src/orchestration/process-local-media.ts`
- 導入同樣 cleanup 機制，與 media URL flow 對齊
- 新增 `tests/unit/artifact-retention.test.ts`
- 覆蓋 retention plan、failed/cancelled recovery 保留策略、cleanup 失敗警告
- 更新 `docs/media-acquisition-spec.md`
- 補齊 retention matrix 與 cleanup/recovery 邊界說明
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-206` 的 retention matrix 與 cleanup/recovery 兩項

驗證：
- `npm run typecheck`
- `npm run test`
- `npm run build`

### 0.1.32-ai-output-contract-normalization - 2026-04-23 18:31

範圍：
- 完成 `CAP-205` 剩餘兩項：共用 AI output contract 與 `API_Instructions.md` 規則映射。

主要變更：
- 新增 `src/services/ai/ai-output-normalizer.ts`
- 建立跨輸入共用的 AI output 正規化層（media / webpage）
- 規則包含：summary H2 起始層級正規化、heading 後空行收斂、emoji 過濾、transcript `[] -> {}` 時間標記正規化
- 更新 `src/orchestration/process-media.ts`
- media summarizing 後導入 output normalizer，再進入 note writer
- 更新 `src/orchestration/process-webpage.ts`
- webpage summarizing 後導入 output normalizer，再進入 note writer
- 新增 `tests/unit/ai-output-normalizer.test.ts`
- 覆蓋 media/webpage 正規化與 already-compliant 情境
- 更新 `tests/integration/process-media.integration.test.ts`
- 調整 warning 斷言並驗證 AI output contract warning 已回傳
- 更新 `docs/API_Instructions.md`
- 補上 output normalizer 與 orchestration 實際映射位置
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-205` 最後兩項完成

驗證：
- `npm run typecheck`
- `npm run test`

### 0.1.31-media-chunking-and-token-control - 2026-04-23 17:49

範圍：
- 推進 `CAP-205`，補齊長內容 chunking / merge 與 token control 能力層。

主要變更：
- 新增 `src/services/ai/media-summary-chunking.ts`
- 建立 transcript chunk 切分策略（依字元上限切塊）與 chunk 摘要合併輸出
- 建立 normalized text 截斷策略（single-call 與 chunk-mode）
- 更新 `src/orchestration/process-media.ts`
- media summarizing 階段改由 `summarizeMediaWithChunking` 執行
- 新增 `tests/unit/media-summary-chunking.test.ts`
- 覆蓋單段流程、chunk 流程、token control 截斷流程
- 更新 `tests/integration/process-media.integration.test.ts`
- 新增大 transcript 情境，驗證 chunking 會觸發多次 summarize 與合併 warning
- 更新 `docs/backlog-active.md`
- 勾選 `CAP-205` 的 chunking / merge / token control 完成項

驗證：
- `npm run typecheck`
- `npm run test`

### 0.1.30-media-orchestration-boundary - 2026-04-23 16:24

範圍：
- 推進 `CAP-205`，建立 media 主流程 orchestration 邊界，串接 runtime/AI/note writer。

主要變更：
- 新增 `src/orchestration/process-media.ts`
- 建立 media 主線：`validating -> acquiring(runtime) -> summarizing(ai) -> writing(note)`
- 支援 `media_url` 與 `local_media` 兩種輸入，共用同一條 summary/note 輸出能力層
- 新增 `tests/integration/process-media.integration.test.ts`
- 覆蓋 media URL 成功流程、local media 成功流程與 validation error
- 更新 `docs/backlog-active.md`
- 將 `CAP-204` 四個 Open Work 項目勾選完成，並勾選 `CAP-205` 第一項 orchestration 邊界
- 更新 `docs/media-acquisition-spec.md`
- 補 `Local Media v1` 支援格式、大小上限與錯誤分類規格

驗證：
- `npm run typecheck`
- `npm run test`

### 0.1.28-cap-203-integration-coverage - 2026-04-23 10:12

範圍：
- 補齊 `CAP-203` 尚未勾選的整合測試與品質回退驗收覆蓋。

主要變更：
- 更新 `tests/integration/process-media-url.integration.test.ts`
- 新增 pre-upload 壓縮失敗路徑（`download_failure`）整合測試。
- 更新 `tests/unit/pre-upload-compressor.test.ts`
- 新增第二個品質回退案例（Opus/AAC 失敗後回退到 FLAC）。
- 更新 `docs/backlog-active.md`
- 將 `CAP-203` 的 integration tests 與「至少 2 個回退案例」驗收項勾選完成。

驗證：
- `npm run typecheck`
- `npm run test`

### 0.1.27-chunk-payload-and-runtime-bridge - 2026-04-23 08:22

蝭?嚗?
- 推進 `CAP-203` chunk/payload 邊界，並讓 `local_bridge` runtime 接上 media URL 主線。

銝餉?霈嚗?
- 更新 `src/services/media/pre-upload-compressor.ts`
- 新增長音訊 chunk 處理（segment split）、`chunkCount`、`chunkDurationsMs`、`vadApplied`（v1 固定 `false`）
- 更新 `src/orchestration/process-media-url.ts`
- `TranscriptReadyPayload` 新增 `chunkCount`、`chunkDurationsMs`、`vadApplied`、`selectedCodec`
- 更新 `src/runtime/local-bridge-runtime.ts`
- `processMediaUrl` 由 `runtime_unavailable` 改為執行 acquisition + pre-upload handoff 主線
- 新增 `tests/unit/local-bridge-runtime.test.ts`
- 更新 `tests/unit/pre-upload-compressor.test.ts`（新增 chunk 行為測試）
- 更新 `tests/integration/process-media-url.integration.test.ts`（驗證 chunk/payload 欄位）
- 更新 `src/domain/types.ts` 的 media URL request 擴充欄位（`mediaCacheRoot`/`vaultId`/`mediaCompressionProfile`）
- 更新 `docs/backlog-active.md` 的 CAP-203 runtime handoff 驗收項

撽?嚗?
- `npm run typecheck` ??
- `npm run test` ??嚗?36 tests嚗?

### 0.1.26-pre-upload-compressor-and-handoff - 2026-04-23 00:49

範圍：
- 推進 `CAP-203`，落地 pre-upload 壓縮服務並接入 `process-media-url` handoff。

主要變更：
- 新增 `src/services/media/pre-upload-compressor.ts`
- 建立 `normalized.wav` 產生與 AI 上傳壓縮流程（`balanced`: Opus -> AAC -> FLAC；`quality`: FLAC）
- 建立回退策略與錯誤映射（`cancellation`、`runtime_unavailable`、`download_failure`）
- 更新 `src/orchestration/process-media-url.ts`，接入 pre-upload 壓縮步驟
- `TranscriptReadyPayload` 新增 `aiUploadArtifactPaths`，並將壓縮 warnings 併入回傳
- 新增 `tests/unit/pre-upload-compressor.test.ts`（成功、回退、全失敗、runtime 缺失、取消）
- 更新 `tests/integration/process-media-url.integration.test.ts`，覆蓋 pre-upload handoff 與 stage/warning 行為
- 更新 `docs/backlog.md`、`docs/backlog-active.md` 的 CAP-203 完成項目

驗證：
- `npm run typecheck` 通過
- `npm run test` 通過（34 tests）

### 0.1.25-process-media-url-orchestration - 2026-04-23 00:41

範圍：
- 續推 `CAP-203`，新增 `process-media-url` orchestration 主線與 transcript-ready payload。

主要變更：
- 新增 `src/orchestration/process-media-url.ts`
- 以 `runJobStep` 串接 `validating -> acquiring` 階段，整合 `prepareSession` 與 `downloadMedia`
- 新增 `ProcessMediaUrlInput`、`TranscriptReadyPayload`、`ProcessMediaUrlResult`
- 將下載結果 metadata 與 artifact path 收斂為 transcript-ready payload，供後續 AI pipeline handoff
- 新增 `tests/integration/process-media-url.integration.test.ts`
- 驗證成功流程、`validation_error`、`cancellation` 三種路徑

驗證：
- `npm run typecheck` 通過
- `npm run test -- tests/integration/process-media-url.integration.test.ts` 通過

### 0.1.24-cap-202-boundary-hardening - 2026-04-23 00:15

範圍：
- 完成 `CAP-202` 尚未落地的 session isolation、安全恢復邊界、下載 cancellation 串接與 metadata normalization。

主要變更：
- 更新 `src/services/media/downloader-adapter.ts`
- `yt-dlp` 下載改為結構化輸出解析，只允許當前 session 內路徑做 artifact 恢復
- 下載成功與恢復後，正規化 `Title`、`Creator/Author`、`Platform`、`Source`、`Created` 並落盤 `metadata.json`
- 預設命令執行器改為可中止子程序樹（Windows `taskkill /T`、POSIX process group kill）
- metadata 寫檔失敗映射為 `download_failure`
- 更新 `tests/unit/downloader-adapter.test.ts`，補 metadata、session isolation、cancellation、錯誤分類測試
- 更新 `docs/backlog.md`、`docs/backlog-active.md` 的 CAP-202 勾選狀態

驗證：
- `npm run typecheck` 通過
- `npm run test` 通過（26 tests）

### 0.1.23-yt-dlp-download-execution - 2026-04-22 08:54

範圍：

- 完成 `CAP-202` 的 `yt-dlp` 實際下載執行與假失敗恢復能力

主要變更：

- 更新 `src/services/media/downloader-adapter.ts`
- 新增 `downloadMedia`，可執行 `yt-dlp` 下載並回傳 session 內 `downloaded.*` 實際路徑
- 新增 session 內 artifact 解析邏輯，禁止掃描全域下載目錄
- 新增 `yt-dlp` 非零退出碼時的恢復邏輯：若 artifact 已存在則標記 recovered 並回傳 warning
- 加入錯誤分類：`cancellation`、`runtime_unavailable`、`download_failure`
- 擴充 `tests/unit/downloader-adapter.test.ts`，新增成功、恢復、失敗、取消與缺命令情境
- 更新 `docs/backlog.md`、`docs/backlog-active.md` 勾選已完成項目

驗證：

- `npm run typecheck` 通過
- `npm run test` 通過（22 tests）

### 0.1.22-remove-current-track-doc - 2026-04-22 08:34

範圍：

- 將 `docs/current-implementation-track.md` 整併進 `docs/backlog-active.md`，並更新所有導航引用

主要變更：

- 在 `docs/backlog-active.md` 新增主線摘要區塊：目前階段、唯一主線、阻塞與切換點
- 刪除 `docs/current-implementation-track.md`
- 更新 `README.md`、`docs/docs-governance.md`、`docs/project-setup-sop.md`
- 更新 `docs/commands-reference.md`、`.codex/SKILL.md`、`.codex/references/docs-governance.md`
- 更新 `templates/backlog-active.template.md`，使 active backlog 模板內建主線摘要

驗證：

- 以全文搜尋確認導航文件不再引用 `docs/current-implementation-track.md`

### 0.1.21-backlog-navigation-refactor - 2026-04-22 08:28

範圍：

- 將 backlog 重構為 `master / active / archive` 三層，並同步修正所有導航規範文件

主要變更：

- `docs/backlog.md` 改為完整待辦總表
- 新增 `docs/backlog-active.md`，集中目前正在做與近期要做的 capability
- 新增 `docs/backlog-archive.md`，只保留已完成能力
- 更新 `docs/docs-governance.md`、`docs/project-setup-sop.md`、`docs/current-implementation-track.md`
- 更新 `docs/commands-reference.md`、`docs/workflow-sop.md`、`README.md`
- 更新 `.codex/SKILL.md` 與 `.codex/references/docs-governance.md`
- 更新 `templates/backlog.template.md`，並新增 active / archive backlog templates

驗證：

- 以全文搜尋確認舊的 backlog 導航引用已改為三層邏輯

### 0.1.20-downloader-adapter-session-planning - 2026-04-22 07:40

範圍：

- 完成 TRACK-007 的 downloader adapter 第一版（session 規劃與 artifact path 生成）

主要變更：

- 新增 `src/services/media/downloader-adapter.ts`
- `prepareSession` 整合 dependency readiness、URL 分類、cache root 解析與 session 目錄建立
- 新增 `tests/unit/downloader-adapter.test.ts`
- 修正 `tests/unit/url-classifier.test.ts` 斷言寫法，對齊 Vitest 目前可用 matcher
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run test` 通過

### 0.1.19-media-url-validation-and-classification - 2026-04-22 07:16

範圍：

- 完成 TRACK-007 的 media URL 驗證與來源分類（youtube / podcast / direct media）

主要變更：

- 新增 `src/services/media/url-classifier.ts`
- 新增 `classifyMediaUrl`，支援 YouTube、podcast 平台、direct media 副檔名辨識
- 新增 `tests/unit/url-classifier.test.ts`
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run test` 通過

### 0.1.18-dependency-readiness-checker - 2026-04-22 07:14

範圍：

- 完成 TRACK-007 的外部依賴 readiness 檢查與錯誤映射

主要變更：

- 新增 `src/services/media/dependency-readiness.ts`
- 新增 `runMediaDependencyReadinessCheck` 與 `assertMediaDependenciesReady`
- 更新 `src/runtime/local-bridge-runtime.ts`，media 入口先檢查 `yt-dlp`、`ffmpeg`、`ffprobe`
- 新增 `tests/unit/dependency-readiness.test.ts`
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run test` 通過

### 0.1.17-media-cache-root-validation-and-resolution - 2026-04-22 01:00

範圍：

- 完成 TRACK-007 的 `mediaCacheRoot` 絕對路徑驗證、可寫性檢查與 cache root resolution

主要變更：

- 新增 `src/services/media/media-cache-root.ts`
- 新增 `validateMediaCacheRootPath`、`resolveDefaultMediaCacheRoot`、`resolveMediaCacheRoot`
- 新增 writable probe（建立目錄、寫入暫存檔、清理）
- 更新 `src/plugin/AISummarizerPlugin.ts`，提供 `resolveMediaCacheRootOrThrow`
- 更新 `src/ui/settings-tab.ts` 路徑欄位說明文案（自訂值需為絕對路徑）
- 新增 `tests/unit/media-cache-root.test.ts`
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run test` 通過

### 0.1.16-track-007-planning-hardening - 2026-04-22 00:54

範圍：

- 強化 TRACK-007 的架構一致性與可驗收性（依賴 readiness、量化門檻、文件同步）

主要變更：

- 更新 `docs/backlog.md`，新增外部依賴 readiness 任務與錯誤映射任務
- 更新 `docs/backlog.md`，將 TRACK-007 完成條件改為可量測門檻
- 更新 `docs/media-acquisition-spec.md`，新增 dependency readiness 規格與品質守門量化門檻
- 更新 `docs/architecture-boundary.md`，同步 `RuntimeProvider.strategy` 邊界與新版優先序
- 更新 `docs/current-implementation-track.md`

驗證：

- 文件一致性人工檢查完成

### 0.1.15-track-007-settings-fields - 2026-04-22 00:26

範圍：

- 落地 TRACK-007 所需 settings 欄位（`mediaCacheRoot`、`mediaCompressionProfile`）的基礎儲存與 UI

主要變更：

- 更新 `src/domain/settings.ts`，新增 `MediaCompressionProfile` 與對應預設值
- 更新 `src/ui/settings-tab.ts`，新增 `mediaCacheRoot` 文字欄位與 `mediaCompressionProfile` 下拉選單
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過

### 0.1.14-runtime-strategy-local-bridge - 2026-04-22 00:24

範圍：

- 將 `RuntimeProvider` 的 media v1 策略正式定案為 `local_bridge`，並落地策略邊界

主要變更：

- 更新 `src/domain/settings.ts`，新增 `RuntimeStrategy` 與 `runtimeStrategy` 設定欄位（預設 `local_bridge`）
- 更新 `src/runtime/runtime-provider.ts`，在介面加入 `strategy` 邊界
- 更新 `src/runtime/placeholder-runtime.ts`，補齊 `strategy = placeholder_only`
- 新增 `src/runtime/local-bridge-runtime.ts` 作為 media v1 strategy 入口
- 新增 `src/runtime/runtime-factory.ts`，以策略建立對應 RuntimeProvider
- 更新 `Discussion.md`、`docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過

### 0.1.13-api-instructions-prompt-alignment - 2026-04-22 00:17

範圍：

- 將 `docs/API_Instructions.md` 的所有摘要與逐字稿規範整合為目前專案可直接執行的 prompt contract

主要變更：

- 更新 `src/domain/prompts.ts`，將摘要、網頁摘要與逐字稿規則改為完整提示詞常數
- 更新 `src/services/ai/prompt-builder.ts`，加入明確輸入區塊與中文 metadata 標籤
- 更新 `docs/API_Instructions.md`，修正技術實作位置為目前 TypeScript 架構
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- 文件與程式碼語意已人工對齊

### 0.1.12-pre-upload-compression-policy - 2026-04-22 00:11

範圍：

- 定案 `media URL` 在送 AI 前的壓縮與分段策略，以降低上傳傳輸與成本

主要變更：

- 更新 `docs/media-acquisition-spec.md`，新增 `ai-upload` 產物規格
- 更新 `docs/media-acquisition-spec.md`，新增預設 `balanced` 壓縮 profile（mono 16kHz + Opus 24~32 kbps）
- 更新 `docs/media-acquisition-spec.md`，新增 chunk、VAD 與品質回退（Opus -> AAC -> FLAC）規則
- 更新 `docs/backlog.md`，加入 `pre-upload-compressor`、壓縮 profile 與回退測試任務
- 更新 `docs/current-implementation-track.md`、`Discussion.md` 同步決策

驗證：

- 文件一致性人工檢查完成
- TRACK-007 任務拆分已可直接進入實作

### 0.1.11-external-media-cache-root-decision - 2026-04-22 00:01

範圍：

- 定案 `media URL` 下載產物改為預設不寫入 vault，並提供使用者自選外部存放路徑

主要變更：

- 更新 `Discussion.md`，新增已定案項目（外部可選擇 media cache root）
- 更新 `docs/media-acquisition-spec.md`，加入 `mediaCacheRoot` 設定與 OS 預設 cache 路徑策略
- 更新 `docs/backlog.md`，加入 `mediaCacheRoot` 設定與 cache root resolution 任務
- 更新 `docs/current-implementation-track.md`，同步主線最新決策

驗證：

- 文件一致性人工檢查完成
- TRACK-007 規格與待辦項已對齊

### 0.1.10-media-acquisition-format-spec - 2026-04-21 23:32

範圍：

- 為 TRACK-007 預先定案下載格式與存放路徑規格

主要變更：

- 新增 `docs/media-acquisition-spec.md`
- 定義 YouTube/podcast/direct media 的下載產物格式
- 定義 session 目錄結構與命名規則
- 定義 retention 模式對應與安全恢復規格
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- 文件一致性人工檢查完成
- 規格已對齊 TRACK-007 任務範圍

### 0.1.9-ui-zh-tw-and-vault-command-policy - 2026-04-21 23:23

範圍：

- 將 plugin 主要 UI 文案改為繁體中文
- 將「每次同步到 Obsidian Vault」納入正式指令規範

主要變更：

- 更新 `src/plugin/commands.ts`（Command Palette 指令名稱中文化）
- 更新 `src/ui/settings-tab.ts`（設定頁標題、欄位、描述中文化）
- 更新 `src/ui/flow-modal/SummarizerFlowModal.ts`（flow modal 文案中文化）
- 更新 `docs/commands-reference.md`，新增 Vault 同步規範
- 更新 `package.json`，新增 `check:build:vault`、`gate:local:vault`

驗證：

- `npm run typecheck` 通過
- `npm run build` 通過
- `npm run test` 通過（2 tests passed）
- `npm run check:build:vault` 通過
- `npm run gate:local:vault` 通過

### 0.1.8-smoke-test-passed - 2026-04-21 16:20

範圍：

- 完成 Obsidian 手動 smoke 驗證並收斂目前主線驗收狀態

主要變更：

- 更新 `docs/backlog.md`，勾選 TRACK-002 完成條件
- 更新 `docs/backlog.md`，勾選 TRACK-005 手動 smoke 完成條件
- 更新 `docs/backlog.md`，勾選 TRACK-006 完成條件
- 更新 `docs/current-implementation-track.md`，主線切換到 TRACK-007

驗證：

- Obsidian 手動 smoke 全部通過
- plugin 可見
- commands 可見
- settings 可儲存與讀回
- UI 可啟動 webpage flow，成功/失敗/取消可區分

### 0.1.7-track-006-minimal-ui-flow - 2026-04-21 16:10

範圍：

- 完成 `TRACK-006 Minimal UI Flow` 的第一版可互動介面

主要變更：

- 建立 `src/ui/flow-modal/SummarizerFlowModal.ts`
- 更新 `src/plugin/commands.ts`，`open-ai-summarizer` 直接開啟 flow modal
- UI 提供 source input / progress / result / cancel 的狀態呈現
- flow modal 可觸發 mocked webpage orchestration（成功、失敗、取消）
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run build` 通過
- `npm run test` 通過（2 tests passed）
- Obsidian 手動 smoke：尚未執行

### 0.1.6-track-005-webpage-flow - 2026-04-21 15:58

範圍：

- 完成 `TRACK-005 First End-to-End Webpage Flow` 的 orchestrator 與 mocked integration 測試

主要變更：

- 建立 `src/orchestration/cancellation.ts`
- 建立 `src/orchestration/job-runner.ts`
- 建立 `src/orchestration/process-webpage.ts`
- 建立 `tests/integration/process-webpage.integration.test.ts`
- 建立 `vitest.config.ts` 以支援 alias 路徑解析
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run build` 通過
- `npm run test` 通過（2 tests passed）

### 0.1.5-track-004-core-contracts - 2026-04-21 15:45

範圍：

- 完成 `TRACK-004 Core Contracts And Services`

主要變更：

- 建立 `src/runtime/runtime-provider.ts`
- 建立 `src/runtime/runtime-payloads.ts`
- 建立 `src/runtime/placeholder-runtime.ts`
- 建立 `src/services/ai/ai-provider.ts`
- 建立 `src/services/ai/prompt-builder.ts`
- 建立 `src/services/obsidian/note-writer.ts`
- 建立 `src/services/obsidian/path-resolver.ts`
- 建立 `src/services/obsidian/template-resolver.ts`
- 建立 `src/services/web/webpage-extractor.ts`
- 建立 `src/services/web/metadata-extractor.ts`
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run build` 通過
- `npm run test` 通過（`--passWithNoTests`）

### 0.1.4-track-003-domain-contracts - 2026-04-21 15:32

範圍：

- 完成 `TRACK-003 Domain Contracts`，並讓 plugin settings 型別接入 domain

主要變更：

- 建立 `src/domain/types.ts`
- 建立 `src/domain/settings.ts`
- 建立 `src/domain/errors.ts`
- 建立 `src/domain/jobs.ts`
- 建立 `src/domain/prompts.ts`
- 更新 `src/plugin/AISummarizerPlugin.ts`，使用 `domain/settings`
- 更新 `src/ui/settings-tab.ts`，使用 `domain/types`
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run build` 通過
- `npm run test` 通過（`--passWithNoTests`）

### 0.1.3-track-002-shell-and-settings - 2026-04-21 15:20

範圍：

- 完成 `TRACK-002 Plugin Shell And Settings` 的程式碼落地

主要變更：

- 建立 `src/plugin/AISummarizerPlugin.ts`
- 建立 `src/plugin/commands.ts`
- 建立 `src/plugin/lifecycle.ts`
- 建立 `src/ui/settings-tab.ts`
- `main.ts` 改為導出 `AISummarizerPlugin`
- 建立 plugin settings persistence、command 註冊、notice/logging wiring
- 更新 `docs/backlog.md`、`docs/current-implementation-track.md`

驗證：

- `npm run typecheck` 通過
- `npm run build` 通過
- `npm run test` 通過（`--passWithNoTests`）
- Obsidian 手動 smoke：尚未執行

### 0.1.2-track-001-foundation - 2026-04-21 15:02

範圍：

- 完成 `TRACK-001 Project Foundation`

主要變更：

- 建立 `manifest.json`
- 建立 `package.json`
- 建立 `tsconfig.json`
- 建立 `versions.json`
- 建立 `esbuild.config.mjs`
- 建立 `main.ts`
- 安裝最低依賴並產生 `package-lock.json`
- 補齊標準 scripts：`typecheck`、`test`、`build`、`gate:local`
- 更新 `.gitignore`，忽略 build artifact `main.js` / `main.js.map`
- 更新 `docs/backlog.md` 與 `docs/current-implementation-track.md`

驗證：

- `npm install` 通過
- `npm run typecheck` 通過
- `npm run test` 通過（`--passWithNoTests`）
- `npm run build` 通過

### 0.1.1-codex-and-backlog-alignment - 2026-04-21 14:35

範圍：

- 對齊 `.codex` 工作入口與本專案實際架構
- 將 backlog 重排為可逐步施工的依賴順序

主要變更：

- 改寫 `.codex/SKILL.md`，納入 `parity contract`、`webpage flow` 優先與新模組結構
- 改寫 `.codex/agents/core-worker.toml`
- 改寫 `.codex/agents/ui-worker.toml`
- 改寫 `.codex/references/docs-governance.md`
- 改寫 `.codex/references/release-versioning.md`
- 更新 `docs/backlog.md`
- 更新 `docs/current-implementation-track.md`

驗證：

- `.codex` 與 `docs/architecture-boundary.md`、`docs/backlog.md` 已人工對齊檢查
- 程式驗證：尚未開始，因尚未建立 plugin scaffold

### V0.0.01 - 2026-04-21 14:05

範圍：

- 建立可推送到 GitHub 的初始專案基線

主要變更：

- 初始化 git repository 並設定本專案作者資訊為 `GollyKuo <gollykuo@gmail.com>`
- 建立 GitHub remote 並推送 `main`
- 新增 `.gitignore`
- 新增 `.gitattributes`
- 保留目前的文件骨架、討論入口與目錄結構，作為後續 plugin scaffold 的起點

驗證：

- `git status` clean
- `origin/main` push 成功
- 文件骨架已完成人工檢查

### 0.1.0-architecture-foundation - 2026-04-21 13:40

範圍：

- 將 repo 從通用規範包收斂為 `AI Summarizer Obsidian Plugin` 專案骨架

主要變更：

- 改寫 `README.md`
- 改寫 `docs/architecture-boundary.md`
- 改寫 `docs/project-setup-sop.md`
- 改寫 `docs/docs-governance.md`
- 建立 `docs/parity-contract.md`
- 建立 `docs/current-implementation-track.md`
- 建立 `docs/backlog.md`
- 建立 `docs/dev_log.md`
- 更新 `Discussion.md`

驗證：

- 文件一致性：人工檢查完成
- 程式驗證：尚未開始，因尚未建立可執行 scaffold



