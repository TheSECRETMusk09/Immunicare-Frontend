import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import GuardianImmunizationChart from "../components/GuardianImmunizationChart";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import GuardianTopHeader from "../components/GuardianTopHeader";
import { LoadingSpinner, Alert, Button } from "../components/UI";
import { FileCheck, ChevronDown, Activity, CheckCircle } from "lucide-react";
import { trackEvent } from "../utils/telemetry";
import { normalizeArrayPayload } from "../utils/apiUtils";
import { formatInfantDob } from "../utils/dateUtils";

/**
 * GuardianImmunizationChartPage
 *
 * Page component for guardians to view and download their child's immunization chart.
 * This page is accessible from the guardian dashboard.
 * Read-only view for guardians - no editing capabilities.
 */
export default function GuardianImmunizationChartPage() {
  const { childId } = useParams();
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("immunization"); // 'immunization' or 'growth'
  const [growthRecords, setGrowthRecords] = useState([]);
  const [loadingGrowth, setLoadingGrowth] = useState(false);

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
      if (childrenData.length > 0) {
        if (childId) {
          const targetChild = childrenData.find(
            (c) => c.id === parseInt(childId),
          );
          setSelectedChild(targetChild || childrenData[0]);
        } else {
          setSelectedChild(childrenData[0]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [guardianId, childId]);

  // Fetch growth records when switching to growth tab
  const fetchGrowthRecords = useCallback(async (targetChildId) => {
    if (!targetChildId) {
      setGrowthRecords([]);
      return;
    }

    try {
      setLoadingGrowth(true);
      const response = await apiClient.getGrowthRecordsByInfant(targetChildId);
      const normalized = Array.isArray(response) ? response : response?.data || [];
      setGrowthRecords(normalized.sort((a, b) => {
        const dateA = new Date(a.measurement_date || a.date || 0);
        const dateB = new Date(b.measurement_date || b.date || 0);
        return dateB - dateA;
      }));
    } catch (err) {
      console.error("Error fetching growth records:", err);
      setGrowthRecords([]);
    } finally {
      setLoadingGrowth(false);
    }
  }, []);

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  useEffect(() => {
    if (childId && children.length > 0) {
      const child = children.find((c) => c.id === parseInt(childId));
      if (child) {
        setSelectedChild(child);
      }
    } else if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0]);
    }
  }, [childId, children, selectedChild]);

  useEffect(() => {
    if (selectedChild) {
      trackEvent("immunization_chart_viewed", { childId: selectedChild.id, activeTab });
    }
  }, [selectedChild, activeTab]);

  // Fetch growth records when switching to growth tab
  useEffect(() => {
    if (activeTab === "growth" && selectedChild?.id) {
      fetchGrowthRecords(selectedChild.id);
    }
  }, [activeTab, selectedChild?.id, fetchGrowthRecords]);

  const toDateKey = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  };

  const birthWeight =
    selectedChild?.birth_weight ??
    selectedChild?.birthWeight ??
    selectedChild?.birth_weight_kg ??
    selectedChild?.weight_at_birth ??
    null;
  const birthHeight =
    selectedChild?.birth_height ??
    selectedChild?.birth_length ??
    selectedChild?.birthHeight ??
    selectedChild?.birthLength ??
    null;
  const birthHeadCircumference =
    selectedChild?.birth_head_circumference ??
    selectedChild?.head_circumference_cm ??
    selectedChild?.head_circumference ??
    null;
  const dobKey = toDateKey(selectedChild?.dob);

  const hasBirthRecordRow = dobKey
    ? growthRecords.some((record) => {
        const recordKey = toDateKey(record?.measurement_date || record?.date);
        return recordKey && recordKey === dobKey;
      })
    : false;

  const shouldShowBirthFallback =
    Boolean(dobKey) &&
    !hasBirthRecordRow &&
    (birthWeight !== null || birthHeight !== null || birthHeadCircumference !== null);

  const birthEntry = shouldShowBirthFallback
    ? {
        id: "birth",
        measurement_date: selectedChild?.dob,
        weight_kg: birthWeight,
        length_cm: birthHeight,
        head_circumference_cm: birthHeadCircumference,
        notes: "Recorded at registration",
        isBirthFallback: true,
      }
    : null;

  const displayRecords = birthEntry
    ? [...growthRecords, birthEntry].sort((a, b) => {
        const dateA = new Date(a.measurement_date || a.date || 0).getTime();
        const dateB = new Date(b.measurement_date || b.date || 0).getTime();
        return dateB - dateA;
      })
    : growthRecords;

  const latestRecord = displayRecords[0] || null;
  const latestIsBirth = Boolean(latestRecord?.isBirthFallback);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Alert variant="error">{error}</Alert>
        <button
          onClick={fetchChildren}
          className="mt-4 w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Children Registered
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need to register your children first to view their immunization
            charts.
          </p>
          <Button onClick={() => navigate("/guardian/children")}>
            Register Child
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="guardian-page-wrapper min-h-screen bg-theme-bg-primary transition-colors duration-200">
      <div className="min-[1025px]:hidden fixed top-0 left-0 right-0 z-40 w-full bg-theme-bg-primary border-b border-theme-border-primary shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={fetchChildren}
          isRefreshing={loading || loadingGrowth}
        />
      </div>

      <div className="pt-14 sm:pt-16 min-[1025px]:pt-0">
      <GuardianModuleHeader
        title="Immunization Chart"
        subtitle="View your child's vaccination records and schedule"
        icon={<FileCheck className="w-8 h-8 text-white" />}
      />

      <main className="guardian-page-content space-y-4 sm:space-y-6">
      {/* Tab Navigation */}
      <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-800 rounded-xl p-1.5 border border-gray-200 dark:border-gray-700 shadow-sm w-full">
        <button
          type="button"
          onClick={() => setActiveTab("immunization")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === "immunization"
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <FileCheck className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Immunization Chart</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("growth")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === "growth"
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <Activity className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Growth Charts</span>
        </button>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="relative z-[100]">
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-4 cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
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
                    {formatInfantDob(selectedChild?.dob)}
                  </p>
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 break-all">
                    Infant Control Number: {selectedChild?.control_number || "Pending"}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                  showDropdown ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[150] overflow-hidden">
              {children.map((child) => (
                <div
                  key={child.id}
                  onClick={() => {
                    setSelectedChild(child);
                    setShowDropdown(false);
                  }}
                  className={`p-4 cursor-pointer flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedChild?.id === child.id
                      ? "bg-indigo-50 dark:bg-indigo-900/20"
                      : ""
                  }`}
                >
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">
                      {child.sex === "M" ? "👦" : "👧"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {child.first_name} {child.last_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {calculateAge(child.dob)}
                    </p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 truncate">
                      Infant Control Number: {child.control_number || "Pending"}
                    </p>
                  </div>
                  {selectedChild?.id === child.id && (
                    <CheckCircle className="w-5 h-5 text-green-500 ml-auto flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Immunization Chart */}
      {selectedChild && activeTab === "immunization" && (
        <div className="guardian-chart-scroll-container bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
          <GuardianImmunizationChart
            childId={selectedChild.id}
          />
        </div>
      )}

      {/* Growth Charts Section */}
      {selectedChild && activeTab === "growth" && (
        <div className="space-y-4">
          {/* Latest Measurements Cards */}
          <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4">
            <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Weight</p>
              <p className="text-2xl font-bold text-theme-primary mt-2">
                {latestRecord && (latestRecord.weight_kg ?? latestRecord.weight) != null
                  ? `${latestRecord.weight_kg ?? latestRecord.weight} kg`
                  : '-'}
              </p>
              {latestIsBirth && (latestRecord?.weight_kg ?? null) != null && (
                <p className="text-xs text-theme-secondary mt-1">(at birth)</p>
              )}
            </div>
            <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Height</p>
              <p className="text-2xl font-bold text-theme-primary mt-2">
                {latestRecord && (latestRecord.length_cm ?? latestRecord.height ?? latestRecord.length) != null
                  ? `${latestRecord.length_cm ?? latestRecord.height ?? latestRecord.length} cm`
                  : '-'}
              </p>
              {latestIsBirth && (latestRecord?.length_cm ?? null) != null && (
                <p className="text-xs text-theme-secondary mt-1">(at birth)</p>
              )}
            </div>
            <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Head Circumference</p>
              <p className="text-2xl font-bold text-theme-primary mt-2">
                {latestRecord && (latestRecord.head_circumference_cm ?? latestRecord.head_circumference) != null
                  ? `${latestRecord.head_circumference_cm ?? latestRecord.head_circumference} cm`
                  : '-'}
              </p>
            </div>
          </div>

          {/* Growth History Table */}
          <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-theme-primary mb-4">Growth History</h3>

            {loadingGrowth ? (
              <div className="py-10 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : displayRecords.length === 0 ? (
              <div className="py-10 text-center text-theme-secondary">
                No growth records yet for this child.
              </div>
            ) : (
              <div className="guardian-table-card-list md:hidden">
                {displayRecords.map((record) => (
                  <article
                    key={record.id || `${record.measurement_date}-${record.weight_kg}`}
                    className="guardian-table-card"
                  >
                    <div className="guardian-table-card__header">
                      <h4 className="guardian-table-card__title">
                        {record.measurement_date
                          ? new Date(record.measurement_date).toLocaleDateString()
                          : "Measurement"}
                      </h4>
                    </div>
                    <div className="guardian-table-card__rows">
                      <div className="guardian-table-card__row">
                        <span className="guardian-table-card__label">Weight</span>
                        <span className="guardian-table-card__value">{record.weight_kg || record.weight || '-'} kg</span>
                      </div>
                      <div className="guardian-table-card__row">
                        <span className="guardian-table-card__label">Height</span>
                        <span className="guardian-table-card__value">{record.length_cm || record.height || record.length || '-'} cm</span>
                      </div>
                      <div className="guardian-table-card__row">
                        <span className="guardian-table-card__label">Head Circ.</span>
                        <span className="guardian-table-card__value">{record.head_circumference_cm || record.head_circumference || '-'} cm</span>
                      </div>
                      <div className="guardian-table-card__row">
                        <span className="guardian-table-card__label">Notes</span>
                        <span className="guardian-table-card__value">{record.notes || '-'}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!loadingGrowth && displayRecords.length > 0 && (
              <div className="guardian-table-scroll-shell hidden md:block">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-theme-border-primary">
                      <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Date</th>
                      <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Weight (kg)</th>
                      <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Height (cm)</th>
                      <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Head Circ. (cm)</th>
                      <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRecords.map((record) => (
                      <tr key={record.id || `${record.measurement_date}-${record.weight_kg}`} className="border-b border-theme-border-primary/60">
                        <td className="py-3 text-theme-primary">
                          {record.measurement_date ? new Date(record.measurement_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 text-theme-primary">{record.weight_kg || record.weight || '-'}</td>
                        <td className="py-3 text-theme-primary">{record.length_cm || record.height || record.length || '-'}</td>
                        <td className="py-3 text-theme-primary">{record.head_circumference_cm || record.head_circumference || '-'}</td>
                        <td className="py-3 text-theme-secondary max-w-[220px] truncate">{record.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </main>
      </div>
    </div>
  );
}
