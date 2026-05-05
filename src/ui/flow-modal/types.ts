import type { JobStatus } from "@domain/jobs";

export type UiStatus = "idle" | "running" | "cancelling" | "completed" | "failed" | "cancelled";

export interface StageDescriptor {
  id: JobStatus;
  label: string;
}

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface DesktopDialog {
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    properties: string[];
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<OpenDialogResult>;
}

export interface VaultFolderTreeNode {
  children: VaultFolderTreeNode[];
  name: string;
  path: string;
}
