# 編碼安全參考

## 給 Codex 的執行摘要

正式規範以 `docs/encoding-safety.md` 為準；本文件只保留執行時最重要的規則。

## 必守規則

1. 中文文件優先用 `apply_patch`，不要走 shell 文字 round-trip。
2. 禁止用 Windows PowerShell 5.1 的 `Get-Content` / `Set-Content` 讀出再寫回中文文件。
3. 禁止對 repo 中文文件使用 `Out-File`、`>`、`>>`。
4. 如果 shell 顯示 mojibake，就停止，不做任何回寫。
5. 若必須用 shell 改檔，只能用明確 .NET UTF-8 讀寫。

## 唯一允許的 shell 讀寫範例

```powershell
$path = "docs/dev_log.md"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

## 驗證

中文文件修改後至少做：

1. `git diff -- <path>`
2. 必要時 `Format-Hex <path>`
3. 必要時 `git show <last-good-commit>:<path>`

## 修復

若已寫壞：

1. `git log --oneline -- <path>`
2. `git show <last-good-commit>:<path>`
3. `git restore --source=<last-good-commit> -- <path>`
4. 用 `apply_patch` 補回合法後續修改
5. 單獨提交修復 commit

## 已知事故

`docs/backlog-active.md` 曾在 `3f91963` 因 PowerShell round-trip mojibake 被寫壞，後於 `33f5450` 修復。
