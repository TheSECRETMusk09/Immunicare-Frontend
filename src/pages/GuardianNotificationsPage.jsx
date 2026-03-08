import React, { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import useGuardianNotifications from "../hooks/useGuardianNotifications";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
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
  RefreshCw,
  User,
  MessageSquare
} from 'lucide-react';

const NOTIFICATION_TYPE_CONFIG = {
  appointment_reminder: {
    icon: Calendar,
    label: "Appointment Reminder",
    bg: "bg-blue-100 text-blue-600"
  },
  appointment_status: {
    icon: Calendar,
    label: "Appointment Update",
    bg: "bg-green-100 text-green-600"
  },
  vaccination_reminder: {
    icon: Syringe,
    label: "Vaccination Reminder",
    bg: "bg-purple-100 text-purple-600"
  },
  profile_update: {
    icon: User,
    label: "Profile Update",
    bg: "bg-gray-100 text-gray-600"
  },
  new_message: {
    icon: MessageSquare,
    label: "New Message",
    bg: "bg-teal-100 text-teal-600"
  },
  health_alert: {
    icon: AlertCircle,
    label: "Health Alert",
    bg: "bg-red-100 text-red-600"
  },
  vaccine_availability: {
    icon: CheckCheck,
    label: "Vaccine Available",
    bg: "bg-violet-100 text-violet-600"
  },
  system_announcement: {
    icon: Info,
    label: "Announcement",
    bg: "bg-amber-100 text-amber-600"
  },
  default: {
    icon: Bell,
    label: "Notification",
    bg: "bg-gray-100 text-gray-600"
  },
};

const NotificationItem = ({ notification, onMarkRead, onMarkUnread, onDelete }) => {
  const config = NOTIFICATION_TYPE_CONFIG[notification.notification_type] || NOTIFICATION_TYPE_CONFIG.default;
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

          {/* Metadata Chips - Example based on content */}
          {(notification.related_entity_type === 'appointment' || notification.related_entity_type === 'vaccination') && (
            <div className="mt-3">
              <Link
                to={notification.action_url}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-full transition-colors"
              >
                View Details <ChevronRight size={12} />
              </Link>
            </div>
          )}
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
  const navigate = useNavigate();

  // Use the hook for notifications with caching
  const {
    notifications,
    unreadCount,
    loading,
    updateFilters,
    refresh,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification
  } = useGuardianNotifications({ limit: 50, pollingInterval: 0 });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refresh]);

  // Handle filter change
  const handleFilterChange = (type) => {
    setActiveTab(type);
    updateFilters({ type: type === 'all' ? null : type, unreadOnly: false });
  };

  // Handle unread filter
  const handleUnreadFilter = () => {
    setActiveTab('unread');
    updateFilters({ unreadOnly: true, type: null });
  };

  // Group notifications by date
  const groupedNotifications = notifications.reduce((acc, notification) => {
    const date = new Date(notification.created_at);
    let key = 'Earlier';

    if (isToday(date)) key = 'Today';
    else if (isYesterday(date)) key = 'Yesterday';
    else if (isThisWeek(date)) key = 'This Week';

    if (!acc[key]) acc[key] = [];
    acc[key].push(notification);
    return acc;
  }, {});

  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="lg:hidden sticky top-0 z-30 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-200">
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
        actions={
          <div className="hidden lg:flex guardian-desktop-pageheader-actions">
            <button
              type="button"
              onClick={handleRefresh}
              className="guardian-desktop-pageheader-icon-btn"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => navigate('/guardian/profile')}
              className="guardian-desktop-pageheader-icon-btn"
              aria-label="Open profile"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6 p-4 md:p-6">
        {/* Utility Row */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search notifications..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-shadow dark:text-white"
                onChange={(e) => updateFilters({ search: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={markAllAsRead}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={unreadCount === 0}
              >
                <CheckCheck size={16} />
                <span className="hidden sm:inline">Mark all read</span>
                <span className="sm:hidden">Read all</span>
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'vaccination_reminder', label: 'Vaccinations' },
              { id: 'appointment_reminder', label: 'Appointments' },
              { id: 'vaccine_availability', label: 'Availability' },
              { id: 'system_announcement', label: 'Announcements' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'unread') {
                    setActiveTab('unread');
                    updateFilters({ unreadOnly: true, type: null });
                    handleUnreadFilter();
                  } else {
                    handleFilterChange(tab.id);
                    updateFilters({ unreadOnly: false });
                  }
                }}
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
        ) : notifications.length === 0 ? (
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
