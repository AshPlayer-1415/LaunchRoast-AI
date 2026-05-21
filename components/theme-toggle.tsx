"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "launchroast-theme";

type ThemeMode = "dark" | "neon";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY);
      const nextTheme = storedTheme === "neon" ? "neon" : "dark";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  function handleChange(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="theme-toggle-shell" aria-label="Theme mode">
      <button
        type="button"
        onClick={() => handleChange("dark")}
        aria-pressed={theme === "dark"}
        className={`theme-toggle-option ${theme === "dark" ? "is-active" : ""}`}
      >
        Dark
      </button>
      <button
        type="button"
        onClick={() => handleChange("neon")}
        aria-pressed={theme === "neon"}
        className={`theme-toggle-option ${theme === "neon" ? "is-active" : ""}`}
      >
        Neon
      </button>
    </div>
  );
}
