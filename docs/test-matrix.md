# Test Matrix

最後更新：2026-05-02 01:50

## Capability Matrix

| Capability | Surface | Automated | Manual Smoke | Gate |
|---|---|---|---|---|
| `webpage` | desktop | integration + regression + unit | `npm run smoke:webpage` | `gate:local`, `gate:regression:desktop`, `gate:release` |
| `webpage` | mobile | none | `npm run smoke:mobile` | `gate:release` |
| `media_url` | desktop | integration + unit | `npm run smoke:media-url` | `gate:local`, `gate:release` |
| `local_media` | desktop | integration + unit | `npm run smoke:local-media` | `gate:local`, `gate:release` |
| `media_url` / `local_media` | mobile | none | not supported in v1 | excluded |

## Manual Smoke Evidence

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

## Gate Intent

- `gate:local`: 型別、單元測試、整合測試、production build
- `gate:local:vault`: `gate:local` + 同步到測試 Vault 的 build
- `gate:regression:desktop`: 守住 `webpage` 主線，避免 runtime / media 變更回歸
- `gate:release`: `gate:local` 後，執行 desktop/mobile smoke checklist

## Dependency Drift Policy

參考：`docs/dependency-update-strategy.md`

- drift `error`: `media_url` / `local_media` release blocked
- drift `warning`: 可放行，但需在 `dev_log` 記錄風險
- `webpage-only` 變更不因 drift `warning` 被阻塞

## Regression Focus

- runtime unavailable 不得破壞 `webpage` 主線
- media retention mode 不得影響 note 輸出
- diagnostics / error reporting 變更不得讓錯誤落回 unknown path
