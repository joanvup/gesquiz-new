export const THEME_STORAGE_KEY = "quizcolegio-theme";

export const THEME_MODES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEME_MODES)[number];

export const DEFAULT_THEME: Theme = "system";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Se ejecuta antes de que React hidrate para aplicar el tema guardado
 * desde el primer frame y evitar el parpadeo claro/oscuro.
 */
export const THEME_SCRIPT = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var stored = localStorage.getItem(key);
    var mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (error) {
    // localStorage puede fallar en modo privado; usamos el tema del sistema.
  }
})();
`;
