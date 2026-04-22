# Docs Governance

## 文件職責

- `README.md`
  - 專案目標、入口與閱讀順序
- `Discussion.md`
  - 待討論問題與尚未定案事項
- `docs/architecture-boundary.md`
  - 分層與依賴邊界
- `docs/parity-contract.md`
  - 與既有 Python app 的功能對等契約
- `docs/backlog.md`
  - 完整待辦總表（active + future）
- `docs/backlog-active.md`
  - 目前主線、正在做與近期要做的能力層
- `docs/backlog-archive.md`
  - 已完成且仍具參考價值的能力層
- `docs/dev_log.md`
  - 版本與里程碑摘要
- `docs/release-gate.md`
  - 驗證門檻與失敗處理

## 同步規則

1. 待辦總表改變時，更新 `docs/backlog.md`
2. 主線或近期執行內容改變時，更新 `docs/backlog-active.md`
3. 能力完成後，從 `docs/backlog-active.md` 移動到 `docs/backlog-archive.md`
4. 新的待決策問題，更新 `Discussion.md`
5. 產品契約改變時，更新 `docs/parity-contract.md`
6. 版本節點或里程碑完成時，更新 `docs/dev_log.md`
7. `docs/backlog.md`、`docs/backlog-active.md`、`docs/backlog-archive.md` 中任何 `[x]` 項目都要標示完成時間，格式為 `（完成：YYYY-MM-DD HH:mm）`

## 反模式

1. 在 `Discussion.md` 做最後規格定稿但不回寫正式文件
2. 在多份文件重複維護同一份 architecture rule
3. backlog 與 current track 長期不同步
4. 完成的決策仍停留在待討論狀態
5. 把已完成內容留在 `docs/backlog-active.md`
6. 把未來規劃混進 `docs/backlog-archive.md`
