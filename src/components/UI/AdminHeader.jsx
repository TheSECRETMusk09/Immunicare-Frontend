import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Sun, Moon, LogOut, User } from "lucide-react";

const AdminHeader = ({ darkMode, onToggleDarkMode, onLogout }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    logout();
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name || "Admin"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user?.name || "Administrator"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user?.role || "Admin"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
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

export default AdminHeader;
