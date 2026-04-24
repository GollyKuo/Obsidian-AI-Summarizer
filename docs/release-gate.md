# Release Gate

最後更新：2026-04-24 10:06

## 目標

把 release 放行條件固定成可重複的本地流程與 CI 流程，降低「只在本機通過」或「忘記跑 smoke」的風險。

## 本地放行順序

1. `npm run check:types`
2. `npm run check:test`
3. `npm run check:build`
4. `npm run gate:local`
5. `npm run gate:regression:desktop`
6. `npm run gate:release`

## 放行條件

1. `gate:local` 全通過
2. `gate:regression:desktop` 全通過
3. 本次變更影響 capability 的 smoke checklist 已完成
4. 若改 UI，`smoke:desktop` / `smoke:mobile` 都已確認
5. 若改 migration / state contract，補上人工驗證紀錄

## Vault Sync Gate

### 固定測試 Vault

1. `npm run dev:vault`
2. `npm run build:vault`
3. `npm run gate:local:vault`

### 指定目標 Vault

1. `npm run dev:vault:target -- --vault "D:\\Your\\Vault"`
2. `npm run build:vault:target -- --vault "D:\\Your\\Vault"`
3. 可用環境變數：`AI_SUMMARIZER_VAULT_PATH`

## Dependency Drift Gate

策略文件：`docs/dependency-update-strategy.md`

1. `webpage-only` 變更：drift warning 不阻塞 release
2. 觸及 `media_url` / `local_media` 變更：
3. 若 `Dependency drift` 為 `error`，release blocked
4. 若 `Dependency drift` 為 `warning`，可放行但需在 `docs/dev_log.md` 記錄原因與風險

## CI Automation

GitHub Actions workflow：

1. `.github/workflows/release-gate.yml`
2. 觸發：`push` / `pull_request` / `workflow_dispatch`
3. 執行：`npm ci` + `npm run gate:release`

CI 是 release gate 的固定化，不取代桌面端人工 smoke 檢查。

## 失敗時 SOP

### Build 失敗

1. 先定位 `check:types` / `check:test` / `check:build` 哪一步失敗
2. 修正後至少重跑失敗步驟與 `gate:local`
3. 發版前重跑 `gate:release`

### Regression 失敗

1. 優先修正 `webpage` 主線回歸
2. 重跑 `gate:regression:desktop`
3. 再跑 `gate:release`

### Smoke 失敗

1. 記錄失敗 capability 與步驟
2. 修正後重跑對應 `smoke:*`
3. 發版前重跑 `gate:release`
