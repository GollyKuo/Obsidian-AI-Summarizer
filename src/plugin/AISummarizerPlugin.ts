import { Notice, Plugin } from "obsidian";
import {
  createIssueReport,
  formatInfoReport,
  formatWarningReport,
  type IssueReport
} from "@services/diagnostics/issue-reporting";
import { registerCommands } from "@plugin/commands";
import { registerLifecycleHooks, type PluginLifecycleContext } from "@plugin/lifecycle";
import { startDependencyDriftMonitor } from "@plugin/dependency-drift-monitor";
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
    startDependencyDriftMonitor(this);
    this.notify("AI Summarizer plugin loaded.");
    this.reportInfo("plugin", "Plugin loaded.");
  }

  public onunload(): void {
    this.reportInfo("plugin", "Plugin unloaded.");
    if (this.lifecycleContext) {
      this.reportInfo("plugin", `Lifecycle hooks registered: ${this.lifecycleContext.hookCount}`);
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
      this.reportWarning("settings", "Attempted to open settings, but app.setting is unavailable.");
      return;
    }

    appWithSettings.setting.open();
    appWithSettings.setting.openTabById(this.manifest.id);
  }

  public notify(message: string): void {
    new Notice(message);
  }

  public reportInfo(context: string, message: string): void {
    this.log("info", formatInfoReport(context, message));
  }

  public reportWarning(context: string, warning: string): void {
    this.log("warn", formatWarningReport(context, warning));
  }

  public reportError(
    context: string,
    error: unknown,
    options: { notify?: boolean } = {}
  ): IssueReport {
    const report = createIssueReport(context, error);
    this.log(report.level === "warn" ? "warn" : "error", report.logMessage);
    if (options.notify ?? false) {
      this.notify(report.noticeMessage);
    }
    return report;
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
