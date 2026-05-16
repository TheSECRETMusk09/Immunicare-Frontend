import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";
import { LoadingSpinner, Alert } from "./UI";











const getStatusColor = (status) => {
  switch (status) {
    case "up_to_date":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "on_track":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "behind":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "up_to_date":
      return "✓";
    case "on_track":
      return "●";
    case "behind":
      return "⚠";
    default:
      return "○";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "up_to_date":
      return "Up to Date";
    case "on_track":
      return "On Track";
    case "behind":
      return "Behind Schedule";
    default:
      return "Unknown";
  }
};

export default function ImmunizationStatusSummary({ infantId, compact = false, showDetails = true }) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!infantId) {
      setStatusData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await apiClient.getScheduleStatus(infantId);

      if (result.error) {
        setError(result.error);
        setStatusData(null);
      } else {
        setStatusData(result);
      }
    } catch (err) {
      setError(err.message || "Failed to load status");
      setStatusData(null);
    } finally {
      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    void fetchStatus();
  }, [infantId, fetchStatus]);

  // Listen for background updates to refresh status numbers instantly
  useEffect(() => {
    if (!infantId) return;

    const handleUpdate = (e) => {
      const detailId = Number(e?.detail?.patient_id || e?.detail?.infant_id || e?.detail?.child_id);
      if (!detailId || detailId === Number(infantId)) {
        void fetchStatus();
      }
    };

    window.addEventListener("vaccination-update", handleUpdate);
    window.addEventListener("vaccination-readiness-update", handleUpdate);
    return () => {
      window.removeEventListener("vaccination-update", handleUpdate);
      window.removeEventListener("vaccination-readiness-update", handleUpdate);
    };
  }, [infantId, fetchStatus]);

  if (loading) {
    if (compact) {
      return(
        <div className="flex items-center justify-center p-4">
          <LoadingSpinner size="sm" />
        </div>)
       ;
    }
    return(
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="md" />
        <span className="mt-2 text-sm text-gray-500">Loading status...</span>
      </div>)
     ;
  }

  if (error) {
    if (compact) {
      return(
        <div className="text-red-500 text-sm p-2">
          Error loading status
        </div>)
       ;
    }
    return(
      <Alert variant="error" title="Error">
        {error}
      </Alert>)
     ;
  }

  if (!statusData) {
    return null;
  }

  const { overallStatus, totalScheduled, completedCount, overdueCount, upcomingCount, completionPercentage } = statusData;

  if (compact) {
    return(
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(overallStatus)}`}>
          {getStatusIcon(overallStatus)} {getStatusLabel(overallStatus)}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {completedCount}/{totalScheduled} completed
        </span>
        {overdueCount > 0 &&(
          <span className="text-xs text-red-600 font-medium">
            ({overdueCount} overdue)
          </span>)
         }
      </div>)
     ;
  }

  return(
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Vaccination Status
        </h3>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(overallStatus)}`}>
          {getStatusIcon(overallStatus)} {getStatusLabel(overallStatus)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">Completion</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              overallStatus === 'behind' ? 'bg-red-500' :
              overallStatus === 'up_to_date' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalScheduled}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Due</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedCount}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Overdue</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{upcomingCount}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Upcoming (2 weeks)</div>
        </div>
      </div>

      {/* Alert for overdue */}
      {overdueCount > 0 && showDetails &&(
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {overdueCount} vaccine{overdueCount > 1 ? 's are' : ' is'} overdue
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Please schedule an appointment as soon as possible.
              </p>
            </div>
          </div>
        </div>)
       }

      {/* Upcoming alert */}
      {upcomingCount > 0 && overdueCount === 0 && showDetails &&(
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <span className="text-yellow-500 mr-2">⏰</span>
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                {upcomingCount} vaccine{upcomingCount > 1 ? 's are' : ' is'} due soon
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Due within the next 2 weeks.
              </p>
            </div>
          </div>
        </div>)
       }

      {/* All complete celebration */}
      {overallStatus === 'up_to_date' &&(
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                All vaccinations are up to date!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Great job keeping your child protected.
              </p>
            </div>
          </div>
        </div>)
       }
    </div>)
   ;
}