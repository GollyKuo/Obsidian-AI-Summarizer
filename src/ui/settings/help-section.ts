import { ButtonComponent } from "obsidian";

import type { SettingsSection } from "@ui/settings-copy";

export interface HelpSectionOptions {
  onNavigate: (section: SettingsSection) => void;
}

function renderHelpStepList(containerEl: HTMLElement, title: string, steps: string[]): void {
  const sectionEl = containerEl.createDiv({ cls: "ai-summarizer-help-section" });
  sectionEl.createEl("h3", { cls: "ai-summarizer-help-section-title", text: title });
  const listEl = sectionEl.createEl("ol", { cls: "ai-summarizer-help-list" });
  for (const step of steps) {
    listEl.createEl("li", { text: step });
  }
}

export function renderHelpSection(containerEl: HTMLElement, options: HelpSectionOptions): void {
  const helpEl = containerEl.createDiv({ cls: "ai-summarizer-help" });
  const actionEl = helpEl.createDiv({ cls: "ai-summarizer-help-actions" });
  const actionTextEl = actionEl.createDiv({ cls: "ai-summarizer-help-action-text" });
  actionTextEl.createEl("h3", { text: "下一步" });
  actionTextEl.createEl("p", { text: "先填 API key；如果要處理音訊或影片，再檢查媒體工具。" });

  const actionButtonsEl = actionEl.createDiv({ cls: "ai-summarizer-help-action-buttons" });
  new ButtonComponent(actionButtonsEl).setButtonText("前往 AI 模型").onClick(() => {
    options.onNavigate("ai_models");
  });
  new ButtonComponent(actionButtonsEl).setButtonText("前往診斷").onClick(() => {
    options.onNavigate("diagnostics");
  });

  const sectionsEl = helpEl.createDiv({ cls: "ai-summarizer-help-sections" });

  renderHelpStepList(sectionsEl, "第一次使用", [
    "安裝或更新 plugin 後，先確認 Community plugins 已啟用 AI Summarizer。",
    "到 AI 模型分頁填入 Gemini、Mistral 或 Gladia API key，並按測試確認可用。",
    "若要處理 YouTube、podcast 或本機音訊影片，到診斷分頁確認 ffmpeg、ffprobe、yt-dlp 可用。",
    "開啟 AI 摘要器，選擇網頁 URL、媒體 URL、本機媒體或文字檔案。",
    "完成後用開啟筆記檢查摘要結果；若網頁被阻擋或摘要失敗，可把正文或逐字稿存成文字檔案重跑摘要。"
  ]);

  renderHelpStepList(sectionsEl, "如何更新 plugin", [
    "關閉 Obsidian，再下載新版 AI Summarizer release zip。",
    "解壓縮 zip，打開 vault 裡的 .obsidian/plugins/ai-summarizer 資料夾。",
    "只用新版 main.js、manifest.json、styles.css 覆蓋同名舊檔案；如果有 versions.json，也一起覆蓋。",
    "不要刪掉整個 ai-summarizer 資料夾，避免移除 API key、provider、模型、輸出資料夾與工具路徑設定。",
    "重新開啟 Obsidian，確認 AI Summarizer 仍啟用，並到 AI 模型與診斷分頁檢查設定。"
  ]);
}
