/**
 * DarkModeToggle Component - Group G Implementation
 *
 * Dark mode toggle with localStorage persistence.
 * Applies theme to document root for CSS custom properties.
 */

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "edwinpai_theme";
const DARK_CLASS = "dark";

export type Theme = "light" | "dark" | "system";

export interface DarkModeToggleProps {
  /**
   * Display variant
   */
  variant?: "switch" | "button" | "icon";

  /**
   * Show label text
   */
  showLabel?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

/**
 * Dark mode toggle component
 *
 * @example
 * ```tsx
 * <DarkModeToggle variant="switch" showLabel />
 * <DarkModeToggle variant="icon" />
 * ```
 */
export function DarkModeToggle({
  variant = "switch",
  showLabel = true,
  className,
}: DarkModeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const isDark = theme === "dark" || (theme === "system" && isSystemDark());

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme =
      theme === "system" ? (isSystemDark() ? "dark" : "light") : theme;

    if (effectiveTheme === "dark") {
      root.classList.add(DARK_CLASS);
    } else {
      root.classList.remove(DARK_CLASS);
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add(DARK_CLASS);
      } else {
        root.classList.remove(DARK_CLASS);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={className}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </Button>
    );
  }

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        onClick={toggleTheme}
        className={className}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <>
            <Sun className="mr-2 size-4" />
            {showLabel && "Light Mode"}
          </>
        ) : (
          <>
            <Moon className="mr-2 size-4" />
            {showLabel && "Dark Mode"}
          </>
        )}
      </Button>
    );
  }

  // Default: switch variant
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Switch
        id="dark-mode"
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label="Toggle dark mode"
      />
      {showLabel && (
        <Label htmlFor="dark-mode" className="cursor-pointer">
          {isDark ? "Dark Mode" : "Light Mode"}
        </Label>
      )}
    </div>
  );
}

/**
 * Hook for using dark mode state
 */
export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const isDark = theme === "dark" || (theme === "system" && isSystemDark());

  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme =
      theme === "system" ? (isSystemDark() ? "dark" : "light") : theme;

    if (effectiveTheme === "dark") {
      root.classList.add(DARK_CLASS);
    } else {
      root.classList.remove(DARK_CLASS);
    }

    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    isDark,
    toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
  };
}

/**
 * Get initial theme from localStorage or system preference
 */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch (error) {
    console.error("Failed to load theme preference:", error);
  }

  // Default to system preference
  return "system";
}

/**
 * Check if system prefers dark mode
 */
function isSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
