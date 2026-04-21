# Commands Reference（通用版）

## 日常開發

```bash
npm run typecheck
npm run test
npm run build
npm run gate:local
```

## 發版前

```bash
npm run gate:release
```

## 建議 scripts（摘要）

```json
{
  "check:types": "npm run typecheck",
  "check:test": "npm run test",
  "check:build": "npm run build",
  "gate:local": "npm run check:types && npm run check:test && npm run check:build",
  "smoke:mobile": "node -e \"console.log('Run manual mobile checklist')\"",
  "gate:release": "npm run gate:local && npm run smoke:mobile"
}
```

## 高風險改動最低驗證

- parser/state/migration：`typecheck + test + build`
- UI 互動改動：`gate:local + mobile smoke`
- 版本節點前：`gate:release` + `dev_log` 更新

