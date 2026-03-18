import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Button, PageHeader } from "../components/UI";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import guardianNotificationService from "../services/guardianNotificationService";
import { Bell } from "lucide-react";

const CATEGORY_META = {
  appointment: { label: "Appointments", icon: "📅" },
  vaccination_schedule: { label: "Vaccination Schedules", icon: "💉" },
  missed_schedule: { label: "Missed Schedules", icon: "⏰" },
  inventory_low_stock: { label: "Low Vaccine Stock", icon: "📦" },
  inventory_out_of_stock: { label: "Out-of-Stock Vaccines", icon: "🚨" },
  guardian_registration: { label: "Guardian Registrations", icon: "👨‍👩‍👧" },
  infant_registration: { label: "Infant Registrations", icon: "👶" },
  report: { label: "Reports", icon: "📊" },
  system_announcement: { label: "System Announcements", icon: "📢" },
  outbound_message_failed: { label: "Failed Outbound Messages", icon: "📵" },
  general: { label: "General", icon: "🔔" },
};

const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...Object.entries(CATEGORY_META)
    .filter(([value]) => value !== "general")
    .map(([value, meta]) => ({ value, label: meta.label })),
  { value: "general", label: "General" },
];

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

const toLowerValue = (value) =>
  typeof value === "string" ? value.toLowerCase() : "";

const includesAny = (text, terms) =>
  terms.some((term) => text.includes(term));

const mapExplicitCategory = (value) => {
  const normalized = toLowerValue(value).replace(/\s+/g, "_");

  if (
    ["appointment", "appointment_reminder", "appointment_update"].includes(
      normalized,
    )
  ) {
    return "appointment";
  }

  if (
    [
      "vaccination_schedule",
      "vaccination_reminder",
      "immunization_schedule",
      "vaccine_due",
    ].includes(normalized)
  ) {
    return "vaccination_schedule";
  }

  if (
    ["missed_schedule", "missed_appointment", "missed_vaccine"].includes(
      normalized,
    )
  ) {
    return "missed_schedule";
  }

  if (["low_stock", "inventory_low_stock"].includes(normalized)) {
    return "inventory_low_stock";
  }

  if (["out_of_stock", "inventory_out_of_stock"].includes(normalized)) {
    return "inventory_out_of_stock";
  }

  if (["guardian_registration", "guardian_registered"].includes(normalized)) {
    return "guardian_registration";
  }

  if (["infant_registration", "infant_registered"].includes(normalized)) {
    return "infant_registration";
  }

  if (["report", "report_ready", "report_generated"].includes(normalized)) {
    return "report";
  }

  if (
    ["system_announcement", "announcement", "system_update"].includes(
      normalized,
    )
  ) {
    return "system_announcement";
  }

  if (
    [
      "outbound_message_failed",
      "sms_failed",
      "email_failed",
      "delivery_failed",
    ].includes(normalized)
  ) {
    return "outbound_message_failed";
  }

  return null;
};

const inferCategoryFromText = (text) => {
  if (
    includesAny(text, [
      "out of stock",
      "out-of-stock",
      "stockout",
      "no doses",
      "depleted",
    ])
  ) {
    return "inventory_out_of_stock";
  }

  if (
    includesAny(text, [
      "low stock",
      "below threshold",
      "running low",
      "inventory alert",
      "stock alert",
    ])
  ) {
    return "inventory_low_stock";
  }

  if (
    includesAny(text, [
      "sms failed",
      "email failed",
      "failed delivery",
      "failed outbound",
      "undelivered",
      "delivery failure",
      "message failure",
      "bounce",
    ])
  ) {
    return "outbound_message_failed";
  }

  if (
    includesAny(text, [
      "missed schedule",
      "missed appointment",
      "did not attend",
      "no show",
      "overdue schedule",
    ])
  ) {
    return "missed_schedule";
  }

  if (
    includesAny(text, [
      "vaccination schedule",
      "immunization schedule",
      "vaccine due",
      "due for vaccine",
      "upcoming dose",
      "schedule reminder",
    ])
  ) {
    return "vaccination_schedule";
  }

  if (includesAny(text, ["appointment", "booked", "rescheduled"])) {
    return "appointment";
  }

  if (
    includesAny(text, [
      "guardian registered",
      "guardian registration",
      "new guardian",
      "parent registered",
    ])
  ) {
    return "guardian_registration";
  }

  if (
    includesAny(text, [
      "infant registered",
      "infant registration",
      "new infant",
      "newborn",
      "child registered",
      "baby registered",
    ])
  ) {
    return "infant_registration";
  }

  if (
    includesAny(text, [
      "report generated",
      "report ready",
      "report notification",
      "analytics export",
      "summary report",
    ])
  ) {
    return "report";
  }

  if (
    includesAny(text, [
      "announcement",
      "system maintenance",
      "scheduled maintenance",
      "system update",
      "platform notice",
      "downtime",
    ])
  ) {
    return "system_announcement";
  }

  return "general";
};

const resolveCategory = (raw, text) => {
  const explicit =
    mapExplicitCategory(raw?.category) ||
    mapExplicitCategory(raw?.notification_type) ||
    mapExplicitCategory(raw?.event_type) ||
    mapExplicitCategory(raw?.type);

  return explicit || inferCategoryFromText(text);
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
  const value =
    raw?.action_url || raw?.actionUrl || raw?.target_url || raw?.url || raw?.link;

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingItemIds, setMarkingItemIds] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (isGuardian) {
        const response = await guardianNotificationService.getNotifications({
          limit: 100,
        });
        setNotifications(extractNotificationArray(response));
      } else {
        const response = await apiClient.getNotifications({ limit: 100 });
        setNotifications(extractNotificationArray(response));
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setNotifications([]);
      setError("Failed to load notifications. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [isGuardian]);

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
  const isExternalUrl = (value) => /^https?:\/\//i.test(value);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Page Header - Fixed/Sticky at top */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Notifications"
          subtitle="Automation-focused notification center for appointments, schedules, stock risks, registrations, reports, announcements, and outbound delivery failures"
          icon={<Bell className="w-8 h-8 text-white" />}
          actions={
            <Button
              variant="secondary"
              onClick={handleMarkAllRead}
              loading={markingAllRead}
              disabled={markingAllRead || !hasData}
            >
              Mark All Read
            </Button>
          }
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 gap-4 sm:gap-6">
      {error && (
        <div className="flex-shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white/85 py-14 dark:border-slate-700 dark:bg-slate-900/70">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4 sm:gap-6">
          <div className="flex-shrink-0 space-y-4 sm:space-y-6">
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === "unread" ? "all" : "unread"))
              }
              aria-pressed={statusFilter === "unread"}
              className={`rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                statusFilter === "unread"
                  ? "border-violet-300 bg-violet-50/90 shadow-sm dark:border-violet-400/60 dark:bg-violet-500/15"
                  : "border-slate-200 bg-white/85 hover:border-violet-200 hover:bg-violet-50/40 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-violet-400/30 dark:hover:bg-violet-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Unread
                </p>
                <span className="text-lg" aria-hidden="true">
                  🔔
                </span>
              </div>
              <p
                data-testid="summary-unread-count"
                className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100"
              >
                {unreadCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Newly generated alerts requiring acknowledgement.
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setSeverityFilter((prev) =>
                  prev === "critical" ? "all" : "critical",
                )
              }
              aria-pressed={severityFilter === "critical"}
              className={`rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                severityFilter === "critical"
                  ? "border-red-300 bg-red-50/90 shadow-sm dark:border-red-400/60 dark:bg-red-500/15"
                  : "border-slate-200 bg-white/85 hover:border-red-200 hover:bg-red-50/40 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-red-400/30 dark:hover:bg-red-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Critical
                </p>
                <span className="text-lg" aria-hidden="true">
                  🚨
                </span>
              </div>
              <p
                data-testid="summary-critical-count"
                className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100"
              >
                {criticalCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Critical events and failed outbound deliveries.
              </p>
            </button>
          </section>

          <Card className="border border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div>
                  <label
                    htmlFor="notifications-category-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Category
                  </label>
                  <select
                    id="notifications-category-filter"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {CATEGORY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="notifications-severity-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Severity
                  </label>
                  <select
                    id="notifications-severity-filter"
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {SEVERITY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="notifications-status-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Status
                  </label>
                  <select
                    id="notifications-status-filter"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="notifications-start-date"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="notifications-start-date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="notifications-end-date"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    id="notifications-end-date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing {filteredNotifications.length} of {adaptedNotifications.length} notifications
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setSeverityFilter("all");
                    setStatusFilter("all");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </Card>
          </div>

          <div className="flex-1 overflow-y-auto auto-hide-scrollbar pr-2 pb-2">

          {filteredNotifications.length === 0 ? (
            <Card className="border border-dashed border-slate-300 bg-white/80 p-8 text-center dark:border-slate-600 dark:bg-slate-900/70">
              <div className="text-3xl" aria-hidden="true">
                🔍
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                No notifications matched the active filters
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Adjust category, severity, or status filters to view other system-generated alerts.
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              {["Today", "This Week", "Earlier"].map((groupLabel) => {
                const groupItems = groupedNotifications[groupLabel];

                if (!groupItems.length) {
                  return null;
                }

                return (
                  <section key={groupLabel} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {groupLabel}
                      </h3>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200">
                        {groupItems.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {groupItems.map((notification) => {
                        const severityMeta =
                          SEVERITY_META[notification.severity] || SEVERITY_META.info;
                        const statusMeta =
                          STATUS_META[notification.status] || STATUS_META.new;
                        const canMarkAsRead =
                          !notification.isRead &&
                          notification.persistedId !== null &&
                          notification.persistedId !== undefined &&
                          notification.persistedId !== "";
                        const itemLoading = markingItemIds.includes(
                          String(notification.persistedId),
                        );

                        return (
                          <Card
                            key={notification.id}
                            className={`border transition-all ${
                              notification.isRead
                                ? "border-slate-200 bg-white/85 dark:border-slate-700 dark:bg-slate-900/70"
                                : "border-violet-200 bg-violet-50/50 shadow-sm dark:border-violet-400/35 dark:bg-violet-500/10"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${
                                  notification.severity === "critical"
                                    ? "border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/20"
                                    : "border-violet-200 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/20"
                                }`}
                                aria-hidden="true"
                              >
                                {notification.icon}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">
                                      {notification.title}
                                    </h4>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                      {notification.message}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {formatRelativeTimestamp(notification.timestamp)}
                                  </p>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200">
                                    {notification.categoryLabel}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityMeta.badgeClass}`}
                                  >
                                    {severityMeta.label}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
                                  >
                                    {statusMeta.label}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatAbsoluteTimestamp(notification.timestamp)}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {canMarkAsRead && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        handleMarkAsRead(notification.persistedId)
                                      }
                                      loading={itemLoading}
                                      disabled={itemLoading}
                                      aria-label={`Mark ${notification.title} as read`}
                                    >
                                      Mark as Read
                                    </Button>
                                  )}

                                  {notification.actionUrl && (
                                    <a
                                      href={notification.actionUrl}
                                      target={
                                        isExternalUrl(notification.actionUrl)
                                          ? "_blank"
                                          : undefined
                                      }
                                      rel={
                                        isExternalUrl(notification.actionUrl)
                                          ? "noreferrer"
                                          : undefined
                                      }
                                      className="inline-flex h-9 items-center rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
                                    >
                                      Open Source
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {!hasData && !loading && (
        <Card className="flex-shrink-0 border border-dashed border-slate-300 bg-white/80 p-8 text-center text-slate-600 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
          <div className="text-3xl" aria-hidden="true">
            🧭
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
            Notification feed is currently clear
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            System-generated alerts for appointments, vaccination schedules, inventory, registrations, reports, announcements, and outbound delivery failures will appear here.
          </p>
        </Card>
      )}
      </div>
    </div>
  );
};

export default Notifications;
