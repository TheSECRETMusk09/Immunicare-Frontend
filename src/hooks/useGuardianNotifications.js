import { useState, useEffect, useCallback, useRef } from "react";
import guardianNotificationService from "../services/guardianNotificationService";
import { useAuth } from "../contexts/AuthContext";

const useGuardianNotifications = (options = {}) => {
  const { limit = 20, pollingInterval = 60000, autoFetch = true } = options;
  const { guardianId, isGuardian } = useAuth();

  const cleanFilters = useCallback((rawFilters = {}) => {
    const next = {};

    if (typeof rawFilters.type === "string") {
      const trimmedType = rawFilters.type.trim();
      if (trimmedType && trimmedType !== "all") {
        next.type = trimmedType;
      }
    }

    if (rawFilters.unreadOnly === true) {
      next.unreadOnly = true;
    }

    if (typeof rawFilters.search === "string") {
      const trimmedSearch = rawFilters.search.trim();
      if (trimmedSearch) {
        next.search = trimmedSearch;
      }
    }

    return next;
  }, []);

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

  const shouldFetch = useCallback(() => {
    const now = Date.now();
    return now - lastFetchTimeRef.current > 5000;
  }, []);

  const fetchNotifications = useCallback(
    async (force = false) => {
      if (!guardianId || !isGuardian) return;

      const queryFilters = cleanFilters(filters);

      const requestKey = JSON.stringify({ limit, filters: queryFilters });
      if (!force && !shouldFetch() && requestKey === lastRequestKeyRef.current) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [notificationsResult, countResult] = await Promise.allSettled([
          guardianNotificationService.getNotifications({ ...queryFilters, limit }),
          guardianNotificationService.getUnreadCount(),
        ]);

        if (notificationsResult.status === "rejected") {
          console.warn("Guardian notifications fetch skipped:", notificationsResult.reason);
        }
        if (countResult.status === "rejected") {
          console.warn("Guardian unread-count fetch skipped:", countResult.reason);
        }

        const notificationsRes =
          notificationsResult.status === "fulfilled" ? notificationsResult.value : null;
        const countRes = countResult.status === "fulfilled" ? countResult.value : null;

        if (isMountedRef.current) {
          if (notificationsRes?.success) {
            const newNotifications = notificationsRes.data || [];
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
    [guardianId, isGuardian, limit, shouldFetch, filters, cleanFilters],
  );

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await guardianNotificationService.markAsRead(notificationId);

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

  const markAsUnread = useCallback(async (notificationId) => {
    try {
      await guardianNotificationService.markAsUnread(notificationId);

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

  const markAllAsRead = useCallback(async () => {
    try {
      await guardianNotificationService.markAllAsRead();

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

  const deleteNotification = useCallback(
    async (notificationId) => {
      try {
        const notificationToDelete = notifications.find(
          (n) => n.id === notificationId,
        );
        const wasUnread = notificationToDelete && !notificationToDelete.is_read;

        await guardianNotificationService.deleteNotification(notificationId);

        if (isMountedRef.current) {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== notificationId),
          );
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
    setFilters((prev) => {
      const next = { ...prev, ...newFilters };

      if (
        next.type === prev.type &&
        next.unreadOnly === prev.unreadOnly &&
        next.search === prev.search
      ) {
        return prev;
      }

      return next;
    });
  }, []);

  const refresh = useCallback(() => {
    return fetchNotifications(true);
  }, [fetchNotifications]);

  useEffect(() => {
    isMountedRef.current = true;

    if (autoFetch && guardianId && isGuardian) {
      fetchNotifications(true);

      if (pollingInterval > 0) {
        pollingIntervalRef.current = setInterval(
          () => fetchNotifications(false),
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
