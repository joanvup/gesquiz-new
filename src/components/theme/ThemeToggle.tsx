"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

const modes: Record<
  Theme,
  { label: string; nextLabel: string; Icon: LucideIcon }
> = {
  light: {
    label: "Claro",
    nextLabel: "oscuro",
    Icon: Sun,
  },
  dark: {
    label: "Oscuro",
    nextLabel: "sistema",
    Icon: Moon,
  },
  system: {
    label: "Sistema",
    nextLabel: "claro",
    Icon: Monitor,
  },
};

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const mode = modes[theme];
  const Icon = mode.Icon;
  const label =
    theme === "system"
      ? `Sistema (${resolvedTheme === "dark" ? "oscuro" : "claro"})`
      : mode.label;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Tema actual: ${label}. Cambiar a ${mode.nextLabel}.`}
      title={`Tema: ${label}. Clic para ${mode.nextLabel}.`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-text-muted backdrop-blur-sm transition hover:bg-surface-alt hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {showLabel && (
        <span className="hidden text-sm font-medium lg:inline">{mode.label}</span>
      )}
    </button>
  );
}
