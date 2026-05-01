import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  EmptyState,
  SkeletonTable,
  SkeletonCard,
  AdminModalActions,
  Alert,
} from "../components/UI";
import { Search, Syringe, Trash2 } from "lucide-react";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import useVaccinationSocket from "../hooks/useVaccinationSocket";
import VaccinationPeriodFilter from "../components/VaccinationPeriodFilter";
import SearchableInfantSelect from "../components/SearchableInfantSelect";
import InjectVaccineModal from "../components/InjectVaccineModal";
import {
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationSchedulesResponse,
  normalizeInfantsResponse,
  normalizeVaccinationRecordResponse,
  computeVaccinationComplianceSummary,
} from "../utils/adminDataAdapters";
import { isApprovedVaccineName } from "../constants/approvedVaccines";
import {
  resolveLotBatchValue,
} from "../utils/vaccinationFormOptions";
import {
  buildVaccinationRecordPeriodParams,
  getVaccinationPeriodRange,
  isDateWithinVaccinationPeriod,
  normalizeVaccinationPeriod,
} from "../utils/vaccinationPeriods";
import { fromClinicDateKey, toClinicDateKey } from "../utils/dateUtils";
import {
  buildInfantRecordPrefillContext,
  buildInfantSearchText,
  getInfantControlNumber,
  getInfantDisplayLabel,
  matchesTokenizedTextSearch,
} from "../utils/infantIdentity";
import { useLocation, useSearchParams } from "react-router-dom";

const pollingIntervalMs = 60000;
const VACCINATION_TAB_STORAGE_KEY = "admin.vaccinations.activeTab";
const VACCINATION_TAB_KEYS = ["records", "tracking", "schedule"];
const DEFAULT_VACCINATION_TAB_KEY = "schedule";

// Performance optimization constants
const INFANT_CHUNK_SIZE = 10000; // Enough to keep derived dashboard counts in one scoped batch
const CACHE_TTL_MS = 10 * 60 * 1000; // Extended cache TTL for better performance
const BASE_ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_RECORDS_ITEMS_PER_PAGE = 20;
const DEFAULT_SCHEDULE_ITEMS_PER_PAGE = 20;
const DEFAULT_TRACKING_ITEMS_PER_PAGE = 9;

const buildRowsPerPageOptions = (defaultSize) =>
  Array.from(
    new Set(
      [defaultSize, ...BASE_ROWS_PER_PAGE_OPTIONS].filter(
        (value) => Number.isInteger(value) && value > 0,
      ),
    ),
  ).sort((left, right) => left - right);

function VaccinationPaginationFooter({
  totalItems,
  visibleStart,
  visibleEnd,
  itemLabel,
  currentPage,
  totalPages,
  rowsPerPage,
  rowsPerPageOptions,
  pageInputId,
  pageInputValue,
  onPageInputChange,
  onPageInputKeyDown,
  onPageJumpSubmit,
  onRowsPerPageChange,
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
}) {
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3 bg-white dark:bg-gray-800 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm text-gray-500">
        Showing {visibleStart} to {visibleEnd} of {totalItems} {itemLabel}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${pageInputId}-rows-per-page`}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Rows
          </label>
          <select
            id={`${pageInputId}-rows-per-page`}
            value={rowsPerPage}
            onChange={onRowsPerPageChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Rows per page"
          >
            {rowsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevious}
            disabled={disablePrevious}
          >
            Previous
          </Button>
          <span className="flex items-center px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNext}
            disabled={disableNext}
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor={pageInputId}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Go to page
          </label>
          <input
            id={pageInputId}
            type="number"
            min="1"
            max={totalPages}
            value={pageInputValue}
            onChange={onPageInputChange}
            onKeyDown={onPageInputKeyDown}
            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Go to page"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onPageJumpSubmit}
            disabled={totalPages <= 1}
          >
            Go
          </Button>
        </div>
      </div>
    </div>
  );
}

const normalizeSearchValue = (value) => String(value || "").trim().toLowerCase();

const mergeByNumericId = (existing = [], incoming = []) => {
  const merged = [];
  const seen = new Set();

  [...existing, ...incoming].forEach((entry) => {
    const id = Number.parseInt(entry?.id, 10);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      return;
    }
    seen.add(id);
    merged.push(entry);
  });

  return merged;
};

const matchesTokenizedSearch = (searchableText, rawQuery) =>
  matchesTokenizedTextSearch(searchableText, rawQuery);

const normalizeVaccinationTabKey = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return VACCINATION_TAB_KEYS.includes(normalizedValue) ? normalizedValue : "";
};

const getStoredVaccinationTabKey = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return "";
    }

    return normalizeVaccinationTabKey(window.localStorage.getItem(VACCINATION_TAB_STORAGE_KEY));
  } catch {
    return "";
  }
};

const persistVaccinationTabKey = (value) => {
  const normalizedValue = normalizeVaccinationTabKey(value);

  if (!normalizedValue) {
    return;
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(VACCINATION_TAB_STORAGE_KEY, normalizedValue);
    }
  } catch {
    // Ignore storage failures and fall back to the URL as the source of truth.
  }
};

const getStatusBadgeClassName = (status) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "overdue":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "due":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "upcoming":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
};

const formatDateInputValue = (value) => {
  if (!value) return "";
  return toClinicDateKey(value);
};

const formatAgeLabel = (ageInMonths) => {
  const normalizedAge = Number(ageInMonths || 0);
  if (!normalizedAge) return "At Birth";
  return `${normalizedAge} month${normalizedAge > 1 ? "s" : ""}`;
};

const normalizeDateToStartOfDay = (value) => {
  const dateKey = toClinicDateKey(value);
  if (!dateKey) return null;
  return fromClinicDateKey(dateKey);
};

const classifyScheduleDoseStatus = (entry = {}) => {
  const normalizedStatus = String(entry.status || "").trim().toLowerCase();
  const today = normalizeDateToStartOfDay(new Date());

  if (normalizedStatus === "completed" || normalizedStatus === "attended") {
    return "completed";
  }

  if (normalizedStatus === "overdue") {
    return "overdue";
  }

  if (normalizedStatus === "due") {
    return "due";
  }

  if (normalizedStatus === "upcoming") {
    return "upcoming";
  }

  if (entry.due_date) {
    const dueDate = normalizeDateToStartOfDay(entry.due_date);
    if (dueDate && today && dueDate.getTime() < today.getTime()) {
      return "overdue";
    }
  }

  return "upcoming";
};

const isCompletedVaccinationRecord = (record = {}) => {
  const normalizedStatus = String(record.status || "").trim().toLowerCase();
  return normalizedStatus === "completed" || normalizedStatus === "attended" || Boolean(record.admin_date);
};

const getTrackingTimelineReferenceDate = (entry = {}) => {
  const statusKey = classifyScheduleDoseStatus(entry);

  if (statusKey === "completed") {
    return entry.admin_date || entry.due_date || null;
  }

  return entry.due_date || entry.admin_date || null;
};

const summarizeTrackingTimeline = (timeline = []) => {
  const completed = timeline.filter(
    (entry) => classifyScheduleDoseStatus(entry) === "completed",
  ).length;
  const due = timeline.filter(
    (entry) => classifyScheduleDoseStatus(entry) === "due",
  ).length;
  const overdue = timeline.filter(
    (entry) => classifyScheduleDoseStatus(entry) === "overdue",
  ).length;
  const pending = due + overdue;
  const progressTotal = completed + pending;

  return {
    dueCount: due,
    completed,
    pending,
    overdue,
    completionRate: progressTotal ? Math.round((completed / progressTotal) * 100) : 0,
  };
};

const isDoseInCompliancePeriod = (entry = {}, range = {}) => {
  const statusKey = classifyScheduleDoseStatus(entry);
  if (statusKey === "completed") {
    const endDate = toClinicDateKey(range.endDate);
    const administeredDate = toClinicDateKey(entry.admin_date);
    return !endDate || !administeredDate || administeredDate <= endDate;
  }

  return isDateWithinVaccinationPeriod(entry.due_date, range);
};

const filterTrackingSnapshotByPeriod = (snapshot = {}, range = {}) => {
  const filteredTimeline = Array.isArray(snapshot.timeline)
    ? snapshot.timeline.filter((entry) => {
        const statusKey = classifyScheduleDoseStatus(entry);
        if (!["completed", "due", "overdue"].includes(statusKey)) {
          return false;
        }

        return isDoseInCompliancePeriod(entry, range);
      })
    : [];

  return {
    ...snapshot,
    ...summarizeTrackingTimeline(filteredTimeline),
    timeline: filteredTimeline,
  };
};

const DEFAULT_OVERVIEW_PAGINATION = Object.freeze({
  page: 1,
  limit: 0,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
});

const DEFAULT_TRACKING_OVERVIEW_SUMMARY = Object.freeze({
  completed: 0,
  dueSoon: 0,
  overdue: 0,
  trackedInfants: 0,
});

const DEFAULT_SCHEDULE_OVERVIEW_SUMMARY = Object.freeze({
  upcoming: 0,
  due: 0,
  completed: 0,
  overdue: 0,
  trackedInfants: 0,
  totalRows: 0,
});

const normalizeOverviewPagination = (metadata = {}, fallbackLimit = 0) => {
  const page = Number(metadata.page || 1);
  const limit = Number(metadata.limit || fallbackLimit || 0);
  const total = Number(metadata.total || 0);
  const totalPages = Number(
    metadata.totalPages || metadata.total_pages || (limit > 0 ? Math.ceil(total / limit) : 0),
  );

  return {
    ...DEFAULT_OVERVIEW_PAGINATION,
    ...metadata,
    page,
    limit,
    total,
    totalPages,
    hasNext: Boolean(metadata.hasNext ?? metadata.has_next ?? page < totalPages),
    hasPrev: Boolean(metadata.hasPrev ?? metadata.has_prev ?? page > 1),
  };
};

const buildVaccinationOverviewPeriodParams = ({
  period,
  startDate,
  endDate,
} = {}) => {
  const normalizedPeriod = normalizeVaccinationPeriod(period);

  return {
    period: normalizedPeriod,
    ...(normalizedPeriod === "custom"
      ? {
          startDate,
          endDate,
        }
      : {}),
  };
};

const normalizeTrackingOverviewResponse = (response = {}, fallbackLimit = 9) => {
  const rows = Array.isArray(response?.rows)
    ? response.rows
    : Array.isArray(response?.data?.rows)
      ? response.data.rows
      : [];
  const summary = response?.summary || response?.data?.summary || {};
  const metadata = response?.metadata || response?.pagination || response?.data?.metadata || {};

  return {
    rows: rows.map((row) => {
      const infant = row.infant || row.infant_context || {};
      return {
        ...row,
        infant,
        dueCount: Number(row.dueCount ?? row.due_count ?? row.due ?? 0),
        completed: Number(row.completed || 0),
        pending: Number(row.pending || 0),
        overdue: Number(row.overdue || 0),
        completionRate: Number(row.completionRate ?? row.completion_rate ?? 0),
        timeline: Array.isArray(row.timeline) ? row.timeline : [],
      };
    }),
    summary: {
      ...DEFAULT_TRACKING_OVERVIEW_SUMMARY,
      completed: Number(summary.completed || 0),
      dueSoon: Number(summary.dueSoon ?? summary.due_soon ?? summary.due ?? 0),
      overdue: Number(summary.overdue || 0),
      trackedInfants: Number(summary.trackedInfants ?? summary.tracked_infants ?? 0),
    },
    metadata: normalizeOverviewPagination(metadata, fallbackLimit),
  };
};

const normalizeScheduleOverviewResponse = (response = {}, fallbackLimit = 20) => {
  const rows = Array.isArray(response?.rows)
    ? response.rows
    : Array.isArray(response?.data?.rows)
      ? response.data.rows
      : [];
  const summary = response?.summary || response?.data?.summary || {};
  const metadata = response?.metadata || response?.pagination || response?.data?.metadata || {};

  return {
    rows: rows.map((row) => {
      const infantContext = row.infant_context || {
        id: row.infant_id,
        first_name: row.infant_first_name || "",
        middle_name: row.infant_middle_name || "",
        last_name: row.infant_last_name || "",
        full_name: row.infant_full_name || row.infant_name || "",
        display_name: row.infant_display_name || row.infant_name || "",
        control_number: row.infant_control_number || "",
        dob: row.infant_dob || null,
      };

      return {
        ...row,
        infant_context: infantContext,
        status_label:
          row.status_label ||
          `${String(row.status_key || "").charAt(0).toUpperCase()}${String(row.status_key || "").slice(1)}`,
      };
    }),
    summary: {
      ...DEFAULT_SCHEDULE_OVERVIEW_SUMMARY,
      upcoming: Number(summary.upcoming || 0),
      due: Number(summary.due || 0),
      completed: Number(summary.completed || 0),
      overdue: Number(summary.overdue || 0),
      trackedInfants: Number(summary.trackedInfants ?? summary.tracked_infants ?? 0),
      totalRows: Number(summary.totalRows ?? summary.total_rows ?? metadata.total ?? 0),
    },
    metadata: normalizeOverviewPagination(metadata, fallbackLimit),
  };
};

const extractInfantsFromOverviewRows = (rows = []) => {
  const infantsById = new Map();

  rows.forEach((row) => {
    const infant = row.infant || row.infant_context;
    const infantId = Number.parseInt(infant?.id ?? row.infant_id, 10);
    if (!Number.isFinite(infantId) || infantId <= 0 || infantsById.has(infantId)) {
      return;
    }

    infantsById.set(infantId, {
      ...infant,
      id: infantId,
      dob: infant?.dob || row.infant_dob || null,
    });
  });

  return Array.from(infantsById.values());
};

const isAbortError = (error) =>
  Boolean(
    error &&
      (error.name === "CanceledError" ||
        error.code === "ERR_CANCELED" ||
        String(error.message || "").toLowerCase().includes("canceled")),
  );

const DEFAULT_FORM = {
  id: null,
  infant_id: "",
  vaccine_id: "",
  dose_no: 1,
  admin_date: "",
  next_due_date: "",
  administered_by: "",
  administered_by_role: "",
  administered_by_search: "",
  batch_id: "",
  inventory_record_id: "",
  lot_batch_number: "",
  status: "completed",
  notes: "",
};

const VaccinationsDashboard = () => {
  const { isAdmin, user } = useAuth();
  const scopedClinicId = Number(user?.clinic_id || user?.facility_id || 0) || null;
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const storedTabKey = useMemo(() => getStoredVaccinationTabKey(), []);
  const urlTabKey = normalizeVaccinationTabKey(searchParams.get("tab"));
  const locationTabKey = normalizeVaccinationTabKey(
    location.state?.tab ?? location.state?.activeTab,
  );
  const activeTab = urlTabKey || locationTabKey || storedTabKey || DEFAULT_VACCINATION_TAB_KEY;

  const [period, setPeriod] = useState("month");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const activeTabRef = useRef(activeTab);
  const currentPageRef = useRef(1);
  const scheduleCurrentPageRef = useRef(1);
  const trackingCurrentPageRef = useRef(1);
  const searchQueryRef = useRef("");
  const hasInitializedPeriodEffectRef = useRef(false);
  const hasInitializedActiveTabEffectRef = useRef(false);
  const hasInitializedSearchEffectRef = useRef(false);
  const hasInitializedRecordPageEffectRef = useRef(false);
  const hasInitializedSelectedInfantEffectRef = useRef(false);
  const previousSchedulePageRef = useRef(1);
  const previousTrackingPageRef = useRef(1);
  const hasInitializedViewModeEffectRef = useRef(false);

  const [viewMode] = useState("all");

  const infantQueryScope = useMemo(
    () => (isAdmin ? { scope: "system" } : {}),
    [isAdmin],
  );
  const buildRequestConfig = useCallback(
    (signal) =>
      process.env.NODE_ENV === "test"
        ? null
        : {
            signal,
          },
    [],
  );
  const buildVaccinationInfantQuery = useCallback(
    (overrides = {}) => {
      return {
        ...infantQueryScope,
        exclude_future_dob: true,
        fields: "lite",
        ...overrides,
      };
    },
    [infantQueryScope],
  );

  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [recordTableRows, setRecordTableRows] = useState([]);
  const [recordTablePagination, setRecordTablePagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    completed: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [infants, setInfants] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [trackingOverviewRows, setTrackingOverviewRows] = useState([]);
  const [trackingOverviewSummary, setTrackingOverviewSummary] = useState({
    ...DEFAULT_TRACKING_OVERVIEW_SUMMARY,
  });
  const [trackingOverviewPagination, setTrackingOverviewPagination] = useState({
    ...DEFAULT_OVERVIEW_PAGINATION,
    limit: 9,
  });
  const [scheduleOverviewRows, setScheduleOverviewRows] = useState([]);
  const [scheduleOverviewSummary, setScheduleOverviewSummary] = useState({
    ...DEFAULT_SCHEDULE_OVERVIEW_SUMMARY,
  });
  const [scheduleOverviewPagination, setScheduleOverviewPagination] = useState({
    ...DEFAULT_OVERVIEW_PAGINATION,
    limit: 20,
  });
  const currentDateAvailability = dashboardSummary?.currentDateAvailability || null;
  const isBlockedTodayView =
    period === "today" && currentDateAvailability?.isAvailable === false;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordsHydrationLoading, setRecordsHydrationLoading] = useState(false);
  const [infantsLoading, setInfantsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [selectedInfantId, setSelectedInfantId] = useState(null);
  const [mutationInFlight, setMutationInFlight] = useState(false);
  const [addModalPrefill, setAddModalPrefill] = useState(null);

  const [vaccinationForm, setVaccinationForm] = useState(DEFAULT_FORM);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scheduleCurrentPage, setScheduleCurrentPage] = useState(1);
  const [trackingCurrentPage, setTrackingCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_RECORDS_ITEMS_PER_PAGE);
  const [scheduleItemsPerPage, setScheduleItemsPerPage] = useState(
    DEFAULT_SCHEDULE_ITEMS_PER_PAGE,
  );
  const [trackingItemsPerPage, setTrackingItemsPerPage] = useState(
    DEFAULT_TRACKING_ITEMS_PER_PAGE,
  );
  const [recordPageInputValue, setRecordPageInputValue] = useState("1");
  const [schedulePageInputValue, setSchedulePageInputValue] = useState("1");
  const [trackingPageInputValue, setTrackingPageInputValue] = useState("1");
  const stableDataLoadedAtRef = useRef({
    infants: 0,
    schedules: 0,
    reconciliation: 0,
    summary: 0,
  });
  const fetchStateRef = useRef({
    abortController: null,
    requestId: 0,
  });

  // Performance optimization state
  const [tabLoadingStates, setTabLoadingStates] = useState({
    records: false,
    tracking: false,
    schedule: false,
  });
  const [tabDataLoaded, setTabDataLoaded] = useState({
    records: false,
    tracking: false,
    schedule: false,
  });
  const tabDataLoadedRef = useRef({ records: false, tracking: false, schedule: false });
  const tabDataCacheRef = useRef(new Map());
  const socketRefreshTimeoutRef = useRef(null);
  const lastPathnameRef = useRef(location?.pathname || "");

  // Request deduplication refs (prevent concurrent fetches)
  const fetchDataRequestRef = useRef(null);
  const fetchTabDataRequestMapRef = useRef(new Map());
  const lastFetchTabDataParamsRef = useRef(null);
  const isMountedRef = useRef(true);
  const sharedVaccinationDataRef = useRef({
    infants: [],
    schedules: [],
    reconciliation: [],
  });
  const sharedVaccinationDataScopeRef = useRef("");

  useEffect(() => {
    const fetchState = fetchStateRef.current;

    return () => {
      if (fetchState.abortController) {
        fetchState.abortController.abort();
      }
      if (socketRefreshTimeoutRef.current) {
        clearTimeout(socketRefreshTimeoutRef.current);
      }
      // Clear cache on unmount
      tabDataCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    sharedVaccinationDataRef.current = {
      infants,
      schedules: vaccinationSchedules,
      reconciliation: vaccinationRecords,
    };
  }, [infants, vaccinationRecords, vaccinationSchedules]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 2500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // When searching by infant name in Tracking / Schedule tabs, ensure the infant lookup
  // queries the full infants table (no period/date constraints).
  useEffect(() => {
    if (activeTab !== "tracking" && activeTab !== "schedule") {
      return undefined;
    }

    const normalized = String(debouncedSearchQuery || "").trim();
    if (!normalized) {
      return undefined;
    }

    const abortController = new AbortController();
    const requestConfig = buildRequestConfig(abortController.signal);

    (async () => {
      try {
        const response = requestConfig
          ? await apiClient.getInfants(
              {
                ...infantQueryScope,
                exclude_future_dob: true,
                fields: "lite",
                page: 1,
                limit: 100,
                search: normalized,
              },
              requestConfig,
            )
          : await apiClient.getInfants({
              ...infantQueryScope,
              exclude_future_dob: true,
              fields: "lite",
              page: 1,
              limit: 100,
              search: normalized,
            });

        const normalizedRows = normalizeInfantsResponse(response);
        if (Array.isArray(normalizedRows) && normalizedRows.length > 0) {
          setInfants((previous) => mergeByNumericId(previous, normalizedRows));
        }
      } catch (lookupError) {
        if (isAbortError(lookupError)) return;
        console.error("[VaccinationsDashboard] Failed to load infants for tracking search:", lookupError);
      }
    })();

    return () => abortController.abort();
  }, [activeTab, buildRequestConfig, debouncedSearchQuery, infantQueryScope]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    persistVaccinationTabKey(activeTab);

    if (urlTabKey === activeTab) {
      return;
    }

    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, urlTabKey, setSearchParams]);

  const activateVaccinationTab = useCallback(
    (nextTab) => {
      const nextTabKey = normalizeVaccinationTabKey(nextTab) || DEFAULT_VACCINATION_TAB_KEY;

      activeTabRef.current = nextTabKey;
      persistVaccinationTabKey(nextTabKey);
      setSearchParams({ tab: nextTabKey }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    scheduleCurrentPageRef.current = scheduleCurrentPage;
  }, [scheduleCurrentPage]);

  useEffect(() => {
    trackingCurrentPageRef.current = trackingCurrentPage;
  }, [trackingCurrentPage]);

  useEffect(() => {
    setRecordPageInputValue(String(currentPage || 1));
  }, [currentPage]);

  useEffect(() => {
    setSchedulePageInputValue(String(scheduleCurrentPage || 1));
  }, [scheduleCurrentPage]);

  useEffect(() => {
    setTrackingPageInputValue(String(trackingCurrentPage || 1));
  }, [trackingCurrentPage]);

  useEffect(() => {
    searchQueryRef.current = debouncedSearchQuery;
  }, [debouncedSearchQuery]);

  const periodRange = useMemo(
    () =>
      getVaccinationPeriodRange({
        period,
        startDate: periodStartDate,
        endDate: periodEndDate,
      }),
    [period, periodStartDate, periodEndDate],
  );

  const normalizedSearchQuery = useMemo(
    () => normalizeSearchValue(debouncedSearchQuery),
    [debouncedSearchQuery],
  );

  const selectedInfantFocusId = useMemo(() => {
    const parsedId = Number.parseInt(selectedInfantId, 10);
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  }, [selectedInfantId]);

  const shouldUseChildProgressScope = Boolean(normalizedSearchQuery || selectedInfantFocusId);

  const selectedTrackingInfant = useMemo(() => {
    if (!selectedInfantId || activeTab !== "tracking") {
      return null;
    }

    const selectedId = Number.parseInt(selectedInfantId, 10);
    return (
      infants.find((infant) => Number.parseInt(infant?.id, 10) === selectedId) || null
    );
  }, [activeTab, infants, selectedInfantId]);

  const trackingVisibleInfants = useMemo(() => {
    if (activeTab !== "tracking" || isBlockedTodayView) {
      return [];
    }

    // Period filters apply to compliance timelines, not infant lookup.
    return infants;
  }, [activeTab, infants, isBlockedTodayView]);

  useEffect(() => {
    if (activeTab !== "tracking" || !selectedInfantId) {
      return;
    }

    const selectedId = Number.parseInt(selectedInfantId, 10);
    const exists = trackingVisibleInfants.some(
      (entry) => Number.parseInt(entry?.id, 10) === selectedId,
    );

    if (!exists) {
      setSelectedInfantId(null);
    }
  }, [activeTab, selectedInfantId, trackingVisibleInfants]);

  const activeRecordPeriodParams = useMemo(
    () =>
      buildVaccinationRecordPeriodParams({
        period,
        startDate: periodStartDate,
        endDate: periodEndDate,
      }),
    [period, periodStartDate, periodEndDate],
  );

  const activeOverviewPeriodParams = useMemo(
    () =>
      buildVaccinationOverviewPeriodParams({
        period,
        startDate: periodStartDate,
        endDate: periodEndDate,
      }),
    [period, periodStartDate, periodEndDate],
  );

  const dashboardSummaryQuery = useMemo(
    () => ({
      period,
      ...(period === "custom"
        ? {
            startDate: periodStartDate,
            endDate: periodEndDate,
          }
        : {}),
      ...(isAdmin ? { scope: "system" } : {}),
    }),
    [isAdmin, period, periodEndDate, periodStartDate],
  );

  const findRecordWithRelations = useCallback(
    (record) => {
      const infant = infants.find((entry) => entry.id === record.infant_id) || null;
      return { record, infant, vaccine: null };
    },
    [infants],
  );

  const fetchVaccinationReconciliationRecords = useCallback(
    async ({ signal } = {}) => {
      if (typeof apiClient.getVaccinationReconciliationRecords !== "function") {
        return [];
      }

      const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);
      const response = requestConfig
        ? await apiClient.getVaccinationReconciliationRecords({
            ...infantQueryScope,
          }, requestConfig)
        : await apiClient.getVaccinationReconciliationRecords({
            ...infantQueryScope,
          });

      return normalizeVaccinationRecordsResponse(response);
    },
    [buildRequestConfig, infantQueryScope],
  );

  const fetchVaccinationRecordPage = useCallback(
    async ({ page, search, signal } = {}) => {
      const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);
      const hasSearch = Boolean(String(search || "").trim());
      const response = requestConfig
        ? await apiClient.getVaccinationRecords(
            {
              page,
              limit: itemsPerPage,
              ...infantQueryScope,
              ...(!hasSearch ? activeRecordPeriodParams : {}),
              ...(search ? { search } : {}),
              date_view: viewMode,
            },
            requestConfig,
          )
        : await apiClient.getVaccinationRecords({
            page,
            limit: itemsPerPage,
            ...infantQueryScope,
            ...(!hasSearch ? activeRecordPeriodParams : {}),
            ...(search ? { search } : {}),
            date_view: viewMode,
          });
      const metadata = {
        page,
        limit: itemsPerPage,
        total: 0,
        totalPages: 0,
        completed: 0,
        hasNext: false,
        hasPrev: false,
        ...(response?.metadata || response?.pagination || {}),
      };

      return {
        rows: normalizeVaccinationRecordsResponse(response),
        metadata,
      };
    },
    [activeRecordPeriodParams, buildRequestConfig, infantQueryScope, itemsPerPage, viewMode],
  );

  const fetchVaccinationTrackingOverview = useCallback(
    async ({ page, search, signal } = {}) => {
      const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);
      const params = {
        page,
        limit: trackingItemsPerPage,
        ...infantQueryScope,
        ...activeOverviewPeriodParams,
        ...(search ? { search } : {}),
        ...(selectedInfantFocusId ? { infant_id: selectedInfantFocusId } : {}),
      };
      const response = requestConfig
        ? await apiClient.getVaccinationTracking(params, requestConfig)
        : await apiClient.getVaccinationTracking(params);

      return normalizeTrackingOverviewResponse(response, trackingItemsPerPage);
    },
    [
      activeOverviewPeriodParams,
      buildRequestConfig,
      infantQueryScope,
      selectedInfantFocusId,
      trackingItemsPerPage,
    ],
  );

  const fetchVaccinationScheduleOverview = useCallback(
    async ({ page, search, signal } = {}) => {
      const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);
      const params = {
        page,
        limit: scheduleItemsPerPage,
        ...infantQueryScope,
        ...activeOverviewPeriodParams,
        ...(search ? { search } : {}),
        ...(selectedInfantFocusId ? { infant_id: selectedInfantFocusId } : {}),
      };
      const response = requestConfig
        ? await apiClient.getVaccinationScheduleOverview(params, requestConfig)
        : await apiClient.getVaccinationScheduleOverview(params);

      return normalizeScheduleOverviewResponse(response, scheduleItemsPerPage);
    },
    [
      activeOverviewPeriodParams,
      buildRequestConfig,
      infantQueryScope,
      scheduleItemsPerPage,
      selectedInfantFocusId,
    ],
  );

  const isCustomRangeIncomplete =
    period === "custom" && (!periodStartDate || !periodEndDate);

  const fetchVaccinationSummaryData = useCallback(async ({ signal } = {}) => {
    if (
      typeof apiClient.getAnalyticsDashboardSummary !== "function" &&
      typeof apiClient.getAnalyticsDashboard !== "function"
    ) {
      return null;
    }

    if (isCustomRangeIncomplete) {
      return null;
    }

    try {
      const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);
      const summaryRequest =
        typeof apiClient.getAnalyticsDashboardSummary === "function"
          ? apiClient.getAnalyticsDashboardSummary
          : apiClient.getAnalyticsDashboard;
      const response = requestConfig
        ? await summaryRequest.call(apiClient, dashboardSummaryQuery, requestConfig)
        : await summaryRequest.call(apiClient, dashboardSummaryQuery);
      return response?.data?.summary || response?.summary || null;
    } catch (summaryError) {
      if (isAbortError(summaryError)) {
        return null;
      }
      console.error(
        "[VaccinationsDashboard] Failed to load dashboard summary metrics:",
        summaryError,
      );
      return null;
    }
  }, [buildRequestConfig, dashboardSummaryQuery, isCustomRangeIncomplete]);

  // Optimized data loading functions for better performance
  const refreshVaccineInventory = useCallback(async () => {
    if (typeof apiClient.getVaccineInventory !== "function") {
      return;
    }

    try {
      await apiClient.getVaccineInventory(scopedClinicId ? { clinic_id: scopedClinicId } : {});
    } catch (inventoryError) {
      console.error(
        "[VaccinationsDashboard] Failed to preload vaccine inventory:",
        inventoryError,
      );
    }
  }, [scopedClinicId]);

  const fetchInfantsChunked = useCallback(async ({ signal, limit = INFANT_CHUNK_SIZE, search = "" } = {}) => {
    const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);
    const infantQuery = buildVaccinationInfantQuery({
      page: 1,
      limit,
      ...(search ? { search } : {}),
    });

    const response =
      typeof apiClient.getDashboardInfants === "function"
        ? requestConfig
          ? await apiClient.getDashboardInfants(infantQuery, requestConfig)
          : await apiClient.getDashboardInfants(infantQuery)
        : requestConfig
          ? await apiClient.getInfants(infantQuery, requestConfig)
          : await apiClient.getInfants(infantQuery);

    return normalizeInfantsResponse(response);
  }, [buildRequestConfig, buildVaccinationInfantQuery]);

  const fetchTabData = useCallback(async (tabKey, { signal, force = false, background = false } = {}) => {
    const activeSearch = normalizeSearchValue(searchQueryRef.current);
    const pageKey =
      tabKey === "records"
        ? currentPageRef.current
        : tabKey === "tracking"
          ? trackingCurrentPageRef.current
          : scheduleCurrentPageRef.current;
    const pageSizeKey =
      tabKey === "records"
        ? itemsPerPage
        : tabKey === "tracking"
          ? trackingItemsPerPage
          : scheduleItemsPerPage;
    const cacheKey = [
      tabKey,
      period,
      periodStartDate,
      periodEndDate,
      activeSearch,
      pageKey,
      pageSizeKey,
      selectedInfantFocusId || "",
    ].join("_");
    const cached = tabDataCacheRef.current.get(cacheKey);
    const now = Date.now();

    // Check cache validity
    if (!force && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }

    setTabLoadingStates(prev => ({ ...prev, [tabKey]: !background }));

    try {
      let data = {};

      switch (tabKey) {
        case "records": {
          // Records tab: Load records and, when a child search is active, hydrate the
          // same schedule/reconciliation source used by Tracking and Schedule cards.
          const hasSearch = Boolean(activeSearch);
          const [
            recordPageData,
            summaryData,
            infantsData,
            schedulesData,
            reconciliationData,
          ] = await Promise.all([
            fetchVaccinationRecordPage({
              page: currentPageRef.current,
              search: searchQueryRef.current,
              signal,
            }),
            !isCustomRangeIncomplete ? fetchVaccinationSummaryData({ signal }) : Promise.resolve(null),
            hasSearch
              ? fetchInfantsChunked({ signal, limit: INFANT_CHUNK_SIZE, search: activeSearch })
              : Promise.resolve(null),
            hasSearch
              ? apiClient.getVaccinationSchedules({ date_view: viewMode })
              : Promise.resolve(null),
            hasSearch
              ? fetchVaccinationReconciliationRecords({ signal })
              : Promise.resolve(null),
          ]);

          data = {
            records: recordPageData?.rows || [],
            pagination: recordPageData?.metadata || {},
            summary: summaryData,
            sharedScope: hasSearch ? activeSearch : "",
            infants: Array.isArray(infantsData) ? infantsData : null,
            schedules: schedulesData
              ? normalizeVaccinationSchedulesResponse(schedulesData)
              : null,
            reconciliation: reconciliationData
              ? Array.isArray(reconciliationData)
                ? reconciliationData
                : normalizeVaccinationRecordsResponse(reconciliationData)
              : null,
          };
          break;
        }

        case "tracking": {
          const [trackingOverview, summaryData] = await Promise.all([
            fetchVaccinationTrackingOverview({
              page: trackingCurrentPageRef.current,
              search: searchQueryRef.current,
              signal,
            }),
            !isCustomRangeIncomplete
              ? fetchVaccinationSummaryData({ signal })
              : Promise.resolve(null),
          ]);

          data = {
            trackingOverviewRows: trackingOverview.rows,
            trackingOverviewSummary: trackingOverview.summary,
            trackingOverviewPagination: trackingOverview.metadata,
            infants: extractInfantsFromOverviewRows(trackingOverview.rows),
            summary: summaryData,
          };
          break;
        }

        case "schedule": {
          const [scheduleOverview, summaryData] = await Promise.all([
            fetchVaccinationScheduleOverview({
              page: scheduleCurrentPageRef.current,
              search: searchQueryRef.current,
              signal,
            }),
            !isCustomRangeIncomplete
              ? fetchVaccinationSummaryData({ signal })
              : Promise.resolve(null),
          ]);

          data = {
            scheduleOverviewRows: scheduleOverview.rows,
            scheduleOverviewSummary: scheduleOverview.summary,
            scheduleOverviewPagination: scheduleOverview.metadata,
            infants: extractInfantsFromOverviewRows(scheduleOverview.rows),
            summary: summaryData,
          };
          break;
        }
      }

      if (signal?.aborted) {
        return {};
      }

      // Cache the data
      tabDataCacheRef.current.set(cacheKey, {
        data,
        timestamp: now,
      });

      return data;
    } finally {
      if (!signal?.aborted) {
        setTabLoadingStates(prev => ({ ...prev, [tabKey]: false }));
      }
    }
  }, [
    fetchVaccinationRecordPage,
    fetchVaccinationSummaryData,
    fetchInfantsChunked,
    fetchVaccinationReconciliationRecords,
    fetchVaccinationTrackingOverview,
    fetchVaccinationScheduleOverview,
    isCustomRangeIncomplete,
    period,
    periodStartDate,
    periodEndDate,
    itemsPerPage,
    scheduleItemsPerPage,
    selectedInfantFocusId,
    trackingItemsPerPage,
    viewMode,
  ]);

  const fetchData = useCallback(
    async ({ silent = false, force = false } = {}) => {
      const currentActiveTab = activeTabRef.current;

      // Cancel any existing requests
      if (fetchStateRef.current.abortController) {
        fetchStateRef.current.abortController.abort();
      }

      const abortController = new AbortController();
      fetchStateRef.current.abortController = abortController;
      fetchStateRef.current.requestId += 1;
      const requestId = fetchStateRef.current.requestId;

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        // Load data for the current active tab
        const tabData = await fetchTabData(currentActiveTab, { signal: abortController.signal, force });

        if (abortController.signal.aborted || fetchStateRef.current.requestId !== requestId) {
          return;
        }

        // Update state based on tab data
        switch (currentActiveTab) {
          case "records":
            setRecordTableRows(tabData.records || []);
            setRecordTablePagination(tabData.pagination || {});
            if (tabData.summary) {
              setDashboardSummary(tabData.summary);
              stableDataLoadedAtRef.current.summary = Date.now();
            }
            if (tabData.infants) {
              setInfants(tabData.infants);
              stableDataLoadedAtRef.current.infants = Date.now();
            }
            if (tabData.schedules) {
              setVaccinationSchedules(tabData.schedules);
              stableDataLoadedAtRef.current.schedules = Date.now();
            }
            if (tabData.reconciliation) {
              setVaccinationRecords(tabData.reconciliation);
              stableDataLoadedAtRef.current.reconciliation = Date.now();
            }
            break;

          case "tracking":
            setTrackingOverviewRows(tabData.trackingOverviewRows || []);
            setTrackingOverviewSummary({
              ...DEFAULT_TRACKING_OVERVIEW_SUMMARY,
              ...(tabData.trackingOverviewSummary || {}),
            });
            setTrackingOverviewPagination({
              ...DEFAULT_OVERVIEW_PAGINATION,
              limit: trackingItemsPerPage,
              ...(tabData.trackingOverviewPagination || {}),
            });
            if (tabData.infants) {
              setInfants(tabData.infants);
              stableDataLoadedAtRef.current.infants = Date.now();
            }
            if (tabData.summary) {
              setDashboardSummary(tabData.summary);
              stableDataLoadedAtRef.current.summary = Date.now();
            }
            break;

          case "schedule":
            setScheduleOverviewRows(tabData.scheduleOverviewRows || []);
            setScheduleOverviewSummary({
              ...DEFAULT_SCHEDULE_OVERVIEW_SUMMARY,
              ...(tabData.scheduleOverviewSummary || {}),
            });
            setScheduleOverviewPagination({
              ...DEFAULT_OVERVIEW_PAGINATION,
              limit: scheduleItemsPerPage,
              ...(tabData.scheduleOverviewPagination || {}),
            });
            if (tabData.infants) {
              setInfants(tabData.infants);
              stableDataLoadedAtRef.current.infants = Date.now();
            }
            if (tabData.schedules) {
              setVaccinationSchedules(tabData.schedules);
              stableDataLoadedAtRef.current.schedules = Date.now();
            }
            if (tabData.reconciliation) {
              setVaccinationRecords(tabData.reconciliation);
              stableDataLoadedAtRef.current.reconciliation = Date.now();
            }
            if (tabData.summary) {
              setDashboardSummary(tabData.summary);
              stableDataLoadedAtRef.current.summary = Date.now();
            }
            break;
        }

        if (
          tabData.sharedScope !== undefined &&
          (tabData.infants || tabData.schedules || tabData.reconciliation)
        ) {
          sharedVaccinationDataScopeRef.current = tabData.sharedScope || "";
        }

        setTabDataLoaded(prev => ({ ...prev, [currentActiveTab]: true }));

      } catch (err) {
        if (abortController.signal.aborted || isAbortError(err)) return;
        if (fetchStateRef.current.requestId !== requestId) return;
        setError(err.message || "Failed to fetch vaccination dashboard data.");
      } finally {
        if (fetchStateRef.current.requestId === requestId) {
          setLoading(false);
          setRefreshing(false);
          if (fetchStateRef.current.abortController === abortController) {
            fetchStateRef.current.abortController = null;
          }
        }
      }
    },
    [fetchTabData],
  );

  const fetchDataRef = useRef(fetchData);
  // Keep fetchDataRef in sync so callers never hold a stale closure
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);
  // Memory management: Clean up old cache entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cache = tabDataCacheRef.current;

      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
          cache.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // When navigating back to the vaccinations module, force a refresh so we don't
  // render stale empty states gated by the in-memory TTL cache.
  useEffect(() => {
    const nextPath = String(location?.pathname || "");
    const prevPath = String(lastPathnameRef.current || "");
    lastPathnameRef.current = nextPath;

    const isVaccinationsRoute =
      nextPath.includes("/vaccination-management") ||
      nextPath.includes("/vaccinations");
    const wasVaccinationsRoute =
      prevPath.includes("/vaccination-management") || prevPath.includes("/vaccinations");

    if (isVaccinationsRoute && !wasVaccinationsRoute) {
      void fetchDataRef.current?.({ silent: true, force: true });
    }
  }, [location?.pathname]);

  useEffect(() => {
    void refreshVaccineInventory();
  }, [refreshVaccineInventory]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshVaccineInventory();
    }, pollingIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [refreshVaccineInventory]);

  // Mirror tabDataLoaded into a ref so the tab-switch effect can read the latest
  // value without adding the state object to its dependency array (which would
  // re-run the effect—and trigger another fetch—every time any fetch completes).
  useEffect(() => {
    tabDataLoadedRef.current = tabDataLoaded;
  }, [tabDataLoaded]);

  useEffect(() => {
    // Read via ref – must NOT be in the dependency array or every completed
    // fetch (which calls setTabDataLoaded) would re-trigger this effect,
    // creating the "Maximum update depth exceeded" loop.
    if (tabDataLoadedRef.current[activeTab]) {
      // Data already loaded, just ensure it's fresh
      void fetchDataRef.current?.({ silent: true });
    } else {
      // First time loading this tab, force load
      void fetchDataRef.current?.({ silent: true, force: true });
    }
  }, [activeTab]);

  useEffect(() => {
    if (!hasInitializedSearchEffectRef.current) {
      hasInitializedSearchEffectRef.current = true;
      return;
    }

    setCurrentPage(1);
    setScheduleCurrentPage(1);
    setTrackingCurrentPage(1);
    setRecordPageInputValue("1");
    setSchedulePageInputValue("1");
    setTrackingPageInputValue("1");
    currentPageRef.current = 1;
    scheduleCurrentPageRef.current = 1;
    trackingCurrentPageRef.current = 1;

    // Refetch derived views on search changes so clearing a child-scoped search
    // restores the full scoped infant set instead of keeping the last child slice.
    const currentTab = activeTabRef.current;
    if (["records", "tracking", "schedule"].includes(currentTab)) {
      void fetchDataRef.current?.({ silent: true, force: true });
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    if (!hasInitializedViewModeEffectRef.current) {
      hasInitializedViewModeEffectRef.current = true;
      return;
    }
    setCurrentPage(1);
    setScheduleCurrentPage(1);
    setTrackingCurrentPage(1);
    setRecordPageInputValue("1");
    setSchedulePageInputValue("1");
    setTrackingPageInputValue("1");
    currentPageRef.current = 1;
    scheduleCurrentPageRef.current = 1;
    trackingCurrentPageRef.current = 1;

    // Clear cache when view mode changes
    tabDataCacheRef.current.clear();
    setTabDataLoaded({ records: false, tracking: false, schedule: false });

    void fetchDataRef.current?.({ force: true });
  }, [viewMode]);

  useEffect(() => {
    if (!hasInitializedPeriodEffectRef.current) {
      hasInitializedPeriodEffectRef.current = true;
      return;
    }
    setCurrentPage(1);
    setScheduleCurrentPage(1);
    setTrackingCurrentPage(1);
    setRecordPageInputValue("1");
    setSchedulePageInputValue("1");
    setTrackingPageInputValue("1");
    currentPageRef.current = 1;
    scheduleCurrentPageRef.current = 1;
    trackingCurrentPageRef.current = 1;

    // Clear cache when period changes
    tabDataCacheRef.current.clear();
    setTabDataLoaded({ records: false, tracking: false, schedule: false });

    void fetchDataRef.current?.({
      silent: true,
      force: true,
    });
  }, [period, periodEndDate, periodStartDate]);

  useEffect(() => {
    if (!hasInitializedRecordPageEffectRef.current) {
      hasInitializedRecordPageEffectRef.current = true;
      return;
    }

    // Pagination change within records tab - fetch new page
    if (activeTab === "records") {
      void fetchDataRef.current?.({ silent: true });
    }
  }, [currentPage]);

  useEffect(() => {
    const previousPage = previousTrackingPageRef.current;
    previousTrackingPageRef.current = trackingCurrentPage;

    if (previousPage !== trackingCurrentPage && activeTab === "tracking") {
      void fetchDataRef.current?.({ silent: true });
    }
  }, [activeTab, trackingCurrentPage]);

  useEffect(() => {
    const previousPage = previousSchedulePageRef.current;
    previousSchedulePageRef.current = scheduleCurrentPage;

    if (previousPage !== scheduleCurrentPage && activeTab === "schedule") {
      void fetchDataRef.current?.({ silent: true });
    }
  }, [activeTab, scheduleCurrentPage]);

  useEffect(() => {
    if (!hasInitializedSelectedInfantEffectRef.current) {
      hasInitializedSelectedInfantEffectRef.current = true;
      return;
    }

    const currentTab = activeTabRef.current;
    if (currentTab !== "tracking" && currentTab !== "schedule") {
      return;
    }

    setScheduleCurrentPage(1);
    setTrackingCurrentPage(1);
    scheduleCurrentPageRef.current = 1;
    trackingCurrentPageRef.current = 1;
    tabDataCacheRef.current.clear();
    void fetchDataRef.current?.({ silent: true, force: true });
  }, [selectedInfantFocusId]);

  const handleVaccinationSocketChange = useCallback(() => {
    if (socketRefreshTimeoutRef.current) {
      return;
    }
    socketRefreshTimeoutRef.current = window.setTimeout(() => {
      socketRefreshTimeoutRef.current = null;
      void fetchDataRef.current?.({ silent: true, force: true });
    }, 300);
  }, []);

  useVaccinationSocket({
    setVaccinations: setVaccinationRecords,
    onChange: handleVaccinationSocketChange,
  });

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setAddModalPrefill(null);
  }, []);

  const handleAddModalSuccess = useCallback(() => {
    setMutationInFlight(true);
    activateVaccinationTab("records");
    currentPageRef.current = 1;
    setCurrentPage(1);
    void fetchDataRef.current?.({ silent: true, force: true }).finally(() => {
      setMutationInFlight(false);
    });
  }, [activateVaccinationTab]);

  const handleAddVaccination = useCallback(() => {
    setAddModalPrefill({
      date_administered: formatDateInputValue(new Date()),
      status: "completed",
    });
    setShowAddModal(true);
  }, []);

  const routeToCanonicalRecordVaccinations = useCallback(
    ({ infant, infantId, vaccineId, doseNumber, dueDate } = {}) => {
      const prefillInfant = buildInfantRecordPrefillContext(
        infant || (infantId ? { id: infantId } : {}),
      );

      setAddModalPrefill({
        ...prefillInfant,
        ...(infantId ? { infant_id: Number(infantId) } : {}),
        ...(vaccineId ? { vaccine_id: Number(vaccineId) } : {}),
        ...(doseNumber ? { dose_number: Number(doseNumber) } : {}),
        date_administered: formatDateInputValue(new Date()),
        next_due_date: formatDateInputValue(dueDate),
        status: "completed",
      });
      setShowAddModal(true);
    },
    [],
  );

  const handleEditRecord = (record) => {
    const administeredByName = String(
      record.administered_by_name || record.provider_name || record.health_care_provider || "",
    ).trim();
    const administeredByRole = String(
      record.administered_by_role || record.provider_role || "",
    ).trim();

    setVaccinationForm({
      id: record.id,
      infant_id: record.infant_id,
      vaccine_id: record.vaccine_id,
      dose_no: record.dose_no || 1,
      admin_date: record.admin_date ? String(record.admin_date).slice(0, 10) : "",
      next_due_date: record.next_due_date
        ? String(record.next_due_date).slice(0, 10)
        : "",
      administered_by: record.administered_by ? String(record.administered_by) : "",
      administered_by_role: administeredByRole,
      administered_by_search: administeredByName,
      batch_id: record.batch_id ? String(record.batch_id) : "",
      inventory_record_id: "",
      lot_batch_number:
        resolveLotBatchValue(record.lot_batch_number, record.batch_number, record.lot_number) ||
        "",
      status: record.status || "pending",
      notes: record.notes || "",
    });
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!vaccinationForm.id) {
      setError("New records must be created from Infant Management → Record Vaccinations.");
      return;
    }

    try {
      setSaving(true);
      setMutationInFlight(true);
      setError(null);

      const administeredByValue = Number(vaccinationForm.administered_by);
      const administeredById =
        Number.isFinite(administeredByValue) && administeredByValue > 0
          ? administeredByValue
          : null;

      const payload = {
        patient_id: Number(vaccinationForm.infant_id),
        vaccine_id: Number(vaccinationForm.vaccine_id),
        dose_no: Number(vaccinationForm.dose_no || 1),
        admin_date: vaccinationForm.admin_date || null,
        next_due_date: vaccinationForm.next_due_date || null,
        notes: vaccinationForm.notes || null,
        status: vaccinationForm.status || "pending",
        ...(administeredById ? { administered_by: administeredById } : {}),
      };

      const updated = await apiClient.updateVaccinationRecord(vaccinationForm.id, payload);
      const normalizedUpdated = normalizeVaccinationRecordResponse(updated);
      setVaccinationRecords((prev) =>
        prev.map((row) => (row.id === normalizedUpdated.id ? normalizedUpdated : row)),
      );

      await fetchDataRef.current?.({ silent: true, force: true });
      setShowEditModal(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save vaccination record.");
    } finally {
      setMutationInFlight(false);
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    try {
      setDeletingRecordId(recordId);
      setMutationInFlight(true);
      setError(null);
      await apiClient.deleteVaccinationRecord(recordId);
      setVaccinationRecords((prev) => prev.filter((record) => record.id !== recordId));
      setRecordTableRows((prev) => prev.filter((record) => record.id !== recordId));
      await fetchDataRef.current?.({ silent: true, force: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to delete vaccination record.");
    } finally {
      setMutationInFlight(false);
      setDeletingRecordId(null);
    }
  };

  const filteredRecords = recordTableRows;
  const shouldShowRecordTableLoading =
    (tabLoadingStates.records || refreshing) && recordTableRows.length === 0;
  const paginatedRecords = recordTableRows;
  const totalPages = Math.max(
    1,
    Number(recordTablePagination?.totalPages || 0) || 1,
  );
  const totalRecordRows =
    Number(recordTablePagination?.total || recordTableRows.length || 0) || 0;
  const visibleRecordStart =
    totalRecordRows > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const visibleRecordEnd =
    totalRecordRows > 0
      ? Math.min(currentPage * itemsPerPage, totalRecordRows)
      : 0;
  const recordRowsPerPageOptions = useMemo(
    () => buildRowsPerPageOptions(DEFAULT_RECORDS_ITEMS_PER_PAGE),
    [],
  );
  const scheduleRowsPerPageOptions = useMemo(
    () => buildRowsPerPageOptions(DEFAULT_SCHEDULE_ITEMS_PER_PAGE),
    [],
  );
  const trackingRowsPerPageOptions = useMemo(
    () => buildRowsPerPageOptions(DEFAULT_TRACKING_ITEMS_PER_PAGE),
    [],
  );

  const vaccinationRecordsByInfantId = useMemo(() => {
    const groupedRecords = new Map();

    vaccinationRecords.forEach((record) => {
      const infantId = Number(record.infant_id || record.patient_id || 0);
      if (!infantId) {
        return;
      }

      const existingRecords = groupedRecords.get(infantId) || [];
      existingRecords.push(record);
      groupedRecords.set(infantId, existingRecords);
    });

    return groupedRecords;
  }, [vaccinationRecords]);

  const selectedInfantRecords = useMemo(() => {
    if (activeTab !== "tracking" || !selectedInfantId) return [];
    return vaccinationRecordsByInfantId.get(Number(selectedInfantId)) || [];
  }, [activeTab, selectedInfantId, vaccinationRecordsByInfantId]);

  const approvedVaccinationSchedules = useMemo(
    () => vaccinationSchedules.filter((schedule) => isApprovedVaccineName(schedule.vaccine_name)),
    [vaccinationSchedules],
  );

  const shouldComputeScheduleViews =
    activeTab === "schedule" ||
    (activeTab === "records" && shouldUseChildProgressScope) ||
    (!dashboardSummary && activeTab !== "tracking");
  const shouldComputeTrackingViews = activeTab === "tracking";
  const isUsingServerTrackingOverview = activeTab === "tracking" && tabDataLoaded.tracking;
  const isUsingServerScheduleOverview = activeTab === "schedule" && tabDataLoaded.schedule;

  const allScheduleOverviewRows = useMemo(() => {
    if (isUsingServerScheduleOverview) {
      return scheduleOverviewRows;
    }

    if (!shouldComputeScheduleViews || isBlockedTodayView) {
      return [];
    }

    const statusPriority = {
      overdue: 0,
      due: 1,
      upcoming: 2,
      completed: 3,
    };

    const rows = infants.flatMap((infant) => {
      const infantRecords = vaccinationRecordsByInfantId.get(infant.id) || [];

      const summary = computeVaccinationComplianceSummary({
        schedules: approvedVaccinationSchedules,
        records: infantRecords,
        infantDob: infant.dob,
        includeFutureSeedData: false,
      });

      return summary.timeline.map((entry) => {
        const statusKey = classifyScheduleDoseStatus(entry);
        const infantDisplayName = getInfantDisplayLabel(infant);
        const infantControlNumber = getInfantControlNumber(infant);
        const infantSearchText = buildInfantSearchText(infant);

        return {
          row_id: `${infant.id}-${entry.vaccine_id || entry.vaccine_name}-${entry.dose_number}`,
          infant_id: infant.id,
          infant_context: infant,
          infant_name: infantDisplayName,
          infant_display_name: infantDisplayName,
          infant_full_name: infantDisplayName,
          infant_control_number: infantControlNumber,
          infant_dob: infant.dob || null,
          search_text: infantSearchText,
          vaccine_id: Number(entry.vaccine_id || 0) || null,
          vaccine_name: entry.vaccine_name || "Unknown Vaccine",
          disease_prevented: entry.disease_prevented || "-",
          age_in_months: Number(entry.age_in_months || 0),
          age_label: formatAgeLabel(entry.age_in_months),
          dose_number: Number(entry.dose_number || entry.dose_no || 1),
          due_date: entry.due_date || null,
          admin_date: entry.admin_date || null,
          status_key: statusKey,
          status_label: `${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`,
        };
      });
    });

    return rows.sort((left, right) => {
      const statusSort =
        Number(statusPriority[left.status_key] ?? 99) -
        Number(statusPriority[right.status_key] ?? 99);
      if (statusSort !== 0) return statusSort;

      if (left.due_date && right.due_date) {
        const dueSort = new Date(left.due_date).getTime() - new Date(right.due_date).getTime();
        if (dueSort !== 0) return dueSort;
      } else if (left.due_date) {
        return -1;
      } else if (right.due_date) {
        return 1;
      }

      const infantSort = String(left.infant_name).localeCompare(String(right.infant_name));
      if (infantSort !== 0) return infantSort;

      const vaccineSort = String(left.vaccine_name).localeCompare(String(right.vaccine_name));
      if (vaccineSort !== 0) return vaccineSort;

      return Number(left.dose_number || 0) - Number(right.dose_number || 0);
    });
  }, [
    approvedVaccinationSchedules,
    infants,
    isBlockedTodayView,
    isUsingServerScheduleOverview,
    scheduleOverviewRows,
    shouldComputeScheduleViews,
    vaccinationRecordsByInfantId,
  ]);

  const filteredScheduleOverviewRows = useMemo(() => {
    if (!shouldComputeScheduleViews || isBlockedTodayView || !allScheduleOverviewRows.length) {
      return [];
    }

    if (isUsingServerScheduleOverview) {
      return allScheduleOverviewRows;
    }

    return allScheduleOverviewRows.filter((row) => {
      if (selectedInfantFocusId && Number(row.infant_id) !== selectedInfantFocusId) {
        return false;
      }

      if (!isDoseInCompliancePeriod(row, periodRange)) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      const searchableText = [
        row.search_text,
        row.infant_name,
        row.infant_dob,
        row.vaccine_name,
        row.disease_prevented,
        row.status_label,
        row.age_label,
        row.dose_number,
      ]
        .join(" ")
        .toLowerCase();

      return matchesTokenizedSearch(searchableText, normalizedSearchQuery);
    });
  }, [
    allScheduleOverviewRows,
    isUsingServerScheduleOverview,
    isBlockedTodayView,
    normalizedSearchQuery,
    periodRange,
    selectedInfantFocusId,
    shouldComputeScheduleViews,
  ]);

  const trackingComplianceSnapshots = useMemo(() => {
    if (!shouldComputeTrackingViews || isBlockedTodayView) {
      return [];
    }

    return trackingVisibleInfants.map((infant) => {
      const infantRecords = vaccinationRecordsByInfantId.get(infant.id) || [];

      const summary = computeVaccinationComplianceSummary({
        schedules: approvedVaccinationSchedules,
        records: infantRecords,
        infantDob: infant.dob,
        includeFutureSeedData: false,
      });

      return {
        infant,
        ...summary,
      };
    });
  }, [
    approvedVaccinationSchedules,
    isBlockedTodayView,
    shouldComputeTrackingViews,
    trackingVisibleInfants,
    vaccinationRecordsByInfantId,
  ]);

  const filteredTrackingRows = useMemo(() => {
    if (isUsingServerTrackingOverview) {
      return trackingOverviewRows;
    }

    if (!shouldComputeTrackingViews || isBlockedTodayView || !trackingComplianceSnapshots.length) {
      return [];
    }

    const scopedSnapshots = trackingComplianceSnapshots
      .map((snapshot) => filterTrackingSnapshotByPeriod(snapshot, periodRange))
      .filter((snapshot) => snapshot.timeline.length > 0);

    const infantScopedSnapshots = selectedInfantFocusId
      ? scopedSnapshots.filter(
          ({ infant }) => Number.parseInt(infant?.id, 10) === selectedInfantFocusId,
        )
      : scopedSnapshots;

    if (!normalizedSearchQuery) {
      return infantScopedSnapshots;
    }

    return infantScopedSnapshots.filter(({ infant }) => {
      const searchableText = buildInfantSearchText(infant);

      return matchesTokenizedSearch(searchableText, normalizedSearchQuery);
    });
  }, [
    isBlockedTodayView,
    isUsingServerTrackingOverview,
    normalizedSearchQuery,
    periodRange,
    selectedInfantFocusId,
    shouldComputeTrackingViews,
    trackingComplianceSnapshots,
    trackingOverviewRows,
  ]);

  const scheduleStatusSummary = useMemo(
    () => {
      if (!shouldComputeScheduleViews || activeTab !== "schedule") {
        return {
          upcoming: 0,
          due: 0,
          completed: 0,
          overdue: 0,
        };
      }

      if (isUsingServerScheduleOverview) {
        return {
          upcoming: scheduleOverviewSummary.upcoming,
          due: scheduleOverviewSummary.due,
          completed: scheduleOverviewSummary.completed,
          overdue: scheduleOverviewSummary.overdue,
        };
      }

      return filteredScheduleOverviewRows.reduce(
        (summary, row) => {
          if (summary[row.status_key] !== undefined) {
            summary[row.status_key] += 1;
          }
          return summary;
        },
        {
          upcoming: 0,
          due: 0,
          completed: 0,
          overdue: 0,
        },
      );
    },
    [
      activeTab,
      filteredScheduleOverviewRows,
      isUsingServerScheduleOverview,
      scheduleOverviewSummary,
      shouldComputeScheduleViews,
    ],
  );

  const dashboardStats = useMemo(() => {
    if (activeTab === "records" && shouldUseChildProgressScope) {
      const completedFromRecords =
        Number(recordTablePagination?.completed || 0) ||
        recordTableRows.filter(isCompletedVaccinationRecord).length;
      const uniqueInfantIds = new Set();
      let dueSoon = 0;
      let overdue = 0;

      recordTableRows.forEach((record) => {
        const recordInfantId = Number(record.infant_id || record.patient_id || 0);
        if (recordInfantId > 0) {
          uniqueInfantIds.add(recordInfantId);
        }
      });

      filteredScheduleOverviewRows.forEach((row) => {
        const rowInfantId = Number(row.infant_id || 0);
        if (rowInfantId > 0) {
          uniqueInfantIds.add(rowInfantId);
        }

        if (row.status_key === "due") {
          dueSoon += 1;
        } else if (row.status_key === "overdue") {
          overdue += 1;
        }
      });

      return {
        completed: completedFromRecords,
        dueSoon,
        overdue,
        trackedInfants: uniqueInfantIds.size,
      };
    }

    const summarySource = !shouldUseChildProgressScope ? dashboardSummary || null : null;

    if (summarySource) {
      return {
        completed: Number(summarySource.administeredInPeriod ?? summarySource.completedDoseTotal ?? summarySource.completedToday ?? 0),
        dueSoon: Number(summarySource.dueSoon7Days ?? summarySource.dueToday ?? 0),
        overdue: Number(summarySource.overdueVaccinations ?? summarySource.overdue ?? 0),
        trackedInfants: Number(
          summarySource.totalRegisteredInfants ??
            summarySource.uniqueInfantsServed ??
            summarySource.infants ??
            0,
        ),
      };
    }

    if (activeTab === "tracking" && isUsingServerTrackingOverview) {
      return {
        completed: trackingOverviewSummary.completed,
        dueSoon: trackingOverviewSummary.dueSoon,
        overdue: trackingOverviewSummary.overdue,
        trackedInfants: trackingOverviewSummary.trackedInfants,
      };
    }

    if (activeTab === "schedule" && isUsingServerScheduleOverview) {
      return {
        completed: scheduleOverviewSummary.completed,
        dueSoon: scheduleOverviewSummary.due,
        overdue: scheduleOverviewSummary.overdue,
        trackedInfants: scheduleOverviewSummary.trackedInfants,
      };
    }

    const today = normalizeDateToStartOfDay(new Date());
    const dueSoonWindow = new Date(today || new Date());
    dueSoonWindow.setUTCDate(dueSoonWindow.getUTCDate() + 7);
    dueSoonWindow.setUTCHours(0, 0, 0, 0);

    if (activeTab === "tracking") {
      if (!filteredTrackingRows.length) {
        return {
          completed: 0,
          dueSoon: 0,
          overdue: 0,
          trackedInfants: 0,
        };
      }

      let completed = 0;
      let dueSoon = 0;
      let overdue = 0;

      filteredTrackingRows.forEach(({ timeline }) => {
        timeline.forEach((entry) => {
          const statusKey = classifyScheduleDoseStatus(entry);

          if (statusKey === "completed") {
            completed += 1;
            return;
          }

          if (statusKey === "overdue") {
            overdue += 1;
            return;
          }

          if (!entry.due_date) {
            return;
          }

          const dueDate = normalizeDateToStartOfDay(entry.due_date);
          if (!dueDate || !today) {
            return;
          }

          if (dueDate.getTime() >= today.getTime() && dueDate.getTime() <= dueSoonWindow.getTime()) {
            dueSoon += 1;
          }
        });
      });

      return {
        completed,
        dueSoon,
        overdue,
        trackedInfants: filteredTrackingRows.length,
      };
    }

    if (!filteredScheduleOverviewRows.length) {
      return {
        completed: 0,
        dueSoon: 0,
        overdue: 0,
        trackedInfants: 0,
      };
    }

    const uniqueInfantIds = new Set();
    let completed = 0;
    let dueSoon = 0;
    let overdue = 0;

    filteredScheduleOverviewRows.forEach((row) => {
      uniqueInfantIds.add(row.infant_id);

      if (row.status_key === "completed") {
        completed += 1;
      } else if (row.status_key === "overdue") {
        overdue += 1;
      }

      if (!row.due_date || row.status_key === "completed" || row.status_key === "overdue") {
        return;
      }

      const dueDate = normalizeDateToStartOfDay(row.due_date);
      if (!dueDate || !today) {
        return;
      }

      if (dueDate.getTime() >= today.getTime() && dueDate.getTime() <= dueSoonWindow.getTime()) {
        dueSoon += 1;
      }
    });

    return {
      completed,
      dueSoon,
      overdue,
      trackedInfants: uniqueInfantIds.size,
    };
  }, [
    activeTab,
    dashboardSummary,
    filteredScheduleOverviewRows,
    filteredTrackingRows,
    isUsingServerScheduleOverview,
    isUsingServerTrackingOverview,
    recordTablePagination?.completed,
    recordTableRows,
    scheduleOverviewSummary,
    shouldUseChildProgressScope,
    trackingOverviewSummary,
  ]);

  const shouldShowDashboardStatsSkeleton = useMemo(() => {
    if (activeTab === "records") {
      return (tabLoadingStates.records || refreshing) && !dashboardSummary;
    }

    return (
      (tabLoadingStates[activeTab] || refreshing) &&
      dashboardStats.completed === 0 &&
      dashboardStats.dueSoon === 0 &&
      dashboardStats.overdue === 0 &&
      dashboardStats.trackedInfants === 0
    );
  }, [
    activeTab,
    dashboardStats.completed,
    dashboardStats.dueSoon,
    dashboardStats.overdue,
    dashboardStats.trackedInfants,
    dashboardSummary,
    infantsLoading,
    loading,
    recordsHydrationLoading,
    refreshing,
  ]);

  const paginatedScheduleRows = useMemo(() => {
    if (activeTab !== "schedule") {
      return [];
    }

    if (isUsingServerScheduleOverview) {
      return filteredScheduleOverviewRows;
    }

    const startIndex = (scheduleCurrentPage - 1) * scheduleItemsPerPage;
    return filteredScheduleOverviewRows.slice(startIndex, startIndex + scheduleItemsPerPage);
  }, [
    activeTab,
    filteredScheduleOverviewRows,
    isUsingServerScheduleOverview,
    scheduleCurrentPage,
    scheduleItemsPerPage,
  ]);
  const scheduleTotalPages = activeTab === "schedule"
    ? isUsingServerScheduleOverview
      ? scheduleOverviewPagination.totalPages
      : Math.ceil(filteredScheduleOverviewRows.length / scheduleItemsPerPage)
    : 0;
  const scheduleTotalRows = isUsingServerScheduleOverview
    ? scheduleOverviewPagination.total
    : filteredScheduleOverviewRows.length;
  const scheduleDisplayPage = isUsingServerScheduleOverview
    ? scheduleOverviewPagination.page || scheduleCurrentPage
    : scheduleCurrentPage;

  const paginatedComplianceRows = useMemo(() => {
    if (!shouldComputeTrackingViews) {
      return [];
    }

    if (isUsingServerTrackingOverview) {
      return filteredTrackingRows;
    }

    const startIndex = (trackingCurrentPage - 1) * trackingItemsPerPage;
    return filteredTrackingRows.slice(startIndex, startIndex + trackingItemsPerPage);
  }, [
    filteredTrackingRows,
    isUsingServerTrackingOverview,
    shouldComputeTrackingViews,
    trackingCurrentPage,
    trackingItemsPerPage,
  ]);
  const trackingTotalPages = shouldComputeTrackingViews
    ? isUsingServerTrackingOverview
      ? trackingOverviewPagination.totalPages
      : Math.ceil(filteredTrackingRows.length / trackingItemsPerPage)
    : 0;
  const trackingTotalRows = isUsingServerTrackingOverview
    ? trackingOverviewPagination.total
    : filteredTrackingRows.length;
  const trackingDisplayPage = isUsingServerTrackingOverview
    ? trackingOverviewPagination.page || trackingCurrentPage
    : trackingCurrentPage;

  useEffect(() => {
    if (activeTab !== "schedule") {
      return;
    }

    if (scheduleTotalPages === 0) {
      if (scheduleCurrentPage !== 1) {
        setScheduleCurrentPage(1);
      }
      return;
    }

    if (scheduleCurrentPage > scheduleTotalPages) {
      setScheduleCurrentPage(scheduleTotalPages);
    }
  }, [activeTab, scheduleCurrentPage, scheduleTotalPages]);

  useEffect(() => {
    if (!shouldComputeTrackingViews) {
      return;
    }

    if (trackingTotalPages === 0) {
      if (trackingCurrentPage !== 1) {
        setTrackingCurrentPage(1);
      }
      return;
    }

    if (trackingCurrentPage > trackingTotalPages) {
      setTrackingCurrentPage(trackingTotalPages);
    }
  }, [shouldComputeTrackingViews, trackingCurrentPage, trackingTotalPages]);

  useEffect(() => {
    if (
      activeTab === "records" &&
      recordTablePagination.totalPages > 0 &&
      currentPage > recordTablePagination.totalPages
    ) {
      setCurrentPage(recordTablePagination.totalPages);
    }
  }, [activeTab, currentPage, recordTablePagination.totalPages]);

  const handleRecordPageJumpSubmit = useCallback(() => {
    const nextPage = Number.parseInt(recordPageInputValue, 10);
    if (!Number.isFinite(nextPage)) {
      setRecordPageInputValue(String(currentPage || 1));
      return;
    }

    const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
    setCurrentPage(clampedPage);
    setRecordPageInputValue(String(clampedPage));
  }, [currentPage, recordPageInputValue, totalPages]);

  const handleSchedulePageJumpSubmit = useCallback(() => {
    const nextPage = Number.parseInt(schedulePageInputValue, 10);
    if (!Number.isFinite(nextPage)) {
      setSchedulePageInputValue(String(scheduleCurrentPage || 1));
      return;
    }

    const clampedPage = Math.min(Math.max(nextPage, 1), Math.max(scheduleTotalPages, 1));
    setScheduleCurrentPage(clampedPage);
    setSchedulePageInputValue(String(clampedPage));
  }, [scheduleCurrentPage, schedulePageInputValue, scheduleTotalPages]);

  const handleTrackingPageJumpSubmit = useCallback(() => {
    const nextPage = Number.parseInt(trackingPageInputValue, 10);
    if (!Number.isFinite(nextPage)) {
      setTrackingPageInputValue(String(trackingCurrentPage || 1));
      return;
    }

    const clampedPage = Math.min(Math.max(nextPage, 1), Math.max(trackingTotalPages, 1));
    setTrackingCurrentPage(clampedPage);
    setTrackingPageInputValue(String(clampedPage));
  }, [trackingCurrentPage, trackingPageInputValue, trackingTotalPages]);

  const hasPrimaryTabData =
    activeTab === "records"
      ? recordTableRows.length > 0
      : activeTab === "tracking"
        ? tabDataLoaded.tracking || trackingOverviewRows.length > 0
        : activeTab === "schedule"
          ? tabDataLoaded.schedule || scheduleOverviewRows.length > 0
      : vaccinationSchedules.length > 0 ||
        infants.length > 0 ||
        vaccinationRecords.length > 0;

  if (loading && !hasPrimaryTabData) {
    return (
      <div className="space-y-8 p-6">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} className="h-24" />
          ))}
        </div>
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <SkeletonTable rows={10} columns={6} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Comprehensive Vaccination Management"
          subtitle="Track, record, and manage all vaccination activities for pediatric patients"
          icon={Syringe}
        />
      </div>

      <div className="flex-1 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 overflow-hidden space-y-4">
      {error && (
        <Alert variant="error" title="Vaccination module error" className="flex-shrink-0">
          {error}
          <div className="mt-4">
            <Button
              size="sm"
              onClick={() => void fetchDataRef.current?.({ silent: true, force: true })}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Tab Navigation and Controls */}
      <div className="flex-shrink-0 z-20 bg-white dark:bg-gray-900">
        <div className="border-b border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row xl:items-center justify-between px-4 py-3 gap-4">
          <nav className="flex space-x-2 overflow-x-auto bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            {[
              { key: "records", label: "Vaccination Records", icon: "💉" },
              { key: "tracking", label: "Vaccination Tracking", icon: "📊" },
              { key: "schedule", label: "Vaccination Schedule", icon: "📅" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => activateVaccinationTab(tab.key)}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-end gap-3 mt-3 xl:mt-0">
            <div className="w-full sm:w-64 relative flex-shrink-0">
              <Input
                placeholder="Search vaccinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
                containerClassName="mb-0"
              />
              {activeTab === "records" && normalizedSearchQuery ? (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Metrics and records are scoped to "{normalizedSearchQuery}".
                </div>
              ) : null}
            </div>
            <VaccinationPeriodFilter
              period={period}
              startDate={periodStartDate}
              endDate={periodEndDate}
              onPeriodChange={(nextPeriod) => setPeriod(normalizeVaccinationPeriod(nextPeriod))}
              onStartDateChange={setPeriodStartDate}
              onEndDateChange={setPeriodEndDate}
            />
            {isCustomRangeIncomplete && period === "custom" ? (
              <div className="w-full text-xs text-amber-700 dark:text-amber-300">
                Please select a start and end date to load analytics.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 xl:mt-0">
            {refreshing && (
              <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline-block">Refreshing...</span>
            )}
            {mutationInFlight && (
              <span className="text-xs text-primary-600 dark:text-primary-400 hidden md:inline-block">
                Syncing latest changes...
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void fetchDataRef.current?.({ silent: true, force: true })}
              disabled={refreshing}
              title="Refresh vaccinations"
            >
              <span className="mr-1">🔄</span> {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            {isAdmin && (
              <Button onClick={handleAddVaccination} size="sm">
                <span className="mr-1">➕</span> Add
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          {shouldShowDashboardStatsSkeleton ? (
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
          ) : (
            <div className="text-xl sm:text-2xl font-bold text-success-600">{dashboardStats.completed}</div>
          )}
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Completed Vaccinations
          </p>
        </Card>
        <Card className="p-4 text-center">
          {shouldShowDashboardStatsSkeleton ? (
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
          ) : (
            <div className="text-xl sm:text-2xl font-bold text-warning-600">{dashboardStats.dueSoon}</div>
          )}
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Due Soon (7 Days)
          </p>
        </Card>
        <Card className="p-4 text-center">
          {shouldShowDashboardStatsSkeleton ? (
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
          ) : (
            <div className="text-xl sm:text-2xl font-bold text-danger-600">{dashboardStats.overdue}</div>
          )}
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Overdue Vaccinations
          </p>
        </Card>
        <Card className="p-4 text-center">
          {shouldShowDashboardStatsSkeleton ? (
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
          ) : (
            <div className="text-xl sm:text-2xl font-bold text-info-600">{dashboardStats.trackedInfants}</div>
          )}
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Children Tracked</p>
        </Card>
      </div>

      {activeTab === "schedule" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Schedule Overview
          </h3>

          {tabLoadingStates.schedule && !tabDataLoaded.schedule && scheduleOverviewRows.length === 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading vaccination schedule data...
              </div>
              <SkeletonTable rows={8} columns={9} />
            </div>
          ) : !isUsingServerScheduleOverview && recordsHydrationLoading && vaccinationRecords.length === 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading vaccination history for schedule reconciliation...
              </div>
              <SkeletonTable rows={8} columns={9} />
            </div>
          ) : !isUsingServerScheduleOverview && approvedVaccinationSchedules.length === 0 ? (
            <EmptyState
              title="No vaccination schedules"
              description="No active schedule definitions were returned by the backend."
              icon="📅"
              className="border-none shadow-none py-12"
            />
          ) : !isUsingServerScheduleOverview && infants.length === 0 ? (
            <EmptyState
              title="No infants tracked"
              description="There are no infants registered in the system yet."
              icon="👶"
              className="border-none shadow-none py-12"
            />
          ) : filteredScheduleOverviewRows.length === 0 ? (
            <EmptyState
              title={debouncedSearchQuery ? "No matching schedule rows" : "No schedule rows available"}
              description={
                debouncedSearchQuery
                  ? `No infant dose schedules matched "${debouncedSearchQuery}".`
                  : "No infant schedule rows are available to display right now."
              }
              icon="📅"
              className="border-none shadow-none py-12"
            />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{scheduleStatusSummary.upcoming}</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Upcoming</p>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-yellow-600">{scheduleStatusSummary.due}</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Due</p>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{scheduleStatusSummary.completed}</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Completed</p>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-lg font-bold text-red-600">{scheduleStatusSummary.overdue}</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Overdue</p>
                </Card>
              </div>

              <div className="flex-1 overflow-auto auto-hide-scrollbar">
              <table className="w-full relative">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Child Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Vaccine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Disease Prevented
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Recommended Age
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Dose #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date Administered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedScheduleRows.map((scheduleRow) => (
                    <tr key={scheduleRow.row_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        <div>{scheduleRow.infant_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {scheduleRow.infant_dob
                            ? `DOB: ${new Date(scheduleRow.infant_dob).toLocaleDateString()}`
                            : "DOB unavailable"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {scheduleRow.vaccine_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {scheduleRow.disease_prevented || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {scheduleRow.age_label}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {scheduleRow.dose_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {scheduleRow.due_date
                          ? new Date(scheduleRow.due_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {scheduleRow.admin_date
                          ? new Date(scheduleRow.admin_date).toLocaleDateString()
                          : "Not administered"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClassName(
                            scheduleRow.status_key,
                          )}`}
                        >
                          {scheduleRow.status_label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {isAdmin && scheduleRow.status_key !== "completed" ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              routeToCanonicalRecordVaccinations({
                                infant: scheduleRow.infant_context,
                                infantId: scheduleRow.infant_id,
                                vaccineId: scheduleRow.vaccine_id,
                                doseNumber: scheduleRow.dose_number,
                                dueDate: scheduleRow.due_date,
                              })
                            }
                          >
                            Record
                          </Button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <VaccinationPaginationFooter
              totalItems={scheduleTotalRows}
              visibleStart={
                scheduleTotalRows > 0
                  ? (scheduleDisplayPage - 1) * scheduleItemsPerPage + 1
                  : 0
              }
              visibleEnd={
                scheduleTotalRows > 0
                  ? Math.min(scheduleDisplayPage * scheduleItemsPerPage, scheduleTotalRows)
                  : 0
              }
              itemLabel="schedule rows"
              currentPage={scheduleDisplayPage}
              totalPages={scheduleTotalPages}
              rowsPerPage={scheduleItemsPerPage}
              rowsPerPageOptions={scheduleRowsPerPageOptions}
              pageInputId="vaccination-schedule-page-jump"
              pageInputValue={schedulePageInputValue}
              onPageInputChange={(event) => setSchedulePageInputValue(event.target.value)}
              onPageInputKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSchedulePageJumpSubmit();
                }
              }}
              onPageJumpSubmit={handleSchedulePageJumpSubmit}
              onRowsPerPageChange={(event) => {
                const nextPageSize =
                  Number(event.target.value) || DEFAULT_SCHEDULE_ITEMS_PER_PAGE;
                setScheduleItemsPerPage(nextPageSize);
                setScheduleCurrentPage(1);
                setSchedulePageInputValue("1");
              }}
              onPrevious={() => setScheduleCurrentPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                setScheduleCurrentPage((p) => Math.min(scheduleTotalPages, p + 1))
              }
              disablePrevious={scheduleCurrentPage === 1}
              disableNext={scheduleCurrentPage === scheduleTotalPages}
            />
            </>
          )}
        </div>
      )}

      {activeTab === "records" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Records
          </h3>

          {shouldShowRecordTableLoading ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading vaccination records...
              </div>
              <SkeletonTable rows={8} columns={9} />
            </div>
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              title={searchQuery ? "No matching records" : "No vaccination records"}
              description={
                searchQuery
                  ? `We couldn't find any vaccination records matching "${searchQuery}".`
                  : "There are no vaccination records in the system yet."
              }
              icon="💉"
              actionLabel={searchQuery ? "Clear Search" : "Add Vaccination"}
              onAction={
                searchQuery ? () => setSearchQuery("") : handleAddVaccination
              }
              className="border-none shadow-none py-12"
            />
          ) : (
            <>
            <div className="flex-1 overflow-auto auto-hide-scrollbar">
              <table className="w-full relative">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Child Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Vaccine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Dose
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date Administered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Next Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedRecords.map((record) => {
                    const { infant } = findRecordWithRelations(record);
                    const status =
                      record.status || (record.admin_date ? "completed" : "pending");

                    return (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {infant
                            ? `${infant.first_name} ${infant.last_name}`
                            : record.infant_name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {record.vaccine_name || "Unknown Vaccine"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          Dose {record.dose_no || record.dose_number || 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {record.admin_date
                            ? new Date(record.admin_date).toLocaleDateString()
                            : "Not administered"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {record.next_due_date
                            ? new Date(record.next_due_date).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              status === "completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : status === "overdue"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : status === "due"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditRecord(record)}
                            >
                              View/Edit
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => void handleDeleteRecord(record.id)}
                                disabled={deletingRecordId === record.id}
                                title="Delete vaccination record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <VaccinationPaginationFooter
              totalItems={totalRecordRows}
              visibleStart={visibleRecordStart}
              visibleEnd={visibleRecordEnd}
              itemLabel="records"
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={itemsPerPage}
              rowsPerPageOptions={recordRowsPerPageOptions}
              pageInputId="vaccination-records-page-jump"
              pageInputValue={recordPageInputValue}
              onPageInputChange={(event) => setRecordPageInputValue(event.target.value)}
              onPageInputKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleRecordPageJumpSubmit();
                }
              }}
              onPageJumpSubmit={handleRecordPageJumpSubmit}
              onRowsPerPageChange={(event) => {
                const nextPageSize =
                  Number(event.target.value) || DEFAULT_RECORDS_ITEMS_PER_PAGE;
                setItemsPerPage(nextPageSize);
                setCurrentPage(1);
                setRecordPageInputValue("1");
              }}
              onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
              onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disablePrevious={!recordTablePagination?.hasPrev || currentPage === 1}
              disableNext={!recordTablePagination?.hasNext || currentPage === totalPages}
            />
            </>
          )}
        </div>
      )}

      {activeTab === "tracking" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Compliance Tracking
          </h3>

          {tabLoadingStates.tracking && !tabDataLoaded.tracking && trackingOverviewRows.length === 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading vaccination data for compliance tracking...
              </div>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : !isUsingServerTrackingOverview && recordsHydrationLoading && vaccinationRecords.length === 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading vaccination history for compliance tracking...
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                {[1, 2, 3, 4, 5, 6].map((card) => (
                  <SkeletonCard key={card} className="h-52" />
                ))}
              </div>
            </div>
          ) : infants.length === 0 ? (
            <EmptyState
              title="No infants tracked"
              description="There are no infants registered in the system to track vaccination compliance."
              icon="👶"
              className="border-none shadow-none py-12"
            />
          ) : (
            <>
              <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-shrink-0">
                <div className="w-full sm:max-w-md">
                  <SearchableInfantSelect
                    infants={trackingVisibleInfants}
                    value={selectedInfantId || ""}
                    onChange={(e) => {
                      const nextValue = e.target.value ? Number(e.target.value) : null;
                      setSelectedInfantId(nextValue);

                      if (nextValue) {
                        const selected = trackingVisibleInfants.find(
                          (infant) => Number.parseInt(infant?.id, 10) === Number(nextValue),
                        );
                        if (selected) {
                          setSearchQuery(getInfantDisplayLabel(selected));
                        }
                      }
                    }}
                    label="Focus by infant"
                    placeholder="Search by name, control number, or date of birth..."
                    emptyMessage="No infants available"
                    loading={infantsLoading || recordsHydrationLoading}
                    selectedInfant={selectedTrackingInfant}
                    required={false}
                    searchQuery={activeTab === "tracking" ? searchQuery : ""}
                    onSearchQueryChange={activeTab === "tracking" ? setSearchQuery : undefined}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto auto-hide-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                {(selectedInfantId
                  ? paginatedComplianceRows.filter(
                      (entry) =>
                        Number.parseInt(entry.infant?.id, 10) === Number.parseInt(selectedInfantId, 10),
                    )
                  : paginatedComplianceRows
                ).map((entry) => {
                  const { infant, dueCount, completed, pending, overdue, completionRate } =
                    entry;

                  return (
                    <Card key={infant.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {getInfantDisplayLabel(infant)}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {infant.dob
                              ? new Date(infant.dob).toLocaleDateString()
                              : "DOB unavailable"}
                          </p>
                        </div>
                        <div
                          className={`text-2xl ${
                            completionRate >= 80
                              ? "text-success-600"
                              : completionRate >= 50
                                ? "text-warning-600"
                                : "text-danger-600"
                          }`}
                        >
                          {completionRate >= 80 ? "😊" : completionRate >= 50 ? "😐" : "😟"}
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Compliance</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {completionRate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              completionRate >= 80
                                ? "bg-success-500"
                                : completionRate >= 50
                                  ? "bg-warning-500"
                                  : "bg-danger-500"
                            }`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Due</p>
                          <p className="font-semibold text-info-600">{dueCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Completed</p>
                          <p className="font-semibold text-success-600">{completed}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Pending</p>
                          <p className="font-semibold text-warning-600">{pending}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Overdue</p>
                          <p className="font-semibold text-danger-600">{overdue}</p>
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          const infantLabel = getInfantDisplayLabel(infant);
                          setSearchQuery(infantLabel);
                          setDebouncedSearchQuery(infantLabel);
                          searchQueryRef.current = infantLabel;
                          activateVaccinationTab("records");
                          setSelectedInfantId(infant.id);
                        }}
                        className="w-full mt-3"
                        size="sm"
                      >
                        View Details
                      </Button>
                    </Card>
                  );
                })}
              </div>
              </div>

              {!selectedInfantId && (
                <VaccinationPaginationFooter
                  totalItems={trackingTotalRows}
                  visibleStart={
                    trackingTotalRows > 0
                      ? (trackingDisplayPage - 1) * trackingItemsPerPage + 1
                      : 0
                  }
                  visibleEnd={
                    trackingTotalRows > 0
                      ? Math.min(trackingDisplayPage * trackingItemsPerPage, trackingTotalRows)
                      : 0
                  }
                  itemLabel="infants"
                  currentPage={trackingDisplayPage}
                  totalPages={trackingTotalPages}
                  rowsPerPage={trackingItemsPerPage}
                  rowsPerPageOptions={trackingRowsPerPageOptions}
                  pageInputId="vaccination-tracking-page-jump"
                  pageInputValue={trackingPageInputValue}
                  onPageInputChange={(event) => setTrackingPageInputValue(event.target.value)}
                  onPageInputKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleTrackingPageJumpSubmit();
                    }
                  }}
                  onPageJumpSubmit={handleTrackingPageJumpSubmit}
                  onRowsPerPageChange={(event) => {
                    const nextPageSize =
                      Number(event.target.value) || DEFAULT_TRACKING_ITEMS_PER_PAGE;
                    setTrackingItemsPerPage(nextPageSize);
                    setTrackingCurrentPage(1);
                    setTrackingPageInputValue("1");
                  }}
                  onPrevious={() => setTrackingCurrentPage((p) => Math.max(1, p - 1))}
                  onNext={() =>
                    setTrackingCurrentPage((p) =>
                      Math.min(trackingTotalPages, p + 1),
                    )
                  }
                  disablePrevious={trackingCurrentPage === 1}
                  disableNext={trackingCurrentPage === trackingTotalPages}
                />
              )}

              {!isUsingServerTrackingOverview && selectedInfantId && selectedInfantRecords.length === 0 && (
                <div className="mt-6">
                  <EmptyState
                    title="No recorded vaccinations for selected infant"
                    description="The selected infant currently has no recorded vaccination entries."
                    icon="🧾"
                    className="border-none shadow-none py-8"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>

      <InjectVaccineModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        infantId={addModalPrefill?.infant_id || ""}
        infantName={getInfantDisplayLabel(addModalPrefill || {})}
        prefillContext={addModalPrefill}
        onSuccess={handleAddModalSuccess}
        title="Add New Vaccination Record"
        submitLabel="Save Record"
        infantLabel="Select Child"
      />

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="View/Edit Vaccination Record"
        size="md"
        footer={
          <AdminModalActions>
            <Button type="button" variant="cancel" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" form="editVaccinationForm" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </AdminModalActions>
        }
      >
        <form id="editVaccinationForm" onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <Input
                label="Dose Number"
                type="number"
                min="1"
                value={vaccinationForm.dose_no}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    dose_no: Number(e.target.value || 1),
                  }))
                }
                required
              />
            </div>
            <div className="admin-field-group">
              <Input
                label="Date Administered"
                type="date"
                value={vaccinationForm.admin_date}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    admin_date: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="admin-field-group">
              <Input
                label="Next Due Date"
                type="date"
                value={vaccinationForm.next_due_date}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    next_due_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="admin-field-group">
            <label className="admin-field-label">Status</label>
            <select
              className="admin-select"
              value={vaccinationForm.status}
              onChange={(e) =>
                setVaccinationForm((prev) => ({
                  ...prev,
                  status: e.target.value,
                }))
              }
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="admin-field-group">
            <label className="admin-field-label">Notes</label>
            <textarea
              value={vaccinationForm.notes}
              onChange={(e) =>
                setVaccinationForm((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              className="admin-textarea"
              rows={3}
              placeholder="Any reactions, observations, or special notes"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default VaccinationsDashboard;
