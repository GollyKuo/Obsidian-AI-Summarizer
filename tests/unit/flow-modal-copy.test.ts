import { describe, expect, it } from "vitest";
import {
  FLASHCARD_MARKER_LABEL,
  FLASHCARD_MARKER_TOOLTIP,
  FLOW_MODAL_TITLE
} from "@ui/flow-modal/copy";

describe("flow modal copy", () => {
  it("uses the correct product spelling in the modal title", () => {
    expect(FLOW_MODAL_TITLE).toBe("AI Summarizer");
  });

  it("describes flashcards as a marker-only capability", () => {
    expect(FLASHCARD_MARKER_LABEL).toBe("加入 Flashcard 標記");
    expect(FLASHCARD_MARKER_TOOLTIP).toContain("不會生成閃卡內容");
  });
});
