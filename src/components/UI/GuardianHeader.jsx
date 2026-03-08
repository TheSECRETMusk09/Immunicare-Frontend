import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Sun, Moon, LogOut, User } from "lucide-react";

const GuardianHeader = ({ darkMode, onToggleDarkMode, onLogout }) => {
  const { user, logout } = useAuth();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleLogout = () => {
    if (typeof onLogout === "function") {
      onLogout();
      return;
    }
    logout();
  };

  // Handle dark mode toggle - support both object and boolean formats
  const handleToggleDarkMode = () => {
    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 400);

    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else if (typeof darkMode === "object" && darkMode?.toggle) {
      darkMode.toggle();
    }
  };

  // Determine if dark mode is active
  const isDarkMode =
    typeof darkMode === "object" ? darkMode?.isDarkMode : darkMode;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 guardian-header">
      <div className="flex items-center justify-between">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name || "Guardian"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user?.name || "Guardian"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user?.role || "Guardian"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle - Enhanced with animations */}
          <button
            type="button"
            onClick={handleToggleDarkMode}
            className={`theme-toggle p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isAnimating ? "theme-transition-pulse" : ""}`}
            aria-label={
              isDarkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <span className="relative w-5 h-5 flex items-center justify-center">
              {/* Sun Icon */}
              <Sun
                className={`sun-icon absolute w-5 h-5 text-yellow-500 transition-all duration-300 ${isDarkMode ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"}`}
              />
              {/* Moon Icon */}
              <Moon
                className={`moon-icon absolute w-5 h-5 text-gray-600 dark:text-gray-300 transition-all duration-300 ${isDarkMode ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"}`}
              />
            </span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuardianHeader;
