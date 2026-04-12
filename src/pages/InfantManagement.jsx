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
import { normalizeInfantsResponse } from "../utils/adminDataAdapters";
import {
  buildInfantRecordPrefillContext,
  getInfantDisplayLabel,
} from "../utils/infantIdentity";
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
  User,
  Calendar,
  BookOpen,
  BarChart2,
  Plus,
  Search,
  Syringe,
  Baby,
  RefreshCw,
} from "lucide-react";

const WORKFLOW_STATUS_META = {
  needs_review: { label: "Needs Review", variant: "warning" },
  pending_doses: { label: "Pending Doses", variant: "info" },
  in_progress: { label: "In Progress", variant: "success" },
  up_to_date: { label: "Up to Date", variant: "secondary" },
};

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
    Number(pagination?.totalPages) ||
    (normalizedLimit > 0 ? Math.ceil(normalizedTotal / normalizedLimit) : 0);

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
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [transferCasesRefreshing, setTransferCasesRefreshing] = useState(false);
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
  }, [debouncedSearchQuery, startDateFilter, endDateFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedInfant || (activeView !== "list" && activeView !== "transfer-in")) {
      return;
    }

    const requestedView = new URLSearchParams(location.search).get("view");
    const nextPrimaryView = requestedView === "transfer-in" ? "transfer-in" : "list";

    if (activeView !== nextPrimaryView) {
      setActiveView(nextPrimaryView);
    }
  }, [activeView, location.search, selectedInfant]);

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
      if (isRefresh || hasLoadedInitialData) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await infantService.getAll({
        page: currentPage,
        limit: itemsPerPage,
        ...(isAdmin ? { scope: "system" } : {}),
        ...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
        ...(startDateFilter ? { start_date: startDateFilter } : {}),
        ...(endDateFilter ? { end_date: endDateFilter } : {}),
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
          (infant) => infant.workflow_status === "needs_review",
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
      setHasLoadedInitialData(true);
    }
  }, [
    currentPage,
    startDateFilter,
    endDateFilter,
    debouncedSearchQuery,
    hasLoadedInitialData,
    isAdmin,
    itemsPerPage,
    selectedInfant?.id,
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
  };

  const handleBackToList = () => {
    // Refresh the infants list when returning to list view
    void fetchInfants();
    setSelectedInfant(null);
    setActiveView("list");
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

  const filteredInfants = infants;
  const paginatedInfants = infants;
  const totalPages = Math.max(
    1,
    Number(infantPagination?.totalPages || 0) || 1,
  );
  const totalInfants = Number(infantPagination?.total || infants.length || 0) || 0;
  const visibleInfantStart =
    totalInfants > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const visibleInfantEnd =
    totalInfants > 0
      ? Math.min(currentPage * itemsPerPage, totalInfants)
      : 0;
  const contentShellClassName = "flex w-full flex-col";
  const actionButtonClassName =
    "gap-1 whitespace-nowrap rounded-md px-2.5 shadow-none";
  const actionsColumnWidth = "21rem";

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "11.5rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-normal break-words",
      render: (val, row) => (
        <div className="font-semibold leading-5 text-gray-900 dark:text-gray-100">
          {row.first_name} {row.last_name}
        </div>
      ),
    },
    {
      key: "control_number",
      label: "Infant Control Number",
      width: "13rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val, row) => (
        <span className="inline-flex max-w-full overflow-hidden rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {formatControlNumberDisplay(val, row.dob)}
        </span>
      ),
    },
    {
      key: "dob",
      label: "Date of Birth",
      width: "7rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      type: "date",
    },
    {
      key: "sex",
      label: "Gender",
      width: "5.5rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val) => {
        // Handle both 'M'/'F' and 'male'/'female' formats
        const isMale =
          val === "male" || val === "M" || val?.toLowerCase() === "male";
        const isFemale =
          val === "female" || val === "F" || val?.toLowerCase() === "female";
        return (
          <Badge variant={isMale ? "info" : "primary"}>
            {isMale ? "Male" : isFemale ? "Female" : "Other"}
          </Badge>
        );
      },
    },
    {
      key: "parents",
      label: "Parents/Guardian",
      width: "18.5rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-normal break-words",
      render: (val, row) => {
        const parents = [];
        if (row.mother_name) parents.push(`Mother: ${row.mother_name}`);
        if (row.father_name) parents.push(`Father: ${row.father_name}`);
        // If no parents, show guardian name
        if (parents.length === 0 && row.guardian_name) {
          parents.push(row.guardian_name);
        }
        return (
          <div className="space-y-0.5 text-[13px] leading-5">
            {parents.length > 0 ? (
              parents.map((p, i) => (
                <div key={i} className="text-gray-700 dark:text-gray-300">
                  {p}
                </div>
              ))
            ) : (
              <span className="text-gray-400">Not specified</span>
            )}
          </div>
        );
      },
    },
    {
      key: "contact",
      label: "Contact",
      width: "8rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val, row) => (
        <div className="text-[13px] leading-5 text-gray-700 dark:text-gray-300">
          {row.cellphone_number || row.guardian_phone || "Not specified"}
        </div>
      ),
    },
    {
      key: "workflow_status",
      label: "Workflow",
      width: "8rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val, row) => {
        const workflowMeta =
          WORKFLOW_STATUS_META[row.workflow_status] || WORKFLOW_STATUS_META.up_to_date;

        return (
          <div className="space-y-1">
            <Badge variant={workflowMeta.variant}>{workflowMeta.label}</Badge>
            {row.latest_transfer_case_status && (
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
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "vaccination_progress",
      label: "Vaccination Progress",
      width: "10rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (val, row) => (
        <div className="space-y-0.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
          <div>Completed: {Number(row.completed_vaccinations || 0)}</div>
          <div>Pending: {Number(row.pending_vaccinations || 0)}</div>
          <div>Imported: {Number(row.imported_vaccinations || 0)}</div>
        </div>
      ),
    },
    {
      key: "latest_transfer_source_facility",
      label: "Transfer Source",
      width: "9rem",
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-normal break-words",
      render: (val) => (
        <div className="text-[13px] leading-5 text-gray-700 dark:text-gray-300 whitespace-normal break-words">
          {val || "—"}
        </div>
      ),
    },
  ];

  const tableActions = (row) => (
    <div className="ml-auto flex max-w-[21rem] flex-row flex-wrap items-center justify-end gap-1.5">
      <Button
        variant="primary"
        size="xs"
        onClick={() => handleViewBooklet(row, "personal")}
        className={actionButtonClassName}
        title="Personal Information Record"
      >
        <User className="h-3.5 w-3.5" /> Personal
      </Button>
      <Button
        variant="success"
        size="xs"
        onClick={() => handleViewBooklet(row, "schedule")}
        className={actionButtonClassName}
        title="Vaccine Schedule Booklet"
      >
        <Calendar className="h-3.5 w-3.5" /> Schedule
      </Button>
      <Button
        variant="info"
        size="xs"
        onClick={() => handleViewBooklet(row, "records")}
        className={actionButtonClassName}
        title="Immunization Record Booklet"
      >
        <BookOpen className="h-3.5 w-3.5" /> Records
      </Button>
      <Button
        variant="warning"
        size="xs"
        onClick={() => handleViewBooklet(row, "chart")}
        className={actionButtonClassName}
        title="Immunization Chart"
      >
        <BarChart2 className="h-3.5 w-3.5" /> Chart
      </Button>
      <Button
        variant="secondary"
        size="xs"
        onClick={() => openReadinessManager(row)}
        className={actionButtonClassName}
        title="Manage vaccine readiness"
      >
        Ready
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading infants...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading infants">
          {error}
          <div className="mt-4">
            <Button onClick={() => fetchInfants(false)} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

if (activeView !== "list" && activeView !== "transfer-in" && selectedInfant) {
    return (
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
                    WORKFLOW_STATUS_META[selectedInfant.workflow_status]?.variant ||
                    "secondary"
                  }
                >
                  {WORKFLOW_STATUS_META[selectedInfant.workflow_status]?.label ||
                    "Workflow Active"}
                </Badge>
                {selectedInfant.latest_transfer_case_status && (
                  <Badge
                    variant={
                      TRANSFER_STATUS_META[selectedInfant.latest_transfer_case_status]
                        ?.variant || "secondary"
                    }
                  >
                    {TRANSFER_STATUS_META[selectedInfant.latest_transfer_case_status]
                      ?.label || selectedInfant.latest_transfer_case_status}
                  </Badge>
                )}
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
              onClick={() => setActiveView("personal")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "personal"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Personal Record
            </button>
            <button
              onClick={() => setActiveView("schedule")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "schedule"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Vaccine Schedule
            </button>
            <button
              onClick={() => setActiveView("records")}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                activeView === "records"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Immunization Records
            </button>
            <button
              onClick={() => setActiveView("chart")}
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

        {activeView === "chart" ? (
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
          </div>
        ) : (
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
              {activeView === "schedule" && (
                <VaccineScheduleBooklet infantId={selectedInfant.id} />
              )}
              {activeView === "records" && (
                <ImmunizationRecordBooklet infantId={selectedInfant.id} />
              )}
              {activeView === "personal" && (
                <InfantPersonalRecord
                  infantId={selectedInfant.id}
                  onUpdate={handlePersonalUpdate}
                />
              )}
            </div>
          </PageContainer>
        )}

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
      </div>
    );
  }

  return (
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
                {activeView === "transfer-in" ? (
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
                  </>
                ) : (
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
                  </>
                )}
              </div>
            }
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 overflow-hidden">
        {activeView === "transfer-in" ? (
          <div className="flex-1 min-h-0 overflow-hidden animate-fade-in -mx-4 sm:-mx-6 -mb-6 px-4 sm:px-6 pb-6">
            <TransferInCases
              ref={transferInCasesRef}
              showHeader={false}
              onRefreshStateChange={setTransferCasesRefreshing}
            />
          </div>
        ) : (
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
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-auto sm:max-w-[200px]">
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                title="Filter by Start Date of Birth"
              />
            </div>
            <div className="w-full sm:w-auto sm:max-w-[200px]">
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                title="Filter by End Date of Birth"
              />
            </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              {refreshing && (
                <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</span>
              )}
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
                Showing {visibleInfantEnd} of {totalInfants} infants
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
          <div className="flex-1 overflow-auto auto-hide-scrollbar">
            <table className="relative min-w-[1320px] w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <colgroup>
                {columns.map((col) => (
                  <col key={col.key} style={col.width ? { width: col.width } : undefined} />
                ))}
                <col style={{ width: actionsColumnWidth }} />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`bg-gray-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:bg-gray-700 dark:text-gray-300 ${col.headerClassName || ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="bg-gray-50 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:bg-gray-700 dark:text-gray-300 whitespace-nowrap"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInfants.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-4xl mb-3">👶</span>
                        <p className="text-lg font-medium">No infants registered yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedInfants.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {columns.map((col, colIndex) => (
                        <td
                          key={col.key || colIndex}
                          className={`px-3 py-3 align-top text-sm text-gray-900 dark:text-gray-100 ${col.cellClassName || "whitespace-nowrap"}`}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : col.type === "date" && row[col.key]
                              ? new Date(row[col.key]).toLocaleDateString()
                              : row[col.key]}
                        </td>
                      ))}
                      <td className="px-3 py-3 align-middle text-right text-sm font-medium">
                        {tableActions(row)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-sm text-gray-500">
                Showing {visibleInfantStart} to {visibleInfantEnd} of {totalInfants} infants
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!infantPagination?.hasPrev || currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
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
            </div>
          )}
        </div>
          </div>
        )}
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
    </div>
  );
}
