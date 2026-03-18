import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import GuardianImmunizationChart from "../components/GuardianImmunizationChart";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import { LoadingSpinner, Alert, Button } from "../components/UI";
import { FileCheck, ChevronDown, Activity } from "lucide-react";

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
      // Handle both direct array response and wrapped response
      const childrenData = Array.isArray(response)
        ? response
        : response?.data || response || [];
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

  // Fetch growth records when switching to growth tab
  useEffect(() => {
    if (activeTab === "growth" && selectedChild?.id) {
      fetchGrowthRecords(selectedChild.id);
    }
  }, [activeTab, selectedChild?.id, fetchGrowthRecords]);

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
      <GuardianModuleHeader
        title="Immunization Chart"
        subtitle="View your child's vaccination records and schedule"
        icon={<FileCheck className="w-8 h-8 text-white" />}
      />

      <main className="guardian-page-content space-y-4 sm:space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-theme-bg-card rounded-xl p-1 border border-theme-border-primary">
        <button
          type="button"
          onClick={() => setActiveTab("immunization")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
            activeTab === "immunization"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-theme-secondary hover:bg-theme-bg-hover"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Immunization Chart
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("growth")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
            activeTab === "growth"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-theme-secondary hover:bg-theme-bg-hover"
          }`}
        >
          <Activity className="w-4 h-4" />
          Growth Charts
        </button>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
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
                  onClick={() => {
                    setSelectedChild(child);
                    setShowDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-theme-bg-hover transition-colors ${
                    selectedChild?.id === child.id
                      ? "bg-theme-bg-active"
                      : ""
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

      {/* Immunization Chart */}
      {selectedChild && activeTab === "immunization" && (
        <div className="guardian-chart-scroll-container bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
          <GuardianImmunizationChart
            childId={selectedChild.id}
            onViewFullChart={() => navigate(`/guardian/immunization-chart/${selectedChild.id}`)}
          />
        </div>
      )}

      {/* Growth Charts Section */}
      {selectedChild && activeTab === "growth" && (
        <div className="space-y-4">
          {/* Latest Measurements Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Weight</p>
              <p className="text-2xl font-bold text-theme-primary mt-2">
                {growthRecords.length > 0 ? `${growthRecords[0]?.weight_kg || growthRecords[0]?.weight || '-'} kg` : '-'}
              </p>
            </div>
            <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Height</p>
              <p className="text-2xl font-bold text-theme-primary mt-2">
                {growthRecords.length > 0 ? `${growthRecords[0]?.length_cm || growthRecords[0]?.height || growthRecords[0]?.length || '-'} cm` : '-'}
              </p>
            </div>
            <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Head Circumference</p>
              <p className="text-2xl font-bold text-theme-primary mt-2">
                {growthRecords.length > 0 ? `${growthRecords[0]?.head_circumference_cm || growthRecords[0]?.head_circumference || '-'} cm` : '-'}
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
            ) : growthRecords.length === 0 ? (
              <div className="py-10 text-center text-theme-secondary">
                No growth records yet for this child.
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                    {growthRecords.map((record) => (
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
  );
}
