# Versioning Policy（通用版）

## 最小一致性

當任務形成版本節點時，同步檢查：

1. `manifest.json`
2. `package.json`
3. `docs/dev_log.md`

## `dev_log.md` 必備欄位

- 版本
- 日期時間（`YYYY-MM-DD HH:mm`）
- 主要變更
- 驗證結果

## 何時要更新 dev log

- 新版本建立
- 可辨識的里程碑完成
- 重大架構調整

## 何時可不更新

- 草稿性微調
- 尚未形成版本節點的探索改動

