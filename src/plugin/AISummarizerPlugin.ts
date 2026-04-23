import { Notice, Plugin } from "obsidian";
import { registerCommands } from "@plugin/commands";
import { registerLifecycleHooks, type PluginLifecycleContext } from "@plugin/lifecycle";
import {
  resolveMediaCacheRoot,
  type MediaCacheRootResolution
} from "@services/media/media-cache-root";
import { AISummarizerSettingTab } from "@ui/settings-tab";
import {
  DEFAULT_SETTINGS,
  type AISummarizerPluginSettings
} from "@domain/settings";
import { SummarizerFlowModal } from "@ui/flow-modal/SummarizerFlowModal";

export default class AISummarizerPlugin extends Plugin {
  public settings: AISummarizerPluginSettings = { ...DEFAULT_SETTINGS };
  private lifecycleContext: PluginLifecycleContext | null = null;

  public async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new AISummarizerSettingTab(this.app, this));
    registerCommands(this);
    this.lifecycleContext = registerLifecycleHooks(this);
    this.notify("AI Summarizer plugin loaded.");
    this.log("info", "Plugin loaded.");
  }

  public onunload(): void {
    this.log("info", "Plugin unloaded.");
    if (this.lifecycleContext) {
      this.log("info", `Lifecycle hooks registered: ${this.lifecycleContext.hookCount}`);
      this.lifecycleContext = null;
    }
  }

  public async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded as Partial<AISummarizerPluginSettings> | null)
    };
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  public async resolveMediaCacheRootOrThrow(): Promise<MediaCacheRootResolution> {
    return resolveMediaCacheRoot(this.settings.mediaCacheRoot);
  }

  public openFlowModal(): void {
    new SummarizerFlowModal(this).open();
  }

  public openSettingsTab(): void {
    const appWithSettings = this.app as typeof this.app & {
      setting?: {
        open: () => void;
        openTabById: (id: string) => void;
      };
    };

    if (!appWithSettings.setting) {
      this.notify("Settings UI is not available in this context.");
      this.log("warn", "Attempted to open settings, but app.setting is unavailable.");
      return;
    }

    appWithSettings.setting.open();
    appWithSettings.setting.openTabById(this.manifest.id);
  }

  public notify(message: string): void {
    new Notice(message);
  }

  public log(level: "info" | "warn" | "error", message: string): void {
    if (!this.settings.debugMode && level === "info") {
      return;
    }

    const prefix = "[obsidian-ai-summarizer]";
    if (level === "info") {
      console.info(prefix, message);
      return;
    }
    if (level === "warn") {
      console.warn(prefix, message);
      return;
    }
    console.error(prefix, message);
  }
}
