import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("global platform states", () => {
  test("error and not-found pages use Studio tokens and shared buttons", () => {
    const errorSource = readFileSync("src/app/error.tsx", "utf8");
    const notFoundSource = readFileSync("src/app/not-found.tsx", "utf8");

    for (const source of [errorSource, notFoundSource]) {
      expect(source).toContain("bg-studio-void");
      expect(source).toContain("@/components/ui/button");
      expect(source).not.toContain("font-playfair");
      expect(source).not.toContain("rounded-full bg-[#1d1d1f]");
    }
  });
});
