import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Assessment,
  CalendarToday,
  Download,
  ErrorOutline,
  Female,
  Inventory2,
  LocalHospital,
  Male,
  People,
  Refresh,
  Warning,
} from "@mui/icons-material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { useLocation, useSearchParams } from "react-router-dom";
import apiClient from "../utils/api";
import { useSocket } from "../contexts/SocketContext";
import { useTheme as useAppTheme } from "../contexts/ThemeContext";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";

const VACCINE_OPTIONS = [
  { value: "ALL", label: "All Vaccines" },
  { value: "BCG", label: "BCG" },
  { value: "HEPB", label: "Hepatitis B" },
  { value: "PENTA", label: "Pentavalent" },
  { value: "OPV", label: "Oral Polio (OPV)" },
  { value: "IPV", label: "Inactivated Polio (IPV)" },
  { value: "PCV", label: "Pneumococcal Conjugate (PCV)" },
  { value: "MMR", label: "MMR" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Date Range" },
];

const ANALYTICS_TAB_CONFIG = [
  { key: "overview", label: "Overview" },
  { key: "vaccination-analytics", label: "Vaccination Analytics" },
  { key: "appointments-follow-up", label: "Appointments & Follow-up" },
  { key: "inventory-reminders", label: "Inventory & Reminders" },
  { key: "demographics-activity", label: "Demographics & Activity" },
];

const ANALYTICS_DEFAULT_TAB_KEY = ANALYTICS_TAB_CONFIG[0].key;
const ANALYTICS_TAB_STORAGE_KEY = "admin.analytics.activeTab";
const ANALYTICS_CANONICAL_PATH = "/analytics";
const ANALYTICS_TAB_KEY_SET = new Set(ANALYTICS_TAB_CONFIG.map((tab) => tab.key));

const normalizeAnalyticsTabKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  return ANALYTICS_TAB_KEY_SET.has(normalized) ? normalized : null;
};

const getStoredAnalyticsTabKey = () => {
  const sessionTab = normalizeAnalyticsTabKey(safeSessionStorage.getItem(ANALYTICS_TAB_STORAGE_KEY));
  if (sessionTab) {
    return sessionTab;
  }

  return normalizeAnalyticsTabKey(safeLocalStorage.getItem(ANALYTICS_TAB_STORAGE_KEY));
};

const normalizeAnalyticsTabIndex = (index) => {
  const parsed = Number.parseInt(index, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= ANALYTICS_TAB_CONFIG.length) {
    return 0;
  }

  return parsed;
};

const buildNextTabSearchParams = (nextTabKey) => {
  const normalizedTabKey = normalizeAnalyticsTabKey(nextTabKey) || ANALYTICS_DEFAULT_TAB_KEY;
  const next = new URLSearchParams();
  next.set("tab", normalizedTabKey);
  return next;
};

const isCanonicalAnalyticsSearch = (search, tabKey) => {
  const normalizedTabKey = normalizeAnalyticsTabKey(tabKey);
  if (!normalizedTabKey) {
    return false;
  }

  const params = new URLSearchParams(search);
  if (normalizeAnalyticsTabKey(params.get("tab")) !== normalizedTabKey) {
    return false;
  }

  params.delete("tab");
  return Array.from(params.keys()).length === 0;
};

const persistAnalyticsTabKey = (tabKey) => {
  const normalized = normalizeAnalyticsTabKey(tabKey);
  if (!normalized) {
    return;
  }

  safeSessionStorage.setItem(ANALYTICS_TAB_STORAGE_KEY, normalized);
  safeLocalStorage.setItem(ANALYTICS_TAB_STORAGE_KEY, normalized);
};

const CHART_THEME = {
  palette: {
    primary: "#5B8DEF",
    secondary: "#00B8A9",
    warning: "#FFC857",
    danger: "#E66A6A",
    violet: "#8E7CFF",
    sky: "#3FA7D6",
    lime: "#9CCC65",
    male: "#4F7CFF",
    female: "#A56EFF",
  },
  layout: {
    margin: { left: 8, right: 12, top: 12, bottom: 8 },
    gridDash: "4 6",
    barRadius: [10, 10, 0, 0],
    horizontalBarRadius: [0, 10, 10, 0],
    pieCornerRadius: 10,
  },
};

const GENDER_VISUAL_COLORS = Object.freeze({
  female: "#EC4899",
  male: "#3B82F6",
});

const REPORT_SHORTCUT_GENERATION_MAP = Object.freeze({
  "vaccination-summary": { type: "vaccination", format: "pdf" },
  "appointments-followup": { type: "appointment", format: "csv" },
  "inventory-status": { type: "inventory", format: "excel" },
  "sms-reminder-log": { type: "consolidated", format: "csv" },
});

const SHORTCUT_FORMAT_ALIASES = Object.freeze({
  pdf: "pdf",
  csv: "csv",
  excel: "excel",
  xlsx: "excel",
});

const SHORTCUT_FORMAT_EXTENSION = Object.freeze({
  pdf: "pdf",
  csv: "csv",
  excel: "xlsx",
});

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ABBREVIATIONS = Object.freeze([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);

const padDatePart = (value) => String(value).padStart(2, "0");

const buildLocalDate = (year, monthIndex, day) => {
  const date = new Date(year, monthIndex, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseLocalDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return buildLocalDate(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  const dateOnlyMatch = text.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return buildLocalDate(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return buildLocalDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toLocalDateKey = (value) => {
  const date = parseLocalDateValue(value);
  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

const toMonthDayLabel = (value) => {
  const normalizedKey = toLocalDateKey(value);
  const match = normalizedKey.match(DATE_ONLY_PATTERN);
  if (!match) {
    return String(value || "");
  }

  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return `${MONTH_ABBREVIATIONS[monthIndex] || ""} ${day}`.trim();
};

const formatDateToIsoDay = (value) => {
  return toLocalDateKey(value);
};

const resolveShortcutDateRange = (filters = {}) => {
  const period = String(filters.period || "month").toLowerCase();

  if (period === "custom") {
    return {
      startDate: filters.startDate || "",
      endDate: filters.endDate || "",
    };
  }

  const end = new Date();
  const today = parseLocalDateValue(end) || end;

  const start = new Date(today);
  if (period === "today") {
    // same-day report range
  } else if (period === "week") {
    start.setDate(start.getDate() - 6);
  } else {
    start.setFullYear(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    startDate: formatDateToIsoDay(start),
    endDate: formatDateToIsoDay(today),
  };
};

const normalizeShortcutReportFormat = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return SHORTCUT_FORMAT_ALIASES[normalized] || null;
};

const resolveShortcutGenerationConfig = (report = {}) => {
  const normalizedKey = String(report?.key || "").trim().toLowerCase();
  const mapped = REPORT_SHORTCUT_GENERATION_MAP[normalizedKey] || null;

  if (mapped) {
    return {
      type: mapped.type,
      format: normalizeShortcutReportFormat(report?.format) || mapped.format,
    };
  }

  const reportType = String(report?.reportType || "").trim().toLowerCase() || "consolidated";
  return {
    type: reportType,
    format: normalizeShortcutReportFormat(report?.format) || "pdf",
  };
};

const extractFilenameFromContentDisposition = (contentDisposition = "") => {
  const value = String(contentDisposition || "");
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
  }

  const filenameMatch = value.match(/filename=([^;]+)/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim().replace(/^"|"$/g, "");
  }

  return "";
};

const formatTrendLabelTick = (value) => {
  const text = String(value || "");
  if (!text) {
    return "";
  }

  if (text.length <= 10) {
    return text;
  }

  return `${text.slice(0, 10)}…`;
};

const splitWords = (text = "") => String(text).trim().split(/\s+/).filter(Boolean);

const wrapTickLabel = (value, maxLineLength = 14, maxLines = 2) => {
  const words = splitWords(value);
  if (!words.length) {
    return "";
  }

  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLineLength) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = word;
      return;
    }

    lines.push(word.slice(0, maxLineLength));
    current = word.length > maxLineLength ? `${word.slice(maxLineLength)}` : "";
  });

  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const capped = lines.slice(0, maxLines);
    const last = capped[maxLines - 1];
    capped[maxLines - 1] = last.length > maxLineLength - 1
      ? `${last.slice(0, maxLineLength - 1)}…`
      : `${last}…`;
    return capped;
  }

  return lines;
};

const renderInventoryXAxisTick = ({ x, y, payload, viewportWidth, axisColor }) => {
  const label = String(payload?.value || "");
  const isNarrow = viewportWidth < 640;
  const isMedium = viewportWidth >= 640 && viewportWidth < 960;
  const wrapped = wrapTickLabel(label, isNarrow ? 9 : isMedium ? 11 : 14, 2);
  const lineHeight = 12;

  if (isNarrow) {
    const compact = label.length > 12 ? `${label.slice(0, 12)}…` : label;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={14}
          fill={axisColor}
          textAnchor="end"
          transform="rotate(-32)"
          fontSize={11}
          fontWeight={500}
        >
          {compact}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      {(Array.isArray(wrapped) ? wrapped : [wrapped]).map((line, index) => (
        <text
          key={`${label}-${index}`}
          x={0}
          y={0}
          dy={14 + index * lineHeight}
          fill={axisColor}
          textAnchor="middle"
          fontSize={11}
          fontWeight={500}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

const PIE_COLORS = [
  CHART_THEME.palette.primary,
  CHART_THEME.palette.secondary,
  CHART_THEME.palette.warning,
  CHART_THEME.palette.danger,
  CHART_THEME.palette.violet,
  CHART_THEME.palette.sky,
  CHART_THEME.palette.lime,
];

const ANALYTICS_DARK_UI = Object.freeze({
  pageBg: "#0F172A",
  filterBg: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.88) 100%)",
  cardBg: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(17,24,39,0.94) 100%)",
  baseSurface: "#0F172A",
  panelSurface: "rgba(30,41,59,0.82)",
  panelSurfaceStrong: "rgba(30,41,59,0.92)",
  fieldBg: "rgba(15,23,42,0.86)",
  border: "rgba(148,163,184,0.28)",
  strongBorder: "rgba(148,163,184,0.4)",
  divider: "rgba(71,85,105,0.74)",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  buttonBorder: "rgba(96,165,250,0.58)",
  buttonBg: "rgba(30,41,59,0.74)",
  buttonBgHover: "rgba(30,58,138,0.45)",
  buttonText: "#BFDBFE",
  chipBg: "rgba(15,23,42,0.9)",
  chipOutlinedBg: "rgba(30,41,59,0.68)",
  successBg: "rgba(22,101,52,0.32)",
  successBorder: "rgba(74,222,128,0.44)",
  successText: "#BBF7D0",
  iconHover: "rgba(59,130,246,0.14)",
});

const buildAnalyticsCardSx = ({
  isDark,
  background,
  borderColor,
  shadow,
  height = "100%",
  borderRadius = 2,
}) => ({
  height,
  borderRadius,
  overflow: "hidden",
  border: "1px solid",
  borderColor,
  background,
  backgroundColor: isDark ? ANALYTICS_DARK_UI.baseSurface : "#FFFFFF",
  boxShadow: shadow,
});

const buildAnalyticsAlertSx = (isDark, severity = "info") => {
  if (!isDark) {
    return {};
  }

  const tones = {
    success: {
      backgroundColor: "rgba(6,95,70,0.24)",
      borderColor: "rgba(52,211,153,0.36)",
      textColor: "#D1FAE5",
      iconColor: "#6EE7B7",
    },
    info: {
      backgroundColor: "rgba(30,58,138,0.24)",
      borderColor: "rgba(96,165,250,0.36)",
      textColor: "#DBEAFE",
      iconColor: "#93C5FD",
    },
    warning: {
      backgroundColor: "rgba(146,64,14,0.28)",
      borderColor: "rgba(251,191,36,0.38)",
      textColor: "#FEF3C7",
      iconColor: "#FCD34D",
    },
    error: {
      backgroundColor: "rgba(127,29,29,0.3)",
      borderColor: "rgba(248,113,113,0.38)",
      textColor: "#FEE2E2",
      iconColor: "#FCA5A5",
    },
  };

  const tone = tones[severity] || tones.info;

  return {
    border: "1px solid",
    backgroundColor: tone.backgroundColor,
    borderColor: tone.borderColor,
    color: tone.textColor,
    "& .MuiAlert-icon": {
      color: tone.iconColor,
    },
    "& .MuiAlert-action .MuiButton-root": {
      color: tone.textColor,
      fontWeight: 700,
    },
    "& .MuiAlert-message": {
      fontWeight: 600,
    },
  };
};

const getSelectMenuProps = (isDark) => ({
  // Keep MUI Select menu in portal to preserve valid anchor positioning.
  // Backdrop is kept non-blocking so legacy global styles cannot mimic navigation overlays.
  disablePortal: false,
  keepMounted: false,
  hideBackdrop: true,
  disableScrollLock: true,
  transitionDuration: 0,
  slotProps: {
    backdrop: {
      invisible: true,
    },
    paper: {
      sx: (theme) => ({
        maxHeight: 320,
        zIndex: theme.zIndex.modal + 2,
        background: isDark ? ANALYTICS_DARK_UI.filterBg : theme.palette.background.paper,
        backgroundColor: isDark ? ANALYTICS_DARK_UI.baseSurface : theme.palette.background.paper,
        border: "1px solid",
        borderColor: isDark ? ANALYTICS_DARK_UI.strongBorder : "divider",
        boxShadow: isDark ? "0 18px 38px rgba(2,6,23,0.46)" : "0 14px 30px rgba(15,23,42,0.12)",
        "& .MuiMenuItem-root": {
          mx: 0.75,
          my: 0.25,
          borderRadius: 1.5,
          color: isDark ? ANALYTICS_DARK_UI.textSecondary : theme.palette.text.primary,
          "&:hover": {
            backgroundColor: isDark ? ANALYTICS_DARK_UI.panelSurface : theme.palette.action.hover,
          },
          "&.Mui-selected": {
            backgroundColor: isDark ? "rgba(37,99,235,0.24)" : "rgba(219,234,254,0.86)",
            color: isDark ? ANALYTICS_DARK_UI.textPrimary : theme.palette.text.primary,
          },
          "&.Mui-selected:hover": {
            backgroundColor: isDark ? "rgba(37,99,235,0.34)" : "rgba(191,219,254,0.92)",
          },
        },
      }),
    },
  },
  BackdropProps: {
    invisible: true,
  },
  PaperProps: {
    sx: (theme) => ({
      maxHeight: 320,
      zIndex: theme.zIndex.modal + 2,
      background: isDark ? ANALYTICS_DARK_UI.filterBg : theme.palette.background.paper,
      backgroundColor: isDark ? ANALYTICS_DARK_UI.baseSurface : theme.palette.background.paper,
      border: "1px solid",
      borderColor: isDark ? ANALYTICS_DARK_UI.strongBorder : "divider",
      boxShadow: isDark ? "0 18px 38px rgba(2,6,23,0.46)" : "0 14px 30px rgba(15,23,42,0.12)",
    }),
  },
});

const blurActiveElementIfNeeded = () => {
  if (typeof document === "undefined") {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
};

const safeNum = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeArray = (...candidates) => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

const normalizeObject = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return {};
};

const toTitleCase = (value = "") => {
  return String(value)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toDateLabel = (value) => {
  if (!value) return "";
  return toMonthDayLabel(value);
};

const normalizeResponsePayload = (response) => {
  if (!response) return null;

  if (response.success && response.data) {
    return response.data;
  }

  if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return response.data;
  }

  if (typeof response === "object" && !Array.isArray(response)) {
    return response;
  }

  return null;
};

const ensureDefaultAgeGroups = (ageGroups = []) => {
  const defaultOrder = [
    "0-5 months",
    "6-11 months",
    "12-23 months",
    "24+ months",
  ];

  const normalizedByKey = new Map(
    (Array.isArray(ageGroups) ? ageGroups : []).map((item) => [
      String(item?.group || "").trim().toLowerCase(),
      {
        group: item?.group || "Unknown",
        count: safeNum(item?.count),
      },
    ]),
  );

  return defaultOrder.map((group) => {
    const matched = normalizedByKey.get(group.toLowerCase());
    return matched || { group, count: 0 };
  });
};

const ensureDefaultGenderGroups = (genderRows = []) => {
  const defaults = [
    { label: "Male", count: 0 },
    { label: "Female", count: 0 },
    { label: "Other / Not specified", count: 0 },
  ];

  const map = new Map();

  (Array.isArray(genderRows) ? genderRows : []).forEach((item) => {
    const rawLabel = String(item?.label || "Unknown").trim();
    const normalized = rawLabel.toLowerCase().replace(/\./g, "").trim();
    const canonicalLabel =
      normalized === "m" || normalized.startsWith("mal")
        ? "Male"
        : normalized === "f" || normalized.startsWith("fem")
          ? "Female"
          : rawLabel || "Other / Not specified";

    const previous = map.get(canonicalLabel) || 0;
    map.set(canonicalLabel, previous + safeNum(item?.count));
  });

  return defaults.map((entry) => ({
    label: entry.label,
    count: map.has(entry.label) ? safeNum(map.get(entry.label)) : entry.count,
  }));
};

const normalizeGenderSnapshot = (genderRows = []) => {
  const normalized = ensureDefaultGenderGroups(genderRows);
  const maleCount = safeNum(normalized.find((item) => item.label === "Male")?.count);
  const femaleCount = safeNum(normalized.find((item) => item.label === "Female")?.count);
  const otherCount = safeNum(normalized.find((item) => item.label === "Other / Not specified")?.count);
  const total = maleCount + femaleCount + otherCount;
  const pairTotal = maleCount + femaleCount;
  const femalePercent = pairTotal > 0 ? Math.round((femaleCount / pairTotal) * 100) : 0;
  const malePercent = pairTotal > 0 ? 100 - femalePercent : 0;

  return {
    maleCount,
    femaleCount,
    otherCount,
    total,
    pairTotal,
    femalePercent,
    malePercent,
    hasActualValues: total > 0,
  };
};

const statusLabel = (value = "") => {
  const normalized = String(value).replace(/[_-]/g, " ").trim();
  if (!normalized) return "Unknown";
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toShortDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const resolveAlertTone = (severity, isDark) => {
  const normalized = String(severity || "warning").toLowerCase();

  if (normalized === "critical" || normalized === "error") {
    return {
      label: "Critical",
      accent: isDark ? "#FCA5A5" : "#DC2626",
      chipBg: isDark ? "rgba(239,68,68,0.22)" : "rgba(254,226,226,0.92)",
      chipText: isDark ? "#FECACA" : "#991B1B",
      cardBg: isDark
        ? "linear-gradient(135deg, rgba(127,29,29,0.34) 0%, rgba(153,27,27,0.24) 100%)"
        : "linear-gradient(135deg, rgba(254,242,242,0.94) 0%, rgba(254,226,226,0.94) 100%)",
      border: isDark ? "rgba(252,165,165,0.46)" : "rgba(248,113,113,0.44)",
    };
  }

  return {
    label: "Warning",
    accent: isDark ? "#FCD34D" : "#B45309",
    chipBg: isDark ? "rgba(245,158,11,0.22)" : "rgba(254,243,199,0.92)",
    chipText: isDark ? "#FDE68A" : "#92400E",
    cardBg: isDark
      ? "linear-gradient(135deg, rgba(146,64,14,0.34) 0%, rgba(180,83,9,0.24) 100%)"
      : "linear-gradient(135deg, rgba(255,251,235,0.95) 0%, rgba(254,243,199,0.95) 100%)",
    border: isDark ? "rgba(252,211,77,0.46)" : "rgba(245,158,11,0.4)",
  };
};

const resolveActivityTone = (type, isDark) => {
  const normalized = String(type || "activity").toLowerCase();

  if (normalized.includes("appointment")) {
    return {
      badgeBg: isDark ? "rgba(59,130,246,0.28)" : "rgba(219,234,254,0.92)",
      badgeText: isDark ? "#BFDBFE" : "#1D4ED8",
      cardBg: isDark ? "rgba(30,58,138,0.22)" : "rgba(239,246,255,0.82)",
      border: isDark ? "rgba(96,165,250,0.34)" : "rgba(147,197,253,0.5)",
    };
  }

  if (normalized.includes("vaccination") || normalized.includes("immun")) {
    return {
      badgeBg: isDark ? "rgba(16,185,129,0.28)" : "rgba(209,250,229,0.92)",
      badgeText: isDark ? "#A7F3D0" : "#047857",
      cardBg: isDark ? "rgba(6,95,70,0.2)" : "rgba(236,253,245,0.84)",
      border: isDark ? "rgba(52,211,153,0.34)" : "rgba(134,239,172,0.52)",
    };
  }

  if (normalized.includes("inventory") || normalized.includes("stock")) {
    return {
      badgeBg: isDark ? "rgba(245,158,11,0.28)" : "rgba(254,243,199,0.92)",
      badgeText: isDark ? "#FDE68A" : "#B45309",
      cardBg: isDark ? "rgba(146,64,14,0.2)" : "rgba(255,251,235,0.84)",
      border: isDark ? "rgba(252,211,77,0.34)" : "rgba(245,158,11,0.44)",
    };
  }

  return {
    badgeBg: isDark ? "rgba(148,163,184,0.26)" : "rgba(241,245,249,0.92)",
    badgeText: isDark ? "#CBD5E1" : "#334155",
    cardBg: isDark ? "rgba(30,41,59,0.34)" : "rgba(248,250,252,0.84)",
    border: isDark ? "rgba(148,163,184,0.3)" : "rgba(203,213,225,0.72)",
  };
};

const resolveChartAppearance = (isDark) => {

  return {
    isDark,
    cardBackground: isDark
      ? ANALYTICS_DARK_UI.cardBg
      : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    cardBorder: isDark ? ANALYTICS_DARK_UI.border : "rgba(148,163,184,0.24)",
    cardShadow: isDark ? "0 18px 38px rgba(2,6,23,0.46)" : "0 14px 30px rgba(15,23,42,0.08)",
    plotBackground: isDark
      ? "linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(17,24,39,0.72) 100%)"
      : "rgba(248,250,252,0.82)",
    plotBorder: isDark ? "rgba(148,163,184,0.24)" : "rgba(148,163,184,0.25)",
    gridStroke: isDark ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.20)",
    axisLine: isDark ? "rgba(148,163,184,0.32)" : "rgba(100,116,139,0.30)",
    axisTick: isDark ? ANALYTICS_DARK_UI.textSecondary : "#475569",
    tooltipBackground: isDark ? "rgba(15,23,42,0.98)" : "rgba(255,255,255,0.98)",
    tooltipBorder: isDark ? ANALYTICS_DARK_UI.strongBorder : "rgba(148,163,184,0.35)",
    tooltipTitle: isDark ? ANALYTICS_DARK_UI.textPrimary : "#0F172A",
    tooltipText: isDark ? ANALYTICS_DARK_UI.textSecondary : "#334155",
    legendBackground: isDark ? "rgba(30,41,59,0.82)" : "rgba(248,250,252,0.88)",
    legendBorder: isDark ? "rgba(148,163,184,0.28)" : "rgba(148,163,184,0.34)",
    legendText: isDark ? ANALYTICS_DARK_UI.textSecondary : "#334155",
    centerLabel: isDark ? ANALYTICS_DARK_UI.textMuted : "#64748B",
    centerValue: isDark ? ANALYTICS_DARK_UI.textPrimary : "#0F172A",
  };
};

const DashboardChartTooltip = ({ active, payload, label, chartAppearance, valueFormatter }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: chartAppearance.tooltipBorder,
        background: chartAppearance.tooltipBackground,
        boxShadow: "0 10px 24px rgba(15,23,42,0.2)",
        minWidth: 170,
      }}
    >
      {label !== undefined && label !== null && label !== "" ? (
        <Typography variant="caption" sx={{ color: chartAppearance.tooltipTitle, fontWeight: 700, mb: 0.5, display: "block" }}>
          {label}
        </Typography>
      ) : null}

      <Box sx={{ display: "grid", gap: 0.35 }}>
        {payload.map((entry, index) => {
          const resolvedName = entry?.name || entry?.dataKey || "Value";
          const resolvedValue = valueFormatter
            ? valueFormatter(entry?.value, resolvedName, entry)
            : safeNum(entry?.value).toLocaleString();

          return (
            <Box key={`${resolvedName}-${index}`} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                component="span"
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: entry?.color || CHART_THEME.palette.primary,
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" sx={{ color: chartAppearance.tooltipText, fontWeight: 600 }}>
                {resolvedName}:
              </Typography>
              <Typography variant="caption" sx={{ color: chartAppearance.tooltipText, ml: "auto" }}>
                {resolvedValue}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const DashboardLegend = ({ payload = [], chartAppearance, justifyContent = "center" }) => {
  if (!payload.length) {
    return null;
  }

  return (
    <Box
      sx={{
        pt: 1,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent,
        gap: 0.75,
      }}
    >
      {payload.map((entry, index) => (
        <Box
          key={`${entry?.value || "legend"}-${index}`}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.35,
            borderRadius: 999,
            border: "1px solid",
            borderColor: chartAppearance.legendBorder,
            background: chartAppearance.legendBackground,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: entry?.color || CHART_THEME.palette.primary,
            }}
          />
          <Typography variant="caption" sx={{ color: chartAppearance.legendText, fontWeight: 600 }}>
            {entry?.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const mapDashboardPayload = (payload) => {
  const summary = normalizeObject(payload?.summary, payload?.kpis, payload?.overview);
  const vaccinationAnalytics = normalizeObject(
    payload?.vaccinationAnalytics,
    payload?.vaccinations,
    payload?.immunization,
  );
  const appointmentFollowup = normalizeObject(
    payload?.appointmentFollowup,
    payload?.appointments,
    payload?.followup,
  );
  const inventory = normalizeObject(payload?.inventory, payload?.stockInventory);
  const reminders = normalizeObject(payload?.reminders, payload?.sms, payload?.notifications);
  const demographics = normalizeObject(payload?.demographics, payload?.demographicAnalytics);
  const trends = normalizeObject(payload?.trends, payload?.timeline, payload?.dailyTrends);
  const metadata = normalizeObject(payload?.metadata, payload?.meta);
  const validatedMetrics = normalizeObject(payload?.validatedMetrics, payload?.metrics);

  const summaryLowStock =
    summary.lowStockVaccines ??
    summary.lowStockCount ??
    validatedMetrics.lowStockVaccines ??
    inventory.lowStockCount ??
    inventory.lowStockVaccines;

  const summaryAvailableDoses =
    summary.totalAvailableVaccineDoses ??
    summary.availableDoses ??
    validatedMetrics.availableDoses ??
    inventory.totalAvailableDoses ??
    inventory.availableDoses;

  const summaryPendingAppointments =
    summary.pendingAppointments ??
    summary.pendingAppointmentCount ??
    validatedMetrics.pendingAppointments ??
    appointmentFollowup.pending;

  const summaryVaccinationsToday =
    summary.vaccinationsCompletedToday ??
    summary.vaccinationsToday ??
    validatedMetrics.vaccinationsToday ??
    summary.completedToday;

  const summaryDueForVaccination =
    summary.infantsDueForVaccination ??
    summary.dueForVaccination ??
    validatedMetrics.dueForVaccination ??
    summary.vaccinationsDue;

  const summaryOverdueVaccinations =
    summary.overdueVaccinations ??
    summary.overdueVaccinationCount ??
    validatedMetrics.overdueVaccinations ??
    summary.overdue;

  const summaryTotalInfants =
    summary.totalRegisteredInfants ??
    summary.totalInfants ??
    validatedMetrics.totalInfants ??
    demographics?.coverage?.infants;

  const summaryTotalGuardians =
    summary.totalGuardians ??
    summary.guardians ??
    validatedMetrics.totalGuardians ??
    demographics?.coverage?.guardians;

  const kpis = {
    totalInfants: safeNum(summaryTotalInfants),
    totalGuardians: safeNum(summaryTotalGuardians),
    vaccinationsToday: safeNum(summaryVaccinationsToday),
    dueForVaccination: safeNum(summaryDueForVaccination),
    overdueVaccinations: safeNum(summaryOverdueVaccinations),
    pendingAppointments: safeNum(summaryPendingAppointments),
    lowStockVaccines: safeNum(summaryLowStock),
    availableDoses: safeNum(summaryAvailableDoses),
  };

  const vaccineProgress = normalizeArray(
    vaccinationAnalytics.vaccineProgress,
    vaccinationAnalytics.progress,
    vaccinationAnalytics.byVaccine,
    payload?.vaccineProgress,
  ).map((item) => {
    const dosesAdministered = item.dosesAdministered ?? item.administered ?? item.completed ?? item.count;
    const dueCount = item.dueCount ?? item.due ?? item.pendingDue;
    const overdueCount = item.overdueCount ?? item.overdue ?? item.overdueDue;
    const infantsCovered = item.infantsCovered ?? item.coveredInfants ?? item.covered;

    const totalPopulation =
      item.totalPopulation ??
      item.targetPopulation ??
      item.totalInfants ??
      item.expected ??
      null;

    const inferredCoverageRate =
      item.coverageRate ??
      item.coverage_percentage ??
      item.coveragePercent ??
      (safeNum(totalPopulation) > 0
        ? (safeNum(infantsCovered || dosesAdministered) / safeNum(totalPopulation)) * 100
        : null);

    return {
      vaccineKey: item.vaccineKey || item.vaccine_code || item.vaccineId || item.vaccine || "",
      vaccineName:
        item.vaccineName ||
        item.vaccine_label ||
        item.name ||
        toTitleCase(item.vaccine || item.vaccine_code || "Unknown"),
      infantsCovered: safeNum(infantsCovered),
      dosesAdministered: safeNum(dosesAdministered),
      dueCount: safeNum(dueCount),
      overdueCount: safeNum(overdueCount),
      coverageRate: Math.max(0, Math.min(100, safeNum(inferredCoverageRate))),
    };
  });

  const vaccinationStatusBreakdown = normalizeArray(
    vaccinationAnalytics.statusBreakdown,
    vaccinationAnalytics.status,
    payload?.vaccinationStatusBreakdown,
  ).map((item) => ({
        status: statusLabel(item.status),
        count: safeNum(item.count ?? item.value ?? item.total),
      }));

  const appointmentStatusBreakdown = normalizeArray(
    appointmentFollowup.statusBreakdown,
    appointmentFollowup.status,
    payload?.appointmentStatusBreakdown,
  ).map((item) => ({
        status: statusLabel(item.status),
        count: safeNum(item.count ?? item.value ?? item.total),
      }));

  const rawVaccinationTrend = normalizeArray(
    trends.vaccination,
    trends.vaccinations,
    trends.vaccinationTrend,
    payload?.vaccinationTrend,
  );

  const rawAppointmentTrend = normalizeArray(
    trends.appointments,
    trends.appointment,
    trends.appointmentTrend,
    payload?.appointmentTrend,
  );

  const trendVaccinations = rawVaccinationTrend.map((point) => {
    const dateValue = point.date || point.day || point.period || point.timestamp || null;
    return {
      label: point.label || point.name || toDateLabel(dateValue),
      date: dateValue,
      count: safeNum(point.count ?? point.total ?? point.value),
    };
  });

  const trendAppointments = rawAppointmentTrend.map((point) => {
    const dateValue = point.date || point.day || point.period || point.timestamp || null;
    return {
      label: point.label || point.name || toDateLabel(dateValue),
      date: dateValue,
      count: safeNum(point.count ?? point.total ?? point.value),
    };
  });

  const demographicsAgeGroups = normalizeArray(
    demographics.ageGroups,
    demographics.ageDistribution,
    demographics.byAge,
  ).map((item) => ({
        group: item.label || item.group || item.age_group || item.ageGroup || "Unknown",
        count: safeNum(item.count ?? item.total ?? item.value ?? item.infants),
      }));

  const demographicsGender = normalizeArray(
    demographics.genderBreakdown,
    demographics.gender,
    demographics.genderDistribution,
  ).map((item) => ({
        label: item.label || item.gender || item.sex || item.name || "Unknown",
        count: safeNum(item.count ?? item.total ?? item.value ?? item.infants),
      }));

  const normalizedAgeGroups = ensureDefaultAgeGroups(demographicsAgeGroups);
  const normalizedGenderGroups = ensureDefaultGenderGroups(demographicsGender);

  const activity = normalizeArray(payload?.recentActivity, payload?.activity, payload?.activityFeed);
  const explicitAlerts = normalizeArray(payload?.alerts);
  const criticalAlertsFallback = normalizeArray(payload?.criticalAlerts);
  const alerts = explicitAlerts.length > 0 ? explicitAlerts : criticalAlertsFallback;
  const reportShortcuts = normalizeArray(payload?.reportShortcuts, payload?.reports);
  const inventoryByVaccine = normalizeArray(inventory.byVaccine, inventory.vaccines, inventory.breakdown);

  const normalizedScope =
    metadata?.scope?.locality ||
    metadata?.scopeLabel ||
    payload?.scopeLabel ||
    payload?.scope ||
    "Current health center scope";

  const normalizedGeneratedAt = metadata?.generatedAt || metadata?.generated_at || payload?.generatedAt || null;

  return {
    raw: payload,
    scopeLabel: normalizedScope,
    generatedAt: normalizedGeneratedAt,
    kpis,
    vaccineProgress,
    vaccinationStatusBreakdown,
    appointmentStatusBreakdown,
    trendVaccinations,
    trendAppointments,
    demographicsAgeGroups: normalizedAgeGroups,
    demographicsGender: normalizedGenderGroups,
    inventory: {
      totalItems: safeNum(inventory.totalItems ?? inventory.count),
      totalAvailableDoses: safeNum(inventory.totalAvailableDoses ?? inventory.availableDoses),
      lowStockCount: safeNum(inventory.lowStockCount ?? inventory.lowStockVaccines),
      criticalStockCount: safeNum(inventory.criticalStockCount ?? inventory.criticalStockVaccines),
      outOfStockCount: safeNum(inventory.outOfStockCount ?? inventory.outOfStockVaccines),
      byVaccine: inventoryByVaccine.map((item) => ({
        vaccineName: item.vaccineName || item.vaccineKey || "Unknown",
        availableDoses: safeNum(item.availableDoses ?? item.stock ?? item.count),
        lowStock: Boolean(item.lowStock),
        criticalStock: Boolean(item.criticalStock),
      })),
    },
    appointmentFollowup: {
      totalInPeriod: safeNum(appointmentFollowup.totalInPeriod ?? appointmentFollowup.total),
      today: safeNum(appointmentFollowup.today ?? appointmentFollowup.todayCount),
      attended: safeNum(appointmentFollowup.attended ?? appointmentFollowup.completed),
      pending: safeNum(appointmentFollowup.pending),
      cancelled: safeNum(appointmentFollowup.cancelled ?? appointmentFollowup.canceled),
      upcoming7Days: safeNum(appointmentFollowup.upcoming7Days ?? appointmentFollowup.upcoming),
      overdueFollowUps: safeNum(appointmentFollowup.overdueFollowUps ?? appointmentFollowup.overdue),
      followUpsToday: safeNum(appointmentFollowup.followUpsToday ?? appointmentFollowup.followupToday),
      followUpsInPeriod: safeNum(
        appointmentFollowup.followUpsInPeriod ?? appointmentFollowup.followupInPeriod,
      ),
    },
    reminders: {
      smsSent: safeNum(reminders.smsSent ?? reminders.sent),
      smsDelivered: safeNum(reminders.smsDelivered ?? reminders.delivered),
      smsFailed: safeNum(reminders.smsFailed ?? reminders.failed),
      deliveryRate: safeNum(reminders.deliveryRate ?? reminders.rate),
      unreadNotifications: safeNum(reminders.unreadNotifications ?? reminders.unread),
      failedSmsCount: safeNum(reminders.failedSmsCount ?? reminders.failed),
    },
    demographicsCoverage: {
      infants: safeNum(demographics?.coverage?.infants ?? demographics?.coverageInfants),
      guardians: safeNum(demographics?.coverage?.guardians ?? demographics?.coverageGuardians),
    },
    activity: activity.map((item, index) => ({
      id: item.id || `activity-${index}`,
      type: item.type || item.category || "activity",
      title: item.title || item.name || statusLabel(item.type || item.category || "Activity"),
      description: item.description || item.message || item.details || "",
      severity: item.severity || item.level || "info",
      timestamp: item.timestamp || item.activity_at || item.createdAt || item.updatedAt || null,
    })),
    alerts: alerts.map((item, index) => ({
      id: item.id || `alert-${index}`,
      severity: item.severity || item.level || "warning",
      type: item.type || item.category || "alert",
      message: item.message || item.description || item.title || "Alert",
      timestamp: item.timestamp || item.alert_at || item.createdAt || null,
    })),
    reportShortcuts,
  };
};

const FilterBar = ({
  filters,
  onChange,
  onRefresh,
  onExport,
  loading,
  liveSyncEnabled,
  autoRefresh,
  onAutoRefreshToggle,
  isDark,
  scopeLabel,
}) => {
  const surfaceBg = isDark
    ? ANALYTICS_DARK_UI.filterBg
    : "background.paper";
  const surfaceBorder = isDark ? ANALYTICS_DARK_UI.strongBorder : "divider";
  const labelColor = isDark ? ANALYTICS_DARK_UI.textSecondary : "#475569";
  const helperColor = isDark ? ANALYTICS_DARK_UI.textMuted : "#64748B";
  const fieldOutlineDefault = isDark ? ANALYTICS_DARK_UI.strongBorder : "rgba(148,163,184,0.35)";
  const selectMenuProps = useMemo(() => getSelectMenuProps(isDark), [isDark]);

  return (
    <Card
      sx={{
        ...buildAnalyticsCardSx({
          isDark,
          background: surfaceBg,
          borderColor: surfaceBorder,
          shadow: isDark ? "0 16px 34px rgba(2,6,23,0.42)" : "0 8px 22px rgba(15,23,42,0.06)",
          height: "auto",
          borderRadius: 2,
        }),
        mb: 0,
        '& .MuiCardContent-root': {
          backgroundColor: isDark ? "rgba(15,23,42,0.16)" : "transparent",
        },
        "& .MuiInputLabel-root": {
          color: helperColor,
          fontWeight: 500,
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: isDark ? "#93C5FD" : "primary.main",
        },
        "& .MuiOutlinedInput-root": {
          color: isDark ? ANALYTICS_DARK_UI.textPrimary : "text.primary",
          backgroundColor: isDark ? ANALYTICS_DARK_UI.fieldBg : "transparent",
          backdropFilter: isDark ? "blur(10px)" : "none",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: fieldOutlineDefault,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: isDark ? "rgba(191,219,254,0.42)" : "rgba(100,116,139,0.56)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: isDark ? "#60A5FA" : "primary.main",
          },
        },
        "& .MuiSelect-icon": {
          color: labelColor,
        },
        "& .MuiChip-outlined": {
          borderColor: isDark ? ANALYTICS_DARK_UI.border : "divider",
          color: labelColor,
          bgcolor: isDark ? ANALYTICS_DARK_UI.chipOutlinedBg : "transparent",
        },
        "& .MuiChip-colorSuccess": {
          color: isDark ? ANALYTICS_DARK_UI.successText : undefined,
          borderColor: isDark ? ANALYTICS_DARK_UI.successBorder : undefined,
          bgcolor: isDark ? ANALYTICS_DARK_UI.successBg : undefined,
        },
        "& .MuiFormControlLabel-label": {
          color: labelColor,
          fontWeight: 500,
        },
      }}
    >
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, lg: 9 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="analytics-period-label">Period</InputLabel>
                  <Select
                    labelId="analytics-period-label"
                    value={filters.period}
                    label="Period"
                    MenuProps={selectMenuProps}
                    onChange={(event) => onChange("period", event.target.value)}
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="analytics-vaccine-label">Vaccine</InputLabel>
                  <Select
                    labelId="analytics-vaccine-label"
                    value={filters.vaccineType}
                    label="Vaccine"
                    MenuProps={selectMenuProps}
                    onChange={(event) => onChange("vaccineType", event.target.value)}
                  >
                    {VACCINE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="analytics-status-label">Vaccination Status</InputLabel>
                  <Select
                    labelId="analytics-status-label"
                    value={filters.vaccinationStatus}
                    label="Vaccination Status"
                    MenuProps={selectMenuProps}
                    onChange={(event) => onChange("vaccinationStatus", event.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {filters.period === "custom" && (
                <>
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <TextField
                      type="date"
                      size="small"
                      fullWidth
                      label="Start Date"
                      value={filters.startDate || ""}
                      onChange={(event) => onChange("startDate", event.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <TextField
                      type="date"
                      size="small"
                      fullWidth
                      label="End Date"
                      value={filters.endDate || ""}
                      onChange={(event) => onChange("endDate", event.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>

          <Grid size={{ xs: 12, lg: 3 }}>
            <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", lg: "flex-end" }, gap: 1 }}>
              <Tooltip title="Refresh analytics now">
                <span>
                  <IconButton
                    onClick={onRefresh}
                    disabled={loading}
                    color="primary"
                    aria-label="Refresh analytics"
                    sx={isDark ? {
                      color: "#60A5FA",
                      border: "1px solid rgba(96,165,250,0.18)",
                      "&:hover": {
                        backgroundColor: ANALYTICS_DARK_UI.iconHover,
                      },
                    } : undefined}
                  >
                    <Refresh />
                  </IconButton>
                </span>
              </Tooltip>

              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={onExport}
                disabled={loading}
                sx={isDark ? {
                  borderColor: ANALYTICS_DARK_UI.buttonBorder,
                  backgroundColor: ANALYTICS_DARK_UI.buttonBg,
                  color: ANALYTICS_DARK_UI.buttonText,
                  "&:hover": {
                    borderColor: "#60A5FA",
                    backgroundColor: ANALYTICS_DARK_UI.buttonBgHover,
                  },
                } : undefined}
              >
                Export CSV
              </Button>
            </Box>
          </Grid>

          <Grid size={12}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  color={liveSyncEnabled ? "success" : "default"}
                  label={liveSyncEnabled ? "Real-time updates active" : "Polling fallback active"}
                  sx={isDark && !liveSyncEnabled ? {
                    fontWeight: 700,
                    color: ANALYTICS_DARK_UI.textSecondary,
                    backgroundColor: ANALYTICS_DARK_UI.chipBg,
                    border: "1px solid",
                    borderColor: ANALYTICS_DARK_UI.border,
                  } : isDark ? { fontWeight: 700 } : undefined}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={scopeLabel || "Current health center scope"}
                  sx={isDark ? {
                    fontWeight: 600,
                    color: ANALYTICS_DARK_UI.textSecondary,
                    borderColor: ANALYTICS_DARK_UI.border,
                    backgroundColor: ANALYTICS_DARK_UI.chipOutlinedBg,
                  } : undefined}
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={autoRefresh}
                    onChange={(event) => onAutoRefreshToggle(event.target.checked)}
                    sx={isDark ? {
                      "& .MuiSwitch-track": {
                        backgroundColor: "rgba(71,85,105,0.9)",
                        opacity: 1,
                      },
                      "& .MuiSwitch-thumb": {
                        backgroundColor: "#E2E8F0",
                      },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                        backgroundColor: "#2563EB",
                        opacity: 1,
                      },
                    } : undefined}
                  />
                }
                label="Auto-refresh"
              />
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const KpiCard = ({ title, value, subtitle, icon, color = "primary", loading, isDark }) => {
  const Icon = icon;
  const displayValue = typeof value === "number" ? safeNum(value).toLocaleString() : String(value ?? "0");
  const surfaceBg = isDark
    ? ANALYTICS_DARK_UI.cardBg
    : "background.paper";
  const surfaceBorder = isDark ? ANALYTICS_DARK_UI.border : "divider";
  const titleColor = isDark ? ANALYTICS_DARK_UI.textSecondary : "text.secondary";
  const subtitleColor = isDark ? ANALYTICS_DARK_UI.textMuted : "text.secondary";
  const valueColor = isDark ? ANALYTICS_DARK_UI.textPrimary : "text.primary";

  return (
    <Card
      sx={{
        ...buildAnalyticsCardSx({
          isDark,
          background: surfaceBg,
          borderColor: surfaceBorder,
          shadow: isDark ? "0 14px 28px rgba(2,6,23,0.38)" : "0 6px 16px rgba(15,23,42,0.06)",
        }),
        '& .MuiCardContent-root': {
          backgroundColor: isDark ? 'rgba(15,23,42,0.72)' : 'transparent',
        },
      }}
    >
      <CardContent
        sx={{
          backgroundColor: isDark ? 'rgba(15,23,42,0.72)' : 'transparent',
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" sx={{ color: titleColor }}>
            {title}
          </Typography>
          <Icon color={color} fontSize="small" />
        </Box>

        {loading ? (
          <>
            <Skeleton width="60%" height={36} />
            <Skeleton width="80%" />
          </>
        ) : (
          <>
            <Typography variant="h4" sx={{ fontWeight: 700, color: valueColor }}>
              {displayValue}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" sx={{ color: subtitleColor }}>
                {subtitle}
              </Typography>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const KpiSummaryGrid = ({ data, loading, isDark }) => {
  const kpis = data?.kpis || {};
  const reminders = data?.reminders || {};

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Total Registered Infants"
          value={kpis.totalInfants}
          subtitle="Barangay scope"
          icon={People}
          color="primary"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Total Guardians"
          value={kpis.totalGuardians}
          subtitle="Linked to active infants"
          icon={People}
          color="info"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Vaccinations Completed Today"
          value={kpis.vaccinationsToday}
          subtitle="Completed or attended"
          icon={LocalHospital}
          color="success"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Infants Due for Vaccination"
          value={kpis.dueForVaccination}
          subtitle={`${safeNum(kpis.overdueVaccinations)} overdue`}
          icon={Warning}
          color="warning"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Pending Appointments"
          value={kpis.pendingAppointments}
          subtitle="Scheduled / confirmed / rescheduled"
          icon={CalendarToday}
          color="info"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Low-stock Vaccines"
          value={kpis.lowStockVaccines}
          subtitle="Needs replenishment"
          icon={Inventory2}
          color="error"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Available Vaccine Doses"
          value={kpis.availableDoses}
          subtitle="Current stock on hand"
          icon={Inventory2}
          color="success"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="SMS Reminder Delivery Rate"
          value={`${safeNum(reminders.deliveryRate).toFixed(1)}%`}
          subtitle={`${safeNum(reminders.smsDelivered)} delivered / ${safeNum(reminders.smsSent)} sent`}
          icon={Assessment}
          color="primary"
          loading={loading}
          isDark={isDark}
        />
      </Grid>
    </Grid>
  );
};

const ChartCard = ({
  title,
  subtitle,
  loading,
  empty,
  emptyMessage,
  children,
  ariaLabel,
  chartAppearance,
  chartHeight = 300,
}) => {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        border: "1px solid",
        borderColor: chartAppearance.cardBorder,
        background: chartAppearance.cardBackground,
        boxShadow: chartAppearance.cardShadow,
        overflow: "hidden",
        '& .MuiCardContent-root': {
          backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
        },
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.25 },
          backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.72)' : 'transparent',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.01em", color: chartAppearance.isDark ? '#FFFFFF' : 'text.primary' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.5, color: chartAppearance.isDark ? '#94A3B8' : 'text.secondary' }}>
            {subtitle}
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }} />
        )}

        {loading ? (
          <Skeleton variant="rectangular" height={chartHeight} sx={{ borderRadius: 2.5 }} />
        ) : empty ? (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              minHeight: chartHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed",
              borderColor: chartAppearance.plotBorder,
              borderRadius: 2.5,
              background: chartAppearance.plotBackground,
              color: "text.secondary",
              textAlign: "center",
              px: 2,
            }}
          >
            {emptyMessage || "No records available for current filters."}
          </Box>
        ) : (
          <Box
            role="img"
            aria-label={ariaLabel}
            sx={{
              minHeight: chartHeight,
              borderRadius: 2.5,
              border: "1px solid",
              borderColor: chartAppearance.plotBorder,
              background: chartAppearance.plotBackground,
              p: { xs: 1, sm: 1.5 },
            }}
          >
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const VaccineProgressSection = ({ data, loading, chartAppearance }) => {
  const rows = data?.vaccineProgress || [];
  const axisTick = { fill: chartAppearance.axisTick, fontSize: 12, fontWeight: 500 };
  const axisLine = { stroke: chartAppearance.axisLine };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <ChartCard
          title="Vaccine-specific Immunization Progress"
          subtitle="Coverage across BCG, HepB, Pentavalent, OPV, IPV, PCV, and MMR"
          loading={loading}
          empty={rows.length === 0}
          ariaLabel="Bar chart of doses administered, due count, and overdue count by vaccine type"
          chartAppearance={chartAppearance}
          chartHeight={320}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rows} margin={CHART_THEME.layout.margin} barGap={10}>
              <CartesianGrid
                stroke={chartAppearance.gridStroke}
                strokeDasharray={CHART_THEME.layout.gridDash}
                vertical={false}
              />
              <XAxis dataKey="vaccineName" tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <RechartsTooltip
                cursor={{ fill: chartAppearance.isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.12)" }}
                content={<DashboardChartTooltip chartAppearance={chartAppearance} />}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                content={(legendProps) => <DashboardLegend {...legendProps} chartAppearance={chartAppearance} />}
              />
              <Bar
                dataKey="dosesAdministered"
                name="Doses Administered"
                fill={CHART_THEME.palette.primary}
                radius={CHART_THEME.layout.barRadius}
                maxBarSize={38}
              />
              <Bar
                dataKey="dueCount"
                name="Due"
                fill={CHART_THEME.palette.warning}
                radius={CHART_THEME.layout.barRadius}
                maxBarSize={38}
              />
              <Bar
                dataKey="overdueCount"
                name="Overdue"
                fill={CHART_THEME.palette.danger}
                radius={CHART_THEME.layout.barRadius}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <ChartCard
          title="Coverage Rate by Vaccine"
          subtitle="Unique infant coverage percentage"
          loading={loading}
          empty={rows.length === 0}
          ariaLabel="Horizontal bar chart of infant coverage rate by vaccine"
          chartAppearance={chartAppearance}
          chartHeight={320}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 16, top: 12, bottom: 8 }}>
              <CartesianGrid
                stroke={chartAppearance.gridStroke}
                strokeDasharray={CHART_THEME.layout.gridDash}
                vertical={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                unit="%"
                tick={axisTick}
                axisLine={axisLine}
                tickLine={axisLine}
              />
              <YAxis
                type="category"
                dataKey="vaccineName"
                width={128}
                tick={axisTick}
                axisLine={axisLine}
                tickLine={axisLine}
              />
              <RechartsTooltip
                cursor={{ fill: chartAppearance.isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.12)" }}
                content={
                  <DashboardChartTooltip
                    chartAppearance={chartAppearance}
                    valueFormatter={(value) => `${safeNum(value).toFixed(1)}%`}
                  />
                }
              />
              <Bar
                dataKey="coverageRate"
                fill={CHART_THEME.palette.secondary}
                name="Coverage Rate (%)"
                radius={CHART_THEME.layout.horizontalBarRadius}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
    </Grid>
  );
};

const AppointmentAndFollowupSection = ({ data, loading, chartAppearance }) => {
  const appointment = data?.appointmentFollowup || {};
  const statusData = data?.appointmentStatusBreakdown || [];
  const appointmentTotal = statusData.reduce((total, entry) => total + safeNum(entry.count), 0);
  const surfaceBg = chartAppearance.isDark
    ? ANALYTICS_DARK_UI.cardBg
    : "background.paper";
  const surfaceBorder = chartAppearance.isDark ? ANALYTICS_DARK_UI.border : "divider";

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card
          sx={{
            ...buildAnalyticsCardSx({
              isDark: chartAppearance.isDark,
              background: surfaceBg,
              borderColor: surfaceBorder,
              shadow: chartAppearance.isDark
                ? "0 16px 32px rgba(2,6,23,0.42)"
                : "0 8px 18px rgba(15,23,42,0.06)",
            }),
            '& .MuiCardContent-root': {
              backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            },
          }}
        >
          <CardContent
            sx={{
              backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: chartAppearance.isDark ? '#FFFFFF' : 'text.primary' }}>
              Appointment and Follow-up Summary
            </Typography>

            {loading ? (
              <Grid container spacing={1.5}>
                {[...Array(6)].map((_, index) => (
                  <Grid size={6} key={index}>
                    <Skeleton height={64} sx={{ borderRadius: 1 }} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={1.5}>
                <Grid size={6}>
                  <SummaryMiniCard label="Total In Period" value={appointment.totalInPeriod} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Today" value={appointment.today} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Upcoming (7 Days)" value={appointment.upcoming7Days} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Overdue Follow-ups" value={appointment.overdueFollowUps} error isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Follow-ups Today" value={appointment.followUpsToday} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Follow-ups in Period" value={appointment.followUpsInPeriod} isDark={chartAppearance.isDark} />
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard
          title="Appointment Status Distribution"
          subtitle="Current filtered appointment outcomes"
          loading={loading}
          empty={statusData.length === 0}
          ariaLabel="Pie chart of appointment statuses"
          chartAppearance={chartAppearance}
          chartHeight={300}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                innerRadius={70}
                outerRadius={106}
                paddingAngle={2}
                cornerRadius={CHART_THEME.layout.pieCornerRadius}
                stroke={chartAppearance.plotBackground}
                strokeWidth={2}
              >
                {statusData.map((_, index) => (
                  <Cell key={`appointment-status-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip content={<DashboardChartTooltip chartAppearance={chartAppearance} />} />
              <Legend
                verticalAlign="bottom"
                align="center"
                content={(legendProps) => <DashboardLegend {...legendProps} chartAppearance={chartAppearance} />}
              />
              <text
                x="50%"
                y="46%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={chartAppearance.centerLabel}
                fontSize="12"
                fontWeight="600"
              >
                Total
              </text>
              <text
                x="50%"
                y="56%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={chartAppearance.centerValue}
                fontSize="24"
                fontWeight="700"
              >
                {appointmentTotal.toLocaleString()}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
    </Grid>
  );
};

const InventorySection = ({ data, loading, chartAppearance, viewportWidth }) => {
  const inventory = data?.inventory || {};
  const rows = inventory.byVaccine || [];
  const axisTick = { fill: chartAppearance.axisTick, fontSize: 12, fontWeight: 500 };
  const axisLine = { stroke: chartAppearance.axisLine };
  const mobileLayout = viewportWidth < 640;
  const tabletLayout = viewportWidth >= 640 && viewportWidth < 960;
  const surfaceBg = chartAppearance.isDark
    ? ANALYTICS_DARK_UI.cardBg
    : "background.paper";
  const surfaceBorder = chartAppearance.isDark ? ANALYTICS_DARK_UI.border : "divider";

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card
          sx={{
            ...buildAnalyticsCardSx({
              isDark: chartAppearance.isDark,
              background: surfaceBg,
              borderColor: surfaceBorder,
              shadow: chartAppearance.isDark
                ? "0 16px 32px rgba(2,6,23,0.42)"
                : "0 8px 18px rgba(15,23,42,0.06)",
            }),
            '& .MuiCardContent-root': {
              backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            },
          }}
        >
          <CardContent
            sx={{
              backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: chartAppearance.isDark ? '#FFFFFF' : 'text.primary' }}>
              Vaccine Inventory Summary            </Typography>
            {loading ? (
              <>
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </>
            ) : (
              <Grid container spacing={1.5}>
                <Grid size={6}>
                  <SummaryMiniCard label="Total Inventory Items" value={inventory.totalItems} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Available Doses" value={inventory.totalAvailableDoses} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Low-stock" value={inventory.lowStockCount} error isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Critical-stock" value={inventory.criticalStockCount} error isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={12}>
                  <SummaryMiniCard label="Out-of-stock" value={inventory.outOfStockCount} error isDark={chartAppearance.isDark} />
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }}>
        <ChartCard
          title="Available Doses by Vaccine"
          subtitle="Live inventory stock per vaccine type"
          loading={loading}
          empty={rows.length === 0}
          ariaLabel="Bar chart showing available doses by vaccine"
          chartAppearance={chartAppearance}
          chartHeight={300}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={rows}
              margin={{
                left: 8,
                right: 12,
                top: 12,
                bottom: mobileLayout ? 58 : tabletLayout ? 44 : 36,
              }}
              barCategoryGap={mobileLayout ? "30%" : "24%"}
            >
              <CartesianGrid
                stroke={chartAppearance.gridStroke}
                strokeDasharray={CHART_THEME.layout.gridDash}
                vertical={false}
              />
              <XAxis
                dataKey="vaccineName"
                interval={0}
                height={mobileLayout ? 76 : tabletLayout ? 64 : 56}
                tickLine={false}
                axisLine={axisLine}
                tick={(tickProps) => renderInventoryXAxisTick({
                  ...tickProps,
                  viewportWidth,
                  axisColor: chartAppearance.axisTick,
                })}
              />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <RechartsTooltip
                cursor={{ fill: chartAppearance.isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.12)" }}
                content={<DashboardChartTooltip chartAppearance={chartAppearance} />}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                payload={[
                  { value: "Healthy Stock", color: CHART_THEME.palette.secondary, type: "circle" },
                  { value: "Low Stock", color: CHART_THEME.palette.warning, type: "circle" },
                  { value: "Critical Stock", color: CHART_THEME.palette.danger, type: "circle" },
                ]}
                content={(legendProps) => <DashboardLegend {...legendProps} chartAppearance={chartAppearance} />}
              />
              <Bar
                dataKey="availableDoses"
                name="Available Doses"
                radius={CHART_THEME.layout.barRadius}
                maxBarSize={40}
              >
                {rows.map((entry, index) => {
                  const fill = entry.criticalStock
                    ? CHART_THEME.palette.danger
                    : entry.lowStock
                      ? CHART_THEME.palette.warning
                      : CHART_THEME.palette.secondary;

                  return <Cell key={`inventory-cell-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
    </Grid>
  );
};

const GenderStatRing = ({
  label,
  count,
  percent,
  color,
  chartAppearance,
  IconComponent,
}) => {
  const normalizedPercent = Math.max(0, Math.min(100, safeNum(percent)));
  const arcDegrees = normalizedPercent * 3.6;
  const trackColor = chartAppearance.isDark ? "rgba(148,163,184,0.24)" : "rgba(148,163,184,0.30)";
  const ringInnerBackground = chartAppearance.isDark
    ? "rgba(15,23,42,0.92)"
    : "rgba(255,255,255,0.96)";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 132 }}>
      <Box
        sx={{
          width: { xs: 132, sm: 152 },
          height: { xs: 132, sm: 152 },
          borderRadius: "50%",
          background: `conic-gradient(${color} 0deg ${arcDegrees}deg, ${trackColor} ${arcDegrees}deg 360deg)`,
          p: "10px",
          boxShadow: chartAppearance.isDark
            ? "0 10px 24px rgba(2,6,23,0.35)"
            : "0 10px 24px rgba(15,23,42,0.14)",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            bgcolor: ringInnerBackground,
            border: "1px solid",
            borderColor: chartAppearance.plotBorder,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid",
              borderColor: `${color}55`,
              bgcolor: chartAppearance.isDark ? "rgba(30,41,59,0.85)" : "rgba(248,250,252,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 0.65,
            }}
          >
            <IconComponent sx={{ fontSize: 30, color }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1, color }}>
            {`${normalizedPercent}%`}
          </Typography>
        </Box>
      </Box>

      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 800,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: chartAppearance.axisTick, fontWeight: 700 }}>
        {`${safeNum(count).toLocaleString()} infant${safeNum(count) === 1 ? "" : "s"}`}
      </Typography>
      <Typography variant="caption" sx={{ color: chartAppearance.axisTick, fontWeight: 600 }}>
        {`${normalizedPercent}% ${label}`}
      </Typography>
    </Box>
  );
};

const SmsAndDemographicsSection = ({
  data,
  loading,
  chartAppearance,
  showGenderChart = false,
  genderError = "",
}) => {
  const reminder = data?.reminders || {};
  const genderSnapshot = normalizeGenderSnapshot(data?.demographicsGender || []);
  const {
    femaleCount,
    maleCount,
    otherCount,
    total: genderTotal,
    pairTotal: femaleMaleTotal,
    femalePercent,
    malePercent,
    hasActualValues: genderHasActualValues,
  } = genderSnapshot;
  const hasGenderError = Boolean(genderError) && !genderHasActualValues;

  const summaryGridSize = showGenderChart ? { xs: 12, lg: 6 } : { xs: 12 };
  const surfaceBg = chartAppearance.isDark
    ? ANALYTICS_DARK_UI.cardBg
    : "background.paper";
  const surfaceBorder = chartAppearance.isDark ? ANALYTICS_DARK_UI.border : "divider";

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={summaryGridSize}>
        <Card
          sx={{
            ...buildAnalyticsCardSx({
              isDark: chartAppearance.isDark,
              background: surfaceBg,
              borderColor: surfaceBorder,
              shadow: chartAppearance.isDark
                ? "0 16px 32px rgba(2,6,23,0.42)"
                : "0 8px 18px rgba(15,23,42,0.06)",
            }),
            '& .MuiCardContent-root': {
              backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            },
          }}
        >
          <CardContent
            sx={{
              backgroundColor: chartAppearance.isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: chartAppearance.isDark ? '#FFFFFF' : 'text.primary' }}>
              SMS Reminder Analytics            </Typography>
            {loading ? (
              <>
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
              </>
            ) : (
              <Grid container spacing={1.5}>
                <Grid size={6}>
                  <SummaryMiniCard label="SMS Sent" value={reminder.smsSent} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="SMS Delivered" value={reminder.smsDelivered} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="SMS Failed" value={reminder.smsFailed} error isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Delivery Rate" value={`${safeNum(reminder.deliveryRate).toFixed(1)}%`} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Unread Notifications" value={reminder.unreadNotifications} isDark={chartAppearance.isDark} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Failed SMS Count" value={reminder.failedSmsCount} error isDark={chartAppearance.isDark} />
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      {showGenderChart ? (
        <Grid size={{ xs: 12, lg: 6 }}>
          <ChartCard
            title="Male vs Female Distribution"
            subtitle="Registered infant gender composition"
            loading={loading}
            empty={false}
            ariaLabel="Gender distribution infographic showing female and male infant percentages"
            chartAppearance={chartAppearance}
            chartHeight={320}
          >
            <Box sx={{ width: "100%", height: 320, display: "flex", flexDirection: "column" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  flexWrap: "wrap",
                  mb: 1.5,
                }}
              >
                <Chip
                  size="small"
                  color={hasGenderError ? "warning" : genderHasActualValues ? "success" : "default"}
                  variant={hasGenderError ? "filled" : "outlined"}
                  label={hasGenderError
                    ? "Data unavailable"
                    : genderHasActualValues
                      ? "Live demographic split"
                      : "No records yet"}
                />
                <Typography variant="caption" sx={{ color: chartAppearance.axisTick, fontWeight: 700 }}>
                  {`Total infants: ${safeNum(genderTotal).toLocaleString()}`}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexDirection: { xs: "column", sm: "row" },
                  gap: { xs: 1.5, sm: 1 },
                }}
              >
                <GenderStatRing
                  label="Female"
                  count={femaleCount}
                  percent={femalePercent}
                  color={GENDER_VISUAL_COLORS.female}
                  chartAppearance={chartAppearance}
                  IconComponent={Female}
                />

                <Box
                  sx={{
                    px: 1,
                    py: 0.5,
                    textAlign: "center",
                    minWidth: { xs: "100%", sm: 100 },
                  }}
                >
                  <Typography variant="caption" sx={{ color: chartAppearance.centerLabel, fontWeight: 700 }}>
                    Female vs Male
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      color: chartAppearance.centerValue,
                      lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                      my: 0.35,
                    }}
                  >
                    {`${femalePercent}% : ${malePercent}%`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: chartAppearance.axisTick, fontWeight: 600 }}>
                    {`${safeNum(femaleMaleTotal).toLocaleString()} profiled infants`}
                  </Typography>
                </Box>

                <GenderStatRing
                  label="Male"
                  count={maleCount}
                  percent={malePercent}
                  color={GENDER_VISUAL_COLORS.male}
                  chartAppearance={chartAppearance}
                  IconComponent={Male}
                />
              </Box>

              <Box sx={{ mt: 1.25 }}>
                {hasGenderError ? (
                  <Alert
                    severity="warning"
                    sx={{
                      ...buildAnalyticsAlertSx(chartAppearance.isDark, "warning"),
                      py: 0,
                      '& .MuiAlert-message': {
                        py: 0.45,
                        fontSize: 12,
                        fontWeight: 600,
                      },
                    }}
                  >
                    Unable to load gender analytics right now. Displaying safe defaults of 0% Female and 0% Male.
                  </Alert>
                ) : !genderHasActualValues ? (
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: chartAppearance.axisTick,
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    No demographic gender records were returned for the selected filters. Showing explicit 0% Female and 0% Male.
                  </Typography>
                ) : otherCount > 0 ? (
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: chartAppearance.axisTick,
                      textAlign: "center",
                    }}
                  >
                    {`${safeNum(otherCount).toLocaleString()} record${safeNum(otherCount) === 1 ? " is" : "s are"} marked as Other / Not specified and excluded from the Female vs Male percentage split.`}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          </ChartCard>
        </Grid>
      ) : null}
    </Grid>
  );
};

const TrendsSection = ({ data, loading, chartAppearance }) => {
  const vaxTrend = data?.trendVaccinations || [];
  const apptTrend = data?.trendAppointments || [];

  const hasVaxData = vaxTrend.length > 0;
  const hasApptData = apptTrend.length > 0;

  const axisTick = { fill: chartAppearance.axisTick, fontSize: 12, fontWeight: 500 };
  const axisLine = { stroke: chartAppearance.axisLine };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard
          title="Vaccination Trend"
          subtitle="Daily administered records within selected period"
          loading={loading}
          empty={vaxTrend.length === 0}
          emptyMessage="No timeline points available for the selected date range."
          ariaLabel="Line chart showing daily vaccination trend"
          chartAppearance={chartAppearance}
          chartHeight={280}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={vaxTrend} margin={CHART_THEME.layout.margin}>
              <CartesianGrid
                stroke={chartAppearance.gridStroke}
                strokeDasharray={CHART_THEME.layout.gridDash}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                tickFormatter={formatTrendLabelTick}
                tickMargin={8}
                minTickGap={14}
                tick={axisTick}
                axisLine={axisLine}
                tickLine={axisLine}
              />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <RechartsTooltip
                cursor={{ stroke: CHART_THEME.palette.secondary, strokeOpacity: 0.35 }}
                content={<DashboardChartTooltip chartAppearance={chartAppearance} />}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Vaccinations"
                stroke={CHART_THEME.palette.secondary}
                strokeWidth={3}
                connectNulls
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{
                  r: 2.5,
                  stroke: chartAppearance.plotBackground,
                  strokeWidth: 2,
                  fill: CHART_THEME.palette.secondary,
                }}
                activeDot={{ r: 6, fill: CHART_THEME.palette.secondary, strokeWidth: 0 }}
              />
              {!hasVaxData ? (
                <Line
                  type="monotone"
                  dataKey="count"
                  name="No vaccination activity"
                  stroke={CHART_THEME.palette.warning}
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard
          title="Appointment Trend"
          subtitle="Daily appointment volume within selected period"
          loading={loading}
          empty={apptTrend.length === 0}
          emptyMessage="No timeline points available for the selected date range."
          ariaLabel="Line chart showing daily appointment trend"
          chartAppearance={chartAppearance}
          chartHeight={280}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={apptTrend} margin={CHART_THEME.layout.margin}>
              <CartesianGrid
                stroke={chartAppearance.gridStroke}
                strokeDasharray={CHART_THEME.layout.gridDash}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                tickFormatter={formatTrendLabelTick}
                tickMargin={8}
                minTickGap={14}
                tick={axisTick}
                axisLine={axisLine}
                tickLine={axisLine}
              />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <RechartsTooltip
                cursor={{ stroke: CHART_THEME.palette.primary, strokeOpacity: 0.35 }}
                content={<DashboardChartTooltip chartAppearance={chartAppearance} />}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Appointments"
                stroke={CHART_THEME.palette.primary}
                strokeWidth={3}
                connectNulls
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{
                  r: 2.5,
                  stroke: chartAppearance.plotBackground,
                  strokeWidth: 2,
                  fill: CHART_THEME.palette.primary,
                }}
                activeDot={{ r: 6, fill: CHART_THEME.palette.primary, strokeWidth: 0 }}
              />
              {!hasApptData ? (
                <Line
                  type="monotone"
                  dataKey="count"
                  name="No appointment activity"
                  stroke={CHART_THEME.palette.warning}
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
    </Grid>
  );
};

const AlertsActivityReportsSection = ({
  data,
  loading,
  isDark,
  onReportShortcutDownload,
  shortcutLoadingKey,
}) => {
  const alerts = data?.alerts || [];
  const activity = data?.activity || [];
  const reports = data?.reportShortcuts || [];
  const surfaceBg = isDark
    ? ANALYTICS_DARK_UI.cardBg
    : "background.paper";
  const surfaceBorder = isDark ? ANALYTICS_DARK_UI.border : "divider";
  const headingColor = isDark ? ANALYTICS_DARK_UI.textPrimary : "text.primary";
  const subTextColor = isDark ? ANALYTICS_DARK_UI.textMuted : "text.secondary";

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Card
          sx={{
            ...buildAnalyticsCardSx({
              isDark,
              background: surfaceBg,
              borderColor: surfaceBorder,
              shadow: isDark ? "0 16px 32px rgba(2,6,23,0.42)" : "0 8px 18px rgba(15,23,42,0.06)",
            }),
            '& .MuiCardContent-root': {
              backgroundColor: isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            },
          }}
        >
          <CardContent
            sx={{
              backgroundColor: isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: headingColor }}>
              Critical Alerts
            </Typography>
            {loading ? (
              <>
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </>
            ) : alerts.length === 0 ? (
              <Alert severity="success" sx={buildAnalyticsAlertSx(isDark, "success")}>
                No critical alerts for current filters.
              </Alert>
            ) : (
              <Box sx={{ display: "grid", gap: 1.25 }}>
                {alerts.slice(0, 6).map((item) => (
                  (() => {
                    const tone = resolveAlertTone(item.severity, isDark);

                    return (
                  <Box
                    key={item.id}
                    sx={{
                      border: "1px solid",
                      borderColor: tone.border,
                      borderRadius: 2,
                      px: 1.25,
                      py: 1,
                      background: tone.cardBg,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.75 }}>
                      <Chip
                        size="small"
                        icon={<ErrorOutline sx={{ color: tone.accent }} fontSize="small" />}
                        label={tone.label}
                        sx={{
                          height: 24,
                          fontWeight: 700,
                          bgcolor: tone.chipBg,
                          color: tone.chipText,
                          border: "1px solid",
                          borderColor: tone.border,
                          '& .MuiChip-icon': {
                            ml: 0.5,
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: subTextColor, fontWeight: 600 }}>
                        {toShortDateTime(item.timestamp)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: headingColor, lineHeight: 1.4 }}>
                      {item.message}
                    </Typography>
                  </Box>
                    );
                  })()
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card
          sx={{
            ...buildAnalyticsCardSx({
              isDark,
              background: surfaceBg,
              borderColor: surfaceBorder,
              shadow: isDark ? "0 16px 32px rgba(2,6,23,0.42)" : "0 8px 18px rgba(15,23,42,0.06)",
            }),
            '& .MuiCardContent-root': {
              backgroundColor: isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            },
          }}
        >
          <CardContent
            sx={{
              backgroundColor: isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: headingColor }}>
              Recent Activity Feed
            </Typography>
            {loading ? (
              <>
                <Skeleton height={60} />
                <Skeleton height={60} />
                <Skeleton height={60} />
                <Skeleton height={60} />
              </>
            ) : activity.length === 0 ? (
              <Alert severity="info" sx={buildAnalyticsAlertSx(isDark, "info")}>
                No recent activity for current filter range.
              </Alert>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  maxHeight: 332,
                  overflowY: "auto",
                  pr: 0.5,
                  "&::-webkit-scrollbar": {
                    width: 8,
                  },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: isDark ? "rgba(148,163,184,0.36)" : "rgba(148,163,184,0.5)",
                    borderRadius: 999,
                  },
                }}
              >
                {activity.slice(0, 10).map((item) => (
                  (() => {
                    const tone = resolveActivityTone(item.type, isDark);

                    return (
                  <Box
                    key={item.id}
                    sx={{
                      border: "1px solid",
                      borderColor: tone.border,
                      borderRadius: 2,
                      p: 1.1,
                      background: tone.cardBg,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 0.6 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: headingColor, lineHeight: 1.35 }}>
                        {item.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={statusLabel(item.type)}
                        sx={{
                          height: 22,
                          borderRadius: 1,
                          bgcolor: tone.badgeBg,
                          color: tone.badgeText,
                          fontWeight: 700,
                          border: "1px solid",
                          borderColor: tone.border,
                          '& .MuiChip-label': {
                            px: 0.75,
                          },
                        }}
                      />
                    </Box>
                    {item.description ? (
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ color: subTextColor, lineHeight: 1.45, mb: 0.55 }}
                      >
                        {item.description}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" sx={{ color: subTextColor, fontWeight: 600 }}>
                      {toShortDateTime(item.timestamp)}
                    </Typography>
                  </Box>
                    );
                  })()
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 3 }}>
        <Card
          sx={{
            ...buildAnalyticsCardSx({
              isDark,
              background: surfaceBg,
              borderColor: surfaceBorder,
              shadow: isDark ? "0 16px 32px rgba(2,6,23,0.42)" : "0 8px 18px rgba(15,23,42,0.06)",
            }),
            '& .MuiCardContent-root': {
              backgroundColor: isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            },
          }}
        >
          <CardContent
            sx={{
              backgroundColor: isDark ? 'rgba(15,23,42,0.88)' : 'transparent',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: headingColor }}>
              Report Shortcuts
            </Typography>

            {loading ? (
              <>
                <Skeleton height={54} />
                <Skeleton height={54} />
                <Skeleton height={54} />
              </>
            ) : reports.length === 0 ? (
              <Alert severity="info" sx={buildAnalyticsAlertSx(isDark, "info")}>
                No report shortcuts available.
              </Alert>
            ) : (
              <Box sx={{ display: "grid", gap: 1 }}>
                {reports.map((report) => (
                  (() => {
                    const reportShortcutKey = String(report?.key || report?.title || "shortcut");
                    const isShortcutDownloading = shortcutLoadingKey === reportShortcutKey;

                    return (
                  <Button
                    key={reportShortcutKey}
                    variant="outlined"
                    size="small"
                    onClick={() => onReportShortcutDownload?.(report)}
                    disabled={isShortcutDownloading}
                    sx={{
                      justifyContent: "space-between",
                      textTransform: "none",
                      borderColor: isDark ? "rgba(96,165,250,0.58)" : "rgba(59,130,246,0.52)",
                      backgroundColor: isDark ? "rgba(30,41,59,0.48)" : "rgba(239,246,255,0.7)",
                      color: isDark ? "#BFDBFE" : "#1D4ED8",
                      '&:hover': {
                        borderColor: isDark ? "rgba(96,165,250,0.8)" : "rgba(37,99,235,0.72)",
                        backgroundColor: isDark ? "rgba(30,58,138,0.35)" : "rgba(219,234,254,0.85)",
                      },
                    }}
                    endIcon={isShortcutDownloading ? <Refresh fontSize="small" /> : <Download fontSize="small" />}
                  >
                    <Box sx={{ textAlign: "left" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {report.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: subTextColor }}>
                        {isShortcutDownloading ? "PREPARING…" : String(report.format || "").toUpperCase()}
                      </Typography>
                    </Box>
                  </Button>
                    );
                  })()
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

const SummaryMiniCard = ({ label, value, error = false, isDark = false }) => {
  const labelColor = isDark ? ANALYTICS_DARK_UI.textMuted : "text.secondary";
  const valueColor = error ? (isDark ? "#FCA5A5" : "error.main") : (isDark ? ANALYTICS_DARK_UI.textPrimary : "text.primary");

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: isDark ? ANALYTICS_DARK_UI.border : "divider",
        borderRadius: 2,
        p: 1.5,
        minHeight: 72,
        bgcolor: isDark ? ANALYTICS_DARK_UI.panelSurface : "rgba(248,250,252,0.72)",
      }}
    >
      <Typography variant="caption" sx={{ color: labelColor, display: "block" }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: valueColor }}>
        {typeof value === "number" ? safeNum(value).toLocaleString() : value}
      </Typography>
    </Box>
  );
};

const buildQueryParams = (filters) => {
  const params = {
    period: filters.period,
    vaccineType: filters.vaccineType,
    vaccinationStatus: filters.vaccinationStatus,
  };

  if (filters.period === "custom") {
    if (filters.startDate) {
      params.startDate = filters.startDate;
    }
    if (filters.endDate) {
      params.endDate = filters.endDate;
    }
  }

  return params;
};

const exportRowsToCsv = ({ data, filters }) => {
  const lines = [
    ["Category", "Metric", "Value"],
    ["Scope", "Facility", data?.scopeLabel || "Current health center scope"],
    ["Filters", "Period", filters.period],
    ["Filters", "Vaccine Type", filters.vaccineType],
    ["Filters", "Vaccination Status", filters.vaccinationStatus],
    ["Summary", "Total Registered Infants", safeNum(data?.kpis?.totalInfants)],
    ["Summary", "Total Guardians", safeNum(data?.kpis?.totalGuardians)],
    ["Summary", "Vaccinations Completed Today", safeNum(data?.kpis?.vaccinationsToday)],
    ["Summary", "Infants Due for Vaccination", safeNum(data?.kpis?.dueForVaccination)],
    ["Summary", "Overdue Vaccinations", safeNum(data?.kpis?.overdueVaccinations)],
    ["Summary", "Pending Appointments", safeNum(data?.kpis?.pendingAppointments)],
    ["Summary", "Low-stock Vaccines", safeNum(data?.kpis?.lowStockVaccines)],
    ["Summary", "Total Available Vaccine Doses", safeNum(data?.kpis?.availableDoses)],
  ];

  (data?.vaccineProgress || []).forEach((item) => {
    lines.push(["Vaccine Progress", `${item.vaccineName} - Doses Administered`, safeNum(item.dosesAdministered)]);
    lines.push(["Vaccine Progress", `${item.vaccineName} - Due`, safeNum(item.dueCount)]);
    lines.push(["Vaccine Progress", `${item.vaccineName} - Overdue`, safeNum(item.overdueCount)]);
    lines.push(["Vaccine Progress", `${item.vaccineName} - Coverage Rate (%)`, safeNum(item.coverageRate)]);
  });

  return lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
};

const AnalyticsDashboard = () => {
  const theme = useTheme();
  const { darkMode } = useAppTheme();
  const isDark = darkMode;
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTabletDown = useMediaQuery(theme.breakpoints.down("md"));
  const viewportWidth = isMobile ? 560 : isTabletDown ? 840 : 1200;
  const { on, off, connectionState } = useSocket();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    period: "month",
    vaccineType: "ALL",
    vaccinationStatus: "all",
    startDate: null,
    endDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshWarning, setRefreshWarning] = useState("");
  const [shortcutLoadingKey, setShortcutLoadingKey] = useState("");

  const pollRef = useRef(null);
  const sectionDividerSx = useMemo(
    () => ({ mb: 3, borderColor: isDark ? ANALYTICS_DARK_UI.divider : "divider" }),
    [isDark],
  );

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      if (!silent) {
        setError("");
      }
      setRefreshWarning("");
      const params = buildQueryParams(filters);
      const response = await apiClient.getAnalyticsDashboard(params);

      const normalizedPayload = normalizeResponsePayload(response);
      if (!normalizedPayload) {
        throw new Error(response?.error || "Failed to load analytics dashboard data");
      }

      setDashboardData(mapDashboardPayload(normalizedPayload));
    } catch (fetchError) {
      console.error("Analytics dashboard fetch error:", fetchError);
      const message = fetchError?.message || "Unable to load analytics data";

      if (silent) {
        setRefreshWarning(`Auto-refresh failed: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = null;
      return undefined;
    }

    pollRef.current = setInterval(() => {
      fetchDashboard({ silent: true });
    }, 30000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = null;
    };
  }, [autoRefresh, fetchDashboard]);

  useEffect(() => {
    const socketEvents = [
      "appointment_created",
      "appointment_updated",
      "appointment_deleted",
      "vaccination_created",
      "vaccination_updated",
      "vaccination_deleted",
      "inventory_item_created",
      "inventory_item_updated",
      "inventory_item_deleted",
      "vaccine_inventory_created",
      "vaccine_inventory_updated",
      "vaccine_inventory_transaction_created",
      "infant_created",
      "infant_updated",
      "infant_deleted",
      "guardian_created",
      "guardian_updated",
      "guardian_deleted",
    ];

    const listeners = socketEvents.map((eventName) => {
      const handler = () => {
        fetchDashboard({ silent: true });
      };
      on(eventName, handler);
      return { eventName, handler };
    });

    const windowListeners = [
      "appointment-update",
      "vaccination-update",
      "guardian-data-update",
      "child-data-update",
    ].map((eventName) => {
      const handler = () => fetchDashboard({ silent: true });
      window.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      listeners.forEach(({ eventName, handler }) => off(eventName, handler));
      windowListeners.forEach(({ eventName, handler }) => window.removeEventListener(eventName, handler));
    };
  }, [fetchDashboard, on, off, connectionState]);

  useEffect(() => {
    return () => {
      blurActiveElementIfNeeded();
    };
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((previous) => ({ ...previous, [field]: value }));
  };

  const handleManualRefresh = () => {
    fetchDashboard();
    setSnackbar({ open: true, message: "Analytics refreshed", severity: "success" });
  };

  const handleExport = () => {
    try {
      const csv = exportRowsToCsv({ data: dashboardData, filters });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `analytics-dashboard-${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSnackbar({ open: true, message: "Analytics CSV exported", severity: "success" });
    } catch (exportError) {
      console.error("Analytics export error:", exportError);
      setSnackbar({ open: true, message: "Export failed", severity: "error" });
    }
  };

  const handleReportShortcutDownload = useCallback(async (report) => {
    const shortcutKey = String(report?.key || report?.title || "report-shortcut");
    setShortcutLoadingKey(shortcutKey);

    try {
      const shortcutConfig = resolveShortcutGenerationConfig(report);
      const dateRange = resolveShortcutDateRange(filters);
      const reportFilters = {
        ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
        ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
      };

      if (filters.vaccineType && filters.vaccineType !== "ALL") {
        reportFilters.vaccineType = filters.vaccineType;
      }

      if (filters.vaccinationStatus && filters.vaccinationStatus !== "all") {
        reportFilters.status = filters.vaccinationStatus;
        reportFilters.vaccinationStatus = filters.vaccinationStatus;
      }

      const generationResponse = await apiClient.post("/reports/generate", {
        type: shortcutConfig.type,
        format: shortcutConfig.format,
        ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
        ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
        filters: reportFilters,
      });

      const generatedReportId = generationResponse?.data?.id || generationResponse?.id;
      if (!generatedReportId) {
        throw new Error("Report generation did not return a downloadable report identifier.");
      }

      const downloadResponse = await apiClient.customRequest(
        `/reports/${generatedReportId}/download`,
        {
          method: "GET",
          responseType: "blob",
        },
      );

      const contentDisposition =
        downloadResponse?.headers?.["content-disposition"] ||
        downloadResponse?.headers?.["Content-Disposition"] ||
        "";
      const resolvedFilename = extractFilenameFromContentDisposition(contentDisposition);
      const fallbackExtension = SHORTCUT_FORMAT_EXTENSION[shortcutConfig.format] || "dat";
      const fallbackFilename = `${shortcutConfig.type}-report.${fallbackExtension}`;
      const filename = resolvedFilename || fallbackFilename;

      const mimeType =
        downloadResponse?.headers?.["content-type"] ||
        downloadResponse?.headers?.["Content-Type"] ||
        "application/octet-stream";

      const responseData = downloadResponse?.data;
      const fileBlob = responseData instanceof Blob
        ? responseData
        : new Blob([responseData], { type: mimeType });

      const objectUrl = window.URL.createObjectURL(fileBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.setAttribute("download", filename);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(objectUrl);

      setSnackbar({
        open: true,
        message: `${report?.title || "Report"} downloaded`,
        severity: "success",
      });
    } catch (shortcutError) {
      console.error("Report shortcut download error:", shortcutError);
      const message = shortcutError?.message || "Unable to download report from shortcut.";
      setSnackbar({
        open: true,
        message,
        severity: /no data found/i.test(message) ? "info" : "error",
      });
    } finally {
      setShortcutLoadingKey("");
    }
  }, [filters]);

  const liveSyncEnabled = useMemo(() => connectionState === "connected", [connectionState]);
  const chartAppearance = useMemo(() => resolveChartAppearance(isDark), [isDark]);
  const tabFromUrl = useMemo(() => {
    const currentSearchParams = new URLSearchParams(location.search);
    return normalizeAnalyticsTabKey(currentSearchParams.get("tab"));
  }, [location.search]);

  const activeTabKey = useMemo(
    () => tabFromUrl || getStoredAnalyticsTabKey() || ANALYTICS_DEFAULT_TAB_KEY,
    [tabFromUrl],
  );

  const tab = useMemo(() => {
    const tabIndex = ANALYTICS_TAB_CONFIG.findIndex((entry) => entry.key === activeTabKey);
    return normalizeAnalyticsTabIndex(tabIndex);
  }, [activeTabKey]);

  useEffect(() => {
    const resolvedTabKey = tabFromUrl || getStoredAnalyticsTabKey() || ANALYTICS_DEFAULT_TAB_KEY;
    persistAnalyticsTabKey(resolvedTabKey);

    if (isCanonicalAnalyticsSearch(location.search, resolvedTabKey)) {
      return;
    }

    const nextParams = buildNextTabSearchParams(resolvedTabKey);
    setSearchParams(nextParams, { replace: true });
  }, [location.search, tabFromUrl, setSearchParams]);

  useEffect(() => {
    if (location.pathname === ANALYTICS_CANONICAL_PATH) {
      return;
    }

    console.error(
      "[AnalyticsDashboard] Unexpected pathname change detected during analytics render:",
      location.pathname,
    );
  }, [location.pathname]);

  const handleTabChange = useCallback(
    (_event, nextTabIndex) => {
      blurActiveElementIfNeeded();
      const safeTabIndex = normalizeAnalyticsTabIndex(nextTabIndex);
      const nextTabKey = ANALYTICS_TAB_CONFIG[safeTabIndex]?.key || ANALYTICS_DEFAULT_TAB_KEY;

      if (nextTabKey === activeTabKey) {
        persistAnalyticsTabKey(nextTabKey);
        return;
      }

      const nextParams = buildNextTabSearchParams(nextTabKey);
      setSearchParams(nextParams);
      persistAnalyticsTabKey(nextTabKey);
    },
    [activeTabKey, setSearchParams],
  );

  const tabs = ANALYTICS_TAB_CONFIG;

  return (
    <Box sx={{
      p: { xs: 2, sm: 2.5, md: 3 },
      bgcolor: isDark ? ANALYTICS_DARK_UI.pageBg : 'transparent',
      minHeight: '100vh',
      borderRadius: isDark ? 2 : 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Sticky Header Section */}
      <Box sx={{
        flexShrink: 0,
        px: { xs: 2, sm: 3 },
        pt: { xs: 1.5, sm: 2 },
        pb: 0,
      }}>
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onRefresh={handleManualRefresh}
          onExport={handleExport}
          loading={loading}
          liveSyncEnabled={liveSyncEnabled}
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={setAutoRefresh}
          isDark={isDark}
          scopeLabel={dashboardData?.scopeLabel}
        />

        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons="auto"
          sx={{
            mb: 2,
            mt: 3,
            borderBottom: 1,
            borderColor: isDark ? ANALYTICS_DARK_UI.divider : 'divider',
            '& .MuiTab-root': {
              color: isDark ? ANALYTICS_DARK_UI.textMuted : '#64748B',
              fontWeight: 700,
              '&:hover': {
                color: isDark ? ANALYTICS_DARK_UI.textSecondary : '#334155',
              },
              '&.Mui-selected': {
                color: isDark ? ANALYTICS_DARK_UI.textPrimary : '#0F172A',
                fontWeight: 700,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: isDark ? '#5B8DEF' : '#5B8DEF',
            },
            '& .MuiTabs-scrollButtons': {
              color: isDark ? ANALYTICS_DARK_UI.textSecondary : undefined,
            },
          }}
          aria-label="Analytics content sections"
        >
          {tabs.map((tabConfig) => (
            <Tab
              key={tabConfig.key}
              label={tabConfig.label}
              sx={{ textTransform: "none", fontWeight: 600 }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Scrollable Content Area */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        px: { xs: 2, sm: 3 },
        pb: { xs: 2, sm: 3 },
        pt: 3,
        display: 'flex',
        flexDirection: 'column',
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-thumb': { backgroundColor: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.4)', borderRadius: '4px' },
      }}>

        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleManualRefresh}>
                Retry
              </Button>
            }
            sx={{ mb: 2, ...buildAnalyticsAlertSx(isDark, "error") }}
          >
            {error}
          </Alert>
        ) : null}

        {refreshWarning ? (
          <Alert severity="warning" sx={{ mb: 2, ...buildAnalyticsAlertSx(isDark, "warning") }}>
            {refreshWarning}
          </Alert>
        ) : null}

        <Typography variant="caption" sx={{ display: "block", mb: 2, color: isDark ? ANALYTICS_DARK_UI.textMuted : 'text.secondary' }}>
          Scope: {dashboardData?.scopeLabel || "Current health center scope"}
          {dashboardData?.generatedAt ? ` • Last generated: ${toShortDateTime(dashboardData.generatedAt)}` : ""}
        </Typography>

        {tab === 0 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} isDark={isDark} />
            <TrendsSection data={dashboardData} loading={loading} chartAppearance={chartAppearance} />
          </>
        )}

        {tab === 1 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} isDark={isDark} />
            <Divider sx={sectionDividerSx} />
            <VaccineProgressSection data={dashboardData} loading={loading} chartAppearance={chartAppearance} />
          </>
        )}

        {tab === 2 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} isDark={isDark} />
            <Divider sx={sectionDividerSx} />
            <AppointmentAndFollowupSection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
            />
          </>
        )}

        {tab === 3 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} isDark={isDark} />
            <Divider sx={sectionDividerSx} />
            <InventorySection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
              viewportWidth={viewportWidth}
            />
            <SmsAndDemographicsSection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
              genderError={error}
            />
          </>
        )}

        {tab === 4 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} isDark={isDark} />
            <Divider sx={sectionDividerSx} />
            <SmsAndDemographicsSection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
              showGenderChart
              genderError={error}
            />
            <AlertsActivityReportsSection
              data={dashboardData}
              loading={loading}
              isDark={isDark}
              onReportShortcutDownload={handleReportShortcutDownload}
              shortcutLoadingKey={shortcutLoadingKey}
            />
          </>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default AnalyticsDashboard;
