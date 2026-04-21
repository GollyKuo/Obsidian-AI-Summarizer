import type MediaSummarizerPlugin from "@plugin/MediaSummarizerPlugin";

export interface PluginLifecycleContext {
  hookCount: number;
}

export function registerLifecycleHooks(plugin: MediaSummarizerPlugin): PluginLifecycleContext {
  let hookCount = 0;

  const fileOpenRef = plugin.app.workspace.on("file-open", () => {
    plugin.log("info", "Workspace file-open event received.");
  });
  plugin.registerEvent(fileOpenRef);
  hookCount += 1;

  return { hookCount };
}
