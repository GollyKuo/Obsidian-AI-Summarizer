# Release Gate

## 指令順序

1. `npm run check:types`
2. `npm run check:test`
3. `npm run check:build`
4. `npm run gate:local`
5. `npm run gate:regression:desktop`
6. `npm run gate:release`

## 放行條件

1. `gate:local` 全通過
2. `gate:regression:desktop` 全通過
3. 本次變更影響到的 capability 已完成對應 smoke
4. 若變更 UI，`smoke:desktop` / `smoke:mobile` 已逐項確認
5. 若變更 migration / state contract，需另外補人工驗證

## 失敗時 SOP

### Build 失敗

1. 先看 `check:types` / `check:test` / `check:build` 哪一步失敗
2. 修正後至少重跑失敗指令
3. 發版前重新跑 `gate:local`

### Smoke 失敗

1. 記錄失敗 capability 與步驟
2. 修正後重跑對應 `smoke:*`
3. 若屬於 `webpage` 主線回歸，先重跑 `gate:regression:desktop`
4. 發版前重新跑 `gate:release`
