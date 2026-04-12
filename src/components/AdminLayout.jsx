import React, { useState, memo, useLayoutEffect } from "react";
import Sidebar from "./Sidebar";
import { useTheme } from "../contexts/ThemeContext";
import ErrorBoundary from "./ErrorBoundary";

const AdminLayout = memo(({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Use centralized theme context for consistent dark mode across the app
  const { darkMode, toggleDarkMode } = useTheme();

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.classList.add("admin-dashboard-compact");
    document.body.classList.add("admin-dashboard-compact");

    return () => {
      root.classList.remove("admin-dashboard-compact");
      document.body.classList.remove("admin-dashboard-compact");
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className={darkMode ? "dark" : ""}>
        <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-gray-100 transition-colors dark:bg-gray-900">
          {/* Sidebar - Stays persistent across all pages */}
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
          />

          {/* Main Content - Changes based on route */}
          <main className="flex-1 min-h-0 min-w-0 overflow-y-auto modern-scrollbar overflow-x-hidden transition-none transform-none animate-none">
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
});

AdminLayout.displayName = "AdminLayout";

export default AdminLayout;
