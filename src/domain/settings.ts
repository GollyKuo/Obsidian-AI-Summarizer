import type { RetentionMode, SourceType } from "@domain/types";

export interface MediaSummarizerPluginSettings {
  apiKey: string;
  model: string;
  outputFolder: string;
  templateReference: string;
  retentionMode: RetentionMode;
  debugMode: boolean;
  lastSourceType: SourceType;
}

export const DEFAULT_SETTINGS: MediaSummarizerPluginSettings = {
  apiKey: "",
  model: "gemini-2.5-flash",
  outputFolder: "",
  templateReference: "",
  retentionMode: "none",
  debugMode: false,
  lastSourceType: "webpage_url"
};
