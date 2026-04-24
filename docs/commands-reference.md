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
npm run gate:local
npm run gate:regression:desktop
```

## Vault Sync

固定測試 vault：

```bash
npm run dev:vault
npm run build:vault
npm run gate:local:vault
```

指定 vault：

```bash
npm run dev:vault:target -- --vault "D:\\Your\\Vault"
npm run build:vault:target -- --vault "D:\\Your\\Vault"
```

也可用環境變數：

```bash
set AI_SUMMARIZER_VAULT_PATH=D:\Your\Vault
npm run build:vault:target
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

## CI

```bash
GitHub Actions: .github/workflows/release-gate.yml
```

## 使用規則

- runtime / orchestration 變更：至少跑 `gate:local`
- 影響 `webpage` 主線或共用契約時：加跑 `gate:regression:desktop`
- UI 變更：跑 `gate:local:vault`，再確認 `smoke:desktop`
- 發版前：跑 `gate:release`，並同步更新 `docs/dev_log.md`
- 使用者操作入口：`docs/user-manual.md`
