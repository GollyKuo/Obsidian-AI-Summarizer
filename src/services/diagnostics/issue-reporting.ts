import { SummarizerError, type ErrorCategory } from "@domain/errors";

export type ReportLevel = "info" | "warn" | "error";

export interface IssueReport {
  context: string;
  category: ErrorCategory | "unknown";
  level: ReportLevel;
  noticeMessage: string;
  modalMessage: string;
  logMessage: string;
  assertionMessage: string;
}

interface ReportTemplate {
  level: ReportLevel;
  title: string;
}

const CATEGORY_TEMPLATES: Record<ErrorCategory, ReportTemplate> = {
  validation_error: {
    level: "warn",
    title: "輸入無效"
  },
  runtime_unavailable: {
    level: "error",
    title: "執行環境不可用"
  },
  download_failure: {
    level: "error",
    title: "媒體處理失敗"
  },
  ai_failure: {
    level: "error",
    title: "AI 處理失敗"
  },
  note_write_failure: {
    level: "error",
    title: "筆記寫入失敗"
  },
  cancellation: {
    level: "warn",
    title: "操作已取消"
  }
};

function sanitizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, " ");
}

function serializeCause(cause: unknown): string {
  if (cause === undefined) {
    return "";
  }

  if (cause instanceof Error) {
    return sanitizeMessage(cause.message).slice(0, 1000);
  }

  try {
    return sanitizeMessage(JSON.stringify(cause)).slice(0, 1000);
  } catch {
    return sanitizeMessage(String(cause)).slice(0, 1000);
  }
}

function appendDiagnostics(message: string, cause: unknown): string {
  const serializedCause = serializeCause(cause);
  if (!serializedCause) {
    return message;
  }
  return `${message} | diagnostics: ${serializedCause}`;
}

function normalizeContext(context: string): string {
  return context.trim().replace(/\s+/g, "_").toLowerCase();
}

export function formatInfoReport(context: string, message: string): string {
  return `[${normalizeContext(context)}] ${sanitizeMessage(message)}`;
}

export function formatWarningReport(context: string, warning: string): string {
  return `[${normalizeContext(context)}] ${sanitizeMessage(warning)}`;
}

export function createIssueReport(context: string, error: unknown): IssueReport {
  const normalizedContext = normalizeContext(context);

  if (error instanceof SummarizerError) {
    const template = CATEGORY_TEMPLATES[error.category];
    const detail = sanitizeMessage(error.message);

    return {
      context: normalizedContext,
      category: error.category,
      level: template.level,
      noticeMessage: `${template.title}：${detail}`,
      modalMessage: `${template.title}：${detail}`,
      logMessage: appendDiagnostics(
        `[${normalizedContext}] ${error.category}: ${detail}`,
        error.causeValue
      ),
      assertionMessage: appendDiagnostics(
        `${normalizedContext} | ${error.category} | ${detail}`,
        error.causeValue
      )
    };
  }

  const detail = sanitizeMessage(error instanceof Error ? error.message : String(error));
  return {
    context: normalizedContext,
    category: "unknown",
    level: "error",
    noticeMessage: `未預期錯誤：${detail}`,
    modalMessage: `未預期錯誤：${detail}`,
    logMessage: `[${normalizedContext}] unknown_error: ${detail}`,
    assertionMessage: `${normalizedContext} | unknown | ${detail}`
  };
}
