# Docs Governance

## 文件定位

- `README.md`
  - 專案入口、主要文件導覽與開發基線。
- `Discussion.md`
  - 尚未定案的討論、取捨與決策背景。
- `docs/architecture-boundary.md`
  - 架構邊界、責任分層與模組 ownership。
- `docs/parity-contract.md`
  - 與原 Python app 的能力對齊契約。
- `docs/backlog.md`
  - capability 級總表、全局狀態與排程視角；不放細 checklist。
- `docs/backlog-active.md`
  - 目前主線、近期任務、open work 與可執行 checklist。
- `docs/backlog-archive.md`
  - 已完成且仍有架構參考價值的能力層與歷史邊界。
- `docs/dev_log.md`
  - 版本節點、完成內容與重要變更紀錄。
- `docs/release-gate.md`
  - release 放行條件、gate 與失敗處理 SOP。

## 同步規則

1. 待辦總表或 capability 狀態改變時，更新 `docs/backlog.md`。
2. 主線、近期執行內容、open work 或驗收 checklist 改變時，更新 `docs/backlog-active.md`。
3. 能力完成且不再需要日常追蹤時，從 `docs/backlog-active.md` 移入 `docs/backlog-archive.md`。
4. 任一 backlog 檔案（`docs/backlog.md` / `docs/backlog-active.md` / `docs/backlog-archive.md`）被修改時，必須同時檢查三者是否有邏輯衝突或需要同步調整。
5. backlog 三檔同步檢查時，`backlog.md` 維持 capability 級摘要，`backlog-active.md` 維持近期任務與 checklist，`backlog-archive.md` 只保存已完成能力與歷史邊界。
6. 尚未定案的產品或架構討論，更新 `Discussion.md`。
7. 影響架構邊界的規則，更新 `docs/architecture-boundary.md`。
8. 影響 parity 的能力或行為，更新 `docs/parity-contract.md`。
9. 形成版本節點或重要完成紀錄時，更新 `docs/dev_log.md`。
10. `docs/backlog.md` 不放 checklist；子任務與驗收細節一律放在 `docs/backlog-active.md` 或 `docs/backlog-archive.md`。
11. `docs/backlog-active.md` 與 `docs/backlog-archive.md` 中任何 `[x]` 項目都要標示完成時間，格式固定為 `（完成：YYYY-MM-DD HH:mm）`。

## 禁止模式

1. 把未定案討論直接寫成 architecture rule。
2. 把 capability 細 checklist 寫進 `docs/backlog.md`，造成與 `docs/backlog-active.md` 雙寫。
3. 只改其中一個 backlog 檔，卻未檢查另外兩個 backlog 檔的狀態、摘要、完成/封存邊界是否需要同步。
4. 把已完成且不再追蹤的內容留在 `docs/backlog-active.md`。
5. 把 future / queued / parking 項目塞進 `docs/backlog-archive.md`。
6. 變更 prompt、runtime、adapter 或 release gate 規則時，沒有同步相關規格文件。
