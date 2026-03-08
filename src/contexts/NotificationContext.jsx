/**
 * Notification Context
 * Global notification system for success, error, warning, and info messages
 *
 * Features:
 * - Toast notifications with auto-dismiss
 * - Consistent error handling across the app
 * - Queue management for multiple notifications
 * - WCAG compliant announcements
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";

// Create context
const NotificationContext = createContext(null);

// Notification types
const NOTIFICATION_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

// Default durations for each type (in milliseconds)
const DEFAULT_DURATIONS = {
  [NOTIFICATION_TYPES.SUCCESS]: 4000,
  [NOTIFICATION_TYPES.ERROR]: 7000,
  [NOTIFICATION_TYPES.WARNING]: 5000,
  [NOTIFICATION_TYPES.INFO]: 4000,
};

// Icons for each type
const NotificationIcon = ({ type, className = "w-5 h-5" }) => {
  const icons = {
    success: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    error: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
    warning: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    info: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  };

  return icons[type] || icons.info;
};

NotificationIcon.propTypes = {
  type: PropTypes.oneOf(Object.values(NOTIFICATION_TYPES)).isRequired,
  className: PropTypes.string,
};

// Individual notification item
const NotificationItem = ({ notification, onRemove }) => {
  const { id, type, message, title } = notification;

  const variantClasses = {
    success:
      "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200",
    error:
      "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200",
    warning:
      "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200",
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200",
  };

  const iconColors = {
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        max-w-sm w-full border rounded-lg shadow-lg p-4
        animate-in slide-in-from-right duration-300
        ${variantClasses[type] || variantClasses.info}
      `}
    >
      <div className="flex">
        <div className={`flex-shrink-0 ${iconColors[type] || iconColors.info}`}>
          <NotificationIcon type={type} />
        </div>
        <div className="ml-3 flex-1">
          {title && <p className="text-sm font-medium">{title}</p>}
          <p className={`text-sm ${title ? "mt-1" : ""}`}>{message}</p>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={() => onRemove(id)}
            className="inline-flex rounded-md p-1.5 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Dismiss notification"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.number.isRequired,
    type: PropTypes.oneOf(Object.values(NOTIFICATION_TYPES)).isRequired,
    message: PropTypes.string.isRequired,
    title: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};

// Notification container
const NotificationContainer = ({ notifications, onRemove }) => {
  return createPortal(
    <div
      className="fixed top-4 right-4 z-50 space-y-2"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>,
    document.body,
  );
};

NotificationContainer.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      type: PropTypes.oneOf(Object.values(NOTIFICATION_TYPES)).isRequired,
      message: PropTypes.string.isRequired,
      title: PropTypes.string,
    }),
  ).isRequired,
  onRemove: PropTypes.func.isRequired,
};

// Provider component
export const NotificationProvider = ({ children, maxNotifications = 5 }) => {
  const [notifications, setNotifications] = useState([]);

  // Add notification
  const addNotification = useCallback(
    (notification) => {
      const id = Date.now();
      const type = notification.type || NOTIFICATION_TYPES.INFO;
      const duration = notification.duration || DEFAULT_DURATIONS[type];

      const newNotification = {
        id,
        type,
        message: notification.message,
        title: notification.title,
        duration,
      };

      setNotifications((prev) => {
        // Limit the number of notifications
        const updated = [newNotification, ...prev].slice(0, maxNotifications);
        return updated;
      });

      return id;
    },
    [maxNotifications],
  );

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: NOTIFICATION_TYPES.SUCCESS,
        message,
        ...options,
      });
    },
    [addNotification],
  );

  const error = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: NOTIFICATION_TYPES.ERROR,
        message,
        duration: DEFAULT_DURATIONS[NOTIFICATION_TYPES.ERROR],
        ...options,
      });
    },
    [addNotification],
  );

  const warning = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: NOTIFICATION_TYPES.WARNING,
        message,
        ...options,
      });
    },
    [addNotification],
  );

  const info = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: NOTIFICATION_TYPES.INFO,
        message,
        ...options,
      });
    },
    [addNotification],
  );

  // Handle API errors consistently
  const handleApiError = useCallback(
    (error, fallbackMessage = "An error occurred. Please try again.") => {
      const message =
        error?.response?.data?.message || error?.message || fallbackMessage;

      return error(message, { title: "API Error" });
    },
    [error],
  );

  // Auto-remove notifications after duration
  useEffect(() => {
    const timeouts = notifications.map((notification) => {
      if (notification.duration) {
        return setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration);
      }
      return null;
    });

    return () => {
      timeouts.forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [notifications, removeNotification]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    handleApiError,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  maxNotifications: PropTypes.number,
};

// Custom hook to use notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
};

// Export types for external use
export { NOTIFICATION_TYPES };

// Default export
export default NotificationContext;
