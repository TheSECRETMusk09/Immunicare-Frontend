import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, ChevronDown } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import { Alert, Button, LoadingSpinner } from "../components/UI";
import { toArrayPayload } from "../utils/adminDataAdapters";
import { trackEvent } from "../utils/telemetry";

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeGrowthRecords = (response) =>
  toArrayPayload(response, ["growthRecords", "records", "growth"]).map((entry) => ({
    ...entry,
    id: toFiniteNumber(entry?.id),
    measurement_date:
      entry?.measurement_date ?? entry?.date ?? entry?.recorded_at ?? null,
    weight_kg: toFiniteNumber(entry?.weight_kg ?? entry?.weight),
    length_cm: toFiniteNumber(entry?.length_cm ?? entry?.height),
    head_circumference_cm: toFiniteNumber(entry?.head_circumference_cm),
    temperature_celsius: toFiniteNumber(entry?.temperature_celsius),
    heart_rate: toFiniteNumber(entry?.heart_rate),
    respiratory_rate: toFiniteNumber(entry?.respiratory_rate),
    feeding_status: entry?.feeding_status ?? null,
    notes: entry?.notes ?? "",
  }));

const formatMeasurementDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const formatMetric = (value, unit) => {
  if (value === null || value === undefined || value === "") return "-";
  return `${value} ${unit}`.trim();
};

const computeBmi = (weightKg, lengthCm) => {
  if (!Number.isFinite(weightKg) || !Number.isFinite(lengthCm) || lengthCm <= 0) {
    return "-";
  }

  const heightMeters = lengthCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);
  if (!Number.isFinite(bmi)) return "-";
  return bmi.toFixed(1);
};

export default function GuardianGrowthChartPage() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { guardianId } = useAuth();

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [growthRecords, setGrowthRecords] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchChildren = useCallback(async () => {
    if (!guardianId) {
      setLoadingChildren(false);
      return;
    }

    try {
      setLoadingChildren(true);
      setError(null);

      const response = await apiClient.getInfantsByGuardian(guardianId);
      const childrenData = toArrayPayload(response, ["infants", "patients"]);

      setChildren(childrenData);

      if (childrenData.length === 0) {
        setSelectedChild(null);
        return;
      }

      if (childId) {
        const requestedChild = childrenData.find(
          (entry) => entry.id === Number(childId),
        );
        setSelectedChild(requestedChild || childrenData[0]);
      } else {
        setSelectedChild(childrenData[0]);
      }
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load children.");
      setChildren([]);
      setSelectedChild(null);
    } finally {
      setLoadingChildren(false);
    }
  }, [guardianId, childId]);

  const fetchGrowthRecords = useCallback(async (targetChildId) => {
    if (!targetChildId) {
      setGrowthRecords([]);
      return;
    }

    try {
      setLoadingGrowth(true);
      setError(null);
      const response = await apiClient.getGrowthRecordsByInfant(targetChildId);
      const normalized = normalizeGrowthRecords(response).sort((left, right) => {
        const leftTs = new Date(left.measurement_date || 0).getTime();
        const rightTs = new Date(right.measurement_date || 0).getTime();
        return rightTs - leftTs;
      });
      setGrowthRecords(normalized);
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load growth chart data.");
      setGrowthRecords([]);
    } finally {
      setLoadingGrowth(false);
    }
  }, []);

  useEffect(() => {
    void fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (!selectedChild?.id) {
      setGrowthRecords([]);
      return;
    }

    void fetchGrowthRecords(selectedChild.id);
  }, [selectedChild?.id, fetchGrowthRecords]);

  useEffect(() => {
    if (!childId || children.length === 0) return;

    const routeChild = children.find((entry) => entry.id === Number(childId));
    if (routeChild && routeChild.id !== selectedChild?.id) {
      setSelectedChild(routeChild);
    }
  }, [childId, children, selectedChild?.id]);

  useEffect(() => {
    if (selectedChild) {
      trackEvent("growth_chart_viewed", { childId: selectedChild.id });
    }
  }, [selectedChild]);

  const latestRecord = useMemo(() => {
    if (!growthRecords.length) return null;
    return growthRecords[0];
  }, [growthRecords]);

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    setShowDropdown(false);
    navigate(`/guardian/health-charts/${child.id}`);
  };

  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Children Registered
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need to register your children first to view their growth charts.
          </p>
          <Button onClick={() => navigate("/guardian/children")}>Register Child</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="guardian-page-wrapper min-h-screen bg-theme-bg-primary transition-colors duration-200">
      <GuardianModuleHeader
        title="Infant Growth Chart"
        subtitle="Track your child\'s growth measurements and milestones"
        icon={<Activity className="w-8 h-8 text-white" />}
      />

      <main className="guardian-page-content space-y-4 sm:space-y-6">
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {children.length > 1 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-theme-bg-secondary flex items-center justify-center">
                  <span className="text-lg">
                    {selectedChild?.sex === "M" ? "👦" : "👧"}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-theme-primary">
                    {selectedChild?.first_name} {selectedChild?.last_name}
                  </p>
                  <p className="text-sm text-theme-secondary">
                    Click to select a different child
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  showDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-theme-bg-card rounded-xl shadow-lg border border-theme-border-primary z-10 overflow-hidden">
                {children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => handleSelectChild(child)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-theme-bg-hover transition-colors ${
                      selectedChild?.id === child.id ? "bg-theme-bg-active" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-theme-bg-secondary flex items-center justify-center">
                      <span>{child.sex === "M" ? "👦" : "👧"}</span>
                    </div>
                    <span className="font-medium text-theme-primary">
                      {child.first_name} {child.last_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
            <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Weight</p>
            <p className="text-2xl font-bold text-theme-primary mt-2">
              {latestRecord ? formatMetric(latestRecord.weight_kg, "kg") : "-"}
            </p>
          </div>
          <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
            <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Height</p>
            <p className="text-2xl font-bold text-theme-primary mt-2">
              {latestRecord ? formatMetric(latestRecord.length_cm, "cm") : "-"}
            </p>
          </div>
          <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
            <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest BMI</p>
            <p className="text-2xl font-bold text-theme-primary mt-2">
              {latestRecord
                ? computeBmi(latestRecord.weight_kg, latestRecord.length_cm)
                : "-"}
            </p>
          </div>
        </div>

        <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-theme-primary mb-4">Growth History</h3>

          {loadingGrowth ? (
            <div className="py-10 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : growthRecords.length === 0 ? (
            <div className="py-10 text-center text-theme-secondary">
              No growth records yet for this child.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-theme-border-primary">
                    <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">
                      Date
                    </th>
                    <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">
                      Weight
                    </th>
                    <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">
                      Height
                    </th>
                    <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">
                      BMI
                    </th>
                    <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">
                      Head Circ.
                    </th>
                    <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {growthRecords.map((record) => (
                    <tr key={record.id || `${record.measurement_date}-${record.weight_kg}`} className="border-b border-theme-border-primary/60">
                      <td className="py-3 text-theme-primary">
                        {formatMeasurementDate(record.measurement_date)}
                      </td>
                      <td className="py-3 text-theme-primary">
                        {formatMetric(record.weight_kg, "kg")}
                      </td>
                      <td className="py-3 text-theme-primary">
                        {formatMetric(record.length_cm, "cm")}
                      </td>
                      <td className="py-3 text-theme-primary">
                        {computeBmi(record.weight_kg, record.length_cm)}
                      </td>
                      <td className="py-3 text-theme-primary">
                        {formatMetric(record.head_circumference_cm, "cm")}
                      </td>
                      <td className="py-3 text-theme-secondary max-w-[220px] truncate">
                        {record.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
