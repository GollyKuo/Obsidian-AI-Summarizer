# Current Implementation Track

最後更新：2026-04-22 07:40

## 目前階段

- Phase 3: smoke test 全部通過，準備進入 TRACK-007 Media URL Acquisition

## 當前主線

1. 開始 `TRACK-007 Media URL Acquisition`（YouTube/podcast 下載、取消、錯誤分類、測試）
2. 補齊 runtime 策略決策與 template UX 決策
3. 後續再進入 local media flow
4. 保留 runtime 可替換邊界，不提前綁定 media runtime

## 最近 5 個動作

1. 新增 `src/services/media/dependency-readiness.ts` 與 `src/services/media/url-classifier.ts`
2. 完成外部依賴錯誤映射與 media URL 來源分類（youtube/podcast/direct media）
3. 新增 `src/services/media/downloader-adapter.ts`，落地 session 規劃與 artifact path 產生
4. 新增單元測試：`dependency-readiness`、`url-classifier`、`downloader-adapter`
5. 下一步主線：接入 `yt-dlp` 實際下載執行並串接 `process-media-url`
