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
  Inventory2,
  LocalHospital,
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
import { useSearchParams } from "react-router-dom";
import apiClient from "../../utils/api";
import { useSocket } from "../../contexts/SocketContext";
import { safeLocalStorage, safeSessionStorage } from "../../utils/safeStorage";

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

const SELECT_MENU_PROPS = {
  disablePortal: true,
  keepMounted: true,
  hideBackdrop: true,
  disableScrollLock: true,
  disableAutoFocusItem: true,
  disableEnforceFocus: true,
  disableRestoreFocus: true,
  slotProps: {
    backdrop: {
      invisible: true,
    },
    paper: {
      sx: {
        maxHeight: 320,
        zIndex: (theme) => theme.zIndex.modal + 2,
      },
    },
  },
  BackdropProps: {
    invisible: true,
  },
  PaperProps: {
    sx: {
      maxHeight: 320,
      zIndex: (theme) => theme.zIndex.modal + 2,
    },
  },
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
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

const resolveChartAppearance = (theme) => {
  const isDark = theme.palette.mode === "dark";

  return {
    isDark,
    cardBackground: isDark
      ? "linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(15,23,42,0.72) 100%)"
      : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    cardBorder: isDark ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.24)",
    cardShadow: isDark ? "0 14px 30px rgba(2,6,23,0.45)" : "0 14px 30px rgba(15,23,42,0.08)",
    plotBackground: isDark ? "rgba(15,23,42,0.35)" : "rgba(248,250,252,0.82)",
    plotBorder: isDark ? "rgba(148,163,184,0.20)" : "rgba(148,163,184,0.25)",
    gridStroke: isDark ? "rgba(148,163,184,0.20)" : "rgba(100,116,139,0.20)",
    axisLine: isDark ? "rgba(148,163,184,0.38)" : "rgba(100,116,139,0.30)",
    axisTick: isDark ? "#CBD5E1" : "#475569",
    tooltipBackground: isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.98)",
    tooltipBorder: isDark ? "rgba(148,163,184,0.34)" : "rgba(148,163,184,0.35)",
    tooltipTitle: isDark ? "#F8FAFC" : "#0F172A",
    tooltipText: isDark ? "#E2E8F0" : "#334155",
    legendBackground: isDark ? "rgba(30,41,59,0.70)" : "rgba(248,250,252,0.88)",
    legendBorder: isDark ? "rgba(148,163,184,0.24)" : "rgba(148,163,184,0.34)",
    legendText: isDark ? "#E2E8F0" : "#334155",
    centerLabel: isDark ? "#94A3B8" : "#64748B",
    centerValue: isDark ? "#F8FAFC" : "#0F172A",
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

  const summaryLowStock =
    summary.lowStockVaccines ??
    summary.lowStockCount ??
    inventory.lowStockCount ??
    inventory.lowStockVaccines;

  const summaryAvailableDoses =
    summary.totalAvailableVaccineDoses ??
    summary.availableDoses ??
    inventory.totalAvailableDoses ??
    inventory.availableDoses;

  const summaryPendingAppointments =
    summary.pendingAppointments ??
    summary.pendingAppointmentCount ??
    appointmentFollowup.pending;

  const summaryVaccinationsToday =
    summary.vaccinationsCompletedToday ??
    summary.vaccinationsToday ??
    summary.completedToday;

  const summaryDueForVaccination =
    summary.infantsDueForVaccination ??
    summary.dueForVaccination ??
    summary.vaccinationsDue;

  const summaryOverdueVaccinations =
    summary.overdueVaccinations ??
    summary.overdueVaccinationCount ??
    summary.overdue;

  const summaryTotalInfants =
    summary.totalRegisteredInfants ??
    summary.totalInfants ??
    demographics?.coverage?.infants;

  const summaryTotalGuardians =
    summary.totalGuardians ??
    summary.guardians ??
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
        group: item.label || "Unknown",
        count: safeNum(item.count ?? item.total ?? item.value),
      }));

  const demographicsGender = normalizeArray(
    demographics.genderBreakdown,
    demographics.gender,
    demographics.genderDistribution,
  ).map((item) => ({
        label: item.label || "Unknown",
        count: safeNum(item.count ?? item.total ?? item.value),
      }));

  const activity = normalizeArray(payload?.recentActivity, payload?.activity, payload?.activityFeed);
  const alerts = normalizeArray(payload?.alerts, payload?.criticalAlerts);
  const reportShortcuts = normalizeArray(payload?.reportShortcuts, payload?.reports);
  const inventoryByVaccine = normalizeArray(inventory.byVaccine, inventory.vaccines, inventory.breakdown);

  const normalizedScope =
    metadata?.scope?.locality ||
    metadata?.scopeLabel ||
    payload?.scopeLabel ||
    payload?.scope ||
    "Barangay Health Center, Pasig City";

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
    demographicsAgeGroups,
    demographicsGender,
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
    activity: activity.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      severity: item.severity,
      timestamp: item.timestamp,
    })),
    alerts: alerts.map((item) => ({
      id: item.id,
      severity: item.severity,
      type: item.type,
      message: item.message,
      timestamp: item.timestamp,
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
}) => {
  return (
    <Card sx={{ mb: 3 }}>
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
                    MenuProps={SELECT_MENU_PROPS}
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
                    MenuProps={SELECT_MENU_PROPS}
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
                    MenuProps={SELECT_MENU_PROPS}
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
                  <IconButton onClick={onRefresh} disabled={loading} color="primary" aria-label="Refresh analytics">
                    <Refresh />
                  </IconButton>
                </span>
              </Tooltip>

              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={onExport}
                disabled={loading}
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
                />
                <Chip size="small" variant="outlined" label="Barangay San Nicolas Health Center, Pasig City" />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={autoRefresh}
                    onChange={(event) => onAutoRefreshToggle(event.target.checked)}
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

const KpiCard = ({ title, value, subtitle, icon, color = "primary", loading }) => {
  const Icon = icon;
  const displayValue = typeof value === "number" ? safeNum(value).toLocaleString() : String(value ?? "0");

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
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
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {displayValue}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const KpiSummaryGrid = ({ data, loading }) => {
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
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiCard
          title="Total Guardians"
          value={kpis.totalGuardians}
          subtitle="Linked guardian accounts"
          icon={People}
          color="info"
          loading={loading}
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
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
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

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
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
                  <SummaryMiniCard label="Total In Period" value={appointment.totalInPeriod} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Today" value={appointment.today} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Upcoming (7 Days)" value={appointment.upcoming7Days} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Overdue Follow-ups" value={appointment.overdueFollowUps} error />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Follow-ups Today" value={appointment.followUpsToday} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Follow-ups in Period" value={appointment.followUpsInPeriod} />
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

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Vaccine Inventory Summary
            </Typography>
            {loading ? (
              <>
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </>
            ) : (
              <Grid container spacing={1.5}>
                <Grid size={6}>
                  <SummaryMiniCard label="Total Inventory Items" value={inventory.totalItems} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Available Doses" value={inventory.totalAvailableDoses} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Low-stock" value={inventory.lowStockCount} error />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Critical-stock" value={inventory.criticalStockCount} error />
                </Grid>
                <Grid size={12}>
                  <SummaryMiniCard label="Out-of-stock" value={inventory.outOfStockCount} error />
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

const SmsAndDemographicsSection = ({ data, loading, chartAppearance, showGenderChart = false }) => {
  const reminder = data?.reminders || {};
  const coverage = data?.demographicsCoverage || {};
  const ageData = data?.demographicsAgeGroups || [];
  const genderData = (data?.demographicsGender || [])
    .map((item, index) => {
      const rawLabel = String(item.label || "Unknown").trim();
      const normalized = rawLabel.toLowerCase();
      const label = normalized.includes("female")
        ? "Female"
        : normalized.includes("male")
          ? "Male"
          : rawLabel || "Unknown";

      const color =
        label === "Male"
          ? CHART_THEME.palette.male
          : label === "Female"
            ? CHART_THEME.palette.female
            : PIE_COLORS[index % PIE_COLORS.length];

      return {
        label,
        count: safeNum(item.count),
        color,
      };
    })
    .filter((item) => item.count > 0);

  const genderTotal = genderData.reduce((total, item) => total + safeNum(item.count), 0);
  const maleCount = genderData.find((item) => item.label === "Male")?.count || 0;
  const femaleCount = genderData.find((item) => item.label === "Female")?.count || 0;
  const malePercent = genderTotal > 0 ? Math.round((maleCount / genderTotal) * 100) : 0;
  const femalePercent = genderTotal > 0 ? Math.round((femaleCount / genderTotal) * 100) : 0;
  const genderBreakdownLabel =
    maleCount + femaleCount > 0 ? `${malePercent}% M • ${femalePercent}% F` : `${genderData.length} groups`;

  const axisTick = { fill: chartAppearance.axisTick, fontSize: 12, fontWeight: 500 };
  const axisLine = { stroke: chartAppearance.axisLine };

  const summaryGridSize = showGenderChart ? { xs: 12, lg: 4 } : { xs: 12, md: 5 };
  const ageChartGridSize = showGenderChart ? { xs: 12, md: 6, lg: 4 } : { xs: 12, md: 7 };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={summaryGridSize}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              SMS Reminder Analytics
            </Typography>
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
                  <SummaryMiniCard label="SMS Sent" value={reminder.smsSent} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="SMS Delivered" value={reminder.smsDelivered} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="SMS Failed" value={reminder.smsFailed} error />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Delivery Rate" value={`${safeNum(reminder.deliveryRate).toFixed(1)}%`} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Unread Notifications" value={reminder.unreadNotifications} />
                </Grid>
                <Grid size={6}>
                  <SummaryMiniCard label="Failed SMS Count" value={reminder.failedSmsCount} error />
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={ageChartGridSize}>
        <ChartCard
          title="Demographic Coverage (Age Groups)"
          subtitle={`Registered infants: ${safeNum(coverage.infants)} • Guardians: ${safeNum(coverage.guardians)}`}
          loading={loading}
          empty={ageData.length === 0}
          ariaLabel="Line chart of infant age-group distribution"
          chartAppearance={chartAppearance}
          chartHeight={300}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ageData} margin={CHART_THEME.layout.margin}>
              <CartesianGrid
                stroke={chartAppearance.gridStroke}
                strokeDasharray={CHART_THEME.layout.gridDash}
                vertical={false}
              />
              <XAxis dataKey="group" tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
              <RechartsTooltip
                cursor={{ stroke: CHART_THEME.palette.primary, strokeOpacity: 0.3 }}
                content={<DashboardChartTooltip chartAppearance={chartAppearance} />}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Infants"
                stroke={CHART_THEME.palette.primary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{
                  r: 3,
                  stroke: chartAppearance.plotBackground,
                  strokeWidth: 2,
                  fill: CHART_THEME.palette.primary,
                }}
                activeDot={{ r: 6, fill: CHART_THEME.palette.primary, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      {showGenderChart ? (
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <ChartCard
            title="Male vs Female Distribution"
            subtitle="Registered infant gender composition"
            loading={loading}
            empty={genderData.length === 0}
            ariaLabel="Rounded doughnut chart comparing male and female infant counts"
            chartAppearance={chartAppearance}
            chartHeight={300}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={3}
                  cornerRadius={12}
                  stroke={chartAppearance.plotBackground}
                  strokeWidth={2}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`gender-distribution-${entry.label}-${index}`} fill={entry.color} />
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
                  y="44%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={chartAppearance.centerLabel}
                  fontSize="12"
                  fontWeight="600"
                >
                  Infants
                </text>
                <text
                  x="50%"
                  y="54%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={chartAppearance.centerValue}
                  fontSize="24"
                  fontWeight="700"
                >
                  {genderTotal.toLocaleString()}
                </text>
                <text
                  x="50%"
                  y="64%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={chartAppearance.centerLabel}
                  fontSize="11"
                  fontWeight="600"
                >
                  {genderBreakdownLabel}
                </text>
              </PieChart>
            </ResponsiveContainer>
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
                tickFormatter={formatTrendLabelTick}
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
                tickFormatter={formatTrendLabelTick}
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

const AlertsActivityReportsSection = ({ data, loading }) => {
  const alerts = data?.alerts || [];
  const activity = data?.activity || [];
  const reports = data?.reportShortcuts || [];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Critical Alerts
            </Typography>
            {loading ? (
              <>
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </>
            ) : alerts.length === 0 ? (
              <Alert severity="success">No critical alerts for current filters.</Alert>
            ) : (
              <Box sx={{ display: "grid", gap: 1.5 }}>
                {alerts.slice(0, 6).map((item) => (
                  <Alert
                    key={item.id}
                    severity={item.severity === "critical" ? "error" : "warning"}
                    icon={<ErrorOutline fontSize="inherit" />}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {toShortDateTime(item.timestamp)}
                    </Typography>
                  </Alert>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
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
              <Alert severity="info">No recent activity for current filter range.</Alert>
            ) : (
              <Box sx={{ display: "grid", gap: 1.25, maxHeight: 320, overflowY: "auto", pr: 0.5 }}>
                {activity.slice(0, 10).map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 1.25,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.title}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={statusLabel(item.type)}
                        sx={{ height: 22 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {item.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {toShortDateTime(item.timestamp)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 3 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Report Shortcuts
            </Typography>

            {loading ? (
              <>
                <Skeleton height={54} />
                <Skeleton height={54} />
                <Skeleton height={54} />
              </>
            ) : reports.length === 0 ? (
              <Alert severity="info">No report shortcuts available.</Alert>
            ) : (
              <Box sx={{ display: "grid", gap: 1 }}>
                {reports.map((report) => (
                  <Button
                    key={report.key}
                    variant="outlined"
                    size="small"
                    href={report.endpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ justifyContent: "space-between", textTransform: "none" }}
                    endIcon={<Download fontSize="small" />}
                  >
                    <Box sx={{ textAlign: "left" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {report.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {String(report.format || "").toUpperCase()}
                      </Typography>
                    </Box>
                  </Button>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

const SummaryMiniCard = ({ label, value, error = false }) => {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        minHeight: 72,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }} color={error ? "error.main" : "text.primary"}>
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
    ["Scope", "Facility", data?.scopeLabel || "Barangay Health Center, Pasig City"],
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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTabletDown = useMediaQuery(theme.breakpoints.down("md"));
  const viewportWidth = isMobile ? 560 : isTabletDown ? 840 : 1200;
  const { on, off, connectionState } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const pollRef = useRef(null);

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

  const liveSyncEnabled = useMemo(() => connectionState === "connected", [connectionState]);
  const chartAppearance = useMemo(() => resolveChartAppearance(theme), [theme]);
  const tabFromUrl = normalizeAnalyticsTabKey(searchParams.get("tab"));

  const activeTabKey = useMemo(
    () => tabFromUrl || getStoredAnalyticsTabKey() || ANALYTICS_DEFAULT_TAB_KEY,
    [tabFromUrl],
  );

  const tab = useMemo(() => {
    const tabIndex = ANALYTICS_TAB_CONFIG.findIndex((entry) => entry.key === activeTabKey);
    return tabIndex >= 0 ? tabIndex : 0;
  }, [activeTabKey]);

  useEffect(() => {
    if (tabFromUrl) {
      persistAnalyticsTabKey(tabFromUrl);
      return;
    }

    const fallbackTabKey = getStoredAnalyticsTabKey() || ANALYTICS_DEFAULT_TAB_KEY;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", fallbackTabKey);
    setSearchParams(nextParams, { replace: true });
  }, [tabFromUrl, searchParams, setSearchParams]);

  const handleTabChange = useCallback(
    (_event, nextTabIndex) => {
      const nextTabKey = ANALYTICS_TAB_CONFIG[nextTabIndex]?.key || ANALYTICS_DEFAULT_TAB_KEY;
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", nextTabKey);
      setSearchParams(nextParams);
      persistAnalyticsTabKey(nextTabKey);
    },
    [searchParams, setSearchParams],
  );

  const tabs = ANALYTICS_TAB_CONFIG;

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onRefresh={handleManualRefresh}
          onExport={handleExport}
          loading={loading}
          liveSyncEnabled={liveSyncEnabled}
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={setAutoRefresh}
        />

        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons="auto"
          sx={{ mb: 2 }}
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

        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleManualRefresh}>
                Retry
              </Button>
            }
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        ) : null}

        {refreshWarning ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {refreshWarning}
          </Alert>
        ) : null}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Scope: {dashboardData?.scopeLabel || "Barangay Health Center, Pasig City"}
          {dashboardData?.generatedAt ? ` • Last generated: ${toShortDateTime(dashboardData.generatedAt)}` : ""}
        </Typography>

        {tab === 0 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} />
            <TrendsSection data={dashboardData} loading={loading} chartAppearance={chartAppearance} />
          </>
        )}

        {tab === 1 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} />
            <Divider sx={{ mb: 3 }} />
            <VaccineProgressSection data={dashboardData} loading={loading} chartAppearance={chartAppearance} />
          </>
        )}

        {tab === 2 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} />
            <Divider sx={{ mb: 3 }} />
            <AppointmentAndFollowupSection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
            />
          </>
        )}

        {tab === 3 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} />
            <Divider sx={{ mb: 3 }} />
            <InventorySection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
              viewportWidth={viewportWidth}
            />
            <SmsAndDemographicsSection data={dashboardData} loading={loading} chartAppearance={chartAppearance} />
          </>
        )}

        {tab === 4 && (
          <>
            <KpiSummaryGrid data={dashboardData} loading={loading} />
            <Divider sx={{ mb: 3 }} />
            <SmsAndDemographicsSection
              data={dashboardData}
              loading={loading}
              chartAppearance={chartAppearance}
              showGenderChart
            />
            <AlertsActivityReportsSection data={dashboardData} loading={loading} />
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
  );
};

export default AnalyticsDashboard;
