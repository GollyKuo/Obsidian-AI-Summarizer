# AI Summarizer Obsidian Plugin

本 repo 目前作為 `AI Summarizer` 重構為 Obsidian plugin 的專案起始骨架。

它不再只是通用規範包，而是已經收斂成這個專案自己的開發基線：

1. 有明確的目標產品架構。
2. 有可直接開工的文件與目錄骨架。
3. 有待討論議題的集中入口。

## 專案目標

把既有的 `AI Summarizer` Python app 重構為 Obsidian plugin，保留以下核心產品能力：

1. 支援 `media URL`、`webpage URL`、`local media` 三種來源。
2. 產出結構化 Obsidian 筆記。
3. 保留目前的 prompt 行為、metadata 語意、template 支援、retention 意圖與取消流程。
4. 將 runtime-dependent 能力抽象化，不在第一版先綁死執行方式。

## 目前專案入口

- [Discussion.md](d:\程式開發\AI Summarizer\Discussion.md)
  - 所有待討論問題集中於此
- [docs/Manual.md](d:\程式開發\AI Summarizer\docs\Manual.md)
  - 安裝、設定、smoke test 與 vault sync 操作手冊
- [docs/architecture-boundary.md](d:\程式開發\AI Summarizer\docs\architecture-boundary.md)
  - 專案分層、依賴方向、高風險區與 AI 工作流程圖
- [docs/ui-design.md](d:\程式開發\AI Summarizer\docs\ui-design.md)
  - flow modal、設定頁、progress/result 與介面設計導覽
- [docs/parity-contract.md](d:\程式開發\AI Summarizer\docs\parity-contract.md)
  - 與既有 Python app 需要對等保留的產品契約
- [docs/backlog.md](d:\程式開發\AI Summarizer\docs\backlog.md)
  - capability 級總表與排程入口
- [docs/backlog-active.md](d:\程式開發\AI Summarizer\docs\backlog-active.md)
  - 日常工作主入口
- [docs/backlog-archive.md](d:\程式開發\AI Summarizer\docs\backlog-archive.md)
  - 已完成能力與歷史參考
- [docs/documentation-maintenance.md](d:\程式開發\AI Summarizer\docs\documentation-maintenance.md)
  - backlog 與相關文件同步維護規則
- [docs/dev_log.md](d:\程式開發\AI Summarizer\docs\dev_log.md)
  - 版本與里程碑紀錄
- [docs/commands-reference.md](d:\程式開發\AI Summarizer\docs\commands-reference.md)
  - 工程側指令總表
- [docs/release-gate.md](d:\程式開發\AI Summarizer\docs\release-gate.md)
  - release 放行條件與失敗時 SOP
- [docs/release-build-vault-sop.md](d:\程式開發\AI Summarizer\docs\release-build-vault-sop.md)
  - build / release / commit / test / vault sync 操作 SOP
- [docs/dependency-update-strategy.md](d:\程式開發\AI Summarizer\docs\dependency-update-strategy.md)
  - `yt-dlp` / `ffmpeg` / `ffprobe` 版本漂移與更新策略

## 目標目錄骨架

```text
src/
  plugin/
  ui/
  domain/
  orchestration/
  services/
  runtime/
  utils/
tests/
  unit/
  integration/
docs/
```

## 建議閱讀順序

1. `docs/parity-contract.md`
2. `docs/architecture-boundary.md`
3. `docs/ui-design.md`
4. `docs/backlog-active.md`
5. `docs/backlog.md`
6. `Discussion.md`

完整的 `webpage_url` / `media_url` / `local_media` 進 AI 再寫入 Obsidian 的路徑，請看 [docs/architecture-boundary.md 的 AI 工作流程圖](docs/architecture-boundary.md#ai-工作流程)。

## Backlog 導航規則

1. 每日工作先讀 `docs/backlog-active.md`，以目前主線與近期細節為準。
2. 要排程、重排優先序或看全局時，再讀 `docs/backlog.md`。
3. 需要查完成歷史或舊能力邊界時，再讀 `docs/backlog-archive.md`。
4. 功能或行為調整時，依 `docs/documentation-maintenance.md` 同步 backlog 與相關規格文件。

## 第一階段目標

先完成可持續開發的 plugin 骨架，而不是直接衝進完整功能：

1. 建立 Obsidian plugin scaffold
2. 定義 domain types / settings / runtime contracts
3. 先打通 `webpage -> note` 流程
4. 再接入 media URL 與 local media
