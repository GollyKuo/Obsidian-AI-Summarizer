# Workflow SOP（通用版）

## 預設流程

1. 確認目標與範圍
2. 只讀最小必要上下文
3. 判斷 single-agent 或多 agent
4. 明確改動 ownership
5. 實作 + targeted 驗證
6. 文件同步

## 實作前檢查

- 改動範圍是否清楚
- 是否碰到高風險區（parser/state/migration）
- 是否需要手機驗證
- 是否需要更新 backlog/dev log

## 完成後檢查

- changed files 是否在預期範圍
- `typecheck/test/build` 是否需要全部重跑
- 是否需要 integration-style tests
- 文件是否同步到正確位置

## 不要做的事

- 先開 subagents 再想切片
- 一次讀完整歷史文件群
- 把探索、規格、實作、驗證混成一步

