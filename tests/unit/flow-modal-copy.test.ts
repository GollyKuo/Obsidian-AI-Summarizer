import { describe, expect, it } from "vitest";
import { FLOW_MODAL_TITLE } from "@ui/flow-modal/copy";

describe("flow modal copy", () => {
  it("uses the correct product spelling in the modal title", () => {
    expect(FLOW_MODAL_TITLE).toBe("AI Summarizer");
  });
});
