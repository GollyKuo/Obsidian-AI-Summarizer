# Multi-Agent Routing Reference

## 啟用前提

僅在以下條件同時成立時啟用：

1. 使用者明確要求多 agent
2. 任務可平行
3. write scope 互斥
4. coordinator 不重複做 worker 工作

## 角色對應

- UI：`agents/ui-worker.toml`
- Core：`agents/core-worker.toml`
- Review：`agents/reviewer.toml`

