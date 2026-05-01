# Documentation Maintenance Reference

正式來源：
`docs/documentation-maintenance.md`

本檔是 Codex 使用的文件維護導航，不是第二套正式規範。若本檔與正式文件不一致，以 `docs/documentation-maintenance.md` 為準。

## 何時使用

- 開始功能實作前。
- 完成功能、規格、prompt、provider、artifact lifecycle 或 release gate 調整後。
- 修改 backlog、正式規格文件、使用手冊、測試矩陣或版本檔後。
- commit 前做最後文件同步檢查時。

## 正式文件章節導航

- 文件定位：看 `docs/documentation-maintenance.md#文件定位`
- Backlog 分工：看 `docs/documentation-maintenance.md#backlog-分工`
- 必須同步的情境：看 `docs/documentation-maintenance.md#必須同步的情境`
- dev log 規則：看 `docs/documentation-maintenance.md#版本節點或完成紀錄`
- 文件維護流程：看 `docs/documentation-maintenance.md#文件維護流程`
- Reference 文件規則：看 `docs/documentation-maintenance.md#reference-文件規則`
- 禁止模式：看 `docs/documentation-maintenance.md#禁止模式`

## Codex 快速檢查

1. 是否改了 `src/**` 或 `tests/**`？
2. 是否改了版本檔：`manifest.json`、`package.json`、`package-lock.json`、`versions.json`？
3. 是否改了 backlog 三檔：`docs/backlog.md`、`docs/backlog-active.md`、`docs/backlog-archive.md`？
4. 是否改了正式規格文件：`docs/API_Instructions.md`、`docs/media-acquisition-spec.md`、`docs/architecture-boundary.md`、`docs/parity-contract.md`、`docs/Manual.md`、`docs/test-matrix.md`、`docs/smoke-checklist.md`、`docs/release-gate.md`？
5. 是否需要新增 `docs/dev_log.md` 條目？
6. 若不更新 `docs/dev_log.md`，最終回覆是否明確說明原因？
7. 若 backlog 有任一檔變更，是否已同時檢查三份 backlog 的狀態、摘要、完成/封存邊界與排程邏輯？
8. 若改了中文文件，是否已依 `docs/encoding-safety.md` 做編碼安全檢查？

## 最小原則

- 不在本檔重述完整規則。
- 不在本檔新增與正式文件競爭的文件政策。
- 需要完整判斷時，回到 `docs/documentation-maintenance.md`。
