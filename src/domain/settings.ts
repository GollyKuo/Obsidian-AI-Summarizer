import type { RetentionMode, SourceType } from "@domain/types";

export type RuntimeStrategy = "local_bridge" | "placeholder_only";
export type MediaCompressionProfile = "balanced" | "quality";

export interface AISummarizerPluginSettings {
  apiKey: string;
  model: string;
  outputFolder: string;
  mediaCacheRoot: string;
  mediaCompressionProfile: MediaCompressionProfile;
  templateReference: string;
  retentionMode: RetentionMode;
  runtimeStrategy: RuntimeStrategy;
  debugMode: boolean;
  lastSourceType: SourceType;
}

export const DEFAULT_SETTINGS: AISummarizerPluginSettings = {
  apiKey: "",
  model: "gemini-2.5-flash",
  outputFolder: "",
  mediaCacheRoot: "",
  mediaCompressionProfile: "balanced",
  templateReference: "",
  retentionMode: "none",
  runtimeStrategy: "local_bridge",
  debugMode: false,
  lastSourceType: "webpage_url"
};
