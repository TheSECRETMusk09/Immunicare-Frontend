import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import infantService from "../services/infantService";
import VaccineScheduleBooklet from "../components/VaccineScheduleBooklet";
import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import InfantPersonalRecord from "../components/InfantPersonalRecord";
import ImmunizationChart from "../components/ImmunizationChart";
import TransferInCases from "./TransferInCases";
import AddInfantModal from "../components/AddInfantModal";
import InjectVaccineModal from "../components/InjectVaccineModal";
import VaccineReadinessManager from "../components/VaccineReadinessManager";
import useInfantManagementSocket from "../hooks/useInfantManagementSocket";
import { useAuth } from "../contexts/AuthContext";
import { normalizeInfant, normalizeInfantsResponse } from "../utils/adminDataAdapters";
import {
  buildInfantRecordPrefillContext,
  getInfantDisplayLabel,
  getInfantFullName,
} from "../utils/infantIdentity";
import { getVaccinationPeriodRange } from "../utils/vaccinationPeriods";
import { formatInfantDobShort } from "../utils/dateUtils";
import {
  Button,
  PageHeader,
  PageContainer,
  Alert,
  Badge,
  LoadingSpinner,
  Input,
} from "../components/UI";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  User,
  Calendar,
  BookOpen,
  BarChart2,
  Plus,
  Search,
  Syringe,
  Baby,
  Filter,
  RefreshCw,
  X,
} from "lucide-react";

const getPeriodDateRange = (period, customFrom = "", customTo = "") => {
  if (period === "all") {
    return { from: null, to: null };
  }

  const { startDate, endDate } = getVaccinationPeriodRange({
    period,
    startDate: customFrom,
    endDate: customTo,
    referenceDate: new Date(),
  });

  return {
    from: startDate || null,
    to: endDate || null,
  };
};

const WORKFLOW_STATUS_META = {
  needs_review: { label: "Needs Review", variant: "warning" },
  pending_doses: { label: "Pending Doses", variant: "info" },
  in_progress: { label: "In Progress", variant: "success" },
  up_to_date: { label: "Up to Date", variant: "secondary" },
};

const REVIEW_VALIDATION_STATUSES = new Set([
  "for_validation",
  "needs_clarification",
  "pending_validation",
  "pending",
  "under_review",
]);

const INFANT_NAME_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const TRANSFER_STATUS_META = {
  approved: { label: "Transfer Approved", variant: "success" },
  for_validation: { label: "Transfer Review", variant: "warning" },
  needs_clarification: { label: "Needs Clarification", variant: "info" },
  pending_validation: { label: "Pending Validation", variant: "warning" },
  rejected: { label: "Transfer Rejected", variant: "danger" },
};

const formatControlNumberDisplay = (controlNumber, dateValue) => {
  const base = String(controlNumber || "").trim();
  if (!base) return "Pending";

  const parsedDate = dateValue ? new Date(dateValue) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return base;
  }

  return `${base}-${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;
};

const normalizeVaccinationPrefillFromRoute = (prefill = {}) => {
  const normalizedInfantId = Number(prefill.infant_id ?? prefill.infantId ?? 0) || null;
  const normalizedVaccineId = Number(prefill.vaccine_id ?? prefill.vaccineId ?? 0) || null;
  const normalizedDoseNumber = Number(prefill.dose_number ?? prefill.doseNo ?? 1) || 1;

  return {
    ...prefill,
    infant_id: normalizedInfantId,
    infantId: normalizedInfantId,
    vaccine_id: normalizedVaccineId,
    dose_number: normalizedDoseNumber,
    date_administered: prefill.date_administered || prefill.admin_date || "",
    next_due_date: prefill.next_due_date || prefill.nextDueDate || "",
    status: prefill.status || "completed",
  };
};

const normalizePaginationState = (pagination, currentPage, itemsPerPage, itemCount = 0) => {
  const normalizedPage = Number(pagination?.page || currentPage || 1) || 1;
  const normalizedLimit = Number(pagination?.limit || itemsPerPage || 20) || 20;
  const normalizedTotal = Number(pagination?.total ?? itemCount ?? 0) || 0;
  const normalizedTotalPages =
    Number(pagination?.totalPages) ||(
     normalizedLimit > 0 ? Math.ceil(normalizedTotal / normalizedLimit) : 0);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    total: normalizedTotal,
    totalPages: normalizedTotalPages,
    hasNext:
      typeof pagination?.hasNext === "boolean"
        ? pagination.hasNext
        : normalizedTotalPages > normalizedPage,
    hasPrev:
      typeof pagination?.hasPrev === "boolean"
        ? pagination.hasPrev
        : normalizedPage > 1,
  };
};

const DEFAULT_ITEMS_PER_PAGE = 20;
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
const INFANT_DETAIL_VIEWS = new Set(["personal", "schedule", "records", "chart"]);
const DEFAULT_SORT_STATE = {
  key: null,
  direction: null,
};
const DEFAULT_COLUMN_FILTERS = {
  dob: {
    start: "",
    end: "",
  },
  sex: [],
  workflow_status: [],
  vaccination_progress: {
    min: "",
    max: "",
    preset: "",
  },
};
const VACCINATION_PROGRESS_PRESETS = [
  { value: "", label: "Any Count", min: "", max: "" },
  { value: "0-1", label: "0 to 1 doses", min: "0", max: "1" },
  { value: "2-4", label: "2 to 4 doses", min: "2", max: "4" },
  { value: "5-plus", label: "5+ doses", min: "5", max: "" },
];

const createColumnFilterState = (filters = DEFAULT_COLUMN_FILTERS) =>( {
  dob: {
    start: String(filters?.dob?.start || ""),
    end: String(filters?.dob?.end || ""),
  },
  sex: Array.isArray(filters?.sex) ? [...filters.sex] : [],
  workflow_status: Array.isArray(filters?.workflow_status)
    ? filters.workflow_status
        .map((value) => normalizeWorkflowStatusValue(value))
        .filter(Boolean)
    : [],
  vaccination_progress: {
    min: String(filters?.vaccination_progress?.min ?? ""),
    max: String(filters?.vaccination_progress?.max ?? ""),
    preset: String(filters?.vaccination_progress?.preset || ""),
  },
});

const cloneColumnFilterValue = (columnKey, filters = DEFAULT_COLUMN_FILTERS) => {
  const normalizedFilters = createColumnFilterState(filters);
  const columnValue = normalizedFilters[columnKey];

  if (Array.isArray(columnValue)) {
    return [...columnValue];
  }

  if (columnValue && typeof columnValue === "object") {
    return { ...columnValue };
  }

  return columnValue;
};

const normalizeDateOnlyValue = (value) => {
  if (!value) return "";

  const normalizedString = String(value).trim();
  const directMatch = normalizedString.match(/^\d{4}-\d{2}-\d{2}/);
  if (directMatch) {
    return directMatch[0];
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
};



const normalizeInfantDetailView = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return INFANT_DETAIL_VIEWS.has(normalizedValue) ? normalizedValue : "";
};

const parseInfantManagementRoute = (search = "") => {
  const searchParams = new URLSearchParams(search);
  const rawView = String(searchParams.get("view") || "").trim().toLowerCase();

  return {
    detailView: normalizeInfantDetailView(rawView),
    infantId:
      Number(searchParams.get("infantId") || searchParams.get("infant_id") || 0) || null,
    isTransferIn: rawView === "transfer-in",
  };
};

const getSexLabel = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue === "male" || normalizedValue === "m") return "Male";
  if (normalizedValue === "female" || normalizedValue === "f") return "Female";
  return "Other";
};

const getSexFilterValue = (value) => getSexLabel(value).toLowerCase();

const normalizeWorkflowStatusValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const getInfantWorkflowStatusValue = (row = {}) => {
  const explicitWorkflowStatus = normalizeWorkflowStatusValue(row.workflow_status);
  if (WORKFLOW_STATUS_META[explicitWorkflowStatus]) {
    return explicitWorkflowStatus;
  }

  const validationStatus = normalizeWorkflowStatusValue(
    row.validation_status ?? row.latest_transfer_case_status,
  );

  if (REVIEW_VALIDATION_STATUSES.has(validationStatus)) {
    return "needs_review";
  }

  if (Number(row.pending_vaccinations || 0) > 0) {
    return "pending_doses";
  }

  if (
    Number(row.completed_vaccinations || 0) > 0 ||
    Number(row.imported_vaccinations || 0) > 0
  ) {
    return "in_progress";
  }

  return "up_to_date";
};

const getWorkflowLabel = (workflowStatus) =>
  WORKFLOW_STATUS_META[normalizeWorkflowStatusValue(workflowStatus)]?.label ||
  "Up to Date";

const getVaccinationProgressCount = (row = {}) =>
  Number(row.completed_vaccinations || 0) + Number(row.imported_vaccinations || 0);

const getInfantNameSortValue = (row = {}) =>
  getInfantFullName(row)
    .replace(/\s+/g, " ")
    .trim();

const getInfantDobSortValue = (row = {}) => {
  const normalizedDob = normalizeDateOnlyValue(row.dob);
  if (!normalizedDob) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedDob = new Date(`${normalizedDob}T00:00:00.000Z`);
  return Number.isNaN(parsedDob.getTime())
    ? Number.POSITIVE_INFINITY
    : parsedDob.getTime();
};

const normalizeProgressFilterRange = (range = {}) => {
  const minValue =
    range.min === "" || range.min === null || range.min === undefined
      ? ""
      : String(range.min);
  const maxValue =
    range.max === "" || range.max === null || range.max === undefined
      ? ""
      : String(range.max);
  const parsedMin =
    minValue === "" || Number.isNaN(Number(minValue))
      ? ""
      : String(Math.max(0, Number(minValue)));
  const parsedMax =
    maxValue === "" || Number.isNaN(Number(maxValue))
      ? ""
      : String(Math.max(0, Number(maxValue)));

  if (parsedMin !== "" && parsedMax !== "" && Number(parsedMin) > Number(parsedMax)) {
    return {
      min: parsedMax,
      max: parsedMin,
      preset: "",
    };
  }

  return {
    min: parsedMin,
    max: parsedMax,
    preset: String(range.preset || ""),
  };
};

const isColumnFilterActive = (columnKey, filters = DEFAULT_COLUMN_FILTERS) => {
  switch (columnKey) {
    case "dob":
      return Boolean(filters?.dob?.start || filters?.dob?.end);
    case "sex":
      return Array.isArray(filters?.sex) && filters.sex.length > 0;
    case "workflow_status":
      return(
        Array.isArray(filters?.workflow_status) &&
        filters.workflow_status.length > 0)
       ;
    case "vaccination_progress":
      return Boolean(
        filters?.vaccination_progress?.min !== "" ||
          filters?.vaccination_progress?.max !== "",
      );
    default:
      return false;
  }
};

const filterInfantRows = (rows = [], filters = DEFAULT_COLUMN_FILTERS) =>
  (Array.isArray(rows) ? rows : []).filter((row) => {
    const dobFilterStart = normalizeDateOnlyValue(filters?.dob?.start);
    const dobFilterEnd = normalizeDateOnlyValue(filters?.dob?.end);
    if (dobFilterStart || dobFilterEnd) {
      const infantDob = normalizeDateOnlyValue(row.dob);
      if (!infantDob) {
        return false;
      }

      if (dobFilterStart && infantDob < dobFilterStart) {
        return false;
      }

      if (dobFilterEnd && infantDob > dobFilterEnd) {
        return false;
      }
    }

    if (Array.isArray(filters?.sex) && filters.sex.length > 0) {
      if (!filters.sex.includes(getSexFilterValue(row.sex))) {
        return false;
      }
    }

    if (
      Array.isArray(filters?.workflow_status) &&
      filters.workflow_status.length > 0
    ) {
      const activeWorkflowFilters = new Set(
        filters.workflow_status
          .map((value) => normalizeWorkflowStatusValue(value))
          .filter(Boolean),
      );

      if (!activeWorkflowFilters.has(getInfantWorkflowStatusValue(row))) {
        return false;
      }
    }

    const progressRange = normalizeProgressFilterRange(
      filters?.vaccination_progress || {},
    );
    const progressCount = getVaccinationProgressCount(row);
    if (
      progressRange.min !== "" &&
      progressCount < Number(progressRange.min)
    ) {
      return false;
    }

    if (
      progressRange.max !== "" &&
      progressCount > Number(progressRange.max)
    ) {
      return false;
    }

    return true;
  });

const getSortableColumnValue = (row = {}, columnKey) => {
  switch (columnKey) {
    case "name":
      return getInfantNameSortValue(row);
    case "dob":
      return getInfantDobSortValue(row);
    case "sex":
      return getSexLabel(row.sex);
    case "workflow_status":
      return getWorkflowLabel(getInfantWorkflowStatusValue(row));
    case "vaccination_progress":
      return getVaccinationProgressCount(row);
    default:
      return row?.[columnKey] ?? "";
  }
};

const compareInfantRowsByColumn = (leftRow = {}, rightRow = {}, columnKey) => {
  if (columnKey === "name") {
    return INFANT_NAME_COLLATOR.compare(
      getInfantNameSortValue(leftRow),
      getInfantNameSortValue(rightRow),
    );
  }

  if (columnKey === "dob") {
    return getInfantDobSortValue(leftRow) - getInfantDobSortValue(rightRow);
  }

  const leftValue = getSortableColumnValue(leftRow, columnKey);
  const rightValue = getSortableColumnValue(rightRow, columnKey);

  if (typeof leftValue === "number" || typeof rightValue === "number") {
    return Number(leftValue || 0) - Number(rightValue || 0);
  }

  return INFANT_NAME_COLLATOR.compare(
    String(leftValue || ""),
    String(rightValue || ""),
  );
};

const sortInfantRows = (rows = [], sortState = DEFAULT_SORT_STATE) => {
  if (!sortState?.key || !sortState?.direction) {
    return Array.isArray(rows) ? rows : [];
  }

  return [...rows]
    .map((row, index) =>( { row, index }))
    .sort((leftEntry, rightEntry) => {
      const comparison = compareInfantRowsByColumn(
        leftEntry.row,
        rightEntry.row,
        sortState.key,
      );

      if (comparison !== 0) {
        return sortState.direction === "asc" ? comparison : -comparison;
      }

      return leftEntry.index - rightEntry.index;
    })
    .map((entry) => entry.row);
};

const getInfantServerSortQuery = (sortState = DEFAULT_SORT_STATE) => {
  if (!sortState?.key || !sortState?.direction) {
    return {};
  }

  if (sortState.key === "name") {
    return {
      order_by: "full_name",
      order_direction: sortState.direction,
    };
  }

  if (sortState.key === "dob") {
    return {
      order_by: "dob",
      order_direction: sortState.direction,
    };
  }

  return {};
};

const buildColumnFilterChips = (filters = DEFAULT_COLUMN_FILTERS) => {
  const chips = [];

  if (isColumnFilterActive("dob", filters)) {
    const start = filters.dob?.start || "Any";
    const end = filters.dob?.end || "Any";
    chips.push({
      key: "dob",
      label: `Date of Birth: ${start} to ${end}`,
    });
  }

  if (isColumnFilterActive("sex", filters)) {
    chips.push({
      key: "sex",
      label: `Gender: ${filters.sex.map((value) => getSexLabel(value)).join(", ")}`,
    });
  }

  if (isColumnFilterActive("workflow_status", filters)) {
    chips.push({
      key: "workflow_status",
      label: `Workflow: ${filters.workflow_status
        .map((status) => getWorkflowLabel(normalizeWorkflowStatusValue(status)))
        .join(", ")}`,
    });
  }

  if (isColumnFilterActive("vaccination_progress", filters)) {
    const normalizedRange = normalizeProgressFilterRange(
      filters.vaccination_progress,
    );
    const minLabel = normalizedRange.min === "" ? "Any" : normalizedRange.min;
    const maxLabel = normalizedRange.max === "" ? "Any" : normalizedRange.max;
    chips.push({
      key: "vaccination_progress",
      label: `Vaccination Progress: ${minLabel} to ${maxLabel} doses`,
    });
  }

  return chips;
};

export default function InfantManagement() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [infants, setInfants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedInfant, setSelectedInfant] = useState(null);
  const [activeView, setActiveView] = useState("list"); // 'list', 'schedule', 'records', 'personal', 'chart'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [readinessTargetInfant, setReadinessTargetInfant] = useState(null);
  const [recordVaccinationPrefill, setRecordVaccinationPrefill] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const hasLoadedInitialDataRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [period, setPeriod] = useState("all");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [transferCasesRefreshing, setTransferCasesRefreshing] = useState(false);
  const [sortState, setSortState] = useState(DEFAULT_SORT_STATE);
  const [columnFilters, setColumnFilters] = useState(() =>
    createColumnFilterState(),
  );
  const [activeFilterPanel, setActiveFilterPanel] = useState(null);
  const [filterDraft, setFilterDraft] = useState(null);
  const [pageInputValue, setPageInputValue] = useState("1");
  const serverSortQuery = React.useMemo(
    () => getInfantServerSortQuery(sortState),
    [sortState],
  );
  const workflowStatusFilter = Array.isArray(columnFilters?.workflow_status)
    ? columnFilters.workflow_status
    : [];
  const workflowStatusFilterKey = workflowStatusFilter.join(",");
  const previousWorkflowFilterKeyRef = React.useRef(workflowStatusFilterKey);
  const [infantPagination, setInfantPagination] = useState({
    page: 1,
    limit: itemsPerPage,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [infantSummary, setInfantSummary] = useState({
    total: 0,
    needsReview: 0,
    withImportedHistory: 0,
    pendingVaccinations: 0,
  });

  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const transferInCasesRef = useRef(null);

  const syncInfantRouteState = useCallback(
    (nextView, infant = null, options = {}) => {
      const searchParams = new URLSearchParams(location.search);
      const detailView = normalizeInfantDetailView(nextView);
      const infantId = Number(infant?.id || 0) || null;

      if (detailView && infantId) {
        searchParams.set("view", detailView);
        searchParams.set("infantId", String(infantId));
      } else if (nextView === "transfer-in") {
        searchParams.set("view", "transfer-in");
        searchParams.delete("infantId");
      } else {
        searchParams.delete("view");
        searchParams.delete("infantId");
      }

      navigate(
        {
          pathname: location.pathname,
          search: searchParams.toString() ? `?${searchParams.toString()}` : "",
        },
        {
          replace: Boolean(options.replace),
          state: Object.prototype.hasOwnProperty.call(options, "state")
            ? options.state
            : location.state,
        },
      );
    },
    [location.pathname, location.search, location.state, navigate],
  );

  const openRecordVaccinationsModal = useCallback((targetInfant = null) => {
    setRecordVaccinationPrefill(
      targetInfant ? buildInfantRecordPrefillContext(targetInfant) : null,
    );
    setShowInjectModal(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, period, periodStartDate, periodEndDate]);

  useEffect(() => {
    if (previousWorkflowFilterKeyRef.current !== workflowStatusFilterKey) {
      previousWorkflowFilterKeyRef.current = workflowStatusFilterKey;
      setCurrentPage(1);
    }
  }, [workflowStatusFilterKey]);

  useEffect(() => {
    setPageInputValue(String(currentPage || 1));
  }, [currentPage]);

  useEffect(() => {
    if (!activeFilterPanel) {
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      if (event.target?.closest?.("[data-infant-filter-shell='true']")) {
        return;
      }

      setActiveFilterPanel(null);
      setFilterDraft(null);
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [activeFilterPanel]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const routeState = parseInfantManagementRoute(location.search);
    if (
      routeState.detailView ||
      selectedInfant ||(
       activeView !== "list" && activeView !== "transfer-in")
    ) {
      return;
    }

    const nextPrimaryView = routeState.isTransferIn ? "transfer-in" : "list";

    if (activeView !== nextPrimaryView) {
      setActiveView(nextPrimaryView);
    }
  }, [activeView, location.search, selectedInfant]);

  useEffect(() => {
    const routeState = parseInfantManagementRoute(location.search);
    if (!routeState.detailView || !routeState.infantId) {
      return;
    }

    let ignore = false;

    const applyRouteSelection = (infantRecord) => {
      if (!infantRecord || ignore) {
        return;
      }

      setSelectedInfant(infantRecord);
      setActiveView(routeState.detailView);
    };

    const listMatch = infants.find((entry) => entry.id === routeState.infantId);
    if (listMatch) {
      applyRouteSelection(listMatch);
      return () => {
        ignore = true;
      };
    }

    if (selectedInfant?.id === routeState.infantId) {
      if (activeView !== routeState.detailView) {
        setActiveView(routeState.detailView);
      }

      return () => {
        ignore = true;
      };
    }

           (async()=>{
      try {
        const response = await infantService.getById(routeState.infantId);
        const infantPayload = response?.success ? response.data : null;
        const restoredInfant = infantPayload ? normalizeInfant(infantPayload) : null;

        if (restoredInfant?.id) {
          applyRouteSelection(restoredInfant);
          return;
        }
      } catch (routeError) {
        console.error("[InfantManagement] Unable to restore infant view from URL:", routeError);
      }

      if (!ignore) {
        setSelectedInfant(null);
        setActiveView("list");
        syncInfantRouteState("list", null, { replace: true });
      }
    }       )();

    return () => {
      ignore = true;
    };
  }, [
    activeView,
    infants,
    location.search,
    selectedInfant?.id,
    syncInfantRouteState,
  ]);

  useEffect(() => {
    const navigationState = location.state;
    if (!navigationState || navigationState.openRecordVaccination !== true) {
      return;
    }

    const normalizedPrefill = normalizeVaccinationPrefillFromRoute(
      navigationState.prefill || {},
    );

    setRecordVaccinationPrefill(normalizedPrefill);

    if (normalizedPrefill.infant_id) {
      const matchedInfant = infants.find((entry) => entry.id === normalizedPrefill.infant_id);
      if (matchedInfant) {
        setSelectedInfant(matchedInfant);
      }
    }

    setActiveView("list");
    setShowInjectModal(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, infants]);

  useEffect(() => {
    const prefillInfantId = Number(recordVaccinationPrefill?.infant_id || 0) || null;
    if (!prefillInfantId || !infants.length) {
      return;
    }

    const matchedInfant = infants.find((entry) => entry.id === prefillInfantId);
    if (matchedInfant) {
      setSelectedInfant(matchedInfant);
    }
  }, [infants, recordVaccinationPrefill]);

  const fetchInfants = useCallback(async (isRefresh = false) => {
    const requestId = ++fetchRequestIdRef.current;

    try {
      if (isRefresh || hasLoadedInitialDataRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const activePeriodRange = getPeriodDateRange(period, periodStartDate, periodEndDate);
      const result = await infantService.getAll({
        page: currentPage,
        limit: itemsPerPage,
        ...(isAdmin ? { scope: "system" } : {}),
        ...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
        ...(!debouncedSearchQuery && activePeriodRange.from ? { start_date: activePeriodRange.from } : {}),
        ...(!debouncedSearchQuery && activePeriodRange.to ? { end_date: activePeriodRange.to } : {}),
        ...(workflowStatusFilterKey
          ? { workflow_status: workflowStatusFilterKey }
          : {}),
        ...serverSortQuery,
      });
      const infantsData = normalizeInfantsResponse(result?.data ?? result);
      const nextPagination = normalizePaginationState(
        result?.pagination,
        currentPage,
        itemsPerPage,
        infantsData.length,
      );
      const nextSummary = result?.summary || {
        total: nextPagination.total,
        needsReview: infantsData.filter(
          (infant) => getInfantWorkflowStatusValue(infant) === "needs_review",
        ).length,
        withImportedHistory: infantsData.filter(
          (infant) => infant.latest_transfer_case_id != null,
        ).length,
        pendingVaccinations: infantsData.reduce(
          (total, infant) => total + Number(infant.pending_vaccinations || 0),
          0,
        ),
      };

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      setInfants(infantsData);
      setInfantPagination(nextPagination);
      setInfantSummary(nextSummary);
      if (selectedInfant?.id) {
        const refreshedSelected = infantsData.find(
          (entry) => entry.id === selectedInfant.id,
        );
        if (refreshedSelected) {
          setSelectedInfant(refreshedSelected);
        }
      }
    } catch (err) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      console.error("[InfantManagement] Error fetching infants:", err);
      setError(err.message || "Failed to load infants. Please try again.");
      setInfants([]); // Ensure infants is always an array on error
      setInfantPagination({
        page: currentPage,
        limit: itemsPerPage,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: currentPage > 1,
      });
      setInfantSummary({
        total: 0,
        needsReview: 0,
        withImportedHistory: 0,
        pendingVaccinations: 0,
      });
    } finally {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      setLoading(false);
      setRefreshing(false);
      hasLoadedInitialDataRef.current = true;
    }
  }, [
    currentPage,
    period,
    periodStartDate,
    periodEndDate,
    debouncedSearchQuery,
    isAdmin,
    itemsPerPage,
    serverSortQuery,
    selectedInfant?.id,
    workflowStatusFilterKey,
  ]);

  useInfantManagementSocket({
    setInfants,
    onChange: () => {
      void fetchInfants();
    },
  });

  useEffect(() => {
    void fetchInfants();
  }, [fetchInfants]);

  useEffect(() => {
    if (
      infantPagination.totalPages > 0 &&
      currentPage > infantPagination.totalPages
    ) {
      setCurrentPage(infantPagination.totalPages);
    }
  }, [currentPage, infantPagination.totalPages]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchInfants(true);
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchInfants]);

  const handleViewBooklet = (infant, viewType) => {
    setSelectedInfant(infant);
    setActiveView(viewType);
    syncInfantRouteState(viewType, infant);
  };

  const handleBackToList = () => {
    // Refresh the infants list when returning to list view
    void fetchInfants();
    setSelectedInfant(null);
    setActiveView("list");
    syncInfantRouteState("list", null);
  };

  const handleSelectInfantDetailView = (viewType) => {
    if (!selectedInfant) {
      return;
    }

    setActiveView(viewType);
    syncInfantRouteState(viewType, selectedInfant, { replace: true });
  };

  const handlePersonalUpdate = () => {
    // Refresh the infants list when personal info is updated
    void fetchInfants();
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    void fetchInfants();
  };

  const openReadinessManager = (infant) => {
    setReadinessTargetInfant(infant || null);
    setShowReadinessModal(true);
  };

  const closeReadinessManager = () => {
    setShowReadinessModal(false);
    setReadinessTargetInfant(null);
  };

  const openColumnFilterPanel = (columnKey) => {
    if (activeFilterPanel === columnKey) {
      setActiveFilterPanel(null);
      setFilterDraft(null);
      return;
    }

    setActiveFilterPanel(columnKey);
    setFilterDraft(cloneColumnFilterValue(columnKey, columnFilters));
  };

  const handleColumnFilterDraftChange = (updater) => {
    setFilterDraft((previousDraft) => {
      if (typeof updater === "function") {
        return updater(previousDraft);
      }

      return updater;
    });
  };

  const handleColumnFilterCancel = () => {
    setActiveFilterPanel(null);
    setFilterDraft(null);
  };

  const handleColumnFilterApply = (columnKey) => {
    setColumnFilters((previousFilters) => {
      const nextFilters = createColumnFilterState(previousFilters);

      if (columnKey === "vaccination_progress") {
        nextFilters[columnKey] = normalizeProgressFilterRange(filterDraft || {});
      } else if (columnKey === "dob") {
        const normalizedDraft = {
          start: String(filterDraft?.start || ""),
          end: String(filterDraft?.end || ""),
        };

        if (
          normalizedDraft.start &&
          normalizedDraft.end &&
          normalizedDraft.start > normalizedDraft.end
        ) {
          nextFilters[columnKey] = {
            start: normalizedDraft.end,
            end: normalizedDraft.start,
          };
        } else {
          nextFilters[columnKey] = normalizedDraft;
        }
      } else if (columnKey === "sex") {
        nextFilters[columnKey] = Array.isArray(filterDraft) ? [...filterDraft] : [];
      } else if (columnKey === "workflow_status") {
        nextFilters[columnKey] = Array.isArray(filterDraft)
          ? filterDraft
              .map((value) => normalizeWorkflowStatusValue(value))
              .filter(Boolean)
          : [];
      } else {
        nextFilters[columnKey] = String(filterDraft || "");
      }

      return nextFilters;
    });

    setActiveFilterPanel(null);
    setFilterDraft(null);
  };

  const handleColumnFilterRemoval = (columnKey) => {
    setColumnFilters((previousFilters) => {
      const nextFilters = createColumnFilterState(previousFilters);
      nextFilters[columnKey] = cloneColumnFilterValue(columnKey, DEFAULT_COLUMN_FILTERS);
      return nextFilters;
    });

    if (activeFilterPanel === columnKey) {
      setActiveFilterPanel(null);
      setFilterDraft(null);
    }
  };

  const handleSortToggle = (columnKey) => {
    setSortState((previousState) => {
      if (previousState.key !== columnKey) {
        return {
          key: columnKey,
          direction: "asc",
        };
      }

      if (previousState.direction === "asc") {
        return {
          key: columnKey,
          direction: "desc",
        };
      }

      return DEFAULT_SORT_STATE;
    });
  };

  const handlePageJumpSubmit = () => {
    const nextPage = Number.parseInt(pageInputValue, 10);
    if (!Number.isFinite(nextPage)) {
      setPageInputValue(String(currentPage || 1));
      return;
    }

    const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
    setCurrentPage(clampedPage);
    setPageInputValue(String(clampedPage));
  };

  const filteredInfants = filterInfantRows(infants, columnFilters);
  const paginatedInfants = sortInfantRows(filteredInfants, sortState);
  const activeFilterChips = buildColumnFilterChips(columnFilters);
  const hasActiveColumnFilters = activeFilterChips.length > 0;
  const totalPages = Math.max(
    1,
    Number(infantPagination?.totalPages || 0) || 1,
  );
  const totalInfants = Number(infantPagination?.total || infants.length || 0) || 0;
  const filteredInfantCount = paginatedInfants.length;
  const summaryTotalInfants = hasActiveColumnFilters
    ? filteredInfantCount
    : totalInfants;
  const visibleInfantStart =
    filteredInfantCount > 0
      ? hasActiveColumnFilters
        ? 1
        : (currentPage - 1) * itemsPerPage + 1
      : 0;
  const visibleInfantEnd =
    filteredInfantCount > 0
      ? hasActiveColumnFilters
        ? filteredInfantCount
        : Math.min(currentPage * itemsPerPage, totalInfants)
      : 0;
  const contentShellClassName = "flex w-full flex-col";
  const iconOnlyActionButtonClassName =
    "h-8 w-8 min-h-[32px] rounded-md px-0 shadow-none";
  const readinessActionButtonClassName =
    "whitespace-nowrap rounded-md px-2.5 shadow-none";
  const actionsColumnWidth = "10.5rem";
  const actionsColumnMinWidth = "10.5rem";
  const buildColumnStyle = (width, minWidth = width) =>( {
    width,
    minWidth,
  });
  const tableSummaryText = `Showing ${visibleInfantStart} to ${visibleInfantEnd} of ${summaryTotalInfants} infants${
    hasActiveColumnFilters ? " on this page" : ""
  }`;
  const topSummaryText = hasActiveColumnFilters
    ? `Showing ${filteredInfantCount} of ${filteredInfantCount} infants`
    : `Showing ${visibleInfantEnd} of ${totalInfants} infants`;

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "11rem",
      minWidth: "11rem",
      sortable: true,
      headerClassName: "whitespace-nowrap",
      cellClassName: "overflow-hidden whitespace-nowrap text-ellipsis",
      render: (val, row) =>(
        <div
          className="truncate font-semibold leading-5 text-gray-900 dark:text-gray-100"
          title={`${row.first_name} ${row.last_name}`.trim()}
        >
          {row.first_name} {row.last_name}
        </div>)
       ,
    },
    {
      key: "control_number",
      label: "Infant Control Number",
      width: "12.5rem",
      minWidth: "12.5rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "overflow-hidden whitespace-nowrap text-ellipsis",
      render: (val, row) =>(
        <span
          className="inline-flex max-w-full truncate overflow-hidden rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          title={formatControlNumberDisplay(val, row.dob)}
        >
          {formatControlNumberDisplay(val, row.dob)}
        </span>)
       ,
    },
    {
      key: "dob",
      label: "Date of Birth",
      width: "8rem",
      minWidth: "8rem",
      sortable: true,
      filterable: true,
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      type: "date",
      render: (val) => formatInfantDobShort(val),
    },
    {
      key: "sex",
      label: "Gender",
      width: "6.5rem",
      minWidth: "6.5rem",
      sortable: true,
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val) => {
        // Handle both 'M'/'F' and 'male'/'female' formats
        const isMale =
          val === "male" || val === "M" || val?.toLowerCase() === "male";
        const isFemale =
          val === "female" || val === "F" || val?.toLowerCase() === "female";
        return(
          <Badge variant={isMale ? "info" : "primary"}>
            {isMale ? "Male" : isFemale ? "Female" : "Other"}
          </Badge>)
         ;
      },
    },
    {
      key: "parents",
      label: "Parents/Guardian",
      width: "17rem",
      minWidth: "17rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "overflow-hidden whitespace-nowrap text-ellipsis",
      render: (val, row) => {
        const parents = [];
        if (row.mother_name) parents.push(`Mother: ${row.mother_name}`);
        if (row.father_name) parents.push(`Father: ${row.father_name}`);
        // If no parents, show guardian name
        if (parents.length === 0 && row.guardian_name) {
          parents.push(row.guardian_name);
        }
        return(
          <div
            className="space-y-0.5 overflow-hidden text-[13px] leading-5"
            title={parents.join("\n")}
          >
            {parents.length > 0 ?
                         (parents.map((p,i)=>(
                <div key={i} className="truncate text-gray-700 dark:text-gray-300">
                  {p}
                </div>)
               ))
              :(
              <span className="text-gray-400">Not specified</span>)
             }
          </div>)
         ;
      },
    },
    {
      key: "contact",
      label: "Contact",
      width: "9rem",
      minWidth: "9rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "overflow-hidden whitespace-nowrap text-ellipsis",
      render: (val, row) => {
        const contactValue =
          row.cellphone_number || row.guardian_phone || "Not specified";
        return(
          <div
            className="truncate text-[13px] leading-5 text-gray-700 dark:text-gray-300"
            title={contactValue}
          >
            {contactValue}
          </div>)
         ;
      },
    },
    {
      key: "workflow_status",
      label: "Workflow",
      width: "9rem",
      minWidth: "9rem",
      sortable: true,
      filterable: true,
      filterPanelAlignment: "right",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val, row) => {
        const workflowStatus = getInfantWorkflowStatusValue(row);
        const workflowMeta =
          WORKFLOW_STATUS_META[workflowStatus] || WORKFLOW_STATUS_META.up_to_date;

        return(
          <div className="space-y-1">
            <Badge variant={workflowMeta.variant}>{workflowMeta.label}</Badge>
            {row.latest_transfer_case_status &&(
              <div>
                <Badge
                  variant={
                    TRANSFER_STATUS_META[row.latest_transfer_case_status]?.variant ||
                    "secondary"
                  }
                >
                  {TRANSFER_STATUS_META[row.latest_transfer_case_status]?.label ||
                    row.latest_transfer_case_status}
                </Badge>
              </div>)
             }
          </div>)
         ;
      },
    },
    {
      key: "vaccination_progress",
      label: "Vaccination Progress",
      width: "10.5rem",
      minWidth: "10.5rem",
      filterable: true,
      filterPanelAlignment: "right",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val, row) =>(
        <div className="space-y-0.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
          <div>Completed: {Number(row.completed_vaccinations || 0)}</div>
          <div>Pending: {Number(row.pending_vaccinations || 0)}</div>
          <div>Imported: {Number(row.imported_vaccinations || 0)}</div>
        </div>)
       ,
    },
    {
      key: "latest_transfer_source_facility",
      label: "Transfer Source",
      width: "8.5rem",
      minWidth: "8.5rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "overflow-hidden whitespace-nowrap text-ellipsis",
      render: (val) =>(
        <div
          className="truncate text-[13px] leading-5 text-gray-700 dark:text-gray-300"
          title={val || "—"}
        >
          {val || "—"}
        </div>)
       ,
    },
  ];

  const tableActions = (row) =>(
    <div className="ml-auto flex max-w-[10.5rem] flex-row flex-wrap items-center justify-end gap-1.5">
      <Button
        variant="primary"
        size="xs"
        onClick={() => handleViewBooklet(row, "personal")}
        className={iconOnlyActionButtonClassName}
        title="Personal Record"
        aria-label="Personal Record"
      >
        <User className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="success"
        size="xs"
        onClick={() => handleViewBooklet(row, "schedule")}
        className={iconOnlyActionButtonClassName}
        title="Vaccine Schedule"
        aria-label="Vaccine Schedule"
      >
        <Calendar className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="info"
        size="xs"
        onClick={() => handleViewBooklet(row, "records")}
        className={iconOnlyActionButtonClassName}
        title="Immunization Records"
        aria-label="Immunization Records"
      >
        <BookOpen className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="warning"
        size="xs"
        onClick={() => handleViewBooklet(row, "chart")}
        className={iconOnlyActionButtonClassName}
        title="Immunization Chart"
        aria-label="Immunization Chart"
      >
        <BarChart2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="secondary"
        size="xs"
        onClick={() => openReadinessManager(row)}
        className={readinessActionButtonClassName}
        title="Manage vaccine readiness"
      >
        Ready
      </Button>
    </div>)
   ;

  const compactFieldClassName =
    "w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  const toggleDraftSelection = (value) => {
    handleColumnFilterDraftChange((previousDraft) => {
      const nextDraft = Array.isArray(previousDraft) ? [...previousDraft] : [];
      const existingIndex = nextDraft.indexOf(value);

      if (existingIndex >= 0) {
        nextDraft.splice(existingIndex, 1);
      } else {
        nextDraft.push(value);
      }

      return nextDraft;
    });
  };

  const renderColumnFilterPanel = (column) => {
    if (activeFilterPanel !== column.key) {
      return null;
    }

    const panelAlignmentClassName =
      column.filterPanelAlignment === "right" ? "right-0" : "left-0";

    return(
      <div
        className={`absolute ${panelAlignmentClassName} top-full z-[1000] mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 text-left normal-case tracking-normal shadow-xl dark:border-gray-700 dark:bg-gray-800`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`${column.label} filter`}
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Filter {column.label}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Apply a focused filter for this column.
          </p>
        </div>

        {column.key === "name" &&(
          <div className="space-y-3">
            <input
              type="text"
              value={String(filterDraft || "")}
              onChange={(event) => handleColumnFilterDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleColumnFilterApply(column.key);
                }
              }}
              className={compactFieldClassName}
              placeholder="Search infant name"
              aria-label="Filter infant name"
              autoFocus
            />
          </div>)
         }

        {column.key === "dob" &&(
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Start Date
              </label>
              <input
                type="date"
                value={filterDraft?.start || ""}
                onChange={(event) =>
                  handleColumnFilterDraftChange((previousDraft) =>( {
                    ...(previousDraft || {}),
                    start: event.target.value,
                  }))
                }
                className={compactFieldClassName}
                aria-label="Date of birth start"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                End Date
              </label>
              <input
                type="date"
                value={filterDraft?.end || ""}
                onChange={(event) =>
                  handleColumnFilterDraftChange((previousDraft) =>( {
                    ...(previousDraft || {}),
                    end: event.target.value,
                  }))
                }
                className={compactFieldClassName}
                aria-label="Date of birth end"
              />
            </div>
          </div>)
         }

        {column.key === "sex" &&(
          <div className="space-y-2">
            {[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ].map((option) =>(
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
              >
                <input
                  type="checkbox"
                  checked={Array.isArray(filterDraft) && filterDraft.includes(option.value)}
                  onChange={() => toggleDraftSelection(option.value)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>)
             )}
          </div>)
         }

        {column.key === "workflow_status" &&(
          <div className="space-y-2">
            {Object.entries(WORKFLOW_STATUS_META).map(([workflowKey, workflowMeta]) =>(
              <label
                key={workflowKey}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
              >
                <input
                  type="checkbox"
                  checked={
                    Array.isArray(filterDraft) && filterDraft.includes(workflowKey)
                  }
                  onChange={() => toggleDraftSelection(workflowKey)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{workflowMeta.label}</span>
              </label>)
             )}
          </div>)
         }

        {column.key === "vaccination_progress" &&(
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Start Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={filterDraft?.min ?? ""}
                  onChange={(event) =>
                    handleColumnFilterDraftChange((previousDraft) =>( {
                      ...(previousDraft || {}),
                      min: event.target.value,
                      preset: "",
                    }))
                  }
                  className={compactFieldClassName}
                  placeholder="0"
                  aria-label="Vaccination progress start count"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  End Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={filterDraft?.max ?? ""}
                  onChange={(event) =>
                    handleColumnFilterDraftChange((previousDraft) =>( {
                      ...(previousDraft || {}),
                      max: event.target.value,
                      preset: "",
                    }))
                  }
                  className={compactFieldClassName}
                  placeholder="Any"
                  aria-label="Vaccination progress end count"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                Quick ranges
              </p>
              <div className="flex flex-wrap gap-2">
                {VACCINATION_PROGRESS_PRESETS.map((preset) => {
                  const isActive = String(filterDraft?.preset || "") === preset.value;
                  return(
                    <button
                      key={preset.value || "any"}
                      type="button"
                      onClick={() =>
                        handleColumnFilterDraftChange({
                          min: preset.min,
                          max: preset.max,
                          preset: preset.value,
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/60"
                      }`}
                    >
                      {preset.label}
                    </button>)
                   ;
                })}
              </div>
            </div>
          </div>)
         }

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleColumnFilterCancel}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleColumnFilterApply(column.key)}
            type="button"
          >
            Filter
          </Button>
        </div>
      </div>)
     ;
  };

  const renderHeaderCellContent = (column) => {
    const activeSortForColumn = sortState.key === column.key ? sortState.direction : null;
    const activeFilterForColumn = isColumnFilterActive(column.key, columnFilters);

    return(
      <div
        className={`relative flex min-h-[1.5rem] items-center justify-between gap-2 ${
          activeFilterPanel === column.key ? "z-[1000]" : "z-10"
        }`}
        data-infant-filter-shell="true"
      >
        <span className="flex-1 leading-4">{column.label}</span>
        <div className="flex items-center gap-1">
          {column.sortable &&(
            <button
              type="button"
              onClick={() => handleSortToggle(column.key)}
              className={`rounded-md p-1 transition hover:bg-gray-200/80 dark:hover:bg-gray-600/80 ${
                activeSortForColumn
                  ? "text-blue-600 dark:text-blue-300"
                  : "text-gray-400 dark:text-gray-300"
              }`}
              aria-label={`Sort ${column.label}`}
              title={`Sort ${column.label}`}
            >
              {activeSortForColumn === "asc" ?(
                <ArrowUp className="h-3.5 w-3.5" />)
                : activeSortForColumn === "desc" ?(
                <ArrowDown className="h-3.5 w-3.5" />)
                :(
                <ArrowUpDown className="h-3.5 w-3.5" />)
               }
            </button>)
           }
          {column.filterable &&(
            <button
              type="button"
              onClick={() => openColumnFilterPanel(column.key)}
              className={`rounded-md p-1 transition hover:bg-gray-200/80 dark:hover:bg-gray-600/80 ${
                activeFilterForColumn || activeFilterPanel === column.key
                  ? "text-blue-600 dark:text-blue-300"
                  : "text-gray-400 dark:text-gray-300"
              }`}
              aria-label={`Filter ${column.label}`}
              title={`Filter ${column.label}`}
            >
              <Filter className="h-3.5 w-3.5" />
            </button>)
           }
        </div>
        {renderColumnFilterPanel(column)}
      </div>)
     ;
  };

  if (loading) {
    return(
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading infants...
        </span>
      </div>)
     ;
  }

  if (error) {
    return(
      <PageContainer>
        <Alert variant="error" title="Error loading infants">
          {error}
          <div className="mt-4">
            <Button onClick={() => fetchInfants(false)} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>)
     ;
  }

if (activeView !== "list" && activeView !== "transfer-in" && selectedInfant) {
    return(
      <div className="space-y-8 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBackToList}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedInfant.first_name} {selectedInfant.last_name}
              </h2>
              <p className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-300">
                Infant Control Number: {formatControlNumberDisplay(selectedInfant.control_number, selectedInfant.dob)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    WORKFLOW_STATUS_META[getInfantWorkflowStatusValue(selectedInfant)]
                      ?.variant ||
                    "secondary"
                  }
                >
                  {WORKFLOW_STATUS_META[getInfantWorkflowStatusValue(selectedInfant)]
                    ?.label ||
                    "Workflow Active"}
                </Badge>
                {selectedInfant.latest_transfer_case_status &&(
                  <Badge
                    variant={
                      TRANSFER_STATUS_META[selectedInfant.latest_transfer_case_status]
                        ?.variant || "secondary"
                    }
                  >
                    {TRANSFER_STATUS_META[selectedInfant.latest_transfer_case_status]
                      ?.label || selectedInfant.latest_transfer_case_status}
                  </Badge>)
                 }
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => openReadinessManager(selectedInfant)}
          >
            Manage Readiness
          </Button>

          <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => handleSelectInfantDetailView("personal")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "personal"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Personal Record
            </button>
            <button
              onClick={() => handleSelectInfantDetailView("schedule")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "schedule"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Vaccine Schedule
            </button>
            <button
              onClick={() => handleSelectInfantDetailView("records")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "records"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Immunization Records
            </button>
            <button
              onClick={() => handleSelectInfantDetailView("chart")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "chart"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Immunization Chart
            </button>
          </div>
        </div>

        {activeView === "chart" ?(
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Completed</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Number(selectedInfant.completed_vaccinations || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pending</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Number(selectedInfant.pending_vaccinations || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Imported History</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Number(selectedInfant.imported_vaccinations || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Transfer Source</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                  {selectedInfant.latest_transfer_source_facility || "No transfer source"}
                </p>
              </div>
            </div>
            <ImmunizationChart infantId={selectedInfant.id} />
          </div>)
          :(
          <PageContainer
            title={
              activeView === "personal"
                ? "Personal Information Record"
                : activeView === "schedule"
                  ? "Vaccine Schedule Booklet"
                  : "Immunization Record Booklet"
            }
          >
            <div className="animate-fade-in">
              {activeView === "schedule" &&(
                <VaccineScheduleBooklet infantId={selectedInfant.id} />)
               }
              {activeView === "records" &&(
                <ImmunizationRecordBooklet infantId={selectedInfant.id} />)
               }
              {activeView === "personal" &&(
                <InfantPersonalRecord
                  infantId={selectedInfant.id}
                  onUpdate={handlePersonalUpdate}
                />)
               }
            </div>
          </PageContainer>)
         }

        {/* Inject Vaccine Button */}
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={() => openRecordVaccinationsModal(selectedInfant)}
            variant="primary"
            className="flex items-center gap-2 shadow-lg"
            size="lg"
          >
            <Syringe className="w-5 h-5" /> Record Vaccinations
          </Button>
        </div>
      </div>)
     ;
  }

  return(
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <div className={activeView === "transfer-in" ? "w-full" : contentShellClassName}>
          <PageHeader
            title={activeView === "transfer-in" ? "Transfer-In Cases" : "Infant Management"}
            subtitle={activeView === "transfer-in" ? "Manage and validate infant vaccination records transferred from other facilities" : "Digital booklets and records for pediatric patients"}
            icon={activeView === "transfer-in" ? <BookOpen className="w-6 h-6" /> : <Baby className="w-6 h-6" />}
            actions={
              <div className="flex flex-wrap gap-2">
                {activeView === "transfer-in" ?(
                  <>
                    <Button
                      onClick={() => {
                        setTransferCasesRefreshing(false);
                        setSelectedInfant(null);
                        setActiveView("list");
                        navigate("/infants", {
                          replace: true,
                          state: location.state,
                        });
                      }}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Infants
                    </Button>
                    <Button
                      onClick={() => transferInCasesRef.current?.fetchCases(true)}
                      variant="secondary"
                      disabled={transferCasesRefreshing}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${transferCasesRefreshing ? "animate-spin" : ""}`} />
                      {transferCasesRefreshing ? "Refreshing..." : "Refresh"}
                    </Button>
                  </>)
                  :(
                  <>
                    <Button
                      onClick={() => {
                        setSelectedInfant(null);
                        navigate("/infants?view=transfer-in", {
                          state: location.state,
                        });
                      }}
                      variant="info"
                      className="flex items-center gap-2"
                    >
                      <BookOpen className="w-4 h-4" /> Transfer-In Cases
                    </Button>
                    <Button
                      onClick={() => openRecordVaccinationsModal(null)}
                      variant="success"
                      className="flex items-center gap-2"
                    >
                      <Syringe className="w-4 h-4" /> Record Vaccinations
                    </Button>
                    <Button
                      onClick={() => setShowAddModal(true)}
                      variant="primary"
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add New Infant
                    </Button>
                  </>)
                 }
              </div>
            }
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 overflow-hidden">
        {activeView === "transfer-in" ?(
          <div className="flex-1 min-h-0 overflow-hidden animate-fade-in -mx-4 sm:-mx-6 -mb-6 px-4 sm:px-6 pb-6">
            <TransferInCases
              ref={transferInCasesRef}
              showHeader={false}
              onRefreshStateChange={setTransferCasesRefreshing}
            />
          </div>)
          :(
          <div className={`${contentShellClassName} flex-1 min-h-0`}>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Visible Infants</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{infantSummary.total}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Needs Review</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{infantSummary.needsReview}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Transfer-In Cases</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{infantSummary.withImportedHistory}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pending Doses</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{infantSummary.pendingVaccinations}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="z-20 mb-3 flex-shrink-0 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-[26rem]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                  placeholder="Search by name, control no, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="w-full sm:w-auto">
              <select
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setCurrentPage(1); }}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                title="Filter by registration period"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {period === "custom" &&(
              <>
                <div className="w-full sm:w-auto sm:max-w-[180px]">
                  <Input
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => { setPeriodStartDate(e.target.value); setCurrentPage(1); }}
                    title="Registration date from"
                  />
                </div>
                <div className="w-full sm:w-auto sm:max-w-[180px]">
                  <Input
                    type="date"
                    value={periodEndDate}
                    onChange={(e) => { setPeriodEndDate(e.target.value); setCurrentPage(1); }}
                    title="Registration date to"
                  />
                </div>
              </>)
             }
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              {refreshing &&(
                <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</span>)
               }
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchInfants(true)}
                disabled={refreshing}
                title="Refresh infant list"
              >
                <span className="mr-1">🔄</span> {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <div className="self-center whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                {topSummaryText}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 animate-fade-in">
          <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 sm:text-lg">
              Registered Infants - Click to View Digital Booklets
            </h3>
          </div>
          {activeFilterChips.length > 0 &&(
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800">
              {activeFilterChips.map((chip) =>(
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={() => handleColumnFilterRemoval(chip.key)}
                    className="rounded-full p-0.5 transition hover:bg-blue-100 dark:hover:bg-blue-500/20"
                    aria-label={`Remove ${chip.label}`}
                    title={`Remove ${chip.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>)
               )}
            </div>)
           }
          <div className="flex-1 overflow-auto auto-hide-scrollbar">
            <table className="relative min-w-[1320px] w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <colgroup>
                {columns.map((col) =>(
                  <col
                    key={col.key}
                    style={buildColumnStyle(col.width, col.minWidth)}
                  />)
                 )}
                <col style={buildColumnStyle(actionsColumnWidth, actionsColumnMinWidth)} />
              </colgroup>
              <thead className="sticky top-0 z-10 overflow-visible bg-gray-50 shadow-sm dark:bg-gray-700">
                <tr>
                  {columns.map((col) =>(
                    <th
                      key={col.key}
                      scope="col"
                      style={buildColumnStyle(col.width, col.minWidth)}
                      className={`relative align-middle overflow-visible bg-gray-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:bg-gray-700 dark:text-gray-300 ${
                        activeFilterPanel === col.key ? "z-[1200]" : "z-10"
                      } focus-within:z-[1200] ${col.headerClassName || ""}`}
                    >
                      {renderHeaderCellContent(col)}
                    </th>)
                   )}
                  <th
                    scope="col"
                    style={buildColumnStyle(actionsColumnWidth, actionsColumnMinWidth)}
                    className="relative z-10 align-middle overflow-visible bg-gray-50 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:bg-gray-700 dark:text-gray-300 whitespace-nowrap"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInfants.length === 0 ?(
                  <tr>
                    <td colSpan={columns.length + 1} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-4xl mb-3">👶</span>
                        <p className="text-lg font-medium">
                          {hasActiveColumnFilters
                            ? "No infants match the selected column filters."
                            : "No infants registered yet."}
                        </p>
                      </div>
                    </td>
                  </tr>)
                  :
                                      (paginatedInfants.map((row)=>(
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {columns.map((col, colIndex) =>(
                        <td
                          key={col.key || colIndex}
                          style={buildColumnStyle(col.width, col.minWidth)}
                          className={`overflow-hidden px-3 py-3 align-top text-sm text-gray-900 dark:text-gray-100 ${col.cellClassName || "whitespace-nowrap"}`}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : col.type === "date" && row[col.key]
                              ? new Date(row[col.key]).toLocaleDateString()
                              : row[col.key]}
                        </td>)
                       )}
                      <td
                        style={buildColumnStyle(actionsColumnWidth, actionsColumnMinWidth)}
                        className="overflow-hidden px-3 py-3 align-middle text-right text-sm font-medium"
                      >
                        {tableActions(row)}
                      </td>
                    </tr>)
                   ))
                 }
              </tbody>
            </table>
          </div>

          {totalInfants > 0 &&(
            <div className="flex flex-shrink-0 flex-col gap-3 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-gray-500">
                {tableSummaryText}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="infant-rows-per-page"
                    className="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >
                    Rows
                  </label>
                  <select
                    id="infant-rows-per-page"
                    value={itemsPerPage}
                    onChange={(event) => {
                      const nextPageSize = Number(event.target.value) || DEFAULT_ITEMS_PER_PAGE;
                      setItemsPerPage(nextPageSize);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    aria-label="Rows per page"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map((option) =>(
                      <option key={option} value={option}>
                        {option}
                      </option>)
                     )}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={!infantPagination?.hasPrev || currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!infantPagination?.hasNext || currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="infant-page-jump"
                    className="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >
                    Go to page
                  </label>
                  <input
                    id="infant-page-jump"
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInputValue}
                    onChange={(event) => setPageInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handlePageJumpSubmit();
                      }
                    }}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    aria-label="Go to page"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePageJumpSubmit}
                    disabled={totalPages <= 1}
                  >
                    Go
                  </Button>
                </div>
              </div>
            </div>)
           }
        </div>
          </div>)
         }
      </div>

      {/* Add Infant Modal */}
      <AddInfantModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      <VaccineReadinessManager
        isOpen={showReadinessModal}
        onClose={closeReadinessManager}
        infantId={readinessTargetInfant?.id}
        infantName={readinessTargetInfant ? getInfantDisplayLabel(readinessTargetInfant) : ""}
        onSuccess={() => {
          void fetchInfants(true);
        }}
      />

      {/* Inject Vaccine Modal */}
      <InjectVaccineModal
        isOpen={showInjectModal}
        onClose={() => {
          setShowInjectModal(false);
          setRecordVaccinationPrefill(null);
        }}
        infantId={selectedInfant?.id}
        infantName={selectedInfant ? getInfantDisplayLabel(selectedInfant) : ""}
        prefillContext={recordVaccinationPrefill}
        onSuccess={() => {
          setShowInjectModal(false);
          setRecordVaccinationPrefill(null);
          if (selectedInfant) {
            fetchInfants();
          }
        }}
      />
    </div>)
   ;
}
