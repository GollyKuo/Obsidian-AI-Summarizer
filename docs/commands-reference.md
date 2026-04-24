# Commands Reference

## 日常指令

```bash
npm run typecheck
npm run test
npm run build
npm run build:vault
npm run gate:local
npm run gate:local:vault
npm run gate:regression:desktop
```

## Smoke Checklist

```bash
npm run smoke:desktop
npm run smoke:webpage
npm run smoke:media-url
npm run smoke:local-media
npm run smoke:mobile
```

## Release 前

```bash
npm run gate:release
```

## 使用規則

- runtime / orchestration 變更：至少跑 `gate:local`
- 影響 `webpage` 主線或共用契約時：加跑 `gate:regression:desktop`
- UI 變更：跑 `gate:local:vault`，再依序確認 `smoke:desktop`
- 發版前：跑 `gate:release`，並同步更新 `docs/dev_log.md`
