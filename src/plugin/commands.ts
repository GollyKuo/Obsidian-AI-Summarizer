import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";

export function registerCommands(plugin: MediaSummarizerPlugin): void {
  plugin.addRibbonIcon("sparkles", "開啟 AI 摘要器", () => {
    plugin.openFlowModal();
    plugin.log("info", "Ribbon icon clicked.");
  });

  plugin.addCommand({
    id: "open-ai-summarizer",
    name: "開啟 AI 摘要器",
    callback: () => {
      plugin.openFlowModal();
      plugin.log("info", "Open command executed.");
    }
  });

  plugin.addCommand({
    id: "open-ai-summarizer-settings",
    name: "開啟 AI 摘要器設定",
    callback: () => {
      plugin.openSettingsTab();
      plugin.log("info", "Settings command executed.");
    }
  });
}
