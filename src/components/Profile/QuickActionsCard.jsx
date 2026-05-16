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
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      

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

      
    </div>
  );
};

export default QuickActionsCard;
