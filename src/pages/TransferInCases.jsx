import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import apiClient from "../utils/api";
import {
  Button,
  PageHeader,
  PageContainer,
  Alert,
  Badge,
  LoadingSpinner,
  Input,
  Modal,
  AdminModalActions,
  TextArea,
  Select,
  Checkbox,
} from "../components/UI";
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  FileText,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  X,
} from "lucide-react";
import {
  APPROVED_VACCINE_NAMES,
  normalizeApprovedVaccineName,
} from "../constants/approvedVaccines";

const TRANSFER_STATUS = {
  FOR_VALIDATION: "for_validation",
  APPROVED: "approved",
  NEEDS_CLARIFICATION: "needs_clarification",
  REJECTED: "rejected",
};

const STATUS_LABELS = {
  [TRANSFER_STATUS.FOR_VALIDATION]: { label: "For Validation", variant: "warning" },
  [TRANSFER_STATUS.APPROVED]: { label: "Approved", variant: "success" },
  [TRANSFER_STATUS.NEEDS_CLARIFICATION]: { label: "Needs Clarification", variant: "info" },
  [TRANSFER_STATUS.REJECTED]: { label: "Rejected", variant: "danger" },
};

const VALIDATION_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
};

const PRIORITY_LABELS = {
  [VALIDATION_PRIORITY.LOW]: { label: "Low", variant: "secondary" },
  [VALIDATION_PRIORITY.NORMAL]: { label: "Normal", variant: "warning" },
  [VALIDATION_PRIORITY.HIGH]: { label: "High", variant: "danger" },
};

const TRIAGE_CATEGORIES = [
  "ready_for_scheduling",
  "needs_record_verification",
  "needs_missing_information",
  "not_yet_due",
  "overdue_priority_followup",
];

const TRIAGE_LABELS = {
  ready_for_scheduling: { label: "Ready for Scheduling", variant: "success" },
  needs_record_verification: { label: "Needs Record Verification", variant: "warning" },
  needs_missing_information: { label: "Needs Missing Information", variant: "danger" },
  not_yet_due: { label: "Not Yet Due", variant: "secondary" },
  overdue_priority_followup: { label: "Overdue Priority Follow-up", variant: "danger" },
};

const DEFAULT_TRANSFER_CASE_SORT_STATE = {
  key: null,
  direction: null,
};

const TRANSFER_CASE_TEXT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const normalizeTransferCaseDateValue = (value) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? Number.POSITIVE_INFINITY
    : parsedDate.getTime();
};

const normalizeTransferCaseVaccineValue = (value) =>
  normalizeApprovedVaccineName(value) || String(value || "").trim();

const getTransferCaseSortValue = (caseItem = {}, columnKey) => {
  if (columnKey === "guardian_name") {
    return String(caseItem.guardian_name || "").trim();
  }

  if (columnKey === "created_at") {
    return normalizeTransferCaseDateValue(caseItem.created_at);
  }

  return String(caseItem?.[columnKey] || "").trim();
};

const sortTransferCases = (rows = [], sortState = DEFAULT_TRANSFER_CASE_SORT_STATE) => {
  if (!sortState?.key || !sortState?.direction) {
    return Array.isArray(rows) ? rows : [];
  }

  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((leftEntry, rightEntry) => {
      const leftValue = getTransferCaseSortValue(leftEntry.row, sortState.key);
      const rightValue = getTransferCaseSortValue(rightEntry.row, sortState.key);

      const comparison =
        typeof leftValue === "number" || typeof rightValue === "number"
          ? Number(leftValue || 0) - Number(rightValue || 0)
          : TRANSFER_CASE_TEXT_COLLATOR.compare(
              String(leftValue || ""),
              String(rightValue || ""),
            );

      if (comparison !== 0) {
        return sortState.direction === "asc" ? comparison : -comparison;
      }

      return leftEntry.index - rightEntry.index;
    })
    .map((entry) => entry.row);
};

const TransferInCases = React.forwardRef(({ showHeader = true, onRefreshStateChange }, ref) => {
  const { isAdmin } = useAuth();
  const { success, error, warning } = useNotification();

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorState, setErrorState] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [triageFilter, setTriageFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [sortState, setSortState] = useState(DEFAULT_TRANSFER_CASE_SORT_STATE);
  const [nextVaccineFilters, setNextVaccineFilters] = useState([]);
  const [activeHeaderFilter, setActiveHeaderFilter] = useState(null);
  const [nextVaccineFilterDraft, setNextVaccineFilterDraft] = useState([]);

  const [selectedCase, setSelectedCase] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showVaccineImportModal, setShowVaccineImportModal] = useState(false);
  const [validationNotes, setValidationNotes] = useState("");
  const [validationStatus, setValidationStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // State for vaccine approval
  const [selectedVaccines, setSelectedVaccines] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  const [isValidating, setIsValidating] = useState(false);
  const paginatedCases = React.useMemo(
    () =>
      filteredCases.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    [filteredCases, currentPage],
  );

  const fetchCases = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorState(null);

      const pageSize = 1000;
      let offset = 0;
      let total = null;
      let aggregatedCases = [];

      do {
        const response = await apiClient.getTransferInCases({
          limit: pageSize,
          offset,
          ...(startDateFilter ? { start_date: startDateFilter } : {}),
          ...(endDateFilter ? { end_date: endDateFilter } : {}),
        });

        if (!response.success) {
          setErrorState(response.error || "Failed to fetch transfer-in cases");
          setCases([]);
          return;
        }

        const pageCases = Array.isArray(response.data) ? response.data : [];
        aggregatedCases = aggregatedCases.concat(pageCases);

        const reportedTotal = Number(response.pagination?.total);
        total = Number.isFinite(reportedTotal) ? reportedTotal : aggregatedCases.length;
        offset += pageCases.length;

        if (pageCases.length === 0) {
          break;
        }
      } while (offset < total);

      if (aggregatedCases.length > total) {
        aggregatedCases = aggregatedCases.slice(0, total);
      }

      if (total !== null && aggregatedCases.length >= 0) {
        setCases(aggregatedCases);
      } else {
        setErrorState("Failed to fetch transfer-in cases");
        setCases([]);
      }
    } catch (err) {
      console.error("Error fetching transfer-in cases:", err);
      setErrorState(err.message || "Failed to fetch transfer-in cases");
      setCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDateFilter, endDateFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchCases();
    }
  }, [isAdmin, fetchCases]);

  useEffect(() => {
    let result = [...cases];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (caseItem) =>
          caseItem.guardian_name?.toLowerCase().includes(query) ||
          caseItem.source_facility?.toLowerCase().includes(query) ||
          caseItem.auto_computed_next_vaccine?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((caseItem) => caseItem.validation_status === statusFilter);
    }

    if (priorityFilter) {
      result = result.filter((caseItem) => caseItem.validation_priority === priorityFilter);
    }

    if (triageFilter) {
      result = result.filter((caseItem) => caseItem.triage_category === triageFilter);
    }

    if (startDateFilter) {
      result = result.filter((caseItem) => {
        const submittedDate = String(caseItem.created_at || "").slice(0, 10);
        return submittedDate && submittedDate >= startDateFilter;
      });
    }

    if (endDateFilter) {
      result = result.filter((caseItem) => {
        const submittedDate = String(caseItem.created_at || "").slice(0, 10);
        return submittedDate && submittedDate <= endDateFilter;
      });
    }

    if (nextVaccineFilters.length > 0) {
      const activeVaccines = new Set(
        nextVaccineFilters
          .map((value) => normalizeTransferCaseVaccineValue(value))
          .filter(Boolean),
      );

      result = result.filter((caseItem) =>
        activeVaccines.has(
          normalizeTransferCaseVaccineValue(caseItem.auto_computed_next_vaccine),
        ),
      );
    }

    result = sortTransferCases(result, sortState);

    setFilteredCases(result);
    setCurrentPage(1);
  }, [
    cases,
    searchQuery,
    statusFilter,
    priorityFilter,
    triageFilter,
    startDateFilter,
    endDateFilter,
    nextVaccineFilters,
    sortState,
  ]);

  useEffect(() => {
    if (!activeHeaderFilter) {
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      if (event.target?.closest?.("[data-transfer-filter-shell='true']")) {
        return;
      }

      setActiveHeaderFilter(null);
      setNextVaccineFilterDraft([]);
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [activeHeaderFilter]);

  useEffect(() => {
    onRefreshStateChange?.(refreshing);
  }, [refreshing, onRefreshStateChange]);

  useEffect(() => {
    return () => {
      onRefreshStateChange?.(false);
    };
  }, [onRefreshStateChange]);

  React.useImperativeHandle(ref, () => ({
    fetchCases: (isRefresh) => {
      fetchCases(isRefresh);
    },
  }));

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

      return DEFAULT_TRANSFER_CASE_SORT_STATE;
    });
  };

  const openNextVaccineFilterPanel = () => {
    if (activeHeaderFilter === "auto_computed_next_vaccine") {
      setActiveHeaderFilter(null);
      setNextVaccineFilterDraft([]);
      return;
    }

    setActiveHeaderFilter("auto_computed_next_vaccine");
    setNextVaccineFilterDraft([...nextVaccineFilters]);
  };

  const toggleNextVaccineDraft = (vaccineName) => {
    setNextVaccineFilterDraft((previousDraft) => {
      const nextDraft = Array.isArray(previousDraft) ? [...previousDraft] : [];
      const existingIndex = nextDraft.indexOf(vaccineName);

      if (existingIndex >= 0) {
        nextDraft.splice(existingIndex, 1);
      } else {
        nextDraft.push(vaccineName);
      }

      return nextDraft;
    });
  };

  const handleNextVaccineFilterApply = () => {
    setNextVaccineFilters(
      Array.from(
        new Set(
          nextVaccineFilterDraft
            .map((value) => normalizeTransferCaseVaccineValue(value))
            .filter(Boolean),
        ),
      ),
    );
    setActiveHeaderFilter(null);
    setNextVaccineFilterDraft([]);
  };

  const handleNextVaccineFilterCancel = () => {
    setActiveHeaderFilter(null);
    setNextVaccineFilterDraft([]);
  };

  const handleNextVaccineFilterClear = () => {
    setNextVaccineFilters([]);

    if (activeHeaderFilter === "auto_computed_next_vaccine") {
      setActiveHeaderFilter(null);
      setNextVaccineFilterDraft([]);
    }
  };

  const renderNextVaccineFilterPanel = (column) => {
    if (column.key !== "auto_computed_next_vaccine" || activeHeaderFilter !== column.key) {
      return null;
    }

    return (
      <div
        className="absolute left-0 top-full z-[1200] mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 text-left normal-case tracking-normal shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`${column.label} filter`}
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Filter {column.label}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Show only transfer-in cases with matching next due vaccines.
          </p>
        </div>

        <div className="space-y-2">
          {APPROVED_VACCINE_NAMES.map((vaccineName) => (
            <label
              key={vaccineName}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
            >
              <input
                type="checkbox"
                checked={nextVaccineFilterDraft.includes(vaccineName)}
                onChange={() => toggleNextVaccineDraft(vaccineName)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{vaccineName}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleNextVaccineFilterCancel}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNextVaccineFilterApply}
            type="button"
          >
            Filter
          </Button>
        </div>
      </div>
    );
  };

  const renderHeaderCellContent = (column) => {
    const activeSortForColumn = sortState.key === column.key ? sortState.direction : null;
    const isNextVaccineFilterActive =
      column.key === "auto_computed_next_vaccine" && nextVaccineFilters.length > 0;

    return (
      <div
        className={`relative flex min-h-[1.5rem] items-center justify-between gap-2 ${
          activeHeaderFilter === column.key ? "z-[1200]" : "z-10"
        }`}
        data-transfer-filter-shell="true"
      >
        <span className="flex-1 leading-4">{column.label}</span>
        <div className="flex items-center gap-1">
          {column.sortable && (
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
              {activeSortForColumn === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : activeSortForColumn === "desc" ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {column.filterable && (
            <button
              type="button"
              onClick={openNextVaccineFilterPanel}
              className={`rounded-md p-1 transition hover:bg-gray-200/80 dark:hover:bg-gray-600/80 ${
                isNextVaccineFilterActive || activeHeaderFilter === column.key
                  ? "text-blue-600 dark:text-blue-300"
                  : "text-gray-400 dark:text-gray-300"
              }`}
              aria-label={`Filter ${column.label}`}
              title={`Filter ${column.label}`}
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {renderNextVaccineFilterPanel(column)}
      </div>
    );
  };

  const handleViewDetails = (caseItem) => {
    setSelectedCase(caseItem);
    setShowDetailsModal(true);
  };

  const handleStartValidation = (caseItem) => {
    setSelectedCase(caseItem);
    setValidationNotes("");
    setValidationStatus("");
    setShowValidationModal(true);
  };

  const handleOpenVaccineImport = (caseItem) => {
    setSelectedCase(caseItem);
    // Initialize all vaccines as selected by default
    const initialSelected = {};
    if (caseItem.submitted_vaccines && Array.isArray(caseItem.submitted_vaccines)) {
      caseItem.submitted_vaccines.forEach((vaccine, index) => {
        initialSelected[index] = true;
      });
    }
    setSelectedVaccines(initialSelected);
    setShowVaccineImportModal(true);
  };

  const handleToggleVaccine = (index) => {
    setSelectedVaccines(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleSelectAll = (select) => {
    const newSelection = {};
    if (selectedCase?.submitted_vaccines) {
      selectedCase.submitted_vaccines.forEach((_, index) => {
        newSelection[index] = select;
      });
    }
    setSelectedVaccines(newSelection);
  };

  const handleImportVaccines = async () => {
    if (!selectedCase) return;

    const vaccinesToImport = selectedCase.submitted_vaccines
      .filter((_, index) => selectedVaccines[index])
      .map(v => ({
        vaccine_name: v.vaccine_name,
        dose_number: v.dose_number,
        date_administered: v.date_administered,
        batch_number: v.batch_number,
      }));

    if (vaccinesToImport.length === 0) {
      warning("Please select at least one vaccine to import");
      return;
    }

    setIsImporting(true);

    try {
      const response = await apiClient.approveTransferCaseVaccines(selectedCase.id, {
        approvedVaccines: vaccinesToImport,
        importToRecords: true,
      });

      if (response.success) {
        success(`Successfully imported ${response.data?.summary?.success || 0} vaccines`);
        setShowVaccineImportModal(false);
        fetchCases();

        // Dispatch event to synchronize infant charts and records instantly
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("vaccination-update", {
              detail: { infant_id: selectedCase.infant_id },
            })
          );
        }
      } else {
        error(response.error || "Failed to import vaccines");
      }
    } catch (err) {
      console.error("Error importing vaccines:", err);
      error(err.response?.data?.error || err.message || "Failed to import vaccines");
    } finally {
      setIsImporting(false);
    }
  };

  const handleValidate = async () => {
    if (!validationStatus) {
      warning("Please select a validation status");
      return;
    }

    setIsValidating(true);

    try {
      // Explicitly hit the validation endpoint rather than standard update
      const response = await apiClient.customRequest(`/transfer-in-cases/${selectedCase.id}/validate`, {
        method: 'PUT',
        data: {
          validation_status: validationStatus,
          validation_notes: validationNotes,
          validated_at: new Date().toISOString(),
        }
      });

      if (response.success) {
        success("Transfer-in case validated successfully");
        setShowValidationModal(false);
        fetchCases();
      } else {
        error(response.error || "Failed to validate transfer-in case");
      }
    } catch (err) {
      console.error("Error validating transfer-in case:", err);
      error(err.response?.data?.error || err.message || "Failed to validate transfer-in case");
    } finally {
      setIsValidating(false);
    }
  };

  const columns = [
    {
      key: "guardian_name",
      label: "Guardian",
      sortable: true,
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {val || "N/A"}
        </div>
      ),
    },
    {
      key: "source_facility",
      label: "Source Facility",
    },
    {
      key: "submitted_vaccines_count",
      label: "Vaccines Submitted",
      render: (val, row) => {
        const count = row.submitted_vaccines ? row.submitted_vaccines.length : 0;
        return <Badge variant="info">{count}</Badge>;
      },
    },
    {
      key: "auto_computed_next_vaccine",
      label: "Next Vaccine",
      filterable: true,
      render: (val) => (
        <div className="max-w-xs truncate" title={val || "N/A"}>
          {val || "N/A"}
        </div>
      ),
    },
    {
      key: "triage_category",
      label: "Triage Category",
      render: (val) => {
        const triage = TRIAGE_LABELS[val] || { label: val, variant: "secondary" };
        return <Badge variant={triage.variant}>{triage.label}</Badge>;
      },
    },
    {
      key: "validation_status",
      label: "Validation Status",
      render: (val) => {
        const status = STATUS_LABELS[val] || { label: val, variant: "secondary" };
        return (
          <div className="flex items-center gap-2">
            {val === TRANSFER_STATUS.REJECTED && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            {val === TRANSFER_STATUS.FOR_VALIDATION && (
              <Clock className="w-4 h-4 text-yellow-500" />
            )}
            {val === TRANSFER_STATUS.APPROVED && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        );
      },
    },
    {
      key: "validation_priority",
      label: "Priority",
      render: (val) => {
        const priority = PRIORITY_LABELS[val] || { label: val, variant: "secondary" };
        return <Badge variant={priority.variant}>{priority.label}</Badge>;
      },
    },
    {
      key: "created_at",
      label: "Submitted Date",
      sortable: true,
      render: (val) => {
        if (!val) return "N/A";
        // Convert ISO string to readable format
        const date = new Date(val);
        if (Number.isNaN(date.getTime())) return val;
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      },
    },
  ];

  const tableActions = (row) => (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant="info"
        size="sm"
        onClick={() => handleViewDetails(row)}
        className="gap-1.5"
        title="View Details"
      >
        <Eye className="w-4 h-4" /> View
      </Button>
      {(row.validation_status === TRANSFER_STATUS.FOR_VALIDATION ||
        row.validation_status === TRANSFER_STATUS.NEEDS_CLARIFICATION) && (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleStartValidation(row)}
            className="gap-1.5"
            title="Validate"
          >
            <CheckCircle className="w-4 h-4" /> Validate
          </Button>
        </>
      )}
      {row.validation_status === TRANSFER_STATUS.APPROVED && !row.vaccines_imported && (
        <>
          <Button
            variant="success"
            size="sm"
            onClick={() => handleOpenVaccineImport(row)}
            className="gap-1.5"
            title="Import Vaccines"
          >
            <Download className="w-4 h-4" /> Import
          </Button>
        </>
      )}
    </div>
  );

  const handleExport = () => {
    const headers = columns.map((column) => column.label).join(",");
    const rows = paginatedCases.map((row) =>
      columns.map((column) => JSON.stringify(row[column.key] || "")).join(","),
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transfer-in-cases.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <Alert variant="error" title="Access Denied">
          You do not have permission to view this section.
        </Alert>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading transfer-in cases...
        </span>
      </div>
    );
  }

  if (errorState) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading transfer-in cases">
          {errorState}
          <div className="mt-4">
            <Button onClick={() => fetchCases(false)} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

  const pageHorizontalPaddingClass = showHeader ? "px-4 sm:px-6" : "";
  const stickyBleedClass = showHeader
    ? "-mx-4 sm:-mx-6 px-4 sm:px-6"
    : "";
  const contentBleedClass = showHeader
    ? "px-4 sm:px-6 -mx-4 sm:-mx-6"
    : "";
  const filterCardPaddingClass = showHeader ? "p-4" : "p-4 sm:p-5";
  const sectionPaddingClass = showHeader ? "px-4 py-4" : "px-5 py-4";
  const paginationPaddingClass = showHeader
    ? "px-4 py-4"
    : "px-5 py-4";

  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-6 ${pageHorizontalPaddingClass}`.trim()}
    >
      {showHeader && (
        <div
          className={`sticky top-0 z-30 -mt-6 border-b border-gray-200 bg-white pb-4 pt-6 dark:border-gray-700 dark:bg-gray-900 ${stickyBleedClass}`.trim()}
        >
          <PageHeader
            title="Transfer-In Cases Validation"
            subtitle="Review and validate transfer-in cases from other health centers"
            icon={<FileText className="w-6 h-6" />}
            actions={
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => fetchCases(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2"
                >
                  <span className="mr-1">🔄</span>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            }
          />
        </div>
      )}

      {/* Filters - Sticky below header */}
      <div
        className={`sticky ${showHeader ? "top-[88px]" : "top-0"} z-20 bg-white dark:bg-gray-900 ${stickyBleedClass}`.trim()}
      >
        <div
          className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${filterCardPaddingClass}`.trim()}
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by guardian name, facility, or vaccine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              title="Filter by Submitted Start Date"
              className="w-48"
            />

            <Input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              title="Filter by Submitted End Date"
              className="w-48"
            />

            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                {
                  value: TRANSFER_STATUS.FOR_VALIDATION,
                  label: "For Validation",
                },
                { value: TRANSFER_STATUS.APPROVED, label: "Approved" },
                {
                  value: TRANSFER_STATUS.NEEDS_CLARIFICATION,
                  label: "Needs Clarification",
                },
                { value: TRANSFER_STATUS.REJECTED, label: "Rejected" },
              ]}
              className="w-48"
            />

            <Select
              placeholder="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: "", label: "All Priorities" },
                { value: VALIDATION_PRIORITY.LOW, label: "Low" },
                { value: VALIDATION_PRIORITY.NORMAL, label: "Normal" },
                { value: VALIDATION_PRIORITY.HIGH, label: "High" },
              ]}
              className="w-48"
            />

            <Select
              placeholder="Filter by triage"
              value={triageFilter}
              onChange={(e) => setTriageFilter(e.target.value)}
              options={[
                { value: "", label: "All Categories" },
                ...TRIAGE_CATEGORIES.map((category) => ({
                  value: category,
                  label: TRIAGE_LABELS[category].label,
                })),
              ]}
              className="w-48"
            />
          </div>
        </div>
      </div>

      <div
        className={`animate-fade-in flex-1 min-h-0 flex flex-col ${contentBleedClass}`.trim()}
      >
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div
            className={`border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 flex items-center justify-between gap-4 flex-shrink-0 ${sectionPaddingClass}`.trim()}
          >
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Transfer-In Cases - Click to View Details
            </h3>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              Export CSV
            </Button>
          </div>

          {nextVaccineFilters.length > 0 && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
                <span>{`Next Vaccine: ${nextVaccineFilters.join(", ")}`}</span>
                <button
                  type="button"
                  onClick={handleNextVaccineFilterClear}
                  className="rounded-full p-0.5 transition hover:bg-blue-100 dark:hover:bg-blue-500/20"
                  aria-label={`Remove Next Vaccine: ${nextVaccineFilters.join(", ")}`}
                  title={`Remove Next Vaccine: ${nextVaccineFilters.join(", ")}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto auto-hide-scrollbar scroll-smooth">
            <table className="min-w-full w-full table-auto divide-y divide-gray-200 dark:divide-gray-700 relative">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`relative px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 ${
                        activeHeaderFilter === column.key ? "z-[1200]" : "z-10"
                      } ${column.headerClassName || ""}`}
                    >
                      {renderHeaderCellContent(column)}
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
                {paginatedCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-4xl mb-3">&#128196;</span>
                        <p className="text-lg font-medium">
                          No transfer-in cases found.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {columns.map((column, columnIndex) => (
                        <td
                          key={column.key || columnIndex}
                          className={`px-4 py-4 align-top text-sm text-gray-900 dark:text-gray-100 ${column.cellClassName || "whitespace-nowrap"}`}
                        >
                          {column.render
                            ? column.render(row[column.key], row)
                            : row[column.key]}
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
          {filteredCases.length > itemsPerPage && (
            <div
              className={`flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 ${paginationPaddingClass}`.trim()}
            >
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredCases.length)} of{" "}
                {filteredCases.length} cases
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
                <div className="text-sm text-gray-600 dark:text-gray-400 self-center px-3">
                  Page {currentPage} of{" "}
                  {Math.ceil(filteredCases.length / itemsPerPage)}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(
                        Math.ceil(filteredCases.length / itemsPerPage),
                        p + 1,
                      ),
                    )
                  }
                  disabled={
                    currentPage >= Math.ceil(filteredCases.length / itemsPerPage)
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Transfer-In Case Details"
        size="lg"
        footer={
          <AdminModalActions>
            <Button variant="cancel" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            {(selectedCase?.validation_status === TRANSFER_STATUS.FOR_VALIDATION ||
              selectedCase?.validation_status === TRANSFER_STATUS.NEEDS_CLARIFICATION) && (
              <Button
                variant="primary"
                onClick={() => handleStartValidation(selectedCase)}
              >
                Validate Case
              </Button>
            )}
          </AdminModalActions>
        }
      >
        {selectedCase && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Guardian Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Name:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Email:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_email || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Phone:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_phone || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Case Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Source Facility:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.source_facility || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Status:{" "}
                    </span>
                    <span className="font-medium">
                      {STATUS_LABELS[selectedCase.validation_status]?.label ||
                        selectedCase.validation_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Priority:{" "}
                    </span>
                    <span className="font-medium">
                      {PRIORITY_LABELS[selectedCase.validation_priority]?.label ||
                        selectedCase.validation_priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Triage Category:{" "}
                    </span>
                    <span className="font-medium">
                      {TRIAGE_LABELS[selectedCase.triage_category]?.label ||
                        selectedCase.triage_category}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                Submitted Vaccines
              </h4>
              {selectedCase.submitted_vaccines &&
              selectedCase.submitted_vaccines.length > 0 ? (
                <ul className="space-y-2">
                  {selectedCase.submitted_vaccines.map((vaccine, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-sm font-medium">
                        {vaccine.vaccine_name}
                      </span>
                      {vaccine.dose_number && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          (Dose {vaccine.dose_number})
                        </span>
                      )}
                      {vaccine.date_administered && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          - {new Date(vaccine.date_administered).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No vaccines submitted
                </p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                Auto-Computed Next Vaccine
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {selectedCase.auto_computed_next_vaccine || "N/A"}
              </p>
            </div>

            {selectedCase.remarks && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Remarks
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCase.remarks}
                </p>
              </div>
            )}

            {selectedCase.validation_notes && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Validation Notes
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCase.validation_notes}
                </p>
                {selectedCase.validated_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Validated on{" "}
                    {new Date(selectedCase.validated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Validation Modal */}
      <Modal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="Validate Transfer-In Case"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              onClick={() => setShowValidationModal(false)}
              disabled={isValidating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleValidate}
              disabled={isValidating || !validationStatus}
            >
              {isValidating ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" /> Validating...
                </span>
              ) : (
                "Validate"
              )}
            </Button>
          </AdminModalActions>
        }
      >
        {selectedCase && (
          <div className="space-y-6">
            <Alert variant="warning" title="Validation Warning">
              This action will validate the transfer-in case and update the
              infant's vaccination record. Approved cases now import the
              validated transfer doses into the official child record automatically.
              Please review the information
              carefully before proceeding.
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Guardian Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Name:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Source Facility:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.source_facility || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Next Vaccine
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCase.auto_computed_next_vaccine || "N/A"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Select
                label="Validation Status"
                value={validationStatus}
                onChange={(e) => setValidationStatus(e.target.value)}
                required
                options={[
                  { value: TRANSFER_STATUS.APPROVED, label: "Approve" },
                  {
                    value: TRANSFER_STATUS.NEEDS_CLARIFICATION,
                    label: "Request Clarification",
                  },
                  { value: TRANSFER_STATUS.REJECTED, label: "Reject" },
                ]}
              />

              <TextArea
                label="Validation Notes"
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Add notes about the validation (required if rejecting)..."
                rows={4}
                required
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Vaccine Import Modal */}
      <Modal
        isOpen={showVaccineImportModal}
        onClose={() => setShowVaccineImportModal(false)}
        title="Import Vaccines to Records"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              onClick={() => setShowVaccineImportModal(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleImportVaccines}
              disabled={isImporting}
            >
              {isImporting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" /> Importing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" /> Import Selected
                </span>
              )}
            </Button>
          </AdminModalActions>
        }
      >
        {selectedCase && (
          <div className="space-y-6">
            <Alert variant="info" title="Vaccine Import">
              Select the vaccines you want to import into the infant's vaccination records.
              Duplicate vaccines will be skipped automatically.
            </Alert>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                Case Information
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Infant:</span>{" "}
                  <span className="font-medium">
                    {selectedCase.infant_first_name} {selectedCase.infant_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Source Facility:</span>{" "}
                  <span className="font-medium">{selectedCase.source_facility}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-900 dark:text-gray-100">
                  Submitted Vaccines
                </h4>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(false)}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {selectedCase.submitted_vaccines && selectedCase.submitted_vaccines.length > 0 ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedCase.submitted_vaccines.map((vaccine, index) => (
                    <div
                      key={index}
                      className={`p-3 flex items-center gap-3 ${
                        selectedVaccines[index]
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <Checkbox
                        checked={!!selectedVaccines[index]}
                        onChange={() => handleToggleVaccine(index)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {vaccine.vaccine_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Dose {vaccine.dose_number}
                          {vaccine.date_administered && (
                            <> • {new Date(vaccine.date_administered).toLocaleDateString()}</>
                          )}
                          {vaccine.batch_number && (
                            <> • Batch: {vaccine.batch_number}</>
                          )}
                        </div>
                      </div>
                      {selectedVaccines[index] && (
                        <Badge variant="success">Selected</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No vaccines submitted
                </p>
              )}

              <div className="text-sm text-gray-500 dark:text-gray-400">
                Selected: {Object.values(selectedVaccines).filter(Boolean).length} of{" "}
                {selectedCase.submitted_vaccines?.length || 0} vaccines
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
});

export default TransferInCases;
