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

const migratedUiFiles = [
  "src/components/ui/ai-chat-input.tsx",
  "src/components/ui/cabinet-construction-style-picker.tsx",
  "src/components/ui/input.tsx",
  "src/features/platform/platform-header.tsx",
  "src/features/platform/studio-shell.tsx",
  "src/features/round1/agent-chat-panel.tsx",
  "src/features/round1/rendering-preferences-step.tsx",
  "src/features/round1/round1-inspector.tsx",
  "src/features/round1/round1-workspace-shell.tsx",
  "src/features/round1/showroom-intake-app.tsx",
  "src/features/round1/showroom-intake-controls.tsx",
  "src/features/round1/showroom-intake-panels.tsx"
] as const;

describe("Studio Color System", () => {
  test("defines the approved five-color foundation and readable semantic pairs", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const variables = readRootVariables(css);

    expect(variables).toMatchObject({
      "--studio-void": "#e9e9e6",
      "--studio-surface": "#ffffff",
      "--studio-paper": "#efeeec",
      "--studio-action": "#1a1a1c",
      "--studio-danger": "#b42318",
      "--studio-action-ink": "#ffffff",
      "--studio-danger-ink": "#ffffff",
      "--studio-paper-muted-ink": "#5f5f59"
    });

    expect(
      contrastRatio(
        variables["--studio-action-ink"],
        variables["--studio-action"]
      )
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        variables["--studio-danger-ink"],
        variables["--studio-danger"]
      )
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        variables["--studio-paper-muted-ink"],
        variables["--studio-paper"]
      )
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("retires the legacy light application palette", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const tailwindConfig = readFileSync("tailwind.config.ts", "utf8");

    expect(css).not.toMatch(/--app-[\w-]+:/);
    expect(css).not.toContain(".app-panel");
    expect(css).not.toContain(".apple-input");
    expect(css).not.toContain("rgba(0, 113, 227");
    expect(tailwindConfig).not.toContain("var(--app-");
  });

  test("maps shared Tailwind colors to Studio semantics", () => {
    const tailwindConfig = readFileSync("tailwind.config.ts", "utf8");

    expect(tailwindConfig).toContain('background: "var(--studio-void)"');
    expect(tailwindConfig).toContain('foreground: "var(--studio-ink)"');
    expect(tailwindConfig).toContain('card: "var(--studio-shell)"');
    expect(tailwindConfig).toContain('destructive: "var(--studio-danger)"');
    expect(tailwindConfig).toContain(
      '"destructive-foreground": "var(--studio-danger-ink)"'
    );
    expect(tailwindConfig).toContain(
      '"paper-muted-ink": "var(--studio-paper-muted-ink)"'
    );
  });

  test("removes legacy light colors from active platform and Round 1 chrome", () => {
    const source = migratedUiFiles
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/var\(--app-/);
    expect(source).not.toMatch(
      /#(?:f5f5f7|fbfbfd|1d1d1f|6e6e73|86868b|d2d2d7|008060|e6f4ef|c56a16|fff0dc|b42318|0e1713|607067|dfe9e1)\b/i
    );
    expect(source).not.toContain("text-studio-secondary");
  });
});
