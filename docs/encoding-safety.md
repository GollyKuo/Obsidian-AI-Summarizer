# Encoding Safety（Windows/PowerShell）

## 核心原則

1. 終端亂碼不等於原檔損壞。
2. 不要根據亂碼輸出直接覆寫來源文件。
3. 中文文件統一 UTF-8。

## 讀寫規則

1. 讀檔與寫檔都要明確指定 UTF-8。
2. 局部替換前先確認來源文字沒有被錯誤解碼。
3. 若發生疑似錯誤解碼，優先從 Git 歷史還原再重寫。

## PowerShell 建議用法

```powershell
# 讀檔（UTF-8）
Get-Content -Encoding UTF8 docs/dev_log.md

# 寫檔（UTF-8 without BOM）
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText('docs/dev_log.md', $content, $utf8NoBom)
```

```powershell
# 只調整終端顯示，避免誤判
chcp 65001
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

## 亂碼應變流程

1. 先確認是否只是終端顯示問題，不直接寫回檔案。
2. 用 `Get-Content -Encoding UTF8` 重新讀取比對。
3. 若檔案內容已污染，從 `git show` 或前一版恢復原文。
4. 以 UTF-8 明確寫回，最後再做 diff 確認只改預期行。
