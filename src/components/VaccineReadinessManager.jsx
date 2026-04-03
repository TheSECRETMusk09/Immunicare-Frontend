import React, { useState, useEffect, useCallback } from "react";
import { Button, Modal, Select, Alert } from "./UI";
import apiClient from "../utils/api";
import { Check, X, Clock, AlertCircle, Lock, Unlock, RefreshCw } from "lucide-react";

/**
 * VaccineReadinessManager Component
 *
 * Admin component for managing infant vaccine readiness
 * - View all vaccines and their readiness status
 * - Confirm/deny infant readiness for specific vaccines
 * - Batch confirm multiple vaccines at once
 * - Track inventory availability
 */

export default function VaccineReadinessManager({ infantId, infantName, isOpen, onClose, onSuccess }) {
  const [infants, setInfants] = useState([]);
  const [selectedInfantId, setSelectedInfantId] = useState(infantId || "");
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch infants list
  const fetchInfants = useCallback(async () => {
    try {
      const response = await apiClient.getInfants({ limit: 1500 });
      const infantsData = Array.isArray(response) ? response : response?.data || [];
      setInfants(infantsData);
    } catch (err) {
      console.error("Error fetching infants:", err);
    }
  }, []);

  // Fetch schedule data for selected infant
  const fetchScheduleData = useCallback(async (targetInfantId) => {
    if (!targetInfantId) {
      setScheduleData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getInfantVaccineReadiness(targetInfantId);
      setScheduleData(response);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      setError(err.message || "Failed to load vaccination schedule");
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchInfants();
      if (infantId) {
        setSelectedInfantId(infantId);
      }
    }
  }, [isOpen, fetchInfants, infantId]);

  useEffect(() => {
    if (selectedInfantId && isOpen) {
      void fetchScheduleData(selectedInfantId);
    }
  }, [selectedInfantId, isOpen, fetchScheduleData]);

  const handleInfantChange = (e) => {
    const newInfantId = e.target.value;
    setSelectedInfantId(newInfantId);
    setError(null);
    setSuccess(null);
  };

  const handleConfirmReadiness = async (vaccineId, isReady, notes = "") => {
    if (!selectedInfantId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.setInfantVaccineReadiness(
        selectedInfantId,
        vaccineId,
        isReady,
        notes
      );

      setSuccess(response.message);

      // Refresh schedule data
      await fetchScheduleData(selectedInfantId);

      // Dispatch event to immediately update charts, status summary, and tables
      window.dispatchEvent(new CustomEvent("vaccination-readiness-update", {
        detail: { infant_id: selectedInfantId }
      }));

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || "Failed to update readiness status");
    } finally {
      setSaving(false);
    }
  };

  const handleBatchConfirm = async (vaccineIds, isReady, notes = "") => {
    if (!selectedInfantId || !vaccineIds.length) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.batchSetInfantVaccineReadiness(
        selectedInfantId,
        vaccineIds,
        isReady,
        notes
      );

      setSuccess(response.message);

      // Refresh schedule data
      await fetchScheduleData(selectedInfantId);

      // Dispatch event to immediately update charts, status summary, and tables
      window.dispatchEvent(new CustomEvent("vaccination-readiness-update", {
        detail: { infant_id: selectedInfantId }
      }));

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || "Failed to batch update readiness");
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    if (selectedInfantId) {
      void fetchScheduleData(selectedInfantId);
    }
  };

  // Group vaccines by status
  const getVaccinesByStatus = () => {
    const grouped = {
      completed: [],
      ready: [],
      pending_confirmation: [],
      upcoming: [],
      overdue: []
    };

    if (!scheduleData?.schedules) return grouped;

    scheduleData.schedules.forEach(schedule => {
      const status = schedule.status;
      if (grouped[status]) {
        grouped[status].push(schedule);
      }
    });

    return grouped;
  };

  const vaccinesByStatus = getVaccinesByStatus();

  // Get pending vaccines that can be confirmed
  const pendingVaccines = [
    ...(vaccinesByStatus.pending_confirmation || []),
    ...(vaccinesByStatus.ready || [])
  ];

  const getStatusBadge = (status) => {
    const config = {
      completed: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Completed", icon: Check },
      ready: { color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Ready", icon: Unlock },
      pending_confirmation: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", label: "Pending", icon: Lock },
      upcoming: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Upcoming", icon: Clock },
      overdue: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Overdue", icon: AlertCircle }
    };

    const conf = config[status] || config.upcoming;
    const Icon = conf.icon;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${conf.color}`}>
        <Icon size={12} className="mr-1" />
        {conf.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vaccine Readiness Manager"
      size="lg"
      transition={false}
      animation={false}
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto modern-scrollbar pr-2">
        {/* Error/Success Messages */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Infant Selection */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select
              label="Select Infant"
              name="infant_id"
              value={selectedInfantId}
              onChange={handleInfantChange}
              options={[
                { value: "", label: infantName || "Select Infant" },
                ...infants.map(infant => ({
                  value: infant.id,
                  label: `${infant.first_name} ${infant.last_name} (${infant.dob ? new Date(infant.dob).toLocaleDateString() : "N/A"})`
                }))
              ]}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || !selectedInfantId}
            className="mt-6"
          >
            <RefreshCw size={16} />
          </Button>
        </div>

        {/* Schedule Data */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading schedule...</p>
          </div>
        ) : selectedInfantId && scheduleData ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm">
                <span className="font-medium">Age:</span>{" "}
                {scheduleData.ageInDays} days
              </div>
              <div className="text-sm">
                <span className="font-medium">Total Vaccines:</span>{" "}
                {scheduleData.schedules?.length || 0}
              </div>
            </div>

            {/* Batch Actions */}
            {pendingVaccines.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                  {pendingVaccines.length} vaccine(s) ready for confirmation
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleBatchConfirm(
                      pendingVaccines.map(v => v.vaccineId),
                      true,
                      "Batch confirmed by admin"
                    )}
                    disabled={saving}
                  >
                    <Check size={16} className="mr-1" />
                    Confirm All Ready
                  </Button>
                </div>
              </div>
            )}

            {/* Vaccine List */}
            <div className="space-y-3">
              {scheduleData.schedules?.map((schedule) => (
                <div
                  key={`${schedule.vaccineId}-${schedule.doseNumber}`}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {schedule.vaccineName}
                        </h4>
                        {getStatusBadge(schedule.status)}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Dose {schedule.doseNumber} of {schedule.totalDoses} •{" "}
                        Due: {formatDate(schedule.dueDate)}
                      </p>
                      {schedule.status === "pending_confirmation" && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Infant is eligible but requires admin confirmation
                        </p>
                      )}
                      {schedule.status === "upcoming" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Infant is not yet eligible (minimum age: {schedule.minimumAgeDays} days)
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    {(schedule.status === "pending_confirmation" || schedule.status === "ready") && (
                      <Button
                        type="button"
                        variant={schedule.isReady ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => handleConfirmReadiness(
                          schedule.vaccineId,
                          !schedule.isReady,
                          schedule.isReady ? "Readiness revoked" : "Confirmed by admin"
                        )}
                        disabled={saving}
                      >
                        {schedule.isReady ? (
                          <>
                            <X size={14} className="mr-1" />
                            Revoke
                          </>
                        ) : (
                          <>
                            <Check size={14} className="mr-1" />
                            Confirm
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : selectedInfantId ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No vaccination schedule found for this infant
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Select an infant to manage vaccine readiness
          </div>
        )}
      </div>
    </Modal>
  );
}
