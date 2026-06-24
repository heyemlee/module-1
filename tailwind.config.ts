import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--app-border)",
        input: "var(--app-border)",
        ring: "var(--app-ink)",
        background: "var(--app-surface)",
        foreground: "var(--app-ink)",
        card: "var(--app-surface)",
        "card-foreground": "var(--app-ink)",
        popover: "var(--app-surface)",
        "popover-foreground": "var(--app-ink)",
        primary: "var(--studio-action)",
        "primary-foreground": "var(--studio-action-ink)",
        secondary: "var(--app-surface-muted)",
        "secondary-foreground": "var(--app-ink)",
        muted: "var(--app-surface-muted)",
        "muted-foreground": "var(--app-muted)",
        accent: "var(--app-surface-muted)",
        "accent-foreground": "var(--app-ink)",
        destructive: "var(--app-red)",
        "destructive-foreground": "#ffffff",
        studio: {
          void: "var(--studio-void)",
          shell: "var(--studio-shell)",
          surface: "var(--studio-surface)",
          raised: "var(--studio-raised)",
          ink: "var(--studio-ink)",
          muted: "var(--studio-muted)",
          quiet: "var(--studio-quiet)",
          action: "var(--studio-action)",
          "action-strong": "var(--studio-action-strong)",
          "action-ink": "var(--studio-action-ink)",
          paper: "var(--studio-paper)",
          "paper-muted": "var(--studio-paper-muted)",
          "paper-ink": "var(--studio-paper-ink)",
          line: "var(--studio-line)",
          "line-strong": "var(--studio-line-strong)",
          danger: "var(--studio-danger)",
          warning: "var(--studio-warning)",
          success: "var(--studio-success)"
        }
      },
      borderRadius: {
        "studio-panel": "var(--studio-radius-panel)",
        "studio-control": "var(--studio-radius-control)",
        "studio-small": "var(--studio-radius-small)"
      }
    }
  },
  plugins: []
};

export default config;
