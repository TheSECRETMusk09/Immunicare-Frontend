import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Button,
  PageHeader,
  Card,
  Alert,
  LoadingSpinner,
} from "../../components/UI";
import ImmunizationChart from "../../components/ImmunizationChart";
import InfantPersonalRecord from "../../components/InfantPersonalRecord";
import apiClient from "../../utils/api";
import { normalizeInfantResponse } from "../../utils/adminDataAdapters";
import { BarChart3 } from "lucide-react";

export default function ImmunizationChartPage() {
  const { infantId } = useParams();
  const { isGuardian, isAdmin } = useAuth();
  const [infant, setInfant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("chart");

  const fetchInfant = useCallback(async () => {
    if (!infantId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await apiClient.getInfant(
        isAdmin ? `${infantId}?scope=system` : infantId,
      );
      setInfant(normalizeInfantResponse(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [infantId, isAdmin]);

  useEffect(() => {
    fetchInfant();
  }, [fetchInfant]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading immunization chart..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="danger">
          <p>Error loading immunization chart: {error}</p>
        </Alert>
        <Button onClick={fetchInfant} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="immunization-chart-page space-y-6 p-6">
      {/* Header */}
      <div className="no-print immunization-chart-page__screen-only">
        <PageHeader
          title="Immunization Chart"
          subtitle={
            infant
              ? `Visit records for ${infant.first_name} ${infant.last_name}`
              : "Detailed visit records with vital signs and vaccines"
          }
          icon={<BarChart3 className="w-6 h-6" />}
        />
      </div>

      {/* Infant Summary Card */}
      {infant && (
        <Card className="no-print immunization-chart-page__screen-only p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-2xl">
                👶
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {infant.first_name} {infant.middle_name || ""}{" "}
                  {infant.last_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  DOB: {new Date(infant.dob).toLocaleDateString()} •{" "}
                  {infant.sex === "M" ? "Male" : "Female"} • Birth Weight:{" "}
                  {infant.birth_weight || "N/A"} kg
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeSection === "chart" ? "primary" : "secondary"}
                onClick={() => setActiveSection("chart")}
              >
                📊 Chart
              </Button>
              <Button
                size="sm"
                variant={activeSection === "personal" ? "primary" : "secondary"}
                onClick={() => setActiveSection("personal")}
              >
                👤 Personal Info
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Section Navigation for Infant */}
      {infantId && (
        <div className="no-print immunization-chart-page__screen-only flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          <Button
            variant={activeSection === "chart" ? "primary" : "ghost"}
            onClick={() => setActiveSection("chart")}
            size="sm"
          >
            📊 Immunization Chart
          </Button>
          <Button
            variant={activeSection === "personal" ? "primary" : "ghost"}
            onClick={() => setActiveSection("personal")}
            size="sm"
          >
            👤 Personal Information
          </Button>
        </div>
      )}

      {/* Content Based on Selection */}
      {infantId ? (
        <>
          {activeSection === "chart" && (
            <div className="immunization-chart-page__chart-panel">
              <ImmunizationChart infantId={infantId} />
            </div>
          )}
          {activeSection === "personal" && (
            <InfantPersonalRecord
              infantId={infantId}
              onUpdate={fetchInfant}
              readOnly={isGuardian}
            />
          )}
        </>
      ) : (
        <Alert variant="info">
          <p className="font-medium">Select an Infant</p>
          <p className="mt-1">
            Please select an infant to view their immunization chart, or
            navigate from the Infant Management page.
          </p>
        </Alert>
      )}

      {/* Visit Schedule Reference */}
      <Card className="no-print immunization-chart-page__screen-only p-6 bg-gray-50 dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          📅 Standard Visit Schedule
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div className="text-center p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              6 Weeks
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              PENTA 1, OPV 1, PCV 1
            </p>
          </div>
          <div className="text-center p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <p className="font-medium text-green-900 dark:text-green-100">
              10 Weeks
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              PENTA 2, OPV 2, PCV 2
            </p>
          </div>
          <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <p className="font-medium text-yellow-900 dark:text-yellow-100">
              14 Weeks
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              PENTA 3, OPV 3, PCV 3, IPV 1
            </p>
          </div>
          <div className="text-center p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <p className="font-medium text-purple-900 dark:text-purple-100">
              6 Months
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              VIT. A
            </p>
          </div>
          <div className="text-center p-3 bg-red-100 dark:bg-red-900 rounded-lg">
            <p className="font-medium text-red-900 dark:text-red-100">
              9 Months
            </p>
            <p className="text-xs text-red-700 dark:text-red-300">
              MCV 1, IPV 2
            </p>
          </div>
          <div className="text-center p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
            <p className="font-medium text-indigo-900 dark:text-indigo-100">
              12 Months
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              MCV 2
            </p>
          </div>
        </div>
      </Card>

      <style>{`
        @media print {
          .immunization-chart-page {
            padding: 0 !important;
            background: #ffffff !important;
          }

          .immunization-chart-page__screen-only {
            display: none !important;
          }

          .immunization-chart-page__chart-panel {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
