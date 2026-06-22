"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "kabi-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Runs before paint to set the initial class — prevents a light/dark flash.
// Mirrored by the inline script in layout.tsx for SSR safety.
function readInitialTheme(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore storage failures */
    }
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((t) => (t === "dark" ? "light" : "dark"))
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Falls back to a no-op light theme when rendered outside a provider (e.g. in
// isolated SSR unit tests), so consumers like ThemeToggle never crash.
const FALLBACK: ThemeContextValue = { theme: "light", setTheme: () => {}, toggleTheme: () => {} };

export function useTheme() {
  return useContext(ThemeContext) ?? FALLBACK;
}

// Inline, stringified for layout.tsx — sets the class from storage before React hydrates.
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;
