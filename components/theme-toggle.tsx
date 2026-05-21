"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "launchroast-theme";

type ThemeMode = "day" | "night";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("day");

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY);
      const nextTheme = storedTheme === "night" ? "night" : "day";
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    } catch {
      document.documentElement.dataset.theme = "day";
    }
  }, []);

  function handleChange(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  function handleToggle() {
    handleChange(theme === "day" ? "night" : "day");
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`theme-switch ${theme === "night" ? "is-night" : ""}`}
      aria-label={`Switch to ${theme === "day" ? "night" : "day"} mode`}
      aria-pressed={theme === "night"}
      title={theme === "day" ? "Switch to night mode" : "Switch to day mode"}
    >
      <span className="sr-only">
        {theme === "day" ? "Switch to night mode" : "Switch to day mode"}
      </span>
      <span className="theme-switch-scene">
        <span className="theme-switch-sun" />
        <span className="theme-switch-cloud theme-switch-cloud-one" />
        <span className="theme-switch-cloud theme-switch-cloud-two" />
        <span className="theme-switch-stars">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="theme-switch-thumb">
          <span className="theme-switch-thumb-core" />
          <span className="theme-switch-crater theme-switch-crater-one" />
          <span className="theme-switch-crater theme-switch-crater-two" />
          <span className="theme-switch-crater theme-switch-crater-three" />
        </span>
      </span>
    </button>
  );
}
