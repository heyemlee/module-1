import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--studio-line)",
        input: "var(--studio-line-strong)",
        ring: "var(--studio-action)",
        background: "var(--studio-void)",
        foreground: "var(--studio-ink)",
        card: "var(--studio-shell)",
        "card-foreground": "var(--studio-ink)",
        popover: "var(--studio-surface)",
        "popover-foreground": "var(--studio-ink)",
        primary: "var(--studio-action)",
        "primary-foreground": "var(--studio-action-ink)",
        secondary: "var(--studio-raised)",
        "secondary-foreground": "var(--studio-ink)",
        muted: "var(--studio-surface)",
        "muted-foreground": "var(--studio-muted)",
        accent: "var(--studio-raised)",
        "accent-foreground": "var(--studio-ink)",
        destructive: "var(--studio-danger)",
        "destructive-foreground": "var(--studio-danger-ink)",
        studio: {
          void: "var(--studio-void)",
          shell: "var(--studio-shell)",
          surface: "var(--studio-surface)",
          raised: "var(--studio-raised)",
          rail: "var(--studio-rail)",
          canvas: "var(--studio-canvas)",
          ink: "var(--studio-ink)",
          muted: "var(--studio-muted)",
          quiet: "var(--studio-quiet)",
          action: "var(--studio-action)",
          "action-strong": "var(--studio-action-strong)",
          "action-ink": "var(--studio-action-ink)",
          paper: "var(--studio-paper)",
          "paper-muted": "var(--studio-paper-muted)",
          "paper-ink": "var(--studio-paper-ink)",
          "paper-muted-ink": "var(--studio-paper-muted-ink)",
          "paper-line": "var(--studio-paper-line)",
          line: "var(--studio-line)",
          "line-strong": "var(--studio-line-strong)",
          danger: "var(--studio-danger)",
          "danger-ink": "var(--studio-danger-ink)",
          warning: "var(--studio-warning)",
          "warning-ink": "var(--studio-warning-ink)",
          success: "var(--studio-success)"
        }
      },
      borderRadius: {
        "studio-panel": "var(--studio-radius-panel)",
        "studio-control": "var(--studio-radius-control)",
        "studio-small": "var(--studio-radius-small)"
      },
      fontFamily: {
        sans: [
          '"Space Grotesk"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "Arial",
          "sans-serif"
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace"
        ]
      }
    }
  },
  plugins: []
};

export default config;
