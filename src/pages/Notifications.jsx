import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, Button, PageHeader } from "../components/UI";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import guardianNotificationService from "../services/guardianNotificationService";
import { Bell, CheckCheck, RefreshCw, Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import PortalDatePicker from "../components/UI/PortalDatePicker";
import {
  CATEGORY_FILTER_OPTIONS,
  CATEGORY_META,
  isExternalNotificationUrl,
  resolveNotificationActionUrl as deriveNotificationActionUrl,
  resolveNotificationCategory as resolveNotificationCategoryKey,
} from "../utils/notificationRouting";

const SEVERITY_META = {
  critical: {
    label: "Critical",
    badgeClass:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-200",
  },
  high: {
    label: "High",
    badgeClass:
      "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-200",
  },
  warning: {
    label: "Warning",
    badgeClass:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100",
  },
  info: {
    label: "Info",
    badgeClass:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-100",
  },
};

const STATUS_META = {
  new: {
    label: "New",
    badgeClass:
      "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-100",
  },
  read: {
    label: "Read",
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-700/40 dark:text-slate-200",
  },
  pending: {
    label: "Pending",
    badgeClass:
      "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-500/40 dark:bg-yellow-500/20 dark:text-yellow-100",
  },
  sent: {
    label: "Sent",
    badgeClass:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-100",
  },
  delivered: {
    label: "Delivered",
    badgeClass:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100",
  },
  failed: {
    label: "Failed",
    badgeClass:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-200",
  },
};

const OPEN_MODULE_BUTTON_CLASSNAME = [
  "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold",
  "text-white visited:text-white hover:text-white active:text-white",
  "dark:text-white dark:visited:text-white dark:hover:text-white dark:active:text-white",
  "no-underline transition-colors focus:outline-none focus-visible:ring-2",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98]",
  "disabled:pointer-events-none disabled:opacity-50",
  "border-[var(--color-medical-700)] bg-[var(--color-medical-700)]",
  "hover:border-[var(--color-medical-800)] hover:bg-[var(--color-medical-800)]",
  "focus-visible:ring-[var(--color-medical-300)]",
  "active:border-[var(--color-medical-900)] active:bg-[var(--color-medical-900)]",
  "dark:border-[var(--color-medical-600)] dark:bg-[var(--color-medical-600)]",
  "dark:hover:border-[var(--color-medical-500)] dark:hover:bg-[var(--color-medical-500)]",
  "dark:focus-visible:ring-[var(--color-medical-300)] dark:focus-visible:ring-offset-gray-900",
  "dark:active:border-[var(--color-medical-700)] dark:active:bg-[var(--color-medical-700)]",
].join(" ");

const OPEN_MODULE_BUTTON_STYLE = {
  color: "var(--color-text-inverse)",
};

const SEVERITY_FILTER_OPTIONS = [
  { value: "all", label: "All severity" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "new", label: "New" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

const CATEGORY_FILTER_VALUES = new Set(
  CATEGORY_FILTER_OPTIONS.map((option) => option.value),
);
const SEVERITY_FILTER_VALUES = new Set(
  SEVERITY_FILTER_OPTIONS.map((option) => option.value),
);
const STATUS_FILTER_VALUES = new Set(
  STATUS_FILTER_OPTIONS.map((option) => option.value),
);

const getAllowedFilterValue = (value, allowedValues) =>
  allowedValues.has(value) ? value : "all";

const toLowerValue = (value) =>
  typeof value === "string" ? value.toLowerCase() : "";

const includesAny = (text, terms) =>
  terms.some((term) => text.includes(term));

const resolveCategory = (raw, text) => {
  return resolveNotificationCategoryKey(raw, { sourceText: text });
};

const parseTimestamp = (raw) => {
  const candidates = [
    raw?.created_at,
    raw?.createdAt,
    raw?.timestamp,
    raw?.time,
    raw?.date,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") {
      continue;
    }

    const resolved =
      candidate instanceof Date ? candidate : new Date(candidate);

    if (!Number.isNaN(resolved.getTime())) {
      return resolved;
    }
  }

  return new Date();
};

const resolveSeverityFromPriority = (priority) => {
  if (typeof priority === "number") {
    if (priority >= 4) return "critical";
    if (priority >= 3) return "high";
    if (priority >= 2) return "warning";
    return "info";
  }

  const normalized = toLowerValue(priority);

  if (["critical", "urgent", "p1", "highest"].includes(normalized)) {
    return "critical";
  }

  if (["high", "error", "p2"].includes(normalized)) {
    return "high";
  }

  if (["warning", "warn", "medium", "p3"].includes(normalized)) {
    return "warning";
  }

  if (["info", "low", "success", "p4"].includes(normalized)) {
    return "info";
  }

  return null;
};

const resolveSeverity = (raw, category, text) => {
  const explicitSeverity = resolveSeverityFromPriority(raw?.severity);
  if (explicitSeverity) return explicitSeverity;

  const explicitPriority = resolveSeverityFromPriority(raw?.priority);
  if (explicitPriority) return explicitPriority;

  if (
    [
      "inventory_out_of_stock",
      "outbound_message_failed",
      "missed_schedule",
    ].includes(category)
  ) {
    return "critical";
  }

  if (["inventory_low_stock", "vaccination_schedule"].includes(category)) {
    return "warning";
  }

  if (includesAny(text, ["critical", "urgent", "immediate action"])) {
    return "critical";
  }

  if (includesAny(text, ["warning", "attention needed"])) {
    return "warning";
  }

  return "info";
};

const resolveStatus = (raw, isRead, text) => {
  const rawStatus = toLowerValue(
    raw?.delivery_status || raw?.status || raw?.state || raw?.lifecycle_status,
  );

  if (
    rawStatus.includes("fail") ||
    rawStatus.includes("undeliver") ||
    rawStatus.includes("bounce")
  ) {
    return "failed";
  }

  if (rawStatus.includes("deliver")) {
    return "delivered";
  }

  if (rawStatus.includes("sent") || rawStatus.includes("dispatch")) {
    return "sent";
  }

  if (
    rawStatus.includes("pending") ||
    rawStatus.includes("queue") ||
    rawStatus.includes("retry")
  ) {
    return "pending";
  }

  if (isRead) {
    return "read";
  }

  if (
    includesAny(text, [
      "failed delivery",
      "undelivered",
      "message failure",
      "sms failed",
      "email failed",
    ])
  ) {
    return "failed";
  }

  return "new";
};

const resolveActionUrl = (raw) => {
  return deriveNotificationActionUrl(raw, { isGuardian: false });
};

const normalizeNotificationRecord = (raw, index) => {
  const messageSource =
    raw?.message || raw?.content || raw?.description || raw?.body || "";

  const titleSource =
    raw?.title || raw?.subject || raw?.event_title || raw?.event || "";

  const sourceText = `${titleSource} ${messageSource} ${
    raw?.category || ""
  } ${raw?.notification_type || ""} ${raw?.type || ""}`
    .trim()
    .toLowerCase();

  const category = resolveCategory(raw, sourceText);

  const title =
    String(titleSource || "").trim() ||
    CATEGORY_META[category]?.label ||
    "System notification";

  const message =
    String(messageSource || "").trim() ||
    "No additional details were provided by the source system.";

  const timestamp = parseTimestamp(raw);

  const isRead = Boolean(
    raw?.is_read ??
      raw?.read ??
      raw?.isRead ??
      toLowerValue(raw?.status) === "read",
  );

  const severity = resolveSeverity(raw, category, sourceText);
  const status = resolveStatus(raw, isRead, sourceText);

  const persistedId =
    raw?.id ?? raw?.notification_id ?? raw?.notificationId ?? raw?.uuid ?? null;

  const stableId =
    persistedId !== null && persistedId !== undefined && persistedId !== ""
      ? String(persistedId)
      : `local-${index}-${timestamp.getTime()}`;

  return {
    ...raw,
    id: stableId,
    persistedId,
    title,
    message,
    timestamp,
    category,
    categoryLabel: CATEGORY_META[category]?.label || CATEGORY_META.general.label,
    icon: CATEGORY_META[category]?.icon || CATEGORY_META.general.icon,
    severity,
    status,
    isRead,
    actionUrl: resolveActionUrl(raw),
  };
};

const extractNotificationArray = (response) => {
  const payload = response?.data || response;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.notifications)) {
    return payload.notifications;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const getStartOfCurrentWeek = (referenceDate) => {
  const clone = new Date(referenceDate);
  clone.setHours(0, 0, 0, 0);
  const day = (clone.getDay() + 6) % 7;
  clone.setDate(clone.getDate() - day);
  return clone;
};

const getTimeBucket = (date) => {
  const now = new Date();

  if (isSameDay(date, now)) {
    return "Today";
  }

  const weekStart = getStartOfCurrentWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(weekStart.getDate() + 7);

  if (date >= weekStart && date < nextWeek) {
    return "This Week";
  }

  return "Earlier";
};

const formatRelativeTimestamp = (date) => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();

  if (diffInMs < 60 * 1000) {
    return "Just now";
  }

  if (diffInMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(diffInMs / (60 * 1000)));
    return `${minutes}m ago`;
  }

  if (diffInMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(diffInMs / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }

  const days = Math.max(1, Math.floor(diffInMs / (24 * 60 * 60 * 1000)));
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatAbsoluteTimestamp = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const Notifications = () => {
  const { isGuardian } = useAuth();
  const [searchParams] = useSearchParams();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingItemIds, setMarkingItemIds] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(() =>
    getAllowedFilterValue(
      searchParams.get("category"),
      CATEGORY_FILTER_VALUES,
    ),
  );
  const [severityFilter, setSeverityFilter] = useState(() =>
    getAllowedFilterValue(
      searchParams.get("severity"),
      SEVERITY_FILTER_VALUES,
    ),
  );
  const [statusFilter, setStatusFilter] = useState(() =>
    getAllowedFilterValue(searchParams.get("status"), STATUS_FILTER_VALUES),
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { isDark, toggleDarkMode } = useTheme();

  useEffect(() => {
    setCategoryFilter(
      getAllowedFilterValue(searchParams.get("category"), CATEGORY_FILTER_VALUES),
    );
    setSeverityFilter(
      getAllowedFilterValue(searchParams.get("severity"), SEVERITY_FILTER_VALUES),
    );
    setStatusFilter(
      getAllowedFilterValue(searchParams.get("status"), STATUS_FILTER_VALUES),
    );
  }, [searchParams]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const apiFilters = {
        limit: 100,
        ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
        ...(statusFilter === "unread"
          ? { isRead: false }
          : statusFilter === "read"
            ? { isRead: true }
            : {}),
      };

      if (isGuardian) {
        const response = await guardianNotificationService.getNotifications({
          limit: 100,
        });
        setNotifications(extractNotificationArray(response));
      } else {
        const response = await apiClient.getNotifications(apiFilters);
        setNotifications(extractNotificationArray(response));
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setNotifications([]);
      setError("Failed to load notifications. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, isGuardian, statusFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      setMarkingAllRead(true);
      setError("");

      if (isGuardian) {
        await guardianNotificationService.markAllAsRead();
      } else {
        await apiClient.markAllNotificationsAsRead();
      }

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read: true })),
      );
    } catch (err) {
      console.error("Error marking all as read:", err);
      setError("Failed to mark all notifications as read");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleRetryDelivery = async (notification) => {
    if (!notification?.persistedId) return;
    try {
      if (typeof apiClient.retryNotification === "function") {
        await apiClient.retryNotification(notification.persistedId);
      }
      await fetchNotifications();
    } catch (err) {
      console.error("Error retrying notification delivery:", err);
    }
  };

  const handleMarkAsRead = async (persistedId) => {
    if (persistedId === null || persistedId === undefined || persistedId === "") {
      return;
    }

    const targetId = String(persistedId);

    try {
      setMarkingItemIds((prev) =>
        prev.includes(targetId) ? prev : [...prev, targetId],
      );

      if (isGuardian) {
        await guardianNotificationService.markAsRead(persistedId);
      } else {
        await apiClient.markNotificationAsRead(persistedId);
      }

      setNotifications((prev) =>
        prev.map((entry) => {
          const candidateId =
            entry?.id ??
            entry?.notification_id ??
            entry?.notificationId ??
            entry?.uuid;

          if (
            candidateId !== null &&
            candidateId !== undefined &&
            String(candidateId) === targetId
          ) {
            return {
              ...entry,
              is_read: true,
              read: true,
              isRead: true,
            };
          }

          return entry;
        }),
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    } finally {
      setMarkingItemIds((prev) => prev.filter((value) => value !== targetId));
    }
  };

  const adaptedNotifications = useMemo(
    () =>
      notifications
        .map((notification, index) => normalizeNotificationRecord(notification, index))
        .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime()),
    [notifications],
  );

  const unreadCount = useMemo(
    () => adaptedNotifications.filter((item) => !item.isRead).length,
    [adaptedNotifications],
  );

  const criticalCount = useMemo(
    () =>
      adaptedNotifications.filter(
        (item) => item.severity === "critical" || item.status === "failed",
      ).length,
    [adaptedNotifications],
  );

  const todayCount = useMemo(
    () => adaptedNotifications.filter((item) => isSameDay(item.timestamp, new Date())).length,
    [adaptedNotifications],
  );

  const resolvedCount = useMemo(
    () => adaptedNotifications.filter((item) => item.isRead).length,
    [adaptedNotifications],
  );

  const filteredNotifications = useMemo(
    () =>
      adaptedNotifications.filter((item) => {
        if (categoryFilter !== "all" && item.category !== categoryFilter) {
          return false;
        }

        if (severityFilter !== "all" && item.severity !== severityFilter) {
          return false;
        }

        if (statusFilter === "unread") {
          return !item.isRead;
        }

        if (statusFilter === "read") {
          return item.isRead;
        }

        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false;
        }

        if (item.timestamp) {
          const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
          if (startDate && itemDate < startDate) return false;
          if (endDate && itemDate > endDate) return false;
        }

        return true;
      }),
    [adaptedNotifications, categoryFilter, severityFilter, statusFilter, startDate, endDate],
  );

  const groupedNotifications = useMemo(() => {
    const groups = {
      Today: [],
      "This Week": [],
      Earlier: [],
    };

    filteredNotifications.forEach((notification) => {
      const bucket = getTimeBucket(notification.timestamp);
      groups[bucket].push(notification);
    });

    return groups;
  }, [filteredNotifications]);

  const hasData = adaptedNotifications.length > 0;

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-[#0d1424]">

        {/* ── HEADER BANNER ── */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 dark:from-[#0d1424] dark:via-[#101c35] dark:to-[#152a4f] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 dark:bg-white/10">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white sm:text-2xl">Notifications</h1>
                <p className="truncate text-xs text-blue-200/80 dark:text-blue-300/60 sm:text-sm">
                  Appointments · Schedules · Stock risks · Registrations · Reports · Delivery failures
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAllRead || !hasData}
                className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{markingAllRead ? "Marking…" : "Mark all read"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            {/* ── STATS ROW ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setStatusFilter((p) => (p === "unread" ? "all" : "unread"))}
                aria-pressed={statusFilter === "unread"}
                className={`rounded-xl border p-3 text-left transition-all focus:outline-none sm:p-4 ${
                  statusFilter === "unread"
                    ? "border-blue-300 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-500/15"
                    : "border-gray-200 bg-white hover:border-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500/30"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Unread</p>
                <p data-testid="summary-unread-count" className="mt-1.5 text-2xl font-bold text-blue-500 dark:text-blue-400 sm:text-3xl">{unreadCount}</p>
                <p className="mt-1 block text-xs text-gray-400 dark:text-gray-500 sm:hidden md:block">Needs acknowledgement</p>
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter((p) => (p === "critical" ? "all" : "critical"))}
                aria-pressed={severityFilter === "critical"}
                className={`rounded-xl border p-3 text-left transition-all focus:outline-none sm:p-4 ${
                  severityFilter === "critical"
                    ? "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-500/15"
                    : "border-gray-200 bg-white hover:border-red-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-red-500/30"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Critical</p>
                <p data-testid="summary-critical-count" className="mt-1.5 text-2xl font-bold text-red-500 dark:text-red-400 sm:text-3xl">{criticalCount}</p>
                <p className="mt-1 block text-xs text-gray-400 dark:text-gray-500 sm:hidden md:block">Critical events and failed outbound</p>
              </button>

              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Today Total</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{todayCount}</p>
                <p className="mt-1 block text-xs text-gray-400 dark:text-gray-500 sm:hidden md:block">Notifications generated today</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Resolved</p>
                <p className="mt-1.5 text-2xl font-bold text-green-500 dark:text-green-400 sm:text-3xl">{resolvedCount}</p>
                <p className="mt-1 block text-xs text-gray-400 dark:text-gray-500 sm:hidden md:block">Marked as read</p>
              </div>
            </div>

            {/* ── FILTER BAR ── */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="h-7 w-7 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <label htmlFor="n-cat" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Category</label>
                      <select
                        id="n-cat"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {CATEGORY_FILTER_OPTIONS.filter((o) => !o.label.toLowerCase().includes("announcement")).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="n-sev" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Severity</label>
                      <select
                        id="n-sev"
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {SEVERITY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="n-stat" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Status</label>
                      <select
                        id="n-stat"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="n-start" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Start Date</label>
                      <PortalDatePicker id="n-start" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth />
                    </div>

                    <div>
                      <label htmlFor="n-end" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">End Date</label>
                      <PortalDatePicker id="n-end" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
                    </div>

                    <div className="col-span-2 flex items-end justify-end md:col-span-3 lg:col-span-1 lg:justify-center">
                      <button
                        type="button"
                        onClick={() => { setCategoryFilter("all"); setSeverityFilter("all"); setStatusFilter("all"); setStartDate(""); setEndDate(""); }}
                        className="text-sm font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Reset filters
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Showing {filteredNotifications.length} of {adaptedNotifications.length} notifications
                  </p>
                </>
              )}
            </div>

            {/* ── NOTIFICATION LIST ── */}
            {!loading && (
              <>
                {filteredNotifications.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()}
                    </p>
                    <span className="text-xs font-bold text-blue-500 dark:text-blue-400">{filteredNotifications.length}</span>
                  </div>
                )}

                {filteredNotifications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
                    <Bell className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <h3 className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {hasData ? "No notifications matched the active filters" : "Notification feed is currently clear"}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {hasData
                        ? "Adjust the category, severity, status, or date filters."
                        : "System-generated alerts for appointments, inventory, and schedules will appear here."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {["Today", "This Week", "Earlier"].map((groupLabel) => {
                      const groupItems = groupedNotifications[groupLabel];
                      if (!groupItems.length) return null;

                      return (
                        <section key={groupLabel}>
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                              {groupLabel === "Today"
                                ? `Today — ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()}`
                                : groupLabel}
                            </h3>
                            <span className="text-xs font-bold text-blue-500 dark:text-blue-400">{groupItems.length}</span>
                          </div>

                          <div className="space-y-3">
                            {groupItems.map((notification) => {
                              const isCriticalCard = notification.severity === "critical" || notification.status === "failed";
                              const isUnread = !notification.isRead;
                              const isInventory = notification.category === "inventory_low_stock" || notification.category === "inventory_out_of_stock";
                              const severityMeta = SEVERITY_META[notification.severity] || SEVERITY_META.info;
                              const statusMeta = STATUS_META[notification.status] || STATUS_META.new;
                              const canMarkAsRead = isUnread && notification.persistedId !== null && notification.persistedId !== undefined && notification.persistedId !== "";
                              const itemLoading = markingItemIds.includes(String(notification.persistedId));

                              return (
                                <div
                                  key={notification.id}
                                  className="relative flex overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
                                >
                                  {/* Left accent bar */}
                                  <div className={`w-1 shrink-0 ${isCriticalCard ? "bg-red-500" : isUnread ? "bg-blue-600 dark:bg-blue-500" : "bg-transparent"}`} />

                                  {/* Unread dot */}
                                  {isUnread && (
                                    <div className={`absolute right-3 top-3 h-2 w-2 rounded-full ${isCriticalCard ? "bg-red-500" : "bg-blue-500"}`} aria-hidden="true" />
                                  )}

                                  <div className="flex flex-1 items-start gap-3 p-4 pr-7">
                                    {/* Category icon square */}
                                    <div
                                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base sm:h-10 sm:w-10 ${
                                        isCriticalCard
                                          ? "bg-red-100 dark:bg-red-500/20"
                                          : isInventory
                                          ? "bg-amber-100 dark:bg-amber-500/15"
                                          : "bg-blue-100 dark:bg-blue-500/15"
                                      }`}
                                      aria-hidden="true"
                                    >
                                      {notification.icon}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <h4 className="truncate text-sm font-bold text-gray-900 dark:text-white sm:text-[15px]">
                                        {notification.title}
                                      </h4>
                                      <p className="mt-0.5 text-sm leading-snug text-gray-500 dark:text-gray-400">
                                        {notification.message}
                                      </p>

                                      {/* Badges + timestamp */}
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                                          {notification.categoryLabel}
                                        </span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityMeta.badgeClass}`}>
                                          {severityMeta.label}
                                        </span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}>
                                          {statusMeta.label}
                                        </span>
                                        <span className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                                          {formatRelativeTimestamp(notification.timestamp)} · {formatAbsoluteTimestamp(notification.timestamp)}
                                        </span>
                                      </div>

                                      {/* Action buttons */}
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {canMarkAsRead && (
                                          <button
                                            type="button"
                                            onClick={() => handleMarkAsRead(notification.persistedId)}
                                            disabled={itemLoading}
                                            aria-label={`Mark ${notification.title} as read`}
                                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                          >
                                            {itemLoading ? "Marking…" : "Mark as read"}
                                          </button>
                                        )}

                                        {notification.actionUrl && (
                                          isExternalNotificationUrl(notification.actionUrl) ? (
                                            <a
                                              href={notification.actionUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={OPEN_MODULE_BUTTON_CLASSNAME}
                                              style={OPEN_MODULE_BUTTON_STYLE}
                                            >
                                              → {isInventory ? "View inventory" : "Open module"}
                                            </a>
                                          ) : (
                                            <Link
                                              to={notification.actionUrl}
                                              className={OPEN_MODULE_BUTTON_CLASSNAME}
                                              style={OPEN_MODULE_BUTTON_STYLE}
                                            >
                                              → {isInventory ? "View inventory" : "Open module"}
                                            </Link>
                                          )
                                        )}

                                        {isCriticalCard && (
                                          <button
                                            type="button"
                                            onClick={() => handleRetryDelivery(notification)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                          >
                                            <RefreshCw className="h-3 w-3" />
                                            Retry delivery
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default Notifications;

