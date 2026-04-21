---
name: new-project-skill
description: 新專案通用 skill。以最小上下文完成開發，預設 single-agent，必要時才啟用分工。
---

# New Project Skill

## 預設模式

- 預設 single-agent
- 只有在使用者明確要求 delegation/subagents/parallel work 時才評估分工
- 不預設載入大型歷史文件

## 預設閱讀順序（逐層）

1. `SKILL.md`
2. 直接相關程式碼
3. `docs/current-implementation-track.md`
4. `docs/backlog.md`
5. `docs/architecture-boundary.md`
6. `references/workflow-sop.md`
7. `references/multi-agent-routing.md`（只有需要多 agent 時）
8. `references/docs-governance.md`
9. `references/release-versioning.md`
10. `references/encoding-safety.md`

## 文件更新規則（摘要）

- 主線改變：更新 current track
- 待辦變化：更新 backlog
- checklist 完成：移到 archive
- 版本節點：更新 dev log

