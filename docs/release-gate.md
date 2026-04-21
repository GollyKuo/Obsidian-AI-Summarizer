# Release Gate（通用版）

## 固定指令

1. `npm run check:types`
2. `npm run check:test`
3. `npm run check:build`
4. `npm run gate:local`（1~3）
5. `npm run gate:release`（`gate:local` + `smoke:mobile`）

## 最小可發版條件

1. `gate:local` 全通過
2. 受影響模組測試已跑且無新增失敗
3. 若變更 UI，mobile smoke 已完成
4. 若變更 migration/state contract，遷移測試已通過

## 失敗處理 SOP

### Build 失敗

1. 拆跑 `check:types` / `check:test` / `check:build`
2. 先修型別契約，再修測試，再修 build
3. 修完至少重跑 `gate:local`

### Migration 失敗

1. 先跑 migration 專屬測試
2. 檢查 step contract 與順序
3. 維持 fallback 可啟動原則
4. 修完重跑 `gate:local`

