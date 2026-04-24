原因通常不是「文字壞掉」，而是同一段文字在不同階段被用不同編碼解讀。

在你這個環境，最常見是 3 層不一致：

1. 檔案編碼
- 檔案其實是 `UTF-8`
- 某個工具卻用 `Big5 / CP950 / ANSI` 去讀
- 讀進來就變成亂碼

2. 終端編碼
- Windows PowerShell 5.1、某些 shell、某些外部程式預設不是 UTF-8
- 螢幕顯示亂碼，有時只是顯示問題，有時會連寫回檔案一起污染

3. 寫檔工具預設值不同
- `Set-Content`、`Out-File`、舊版 PowerShell、某些腳本工具，預設編碼不一致
- 一旦「錯誤解碼後再存檔」，亂碼就真的寫進去了

你這次碰到的狀況，核心就是：
- repo 內中文文件是 UTF-8
- 某些讀寫流程沒有明確指定 UTF-8
- 文字被錯誤解碼後又寫回 `docs/dev_log.md`

**怎麼解決**
1. 全 repo 統一 UTF-8
- 所有 `.md`、`.ts`、`.json` 一律 UTF-8
- 不混用 ANSI / Big5 / UTF-16

2. 寫檔時永遠顯式指定編碼
- PowerShell 優先用：
```powershell
Get-Content -Encoding UTF8
Set-Content -Encoding UTF8
```
- 更穩的是：
```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

3. 讀檔時也指定 UTF-8
```powershell
[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
```

4. 盡量用 PowerShell 7
- 比 Windows PowerShell 5.1 的預設編碼安全很多

5. 終端固定成 UTF-8
可在 shell session 先設：
```powershell
chcp 65001
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

6. 不要混用多種寫檔方式
- 同一回合不要一部分用 `git show` + shell redirect，一部分又用 `Out-File`
- 尤其避免預設編碼不明的管線寫回

7. 一旦亂碼已寫入，優先從 Git 還原
- 如果是「錯誤解碼後再存檔」，原文字通常救不回來
- 正確做法是：
  - 從 `git show` / 歷史版本取回
  - 或人工重寫受污染行

**建議你在 repo 裡補 2 個東西**

1. `.editorconfig`
```ini
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
```

2. `.gitattributes`
```gitattributes
*.md text working-tree-encoding=UTF-8
*.ts text working-tree-encoding=UTF-8
*.json text working-tree-encoding=UTF-8
```

**實務規則**
- 讀檔指定 UTF-8
- 寫檔指定 UTF-8
- 用 PowerShell 7
- 亂碼發生後，不猜原文，直接回 Git 歷史

如果你要，我可以直接幫你把這個 repo 補上 `.editorconfig` / `.gitattributes`，再加一份 `docs/encoding-safety.md`。