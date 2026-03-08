import React from "react";
import {
  Key,
  Download,
  LogOut,
  ChevronRight,
  Shield,
} from "lucide-react";

/**
 * QuickActionsCard Component
 * Provides shortcuts to common profile actions
 * Updated: Removed Notification Settings as it's integrated in dashboard header
 *
 * @param {Object} props
 * @param {Function} props.onChangePassword - Callback for change password
 * @param {Function} props.onDownloadData - Callback for download data
 * @param {Function} props.onOpenLogoutModal - Callback to open logout confirmation modal
 */
const QuickActionsCard = ({
  onChangePassword,
  onDownloadData,
  onOpenLogoutModal,
}) => {
  const actions = [
    {
      id: "password",
      label: "Change Password",
      description: "Update your security credentials",
      icon: Key,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      onClick: onChangePassword,
    },
    {
      id: "download",
      label: "Download My Data",
      description: "Export your account information",
      icon: Download,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      onClick: onDownloadData,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Quick Actions
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your account
            </p>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              className="w-full flex items-center gap-4 p-3 sm:p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group text-left min-h-[56px] sm:min-h-[48px]"
            >
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 ${action.bgColor} dark:bg-gray-700 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-all duration-300`}
              >
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${action.color} dark:text-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  {action.label}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {action.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Sign Out Section */}
      <div className="px-2 pb-2">
        <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
          <button
            onClick={onOpenLogoutModal}
            className="w-full flex items-center gap-4 p-3 sm:p-4 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group text-left min-h-[56px] sm:min-h-[48px]"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-900/50 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-all duration-300">
              <LogOut className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-600 dark:text-red-400 text-sm sm:text-base">
                Sign Out
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                Log out of your account
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-red-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickActionsCard;
