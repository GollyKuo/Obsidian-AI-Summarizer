# Documentation Maintenance

最後更新：2026-05-02 00:15

## 用途

本文件是專案文件維護與同步規則的正式來源。

核心原則：

`backlog` 是本軟體所有功能、能力狀態與排程邊界的完整紀錄。任何功能、流程、使用者可見行為、輸出格式、provider 策略、prompt contract、artifact lifecycle、runtime/adapter 邊界或 release gate 有調整時，都必須同步檢查並更新 backlog 與相關規格文件。

## 文件定位

- `README.md`
  - 專案入口、主要文件導覽與開發基線。
- `Discussion.md`
  - 尚未定案的討論、取捨與決策背景。
- `docs/documentation-maintenance.md`
  - 文件維護、backlog 同步與相關規格文件同步規則的正式來源。
- `docs/architecture-boundary.md`
  - 架構邊界、責任分層與模組 ownership。
- `docs/parity-contract.md`
  - 與原 Python app 的能力對齊契約。
- `docs/API_Instructions.md`
  - prompt contract、AI 輸出格式與摘要規範。
- `docs/media-acquisition-spec.md`
  - media acquisition、AI-ready artifact、transcript/subtitle 與 retention 規格。
- `docs/Manual.md`
  - 使用者安裝、設定、操作、smoke test 與 vault sync 手冊。
- `docs/dev_log.md`
  - 版本節點、完成內容與重要變更紀錄。
- `docs/test-matrix.md`
  - 自動化與能力矩陣測試規劃。
- `docs/smoke-checklist.md`
  - 手動 smoke checklist。
- `docs/release-gate.md`
  - release 放行條件、gate 與失敗處理 SOP。
- `docs/versioning-policy.md`
  - 版本節點、dev log 與版本號同步規則。

## Backlog 分工

- [backlog.md](backlog.md)
  - capability 級總表、全局狀態與排程視角。
  - 不放細部 checklist。
- [backlog-active.md](backlog-active.md)
  - 目前主線、近期任務、open work 與可執行 checklist。
  - 只追蹤仍需日常處理的項目。
- [backlog-archive.md](backlog-archive.md)
  - 已完成且仍有架構參考價值的能力層、歷史邊界與重要決策。

任一 backlog 檔案被修改時，必須同時檢查三者是否有狀態、摘要、完成/封存邊界或排程邏輯衝突。

## 必須同步的情境

### 功能或行為調整

當實作或決策改變軟體功能、使用者可見行為、資料流、錯誤處理、輸出格式或操作流程時：

- 更新 `docs/backlog.md` 的 capability 狀態或摘要。
- 更新 `docs/backlog-active.md` 的 open work、驗收點或 release checklist。
- 若能力完成且不再需要日常追蹤，移入 `docs/backlog-archive.md`。
- 更新受影響的規格文件，例如 `docs/media-acquisition-spec.md`、`docs/API_Instructions.md`、`docs/Manual.md`、`docs/test-matrix.md`、`docs/release-gate.md`。

### Prompt 或 AI 輸出規則調整

當 prompt、摘要規範、AI 輸出格式、chunking 策略或 provider routing 有變更時：

- 更新 `docs/API_Instructions.md`。
- 更新對應 TypeScript prompt 實作，例如 `src/domain/prompts.ts` 或 prompt builder。
- 更新 `docs/backlog.md` / `docs/backlog-active.md` 中對應 capability。
- 若影響使用方式，更新 `docs/Manual.md`。

### Media artifact 或 retention 調整

當 media acquisition、壓縮、chunk、transcript、subtitle、artifact retention 或 cleanup 行為有變更時：

- 更新 `docs/media-acquisition-spec.md`。
- 更新 `docs/backlog.md` / `docs/backlog-active.md`。
- 若已完成決策或能力，更新 `docs/backlog-archive.md`。
- 若影響測試或 release gate，更新 `docs/test-matrix.md`、`docs/smoke-checklist.md` 或 `docs/release-gate.md`。

### 架構邊界或 adapter 調整

當 runtime、adapter、orchestration、service ownership 或資料契約改變時：

- 更新 `docs/architecture-boundary.md`。
- 更新 backlog 對應 capability。
- 若涉及舊版行為對齊，更新 `docs/parity-contract.md`。

### 版本節點或完成紀錄

當變更形成版本節點、重要完成項目或 release 候選時：

- 更新 `docs/dev_log.md`。
- 依 `docs/versioning-policy.md` 檢查是否需要同步版本號。

## 文件維護流程

實作前：

1. 先讀 [backlog-active.md](backlog-active.md)，確認目前主線與 open work。
2. 若需要全局排程視角，讀 [backlog.md](backlog.md)。
3. 判斷本次變更會影響哪些正式文件。

實作後：

1. 檢查 changed files 是否在預期範圍。
2. 檢查 backlog 三檔是否需要同步。
3. 檢查相關規格、手冊、測試矩陣、release gate 是否需要同步。
4. 若完成項目，將 `[x]` 標示完成時間，格式固定為 `（完成：YYYY-MM-DD HH:mm）`。
5. 對中文文件修改後，依 [encoding-safety.md](encoding-safety.md) 做編碼安全檢查。

## Reference 文件規則

`.codex/references/` 是 agent 快速操作摘要，不是正式規範來源。

- 正式規範以 `docs/` 內文件為準。
- `.codex/references/documentation-maintenance.md` 只保存本文件的精簡執行 checklist。
- 不再維護 `docs/docs-governance.md` 或 `.codex/references/docs-governance.md`，避免文件治理規則分裂成兩份。

## 禁止模式

1. 只改實作，不同步 backlog 與受影響文件。
2. 只改其中一個 backlog 檔，卻未檢查另外兩個 backlog 檔。
3. 把 capability 細 checklist 寫進 `docs/backlog.md`。
4. 把已完成且不再追蹤的內容留在 `docs/backlog-active.md`。
5. 把 future / queued / parking 項目塞進 `docs/backlog-archive.md`。
6. 把未定案討論直接寫成 architecture rule。
7. 在 `.codex/references/` 建立與 `docs/` 正式規範互相競爭的第二套規則。
