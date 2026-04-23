# Diagnostics Policy

最後更新：2026-04-24 01:18

## Logging Policy

- `info`: 僅供開發者追蹤流程事件；`debugMode=false` 時不輸出
- `warn`: 用於可恢復問題、契約正規化、使用者輸入或 capability 降級
- `error`: 用於 runtime、AI、下載、寫入等失敗

## Message Tiers

- `notice`: 短訊息；只用於需要立即提醒使用者的成功或失敗
- `modal`: 顯示當前操作結果，應可直接讀懂，不依賴 console
- `log`: 給開發者與 debug 用，必須帶 context 與 category
- `test assertion`: 穩定字串格式，避免測試依賴 UI 文案

## Formatting Rules

- context 一律正規化成 snake_case，例如 `webpage_flow`
- `SummarizerError` 依 `category` 映射固定標題，例如 `validation_error -> 輸入無效`
- 未知錯誤統一映射為 `未預期錯誤`
- warning / info log 採 `[context] message`
- error log 採 `[context] category: message`
