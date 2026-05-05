import { describe, expect, it } from "vitest";
import {
  readProviderErrorDetail,
  redactProviderSecretText
} from "@services/ai/provider-error";

describe("provider error parsing", () => {
  it("redacts API keys and bearer tokens from plain text", () => {
    const redacted = redactProviderSecretText(
      "Authorization: Bearer sk-secretToken123 api_key=AIzaSySecretValue12345 token=my-secret-token"
    );

    expect(redacted).not.toContain("sk-secretToken123");
    expect(redacted).not.toContain("AIzaSySecretValue12345");
    expect(redacted).not.toContain("my-secret-token");
    expect(redacted).toContain("[REDACTED_API_KEY]");
  });

  it("extracts nested provider messages while redacting body excerpts", async () => {
    const detail = await readProviderErrorDetail(
      new Response(
        JSON.stringify({
          error: {
            message: "API key AIzaSySecretValue12345 is invalid"
          },
          token: "sk-secretToken123"
        }),
        { status: 401 }
      )
    );

    expect(detail.message).toBe("API key [REDACTED_API_KEY] is invalid");
    expect(detail.bodyExcerpt).not.toContain("sk-secretToken123");
    expect(detail.bodyExcerpt).not.toContain("AIzaSySecretValue12345");
  });
});
