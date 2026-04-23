# Test Matrix

最後更新：2026-04-24 01:28

## Capability Matrix

| Capability | Surface | Automated | Manual Smoke | Gate |
|---|---|---|---|---|
| `webpage` | desktop | integration + unit | `npm run smoke:webpage` | `gate:local`, `gate:release` |
| `webpage` | mobile | none | `npm run smoke:mobile` | `gate:release` |
| `media_url` | desktop | integration + unit | `npm run smoke:media-url` | `gate:local`, `gate:release` |
| `local_media` | desktop | integration + unit | `npm run smoke:local-media` | `gate:local`, `gate:release` |
| `media_url` / `local_media` | mobile | none | not supported in v1 | excluded |

## Gate Intent

- `gate:local`: 型別、單元測試、整合測試、production build
- `gate:local:vault`: `gate:local` 加上同步到測試 Vault 的 build
- `gate:release`: `gate:local` 後，列出 desktop/mobile smoke checklist，作為人工 release gate

## Regression Focus

- runtime unavailable 不得破壞 `webpage` 主線
- media retention mode 不得影響 note 產出
- diagnostics / error reporting 變更不得讓錯誤落回 unknown path
