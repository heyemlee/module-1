import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Studio design tokens", () => {
  test("defines the approved one-accent Studio palette", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("--studio-void: #0b120f");
    expect(css).toContain("--studio-action: #9fcdb1");
    expect(css).toContain("--studio-danger: #e66d63");
    expect(css).toContain("--studio-radius-panel: 12px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("does not load the retired serif product fonts", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(layout).not.toContain("Playfair_Display");
    expect(layout).not.toContain("Instrument_Serif");
  });
});
