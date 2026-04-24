# Release Build Vault SOP

最後更新：2026-04-24 09:26

## 適用範圍

本 SOP 統一以下流程：

1. build
2. test
3. commit
4. release gate
5. vault sync

## 開發迭代 SOP

1. 修改程式與測試
2. `npm run gate:local`
3. 若改 `webpage` 主線，跑 `npm run gate:regression:desktop`
4. 若改 UI，跑 `npm run gate:local:vault` 或 `build:vault:target`
5. 更新 `docs/backlog-active.md` 與 `docs/dev_log.md`
6. commit

## Commit Gate

每次 commit 前至少確認：

1. `git status` 只有預期檔案
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`

若是 docs-only 變更，可免跑 build/test，但要在 commit 訊息或 dev log 註明。

## Vault Sync SOP

### 固定測試 Vault

1. `npm run dev:vault`
2. `npm run build:vault`
3. `npm run gate:local:vault`

### 指定 Vault

1. `npm run dev:vault:target -- --vault "D:\\Your\\Vault"`
2. `npm run build:vault:target -- --vault "D:\\Your\\Vault"`

或設定環境變數：

1. `AI_SUMMARIZER_VAULT_PATH=D:\\Your\\Vault`
2. `npm run build:vault:target`

## Release SOP

1. `npm run gate:release`
2. 檢查 smoke checklist 是否已覆蓋本次能力變更
3. 更新 `docs/dev_log.md`
4. 確認 `README` / `commands-reference` / `user-manual` 是否需同步
5. 建立 release commit

## Automation Policy

CI workflow：`.github/workflows/release-gate.yml`

1. PR 必須通過 `release-gate` job
2. `main` push 會重跑一次 release gate
3. 若 CI 綠但桌面 smoke 未做，不可視為完整放行
