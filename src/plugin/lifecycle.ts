import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";

export interface PluginLifecycleContext {
  hookCount: number;
}

export function registerLifecycleHooks(plugin: AISummarizerPlugin): PluginLifecycleContext {
  let hookCount = 0;

  const fileOpenRef = plugin.app.workspace.on("file-open", () => {
    plugin.log("info", "Workspace file-open event received.");
  });
  plugin.registerEvent(fileOpenRef);
  hookCount += 1;

  return { hookCount };
}
