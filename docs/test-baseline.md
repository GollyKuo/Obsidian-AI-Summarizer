# Test Baseline（通用版）

## 第一批必要測試範圍

1. domain model
2. parser + invalid syntax
3. normalization（malformed/duplicate）
4. source anchor/fallback（若有）
5. storage boundary + migration
6. query/filter/sort/index
7. service orchestration 層

## 何時必補 Integration-Style Tests

符合任一條件就補：

1. 同時跨兩層以上（例如 parser -> normalization -> storage）
2. 牽涉 migration + runtime initialization
3. 查詢契約改動會影響多個 UI scope
4. 主入口 wiring 改動
5. 修復跨模組 regression

## 測試可頻繁執行原則

- 優先 deterministic，避免外部 I/O 依賴
- 測試資料盡量 fixture 化
- 重型整合測試只在必要時加入

