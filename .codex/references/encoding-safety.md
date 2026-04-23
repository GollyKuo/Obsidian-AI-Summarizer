# 編碼安全參考

## 目的

確保此 repo 的文字檔在 Windows、PowerShell、Git 與編輯器流程中都能穩定且可讀，不再出現亂碼。

本文件是給 Codex 的執行摘要；正式規範以 `docs/encoding-safety.md`、`.editorconfig`、`.gitattributes` 為準。

## 適用範圍

適用於：

- `.md`、`.ts`、`.tsx`、`.json` 與其他文字型原始碼/規格檔
- 終端機讀寫操作
- 腳本自動產生的檔案

## 核心規則

1. Repo 文字檔一律使用 UTF-8。
2. 讀寫檔案時，能指定編碼就明確指定 UTF-8。
3. 優先使用 PowerShell 7（`pwsh`），避免 Windows PowerShell 5.1 的預設編碼風險。
4. 避免使用可能默默改變編碼的輸出方式。

## 常見失敗情境

1. 在 UTF-8 repo 內混入 `Big5`、`CP950`、`ANSI`、`UTF-16` 檔案。
2. 在 PowerShell 5.1 中使用預設編碼讀寫。
3. 使用 `Out-File`、redirect（`>`、`>>`）或混合 shell pipeline 寫檔，卻未明確控制 UTF-8。

## 安全讀寫範例

明確指定 UTF-8：

```powershell
Get-Content -Encoding UTF8 docs/dev_log.md
Set-Content -Encoding UTF8 docs/dev_log.md -Value $content
```

需要精準控制（UTF-8 without BOM）時：

```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

明確指定 UTF-8 讀檔：

```powershell
[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
```

## 終端機 Session 設定（必要時）

若終端輸出出現亂碼，可先設定 session 編碼：

```powershell
chcp 65001
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

說明：

- 這主要用於 PowerShell 5.1 或終端設定異常時的補救。
- 這不是檔案編碼策略的替代品，檔案本身仍必須是 UTF-8。

## Repo 防呆設定

### `.editorconfig`

```ini
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
```

### `.gitattributes`

節錄：

```gitattributes
*.md text working-tree-encoding=UTF-8 eol=lf
*.ts text working-tree-encoding=UTF-8 eol=lf
*.tsx text working-tree-encoding=UTF-8 eol=lf
*.json text working-tree-encoding=UTF-8 eol=lf
```

完整副檔名清單與實際值請以 repo 內 `.gitattributes` 實檔為準。

## 禁止做法

1. 用未知預設編碼寫入 repo 文字檔。
2. 對 source/spec 檔案使用未受控的 `Out-File` 或 redirect。
3. 混用 shell 輸出與寫檔流程，導致編碼結果不可預期。

## 操作檢查清單

1. 修改前先確認目標檔案為 UTF-8。
2. 讀寫時使用明確 UTF-8 方式。
3. 自動化流程優先使用 `pwsh`。
4. 修改後用 `git diff` / `git show` 再檢查內容是否正常。
5. 若已出現亂碼，先修正工具鏈/session，再重寫一次檔案內容。
