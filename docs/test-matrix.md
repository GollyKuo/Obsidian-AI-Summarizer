# Test Matrix

最後更新：2026-05-05 22:25

## Capability Matrix

| Capability | Surface | Automated | Manual Smoke | Gate |
|---|---|---|---|---|
| `webpage` | desktop | integration + regression + unit | `npm run smoke:webpage` | `gate:local`, `gate:regression:desktop`, `gate:release` |
| `webpage` | mobile | none | `npm run smoke:mobile` | `gate:release` |
| `media_url` | desktop | integration + unit | `npm run smoke:media-url` | `gate:local`, `gate:release` |
| `local_media` | desktop | integration + unit | `npm run smoke:local-media` | `gate:local`, `gate:release` |
| `transcript_file` | desktop | integration + unit | manual via flow modal | `gate:local`, `gate:release` |
| `media_url` / `local_media` / `transcript_file` | mobile | none | not supported in v1 | excluded |
| `flow_modal_minimal_ui` | desktop + mobile-like narrow viewport | unit for source guidance / diagnostics when touched | [features/visual-qa-checklist.md](../features/visual-qa-checklist.md) + `npm run smoke:desktop` | `gate:local:vault` for implementation work |

## Manual Smoke Evidence

`scripts/smoke-checklist.mjs` can write structured evidence with `--record <path>`, `--operator`, `--result pending|pass|fail` and `--notes`. Use this for release evidence when a smoke checklist is executed manually, for example:

```bash
node scripts/smoke-checklist.mjs --surface desktop --record smoke-records/desktop.json --operator "Release Tester" --result pass --notes "desktop smoke completed"
```

### CAP-304 Flow Modal minimal UI visual QA

Manual QA source: [features/visual-qa-checklist.md](../features/visual-qa-checklist.md)

Required coverage when `CAP-304` changes UI/CSS/source guidance/result actions:

- Flow Modal scope does not pollute Obsidian global UI.
- Obsidian dark/light themes remain readable.
- Four source types are visible and source-specific guidance updates correctly.
- Long URL, long Windows path and long template path do not overflow.
- Running, cancelling, completed and failed states are visually distinct.
- Completed result provides note action; failed result provides source-aware next action.
- Narrow/mobile-like width does not depend on hover-only controls.

Automated/static evidence recorded on 2026-05-02:

- `npm run typecheck`
- `npm run test -- tests/unit/source-guidance.test.ts`
- `npm run build`
- `npm run smoke:desktop`
- Scoped CSS grep confirmed Flow Modal selectors remain under `.ai-summarizer-flow`; no global `body`, `.modal`, `.theme-dark`, `.theme-light`, `.mt-*`, or `.afc-*` namespace override was introduced.
- Manual Obsidian dark/light and narrow-width visual QA is still required before closing the visual QA checklist.

### 2026-05-02 CAP-202 / CAP-203 media URL smoke

環境：

- `yt-dlp 2026.02.21`
- `ffmpeg 8.1 essentials` / `ffprobe 8.1 essentials`
- `ffmpegPath` 由測試 vault plugin tools 提供，並透過 `yt-dlp --ffmpeg-location` 驗證 YouTube merge

| Case | Input URL | Source type | Source artifact | Normalized metadata | Result |
| --- | --- | --- | --- | --- | --- |
| YouTube short video | `https://www.youtube.com/watch?v=jNQXAC9IVRw` | `youtube` | `Me at the zoo.mp4` | title `Me at the zoo`; creator `jawed`; platform `YouTube`; created `2005-04-24` | pass; source artifact merged to single mp4; one yt-dlp JS runtime warning observed |
| Direct media sample | `https://samplelib.com/lib/preview/mp3/sample-15s.mp3` | `direct_media` | `sample-15s.mp3` | title `sample-15s`; creator `Unknown`; platform `Direct Media`; created `2026-05-01` | pass |

Balanced compression spot check is recorded in [media-acquisition-spec.md](media-acquisition-spec.md#balanced-profile-量測紀錄).

### 2026-05-02 CAP-205 Gladia provider smoke

來源：使用者於 Obsidian 測試 vault 實機回報。

| Case | Input | Transcription provider | Summary provider | Result |
| --- | --- | --- | --- | --- |
| Local media + Gladia | local media | Gladia / `default` | Gemini / `gemini-2.5-flash` | pass; completed summary and wrote note |
| Mixed provider | local media | Gladia / `default` | OpenRouter/Qwen | pass; completed summary and wrote note |

Additional check: final summaries did not expose `chunk` / `Chunk 1` / `part` processing markers.

## Automated Regression Evidence

### 2026-05-02 CAP-205 Gemini chunked transcription

| Case | Test | Coverage |
| --- | --- | --- |
| Gemini multi chunk inline transcription | `tests/unit/configured-ai-provider.test.ts` | verifies each `ai-upload` chunk is sent as its own Gemini `inline_data` request and transcripts are merged in order |
| Gemini partial transcript recovery diagnostics | `tests/unit/configured-ai-provider.test.ts` | verifies a failed later chunk reports chunk index, total chunks, completed chunk count and partial transcript markdown |
| Orchestration partial transcript recovery | `tests/integration/process-media.integration.test.ts` | verifies partial transcript markdown is written to the recovery transcript path when transcription fails mid-run |

### 2026-05-02 CAP-206 transcript/subtitle lifecycle

| Case | Test | Coverage |
| --- | --- | --- |
| Transcript/subtitle final handoff | `tests/integration/process-media.integration.test.ts` | verifies `transcript.md` and UTF-8 `subtitles.srt` are written after transcription and remain after `delete_temp` completed cleanup |
| Artifact manifest transcript lineage | `tests/unit/artifact-manifest.test.ts` | verifies manifest records `transcriptPath` and `subtitlePath` |
| Retention protection | `tests/unit/artifact-retention.test.ts` | verifies completed and failed cleanup preserve final transcript/subtitle artifacts |

### 2026-05-02 CAP-205 transcript-file summary retry

| Case | Test | Coverage |
| --- | --- | --- |
| Transcript file summary retry | `tests/integration/process-transcript-file.integration.test.ts` | verifies `.md` / `.txt` transcript input skips transcription, reuses adjacent `metadata.json` when present, falls back with warning when metadata is unavailable, and writes a regenerated media note |
| UI/source/template wiring | `tests/unit/source-guidance.test.ts`, `tests/unit/runtime-diagnostics.test.ts`, `tests/unit/template-library.test.ts` | verifies `transcript_file` copy, diagnostics readiness, and media-session template support |

### 2026-05-02 CAP-401 long-media global summary gate

| Case | Test | Coverage |
| --- | --- | --- |
| Long-media global summary regression | `tests/regression/media-summary-global.regression.test.ts` | verifies overlong transcripts use internal partial notes followed by final synthesis, strips internal `Chunk N` / `Part N` / `分段 N` labels from synthesis material, and writes only the clean final summary |

## Gate Intent

- `gate:local`: 型別、單元測試、整合測試、production build
- `gate:local:vault`: `gate:local` + 同步到測試 Vault 的 build
- `gate:regression:desktop`: 守住 `webpage` 主線與長媒體全局摘要輸出，避免 runtime / media 變更回歸
- `gate:release`: `gate:local` 後，執行 desktop/mobile smoke checklist

## Dependency Drift Policy

參考：`docs/dependency-update-strategy.md`

- drift `error`: `media_url` / `local_media` release blocked; `transcript_file` remains available if summary provider and note output are configured
- drift `warning`: 可放行，但需在 `dev_log` 記錄風險
- `webpage-only` 變更不因 drift `warning` 被阻塞

## Regression Focus

- runtime unavailable 不得破壞 `webpage` 主線
- 長媒體 partial notes 不得以 chunk/part/分段等內部技術標記進入最終筆記
- media retention mode 不得影響 note 輸出
- diagnostics / error reporting 變更不得讓錯誤落回 unknown path
