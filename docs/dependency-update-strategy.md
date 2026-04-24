# Dependency Update Strategy

最後更新：2026-04-24 10:06

## 目標

讓 `yt-dlp`、`ffmpeg`、`ffprobe` 的版本漂移可觀測、可提醒，不阻塞 plugin 啟動。

## v1 策略

1. 啟動後背景執行依賴檢查，不等待完成。
2. 檢查設有 timeout，逾時只記錄 warning，不中斷載入。
3. `yt-dlp` 版本採 release date 解析，超過門檻天數視為 drift warning。
4. `ffmpeg` / `ffprobe` 解析 major version，若版本過舊或 major 不一致，視為 compatibility warning。
5. 缺少依賴視為 drift error，但只影響 media 能力，不影響 plugin 基本載入。

## 判定規則（v1）

1. `yt-dlp` 最大建議版本年齡：`120` 天
2. `ffmpeg` 最小 major：`6`
3. `ffprobe` 最小 major：`6`
4. `ffmpeg` 與 `ffprobe` major 必須一致

## 與 Diagnostics 的關係

runtime diagnostics 會多一段 `Dependency drift`：

1. `ready`: 無版本漂移風險
2. `warning`: 存在版本老化或相容性風險
3. `error`: 依賴缺失或重大 drift
4. `skipped`: 非 `local_bridge` 或依賴檢查不可用

## 對 Smoke / Release Gate 的影響

1. `webpage-only` 變更：`Dependency drift warning` 不阻塞 release。
2. 觸及 `media_url` / `local_media` 的變更：
3. 若 `Dependency drift` 為 `error`，release 應視為 blocked。
4. 若 `Dependency drift` 為 `warning`，可放行但需在 `dev_log` 記錄原因與風險。

## 後續（vNext）

1. 加入自動更新建議（例如顯示推薦更新命令）
2. 加入週期性背景檢查與節流
3. 加入平台專屬相容性規則（Windows/macOS/Linux）
4. 將 drift 指標接入 CI artifact 或 release checklist

