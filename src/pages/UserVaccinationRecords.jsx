import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import { guardianRoutePaths } from "../utils/routePaths";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianVaccinationCompletionModal from "../components/GuardianVaccinationCompletionModal";
import { Button, Card, Input } from "../components/UI";
import {
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Syringe,
  Calendar,
  FileText,
  ChevronDown,
  RefreshCw,
  Bell,
  User,
} from "lucide-react";
import { trackEvent } from "../utils/telemetry";
import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import { normalizeArrayPayload } from "../utils/apiUtils";

const PROVIDER_FALLBACK_LABEL = "Provider unavailable";

const resolveProviderName = (record) =>
  record?.provider_name ||
  record?.administered_by_name ||
  PROVIDER_FALLBACK_LABEL;

const normalizeScheduleRecord = (scheduleItem) => ({
  id:
    scheduleItem?.recordId ||
    `schedule-${scheduleItem?.vaccine?.id || scheduleItem?.vaccineId}-${scheduleItem?.dose?.number || scheduleItem?.doseNumber || 1}`,
  recordId: scheduleItem?.recordId || null,
  vaccine_id: scheduleItem?.vaccine?.id || scheduleItem?.vaccineId || null,
  vaccine_name:
    scheduleItem?.vaccine?.name || scheduleItem?.vaccineName || "Unknown vaccine",
  dose_no: scheduleItem?.dose?.number || scheduleItem?.doseNumber || 1,
  total_doses: scheduleItem?.dose?.total || scheduleItem?.totalDoses || 1,
  due_date: scheduleItem?.schedule?.dueDate || scheduleItem?.dueDate || null,
  admin_date: scheduleItem?.lastAdministered || scheduleItem?.adminDate || null,
  status: scheduleItem?.status || "upcoming",
  isScheduleOnly: !scheduleItem?.recordId,
  isReady: Boolean(scheduleItem?.isReady),
  canBeAdministered: Boolean(scheduleItem?.canBeAdministered),
  schedule_id: scheduleItem?.schedule?.id || scheduleItem?.scheduleId || null,
  source_facility: scheduleItem?.source_facility || null,
});

const VaccinationRecordCard = ({
  vaccine,
  status,
  formatDate,
  actionLabel,
  onAction,
}) => (
  <article className="guardian-table-card md:hidden">
    <div className="guardian-table-card__header">
      <div className="min-w-0">
        <h3 className="guardian-table-card__title">{vaccine.vaccine_name}</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Dose {vaccine.dose_no || 1}
        </p>
      </div>
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          status.color === "green"
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : status.color === "red"
              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              : status.color === "yellow"
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        }`}
      >
        {status.label}
      </span>
    </div>
    <div className="guardian-table-card__rows">
      <div className="guardian-table-card__row">
        <span className="guardian-table-card__label">Provider</span>
        <span className="guardian-table-card__value">{resolveProviderName(vaccine)}</span>
      </div>
      <div className="guardian-table-card__row">
        <span className="guardian-table-card__label">Due Date</span>
        <span className="guardian-table-card__value">{formatDate(vaccine.due_date)}</span>
      </div>
      <div className="guardian-table-card__row">
        <span className="guardian-table-card__label">Date Given</span>
        <span className="guardian-table-card__value">{formatDate(vaccine.admin_date)}</span>
      </div>
      <div className="guardian-table-card__row">
        <span className="guardian-table-card__label">Action</span>
        <span className="guardian-table-card__value">
          {actionLabel ? (
            <button
              type="button"
              onClick={() => onAction?.(vaccine)}
              className="mb-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              {actionLabel}
            </button>
          ) : null}
          {vaccine.isScheduleOnly
            ? "Awaiting dose"
            : vaccine.admin_date
              ? "Recorded by health center"
              : "Not recorded"}
        </span>
      </div>
    </div>
  </article>
);

export default function UserVaccinationRecords() {
  const { guardianId } = useAuth();
  const { childId } = useParams();
  const navigate = useNavigate();

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("records"); // "records", "schedule", "upcoming"
  const [searchQuery, setSearchQuery] = useState("");
  const [showChildDropdown, setShowChildDropdown] = useState(false);
  const [vaccinationActionTarget, setVaccinationActionTarget] = useState(null);
  const [actionFeedback, setActionFeedback] = useState("");

  // Readiness state for next-dose prediction
  const [childReadiness, setChildReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const fetchChildren = useCallback(async () => {
    if (!guardianId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.getInfantsByGuardian(guardianId);
      const childrenData = normalizeArrayPayload(response, ["infants", "children", "patients"]);
      setChildren(childrenData);

      if (childrenData.length === 0) {
        setSelectedChild(null);
        setVaccinationRecords([]);
        setVaccinationSchedules([]);
        setScheduleSummary(null);
        setChildReadiness(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  const fetchVaccinationData = useCallback(async (childId) => {
    try {
      setScheduleSummary(null);
      const [recordsResponse, schedulesResponse] = await Promise.all([
        apiClient.getVaccinationsByInfant(childId),
        apiClient.getInfantVaccinationSchedule(childId),
      ]);
      // Handle both direct array response and wrapped response
      const recordsData = Array.isArray(recordsResponse)
        ? recordsResponse
        : recordsResponse?.data || recordsResponse || [];

      const normalizedRecords = (Array.isArray(recordsData) ? recordsData : []).map(
        (record) => ({
          ...record,
          due_date: record.due_date || record.next_due_date || null,
          dose_no: record.dose_no || record.dose_number || 1,
          provider_name: resolveProviderName(record),
        }),
      );

      setVaccinationRecords(normalizedRecords);
      const normalizedScheduleResponse =
        schedulesResponse && typeof schedulesResponse === "object"
          ? schedulesResponse
          : { schedule: Array.isArray(schedulesResponse) ? schedulesResponse : [] };

      setVaccinationSchedules(
        Array.isArray(normalizedScheduleResponse?.schedule)
          ? normalizedScheduleResponse.schedule
          : Array.isArray(normalizedScheduleResponse?.data)
            ? normalizedScheduleResponse.data
            : [],
      );
      setScheduleSummary(normalizedScheduleResponse?.summary || null);
    } catch (err) {
      console.error("Error fetching vaccination data:", err);
      setScheduleSummary(null);
    }
  }, []);

  // Fetch readiness for next-dose prediction
  const fetchReadiness = useCallback(async (childId) => {
    setReadinessLoading(true);
    try {
      const result = await apiClient.getVaccinationReadiness(childId);
      if (result?.success && result?.data) {
        setChildReadiness(result.data);
      } else {
        setChildReadiness(null);
      }
    } catch (err) {
      console.error("Error fetching readiness:", err);
      setChildReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  useEffect(() => {
    if (children.length === 0) {
      return;
    }

    const parsedChildId = childId ? Number.parseInt(childId, 10) : null;
    const targetChild = Number.isInteger(parsedChildId)
      ? children.find((child) => Number(child.id) === parsedChildId)
      : null;

    const nextSelectedChild = targetChild || children[0];

    setSelectedChild((currentSelectedChild) => {
      if (
        currentSelectedChild &&
        Number(currentSelectedChild.id) === Number(nextSelectedChild.id)
      ) {
        return currentSelectedChild;
      }

      return nextSelectedChild;
    });

    if (String(childId || "") !== String(nextSelectedChild.id)) {
      navigate(`/guardian/vaccination-records/${nextSelectedChild.id}`, {
        replace: true,
      });
    }
  }, [childId, children, navigate]);

  useEffect(() => {
    if (selectedChild) {
      trackEvent("vaccination_records_viewed", { childId: selectedChild.id, viewMode });
    }
  }, [selectedChild, viewMode]);

  useEffect(() => {
    if (selectedChild) {
      fetchVaccinationData(selectedChild.id);
      fetchReadiness(selectedChild.id);
      setActionFeedback("");
    }
  }, [selectedChild, fetchVaccinationData, fetchReadiness]);

  const normalizedScheduleRecords = useMemo(
    () => vaccinationSchedules.map((scheduleItem) => normalizeScheduleRecord(scheduleItem)),
    [vaccinationSchedules],
  );

  const pendingConfirmationCount = useMemo(
    () =>
      normalizedScheduleRecords.filter(
        (record) => String(record.status || "").toLowerCase() === "pending_confirmation",
      ).length,
    [normalizedScheduleRecords],
  );

  const resolveActionLabel = (vaccine) => {
    if (vaccine.admin_date || String(vaccine.status || "").toLowerCase() === "completed") {
      return "Edit Date";
    }

    return "Mark Completed";
  };

  const openVaccinationActionModal = (vaccine) => {
    setVaccinationActionTarget(vaccine);
  };

  const handleVaccinationActionSuccess = useCallback(
    async (message) => {
      if (!selectedChild?.id) {
        return;
      }

      await fetchVaccinationData(selectedChild.id);
      await fetchReadiness(selectedChild.id);
      setVaccinationActionTarget(null);
      setActionFeedback(message);
    },
    [fetchReadiness, fetchVaccinationData, selectedChild],
  );

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return "-";
    const birthDate = new Date(dob);
    const today = new Date();
    const months =
      (today.getFullYear() - birthDate.getFullYear()) * 12 +
      (today.getMonth() - birthDate.getMonth());
    if (months < 1) {
      const days = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
      return `${days} days`;
    } else if (months < 24) {
      return `${months} month${months !== 1 ? "s" : ""}`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return remainingMonths > 0
        ? `${years} year${years !== 1 ? "s" : ""} ${remainingMonths} mo`
        : `${years} year${years !== 1 ? "s" : ""}`;
    }
  };

  // Calculate vaccination statistics
  const stats = useMemo(() => {
    if (scheduleSummary) {
      return {
        completed: Number(scheduleSummary.completed || 0),
        upcoming: Number(scheduleSummary.upcoming || 0),
        overdue: Number(scheduleSummary.overdue || 0),
        total: Number(
          scheduleSummary.totalVaccines ||
            normalizedScheduleRecords.length ||
            vaccinationRecords.length ||
            0,
        ),
      };
    }

    const completed = normalizedScheduleRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "completed",
    ).length;
    const upcoming = normalizedScheduleRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "upcoming",
    ).length;
    const overdue = normalizedScheduleRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "overdue",
    ).length;

    return {
      completed,
      upcoming,
      overdue,
      total:
        normalizedScheduleRecords.length ||
        vaccinationRecords.length ||
        completed + upcoming + overdue,
    };
  }, [normalizedScheduleRecords, scheduleSummary, vaccinationRecords]);

  const getVaccineStatus = (vaccine) => {
    const normalizedStatus = String(vaccine.status || "").toLowerCase();

    if (vaccine.admin_date || normalizedStatus === "completed") {
      return { status: "Completed", color: "green", label: "Completed" };
    }

    if (normalizedStatus === "ready") {
      return { status: "Ready", color: "green", label: "Ready" };
    }

    if (normalizedStatus === "pending_confirmation") {
      return {
        status: "Pending Confirmation",
        color: "yellow",
        label: "Pending Confirmation",
      };
    }

    if (normalizedStatus === "due_soon") {
      return { status: "Due Soon", color: "yellow", label: "Due Soon" };
    }

    if (normalizedStatus === "upcoming") {
      return { status: "Upcoming", color: "gray", label: "Upcoming" };
    }

    if (!vaccine.due_date) {
      return { status: "Pending", color: "yellow", label: "Pending" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(vaccine.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return { status: "Overdue", color: "red", label: "Overdue" };
    } else if (daysUntilDue <= 14) {
      return { status: "Due Soon", color: "yellow", label: "Due Soon" };
    } else {
      return { status: "Pending", color: "gray", label: "Pending" };
    }
  };

  // Filter records based on search and view mode
  const filteredRecords = useMemo(() => {
    let records =
      viewMode === "records"
        ? [...vaccinationRecords]
        : normalizedScheduleRecords.map((record) => ({
            ...record,
            provider_name: resolveProviderName(record),
          }));

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      records = records.filter(
        (v) =>
          (v.vaccine_name && v.vaccine_name.toLowerCase().includes(query)) ||
          (v.dose_no && v.dose_no.toString().includes(query)),
      );
    }

    // Filter by view mode
    if (viewMode === "upcoming") {
      records = records.filter((v) => {
        const normalizedStatus = String(v.status || "").toLowerCase();
        return !["completed", "overdue"].includes(normalizedStatus);
      });
    }

    return records;
  }, [normalizedScheduleRecords, searchQuery, vaccinationRecords, viewMode]);

  const handleChildSelect = (child) => {
    setShowChildDropdown(false);
    setSearchQuery("");

    if (Number(selectedChild?.id) !== Number(child.id)) {
      navigate(`/guardian/vaccination-records/${child.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 px-4">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={fetchChildren}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="min-[1025px]:hidden fixed top-0 left-0 right-0 z-40 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={() => {
            fetchChildren();
            if (selectedChild) {
              fetchVaccinationData(selectedChild.id);
              fetchReadiness(selectedChild.id);
            }
          }}
          isRefreshing={loading}
        />
      </div>

      <div className="pt-14 sm:pt-16 min-[1025px]:pt-0">
        <GuardianModuleHeader
        title="Vaccination Records"
        subtitle="Track and manage your child's vaccination history"
        icon={<FileText className="w-8 h-8 text-white" />}
        actions={
          <div className="guardian-inline-actions flex items-center gap-2">
            <div className="hidden min-[1025px]:flex guardian-desktop-pageheader-actions mr-2">
              <button
                type="button"
                onClick={() => {
                  fetchChildren();
                  if (selectedChild) {
                    fetchVaccinationData(selectedChild.id);
                    fetchReadiness(selectedChild.id);
                  }
                }}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Refresh Vaccination Records"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/guardian/notifications')}
                className="guardian-desktop-pageheader-icon-btn guardian-desktop-pageheader-icon-btn--notif"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/guardian/profile')}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Open profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
            <Button
              variant={
                viewMode === "records" ||
                viewMode === "schedule" ||
                viewMode === "upcoming"
                  ? "primary"
                  : "secondary"
              }
              onClick={() => setViewMode("records")}
              size="sm"
            >
              Records
            </Button>
            <Button
              variant={viewMode === "booklet" ? "primary" : "secondary"}
              onClick={() => setViewMode("booklet")}
              size="sm"
            >
              Booklet
            </Button>
          </div>
        }
      />
      </div>

      <main className="guardian-page-content space-y-4 sm:space-y-6">

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">👶</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Children Registered
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to register your children first to view their vaccination
            records.
          </p>
          <Button onClick={() => navigate("/guardian/children")}>
            Register Child
          </Button>
        </div>
      ) : (
        <>
          {/* Child Selector Dropdown */}
          <div className="relative">
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-4 cursor-pointer"
              onClick={() => setShowChildDropdown(!showChildDropdown)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                    <span className="text-xl">
                      {selectedChild?.sex === "M" ? "👦" : "👧"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 break-words">
                      {selectedChild?.first_name} {selectedChild?.last_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                      {calculateAge(selectedChild?.dob)} • Born{" "}
                      {formatDate(selectedChild?.dob)}
                    </p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 break-all">
                      Infant Control Number: {selectedChild?.control_number || "Pending"}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${showChildDropdown ? "rotate-180" : ""}`}
                />
              </div>

              {/* Quick Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    Vaccination Progress
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {stats.completed} / {stats.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Dropdown Options */}
            {showChildDropdown && children.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-10 overflow-hidden">
                {children.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => handleChildSelect(child)}
                    className={`p-4 cursor-pointer flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedChild?.id === child.id
                        ? "bg-indigo-50 dark:bg-indigo-900/20"
                        : ""
                    }`}
                  >
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                      <span className="text-lg">
                        {child.sex === "M" ? "👦" : "👧"}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {child.first_name} {child.last_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {calculateAge(child.dob)}
                      </p>
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1">
                        Infant Control Number: {child.control_number || "Pending"}
                      </p>
                    </div>
                    {selectedChild?.id === child.id && (
                      <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Cards - Child Specific Only */}
          <div className="guardian-vaccination-summary-grid grid grid-cols-1 min-[480px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-3">
            <Card className="guardian-vaccination-summary-card p-4 flex items-center gap-4">
              <div className="guardian-vaccination-summary-card__icon w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="guardian-vaccination-summary-card__body">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.completed}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Completed
                </p>
              </div>
            </Card>

            <Card className="guardian-vaccination-summary-card p-4 flex items-center gap-4">
              <div className="guardian-vaccination-summary-card__icon w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="guardian-vaccination-summary-card__body">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.upcoming}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upcoming
                </p>
              </div>
            </Card>

            <Card className="guardian-vaccination-summary-card p-4 flex items-center gap-4">
              <div className="guardian-vaccination-summary-card__icon w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="guardian-vaccination-summary-card__body">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.overdue}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Overdue
                </p>
              </div>
            </Card>
          </div>

          {/* Next-Dose Prediction Banner */}
          {selectedChild && !readinessLoading && childReadiness && (
            <div className={`rounded-xl p-4 ${
              childReadiness.readinessStatus === 'READY'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : childReadiness.readinessStatus === 'OVERDUE'
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  {childReadiness.readinessStatus === 'READY' ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : childReadiness.readinessStatus === 'OVERDUE' ? (
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5" />
                  ) : (
                    <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`font-semibold ${
                      childReadiness.readinessStatus === 'READY'
                        ? 'text-green-800 dark:text-green-300'
                        : childReadiness.readinessStatus === 'OVERDUE'
                          ? 'text-red-800 dark:text-red-300'
                          : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                            ? 'text-yellow-800 dark:text-yellow-300'
                            : 'text-blue-800 dark:text-blue-300'
                    }`}>
                      {childReadiness.readinessStatus === 'READY'
                        ? 'Ready for Next Vaccination!'
                        : childReadiness.readinessStatus === 'OVERDUE'
                          ? 'Overdue - Schedule Appointment Now!'
                          : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                            ? 'Pending Confirmation'
                            : 'Upcoming Vaccination'}
                    </h4>

                    {/* Due Vaccines */}
                    {childReadiness.dueVaccines && childReadiness.dueVaccines.length > 0 && (
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        Due: {childReadiness.dueVaccines.map(v => v.label).join(', ')}
                      </p>
                    )}

                    {/* Overdue Vaccines */}
                    {childReadiness.overdueVaccines && childReadiness.overdueVaccines.length > 0 && (
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        Overdue: {childReadiness.overdueVaccines.map(v => v.label).join(', ')}
                      </p>
                    )}

                    {/* Next Appointment Prediction */}
                    {childReadiness.nextAppointmentPrediction && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        <span className="font-medium">Recommended Date:</span>{' '}
                        {childReadiness.nextAppointmentPrediction.date
                          ? new Date(childReadiness.nextAppointmentPrediction.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'Not available'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Book Appointment Button */}
                {(childReadiness.readinessStatus === 'READY' ||
                  childReadiness.readinessStatus === 'OVERDUE' ||
                  (childReadiness.nextAppointmentPrediction && childReadiness.nextAppointmentPrediction.date)) && (
                  <Button
                    onClick={() =>
                      navigate(guardianRoutePaths.appointmentBooking(selectedChild.id))
                    }
                    size="sm"
                    className="shrink-0"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book Appointment
                  </Button>
                )}
              </div>
            </div>
          )}

          {actionFeedback ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {actionFeedback}
            </div>
          ) : null}

          {pendingConfirmationCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your child is old enough for at least one next dose, but this health center has not
              yet confirmed readiness for on-site administration. If the vaccine was already given
              elsewhere, use <span className="font-semibold">Mark Completed</span>, enter the
              administered date, and upload the transfer file or vaccination proof.
            </div>
          ) : null}

          {/* Loading State for Readiness */}
          {selectedChild && readinessLoading && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mr-2"></div>
              <span className="text-gray-500 dark:text-gray-400">Loading vaccination status...</span>
            </div>
          )}

          {/* Tab Navigation - Simplified for Guardian */}
          {viewMode !== "booklet" && (
            <div className="guardian-tab-bar border-b border-gray-200 dark:border-gray-700 pb-2">
              <button
                onClick={() => setViewMode("records")}
                className={`guardian-tab-bar__item flex items-center gap-2 text-sm font-medium transition-all ${
                  viewMode === "records"
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <FileText className="w-4 h-4" /> Records
              </button>
              <button
                onClick={() => setViewMode("schedule")}
                className={`guardian-tab-bar__item hidden md:flex items-center gap-2 text-sm font-medium transition-all ${
                  viewMode === "schedule"
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <Calendar className="w-4 h-4" /> Scheduling
              </button>
              <button
                onClick={() => setViewMode("upcoming")}
                className={`guardian-tab-bar__item hidden md:flex items-center gap-2 text-sm font-medium transition-all ${
                  viewMode === "upcoming"
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <Syringe className="w-4 h-4" /> Upcoming
              </button>
            </div>
          )}

          {/* Search Bar */}
          {viewMode !== "booklet" && (
            <div className="w-full max-w-md">
              <Input
                placeholder="Search vaccinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
          )}

          {/* Content */}
          {selectedChild && (
            <>
              {viewMode === "booklet" ? (
                <ImmunizationRecordBooklet infantId={selectedChild.id} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="guardian-table-card-list p-4 md:hidden">
                    {filteredRecords.map((vaccine) => {
                      const status = getVaccineStatus(vaccine);
                      return (
                        <VaccinationRecordCard
                          key={vaccine.id || vaccine.vaccine_id}
                          vaccine={vaccine}
                          status={status}
                          formatDate={formatDate}
                          actionLabel={resolveActionLabel(vaccine)}
                          onAction={openVaccinationActionModal}
                        />
                      );
                    })}
                  </div>
                  {/* Tablet/Desktop table */}
                  <div className="guardian-table-scroll-shell hidden md:block">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Vaccine
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Dose
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Provider
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Date Given
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredRecords.map((vaccine) => {
                          const status = getVaccineStatus(vaccine);
                          return (
                            <tr
                              key={vaccine.id || vaccine.vaccine_id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="px-4 py-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {vaccine.vaccine_name}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  Dose {vaccine.dose_no || 1}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  {resolveProviderName(vaccine)}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  {formatDate(vaccine.due_date)}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  {formatDate(vaccine.admin_date)}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    status.color === "green"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : status.color === "red"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                        : status.color === "yellow"
                                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                  }`}
                                >
                                  {status.label}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <button
                                  type="button"
                                  onClick={() => openVaccinationActionModal(vaccine)}
                                  className="mb-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  {resolveActionLabel(vaccine)}
                                </button>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {vaccine.isScheduleOnly
                                    ? "Awaiting dose"
                                    : vaccine.admin_date
                                      ? "Recorded by health center"
                                      : "Not recorded"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredRecords.length === 0 && (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-3">💉</div>
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchQuery
                          ? "No vaccinations match your search."
                          : viewMode === "upcoming"
                            ? "No upcoming vaccinations scheduled."
                            : "No vaccination records found."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      </main>

      <GuardianVaccinationCompletionModal
        isOpen={Boolean(vaccinationActionTarget)}
        onClose={() => setVaccinationActionTarget(null)}
        child={selectedChild}
        vaccination={vaccinationActionTarget}
        onSuccess={handleVaccinationActionSuccess}
      />
    </div>
  );
}
