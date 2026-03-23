/**
 * GuardianNotificationBell Component
 * A dedicated notification bell for guardian users
 * Features:
 * - Badge count for unread notifications
 * - Dropdown panel with recent notifications
 * - Mark as read functionality
 * - Real-time updates via polling
 * - Mobile responsive
 * - Touch-friendly (44x44px minimum)
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  CheckCheck,
  Clock,
  Calendar,
  Syringe,
  User,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import guardianNotificationService from "../services/guardianNotificationService";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import {
  isExternalNotificationUrl,
  resolveNotificationActionUrl,
} from "../utils/notificationRouting";

// Notification type icons and colors
const NOTIFICATION_TYPE_CONFIG = {
  appointment_reminder: {
    icon: Calendar,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  appointment_status: {
    icon: Calendar,
    color: "text-emerald-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  vaccination_reminder: {
    icon: Syringe,
    color: "text-purple-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  profile_update: {
    icon: User,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700",
  },
  new_message: {
    icon: MessageSquare,
    color: "text-teal-500",
    bgColor: "bg-teal-100 dark:bg-teal-900/30",
  },
  health_alert: {
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  default: {
    icon: Bell,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700",
  },
};

// Format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return "Just now";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Single notification item component
const NotificationItem = ({ notification, onMarkAsRead, onClick }) => {
  const config =
    NOTIFICATION_TYPE_CONFIG[notification.notification_type] ||
    NOTIFICATION_TYPE_CONFIG.default;
  const IconComponent = config.icon;
  const isRead = notification.is_read;

  const handleClick = async () => {
    if (!isRead) {
      await onMarkAsRead(notification.id);
    }
    onClick(notification);
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 touch-manipulation ${
        isRead
          ? "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"
          : "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
      }`}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}
      >
        <IconComponent className={`w-5 h-5 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-sm font-medium truncate ${isRead ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"}`}
          >
            {notification.title || "Notification"}
          </h4>
          {!isRead && (
            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
          {notification.message || "No message"}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-400">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

// Main GuardianNotificationBell component
const GuardianNotificationBell = () => {
  const { guardianId, isGuardian } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const { isConnected, on, off } = useSocket();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    // Only fetch for actual guardian users
    if (!guardianId || !isGuardian) return;

    try {
      setLoading(true);
      setError(null);

      const [notificationsRes, countRes] = await Promise.all([
        guardianNotificationService.getNotifications({ limit: 10 }),
        guardianNotificationService.getUnreadCount(),
      ]);

      if (notificationsRes?.success) {
        setNotifications(notificationsRes.data || []);
      }

      if (countRes?.success) {
        const unreadCount =
          countRes?.data?.count ??
          countRes?.count ??
          countRes?.data?.data?.count ??
          0;
        setUnreadCount(unreadCount);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [guardianId, isGuardian]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await guardianNotificationService.markAsRead(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );

      // Decrement unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await guardianNotificationService.markAllAsRead();

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification) => {
    setIsOpen(false);

    const targetUrl = resolveNotificationActionUrl(notification, {
      isGuardian: true,
    });

    if (!targetUrl) {
      navigate("/guardian/notifications");
      return;
    }

    if (isExternalNotificationUrl(targetUrl)) {
      window.location.assign(targetUrl);
      return;
    }

    navigate(targetUrl);
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        bellRef.current &&
        !bellRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Fetch notifications when dropdown is opened, plus initial fetch for badge count
  useEffect(() => {
    // Initial fetch on mount to show badge count
    fetchNotifications();

    // Fetch when dropdown is opened
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Real-time updates via Socket
  useEffect(() => {
    if (!isConnected) return;

    const handleNewNotification = (data) => {
      setUnreadCount((prev) => prev + 1);
      if (isOpen) {
        fetchNotifications();
      }
    };

    on("notification", handleNewNotification);
    on("critical-notification", handleNewNotification);

    return () => {
      off("notification", handleNewNotification);
      off("critical-notification", handleNewNotification);
    };
  }, [isConnected, on, off, isOpen, fetchNotifications]);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={toggleDropdown}
        className="relative p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  {error}
                </p>
                <button
                  onClick={fetchNotifications}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No notifications yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  You'll be notified about appointments, vaccinations, and more
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onClick={handleNotificationClick}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate("/guardian/notifications");
                }}
                className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GuardianNotificationBell;
