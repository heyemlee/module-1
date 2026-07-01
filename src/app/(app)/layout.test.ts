import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("authenticated app layout", () => {
  test("keeps rendering tasks above route-level page changes", () => {
    const source = readFileSync("src/app/(app)/layout.tsx", "utf8");

    expect(source).toContain("<RenderingTaskProvider>");
    expect(source).toContain("</RenderingTaskProvider>");
  });
});
