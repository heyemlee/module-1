import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        "subtle-foreground": "var(--subtle-foreground)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        input: "var(--input)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-foreground": "var(--primary-foreground)",
        accent: "var(--accent)",
        ring: "var(--ring)",
        warning: "var(--warning)",
        "warning-surface": "var(--warning-surface)",
        "warning-foreground": "var(--warning-foreground)",
        success: "var(--success)",
        "success-surface": "var(--success-surface)",
        "success-foreground": "var(--success-foreground)",
        danger: "var(--danger)",
        "danger-surface": "var(--danger-surface)",
        "danger-foreground": "var(--danger-foreground)",
        info: "var(--info)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "blur-in": {
          from: { opacity: "0", filter: "blur(4px)", transform: "translateY(6px)" },
          to: { opacity: "1", filter: "blur(0)", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "blur-in": "blur-in 0.4s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
