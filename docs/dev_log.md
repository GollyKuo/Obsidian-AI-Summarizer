# 開發日誌

最後更新：2026-04-22 08:54

## 版本紀錄

### 0.1.26-pre-upload-compressor-and-handoff - 2026-04-23 00:49

蝭?嚗?
- 推進 `CAP-203`，落地 pre-upload 壓縮服務並接入 `process-media-url` handoff。

銝餉?霈嚗?
- 新增 `src/services/media/pre-upload-compressor.ts`
- 建立 `normalized.wav` 產生與 AI 上傳壓縮流程（`balanced`: Opus -> AAC -> FLAC；`quality`: FLAC）
- 建立回退策略與錯誤映射（`cancellation`、`runtime_unavailable`、`download_failure`）
- 更新 `src/orchestration/process-media-url.ts`，接入 pre-upload 壓縮步驟
- `TranscriptReadyPayload` 新增 `aiUploadArtifactPaths`，並將壓縮 warnings 併入回傳
- 新增 `tests/unit/pre-upload-compressor.test.ts`（成功、回退、全失敗、runtime 缺失、取消）
- 更新 `tests/integration/process-media-url.integration.test.ts`，覆蓋 pre-upload handoff 與 stage/warning 行為
- 更新 `docs/backlog.md`、`docs/backlog-active.md` 的 CAP-203 完成項目

撽?嚗?
- `npm run typecheck` ??
- `npm run test` ??嚗?34 tests嚗?

### 0.1.25-process-media-url-orchestration - 2026-04-23 00:41

蝭?嚗?
- 續推 `CAP-203`，新增 `process-media-url` orchestration 主線與 transcript-ready payload。

銝餉?霈嚗?
- 新增 `src/orchestration/process-media-url.ts`
- 以 `runJobStep` 串接 `validating -> acquiring` 階段，整合 `prepareSession` 與 `downloadMedia`
- 新增 `ProcessMediaUrlInput`、`TranscriptReadyPayload`、`ProcessMediaUrlResult`
- 將下載結果 metadata 與 artifact path 收斂為 transcript-ready payload，供後續 AI pipeline handoff
- 新增 `tests/integration/process-media-url.integration.test.ts`
- 驗證成功流程、`validation_error`、`cancellation` 三種路徑

撽?嚗?
- `npm run typecheck` ??
- `npm run test -- tests/integration/process-media-url.integration.test.ts` ??

### 0.1.24-cap-202-boundary-hardening - 2026-04-23 00:15

蝭?嚗?
- 完成 `CAP-202` 尚未落地的 session isolation、安全恢復邊界、下載 cancellation 串接與 metadata normalization。

銝餉?霈嚗?
- 更新 `src/services/media/downloader-adapter.ts`
- `yt-dlp` 下載改為結構化輸出解析，只允許當前 session 內路徑做 artifact 恢復
- 下載成功與恢復後，正規化 `Title`、`Creator/Author`、`Platform`、`Source`、`Created` 並落盤 `metadata.json`
- 預設命令執行器改為可中止子程序樹（Windows `taskkill /T`、POSIX process group kill）
- metadata 寫檔失敗映射為 `download_failure`
- 更新 `tests/unit/downloader-adapter.test.ts`，補 metadata、session isolation、cancellation、錯誤分類測試
- 更新 `docs/backlog.md`、`docs/backlog-active.md` 的 CAP-202 勾選狀態

撽?嚗?
- `npm run typecheck` ??
- `npm run test` ??嚗?26 tests嚗?

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
- 更新 `src/plugin/MediaSummarizerPlugin.ts`，提供 `resolveMediaCacheRootOrThrow`
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
- 更新 `src/plugin/MediaSummarizerPlugin.ts`，使用 `domain/settings`
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

- 建立 `src/plugin/MediaSummarizerPlugin.ts`
- 建立 `src/plugin/commands.ts`
- 建立 `src/plugin/lifecycle.ts`
- 建立 `src/ui/settings-tab.ts`
- `main.ts` 改為導出 `MediaSummarizerPlugin`
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

- 將 repo 從通用規範包收斂為 `Media Summarizer Obsidian Plugin` 專案骨架

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
