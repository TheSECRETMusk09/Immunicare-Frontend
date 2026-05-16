import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import useGuardianNotifications from "../hooks/useGuardianNotifications";
import { useSocket } from "../contexts/SocketContext";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import {
  GUARDIAN_CATEGORY_FILTER_OPTIONS,
  GUARDIAN_CATEGORY_META,
  isGuardianVisibleNotification,
  resolveNotificationActionUrl,
  resolveGuardianNotificationCategory,
} from "../utils/notificationRouting";
import {
  Bell,
  Search,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  Syringe,
  AlertCircle,
  Info,
  ChevronRight,
  MoreVertical,
  MailOpen,
} from 'lucide-react';

const NOTIFICATION_CATEGORY_CONFIG = {
  appointment: {
    icon: Calendar,
    label: "Appointments",
    bg: "bg-blue-100 text-blue-600"
  },
  vaccination_update: {
    icon: Syringe,
    label: "Vaccination Updates",
    bg: "bg-purple-100 text-purple-600"
  },
  reminder: {
    icon: Bell,
    label: "Reminders",
    bg: "bg-amber-100 text-amber-600"
  },
  health_alert: {
    icon: AlertCircle,
    label: "Health Alerts",
    bg: "bg-red-100 text-red-600"
  },
  general: {
    icon: Info,
    label: "Announcements",
    bg: "bg-amber-100 text-amber-600"
  },
  default: {
    icon: Bell,
    label: "Notification",
    bg: "bg-gray-100 text-gray-600"
  },
};

const GUARDIAN_FILTER_TABS = GUARDIAN_CATEGORY_FILTER_OPTIONS
  .filter((option) => option.value === 'all' || option.value === 'unread')
  .map((option) => ({
    id: option.value,
    label: option.label,
  }));

const normalizeGuardianNotification = (notification = {}) => {
  const category =
    resolveGuardianNotificationCategory(notification, { isGuardian: true }) ||
    "general";

  return {
    ...notification,
    category,
    category_label:
      GUARDIAN_CATEGORY_META[category]?.label || GUARDIAN_CATEGORY_META.general.label,
    action_url: resolveNotificationActionUrl(notification, { isGuardian: true }),
    created_at:
      notification.created_at ||
      notification.createdAt ||
      notification.timestamp ||
      new Date().toISOString(),
    is_read: Boolean(
      notification.is_read ??
        notification.read ??
        notification.isRead ??
        false,
    ),
  };
};

const normalizeNotificationText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const resolveNotificationCreatedAt = (notification = {}) =>
  notification.created_at || notification.createdAt || notification.timestamp || null;

const resolveNotificationMetadata = (notification = {}) => {
  const metadata = notification.metadata || notification.meta || null;
  return metadata && typeof metadata === "object" ? metadata : {};
};

const resolveNotificationReadFlag = (notification = {}) =>
  Boolean(notification.is_read ?? notification.read ?? notification.isRead ?? false);

const buildNotificationDedupeKey = (notification = {}) => {
  const metadata = resolveNotificationMetadata(notification);
  const createdAt = resolveNotificationCreatedAt(notification);
  const createdAtMs = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  const fiveMinuteBucket = Number.isFinite(createdAtMs)
    ? Math.floor(createdAtMs / (5 * 60 * 1000))
    : 0;

  return [
    "semantic",
    normalizeNotificationText(notification.notification_type || notification.type || notification.category || "general"),
    normalizeNotificationText(notification.title || "").slice(0, 80),
    normalizeNotificationText(notification.message || "").slice(0, 180),
    metadata.infant_id || notification.infant_id || "",
    metadata.appointment_id || notification.appointment_id || "",
    metadata.vaccine_id || notification.vaccine_id || "",
    metadata.dose_number || notification.dose_number || "",
    metadata.suggested_date || notification.suggested_date || metadata.date || "",
    metadata.suggested_time || notification.suggested_time || metadata.time || "",
    fiveMinuteBucket,
  ].join("|");
};

const mergeDuplicateNotification = (existingNotification, incomingNotification) => {
  const merged = {
    ...existingNotification,
    ...incomingNotification,
  };

  merged.id = existingNotification?.id || incomingNotification?.id || undefined;
  merged.is_read =
    resolveNotificationReadFlag(existingNotification) ||
    resolveNotificationReadFlag(incomingNotification);

  return merged;
};

const NotificationItem = ({ notification, onMarkRead, onMarkUnread, onDelete }) => {
  const config =
    NOTIFICATION_CATEGORY_CONFIG[notification.category] ||
    NOTIFICATION_CATEGORY_CONFIG[notification.notification_type] ||
    NOTIFICATION_CATEGORY_CONFIG.default;
  const Icon = config.icon;
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`group relative p-4 rounded-xl border transition-all duration-200 ${
      notification.is_read
        ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
        : 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 hover:border-blue-200 dark:hover:border-blue-700'
    }`}>
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Icon */}
        <div className={`p-2.5 rounded-full ${config.bg || 'bg-gray-100 text-gray-600'} shrink-0`}>
          <Icon size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm font-semibold ${notification.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
              {notification.title}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
              {format(new Date(notification.created_at), 'h:mm a')}
            </span>
          </div>

          <p className={`mt-1 text-sm ${notification.is_read ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-gray-200 font-medium'}`}>
            {notification.message}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              {notification.category_label}
            </span>
            {notification.action_url && (
              <Link
                to={notification.action_url}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-full transition-colors"
              >
                {String(notification.action_url).includes("/guardian/appointments")
                  ? "Open Appointments Calendar"
                  : "Open Module"}{" "}
                <ChevronRight size={12} />
              </Link>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Options"
          >
            <MoreVertical size={16} />
          </button>

          {showActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20 overflow-hidden">
                {notification.is_read ? (
                  <button
                    onClick={() => { onMarkUnread(notification.id); setShowActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <MailOpen size={14} /> Mark as unread
                  </button>
                ) : (
                  <button
                    onClick={() => { onMarkRead(notification.id); setShowActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <Check size={14} /> Mark as read
                  </button>
                )}
                <button
                  onClick={() => { onDelete(notification.id); setShowActions(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const GuardianNotificationsPage = () => {

  // Use the hook for notifications with caching
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification
  } = useGuardianNotifications({ limit: 50, pollingInterval: 0 });

  // Get socket connection for real-time updates
  const { isConnected, on, off } = useSocket();
  const [socketRealTimeNotifications, setSocketRealTimeNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle real-time socket notifications
  useEffect(() => {
    if (!isConnected) return;

    // Listen for new notifications
    const handleNewNotification = (data) => {
      if (data?.notification && isGuardianVisibleNotification(data.notification)) {
        setSocketRealTimeNotifications(prev => [data.notification, ...prev]);
      }
    };

    // Listen for notification updates
    const handleNotificationUpdated = (data) => {
      // Trigger a refresh to get the latest state
      refresh();
    };

    // Listen for notification deletion
    const handleNotificationDeleted = (data) => {
      setSocketRealTimeNotifications(prev =>
        prev.filter(n => n.id !== data.notificationId)
      );
    };

    // Listen for all notifications read
    const handleAllRead = (data) => {
      setSocketRealTimeNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    };

    // Register event listeners
    on('notification', handleNewNotification);
    on('critical-notification', handleNewNotification);
    on('actionable-notification', handleNewNotification);
    on('notification-updated', handleNotificationUpdated);
    on('notification-deleted', handleNotificationDeleted);
    on('notifications-read-all', handleAllRead);

    // Cleanup
    return () => {
      off('notification', handleNewNotification);
      off('critical-notification', handleNewNotification);
      off('actionable-notification', handleNewNotification);
      off('notification-updated', handleNotificationUpdated);
      off('notification-deleted', handleNotificationDeleted);
      off('notifications-read-all', handleAllRead);
    };
  }, [isConnected, on, off, refresh]);

  // Combine API notifications with real-time socket notifications
  const combinedNotifications = useMemo(() => {
    const allNotifications = [...socketRealTimeNotifications, ...notifications];

    // Remove duplicates using a semantic fingerprint so equivalent records collapse even if IDs differ.
    const uniqueMap = new Map();

    allNotifications.forEach((notification) => {
      const key = buildNotificationDedupeKey(notification);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, notification);
        return;
      }

      uniqueMap.set(
        key,
        mergeDuplicateNotification(uniqueMap.get(key), notification),
      );
    });

    return Array.from(uniqueMap.values());
  }, [socketRealTimeNotifications, notifications]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const normalizedNotifications = useMemo(
    () =>
      combinedNotifications
        .filter((notification) => isGuardianVisibleNotification(notification))
        .map((notification) => normalizeGuardianNotification(notification))
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        ),
    [combinedNotifications],
  );

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return normalizedNotifications.filter((notification) => {
      if (activeTab === 'unread' && notification.is_read) {
        return false;
      }

      if (
        activeTab !== 'all' &&
        activeTab !== 'unread' &&
        notification.category !== activeTab
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${notification.title || ''} ${notification.message || ''} ${notification.category_label || ''}`
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeTab, normalizedNotifications, searchQuery]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refresh]);

  // Handle filter change
  const handleFilterChange = (tabId) => {
    setActiveTab(tabId);
  };

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((acc, notification) => {
    const date = new Date(notification.created_at);
    let key = 'Earlier';

    if (isToday(date)) key = 'Today';
    else if (isYesterday(date)) key = 'Yesterday';
    else if (isThisWeek(date)) key = 'This Week';

    if (!acc[key]) acc[key] = [];
    acc[key].push(notification);
    return acc;
  }, {});

  const hasNotifications = normalizedNotifications.length > 0;
  const hasFilteredNotifications = filteredNotifications.length > 0;

  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="min-[1025px]:hidden sticky top-0 z-30 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      <GuardianModuleHeader
        title="Notifications"
        subtitle="Stay updated with your children's health"
        icon={<Bell className="w-8 h-8 text-white" />}
      />

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">
        {/* Utility Row */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col min-[768px]:flex-row gap-4 justify-between items-stretch min-[768px]:items-center">
            {/* Search */}
            <div className="relative w-full min-[768px]:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search notifications..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-shadow dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full min-[768px]:w-auto">
              <button
                onClick={markAllAsRead}
                  className="flex-1 min-[768px]:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={unreadCount === 0}
              >
                <CheckCheck size={16} />
                  <span className="hidden min-[768px]:inline">Mark all read</span>
                  <span className="min-[768px]:hidden">Read all</span>
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {/* Real-time Connection Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-gray-600 dark:text-gray-300">
                {isConnected ? 'Live' : 'Polling'}
              </span>
            </div>

            {GUARDIAN_FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 h-24" />
            ))}
          </div>
        ) : !hasNotifications ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 border-dashed">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No notifications yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              We'll notify you about upcoming vaccinations, appointments, and important updates here.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/guardian/appointments" className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30">
                View Appointments
              </Link>
              <Link to="/guardian/children" className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                My Children
              </Link>
            </div>
          </div>
        ) : !hasFilteredNotifications ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 border-dashed">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No notifications match the active filters</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              Try another category or search keyword to find a different notification.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {['Today', 'Yesterday', 'This Week', 'Earlier'].map(group => {
              const groupItems = groupedNotifications[group];
              if (!groupItems?.length) return null;

              return (
                <div key={group}>
                  <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">
                    {group}
                  </h2>
                  <div className="space-y-3">
                    {groupItems.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onMarkUnread={markAsUnread}
                        onDelete={deleteNotification}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default GuardianNotificationsPage;
