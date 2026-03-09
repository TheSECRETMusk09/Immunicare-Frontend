/**
 * useGuardianNotifications Hook
 * Custom hook for managing guardian notifications with real-time updates
 */

import { useState, useEffect, useCallback, useRef } from "react";
import guardianNotificationService from "../services/guardianNotificationService";
import { useAuth } from "../contexts/AuthContext";

const useGuardianNotifications = (options = {}) => {
  const { limit = 20, pollingInterval = 60000, autoFetch = true } = options;
  const { guardianId, isGuardian } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    unreadOnly: false,
    search: ''
  });

  const pollingIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef(0);
  const cachedNotificationsRef = useRef([]);
  const cachedCountRef = useRef(0);
  const lastRequestKeyRef = useRef("");

  // Check if we should fetch (prevent redundant fetches)
  const shouldFetch = useCallback(() => {
    const now = Date.now();
    // Only fetch if it's been at least 5 seconds since last fetch
    return now - lastFetchTimeRef.current > 5000;
  }, []);

  // Fetch notifications with caching
  const fetchNotifications = useCallback(
    async (force = false) => {
      // Only fetch for actual guardian users
      if (!guardianId || !isGuardian) return;

      // Skip if not forced and recently fetched (within last 5 seconds)
      // Note: We skip this check if filters change to ensure UI updates immediately
      const requestKey = JSON.stringify({ limit, filters });
      if (!force && !shouldFetch() && requestKey === lastRequestKeyRef.current) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [notificationsRes, countRes] = await Promise.all([
          guardianNotificationService.getNotifications({ ...filters, limit }),
          guardianNotificationService.getUnreadCount(),
        ]);

        if (isMountedRef.current) {
          if (notificationsRes?.success) {
            const newNotifications = notificationsRes.data || [];
            // Only update if data has changed (prevent unnecessary re-renders)
            if (
              JSON.stringify(newNotifications) !==
              JSON.stringify(cachedNotificationsRef.current)
            ) {
              cachedNotificationsRef.current = newNotifications;
              setNotifications(newNotifications);
            }
          }

          if (countRes?.success) {
            const newCount =
              countRes?.data?.count ??
              countRes?.count ??
              countRes?.data?.data?.count ??
              0;
            // Only update if count has changed
            if (newCount !== cachedCountRef.current) {
              cachedCountRef.current = newCount;
              setUnreadCount(newCount);
            }
          }

          lastFetchTimeRef.current = Date.now();
          lastRequestKeyRef.current = requestKey;
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
        if (isMountedRef.current) {
          setError(err.message || "Failed to fetch notifications");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [guardianId, isGuardian, limit, shouldFetch, filters],
  );

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await guardianNotificationService.markAsRead(notificationId);

      // Update local state
      if (isMountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      return true;
    } catch (err) {
      console.error("Error marking notification as read:", err);
      return false;
    }
  }, []);

  // Mark notification as unread
  const markAsUnread = useCallback(async (notificationId) => {
    try {
      await guardianNotificationService.markAsUnread(notificationId);

      // Update local state
      if (isMountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: false } : n,
          ),
        );
        setUnreadCount((prev) => prev + 1);
      }

      return true;
    } catch (err) {
      console.error("Error marking notification as unread:", err);
      return false;
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await guardianNotificationService.markAllAsRead();

      // Update local state
      if (isMountedRef.current) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }

      return true;
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      return false;
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId) => {
      try {
        // First, find the notification to check if it was unread
        const notificationToDelete = notifications.find(
          (n) => n.id === notificationId,
        );
        const wasUnread = notificationToDelete && !notificationToDelete.is_read;

        await guardianNotificationService.deleteNotification(notificationId);

        // Update local state - filter out the deleted notification and update unread count
        if (isMountedRef.current) {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== notificationId),
          );
          // Decrement unread count if the deleted notification was unread
          if (wasUnread) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }

        return true;
      } catch (err) {
        console.error("Error deleting notification:", err);
        return false;
      }
    },
    [notifications],
  );

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Refresh notifications (force fetch regardless of cache)
  const refresh = useCallback(() => {
    return fetchNotifications(true); // Force refresh
  }, [fetchNotifications]);

  // Initial fetch and polling setup
  useEffect(() => {
    isMountedRef.current = true;

    if (autoFetch && guardianId && isGuardian) {
      fetchNotifications(true); // Initial fetch is always forced

      // Set up polling with increased interval to reduce API calls
      if (pollingInterval > 0) {
        pollingIntervalRef.current = setInterval(
          () => fetchNotifications(false), // Subsequent fetches respect cache
          pollingInterval,
        );
      }
    }

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [autoFetch, guardianId, isGuardian, fetchNotifications, pollingInterval]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    filters,
    updateFilters,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    refresh,
  };
};

export default useGuardianNotifications;

export { useGuardianNotifications };
