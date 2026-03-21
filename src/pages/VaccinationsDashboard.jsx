import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
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
import {
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationSchedulesResponse,
  normalizeInfantsResponse,
  normalizeVaccinesResponse,
  normalizeVaccineInventoryResponse,
  normalizeVaccinationRecordResponse,
  buildNextDueVaccinationOptions,
  buildFefoBatchOptions,
  computeVaccinationComplianceSummary,
} from "../utils/adminDataAdapters";
import { isApprovedVaccineName } from "../constants/approvedVaccines";
import {
  buildHealthWorkerOptions,
  buildVaccinationBatchOptionLabel,
  resolveLotBatchValue,
} from "../utils/vaccinationFormOptions";

const pollingIntervalMs = 60000;

const DEFAULT_FORM = {
  id: null,
  infant_id: "",
  vaccine_id: "",
  dose_no: 1,
  admin_date: "",
  next_due_date: "",
  administered_by: "",
  batch_id: "",
  inventory_record_id: "",
  lot_batch_number: "",
  status: "completed",
  notes: "",
};

const VaccinationsDashboard = () => {
  const { isAdmin, user } = useAuth();
  const scopedClinicId = useMemo(
    () => Number(user?.clinic_id || user?.facility_id || 0) || null,
    [user?.clinic_id, user?.facility_id],
  );

  const [activeTab, setActiveTab] = useState("schedule");
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [infants, setInfants] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [healthWorkerUsers, setHealthWorkerUsers] = useState([]);
  const [vaccinationBatchOptions, setVaccinationBatchOptions] = useState([]);
  const [vaccinationBatchOptionsLoading, setVaccinationBatchOptionsLoading] = useState(false);
  const [vaccinationBatchOptionsError, setVaccinationBatchOptionsError] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [selectedInfantId, setSelectedInfantId] = useState(null);
  const [mutationInFlight, setMutationInFlight] = useState(false);

  const [vaccinationForm, setVaccinationForm] = useState(DEFAULT_FORM);
  const [trackingStartDate, setTrackingStartDate] = useState("");
  const [trackingEndDate, setTrackingEndDate] = useState("");
  const [trackingSearchQuery, setTrackingSearchQuery] = useState("");

  const findRecordWithRelations = useCallback(
    (record) => {
      const infant = infants.find((entry) => entry.id === record.infant_id) || null;
      const vaccine = vaccines.find((entry) => entry.id === record.vaccine_id) || null;
      return { record, infant, vaccine };
    },
    [infants, vaccines],
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

        const [recordsData, schedulesData, infantsData, vaccinesData, inventoryData, systemUsersData] =
          await Promise.all([
            apiClient.getVaccinationRecords(),
            apiClient.getVaccinationSchedules(),
            apiClient.getInfants(),
            apiClient.getVaccines(),
            apiClient.getVaccineInventory(
              scopedClinicId ? { clinic_id: scopedClinicId } : {},
            ),
            apiClient.getSystemUsers({ limit: 100, roles: "nurse,midwife" }).catch(() => ({ data: [] })),
          ]);

        const normalizedRecords = normalizeVaccinationRecordsResponse(recordsData);
        const normalizedSchedules =
          normalizeVaccinationSchedulesResponse(schedulesData);
        const normalizedInfants = normalizeInfantsResponse(infantsData);
        const normalizedVaccines = normalizeVaccinesResponse(vaccinesData);
        const normalizedInventory = normalizeVaccineInventoryResponse(inventoryData);
        const normalizedHealthWorkers = buildHealthWorkerOptions(
          systemUsersData,
          scopedClinicId,
        );

        setVaccinationRecords(normalizedRecords);
        setVaccinationSchedules(normalizedSchedules);
        setInfants(normalizedInfants);
        setVaccines(normalizedVaccines);
        setInventoryRecords(normalizedInventory);
        setHealthWorkerUsers(normalizedHealthWorkers);

        if (selectedInfantId) {
          const exists = normalizedInfants.some((entry) => entry.id === selectedInfantId);
          if (!exists) {
            setSelectedInfantId(null);
          }
        }
      } catch (err) {
        setError(err.message || "Failed to fetch vaccination dashboard data.");
        setVaccinationRecords([]);
        setVaccinationSchedules([]);
        setInfants([]);
        setVaccines([]);
        setInventoryRecords([]);
        setHealthWorkerUsers([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedInfantId, scopedClinicId],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
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
    setVaccinationForm({
      ...DEFAULT_FORM,
      admin_date: new Date().toISOString().split("T")[0],
      administered_by: defaultAdministeredBy,
      status: "completed",
    });
    setShowAddModal(true);
  };

  const handleEditRecord = (record) => {
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

    try {
      setSaving(true);
      setError(null);

      const isCreateFlow = !vaccinationForm.id;
      const administeredByValue = Number(vaccinationForm.administered_by);
      const administeredById =
        Number.isFinite(administeredByValue) && administeredByValue > 0
          ? administeredByValue
          : null;
      const batchIdValue = Number(vaccinationForm.batch_id);
      const selectedBatchId =
        Number.isFinite(batchIdValue) && batchIdValue > 0 ? batchIdValue : null;
      const lotBatchValue = resolveLotBatchValue(
        vaccinationForm.lot_batch_number,
        selectedBatchOption?.lot_batch_number,
        selectedInventoryRecord?.lot_batch_number,
      );

      if (isCreateFlow && !administeredById) {
        throw new Error("Please select a Nurse or Midwife in the Administered By dropdown.");
      }

      if (isCreateFlow && !selectedBatchId) {
        throw new Error("Please select a valid FEFO batch source.");
      }

      if (isCreateFlow && !vaccinationForm.inventory_record_id) {
        throw new Error(
          "The selected FEFO batch is not linked to an inventory sheet record. Update Inventory Management first.",
        );
      }

      if (isCreateFlow && !lotBatchValue) {
        throw new Error("The selected inventory source does not have a Lot / Batch number.");
      }

      const payload = {
        patient_id: Number(vaccinationForm.infant_id),
        vaccine_id: Number(vaccinationForm.vaccine_id),
        dose_no: Number(vaccinationForm.dose_no || 1),
        admin_date: vaccinationForm.admin_date || null,
        next_due_date: vaccinationForm.next_due_date || null,
        notes: vaccinationForm.notes || null,
        status: vaccinationForm.status || "pending",
        ...(administeredById ? { administered_by: administeredById } : {}),
        ...(isCreateFlow && lotBatchValue
          ? {
              batch_id: selectedBatchId,
              vaccine_inventory_id: Number(vaccinationForm.inventory_record_id) || null,
              lot_batch_number: lotBatchValue,
              lot_number: lotBatchValue,
              batch_number: lotBatchValue,
            }
          : {}),
      };

      if (vaccinationForm.id) {
        setMutationInFlight(true);
        const updated = await apiClient.updateVaccinationRecord(vaccinationForm.id, payload);
        const normalizedUpdated = normalizeVaccinationRecordResponse(updated);
        setVaccinationRecords((prev) =>
          prev.map((row) => (row.id === normalizedUpdated.id ? normalizedUpdated : row)),
        );
      } else {
        setMutationInFlight(true);
        let normalizedCreated;

        if (typeof apiClient.recordVaccinationWithInventory === "function") {
          const response = await apiClient.recordVaccinationWithInventory(payload);
          normalizedCreated = normalizeVaccinationRecordResponse(
            response?.vaccination || response?.data?.vaccination || response,
          );
        } else {
          const createdRecord = await apiClient.createVaccinationRecord(payload);
          normalizedCreated = normalizeVaccinationRecordResponse(createdRecord);

          if (Number(vaccinationForm.inventory_record_id)) {
            await apiClient.createVaccineInventoryTransaction({
              vaccine_inventory_id: Number(vaccinationForm.inventory_record_id),
              vaccine_id: Number(vaccinationForm.vaccine_id),
              clinic_id: selectedInventoryRecord?.clinic_id
                ? Number(selectedInventoryRecord.clinic_id)
                : undefined,
              transaction_type: "ISSUE",
              quantity: 1,
              lot_batch_number: lotBatchValue,
              reference_number: normalizedCreated?.id
                ? `VAC-${normalizedCreated.id}`
                : null,
              notes: normalizedCreated?.id
                ? `Vaccination record ${normalizedCreated.id} administered to infant ID ${vaccinationForm.infant_id}`
                : `Vaccination administered to infant ID ${vaccinationForm.infant_id}`,
            });
          }
        }

        setVaccinationRecords((prev) => [normalizedCreated, ...prev]);
      }

      await fetchData({ silent: true });
      setShowAddModal(false);
      setShowEditModal(false);
    } catch (err) {
      setError(err.message || "Failed to save vaccination record.");
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
      await fetchData({ silent: true });
    } catch (err) {
      setError(err.message || "Failed to delete vaccination record.");
    } finally {
      setMutationInFlight(false);
      setDeletingRecordId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    const rawQuery = searchQuery;
    const normalizedQuery = rawQuery.trim().toLowerCase();
    const exactApprovedVaccineQuery = isApprovedVaccineName(rawQuery)
      ? rawQuery
      : null;

    if (!rawQuery) return vaccinationRecords;

    return vaccinationRecords.filter((record) => {
      const { infant, vaccine } = findRecordWithRelations(record);

      const infantName = infant
        ? `${infant.first_name || ""} ${infant.last_name || ""}`.toLowerCase()
        : "";
      const vaccineName = (vaccine?.name || record.vaccine_name || "").toLowerCase();
      const status = (record.status || "").toLowerCase();

      return (
        infantName.includes(normalizedQuery) ||
        (exactApprovedVaccineQuery !== null &&
          vaccineName === exactApprovedVaccineQuery) ||
        status.includes(normalizedQuery)
      );
    });
  }, [vaccinationRecords, searchQuery, findRecordWithRelations]);

  const selectedInfantRecords = useMemo(() => {
    if (!selectedInfantId) return [];
    return vaccinationRecords.filter((record) => record.infant_id === selectedInfantId);
  }, [selectedInfantId, vaccinationRecords]);

  const approvedVaccinationSchedules = useMemo(
    () => vaccinationSchedules.filter((schedule) => isApprovedVaccineName(schedule.vaccine_name)),
    [vaccinationSchedules],
  );

  const dashboardStats = useMemo(() => {
    const completed = vaccinationRecords.filter(
      (record) =>
        record.status === "completed" ||
        record.status === "attended" ||
        Boolean(record.admin_date),
    ).length;
    const pending = vaccinationRecords.filter(
      (record) =>
        (record.status === "pending" || !record.status) &&
        !record.admin_date &&
        record.status !== "overdue",
    ).length;

    const overdue = vaccinationRecords.filter((record) => {
      if (record.status === "overdue") return true;
      if (!record.next_due_date || record.admin_date) return false;

      const dueDate = new Date(record.next_due_date);
      return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
    }).length;

    return {
      completed,
      pending,
      overdue,
      trackedInfants: infants.length,
    };
  }, [vaccinationRecords, infants.length]);

  const complianceRows = useMemo(() => {
    return infants
      .filter((infant) => {
        if (trackingStartDate || trackingEndDate) {
          if (!infant.dob) return false;
          const infantDate = new Date(infant.dob).toISOString().split('T')[0];
          if (trackingStartDate && infantDate < trackingStartDate) return false;
          if (trackingEndDate && infantDate > trackingEndDate) return false;
        }

        if (trackingSearchQuery) {
          const query = trackingSearchQuery.toLowerCase();
          const firstName = (infant.first_name || "").toLowerCase();
          const lastName = (infant.last_name || "").toLowerCase();
          if (!firstName.includes(query) && !lastName.includes(query)) return false;
        }

        return true;
      })
      .map((infant) => {
        const infantRecords = vaccinationRecords.filter(
          (record) => record.infant_id === infant.id,
        );

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
  }, [infants, vaccinationRecords, approvedVaccinationSchedules, trackingStartDate, trackingEndDate, trackingSearchQuery]);

  const availableVaccinesForClinic = useMemo(() => {
    const scopedInventory = inventoryRecords.filter((record) => {
      const recordClinicId = Number(record.clinic_id || 0) || null;
      return (
        Number(record.stock_on_hand || 0) > 0 &&
        (!scopedClinicId || recordClinicId === scopedClinicId)
      );
    });

    const uniqueByVaccine = new Map();
    scopedInventory.forEach((record) => {
      const vaccineId = Number(record.vaccine_id || 0) || null;
      if (!vaccineId || uniqueByVaccine.has(vaccineId)) return;

      const catalogMatch = vaccines.find((vaccine) => vaccine.id === vaccineId);
      const resolvedVaccineName = catalogMatch?.name || record.vaccine_name || null;
      if (!isApprovedVaccineName(resolvedVaccineName)) {
        return;
      }

      uniqueByVaccine.set(vaccineId, {
        id: vaccineId,
        name: resolvedVaccineName,
        code: catalogMatch?.code || record.vaccine_code || "",
      });
    });

    return Array.from(uniqueByVaccine.values()).sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || "")),
    );
  }, [inventoryRecords, scopedClinicId, vaccines]);

  const selectedBatchOption = useMemo(
    () =>
      vaccinationBatchOptions.find(
        (option) => String(option.batch_id) === String(vaccinationForm.batch_id || ""),
      ) || null,
    [vaccinationBatchOptions, vaccinationForm.batch_id],
  );

  const selectedInventoryRecord = useMemo(
    () =>
      inventoryRecords.find(
        (record) => record.id === Number(vaccinationForm.inventory_record_id),
      ) || null,
    [inventoryRecords, vaccinationForm.inventory_record_id],
  );

  const defaultAdministeredBy = useMemo(() => {
    const currentUserId = Number(user?.id || 0) || null;
    if (!currentUserId) return "";

    return healthWorkerUsers.some((entry) => Number(entry.id) === currentUserId)
      ? String(currentUserId)
      : "";
  }, [healthWorkerUsers, user?.id]);

  const selectedInfantForForm = useMemo(
    () =>
      infants.find(
        (infant) => infant.id === Number(vaccinationForm.infant_id || 0),
      ) || null,
    [infants, vaccinationForm.infant_id],
  );

  const vaccinationFormInfantRecords = useMemo(
    () =>
      vaccinationRecords.filter(
        (record) => record.infant_id === Number(vaccinationForm.infant_id || 0),
      ),
    [vaccinationRecords, vaccinationForm.infant_id],
  );

  const nextDueOptionsForSelectedInfant = useMemo(
    () =>
      buildNextDueVaccinationOptions({
        schedules: approvedVaccinationSchedules,
        records: vaccinationFormInfantRecords,
        infantDob: selectedInfantForForm?.dob,
      }),
    [
      approvedVaccinationSchedules,
      selectedInfantForForm?.dob,
      vaccinationFormInfantRecords,
    ],
  );

  const nextDueOptionByVaccineId = useMemo(
    () =>
      new Map(
        nextDueOptionsForSelectedInfant.map((entry) => [
          Number(entry.vaccine_id),
          entry,
        ]),
      ),
    [nextDueOptionsForSelectedInfant],
  );

  const availableVaccinesForSelectedInfant = useMemo(() => {
    if (!vaccinationForm.infant_id) {
      return availableVaccinesForClinic;
    }

    return availableVaccinesForClinic.filter((vaccine) =>
      nextDueOptionByVaccineId.has(Number(vaccine.id)),
    );
  }, [availableVaccinesForClinic, nextDueOptionByVaccineId, vaccinationForm.infant_id]);

  const selectedNextDueOption = useMemo(
    () => nextDueOptionByVaccineId.get(Number(vaccinationForm.vaccine_id || 0)) || null,
    [nextDueOptionByVaccineId, vaccinationForm.vaccine_id],
  );

  const healthWorkerSelectOptions = useMemo(
    () => [
      {
        value: "",
        label: healthWorkerUsers.length
          ? "Select Nurse or Midwife"
          : "No Nurse or Midwife users available",
      },
      ...healthWorkerUsers.map((entry) => ({
        value: String(entry.id),
        label: entry.optionLabel,
      })),
    ],
    [healthWorkerUsers],
  );

  const batchSourceSelectOptions = useMemo(
    () => [
      {
        value: "",
        label: vaccinationBatchOptionsLoading
          ? "Loading valid FEFO batch sources..."
          : vaccinationBatchOptions.length
            ? "Select FEFO batch source"
            : "No valid FEFO batch source available for this vaccine",
      },
      ...vaccinationBatchOptions.map((record) => ({
        value: String(record.batch_id),
        label: buildVaccinationBatchOptionLabel(record),
        disabled: record.selection_disabled,
      })),
    ],
    [vaccinationBatchOptions, vaccinationBatchOptionsLoading],
  );

  useEffect(() => {
    if (!showAddModal || vaccinationForm.id || vaccinationForm.administered_by || !defaultAdministeredBy) {
      return;
    }

    setVaccinationForm((prev) => ({
      ...prev,
      administered_by: defaultAdministeredBy,
    }));
  }, [defaultAdministeredBy, showAddModal, vaccinationForm.administered_by, vaccinationForm.id]);

  useEffect(() => {
    let isCurrent = true;

    if (!showAddModal || vaccinationForm.id || !vaccinationForm.vaccine_id) {
      setVaccinationBatchOptions([]);
      setVaccinationBatchOptionsError(null);
      setVaccinationBatchOptionsLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setVaccinationBatchOptionsLoading(true);
    setVaccinationBatchOptionsError(null);

    apiClient
      .getVaccineInventoryStatus(Number(vaccinationForm.vaccine_id))
      .then((response) => {
        if (!isCurrent) return;

        setVaccinationBatchOptions(
          buildFefoBatchOptions({
            batches: response,
            inventoryRecords,
            vaccineId: vaccinationForm.vaccine_id,
            clinicId: scopedClinicId,
          }),
        );
      })
      .catch((err) => {
        if (!isCurrent) return;

        setVaccinationBatchOptions([]);
        setVaccinationBatchOptionsError(
          err.message || "Failed to load FEFO batch inventory for the selected vaccine.",
        );
      })
      .finally(() => {
        if (isCurrent) {
          setVaccinationBatchOptionsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [
    inventoryRecords,
    scopedClinicId,
    showAddModal,
    vaccinationForm.id,
    vaccinationForm.vaccine_id,
  ]);

  useEffect(() => {
    if (!showAddModal || vaccinationForm.id || !vaccinationForm.vaccine_id) {
      return;
    }

    if (!vaccinationBatchOptions.length) {
      if (
        vaccinationForm.batch_id ||
        vaccinationForm.inventory_record_id ||
        vaccinationForm.lot_batch_number
      ) {
        setVaccinationForm((prev) => ({
          ...prev,
          batch_id: "",
          inventory_record_id: "",
          lot_batch_number: "",
        }));
      }
      return;
    }

    const matchingSelectedOption = vaccinationBatchOptions.find(
      (option) =>
        String(option.batch_id) === String(vaccinationForm.batch_id || "") &&
        !option.selection_disabled,
    );

    const nextSelectedOption =
      matchingSelectedOption ||
      vaccinationBatchOptions.find((option) => !option.selection_disabled) ||
      null;

    const nextBatchId = nextSelectedOption ? String(nextSelectedOption.batch_id) : "";
    const nextInventoryRecordId = nextSelectedOption?.matched_inventory_record_id
      ? String(nextSelectedOption.matched_inventory_record_id)
      : "";
    const nextLotBatchValue = resolveLotBatchValue(
      nextSelectedOption?.lot_batch_number,
      nextSelectedOption?.matched_inventory_record?.lot_batch_number,
    );

    if (
      String(vaccinationForm.batch_id || "") === nextBatchId &&
      String(vaccinationForm.inventory_record_id || "") === nextInventoryRecordId &&
      String(vaccinationForm.lot_batch_number || "") === nextLotBatchValue
    ) {
      return;
    }

    setVaccinationForm((prev) => ({
      ...prev,
      batch_id: nextBatchId,
      inventory_record_id: nextInventoryRecordId,
      lot_batch_number: nextLotBatchValue,
    }));
  }, [
    showAddModal,
    vaccinationBatchOptions,
    vaccinationForm.batch_id,
    vaccinationForm.id,
    vaccinationForm.inventory_record_id,
    vaccinationForm.lot_batch_number,
    vaccinationForm.vaccine_id,
  ]);

  if (loading && vaccinationRecords.length === 0) {
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
          <nav className="flex space-x-2 overflow-x-auto pb-2 xl:pb-0">
            {[
              { key: "records", label: "💉 Vaccination Records" },
              { key: "tracking", label: "📊 Vaccination Tracking" },
              { key: "schedule", label: "📅 Vaccination Schedule" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3 pb-3 xl:pb-0">
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
          <div className="text-xl sm:text-2xl font-bold text-warning-600">{dashboardStats.pending}</div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Pending Vaccinations
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

          {approvedVaccinationSchedules.length === 0 ? (
            <EmptyState
              title="No vaccination schedules"
              description="No active schedule definitions were returned by the backend."
              icon="📅"
              className="border-none shadow-none py-12"
            />
          ) : (
            <div className="flex-1 overflow-auto auto-hide-scrollbar">
              <table className="w-full relative">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
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
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {approvedVaccinationSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {schedule.vaccine_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {schedule.disease_prevented || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {schedule.age_in_months > 0
                          ? `${schedule.age_in_months} month${schedule.age_in_months > 1 ? "s" : ""}`
                          : "At Birth"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {schedule.dose_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  {filteredRecords.map((record) => {
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
          )}
        </div>
      )}

      {activeTab === "tracking" && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex-shrink-0">
            Vaccination Compliance Tracking
          </h3>

          {infants.length === 0 ? (
            <EmptyState
              title="No infants tracked"
              description="There are no infants registered in the system to track vaccination compliance."
              icon="👶"
              className="border-none shadow-none py-12"
            />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-shrink-0">
                <div className="w-full sm:max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Search Infant
                  </label>
                  <Input
                    placeholder="Search by name..."
                    value={trackingSearchQuery}
                    onChange={(e) => setTrackingSearchQuery(e.target.value)}
                    icon={Search}
                  />
                </div>
                <div className="w-full sm:max-w-md">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Focus by infant
                  </label>
                  <select
                    value={selectedInfantId || ""}
                    onChange={(e) =>
                      setSelectedInfantId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800"
                  >
                    <option value="">All infants</option>
                    {infants.map((infant) => (
                      <option key={infant.id} value={infant.id}>
                        {infant.first_name} {infant.last_name}
                      </option>
                    ))}
                  </select>
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

              <div className="flex-1 overflow-y-auto auto-hide-scrollbar pr-2 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(selectedInfantId
                  ? complianceRows.filter((entry) => entry.infant.id === selectedInfantId)
                  : complianceRows
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
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Vaccination Record"
        size="md"
        footer={
          <AdminModalActions>
            <Button type="button" variant="cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              form="addVaccinationForm"
              disabled={saving || healthWorkerUsers.length === 0 || vaccinationBatchOptionsLoading}
            >
              {saving ? "Saving..." : "Save Record"}
            </Button>
          </AdminModalActions>
        }
      >
        <form id="addVaccinationForm" onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-card">
            <div className="admin-form-card-body">
              <div className="admin-field-group">
                <label className="admin-field-label required">Child</label>
                <select
                  value={vaccinationForm.infant_id}
                  onChange={(e) =>
                    setVaccinationForm((prev) => ({
                      ...prev,
                      infant_id: e.target.value ? Number(e.target.value) : "",
                      vaccine_id: "",
                      dose_no: 1,
                      batch_id: "",
                      inventory_record_id: "",
                      lot_batch_number: "",
                    }))
                  }
                  className="admin-select"
                  required
                >
                  <option value="">Select Child</option>
                  {infants.map((infant) => (
                    <option key={infant.id} value={infant.id}>
                      {infant.first_name} {infant.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field-group">
                <label className="admin-field-label required">Vaccine</label>
                <select
                  value={vaccinationForm.vaccine_id}
                  onChange={(e) => {
                    const nextVaccineId = e.target.value ? Number(e.target.value) : "";
                    const nextDueOption = nextDueOptionByVaccineId.get(Number(nextVaccineId));
                    setVaccinationForm((prev) => ({
                      ...prev,
                      vaccine_id: nextVaccineId,
                      dose_no: nextDueOption?.dose_number || 1,
                      batch_id: "",
                      inventory_record_id: "",
                      lot_batch_number: "",
                    }));
                  }}
                  className="admin-select"
                  required
                >
                  <option value="">Select Vaccine</option>
                  {availableVaccinesForSelectedInfant.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name}
                      {vaccine.code ? ` (${vaccine.code})` : ""}
                    </option>
                  ))}
                </select>
                {vaccinationForm.vaccine_id === "" && availableVaccinesForSelectedInfant.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    {vaccinationForm.infant_id
                      ? "This child has no pending dose options available from the current schedule."
                      : "No available vaccine stock was found for Barangay San Nicolas Health Center."}
                  </p>
                )}
              </div>
            </div>
          </div>

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
                disabled={Boolean(selectedNextDueOption)}
              />
              {selectedNextDueOption && (
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                  Next pending scheduled dose selected automatically: dose {selectedNextDueOption.dose_number}
                  {selectedNextDueOption.due_date
                    ? ` • due ${new Date(selectedNextDueOption.due_date).toLocaleDateString()}`
                    : ""}
                </p>
              )}
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

          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <Select
                label="Administered By"
                value={vaccinationForm.administered_by}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    administered_by: e.target.value,
                  }))
                }
                options={healthWorkerSelectOptions}
                required
              />
              {!healthWorkerUsers.length && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  No active Nurse or Midwife users were found for this facility.
                </p>
              )}
            </div>
            <div className="admin-field-group">
              <Select
                label="Batch Source (FEFO)"
                value={vaccinationForm.batch_id}
                onChange={(e) =>
                  setVaccinationForm((prev) => {
                    const selectedBatchId = e.target.value;
                    const batchOption = vaccinationBatchOptions.find(
                      (record) => record.batch_id === Number(selectedBatchId),
                    );

                    return {
                      ...prev,
                      batch_id: selectedBatchId,
                      inventory_record_id: batchOption?.matched_inventory_record_id
                        ? String(batchOption.matched_inventory_record_id)
                        : "",
                      lot_batch_number: resolveLotBatchValue(
                        batchOption?.lot_batch_number,
                        batchOption?.matched_inventory_record?.lot_batch_number,
                      ),
                    };
                  })
                }
                options={batchSourceSelectOptions}
                required
              />
              {vaccinationBatchOptionsLoading && vaccinationForm.vaccine_id && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Loading FEFO-eligible batch sources for the selected vaccine...
                </p>
              )}
              {vaccinationBatchOptionsError && vaccinationForm.vaccine_id && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                  {vaccinationBatchOptionsError}
                </p>
              )}
              {!vaccinationBatchOptionsLoading &&
                !vaccinationBatchOptionsError &&
                !vaccinationBatchOptions.length &&
                vaccinationForm.vaccine_id && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  No non-expired FEFO batch with available stock was found for the selected vaccine.
                </p>
              )}
              {!vaccinationBatchOptionsLoading &&
                vaccinationBatchOptions.length > 0 &&
                vaccinationBatchOptions.every((option) => option.selection_disabled) && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Valid batches were found, but none are linked to an inventory sheet record.
                    Update Inventory Management before recording this vaccination.
                  </p>
                )}
              {selectedBatchOption?.is_fefo_recommended && !selectedBatchOption?.selection_disabled && (
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                  FEFO recommended batch selected automatically to use the earliest valid expiry first.
                </p>
              )}
              {selectedBatchOption?.is_expiring_soon && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Selected batch expires soon on {new Date(selectedBatchOption.expiry_date).toLocaleDateString()}.
                </p>
              )}
            </div>
            <div className="admin-field-group">
              <Input
                label="Lot / Batch Number"
                value={vaccinationForm.lot_batch_number}
                placeholder="Auto-filled from selected inventory source"
                disabled
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
              placeholder="Any additional notes or observations"
            />
          </div>
        </form>
      </Modal>

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
