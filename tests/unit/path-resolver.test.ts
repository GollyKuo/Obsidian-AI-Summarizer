import { describe, expect, it } from "vitest";
import {
  resolveUniqueNotePath,
  resolveUniqueNotePathWithDiagnostics
} from "@services/obsidian/path-resolver";

describe("path resolver", () => {
  it("returns primary path when no collision", async () => {
    const result = await resolveUniqueNotePathWithDiagnostics(
      {
        async exists() {
          return false;
        }
      },
      "Summaries",
      "Demo Title"
    );

    expect(result.notePath).toBe("Summaries/Demo Title.md");
    expect(result.collisionCount).toBe(0);
  });

  it("applies collision suffix and reports collision count", async () => {
    const existing = new Set(["Summaries/Demo.md", "Summaries/Demo (2).md"]);
    const result = await resolveUniqueNotePathWithDiagnostics(
      {
        async exists(path) {
          return existing.has(path);
        }
      },
      "Summaries",
      "Demo"
    );

    expect(result.notePath).toBe("Summaries/Demo (3).md");
    expect(result.collisionCount).toBe(2);
  });

  it("sanitizes unsafe title and keeps compatibility wrapper", async () => {
    const path = await resolveUniqueNotePath(
      {
        async exists() {
          return false;
        }
      },
      "",
      " :<>\u0000 Test/Name?. "
    );

    expect(path).toBe("___ Test_Name_.md");
  });
});
