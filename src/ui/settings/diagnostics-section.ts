import { Setting } from "obsidian";

import type { AISummarizerPluginSettings } from "@domain/settings";
import {
  formatRuntimeDiagnosticsSummary,
  type DiagnosticsState,
  type RuntimeDiagnosticsSummary
} from "@services/media/runtime-diagnostics";
import { DIAGNOSTIC_CAPABILITY_LABELS } from "@ui/settings-copy";
import type { MediaToolPathSettingKey } from "@ui/settings/types";

function getMediaToolPlaceholder(toolName: string): string {
  if (process.platform !== "win32") {
    return `例如 /usr/local/bin/${toolName}`;
  }
  if (toolName === "yt-dlp") {
    return "例如 C:\\Tools\\yt-dlp\\yt-dlp.exe";
  }
  return `例如 C:\\ffmpeg\\bin\\${toolName}.exe`;
}

function getDiagnosticStateLabel(state: DiagnosticsState): string {
  if (state === "ready") {
    return "可用";
  }
  if (state === "warning") {
    return "需注意";
  }
  if (state === "error") {
    return "不可用";
  }
  return "略過";
}

function getDiagnosticStatusText(summary: RuntimeDiagnosticsSummary): string {
  if (summary.overallState === "ready") {
    return "正常";
  }
  if (summary.overallState === "warning") {
    return "需注意";
  }
  return "異常";
}

function getDiagnosticUserMessage(summary: RuntimeDiagnosticsSummary): string {
  if (summary.dependencies.state === "error" && summary.dependencies.diagnostics) {
    const missingDependencies = summary.dependencies.diagnostics.statuses
      .filter((status) => !status.available)
      .map((status) => status.name)
      .join(" / ");

    return `缺少 ${missingDependencies}，音訊與影片轉錄目前無法使用。`;
  }

  if (summary.overallState === "ready") {
    return "網頁摘要、媒體網址與本機音訊/影片功能都可以使用。";
  }

  if (summary.overallState === "warning") {
    return "部分媒體功能需要注意，請展開詳細資訊確認環境狀態。";
  }

  return "媒體處理環境尚未準備完成，音訊與影片相關功能可能無法使用。";
}

export interface DiagnosticsSectionOptions {
  diagnosticsLoading: boolean;
  hasVaultFilesystemAccess: boolean;
  mediaToolInstallInProgress: boolean;
  runtimeDiagnostics: RuntimeDiagnosticsSummary | null;
  runtimeDiagnosticsError: string | null;
  settings: AISummarizerPluginSettings;
  saveSettings: () => Promise<void>;
  onAutoDetectMediaToolExecutable: (settingKey: MediaToolPathSettingKey, toolName: string) => void;
  onCancelProjectMediaToolInstall: () => void;
  onInstallOrUpdateProjectMediaTool: (settingKey: MediaToolPathSettingKey) => void;
  onInvalidateRuntimeDiagnostics: () => void;
  onPickMediaToolExecutable: (settingKey: MediaToolPathSettingKey) => void;
  onRefreshDiagnostics: () => void;
}

function renderDiagnosticOverview(
  containerEl: HTMLElement,
  options: DiagnosticsSectionOptions
): void {
  const diagnosticsSetting = new Setting(containerEl).setName("媒體處理狀態");
  const diagnosticsEl = diagnosticsSetting.descEl.createDiv({
    cls: "ai-summarizer-diagnostics"
  });

  if (options.runtimeDiagnosticsError) {
    diagnosticsEl.createEl("p", { text: options.runtimeDiagnosticsError });
    diagnosticsSetting.addExtraButton((button) => {
      button.setIcon("alert-triangle").setTooltip("檢查失敗");
    });
    return;
  }

  if (options.diagnosticsLoading) {
    diagnosticsEl.createEl("p", { text: "正在確認外掛執行環境與媒體處理工具。" });
    diagnosticsSetting.addExtraButton((button) => {
      button.setIcon("refresh-cw").setTooltip("檢查中");
    });
    return;
  }

  if (!options.runtimeDiagnostics) {
    diagnosticsEl.createEl("p", { text: "按下重新檢查後，這裡會顯示目前可用功能。" });
    diagnosticsSetting.addExtraButton((button) => {
      button.setIcon("circle-help").setTooltip("尚未檢查");
    });
    return;
  }

  const statusText = getDiagnosticStatusText(options.runtimeDiagnostics);
  diagnosticsSetting.addExtraButton((button) => {
    button
      .setIcon(options.runtimeDiagnostics?.overallState === "ready" ? "check-circle" : "alert-triangle")
      .setTooltip(`狀態：${statusText}`);
  });

  const statusEl = diagnosticsEl.createDiv();
  statusEl.style.display = "inline-flex";
  statusEl.style.alignItems = "center";
  statusEl.style.gap = "0.5rem";
  statusEl.style.marginBottom = "0.5rem";
  statusEl.createSpan({ text: statusText });

  diagnosticsEl.createEl("p", { text: getDiagnosticUserMessage(options.runtimeDiagnostics) });

  const listEl = diagnosticsEl.createDiv();
  listEl.style.display = "grid";
  listEl.style.gap = "0.35rem";
  listEl.style.marginTop = "0.75rem";
  for (const capability of options.runtimeDiagnostics.capabilities) {
    const rowEl = listEl.createDiv();
    rowEl.style.display = "grid";
    rowEl.style.gridTemplateColumns = "minmax(10rem, 1fr) auto";
    rowEl.style.gap = "1rem";
    rowEl.style.alignItems = "center";

    const label = DIAGNOSTIC_CAPABILITY_LABELS[capability.sourceType];
    const status = getDiagnosticStateLabel(capability.state);
    rowEl.createSpan({ text: label });
    rowEl.createSpan({ text: status });
  }

  const detailsEl = diagnosticsEl.createEl("details");
  detailsEl.style.marginTop = "0.85rem";
  detailsEl.createEl("summary", { text: "詳細資訊" });
  detailsEl.createEl("pre", {
    text: formatRuntimeDiagnosticsSummary(options.runtimeDiagnostics).join("\n")
  });
}

function renderMediaToolPathSetting(
  containerEl: HTMLElement,
  settingKey: MediaToolPathSettingKey,
  toolName: string,
  options: DiagnosticsSectionOptions
): void {
  const isYtDlp = settingKey === "ytDlpPath";
  new Setting(containerEl)
    .setName(toolName)
    .setDesc(
      isYtDlp
        ? "可留空使用系統 PATH；按「自動偵測」會尋找 PATH 中的 yt-dlp，按「自動填入」會下載或更新外掛資料夾內的 yt-dlp。"
        : "可留空使用系統 PATH；按「自動偵測」會尋找 PATH 中的工具，按「自動填入」會下載或更新外掛資料夾內的 ffmpeg/ffprobe。"
    )
    .addText((text) =>
      text
        .setPlaceholder(getMediaToolPlaceholder(toolName))
        .setValue(options.settings[settingKey])
        .onChange(async (value) => {
          options.settings[settingKey] = value.trim();
          options.onInvalidateRuntimeDiagnostics();
          await options.saveSettings();
        })
    )
    .addButton((button) =>
      button.setButtonText("選擇檔案").onClick(() => {
        options.onPickMediaToolExecutable(settingKey);
      })
    )
    .addButton((button) =>
      button
        .setButtonText("自動偵測")
        .setDisabled(options.mediaToolInstallInProgress)
        .onClick(() => {
          options.onAutoDetectMediaToolExecutable(settingKey, toolName);
        })
    )
    .addButton((button) =>
      button
        .setButtonText(options.mediaToolInstallInProgress ? "取消下載" : "自動填入")
        .setDisabled(!options.mediaToolInstallInProgress && !options.hasVaultFilesystemAccess)
        .onClick(() => {
          if (options.mediaToolInstallInProgress) {
            options.onCancelProjectMediaToolInstall();
            return;
          }
          options.onInstallOrUpdateProjectMediaTool(settingKey);
        })
    );
}

function renderMediaToolPathSettings(containerEl: HTMLElement, options: DiagnosticsSectionOptions): void {
  containerEl.createEl("h3", { text: "媒體工具路徑" });
  renderMediaToolPathSetting(containerEl, "ytDlpPath", "yt-dlp", options);
  renderMediaToolPathSetting(containerEl, "ffmpegPath", "ffmpeg", options);
  renderMediaToolPathSetting(containerEl, "ffprobePath", "ffprobe", options);
}

export function renderDiagnosticsSection(
  containerEl: HTMLElement,
  options: DiagnosticsSectionOptions
): void {
  new Setting(containerEl)
    .setName("除錯模式")
    .setDesc("開啟後會輸出更多 plugin log。")
    .addToggle((toggle) =>
      toggle.setValue(options.settings.debugMode).onChange(async (value) => {
        options.settings.debugMode = value;
        await options.saveSettings();
      })
    );

  renderMediaToolPathSettings(containerEl, options);

  new Setting(containerEl)
    .setName("媒體功能檢查")
    .setDesc("確認網頁摘要、媒體網址與本機音訊/影片是否可用。")
    .addButton((button) =>
      button
        .setButtonText(options.diagnosticsLoading ? "檢查中..." : "重新檢查")
        .setDisabled(options.diagnosticsLoading)
        .onClick(() => {
          options.onRefreshDiagnostics();
        })
    );

  renderDiagnosticOverview(containerEl, options);
}
