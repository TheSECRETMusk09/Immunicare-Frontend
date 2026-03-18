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
  computeVaccinationComplianceSummary,
} from "../utils/adminDataAdapters";

const pollingIntervalMs = 60000;

const DEFAULT_FORM = {
  id: null,
  infant_id: "",
  vaccine_id: "",
  dose_no: 1,
  admin_date: "",
  next_due_date: "",
  administered_by: "",
  batch_number: "",
  lot_number: "",
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

        const [recordsData, schedulesData, infantsData, vaccinesData, inventoryData] =
          await Promise.all([
            apiClient.getVaccinationRecords(),
            apiClient.getVaccinationSchedules(),
            apiClient.getInfants(),
            apiClient.getVaccines(),
            apiClient.getVaccineInventory(
              scopedClinicId ? { clinic_id: scopedClinicId } : {},
            ),
          ]);

        const normalizedRecords = normalizeVaccinationRecordsResponse(recordsData);
        const normalizedSchedules =
          normalizeVaccinationSchedulesResponse(schedulesData);
        const normalizedInfants = normalizeInfantsResponse(infantsData);
        const normalizedVaccines = normalizeVaccinesResponse(vaccinesData);
        const normalizedInventory = normalizeVaccineInventoryResponse(inventoryData);

        setVaccinationRecords(normalizedRecords);
        setVaccinationSchedules(normalizedSchedules);
        setInfants(normalizedInfants);
        setVaccines(normalizedVaccines);
        setInventoryRecords(normalizedInventory);

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
      administered_by: record.administered_by_name || "",
      batch_number: record.batch_number || "",
      lot_number: record.lot_number || "",
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

        const payload = {
          patient_id: Number(vaccinationForm.infant_id),
          vaccine_id: Number(vaccinationForm.vaccine_id),
          dose_no: Number(vaccinationForm.dose_no || 1),
          admin_date: vaccinationForm.admin_date || null,
          next_due_date: vaccinationForm.next_due_date || null,
          administered_by: vaccinationForm.administered_by || null,
          notes: vaccinationForm.notes || null,
          status: vaccinationForm.status || "pending",
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
        const created = await apiClient.createVaccinationRecord(payload);
        const normalizedCreated = normalizeVaccinationRecordResponse(created);
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
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return vaccinationRecords;

    return vaccinationRecords.filter((record) => {
      const { infant, vaccine } = findRecordWithRelations(record);

      const infantName = infant
        ? `${infant.first_name || ""} ${infant.last_name || ""}`.toLowerCase()
        : "";
      const vaccineName = (vaccine?.name || record.vaccine_name || "").toLowerCase();
      const status = (record.status || "").toLowerCase();

      return (
        infantName.includes(normalizedQuery) ||
        vaccineName.includes(normalizedQuery) ||
        status.includes(normalizedQuery)
      );
    });
  }, [vaccinationRecords, searchQuery, findRecordWithRelations]);

  const selectedInfantRecords = useMemo(() => {
    if (!selectedInfantId) return [];
    return vaccinationRecords.filter((record) => record.infant_id === selectedInfantId);
  }, [selectedInfantId, vaccinationRecords]);

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
          schedules: vaccinationSchedules,
          records: infantRecords,
          infantDob: infant.dob,
        });

        return {
          infant,
          ...summary,
        };
      });
  }, [infants, vaccinationRecords, vaccinationSchedules, trackingStartDate, trackingEndDate, trackingSearchQuery]);

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
      uniqueByVaccine.set(vaccineId, {
        id: vaccineId,
        name:
          catalogMatch?.name ||
          record.vaccine_name ||
          `Vaccine #${vaccineId}`,
        code: catalogMatch?.code || record.vaccine_code || "",
      });
    });

    return Array.from(uniqueByVaccine.values()).sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || "")),
    );
  }, [inventoryRecords, scopedClinicId, vaccines]);

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

      {/* Tab Navigation */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900">
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <nav className="flex space-x-2 overflow-x-auto">
            {[
              { key: "records", label: "💉 Vaccination Records" },
              { key: "tracking", label: "📊 Vaccination Tracking" },
              { key: "schedule", label: "📅 Vaccination Schedule" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex-shrink-0 z-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div className="w-full sm:max-w-md relative">
          <Input
            placeholder="Search vaccinations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {refreshing && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</span>
          )}
          {mutationInFlight && (
            <span className="text-xs text-primary-600 dark:text-primary-400">
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const headers = [
                "Child Name",
                "Vaccine",
                "Dose",
                "Date Administered",
                "Next Due Date",
                "Status",
              ];

              const rows = filteredRecords.map((record) => {
                const { infant, vaccine } = findRecordWithRelations(record);
                return [
                  infant ? `${infant.first_name} ${infant.last_name}` : "Unknown",
                  vaccine?.name || record.vaccine_name || "Unknown Vaccine",
                  `Dose ${record.dose_no || record.dose_number || 1}`,
                  record.admin_date
                    ? new Date(record.admin_date).toLocaleDateString()
                    : "Not administered",
                  record.next_due_date
                    ? new Date(record.next_due_date).toLocaleDateString()
                    : "N/A",
                  record.status || (record.admin_date ? "completed" : "pending"),
                ];
              });

              const csv = [
                headers.join(","),
                ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "vaccinations_export.csv";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <span className="mr-2">📄</span> Export Data
          </Button>
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

          {vaccinationSchedules.length === 0 ? (
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
                  {vaccinationSchedules.map((schedule) => (
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
            <Button type="submit" variant="primary" form="addVaccinationForm" disabled={saving}>
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
                      infant_id: Number(e.target.value),
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
                  onChange={(e) =>
                    setVaccinationForm((prev) => ({
                      ...prev,
                      vaccine_id: Number(e.target.value),
                    }))
                  }
                  className="admin-select"
                  required
                >
                  <option value="">Select Vaccine</option>
                  {availableVaccinesForClinic.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name}
                      {vaccine.code ? ` (${vaccine.code})` : ""}
                    </option>
                  ))}
                </select>
                {vaccinationForm.vaccine_id === "" && availableVaccinesForClinic.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    No available vaccine stock was found for Barangay San Nicolas Health Center.
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

          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <Input
                label="Administered By"
                value={vaccinationForm.administered_by}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    administered_by: e.target.value,
                  }))
                }
                placeholder="Name or identifier"
              />
            </div>
            <div className="admin-field-group">
              <Input
                label="Batch Number"
                value={vaccinationForm.batch_number}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    batch_number: e.target.value,
                  }))
                }
                placeholder="Batch number"
              />
            </div>
            <div className="admin-field-group">
              <Input
                label="Lot Number"
                value={vaccinationForm.lot_number}
                onChange={(e) =>
                  setVaccinationForm((prev) => ({
                    ...prev,
                    lot_number: e.target.value,
                  }))
                }
                placeholder="Lot number"
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
