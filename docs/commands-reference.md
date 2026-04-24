# Commands Reference

搭配 `docs/user-manual.md` 使用；本文件偏工程側指令分層。

## 安裝後第一輪

```bash
npm install
npm run typecheck
npm run test
npm run build
```

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

## Vault Sync

內建測試 vault：

```bash
npm run dev:vault
npm run build:vault
npm run gate:local:vault
```

自訂 vault：

```bash
node esbuild.config.mjs --watch --vault "D:\\Your\\Vault"
node esbuild.config.mjs --production --vault "D:\\Your\\Vault"
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
- 若要給使用者或測試者操作，優先導向 `docs/user-manual.md`
