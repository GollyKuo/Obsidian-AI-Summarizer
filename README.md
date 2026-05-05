# AI Summarizer Obsidian Plugin

本 repo 是 `AI Summarizer` 的 Obsidian plugin 版本，包含 plugin runtime、媒體處理流程、AI provider 整合、UI、測試與發佈文件。

目前文件以「可交付 plugin」為中心維護，不再是通用規範包或初始 scaffold。

## 專案目標

把既有的 `AI Summarizer` Python app 重構為 Obsidian plugin，保留並落地以下核心產品能力：

1. 支援 `webpage URL`、`media URL`、`local media`、`transcript file` 四種來源。
2. 產出結構化 Obsidian 筆記。
3. 保留 prompt 行為、metadata 語意、template 支援、retention 意圖與取消流程。
4. 將 media acquisition、AI provider、note writer 與 Obsidian runtime 分層，避免 UI 或 command handler 直接承擔 pipeline 邏輯。
5. 透過 regression、integration、smoke checklist 與 release gate 維持交付品質。

## 目前專案入口

- [docs/Manual.md](docs/Manual.md)
  - 一般 Windows 使用者的安裝、設定、操作與疑難排解手冊
- [docs/Manual-Developer.md](docs/Manual-Developer.md)
  - 開發、建置、測試、vault sync 與交付操作手冊
- [docs/architecture-boundary.md](docs/architecture-boundary.md)
  - 專案分層、依賴方向、高風險區與 AI 工作流程圖
- [docs/API_Instructions.md](docs/API_Instructions.md)
  - prompt contract、AI 輸出格式與 provider 行為規範
- [docs/media-acquisition-spec.md](docs/media-acquisition-spec.md)
  - media acquisition、AI-ready artifact、transcript/subtitle 與 retention 規格
- [features/ui-design.md](features/ui-design.md)
  - flow modal、設定頁、progress/result 與介面設計導覽
- [docs/parity-contract.md](docs/parity-contract.md)
  - 與既有 Python app 需要對等保留的產品契約
- [docs/backlog.md](docs/backlog.md)
  - capability 級總表與排程入口
- [docs/backlog-active.md](docs/backlog-active.md)
  - 日常工作主入口
- [docs/backlog-archive.md](docs/backlog-archive.md)
  - 已完成能力與歷史參考
- [docs/documentation-maintenance.md](docs/documentation-maintenance.md)
  - backlog 與相關文件同步維護規則
- [docs/dev_log.md](docs/dev_log.md)
  - 版本與里程碑紀錄
- [docs/commands-reference.md](docs/commands-reference.md)
  - 工程側指令總表
- [docs/test-matrix.md](docs/test-matrix.md)
  - capability 測試矩陣與 regression evidence
- [docs/smoke-checklist.md](docs/smoke-checklist.md)
  - release 前手動 smoke checklist
- [docs/release-gate.md](docs/release-gate.md)
  - release 放行條件與失敗時 SOP
- [docs/release-build-vault-sop.md](docs/release-build-vault-sop.md)
  - build / release / commit / test / vault sync 操作 SOP
- [docs/distribution-guide.md](docs/distribution-guide.md)
  - 手動交付、GitHub release、官方上架、外部工具放置與打包隱私檢查
- [docs/dependency-update-strategy.md](docs/dependency-update-strategy.md)
  - `yt-dlp` / `ffmpeg` / `ffprobe` 版本漂移與更新策略
- [docs/encoding-safety.md](docs/encoding-safety.md)
  - 中文文件與 Windows/PowerShell 編碼安全規則
- [Discussion.md](Discussion.md)
  - 尚未定案的討論與停放議題

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
  regression/
docs/
features/
templates/
```

## 建議閱讀順序

1. `docs/parity-contract.md`
2. `docs/architecture-boundary.md`
3. `docs/API_Instructions.md`
4. `docs/media-acquisition-spec.md`
5. `features/ui-design.md`
6. `docs/backlog-active.md`
7. `docs/backlog.md`

完整的 `webpage_url` / `media_url` / `local_media` / `transcript_file` 進 AI 再寫入 Obsidian 的路徑，請看 [docs/architecture-boundary.md 的 AI 工作流程圖](docs/architecture-boundary.md#ai-工作流程)。

## Backlog 導航規則

1. 每日工作先讀 `docs/backlog-active.md`，以目前主線與近期細節為準。
2. 要排程、重排優先序或看全局時，再讀 `docs/backlog.md`。
3. 需要查完成歷史或舊能力邊界時，再讀 `docs/backlog-archive.md`。
4. 功能或行為調整時，依 `docs/documentation-maintenance.md` 同步 backlog 與相關規格文件。

## 目前交付焦點

目前主線不是建立骨架，而是收尾可交付狀態：

1. 確認 `docs/backlog-active.md` 的 Final Handoff Gate。
2. 跑 `docs/release-gate.md` 定義的本地放行與 smoke gate。
3. 依 `docs/distribution-guide.md` 檢查 release assets 與隱私邊界。
