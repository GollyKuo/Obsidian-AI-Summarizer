# Current Implementation Track

最後更新：2026-04-22 00:54

## 目前階段

- Phase 3: smoke test 全部通過，準備進入 TRACK-007 Media URL Acquisition

## 當前主線

1. 開始 `TRACK-007 Media URL Acquisition`（YouTube/podcast 下載、取消、錯誤分類、測試）
2. 補齊 runtime 策略決策與 template UX 決策
3. 後續再進入 local media flow
4. 保留 runtime 可替換邊界，不提前綁定 media runtime

## 最近 5 個動作

1. 強化 TRACK-007 backlog，補上外部依賴 readiness 任務（`yt-dlp`、`ffmpeg`、`ffprobe`）
2. 將 TRACK-007 完成條件改為可量測門檻（整合測試案例數、壓縮率、回退條件、取消時效）
3. 更新 `docs/media-acquisition-spec.md`，加入品質守門量化門檻與依賴錯誤映射
4. 更新 `docs/architecture-boundary.md`，同步 `RuntimeProvider.strategy` 邊界與新版優先序
5. 下一步主線：實作 dependency readiness checker 與 cache root resolution
