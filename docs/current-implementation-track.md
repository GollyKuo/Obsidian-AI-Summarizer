# Current Implementation Track

最後更新：2026-04-22 01:00

## 目前階段

- Phase 3: smoke test 全部通過，準備進入 TRACK-007 Media URL Acquisition

## 當前主線

1. 開始 `TRACK-007 Media URL Acquisition`（YouTube/podcast 下載、取消、錯誤分類、測試）
2. 補齊 runtime 策略決策與 template UX 決策
3. 後續再進入 local media flow
4. 保留 runtime 可替換邊界，不提前綁定 media runtime

## 最近 5 個動作

1. 新增 `src/services/media/media-cache-root.ts`，落地 `mediaCacheRoot` 驗證與可寫性檢查
2. 完成 cache root resolution（自訂路徑優先，否則依 OS 預設快取目錄）
3. 新增 `tests/unit/media-cache-root.test.ts` 覆蓋路徑驗證與預設路徑解析
4. 更新 `src/plugin/MediaSummarizerPlugin.ts` 與設定頁文案，對齊新路徑規範
5. 下一步主線：實作 dependency readiness checker（`yt-dlp`、`ffmpeg`、`ffprobe`）
