import React from "react";

const OfflineIndicator = ({ isOnline, isBackendReachable }) => {
  // Don't show anything if we're online and backend is reachable
  if (isOnline && isBackendReachable) {
    return null;
  }

  const getOfflineMessage = () => {
    if (!isOnline) {
      return "You are currently offline. Please check your internet connection.";
    } else if (isOnline && isBackendReachable === false) {
      return "Unable to connect to the server. Please check your connection or try again later.";
    } else {
      return "Checking connection...";
    }
  };

  const getAlertVariant = () => {
    if (!isOnline) {
      return "error";
    } else if (isOnline && isBackendReachable === false) {
      return "warning";
    } else {
      return "info";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-600 dark:text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {getOfflineMessage()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
