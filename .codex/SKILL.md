---
name: media-summarizer-obsidian-plugin
description: `Media Summarizer` Obsidian plugin 專案專用 skill。以最小上下文進行實作，優先維持 parity contract、模組邊界與 runtime 可替換性。
---

# Media Summarizer Obsidian Plugin Skill

## 專案定位

本專案要把既有 `Media Summarizer` Python app 重構為 Obsidian plugin。

固定前提：

1. 產品行為盡量對等保留。
2. runtime 實作方式必須可替換。
3. 第一條要先打通的主線是 `webpage URL -> summary -> note`。

## 預設模式

- 預設 single-agent
- 只有使用者明確要求 delegation/subagents/parallel work 時才評估分工
- 不預設載入大型歷史文件
- 不跳過 `parity contract` 與 `architecture boundary`

## 預設閱讀順序

1. `SKILL.md`
2. 直接相關程式碼
3. `docs/current-implementation-track.md`
4. `docs/backlog.md`
5. `docs/architecture-boundary.md`
6. `docs/parity-contract.md`
7. `references/workflow-sop.md`
8. `references/multi-agent-routing.md`（只有需要多 agent 時）
9. `references/docs-governance.md`
10. `references/release-versioning.md`
11. `references/encoding-safety.md`

## 架構重點

- `src/plugin/`
  - Obsidian lifecycle、commands、settings wiring
- `src/ui/`
  - settings tab、flow modal、progress、result UI
- `src/domain/`
  - types、settings、jobs、prompts、errors
- `src/orchestration/`
  - process-webpage、process-media-url、process-local-media、cancellation、job-runner
- `src/services/`
  - ai、web、obsidian、media
- `src/runtime/`
  - runtime-provider、runtime-payloads、placeholder/local bridge

## 實作優先序

1. `TRACK-001 Project Foundation`
2. `TRACK-002 Plugin Shell And Settings`
3. `TRACK-003 Domain Contracts`
4. `TRACK-004 Core Contracts And Services`
5. `TRACK-005 First End-to-End Webpage Flow`
6. `TRACK-006 Minimal UI Flow`

## 文件更新規則

- 主線改變：更新 `docs/current-implementation-track.md`
- 待辦變化：更新 `docs/backlog.md`
- 新的待決策問題：更新 `Discussion.md`
- 產品契約改變：更新 `docs/parity-contract.md`
- 版本節點：更新 `docs/dev_log.md`
