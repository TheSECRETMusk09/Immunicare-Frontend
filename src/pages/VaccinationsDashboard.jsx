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

const pollingIntervalMs = 60000;
const STABLE_REFERENCE_TTL_MS = 5 * 60 * 1000;

const normalizeSearchValue = (value) => String(value || "").trim().toLowerCase();

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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
};

const formatAgeLabel = (ageInMonths) => {
  const normalizedAge = Number(ageInMonths || 0);
  if (!normalizedAge) return "At Birth";
  return `${normalizedAge} month${normalizedAge > 1 ? "s" : ""}`;
};

const normalizeDateToStartOfDay = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
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

  const [period, setPeriod] = useState("month");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const activeTabRef = useRef("schedule");
  const currentPageRef = useRef(1);
  const searchQueryRef = useRef("");
  const hasInitializedPeriodEffectRef = useRef(false);
  const hasInitializedActiveTabEffectRef = useRef(false);
  const hasInitializedSearchEffectRef = useRef(false);
  const hasInitializedRecordPageEffectRef = useRef(false);

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

  const [activeTab, setActiveTab] = useState("schedule");
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
  const itemsPerPage = 20;
  const scheduleItemsPerPage = 20;
  const trackingItemsPerPage = 9;
  const stableDataLoadedAtRef = useRef({
    infants: 0,
    schedules: 0,
    reconciliation: 0,
  });
  const fetchStateRef = useRef({
    abortController: null,
    requestId: 0,
  });
  const socketRefreshTimeoutRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

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
    if (activeTab !== "tracking") {
      return [];
    }

    return infants.filter((infant) =>
      isDateWithinVaccinationPeriod(
        infant.dob || infant.date_of_birth || infant.birth_date,
        periodRange,
      ),
    );
  }, [activeTab, infants, periodRange]);

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
      const response = requestConfig
        ? await apiClient.getVaccinationRecords(
            {
              page,
              limit: itemsPerPage,
              ...infantQueryScope,
              ...activeRecordPeriodParams,
              ...(search ? { search } : {}),
            },
            requestConfig,
          )
        : await apiClient.getVaccinationRecords({
            page,
            limit: itemsPerPage,
            ...infantQueryScope,
            ...activeRecordPeriodParams,
            ...(search ? { search } : {}),
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
    [activeRecordPeriodParams, buildRequestConfig, infantQueryScope, itemsPerPage],
  );

  const fetchVaccinationInfantsData = useCallback(async ({ signal } = {}) => {
    const requestConfig = buildRequestConfig(signal || fetchStateRef.current.abortController?.signal);

    if (typeof apiClient.getDashboardInfants === "function") {
      const pageSize = 10000;
      const aggregatedInfants = [];
      let page = 1;
      let hasNext = true;
      let pagination = null;

      while (hasNext) {
        const infantQuery = buildVaccinationInfantQuery({
          page,
          limit: pageSize,
        });
        const response = requestConfig
          ? await apiClient.getDashboardInfants(infantQuery, requestConfig)
          : await apiClient.getDashboardInfants(infantQuery);
        aggregatedInfants.push(...normalizeInfantsResponse(response));
        pagination =
          response?.pagination ||
          response?.metadata ||
          response?.data?.pagination ||
          pagination ||
          {};
        hasNext = Boolean(pagination?.hasNext);
        page += 1;

        if (page > 200) {
          console.warn(
            "[VaccinationsDashboard] Stopping infant aggregation after 200 pages to avoid an infinite loop.",
          );
          break;
        }
      }

      return {
        rows: aggregatedInfants,
        metadata: pagination || {},
      };
    }

    const response = requestConfig
      ? await apiClient.getInfants(
          buildVaccinationInfantQuery({
            page: 1,
            limit: 10000,
          }),
          requestConfig,
        )
      : await apiClient.getInfants(
          buildVaccinationInfantQuery({
            page: 1,
            limit: 10000,
          }),
        );
    const metadata = response?.metadata || response?.pagination || {};

    return {
      rows: normalizeInfantsResponse(response),
      metadata,
    };
  }, [buildRequestConfig, buildVaccinationInfantQuery]);

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


  const fetchData = useCallback(
    async ({ silent = false, force = false } = {}) => {
      const now = Date.now();
      const shouldLoadInfants =
        force ||
        stableDataLoadedAtRef.current.infants === 0 ||
        now - stableDataLoadedAtRef.current.infants > STABLE_REFERENCE_TTL_MS;
      const shouldLoadSchedules =
        force ||
        stableDataLoadedAtRef.current.schedules === 0 ||
        now - stableDataLoadedAtRef.current.schedules > STABLE_REFERENCE_TTL_MS;
      const shouldLoadReconciliationRecords =
        force ||
        stableDataLoadedAtRef.current.reconciliation === 0 ||
        now - stableDataLoadedAtRef.current.reconciliation > STABLE_REFERENCE_TTL_MS;
      const currentActiveTab = activeTabRef.current;
      const currentRecordsPage = currentActiveTab === "records" ? currentPageRef.current : 1;
      const currentRecordSearch =
        currentActiveTab === "records" ? searchQueryRef.current : "";
      const shouldLoadRecordTable = currentActiveTab === "records";
      const shouldLoadSharedData =
        shouldLoadInfants || shouldLoadSchedules || shouldLoadReconciliationRecords;
      const shouldLoadData = shouldLoadRecordTable || shouldLoadSharedData;

      if (!shouldLoadData) {
        return;
      }

      const requestId = fetchStateRef.current.requestId + 1;

      if (fetchStateRef.current.abortController) {
        fetchStateRef.current.abortController.abort();
      }

      const abortController = new AbortController();
      fetchStateRef.current.abortController = abortController;
      fetchStateRef.current.requestId = requestId;

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        if (shouldLoadSharedData) {
          setRecordsHydrationLoading(true);
        }

        if (shouldLoadInfants) {
          setInfantsLoading(true);
        }

        const requestConfig = buildRequestConfig(abortController.signal);

        const [recordPageData, schedulesData, infantsData, reconciliationData] =
          await Promise.all([
            shouldLoadRecordTable
              ? fetchVaccinationRecordPage({
                  page: currentRecordsPage,
                  search: currentRecordSearch,
                  signal: abortController.signal,
                })
              : Promise.resolve(null),
            shouldLoadSchedules
              ? requestConfig
                ? apiClient.getVaccinationSchedules({}, requestConfig)
                : apiClient.getVaccinationSchedules({})
              : Promise.resolve(null),
            shouldLoadInfants
              ? fetchVaccinationInfantsData({ signal: abortController.signal })
              : Promise.resolve(null),
            shouldLoadReconciliationRecords
              ? fetchVaccinationReconciliationRecords({ signal: abortController.signal })
              : Promise.resolve(null),
          ]);

        if (abortController.signal.aborted || fetchStateRef.current.requestId !== requestId) {
          return;
        }

        if (shouldLoadRecordTable && recordPageData) {
          const completedCount = recordPageData?.metadata?.completed ?? 0;
          setRecordTableRows(recordPageData.rows || []);
          setRecordTablePagination(
            recordPageData.metadata || {
              page: currentRecordsPage,
              limit: itemsPerPage,
              total: 0,
              totalPages: 0,
              completed: completedCount,
              hasNext: false,
              hasPrev: currentRecordsPage > 1,
            },
          );
        }

        if (shouldLoadSchedules) {
          const normalizedSchedules = normalizeVaccinationSchedulesResponse(schedulesData);
          setVaccinationSchedules(normalizedSchedules);
          stableDataLoadedAtRef.current.schedules = Date.now();
        }

        if (shouldLoadInfants) {
          const normalizedInfants = infantsData?.rows || [];
          setInfants(normalizedInfants);
          stableDataLoadedAtRef.current.infants = Date.now();
        }

        if (shouldLoadReconciliationRecords) {
          const normalizedReconciliationRecords = Array.isArray(reconciliationData)
            ? reconciliationData
            : normalizeVaccinationRecordsResponse(reconciliationData);
          setVaccinationRecords(normalizedReconciliationRecords);
          stableDataLoadedAtRef.current.reconciliation = Date.now();
        }
      } catch (err) {
        if (abortController.signal.aborted || fetchStateRef.current.requestId !== requestId || isAbortError(err)) {
          return;
        }

        setError(err.message || "Failed to fetch vaccination dashboard data.");
      } finally {
        if (fetchStateRef.current.requestId !== requestId) {
          return;
        }

        setInfantsLoading(false);
        setLoading(false);
        setRefreshing(false);
        setRecordsHydrationLoading(false);
        fetchStateRef.current.abortController = null;
      }
    },
      [
      buildRequestConfig,
      fetchVaccinationInfantsData,
      fetchVaccinationRecordPage,
      fetchVaccinationReconciliationRecords,
      itemsPerPage,
    ],
  );

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    void fetchDataRef.current?.();
  }, []);

  useEffect(() => {
    void refreshVaccineInventory();
  }, [refreshVaccineInventory]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshVaccineInventory();
    }, pollingIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [refreshVaccineInventory]);

  useEffect(() => {
    if (!hasInitializedActiveTabEffectRef.current) {
      hasInitializedActiveTabEffectRef.current = true;
      return;
    }

    void fetchDataRef.current?.({ silent: true });
  }, [activeTab]);

  useEffect(() => {
    if (!hasInitializedSearchEffectRef.current) {
      hasInitializedSearchEffectRef.current = true;
      return;
    }

    setCurrentPage(1);
    setScheduleCurrentPage(1);
    setTrackingCurrentPage(1);

    if (activeTab === "records") {
      void fetchDataRef.current?.({ silent: true });
    }
  }, [activeTab, debouncedSearchQuery]);

  useEffect(() => {
    if (!hasInitializedPeriodEffectRef.current) {
      hasInitializedPeriodEffectRef.current = true;
      return;
    }

    setCurrentPage(1);
    setScheduleCurrentPage(1);
    setTrackingCurrentPage(1);
    if (activeTab === "records") {
      void fetchDataRef.current?.({ silent: true });
    }
  }, [period, periodEndDate, periodStartDate]);

  useEffect(() => {
    if (!hasInitializedRecordPageEffectRef.current) {
      hasInitializedRecordPageEffectRef.current = true;
      return;
    }

    if (activeTab === "records") {
      void fetchDataRef.current?.({ silent: true });
    }
  }, [activeTab, currentPage]);

  useVaccinationSocket({
    setVaccinations: setVaccinationRecords,
    onChange: () => {
      if (socketRefreshTimeoutRef.current) {
        return;
      }

      socketRefreshTimeoutRef.current = window.setTimeout(() => {
        socketRefreshTimeoutRef.current = null;
        void fetchDataRef.current?.({ silent: true, force: true });
      }, 300);
    },
  });

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setAddModalPrefill(null);
  }, []);

  const handleAddModalSuccess = useCallback(() => {
    setMutationInFlight(true);
    activeTabRef.current = "records";
    currentPageRef.current = 1;
    setActiveTab("records");
    setCurrentPage(1);
    void fetchDataRef.current?.({ silent: true, force: true }).finally(() => {
      setMutationInFlight(false);
    });
  }, []);

  const handleAddVaccination = useCallback(() => {
    setAddModalPrefill({
      date_administered: formatDateInputValue(new Date()),
      status: "completed",
    });
    setShowAddModal(true);
  }, []);

  const routeToCanonicalRecordVaccinations = useCallback(
    ({ infantId, vaccineId, doseNumber, dueDate } = {}) => {
      setAddModalPrefill({
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

  const shouldComputeScheduleViews = activeTab !== "tracking";
  const shouldComputeTrackingViews = activeTab === "tracking";

  const allScheduleOverviewRows = useMemo(() => {
    if (!shouldComputeScheduleViews) {
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
        const infantName = [infant.first_name, infant.last_name]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ");

        return {
          row_id: `${infant.id}-${entry.vaccine_id || entry.vaccine_name}-${entry.dose_number}`,
          infant_id: infant.id,
          infant_name: infantName || infant.full_name || `Infant ${infant.id}`,
          infant_dob: infant.dob || null,
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
  }, [approvedVaccinationSchedules, infants, shouldComputeScheduleViews, vaccinationRecordsByInfantId]);

  const filteredScheduleOverviewRows = useMemo(() => {
    if (!shouldComputeScheduleViews || !allScheduleOverviewRows.length) {
      return [];
    }

    return allScheduleOverviewRows.filter((row) => {
      if (!isDateWithinVaccinationPeriod(row.due_date, periodRange)) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      const searchableText = [
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

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [allScheduleOverviewRows, normalizedSearchQuery, periodRange, shouldComputeScheduleViews]);

  const trackingComplianceSnapshots = useMemo(() => {
    if (!shouldComputeTrackingViews) {
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
  }, [approvedVaccinationSchedules, shouldComputeTrackingViews, trackingVisibleInfants, vaccinationRecordsByInfantId]);

  const filteredTrackingRows = useMemo(() => {
    if (!shouldComputeTrackingViews || !trackingComplianceSnapshots.length) {
      return [];
    }

    if (!normalizedSearchQuery) {
      return trackingComplianceSnapshots;
    }

    return trackingComplianceSnapshots.filter(({ infant }) => {
      const searchableText = [
        infant.first_name,
        infant.middle_name,
        infant.last_name,
        infant.full_name,
        infant.control_number,
        infant.dob,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, shouldComputeTrackingViews, trackingComplianceSnapshots]);

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
    [activeTab, filteredScheduleOverviewRows, shouldComputeScheduleViews],
  );

  const dashboardStats = useMemo(() => {
    const today = normalizeDateToStartOfDay(new Date());
    const dueSoonWindow = new Date(today || new Date());
    dueSoonWindow.setDate(dueSoonWindow.getDate() + 7);
    dueSoonWindow.setHours(0, 0, 0, 0);

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
  }, [activeTab, filteredScheduleOverviewRows, filteredTrackingRows]);

  const paginatedScheduleRows = useMemo(() => {
    if (activeTab !== "schedule") {
      return [];
    }

    const startIndex = (scheduleCurrentPage - 1) * scheduleItemsPerPage;
    return filteredScheduleOverviewRows.slice(startIndex, startIndex + scheduleItemsPerPage);
  }, [activeTab, filteredScheduleOverviewRows, scheduleCurrentPage]);
  const scheduleTotalPages = activeTab === "schedule"
    ? Math.ceil(filteredScheduleOverviewRows.length / scheduleItemsPerPage)
    : 0;

  const paginatedComplianceRows = useMemo(() => {
    if (!shouldComputeTrackingViews) {
      return [];
    }

    const startIndex = (trackingCurrentPage - 1) * trackingItemsPerPage;
    return filteredTrackingRows.slice(startIndex, startIndex + trackingItemsPerPage);
  }, [filteredTrackingRows, shouldComputeTrackingViews, trackingCurrentPage]);
  const trackingTotalPages = shouldComputeTrackingViews
    ? Math.ceil(filteredTrackingRows.length / trackingItemsPerPage)
    : 0;

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

  const hasPrimaryTabData =
    activeTab === "records"
      ? recordTableRows.length > 0
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
                onClick={() => setActiveTab(tab.key)}
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
            </div>
            <VaccinationPeriodFilter
              period={period}
              startDate={periodStartDate}
              endDate={periodEndDate}
              onPeriodChange={(nextPeriod) => setPeriod(normalizeVaccinationPeriod(nextPeriod))}
              onStartDateChange={setPeriodStartDate}
              onEndDateChange={setPeriodEndDate}
            />
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
          <div className="text-xl sm:text-2xl font-bold text-success-600">{dashboardStats.completed}</div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Completed Vaccinations
          </p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-warning-600">{dashboardStats.dueSoon}</div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Due Soon (7 Days)
          </p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-danger-600">{dashboardStats.overdue}</div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Overdue Vaccinations
          </p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-info-600">{dashboardStats.trackedInfants}</div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Children Tracked</p>
        </Card>
      </div>

      {activeTab === "schedule" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Schedule Overview
          </h3>

          {recordsHydrationLoading && vaccinationRecords.length === 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading vaccination history for schedule reconciliation...
              </div>
              <SkeletonTable rows={8} columns={9} />
            </div>
          ) : approvedVaccinationSchedules.length === 0 ? (
            <EmptyState
              title="No vaccination schedules"
              description="No active schedule definitions were returned by the backend."
              icon="📅"
              className="border-none shadow-none py-12"
            />
          ) : infants.length === 0 ? (
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

            {scheduleTotalPages > 1 && (
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                <div className="text-sm text-gray-500">
                  Showing {(scheduleCurrentPage - 1) * scheduleItemsPerPage + 1} to{" "}
                  {Math.min(
                    scheduleCurrentPage * scheduleItemsPerPage,
                    filteredScheduleOverviewRows.length,
                  )}{" "}
                  of {filteredScheduleOverviewRows.length} schedule rows
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setScheduleCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={scheduleCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page {scheduleCurrentPage} of {scheduleTotalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setScheduleCurrentPage((p) => Math.min(scheduleTotalPages, p + 1))}
                    disabled={scheduleCurrentPage === scheduleTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {activeTab === "records" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Records
          </h3>

          {filteredRecords.length === 0 ? (
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

            {totalPages > 1 && (
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
                <div className="text-sm text-gray-500">
                  Showing {visibleRecordStart} to {visibleRecordEnd} of {totalRecordRows} records
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={!recordTablePagination?.hasPrev || currentPage === 1}
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
                    disabled={!recordTablePagination?.hasNext || currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {activeTab === "tracking" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Compliance Tracking
          </h3>

          {recordsHydrationLoading && vaccinationRecords.length === 0 ? (
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
                    onChange={(e) => setSelectedInfantId(e.target.value ? Number(e.target.value) : null)}
                    label="Focus by infant"
                    placeholder="Search by name, control number, or date of birth..."
                    emptyMessage="No infants available"
                    loading={infantsLoading || recordsHydrationLoading}
                    selectedInfant={selectedTrackingInfant}
                    required={false}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto auto-hide-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                {(selectedInfantId
                  ? paginatedComplianceRows.filter((entry) => entry.infant.id === selectedInfantId)
                  : paginatedComplianceRows
                ).map((entry) => {
                  const { infant, dueCount, completed, pending, overdue, completionRate } =
                    entry;

                  return (
                    <Card key={infant.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {infant.first_name} {infant.last_name}
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
                          setSelectedInfantId(infant.id);
                          setActiveTab("records");
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

              {!selectedInfantId && trackingTotalPages > 1 && (
                <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                  <div className="text-sm text-gray-500">
                    Showing {(trackingCurrentPage - 1) * trackingItemsPerPage + 1} to{" "}
                    {Math.min(
                      trackingCurrentPage * trackingItemsPerPage,
                      filteredTrackingRows.length,
                    )}{" "}
                    of {filteredTrackingRows.length} infants
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setTrackingCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={trackingCurrentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {trackingCurrentPage} of {trackingTotalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setTrackingCurrentPage((p) => Math.min(trackingTotalPages, p + 1))}
                      disabled={trackingCurrentPage === trackingTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {selectedInfantId && selectedInfantRecords.length === 0 && (
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
