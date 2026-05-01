# Documentation Maintenance Reference

正式來源：
`docs/documentation-maintenance.md`

本檔只給 Codex 快速檢查使用，不是第二套正式規範。若內容與 `docs/documentation-maintenance.md` 不一致，以 `docs/documentation-maintenance.md` 為準。

## 核心規則

`backlog` 是本軟體所有功能、能力狀態與排程邊界的完整紀錄。

任何功能、流程、使用者可見行為、輸出格式、provider 策略、prompt contract、artifact lifecycle、runtime/adapter 邊界或 release gate 有調整時，都必須同步檢查：

- backlog 三檔
- 受影響的正式規格文件
- 使用手冊、測試矩陣、release gate 或 dev log 是否需要更新

## Backlog 分工

- `docs/backlog.md`
  - capability 級總表、全局狀態與排程視角。
  - 不放細部 checklist。
- `docs/backlog-active.md`
  - 目前主線、近期任務、open work 與可執行 checklist。
- `docs/backlog-archive.md`
  - 已完成能力、歷史邊界與已定案決策。

任一 backlog 檔案被修改時，都要檢查三者是否有狀態、摘要、完成/封存邊界或排程邏輯衝突。

## 同步檢查

- capability 狀態或摘要改變：更新 `docs/backlog.md`。
- 主線、open work、驗收 checklist 改變：更新 `docs/backlog-active.md`。
- 能力完成且不再需要日常追蹤：移入 `docs/backlog-archive.md`。
- prompt、AI 輸出格式、摘要規範改變：更新 `docs/API_Instructions.md` 與 prompt 實作。
- media acquisition、壓縮、chunk、transcript、subtitle、artifact、retention、cleanup 改變：更新 `docs/media-acquisition-spec.md`。
- runtime、adapter、orchestration、ownership 邊界改變：更新 `docs/architecture-boundary.md`。
- 舊版 Python app parity 行為改變：更新 `docs/parity-contract.md`。
- 使用者操作方式改變：更新 `docs/Manual.md`。
- 測試或 release gate 改變：更新 `docs/test-matrix.md`、`docs/smoke-checklist.md` 或 `docs/release-gate.md`。
- 形成版本節點或重要完成紀錄：更新 `docs/dev_log.md`。

## 禁止

- 不可把細部 checklist 寫進 `docs/backlog.md`。
- 不可把已完成且不再追蹤的內容留在 `docs/backlog-active.md`。
- 不可把 queued、parking 或 future 項目放進 `docs/backlog-archive.md`。
- 不可只改實作，卻沒有檢查 backlog 與受影響文件。
- 不可再建立另一份與本檔重複的 reference 文件規則。
