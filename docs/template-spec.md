# Template Spec 摘要筆記模板規格

最後更新：2026-05-03

## 目的

本文件是 AI Summarizer 摘要筆記模板的規格來源。使用手冊只保留操作導覽；模板選項、內建模板內容、placeholder 與寫入規則以本文件為準。

相關實作：

- `src/services/obsidian/template-library.ts`
- `src/services/obsidian/template-resolver.ts`
- `src/services/obsidian/note-writer.ts`

## 模板選項

Flow Modal 與 Settings Tab 目前提供四類選項：

1. `預設 YAML`
2. `預設摘要模板`
3. `Webpage Brief`
4. `Media Session`
5. `自訂模板`

其中 `預設摘要模板`、`Webpage Brief`、`Media Session` 是程式內建模板；`自訂模板` 會讀取 vault 內的相對路徑。

## 寫入規則

### 預設 YAML

當 `templateReference` 是空字串時，輸出標準 YAML frontmatter，格式為：

```markdown
---
Title: "..."
Creator: "..."
Platform: "..."
Source: "..."
Created: "..."
---

<摘要正文>
```

媒體來源、逐字稿檔案重跑摘要會在摘要正文後追加：

```markdown
## Transcript

<逐字稿>
```

### 內建模板

內建模板會先輸出標準 frontmatter，再套用內建模板 body，最後接摘要正文：

```markdown
<標準 frontmatter>
<內建模板 body>

<摘要正文>
```

媒體來源、逐字稿檔案重跑摘要同樣會在摘要正文後追加 `## Transcript`。

### 自訂模板

自訂模板會讀取 vault 內指定的 Markdown 檔案，套用 placeholder 後接摘要正文：

```markdown
<自訂模板內容>

<摘要正文>
```

注意：自訂模板不會自動補標準 frontmatter。若自訂模板需要 frontmatter，請直接寫在自訂模板檔案中。

若自訂模板路徑不存在或讀取不到內容，系統會回退到 `預設 YAML` 輸出。

## Placeholder

模板 body 支援下列 placeholder：

| Placeholder | 來源欄位 | 說明 |
| --- | --- | --- |
| `{{title}}` | `metadata.title` | 筆記標題；空值會正規化為 `Untitled`。 |
| `{{creatorOrAuthor}}` | `metadata.creatorOrAuthor` | 作者、創作者或講者；空值會正規化為 `Unknown`。 |
| `{{platform}}` | `metadata.platform` | 來源平台，例如 Web、YouTube、Transcript File。 |
| `{{source}}` | `metadata.source` | 原始 URL、媒體來源或逐字稿來源。 |
| `{{created}}` | `metadata.created` | ISO timestamp；缺漏或無效時會重新產生。 |

目前不支援條件語法、迴圈、include、frontmatter merge 或自訂 helper。

## 內建模板

### 預設摘要模板

Reference：`builtin:default`

UI label：`預設摘要模板`

用途：

- 適合所有來源類型。
- 在標準 frontmatter 後補一段簡短來源脈絡。
- 適合作為比 `預設 YAML` 多一點上下文的通用模板。

支援來源：

- `webpage_url`
- `media_url`
- `local_media`
- `transcript_file`

模板 body：

```markdown
> 由 AI Summarizer 產生

## Source Context

- Creator: "{{creatorOrAuthor}}"
- Platform: "{{platform}}"
- Created: "{{created}}"
```

輸出結構：

```markdown
<標準 frontmatter>
> 由 AI Summarizer 產生

## Source Context

- Creator: "..."
- Platform: "..."
- Created: "..."

<摘要正文>
```

### Webpage Brief

Reference：`builtin:webpage-brief`

UI label：`Webpage Brief`

用途：

- 適合文章、文件與一般網頁摘要。
- 在摘要正文前保留 URL、作者與擷取時間。
- 適合需要回查網頁來源的筆記。

支援來源：

- `webpage_url`

模板 body：

```markdown
## Capture

- URL: "{{source}}"
- Author: "{{creatorOrAuthor}}"
- Captured At: "{{created}}"
```

輸出結構：

```markdown
<標準 frontmatter>
## Capture

- URL: "..."
- Author: "..."
- Captured At: "..."

<摘要正文>
```

目前 UI 不會依來源類型隱藏不適用的內建模板；若在媒體或逐字稿 flow 中手動選用 `Webpage Brief`，仍會照樣套用，但語意可能不如 `Media Session`。

### Media Session

Reference：`builtin:media-session`

UI label：`Media Session`

用途：

- 適合影音來源、本機媒體與保留逐字稿重跑摘要。
- 在摘要正文前保留來源、講者 / 創作者與擷取時間。
- 適合需要同時閱讀摘要與 transcript 的媒體筆記。

支援來源：

- `media_url`
- `local_media`
- `transcript_file`

模板 body：

```markdown
## Session

- Source: "{{source}}"
- Speaker / Creator: "{{creatorOrAuthor}}"
- Captured At: "{{created}}"
```

輸出結構：

```markdown
<標準 frontmatter>
## Session

- Source: "..."
- Speaker / Creator: "..."
- Captured At: "..."

<摘要正文>

## Transcript

<逐字稿>
```

## 自訂模板

選擇 `自訂模板` 後，請填入 vault 內的相對路徑，例如：

```text
Templates/ai-summary-template.md
```

自訂模板範例：

```markdown
---
type: ai-summary
source: "{{source}}"
platform: "{{platform}}"
created: "{{created}}"
---

# {{title}}

Author: {{creatorOrAuthor}}
```

輸出時會變成：

```markdown
<套用 placeholder 後的自訂模板>

<摘要正文>
```

媒體來源與逐字稿重跑摘要仍會在摘要正文後追加 `## Transcript`。

## 同步規則

當新增、刪除或修改內建模板時，請同步更新：

- `src/services/obsidian/template-library.ts`
- 本文件的「內建模板」段落
- `docs/Manual.md` 的「輸出模板」導覽連結或摘要
- `tests/unit/template-library.test.ts`
