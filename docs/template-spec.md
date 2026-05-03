# Template Spec 摘要筆記模板規格

最後更新：2026-05-03

## 目的

本文件是 AI Summarizer 寫入 Obsidian 筆記時，輸出模板與 YAML frontmatter 的規格來源。

目前產品方向是：

1. UI 只提供兩種主要模板選擇：`預設通用 Frontmatter` 與 `自訂模板`。
2. `預設通用 Frontmatter` 是內建模板，只負責自動帶入摘要筆記的 YAML frontmatter。
3. `自訂模板` 是進階模式，可使用 Obsidian 模板格式內容，不限制只能修改 YAML 欄位。
4. 模板資料結構需保留未來擴充更多內建模板的空間。

相關實作：

- `src/services/obsidian/template-library.ts`
- `src/services/obsidian/template-resolver.ts`
- `src/services/obsidian/note-writer.ts`

## 模板選項

Flow Modal 與 Settings Tab 後續提供兩種使用者可見選項：

| UI 選項 | 定位 | 輸出控制範圍 |
| --- | --- | --- |
| `預設通用 Frontmatter` | 內建預設模板 | 只控制 YAML frontmatter，摘要正文由系統接在後面。 |
| `自訂模板` | 使用者自訂 Obsidian 模板 | 可控制 frontmatter 與 Markdown body，系統再依規則接上 AI 摘要與 transcript。 |

內部資料結構應保留 template reference，例如：

| Reference | UI label | 說明 |
| --- | --- | --- |
| `builtin:universal-frontmatter` | `預設通用 Frontmatter` | 目前唯一內建模板。 |
| `custom:<path>` | `自訂模板` | 指向使用者選擇或新增的 Obsidian 模板內容。 |

新設定應使用明確的 `builtin:universal-frontmatter`。為了相容既有設定，實作時仍需接受空字串 `templateReference`，並將它視為 `builtin:universal-frontmatter`。

## 預設通用 Frontmatter

### 用途

`預設通用 Frontmatter` 用於大多數摘要筆記。它只產生 YAML frontmatter，不插入額外 Markdown body 區塊。

輸出基本結構：

```markdown
---
Title: 摘要來源的標題
Book:
Author:
Creator:
Description: 1~2 句話簡介
tags:
Platform: YouTube
Source: https://example.com/source
Created: 2026-05-03
---

<AI 摘要正文>
```

媒體來源與逐字稿檔案重跑摘要會在摘要正文後追加：

```markdown
## Transcript

<逐字稿>
```

### 欄位定義

| 欄位 | 來源與規則 |
| --- | --- |
| `Title` | 摘要來源的標題。若來源沒有標題，使用正規化後的 `Untitled`。 |
| `Book` | 如果內容是介紹一本書，填入書名；否則留空。 |
| `Author` | 如果 `Book` 有值，填入該書作者；否則留空。 |
| `Creator` | podcast / YouTube 頻道名稱，或網頁創作者。若無法判斷，留空或使用既有 metadata 的 creator。 |
| `Description` | 由摘要來源產生 1~2 句話簡介。 |
| `tags` | 若未來自動建立閃卡功能啟用且本次勾選製作閃卡，加入 `Flashcard`；未勾選時保留 `tags:` 欄位但值留空。 |
| `Platform` | 判斷來源平台後填入：YouTube、Podcast、Web、本機檔案。 |
| `Source` | 擷取來源網址；本機檔案可填入原始檔名或可回查路徑。 |
| `Created` | 擷取日期，格式為 `YYYY-MM-DD`。 |

### 預設輸出格式

```markdown
---
Title: "{{title}}"
Book: "{{book}}"
Author: "{{author}}"
Creator: "{{creator}}"
Description: "{{description}}"
tags: {{tags}}
Platform: "{{platform}}"
Source: "{{source}}"
Created: "{{createdDate}}"
---
```

`tags` 欄位固定保留。未勾選製作閃卡時留空，已勾選時輸出 `Flashcard` 標籤：

未勾選閃卡：

```yaml
tags:
```

已勾選閃卡：

```yaml
tags:
  - Flashcard
```

## 自訂模板

### 用途

`自訂模板` 讓使用者選擇或新增 Obsidian 模板格式內容。自訂模板不限制只能增修 YAML frontmatter，也可以包含 Markdown 標題、固定段落、callout、Dataview 欄位或其他 Obsidian 慣用模板內容。

範例：

```markdown
---
type: ai-summary
title: "{{title}}"
source: "{{source}}"
created: "{{createdDate}}"
---

# {{title}}

來源：{{source}}

## 我的筆記
```

輸出時會先套用自訂模板，再接上 AI 摘要正文：

```markdown
<套用 placeholder 後的自訂模板>

<AI 摘要正文>
```

媒體來源與逐字稿檔案重跑摘要仍會在最後追加 `## Transcript`。

若自訂模板包含 `{{summary}}` 或 `{{transcript}}`，系統應改用明確插入位置：

```markdown
---
title: "{{title}}"
---

# {{title}}

{{summary}}

## 原始逐字稿

{{transcript}}
```

插入規則：

1. 若模板包含 `{{summary}}`，AI 摘要正文插入該位置；若未包含，AI 摘要正文接在模板後方。
2. 若模板包含 `{{transcript}}` 且本次有逐字稿，逐字稿插入該位置；若模板未包含且本次有逐字稿，仍在最後追加 `## Transcript`。
3. 若模板包含 `{{transcript}}` 但本次沒有逐字稿，該 placeholder 置換為空字串。

### 讀取規則

自訂模板來源應支援：

1. 從 Obsidian vault 內選擇既有模板檔案。
2. 新增一份自訂模板內容後儲存供後續使用。
3. 未來若支援從電腦任意位置選取檔案，需將內容匯入或複製到 plugin 可穩定讀取的位置，避免依賴不可攜的本機絕對路徑。

若自訂模板路徑不存在、讀取失敗或內容為空，系統回退到 `預設通用 Frontmatter`。

## Placeholder

模板支援下列 placeholder。`預設通用 Frontmatter` 會使用其中一部分；自訂模板可自行選用。

| Placeholder | 來源欄位 | 說明 |
| --- | --- | --- |
| `{{title}}` | `metadata.title` | 摘要來源標題；空值正規化為 `Untitled`。 |
| `{{book}}` | summary model / future metadata enrichment | 內容介紹書籍時的書名；否則空值。 |
| `{{author}}` | summary model / future metadata enrichment | 書籍作者；若不適用則空值。 |
| `{{creator}}` | `metadata.creatorOrAuthor` / future metadata enrichment | 頻道、podcast、網頁創作者。 |
| `{{creatorOrAuthor}}` | `metadata.creatorOrAuthor` | 相容既有模板的舊 placeholder。 |
| `{{description}}` | summary model / future metadata enrichment | 1~2 句話簡介。 |
| `{{tags}}` | settings / flow state | YAML tags 輸出；閃卡勾選時包含 `Flashcard`。 |
| `{{platform}}` | metadata normalization | YouTube、Podcast、Web、本機檔案。 |
| `{{source}}` | `metadata.source` | 原始 URL、媒體來源、逐字稿來源或本機檔案來源。 |
| `{{createdDate}}` | `metadata.created` | `YYYY-MM-DD` 日期。 |
| `{{created}}` | `metadata.created` | 相容既有模板的 ISO timestamp。 |
| `{{summary}}` | AI summary result | 自訂模板專用；指定 AI 摘要正文插入位置。 |
| `{{transcript}}` | transcript result | 自訂模板專用；指定逐字稿插入位置，僅媒體來源與逐字稿檔案有值。 |

目前不支援條件語法、迴圈、include、frontmatter merge 或自訂 helper。

## Metadata 欄位產生策略

`Book`、`Author`、`Description` 不是所有來源都能從 URL 或檔案 metadata 直接取得，需要 AI 或額外規則補齊。這裡的「metadata enrichment 步驟」是指：在主要摘要流程之外，另外執行一個專門產生結構化 metadata 的步驟。

兩種方案差異如下：

| 方案 | 做法 | 優點 | 缺點 |
| --- | --- | --- | --- |
| 摘要模型同時輸出 | 摘要 prompt 同時要求 AI 產生摘要正文與 `Book`、`Author`、`Description` 等欄位。 | 流程較簡單；少一次 AI 呼叫；成本與等待時間較低；欄位可直接參考摘要內容。 | 摘要輸出契約會變複雜；若 metadata 格式錯誤，可能影響整體解析；不容易只重跑 metadata。 |
| 另做 metadata enrichment | 摘要完成前後，另跑一個小型結構化任務，只輸出 `Book`、`Author`、`Description` 等欄位。 | 欄位格式較好驗證；可獨立重試或略過；不會污染摘要正文 prompt；未來可替換成規則、快取或不同模型。 | 多一次處理步驟；可能增加成本與等待時間；多一個失敗點；Description 可能與最終摘要語氣不完全一致。 |

第一版先採「摘要模型同時輸出」：摘要 prompt 需同時產生 AI 摘要正文，以及 `Book`、`Author`、`Description` 對應欄位。實作時需保留 metadata enrichment 的擴充性，讓後續可以在不破壞模板 placeholder contract 的前提下，將這些欄位改由獨立結構化步驟產生。

## 平台判斷

`Platform` 欄位依來源與 metadata 正規化：

| 來源 | Platform |
| --- | --- |
| YouTube URL | `YouTube` |
| Podcast feed / episode URL | `Podcast` |
| 一般網頁 | `Web` |
| 本機音訊或影片 | `本機檔案` |
| 逐字稿檔案 | `本機檔案` |

## 寫入規則

### 使用預設通用 Frontmatter

```markdown
<預設通用 YAML frontmatter>

<AI 摘要正文>

<Transcript 區塊，僅媒體來源與逐字稿檔案需要>
```

### 使用自訂模板

```markdown
<套用 placeholder 後的自訂模板完整內容>

<AI 摘要正文>

<Transcript 區塊，僅媒體來源與逐字稿檔案需要>
```

若自訂模板包含 `{{summary}}` 或 `{{transcript}}`，依自訂模板章節的插入規則處理；若沒有明確插入位置，維持「模板內容在前，AI 摘要接在後面，逐字稿最後追加」的預設規則。

## 未來擴充

雖然 UI 第一版只提供兩種選項，資料結構需保留新增更多內建模板的能力，例如：

- `builtin:book-frontmatter`
- `builtin:youtube-frontmatter`
- `builtin:podcast-frontmatter`
- `builtin:webpage-frontmatter`

新增內建模板時，應只增加 UI 選項與 template reference，不破壞既有 `預設通用 Frontmatter` 與 `自訂模板` 行為。

## 實作同步規則

當模板規格變更時，請同步更新：

- `src/services/obsidian/template-library.ts`
- `src/services/obsidian/template-resolver.ts`
- `src/services/obsidian/note-writer.ts`
- `docs/Manual.md` 的「輸出模板」導覽
- `tests/unit/template-library.test.ts`
- note writer / template resolver 相關測試
