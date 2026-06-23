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
        primary: "var(--app-ink)",
        "primary-foreground": "#ffffff",
        secondary: "var(--app-surface-muted)",
        "secondary-foreground": "var(--app-ink)",
        muted: "var(--app-surface-muted)",
        "muted-foreground": "var(--app-muted)",
        accent: "var(--app-surface-muted)",
        "accent-foreground": "var(--app-ink)",
        destructive: "var(--app-red)",
        "destructive-foreground": "#ffffff"
      }
    }
  },
  plugins: []
};

export default config;
