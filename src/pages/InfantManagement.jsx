import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { normalizeInfantsResponse } from "../utils/adminDataAdapters";
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
    infant_id: normalizedInfantId,
    vaccine_id: normalizedVaccineId,
    dose_number: normalizedDoseNumber,
    date_administered: prefill.date_administered || prefill.admin_date || "",
    next_due_date: prefill.next_due_date || prefill.nextDueDate || "",
    status: prefill.status || "completed",
  };
};

export default function InfantManagement() {
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [dateFilter, setDateFilter] = useState("");
  const [transferCasesRefreshing, setTransferCasesRefreshing] = useState(false);

  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const transferInCasesRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, dateFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch all infants to allow reliable client-side sorting, filtering, and pagination
      const result = await infantService.getAll();
      const infantsData = normalizeInfantsResponse(result?.data ?? result);

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      setInfants(infantsData);
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
    } finally {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedInfant?.id]);

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

  // Centralized filter + memory-safe chunking
  const filteredInfants = useMemo(() => {
    let result = [...infants];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(infant =>
        infant.first_name?.toLowerCase().includes(query) ||
        infant.last_name?.toLowerCase().includes(query) ||
        infant.guardian_name?.toLowerCase().includes(query) ||
        infant.mother_name?.toLowerCase().includes(query) ||
        infant.father_name?.toLowerCase().includes(query) ||
        infant.control_number?.toLowerCase().includes(query) ||
        infant.cellphone_number?.toLowerCase().includes(query) ||
        infant.guardian_phone?.toLowerCase().includes(query)
      );
    }

    if (dateFilter) {
      result = result.filter(infant => infant.dob && new Date(infant.dob).toISOString().split('T')[0] === dateFilter);
    }

    return result;
  }, [infants, debouncedSearchQuery, dateFilter]);

  const paginatedInfants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInfants.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInfants, currentPage]);
  const totalPages = Math.ceil(filteredInfants.length / itemsPerPage);

  const infantSummary = {
    total: filteredInfants.length,
    needsReview: filteredInfants.filter(
      (infant) => infant.workflow_status === "needs_review",
    ).length,
    withImportedHistory: filteredInfants.filter(
      (infant) => Number(infant.imported_vaccinations || 0) > 0,
    ).length,
    pendingVaccinations: filteredInfants.reduce(
      (total, infant) => total + Number(infant.pending_vaccinations || 0),
      0,
    ),
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      headerClassName: "w-auto whitespace-nowrap",
      cellClassName: "whitespace-normal min-w-[10rem]",
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {row.first_name} {row.last_name}
        </div>
      ),
    },
    {
      key: "control_number",
      label: "Infant Control Number",
      headerClassName: "w-px whitespace-nowrap",
      cellClassName: "w-px whitespace-nowrap",
      render: (val, row) => (
        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
          {formatControlNumberDisplay(val, row.dob)}
        </span>
      ),
    },
    {
      key: "dob",
      label: "Date of Birth",
      headerClassName: "w-px whitespace-nowrap",
      cellClassName: "w-px whitespace-nowrap",
      type: "date",
    },
    {
      key: "sex",
      label: "Gender",
      headerClassName: "w-px whitespace-nowrap",
      cellClassName: "w-px whitespace-nowrap",
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
      headerClassName: "w-auto whitespace-nowrap",
      cellClassName: "whitespace-normal min-w-[14rem]",
      render: (val, row) => {
        const parents = [];
        if (row.mother_name) parents.push(`Mother: ${row.mother_name}`);
        if (row.father_name) parents.push(`Father: ${row.father_name}`);
        // If no parents, show guardian name
        if (parents.length === 0 && row.guardian_name) {
          parents.push(row.guardian_name);
        }
        return (
          <div className="text-sm">
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
      headerClassName: "w-px whitespace-nowrap",
      cellClassName: "w-px whitespace-nowrap",
      render: (val, row) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {row.cellphone_number || row.guardian_phone || "Not specified"}
        </div>
      ),
    },
    {
      key: "workflow_status",
      label: "Workflow",
      headerClassName: "w-px whitespace-nowrap",
      cellClassName: "w-px whitespace-nowrap",
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
      headerClassName: "w-px whitespace-nowrap",
      cellClassName: "w-px whitespace-nowrap",
      render: (val, row) => (
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <div>Completed: {Number(row.completed_vaccinations || 0)}</div>
          <div>Pending: {Number(row.pending_vaccinations || 0)}</div>
          <div>Imported: {Number(row.imported_vaccinations || 0)}</div>
        </div>
      ),
    },
    {
      key: "latest_transfer_source_facility",
      label: "Transfer Source",
      headerClassName: "w-auto whitespace-nowrap",
      cellClassName: "whitespace-normal min-w-[12rem]",
      render: (val) => (
        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-normal break-words">
          {val || "—"}
        </div>
      ),
    },
  ];

  const tableActions = (row) => (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant="primary"
        size="sm"
        onClick={() => handleViewBooklet(row, "personal")}
        className="gap-1.5"
        title="Personal Information Record"
      >
        <User className="w-4 h-4" /> Personal
      </Button>
      <Button
        variant="success"
        size="sm"
        onClick={() => handleViewBooklet(row, "schedule")}
        className="gap-1.5"
        title="Vaccine Schedule Booklet"
      >
        <Calendar className="w-4 h-4" /> Schedule
      </Button>
      <Button
        variant="info"
        size="sm"
        onClick={() => handleViewBooklet(row, "records")}
        className="gap-1.5"
        title="Immunization Record Booklet"
      >
        <BookOpen className="w-4 h-4" /> Records
      </Button>
      <Button
        variant="warning"
        size="sm"
        onClick={() => handleViewBooklet(row, "chart")}
        className="gap-1.5"
        title="Immunization Chart"
      >
        <BarChart2 className="w-4 h-4" /> Chart
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => openReadinessManager(row)}
        className="gap-1.5"
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
            onClick={() => {
              setRecordVaccinationPrefill(null);
              setShowInjectModal(true);
            }}
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
                      setActiveView("list");
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
                      setActiveView("transfer-in");
                    }}
                    variant="info"
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" /> Transfer-In Cases
                  </Button>
                  <Button
                    onClick={() => {
                      setRecordVaccinationPrefill(null);
                      setShowInjectModal(true);
                    }}
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

      <div className="flex-1 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 overflow-hidden">
        {activeView === "transfer-in" ? (
          <div className="flex-1 overflow-auto animate-fade-in -mx-4 sm:-mx-6 -mb-6 px-4 sm:px-6 pb-6">
            <TransferInCases
              ref={transferInCasesRef}
              showHeader={false}
              onRefreshStateChange={setTransferCasesRefreshing}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Visible Infants</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{infantSummary.total}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Needs Review</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{infantSummary.needsReview}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Imported History</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{infantSummary.withImportedHistory}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pending Doses</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{infantSummary.pendingVaccinations}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-shrink-0 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
            <div className="relative flex-1 w-full lg:max-w-md">
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
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                title="Filter by Date of Birth"
              />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-3 w-full lg:w-auto">
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
              <div className="text-sm text-gray-600 dark:text-gray-400 self-center">
                Showing {Math.min(currentPage * itemsPerPage, filteredInfants.length)} of {filteredInfants.length} infants
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Registered Infants - Click to View Digital Booklets
            </h3>
          </div>
          <div className="flex-1 overflow-auto auto-hide-scrollbar">
            <table className="min-w-full w-full table-auto divide-y divide-gray-200 dark:divide-gray-700 relative">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 ${col.headerClassName || ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 w-px whitespace-nowrap"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInfants.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
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
                          className={`px-4 py-4 align-top text-sm text-gray-900 dark:text-gray-100 ${col.cellClassName || "whitespace-nowrap"}`}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : col.type === "date" && row[col.key]
                              ? new Date(row[col.key]).toLocaleDateString()
                              : row[col.key]}
                        </td>
                      ))}
                      <td className="px-4 py-4 align-top whitespace-nowrap text-sm font-medium w-px">
                        {tableActions(row)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredInfants.length)}{" "}
                of {filteredInfants.length} infants
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
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
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
          </>
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
        infantName={
          readinessTargetInfant
            ? `${readinessTargetInfant.first_name} ${readinessTargetInfant.last_name}`
            : ""
        }
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
        infantName={
          selectedInfant
            ? `${selectedInfant.first_name} ${selectedInfant.last_name}`
            : ""
        }
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
