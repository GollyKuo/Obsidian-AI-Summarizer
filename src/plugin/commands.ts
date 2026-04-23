import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";

export function registerCommands(plugin: AISummarizerPlugin): void {
  plugin.addRibbonIcon("sparkles", "開啟 AI 摘要器", () => {
    plugin.openFlowModal();
    plugin.reportInfo("commands", "Ribbon icon clicked.");
  });

  plugin.addCommand({
    id: "open-ai-summarizer",
    name: "開啟 AI 摘要器",
    callback: () => {
      plugin.openFlowModal();
      plugin.reportInfo("commands", "Open command executed.");
    }
  });

  plugin.addCommand({
    id: "open-ai-summarizer-settings",
    name: "開啟 AI 摘要器設定",
    callback: () => {
      plugin.openSettingsTab();
      plugin.reportInfo("commands", "Settings command executed.");
    }
  });
}
