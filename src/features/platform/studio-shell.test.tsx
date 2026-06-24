import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function readRootVariables(css: string) {
  const rootBlock = css.match(/:root\s*{([\s\S]*?)}/)?.[1] ?? "";

  return Object.fromEntries(
    [...rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim()
    ])
  );
}

function relativeLuminance(hex: string) {
  const channels = hex
    .match(/[a-f\d]{2}/gi)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe("Studio design tokens", () => {
  test("defines the approved one-accent Studio palette", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const variables = readRootVariables(css);

    expect(variables["--studio-void"]).toBe("#0b120f");
    expect(variables["--studio-action"]).toBe("#9fcdb1");
    expect(variables["--studio-danger"]).toBe("#e66d63");
    expect(variables["--studio-radius-panel"]).toBe("12px");
    expect(variables["--studio-quiet"]).toBe("#8b9a91");
    expect(
      contrastRatio(
        variables["--studio-quiet"],
        variables["--studio-surface"]
      )
    ).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css.match(/@media \(prefers-reduced-motion: reduce\)/g)).toHaveLength(1);
    expect(css).toContain("animation-duration: 0.01ms !important");
    expect(css).not.toContain("0.001ms");
  });

  test("preserves legacy application aliases until existing pages migrate", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const variables = readRootVariables(css);

    expect(variables).toMatchObject({
      "--app-bg": "#f5f5f7",
      "--app-surface": "#ffffff",
      "--app-surface-muted": "#fbfbfd",
      "--app-ink": "#1d1d1f",
      "--app-muted": "#6e6e73",
      "--app-quiet": "#86868b",
      "--app-border": "rgba(0, 0, 0, 0.12)",
      "--app-border-strong": "rgba(0, 0, 0, 0.2)",
      "--app-blue": "#1d1d1f",
      "--app-blue-soft": "#f0f0f2",
      "--app-green": "#16823a",
      "--app-green-soft": "#eaf7ee",
      "--app-amber": "#b25a00",
      "--app-amber-soft": "#fff3df",
      "--app-red": "#b42318",
      "--app-red-soft": "#fff1ef",
      "--app-radius": "8px",
      "--app-shadow": "0 16px 45px rgba(0, 0, 0, 0.08)"
    });
  });

  test("maps the default primary control colors to the Studio action pair", () => {
    const tailwindConfig = readFileSync("tailwind.config.ts", "utf8");

    expect(tailwindConfig).toContain('primary: "var(--studio-action)"');
    expect(tailwindConfig).toContain(
      '"primary-foreground": "var(--studio-action-ink)"'
    );
    expect(tailwindConfig).not.toContain('primary: "var(--app-ink)"');
    expect(tailwindConfig).not.toContain('"primary-foreground": "#ffffff"');
  });

  test("does not load the retired serif product fonts", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(layout).not.toContain("Playfair_Display");
    expect(layout).not.toContain("Instrument_Serif");
  });
});
