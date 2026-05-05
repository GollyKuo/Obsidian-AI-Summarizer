# Source Layout

本資料夾保留 Obsidian plugin 實作碼。分層邊界以 [../docs/architecture-boundary.md](../docs/architecture-boundary.md) 為準。

主要子目錄：

1. `plugin/`：plugin lifecycle、settings 載入與 Obsidian entry points。
2. `ui/`：Flow Modal、Settings Tab、source guidance 與使用者可見狀態。
3. `domain/`：settings、model selection、types、prompts 與核心資料契約。
4. `orchestration/`：`webpage_url`、`media_url`、`local_media`、`transcript_file` 的流程協調。
5. `services/`：AI provider、media acquisition、note writing、diagnostics 等外部服務封裝。
6. `runtime/`：local bridge runtime 與跨執行環境 payload。
7. `utils/`：小型共用工具。
