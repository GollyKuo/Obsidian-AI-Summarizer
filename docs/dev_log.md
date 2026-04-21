# 開發日誌

最後更新：2026-04-21 23:23

## 版本紀錄

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
