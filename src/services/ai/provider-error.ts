const DEFAULT_BODY_EXCERPT_LENGTH = 500;

export interface ProviderErrorDetail {
  message: string;
  payload?: unknown;
  bodyExcerpt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedMessage(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  const directMessage = value.message ?? value.detail;
  if (typeof directMessage === "string" && directMessage.trim().length > 0) {
    return directMessage.trim();
  }

  const error = value.error;
  if (isRecord(error)) {
    return getNestedMessage(error);
  }

  return "";
}

export function redactProviderSecretText(text: string): string {
  return text
    .replace(/\bAIza[0-9A-Za-z_-]{12,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bsk-[0-9A-Za-z_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+[0-9A-Za-z._~+/-]+=*/gi, "Bearer [REDACTED_API_KEY]")
    .replace(
      /(["']?(?:api[_-]?key|token|authorization|x-goog-api-key|x-gladia-key)["']?\s*[:=]\s*["']?)([^"',\s}]+)/gi,
      "$1[REDACTED_API_KEY]"
    );
}

export async function readProviderErrorDetail(
  response: Response,
  options: { bodyExcerptLength?: number } = {}
): Promise<ProviderErrorDetail> {
  const body = await response.text();
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return { message: "" };
  }

  const bodyExcerpt = redactProviderSecretText(
    trimmedBody.slice(0, options.bodyExcerptLength ?? DEFAULT_BODY_EXCERPT_LENGTH)
  );

  try {
    const payload = JSON.parse(trimmedBody);
    return {
      message: redactProviderSecretText(getNestedMessage(payload)),
      payload,
      bodyExcerpt
    };
  } catch {
    return {
      message: redactProviderSecretText(trimmedBody),
      bodyExcerpt
    };
  }
}
