# Encoding Safety

最後更新：2026-05-04 00:00

## 目的

確保此 repo 的文字檔在 Windows、PowerShell、Git 與編輯器流程中都維持可讀的 UTF-8 內容，不再發生「檔案格式是 UTF-8，但內容字串已經先壞掉」的情況。

本文件是正式規範；`.editorconfig`、`.gitattributes` 與 `.codex/references/encoding-safety.md` 都應與此文件一致。

## 核心結論

1. Repo 文字檔一律使用 UTF-8。
2. 中文文件優先使用 `apply_patch` 修改，不經過 shell 文字 round-trip。
3. 不可用 Windows PowerShell 5.1 的 `Get-Content` / `Set-Content` 對中文文件做讀出再寫回。
4. 不可對 repo 中文文件使用 `Out-File`、`>`、`>>` 直接覆寫。
5. 只要終端顯示出現亂碼，就停止回寫，先驗證 raw bytes 與上一個正常 commit。

## 為什麼單靠 UTF-8 不夠

`.editorconfig` 與 `.gitattributes` 只能保證：

- 檔案以 UTF-8 存放
- EOL 與工作樹編碼一致

它們無法保證：

- 你準備寫回去的字串本身仍是正確中文
- shell session 顯示出來的文字沒有先變成 mojibake

也就是說，把一段已經壞掉的字串用 UTF-8 存回去，結果仍然是「合法 UTF-8 的亂碼檔案」。

## 高風險操作

以下操作會把 shell 目前看到的字串內容帶回檔案，因此風險最高：

```powershell
Get-Content docs/backlog-active.md
Get-Content docs/backlog-active.md -Raw
Set-Content docs/backlog-active.md $content
Set-Content docs/backlog-active.md -Encoding UTF8 $content
Out-File docs/backlog-active.md
```

以下 redirect 也禁止用在 repo 中文文件：

```powershell
... > docs/backlog-active.md
... >> docs/backlog-active.md
```

## 終端讀檔規則

Windows PowerShell 5.1 對 UTF-8 no BOM 檔案的預設讀取不可靠；即使檔案本身是正確 UTF-8，`Get-Content` 仍可能用 ANSI/Big5 解讀，導致終端顯示 mojibake。

只需要在終端檢視中文文件或 metadata 時，也必須明確指定 UTF-8：

```powershell
Get-Content -Encoding UTF8 docs\distribution-guide.md
Get-Content -Encoding UTF8 manifest.json
Get-Content -Encoding UTF8 package.json
```

若未加 `-Encoding UTF8` 時看到亂碼，先視為終端解碼問題；不要依照該輸出修改或回寫檔案。用 Node、`Get-Content -Encoding UTF8`、或 `[System.IO.File]::ReadAllText(..., [System.Text.Encoding]::UTF8)` 重新確認內容。

## 允許的修改方式

### 首選：`apply_patch`

適用情況：

- `docs/*.md`
- `.codex/**/*.md`
- 任何含中文的 spec、note、checklist、log

原因：

- 不依賴 shell session 的輸出編碼
- diff 清楚
- 變更最容易審查

### 次選：明確 .NET UTF-8 讀寫

只有在 `apply_patch` 不適合時才使用，且必須明確指定 UTF-8。

```powershell
$path = "docs/dev_log.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

規則：

1. 讀檔必須用 `[System.IO.File]::ReadAllText(..., [System.Text.Encoding]::UTF8)`
2. 寫檔必須用 `[System.IO.File]::WriteAllText(..., [System.Text.UTF8Encoding]::new($false))`
3. 寫回前必須先確認字串內容沒有 mojibake
4. 寫回後必須檢查 `git diff`

## 明確禁止

1. 使用 Windows PowerShell 5.1 預設文字管線 round-trip 中文文件。
2. 用 `Get-Content` 讀中文，再直接交給 `Set-Content` 寫回。
3. 對 repo 中文文件使用 `Out-File`、`>`、`>>`。
4. shell 顯示亂碼時，仍繼續依照螢幕內容編輯或回寫。
5. 只看終端輸出，不核對 diff、hex 或上一個正常版本。

## 看到亂碼時的停損規則

只要終端出現這類內容，就視為高風險狀態，不可回寫：

- `?敺...`
- `銝剜蕭...`
- `�`

處理順序：

1. 停止所有寫檔動作。
2. 用 `git diff -- <path>` 確認目前是否已經有非預期改動。
3. 用 `Format-Hex <path>` 看 raw bytes。
4. 用 `git show <last-good-commit>:<path>` 對照上一個正常版本。
5. 確認內容來源可靠後，才允許修復。

## 驗證流程

修改任何中文文件後，至少做以下檢查：

1. `git diff -- <path>`
2. 必要時 `Format-Hex <path>`
3. 必要時 `git show <last-good-commit>:<path>`

判斷原則：

- `git diff` 應只包含預期的語意變更
- `Format-Hex` 應顯示正常 UTF-8 bytes
- 不可出現大段原文被替換成 mojibake 的情況

## 修復 SOP

若檔案已被寫壞，按以下順序處理：

1. 找出最後一個正常版本：

```powershell
git log --oneline -- <path>
git show <commit>:<path>
```

2. 從最後正常版本還原：

```powershell
git restore --source=<last-good-commit> -- <path>
```

3. 只補回後續真正需要保留的內容，優先用 `apply_patch`。
4. 驗證 `git diff` 與必要的 `Format-Hex`。
5. 以單一修復 commit 提交。

## 已知事故

### `docs/backlog-active.md` 事故（2026-04-24）

根因：

- 在 `3f91963 feat: add smoke checklist and test matrix` 期間，使用 PowerShell 讀出已顯示成 mojibake 的內容
- 再用 `Set-Content -Encoding UTF8` 寫回
- 結果把錯誤字串合法地存成 UTF-8，造成真正的內容損壞

修復：

- 從 `698eeab` 還原 `docs/backlog-active.md`
- 手動補回後續合法更新
- 以 `33f5450 fix: restore backlog active encoding` 提交修復

後續要求：

- 這份事故視為正式反例
- 未來若再改中文文件，必須依本文件流程操作

## Repo 防呆設定

### `.editorconfig`

```ini
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
```

### `.gitattributes`

```gitattributes
*.md text working-tree-encoding=UTF-8 eol=lf
*.ts text working-tree-encoding=UTF-8 eol=lf
*.tsx text working-tree-encoding=UTF-8 eol=lf
*.json text working-tree-encoding=UTF-8 eol=lf
```

這些設定是必要條件，但不是充分條件。真正的防線是：

1. 避免高風險 shell round-trip
2. 優先使用 `apply_patch`
3. 對中文文件做修改後的 diff/hex 驗證
