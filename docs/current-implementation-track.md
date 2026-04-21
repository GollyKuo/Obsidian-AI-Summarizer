# Current Implementation Track

最後更新：2026-04-22 00:17

## 目前階段

- Phase 3: smoke test 全部通過，準備進入 TRACK-007 Media URL Acquisition

## 當前主線

1. 開始 `TRACK-007 Media URL Acquisition`（YouTube/podcast 下載、取消、錯誤分類、測試）
2. 補齊 runtime 策略決策與 template UX 決策
3. 後續再進入 local media flow
4. 保留 runtime 可替換邊界，不提前綁定 media runtime

## 最近 5 個動作

1. 將 `docs/API_Instructions.md` 完整整合到 `src/domain/prompts.ts`
2. 更新 `src/services/ai/prompt-builder.ts`，改為組裝可直接執行的摘要與逐字稿 prompt
3. 修正 `docs/API_Instructions.md` 技術實作位置，對齊目前 TypeScript 架構
4. 更新 backlog，記錄 prompt contract 整合完成時間
5. 下一步主線維持 `TRACK-007 Media URL Acquisition`
