# Project Setup SOP

## 目的

把本專案從文件狀態推進到「可開始實作」的 plugin 骨架。

## Step 1：確認技術選型

本專案直接採：

1. TypeScript
2. Obsidian plugin scaffold
3. React 作為 UI 層
4. Vitest 作為測試框架

理由：

1. UI 不是單一設定頁，而是多步驟輸入、進度、取消、結果回報。
2. workflow 有狀態轉換需求，React 較適合管理 flow state。
3. 但 React 只限於 `ui/`，不得接管 orchestration 與 runtime。

## Step 2：建立最小目錄

```text
src/
  plugin/
  ui/
  domain/
  orchestration/
  services/
  runtime/
  utils/
tests/
  unit/
  integration/
docs/
```

## Step 3：建立最小設定檔

第一批必備檔案：

1. `manifest.json`
2. `package.json`
3. `tsconfig.json`
4. `versions.json`
5. `esbuild.config.mjs`
6. `main.ts`

## Step 4：建立最低依賴

- runtime
  - `obsidian`
  - `react`
  - `react-dom`
- dev
  - `typescript`
  - `esbuild`
  - `vitest`
  - `@types/node`
  - `@types/react`
  - `@types/react-dom`

## Step 5：先建立產品契約

在寫正式程式碼前，先固定以下文件：

1. `docs/parity-contract.md`
2. `docs/architecture-boundary.md`
3. `docs/current-implementation-track.md`
4. `docs/backlog.md`
5. `Discussion.md`

## Step 6：先完成可載入骨架

第一個 milestone 不是完整功能，而是以下條件：

1. plugin 可被 Obsidian 載入
2. commands 可見
3. settings 可持久化
4. modal 可 mount / unmount
5. 有 placeholder runtime 可回報 `runtime not configured`

## Step 7：先落產品關鍵模組

優先順序：

1. `domain/settings.ts`
2. `domain/types.ts`
3. `domain/errors.ts`
4. `runtime/runtime-provider.ts`
5. `services/obsidian/note-writer.ts`
6. `services/ai/prompt-builder.ts`
7. `orchestration/process-webpage.ts`

## Step 8：第一條端到端流程

第一條真正要打通的流程是：

`webpage URL -> extraction -> summary -> note write`

理由：

1. 可驗證 plugin 架構是否成立。
2. 相比 media runtime，風險較低。
3. 可以先驗證 prompt、note output、取消與 UI 流程。

## Step 9：最低驗證門檻

在進入 media flow 前，至少要通過：

1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
4. mocked webpage integration test
5. manual Obsidian smoke test
