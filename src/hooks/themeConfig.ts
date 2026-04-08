import { useMtgaStore } from "./useMtgaStore";
import type { ThemeConfig } from "../types/mtgaTypes";

const DEFAULT_THEME: ThemeConfig = {
  primary_color: "#f0bb32",
  accent_color: "#f59e0b",
  background_color: "#f7f8fb",
  text_color: "#0f172a",
  secondary_color: "#64748b",
  success_color: "#22c55e",
  warning_color: "#f59e0b",
  error_color: "#ef4444",
  font_family: "system-ui",
};

function applyThemeToDom(config: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty("--mtga-primary", config.primary_color);
  root.style.setProperty("--mtga-accent", config.accent_color);
  root.style.setProperty("--mtga-bg", config.background_color);
  root.style.setProperty("--mtga-text", config.text_color);
  root.style.setProperty("--mtga-text-muted", config.secondary_color);
  root.style.setProperty("--mtga-success", config.success_color);
  root.style.setProperty("--mtga-warning", config.warning_color);
  root.style.setProperty("--mtga-error", config.error_color);
  if (config.font_family && config.font_family !== "system-ui") {
    root.style.setProperty("font-family", config.font_family);
  }
  if (config.background_image) {
    root.style.setProperty("--mtga-bg-image", `url(${config.background_image})`);
    root.classList.add("mtga-custom-bg");
  } else {
    root.style.removeProperty("--mtga-bg-image");
    root.classList.remove("mtga-custom-bg");
  }
}

function loadThemeFromStorage(): ThemeConfig {
  try {
    const stored = localStorage.getItem("mtga-theme-config");
    if (stored) {
      return { ...DEFAULT_THEME, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

function saveThemeToStorage(config: ThemeConfig) {
  try {
    localStorage.setItem("mtga-theme-config", JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function useThemeConfig() {
  const { themeConfig, setThemeConfig } = useMtgaStore();

  const initTheme = () => {
    const stored = loadThemeFromStorage();
    setThemeConfig(stored);
    applyThemeToDom(stored);
  };

  const updateTheme = (config: ThemeConfig) => {
    setThemeConfig(config);
    saveThemeToStorage(config);
    applyThemeToDom(config);
  };

  const resetTheme = () => {
    updateTheme(DEFAULT_THEME);
  };

  return { themeConfig, initTheme, updateTheme, resetTheme, defaultTheme: DEFAULT_THEME };
}
