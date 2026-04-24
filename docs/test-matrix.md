# Test Matrix

最後更新：2026-04-24 10:06

## Capability Matrix

| Capability | Surface | Automated | Manual Smoke | Gate |
|---|---|---|---|---|
| `webpage` | desktop | integration + regression + unit | `npm run smoke:webpage` | `gate:local`, `gate:regression:desktop`, `gate:release` |
| `webpage` | mobile | none | `npm run smoke:mobile` | `gate:release` |
| `media_url` | desktop | integration + unit | `npm run smoke:media-url` | `gate:local`, `gate:release` |
| `local_media` | desktop | integration + unit | `npm run smoke:local-media` | `gate:local`, `gate:release` |
| `media_url` / `local_media` | mobile | none | not supported in v1 | excluded |

## Gate Intent

- `gate:local`: 型別、單元測試、整合測試、production build
- `gate:local:vault`: `gate:local` + 同步到測試 Vault 的 build
- `gate:regression:desktop`: 守住 `webpage` 主線，避免 runtime / media 變更回歸
- `gate:release`: `gate:local` 後，執行 desktop/mobile smoke checklist

## Dependency Drift Policy

參考：`docs/dependency-update-strategy.md`

- drift `error`: `media_url` / `local_media` release blocked
- drift `warning`: 可放行，但需在 `dev_log` 記錄風險
- `webpage-only` 變更不因 drift `warning` 被阻塞

## Regression Focus

- runtime unavailable 不得破壞 `webpage` 主線
- media retention mode 不得影響 note 輸出
- diagnostics / error reporting 變更不得讓錯誤落回 unknown path
