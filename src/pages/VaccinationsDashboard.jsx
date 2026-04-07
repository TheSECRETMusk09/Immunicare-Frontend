import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import useVaccinationSocket from "../hooks/useVaccinationSocket";
import SearchableInfantSelect from "../components/SearchableInfantSelect";
import {
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationSchedulesResponse,
  normalizeInfantsResponse,
  normalizeVaccinesResponse,
  normalizeVaccinationRecordResponse,
  computeVaccinationComplianceSummary,
} from "../utils/adminDataAdapters";
import { isApprovedVaccineName } from "../constants/approvedVaccines";
import {
  resolveLotBatchValue,
} from "../utils/vaccinationFormOptions";

const pollingIntervalMs = 60000;
const normalizeRoleName = (value) => String(value || "").trim().toLowerCase();

const resolveAdministeredByRole = (user = {}) => {
  const normalizedRole = normalizeRoleName(user.role_name || user.role);
  return normalizedRole === "nurse" || normalizedRole === "midwife"
    ? normalizedRole
    : "";
};

const buildAdministeredByDisplayName = (user = {}) => {
  const composedName = [user.first_name, user.middle_name, user.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  if (composedName) {
    return composedName;
  }

  return String(
    user.full_name || user.name || user.username || user.email || `User ${user.id || ""}`,
  ).trim();
};

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
    const dueDate = new Date(entry.due_date);
    if (!Number.isNaN(dueDate.getTime()) && dueDate < new Date()) {
      return "overdue";
    }
  }

  return "upcoming";
};

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
  const navigate = useNavigate();
  const infantQueryScope = useMemo(
    () => (isAdmin ? { scope: "system" } : {}),
    [isAdmin],
  );
  const scopedClinicId = useMemo(
    () => Number(user?.clinic_id || user?.facility_id || 0) || null,
    [user?.clinic_id, user?.facility_id],
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
  const [recordMetrics, setRecordMetrics] = useState({
    total: 0,
    completed: 0,
  });
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [infants, setInfants] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [healthWorkerUsers, setHealthWorkerUsers] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordsHydrationLoading, setRecordsHydrationLoading] = useState(false);
  const [infantsLoading, setInfantsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [selectedInfantId, setSelectedInfantId] = useState(null);
  const [mutationInFlight, setMutationInFlight] = useState(false);

  const [vaccinationForm, setVaccinationForm] = useState(DEFAULT_FORM);
  const [trackingStartDate, setTrackingStartDate] = useState("");
  const [trackingEndDate, setTrackingEndDate] = useState("");

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scheduleCurrentPage, setScheduleCurrentPage] = useState(1);
  const [trackingCurrentPage, setTrackingCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const scheduleItemsPerPage = 20;
  const trackingItemsPerPage = 9;
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const activeRecordSearch = activeTab === "records" ? debouncedSearchQuery : "";
  const activeRecordPage = activeTab === "records" ? currentPage : 1;

  const findRecordWithRelations = useCallback(
    (record) => {
      const infant = infants.find((entry) => entry.id === record.infant_id) || null;
      const vaccine = vaccines.find((entry) => entry.id === record.vaccine_id) || null;
      return { record, infant, vaccine };
    },
    [infants, vaccines],
  );

  const fetchVaccinationRecordSummary = useCallback(async () => {
    const response = await apiClient.getVaccinationRecords({
      page: 1,
      limit: 1,
      ...infantQueryScope,
    });
    const metadata = response?.metadata || response?.pagination || {};

    return {
      total: Number(metadata.total || 0) || 0,
      completed: Number(metadata.completed || 0) || 0,
    };
  }, [infantQueryScope]);

  const fetchVaccinationReconciliationRecords = useCallback(
    async () => {
      const response = await apiClient.getVaccinationReconciliationRecords({
        ...infantQueryScope,
      });

      return normalizeVaccinationRecordsResponse(response);
    },
    [infantQueryScope],
  );

  const fetchVaccinationRecordPage = useCallback(
    async ({ page, search }) => {
      const response = await apiClient.getVaccinationRecords({
        page,
        limit: itemsPerPage,
        ...infantQueryScope,
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
    [infantQueryScope, itemsPerPage],
  );

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const shouldLoadScheduleData = activeTab !== "records";
        const shouldLoadRecordTable = activeTab === "records";
        const shouldLoadVaccines = silent || vaccines.length === 0;
        const shouldLoadSchedules =
          shouldLoadScheduleData && (silent || vaccinationSchedules.length === 0);
        const shouldLoadInfants =
          shouldLoadScheduleData && (silent || infants.length === 0);
        const shouldLoadReconciliationRecords =
          shouldLoadScheduleData && (silent || vaccinationRecords.length === 0);
        const shouldLoadHealthWorkers =
          shouldLoadRecordTable && (silent || healthWorkerUsers.length === 0);

        if (shouldLoadScheduleData && shouldLoadReconciliationRecords) {
          setRecordsHydrationLoading(true);
        } else if (shouldLoadRecordTable) {
          setRecordsHydrationLoading(false);
        }

        const [
          recordsData,
          schedulesData,
          infantsData,
          vaccinesData,
          systemUsersData,
          analyticsResponse,
          recordSummary,
          reconciliationRecordsData,
        ] =
          await Promise.all([
            shouldLoadRecordTable
              ? fetchVaccinationRecordPage({
                  page: activeRecordPage,
                  search: activeRecordSearch,
                })
              : Promise.resolve(null),
            shouldLoadSchedules
              ? apiClient.getVaccinationSchedules()
              : Promise.resolve(vaccinationSchedules),
            shouldLoadInfants
              ? apiClient.getInfants(infantQueryScope)
              : Promise.resolve(infants),
            shouldLoadVaccines ? apiClient.getVaccines() : Promise.resolve(vaccines),
            shouldLoadHealthWorkers
              ? apiClient
                  .getSystemUsers({
                    limit: 200,
                    roles: "nurse,midwife",
                    is_active: true,
                  })
                  .catch(() => ({ data: [] }))
              : Promise.resolve(healthWorkerUsers),
            silent || !analyticsData?.summary
              ? apiClient.getAnalyticsDashboard().catch(() => null)
              : Promise.resolve(analyticsData),
            fetchVaccinationRecordSummary().catch(() => ({
              total: 0,
              completed: 0,
            })),
            shouldLoadReconciliationRecords
              ? fetchVaccinationReconciliationRecords().catch(() => [])
              : Promise.resolve(vaccinationRecords),
          ]);

        const normalizedRecords =
          shouldLoadRecordTable
            ? recordsData?.rows || []
            : Array.isArray(reconciliationRecordsData)
              ? reconciliationRecordsData
              : Array.isArray(recordsData)
              ? recordsData
              : normalizeVaccinationRecordsResponse(recordsData);
        const normalizedSchedules =
          shouldLoadSchedules
            ? normalizeVaccinationSchedulesResponse(schedulesData)
            : vaccinationSchedules;
        const normalizedInfants = shouldLoadInfants
          ? normalizeInfantsResponse(infantsData)
          : infants;
        const normalizedVaccines = shouldLoadVaccines
          ? normalizeVaccinesResponse(vaccinesData)
          : vaccines;
        const normalizedAnalyticsPayload =
          analyticsResponse?.data || analyticsResponse || null;

        const allUsers = Array.isArray(systemUsersData)
          ? systemUsersData
          : (systemUsersData?.data || systemUsersData?.users || []);

        const normalizedHealthWorkers = shouldLoadHealthWorkers
          ? allUsers
              .map((rawUser) => {
                const id = Number(rawUser?.id);
                const role = resolveAdministeredByRole(rawUser);
                const isActive =
                  rawUser?.is_active !== false &&
                  normalizeRoleName(rawUser?.status) !== "inactive";
                const isGuardianAccount =
                  rawUser?.is_guardian_account === true ||
                  normalizeRoleName(rawUser?.role_name) === "guardian";
                const scopedUserClinicId =
                  Number(rawUser?.clinic_id || rawUser?.facility_id || 0) || null;

                if (!Number.isFinite(id) || id <= 0) return null;
                if (!role || !isActive || isGuardianAccount) return null;
                if (scopedClinicId && scopedUserClinicId !== Number(scopedClinicId)) {
                  return null;
                }

                const displayName = buildAdministeredByDisplayName(rawUser);
                const roleLabel = role === "midwife" ? "Midwife" : "Nurse";

                return {
                  ...rawUser,
                  id,
                  role,
                  roleLabel,
                  displayName,
                  optionLabel: `${displayName} (${roleLabel})`,
                  searchText: [
                    displayName,
                    rawUser?.username || "",
                    rawUser?.email || "",
                    rawUser?.contact || "",
                  ]
                    .join(" ")
                    .toLowerCase(),
                };
              })
              .filter(Boolean)
              .sort((left, right) => left.optionLabel.localeCompare(right.optionLabel))
          : healthWorkerUsers;

        if (shouldLoadRecordTable) {
          setRecordTableRows(normalizedRecords);
          setRecordTablePagination(
            recordsData?.metadata || {
              page: activeRecordPage,
              limit: itemsPerPage,
              total: normalizedRecords.length,
              totalPages:
                normalizedRecords.length > 0
                  ? Math.ceil(normalizedRecords.length / itemsPerPage)
                  : 0,
              completed: recordSummary.completed,
              hasNext: false,
              hasPrev: activeRecordPage > 1,
            },
          );
          setRecordsHydrationLoading(false);
        } else {
          if (shouldLoadSchedules) {
            setVaccinationSchedules(normalizedSchedules);
          }
          if (shouldLoadInfants) {
            setInfants(normalizedInfants);
          }
          if (shouldLoadReconciliationRecords) {
            setVaccinationRecords(normalizedRecords);
            setRecordsHydrationLoading(false);
          }
        }
        if (shouldLoadVaccines) {
          setVaccines(normalizedVaccines);
        }
        if (shouldLoadHealthWorkers) {
          setHealthWorkerUsers(normalizedHealthWorkers);
        }
        setRecordMetrics(recordSummary);
        setAnalyticsData(
          normalizedAnalyticsPayload?.summary ? normalizedAnalyticsPayload : null,
        );

        if (selectedInfantId && normalizedInfants.length > 0) {
          const exists = normalizedInfants.some((entry) => entry.id === selectedInfantId);
          if (!exists) {
            setSelectedInfantId(null);
          }
        }

      } catch (err) {
        setError(err.message || "Failed to fetch vaccination dashboard data.");
        if (activeTab === "records") {
          setRecordTableRows([]);
          setRecordTablePagination({
            page: activeRecordPage,
            limit: itemsPerPage,
            total: 0,
            totalPages: 0,
            completed: 0,
            hasNext: false,
            hasPrev: activeRecordPage > 1,
          });
        } else {
          setVaccinationRecords([]);
          setVaccinationSchedules([]);
          setInfants([]);
        }
        setVaccines([]);
        setHealthWorkerUsers([]);
        setAnalyticsData(null);
        setRecordMetrics({ total: 0, completed: 0 });
        setRecordsHydrationLoading(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeRecordPage,
      activeRecordSearch,
      activeTab,
      analyticsData,
      fetchVaccinationReconciliationRecords,
      infantQueryScope,
      fetchVaccinationRecordPage,
      fetchVaccinationRecordSummary,
      healthWorkerUsers,
      infants,
      itemsPerPage,
      scopedClinicId,
      selectedInfantId,
      vaccinationRecords,
      vaccinationSchedules,
      vaccines,
    ],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void fetchData({ silent: true });
    }, pollingIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [fetchData]);

  useVaccinationSocket({
    setVaccinations: setVaccinationRecords,
    onChange: () => {
      void fetchData({ silent: true });
    },
  });

  const handleAddVaccination = () => {
    navigate("/infants", {
      state: {
        openRecordVaccination: true,
        source: "vaccination-management",
        prefill: {
          date_administered: formatDateInputValue(new Date()),
          status: "completed",
        },
      },
    });
  };

  const routeToCanonicalRecordVaccinations = useCallback(
    ({ infantId, vaccineId, doseNumber, dueDate } = {}) => {
      navigate("/infants", {
        state: {
          openRecordVaccination: true,
          source: "vaccination-management",
          prefill: {
            ...(infantId ? { infant_id: Number(infantId) } : {}),
            ...(vaccineId ? { vaccine_id: Number(vaccineId) } : {}),
            ...(doseNumber ? { dose_number: Number(doseNumber) } : {}),
            date_administered: formatDateInputValue(new Date()),
            next_due_date: formatDateInputValue(dueDate),
            status: "completed",
          },
        },
      });
    },
    [navigate],
  );

  const handleEditRecord = (record) => {
    const administeredByWorker = record.administered_by
      ? healthWorkerById.get(Number(record.administered_by)) || null
      : null;

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
      administered_by_role: administeredByWorker?.role || "",
      administered_by_search:
        administeredByWorker?.displayName || String(record.administered_by_name || ""),
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

      await fetchData({ silent: true });
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
      await fetchData({ silent: true });
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
    if (!selectedInfantId) return [];
    return vaccinationRecordsByInfantId.get(selectedInfantId) || [];
  }, [selectedInfantId, vaccinationRecordsByInfantId]);

  const approvedVaccinationSchedules = useMemo(
    () => vaccinationSchedules.filter((schedule) => isApprovedVaccineName(schedule.vaccine_name)),
    [vaccinationSchedules],
  );

  const fallbackDashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completed = Number(recordMetrics.completed || 0);

    const dueSoon = vaccinationRecords.filter((record) => {
      if (record.admin_date || record.status === "completed" || record.status === "attended") return false;
      if (!record.next_due_date) return false;
      const dueDate = new Date(record.next_due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).length;

    const overdue = vaccinationRecords.filter((record) => {
      if (record.status === "overdue") return true;
      if (record.admin_date || record.status === "completed" || record.status === "attended") return false;
      if (!record.next_due_date) return false;

      const dueDate = new Date(record.next_due_date);
      dueDate.setHours(0, 0, 0, 0);
      return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < today.getTime();
    }).length;

    return {
      completed,
      dueSoon,
      overdue,
      trackedInfants: infants.length,
    };
  }, [infants.length, recordMetrics.completed, vaccinationRecords]);

  const infantComplianceSnapshots = useMemo(() => {
    if (activeTab === "records") {
      return [];
    }

    return infants.map((infant) => {
        const infantRecords = vaccinationRecordsByInfantId.get(infant.id) || [];

        const summary = computeVaccinationComplianceSummary({
          schedules: approvedVaccinationSchedules,
          records: infantRecords,
          infantDob: infant.dob,
        });

        return {
          infant,
          ...summary,
        };
      });
  }, [
    activeTab,
    infants,
    vaccinationRecordsByInfantId,
    approvedVaccinationSchedules,
  ]);

  const complianceRows = useMemo(() => {
    if (activeTab !== "tracking") {
      return [];
    }

    return infantComplianceSnapshots.filter(({ infant }) => {
      if (trackingStartDate || trackingEndDate) {
        if (!infant.dob) return false;
        const infantDate = new Date(infant.dob).toISOString().split('T')[0];
        if (trackingStartDate && infantDate < trackingStartDate) return false;
        if (trackingEndDate && infantDate > trackingEndDate) return false;
      }

      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const firstName = (infant.first_name || "").toLowerCase();
        const lastName = (infant.last_name || "").toLowerCase();
        if (!firstName.includes(query) && !lastName.includes(query)) return false;
      }

      return true;
    });
  }, [
    activeTab,
    debouncedSearchQuery,
    infantComplianceSnapshots,
    trackingStartDate,
    trackingEndDate,
  ]);

  useEffect(() => {
    setScheduleCurrentPage(1);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    setTrackingCurrentPage(1);
  }, [debouncedSearchQuery, trackingStartDate, trackingEndDate]);

  const allScheduleOverviewRows = useMemo(() => {
    if (activeTab !== "schedule") {
      return [];
    }

    const statusPriority = {
      overdue: 0,
      due: 1,
      upcoming: 2,
      completed: 3,
    };

    const rows = infantComplianceSnapshots.flatMap(({ infant, timeline }) => {
      return timeline.map((entry) => {
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
  }, [
    activeTab,
    infantComplianceSnapshots,
  ]);

  const scheduleOverviewRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(debouncedSearchQuery);

    if (!normalizedQuery) {
      return allScheduleOverviewRows;
    }

    return allScheduleOverviewRows.filter((row) => {
      const searchableText = [
        row.infant_name,
        row.vaccine_name,
        row.disease_prevented,
        row.status_label,
        row.age_label,
        row.dose_number,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [allScheduleOverviewRows, debouncedSearchQuery]);

  const dashboardStats = useMemo(() => {
    // Use analytics API data if available for accurate metrics
    if (analyticsData?.summary) {
      return {
        completed: Number(recordMetrics.completed || 0),
        dueSoon: analyticsData.summary.dueSoon7Days || 0,
        overdue: analyticsData.summary.overdueVaccinations || 0,
        trackedInfants: analyticsData.summary.totalRegisteredInfants || infants.length,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!infantComplianceSnapshots.length) {
      return fallbackDashboardStats;
    }

    let completed = 0;
    let dueSoon = 0;
    const overdueInfants = new Set();

    infantComplianceSnapshots.forEach(({ infant, timeline }) => {
      timeline.forEach((entry) => {
        const statusKey = classifyScheduleDoseStatus(entry);

        if (statusKey === "completed") {
          completed += 1;
          return;
        }

        if (statusKey === "overdue") {
          overdueInfants.add(infant.id);
        }

        if (!entry.due_date) {
          return;
        }

        const dueDate = normalizeDateToStartOfDay(entry.due_date);
        if (!dueDate) {
          return;
        }

        const diffDays = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (diffDays >= 0 && diffDays <= 7) {
          dueSoon += 1;
        }
      });
    });

    return {
      completed,
      dueSoon,
      overdue: overdueInfants.size,
      trackedInfants: infants.length,
    };
  }, [
    analyticsData,
    fallbackDashboardStats,
    infantComplianceSnapshots,
    infants.length,
    recordMetrics.completed,
  ]);

  const scheduleStatusSummary = useMemo(
    () =>
      scheduleOverviewRows.reduce(
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
      ),
    [scheduleOverviewRows],
  );

  const healthWorkerById = useMemo(
    () =>
      new Map(
        healthWorkerUsers.map((entry) => [Number(entry.id), entry]),
      ),
    [healthWorkerUsers],
  );

  const paginatedScheduleRows = useMemo(() => {
    const startIndex = (scheduleCurrentPage - 1) * scheduleItemsPerPage;
    return scheduleOverviewRows.slice(startIndex, startIndex + scheduleItemsPerPage);
  }, [scheduleOverviewRows, scheduleCurrentPage]);
  const scheduleTotalPages = Math.ceil(scheduleOverviewRows.length / scheduleItemsPerPage);

  const paginatedComplianceRows = useMemo(() => {
    const startIndex = (trackingCurrentPage - 1) * trackingItemsPerPage;
    return complianceRows.slice(startIndex, startIndex + trackingItemsPerPage);
  }, [complianceRows, trackingCurrentPage]);
  const trackingTotalPages = Math.ceil(complianceRows.length / trackingItemsPerPage);

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
      : approvedVaccinationSchedules.length > 0 ||
        infants.length > 0 ||
        vaccines.length > 0 ||
        Boolean(analyticsData?.summary);

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
            <Button size="sm" onClick={() => void fetchData({ silent: true })}>
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

          <div className="flex flex-wrap items-center gap-3 mt-3 xl:mt-0">
            <div className="w-full sm:w-64 relative flex-shrink-0">
              <Input
                placeholder="Search vaccinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
                containerClassName="mb-0"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
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
                onClick={() => void fetchData({ silent: true })}
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
          ) : scheduleOverviewRows.length === 0 ? (
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
                  {Math.min(scheduleCurrentPage * scheduleItemsPerPage, scheduleOverviewRows.length)}{" "}
                  of {scheduleOverviewRows.length} schedule rows
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
                    const { infant, vaccine } = findRecordWithRelations(record);
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
                          {vaccine?.name || record.vaccine_name || "Unknown Vaccine"}
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
                    infants={infants}
                    value={selectedInfantId || ""}
                    onChange={(e) => setSelectedInfantId(e.target.value ? Number(e.target.value) : null)}
                    label="Focus by infant"
                    placeholder="Search by name, control number, or date of birth..."
                    emptyMessage="No infants available"
                    loading={infantsLoading}
                    required={false}
                  />
                </div>
                <div className="w-full sm:w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={trackingStartDate}
                    onChange={(e) => setTrackingStartDate(e.target.value)}
                  />
                </div>
                <div className="hidden sm:block pb-2 text-gray-500">-</div>
                <div className="w-full sm:w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={trackingEndDate}
                    onChange={(e) => setTrackingEndDate(e.target.value)}
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
                    {Math.min(trackingCurrentPage * trackingItemsPerPage, complianceRows.length)}{" "}
                    of {complianceRows.length} infants
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
