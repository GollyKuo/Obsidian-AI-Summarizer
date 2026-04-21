# Discussion

最後更新：2026-04-21

本文件集中管理尚未定案、需要進一步討論，或需要在正式文件回寫前先收斂的問題。

## 使用規則

1. 新的討論點先列在這裡。
2. 一旦定案，要把結論回寫到正式文件。
3. 已定案且已同步的項目，應移出 active 區。

## Active Topics

1. 這個 repo 作為本專案起始骨架，是否還缺少必要的初始化檔案或規則。
2. `RuntimeProvider` 的 v1 策略要先採 placeholder-only，還是同時定義 local bridge 草案。
3. `local media` 的 v1 輸入範圍要先限制為 vault file，還是保留外部檔案橋接能力。
4. template 整合在 v1 要先支援 `template note path`，還是同時支援資料夾與選擇器。
5. `webpage flow` 的 native 實作範圍要到哪裡，哪些能力應標記為 `runtime-dependent`。

## Parking Lot

1. 字幕嵌入能力在 plugin v1 的必要程度。
2. 是否需要 job history / batch processing。
