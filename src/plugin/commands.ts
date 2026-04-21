import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";
import { SummarizerFlowModal } from "@ui/flow-modal/SummarizerFlowModal";

export function registerCommands(plugin: MediaSummarizerPlugin): void {
  plugin.addCommand({
    id: "open-ai-summarizer",
    name: "開啟 AI 摘要器",
    callback: () => {
      new SummarizerFlowModal(plugin).open();
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
