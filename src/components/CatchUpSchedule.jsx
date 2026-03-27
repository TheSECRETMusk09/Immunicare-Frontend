import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";
import { LoadingSpinner, Alert, Button } from "./UI";

const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getPriorityColor = (priority) => {
  if (priority <= 2) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (priority <= 4) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
};

export default function CatchUpSchedule({ infantId, onScheduleAppointment }) {
  const [catchUpData, setCatchUpData] = useState(null);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [error, setError] = useState(null);

  const fetchCatchUpSchedule = useCallback(async () => {
    if (!infantId) {
      setCatchUpData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await apiClient.getCatchUpSchedule(infantId);

      if (result.error) {
        setError(result.error);
        setCatchUpData(null);
      } else {
        setCatchUpData(result);
      }
    } catch (err) {
      setError(err.message || "Failed to load catch-up schedule");
      setCatchUpData(null);
    } finally {
      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    void fetchCatchUpSchedule();
  }, [infantId, fetchCatchUpSchedule]);

  useEffect(() => {
    if (!infantId) return;

    const handleUpdate = (e) => {
      const detailId = Number(e?.detail?.patient_id || e?.detail?.infant_id || e?.detail?.child_id);
      if (!detailId || detailId === Number(infantId)) {
        void fetchCatchUpSchedule();
      }
    };

    window.addEventListener("vaccination-update", handleUpdate);
    window.addEventListener("vaccination-readiness-update", handleUpdate);
    return () => {
      window.removeEventListener("vaccination-update", handleUpdate);
      window.removeEventListener("vaccination-readiness-update", handleUpdate);
    };
  }, [infantId, fetchCatchUpSchedule]);

  const handleScheduleAppointment = (vaccine) => {
    if (onScheduleAppointment) {
      onScheduleAppointment(vaccine);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="md" />
        <span className="mt-2 text-sm text-gray-500">Loading catch-up schedule...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title="Error loading catch-up schedule">
        {error}
      </Alert>
    );
  }

  if (!catchUpData) {
    return null;
  }

  // No catch-up needed
  if (!catchUpData.needsCatchUp) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Catch-Up Schedule
          </h3>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            ✓ On Track
          </span>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <span className="text-2xl">🎉</span>
          <p className="mt-2 text-green-800 dark:text-green-300">
            {catchUpData.message}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            All vaccinations are up to date!
          </p>
        </div>
      </div>
    );
  }

  const { items, totalOverdue, totalUpcoming } = catchUpData;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Catch-Up Schedule
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalOverdue} overdue + {totalUpcoming} upcoming
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          ⚠️ Action Required
        </span>
      </div>

      {/* Alert for overdue vaccines */}
      {totalOverdue > 0 && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <span className="text-red-500 mr-2">⚠️</span>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {totalOverdue} vaccine{totalOverdue > 1 ? 's are' : ' is'} overdue
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Priority: Schedule appointments as soon as possible
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Catch-up items list */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.vaccineId}-${item.doseNumber}`}
            className={`p-4 rounded-lg border ${
              item.isOverdue
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                    #{item.priority}
                  </span>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {item.vaccineName}
                  </h4>
                  <span className="text-sm text-gray-500">
                    Dose {item.doseNumber}/{item.totalDoses}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Original Due: </span>
                    <span className="text-gray-700 dark:text-gray-300">{formatDate(item.dueDate)}</span>
                  </div>
                  {item.recommendedDate && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Recommended: </span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {formatDate(item.recommendedDate)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                    item.isOverdue
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {item.catchUpReason}
                  </span>
                </div>
              </div>

              <div className="ml-4">
                <Button
                  size="sm"
                  variant={item.isOverdue ? "danger" : "secondary"}
                  onClick={() => handleScheduleAppointment(item)}
                >
                  📅 Schedule
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Note:</strong> This catch-up schedule prioritizes overdue vaccines.
          Multiple vaccines can be administered in a single visit if there are no contraindications.
          Please consult with your healthcare provider.
        </p>
      </div>
    </div>
  );
}
