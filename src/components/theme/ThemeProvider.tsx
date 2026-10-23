"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from "@/lib/theme";

type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin persistencia si el navegador bloquea localStorage.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const themeRef = useRef<Theme>(DEFAULT_THEME);

  const applyTheme = useCallback((next: Theme, persist = false) => {
    themeRef.current = next;
    const resolved = resolveTheme(next);

    setThemeState(next);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);

    if (persist) persistTheme(next);
  }, []);

  useEffect(() => {
    // Sincroniza con lo que ya aplicó el script anti-parpadeo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyTheme(readStoredTheme());

    const media = window.matchMedia(DARK_QUERY);

    const handleMediaChange = () => {
      if (themeRef.current === "system") {
        applyTheme("system");
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      applyTheme(isTheme(event.newValue) ? event.newValue : DEFAULT_THEME);
    };

    media.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next, true);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    const order: Theme[] = ["light", "dark", "system"];
    const currentIndex = order.indexOf(themeRef.current);
    const next = order[(currentIndex + 1) % order.length];

    applyTheme(next, true);
  }, [applyTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }

  return context;
}
