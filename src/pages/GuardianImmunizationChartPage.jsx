import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import GuardianImmunizationChart from "../components/GuardianImmunizationChart";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import { LoadingSpinner, Alert, Button } from "../components/UI";
import { FileCheck, ChevronDown } from "lucide-react";

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
      {selectedChild && (
        <div className="guardian-chart-scroll-container bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
          <GuardianImmunizationChart infantId={selectedChild.id} />
        </div>
      )}
      </main>
    </div>
  );
}
