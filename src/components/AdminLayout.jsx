import React, { useState, memo } from "react";
import Sidebar from "./Sidebar";
import { useTheme } from "../contexts/ThemeContext";

const AdminLayout = memo(({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Use centralized theme context for consistent dark mode across the app
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex transition-colors">
        {/* Sidebar - Stays persistent across all pages */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
        />

        {/* Main Content - Changes based on route */}
        <main className="flex-1 overflow-auto transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  );
});

AdminLayout.displayName = "AdminLayout";

export default AdminLayout;
