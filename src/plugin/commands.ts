import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";
import { SummarizerFlowModal } from "@ui/flow-modal/SummarizerFlowModal";

export function registerCommands(plugin: MediaSummarizerPlugin): void {
  plugin.addCommand({
    id: "open-ai-summarizer",
    name: "Open AI Summarizer",
    callback: () => {
      new SummarizerFlowModal(plugin).open();
      plugin.log("info", "Open command executed.");
    }
  });

  plugin.addCommand({
    id: "open-ai-summarizer-settings",
    name: "Open AI Summarizer Settings",
    callback: () => {
      plugin.openSettingsTab();
      plugin.log("info", "Settings command executed.");
    }
  });
}
