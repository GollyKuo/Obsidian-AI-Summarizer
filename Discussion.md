# Discussion

最後更新：2026-05-05 18:34

本文件集中管理尚未定案、需要進一步討論，或需要在正式文件回寫前先收斂的問題。已定案內容應回寫到 `docs/`、`features/` 或 backlog，不長期停留在這裡。

## 使用規則

1. 新的討論點先列在這裡。
2. 一旦定案，要把結論回寫到正式文件。
3. 已定案且已同步的項目，應移出 active 區。
4. 若只是一般文件維護規則，直接更新 [docs/documentation-maintenance.md](docs/documentation-maintenance.md)。

## Active Topics

目前沒有需要先放在本檔收斂的 active topic。

## Recent Decisions

1. `media URL` 下載產物不放在 vault 內，改採「外部路徑」策略，並提供使用者在 settings 中指定存放根目錄。
2. `media URL` 流程在送 AI 前必須先做音訊壓縮與分段，預設採 `balanced`，並保留品質回退機制。
3. `RuntimeProvider` 的 media v1 策略定案為 `local_bridge`，`placeholder_only` 保留為 fallback 測試/隔離用途。
4. `local media` v1 支援外部本機檔案橋接，不限制來源必須在 vault 內。
5. 模板第一版收斂為 `預設通用 Frontmatter` 與 `自訂模板`，完整規格以 [docs/template-spec.md](docs/template-spec.md) 為準。
6. `webpage_url`、`media_url`、`local_media`、`transcript_file` 的 AI 工作流程以 [docs/architecture-boundary.md](docs/architecture-boundary.md#ai-工作流程) 為準。

## Parking Lot

1. 字幕嵌入能力在 plugin vNext 的必要程度。
2. 是否需要 job history / batch processing。
3. 是否擴充 `text_file`、`clipboard_text`、`obsidian_note` 或 `folder_notes` 等新輸入來源。
