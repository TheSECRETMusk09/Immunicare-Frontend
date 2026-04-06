/**
 * ThemeContext
 * Provides centralized dark mode state management across the application
 * Ensures consistent dark mode propagation between Admin and Guardian dashboards
 * Includes smooth transition handling for theme switching
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { safeLocalStorage } from "../utils/safeStorage";

const ThemeContext = createContext(undefined);

/**
 * Default theme value when used outside provider
 */
const defaultThemeValue = {
  darkMode: false,
  setDarkMode: () => {},
  toggleDarkMode: () => {},
  isDark: false,
  isTransitioning: false,
};

/**
 * ThemeProvider
 * Wraps the application to provide dark mode state
 * Persists preference to localStorage for consistency across sessions
 */
export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    // Try to get from localStorage first using safe storage
    if (typeof window !== "undefined") {
      const stored = safeLocalStorage.getItem("immunicare_dark_mode");
      if (stored !== null) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // Ignore parse errors
        }
      }
      // Check system preference
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return true;
      }
    }
    return false;
  });

  // Transition state for animations
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sync to localStorage and document class when darkMode changes
  useEffect(() => {
    // Start transition
    setIsTransitioning(true);

    safeLocalStorage.setItem("immunicare_dark_mode", JSON.stringify(darkMode));

    // Apply theme class
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }

    // End transition after animation completes
    const transitionDuration = 400; // Match CSS transition time
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, transitionDuration);

    return () => clearTimeout(timer);
  }, [darkMode]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      // Only update if user hasn't set a preference
      const stored = safeLocalStorage.getItem("immunicare_dark_mode");
      if (stored === null) {
        setDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      darkMode,
      setDarkMode,
      toggleDarkMode,
      isDark: darkMode,
      isTransitioning,
    }),
    [darkMode, toggleDarkMode, isTransitioning],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* Theme transition overlay for smooth visual transition */}
      <ThemeTransitionOverlay
        isTransitioning={isTransitioning}
        darkMode={darkMode}
      />
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * ThemeTransitionOverlay - Visual overlay for smooth theme transitions
 * Creates a subtle flash effect during theme change
 */
function ThemeTransitionOverlay({ isTransitioning, darkMode }) {
  if (!isTransitioning) return null;

  return (
    <div
      className="theme-transition-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 9999,
        backgroundColor: darkMode
          ? "rgba(0, 0, 0, 0.05)"
          : "rgba(255, 255, 255, 0.1)",
        transition: "background-color 200ms ease-out",
      }}
      aria-hidden="true"
    />
  );
}

/**
 * useTheme hook
 * Returns dark mode state and toggle function
 * Must be used within a ThemeProvider for best results
 * Falls back to localStorage-based state if used outside provider
 */
export function useTheme() {
  const context = useContext(ThemeContext);

  // If context exists, use it
  if (context !== undefined) {
    return context;
  }

  // Otherwise return a non-hook based fallback that components can use
  // Note: This won't cause re-renders but provides a working interface
  return defaultThemeValue;
}

export default ThemeContext;
