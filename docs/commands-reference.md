# Commands Reference（專案版）

## 文件導航

1. 每日工作先看 `docs/backlog-active.md`，這份就是目前主線依據。
2. 要排程或重排優先序時，再看 `docs/backlog.md`。
3. 查已完成歷史時再看 `docs/backlog-archive.md`。

## Vault 同步規範

本專案預設 Vault：

- `D:\程式開發\Obsidian Test`

規範：

1. 需要在 Obsidian 立即可見的變更，一律使用 `dev:vault` 或 `build:vault`。
2. 不要只跑 `build` 就去看 Obsidian，因為 `build` 不會同步到 Vault。

## 日常開發指令

```bash
# 持續監看 + 自動同步到 Obsidian Vault
npm run dev:vault

# 單次建置 + 同步到 Obsidian Vault
npm run build:vault

# 型別檢查
npm run typecheck

# 測試
npm run test
```

## 驗證指令

```bash
# 一般本機驗證（不強制同步 Vault）
npm run gate:local

# 本機驗證 + 同步 Vault（建議 UI/互動改動時使用）
npm run gate:local:vault
```

## 發版前

```bash
npm run gate:release
```

## 高風險改動最低驗證

- runtime/orchestration 契約改動：`typecheck + test + build`
- UI 互動改動：`gate:local:vault + Obsidian 手動 smoke`
- 版本節點前：`gate:release` + `dev_log` 更新