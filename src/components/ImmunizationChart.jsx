import React, { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Modal } from "./UI";
import VisitRecordingForm from "./VisitRecordingForm";
import {
  normalizeInfantResponse,
  normalizeVaccinationRecordsResponse,
  toArrayPayload,
} from "../utils/adminDataAdapters";

const toFiniteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAppointmentsResponse = (response) =>
  toArrayPayload(response, ["appointments"]).map((entry) => ({
    ...entry,
    id: toFiniteNumber(entry?.id),
    type: entry?.type ?? entry?.appointment_type ?? "",
    scheduled_date:
      entry?.scheduled_date ?? entry?.appointment_date ?? entry?.date ?? null,
    status: entry?.status ?? "pending",
    notes: entry?.notes ?? entry?.remarks ?? "",
  }));

const normalizeGrowthRecordsResponse = (response) =>
  toArrayPayload(response, ["growthRecords", "records", "growth"]).map((entry) => ({
    ...entry,
    id: toFiniteNumber(entry?.id),
    age_in_days: toFiniteNumber(entry?.age_in_days, 0),
    heart_rate: toFiniteNumber(entry?.heart_rate, null),
    respiratory_rate: toFiniteNumber(entry?.respiratory_rate, null),
    temperature_celsius: toFiniteNumber(entry?.temperature_celsius, null),
    length_cm: toFiniteNumber(entry?.length_cm, null),
    weight_kg: toFiniteNumber(entry?.weight_kg, null),
    feeding_status: entry?.feeding_status ?? null,
  }));

export default function ImmunizationChart({ infantId }) {
  const [infant, setInfant] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [growthRecords, setGrowthRecords] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [error, setError] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const saveSuccessTimeoutRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveSuccessTimeoutRef.current) {
        window.clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);

  const visitTemplates = [
    {
      age: "6 WEEKS",
      title: "6 Weeks Visit",
      vaccines: ["PENTA 1 / HEXA 1", "OPV 1", "PCV 1"],
      fields: [
        "hr",
        "rr",
        "temp",
        "height",
        "weight",
        "breastfeeding",
        "remarks",
      ],
    },
    {
      age: "10 WEEKS",
      title: "10 Weeks Visit",
      vaccines: ["PENTA 2 / HEXA 2", "OPV 2", "PCV 2"],
      fields: [
        "hr",
        "rr",
        "temp",
        "height",
        "weight",
        "breastfeeding",
        "remarks",
      ],
    },
    {
      age: "14 WEEKS",
      title: "14 Weeks Visit",
      vaccines: ["PENTA 3 / HEXA 3", "OPV 3", "PCV 3", "IPV 1"],
      fields: [
        "hr",
        "rr",
        "temp",
        "height",
        "weight",
        "breastfeeding",
        "remarks",
      ],
    },
    {
      age: "6 MONTHS",
      title: "6 Months Visit",
      vaccines: ["VIT. A"],
      fields: [
        "hr",
        "rr",
        "temp",
        "height",
        "weight",
        "breastfeeding",
        "remarks",
      ],
    },
    {
      age: "9 MONTHS",
      title: "9 Months Visit",
      vaccines: ["MCV 1", "IPV 2"],
      fields: [
        "hr",
        "rr",
        "temp",
        "height",
        "weight",
        "breastfeeding",
        "remarks",
      ],
    },
    {
      age: "12 MONTHS",
      title: "12 Months Visit",
      vaccines: ["MCV 2"],
      fields: [
        "hr",
        "rr",
        "temp",
        "height",
        "weight",
        "breastfeeding",
        "remarks",
      ],
    },
  ];

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!infantId) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setInfant(null);
      setAppointments([]);
      setGrowthRecords([]);
      setVaccinations([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [
        infantResult,
        appointmentsResult,
        growthResult,
        vaccinationResult,
      ] = await Promise.allSettled([
        apiClient.getInfant(infantId),
        apiClient.getAppointmentsByInfant(infantId),
        apiClient.getGrowthRecordsByInfant(infantId),
        apiClient.getVaccinationRecordsByInfant(infantId),
      ]);

      if (infantResult.status !== "fulfilled") {
        throw infantResult.reason || new Error("Failed to load infant details.");
      }

      const normalizedInfant = normalizeInfantResponse(infantResult.value);

      const normalizedAppointments =
        appointmentsResult.status === "fulfilled"
          ? normalizeAppointmentsResponse(appointmentsResult.value)
          : [];

      const normalizedGrowthRecords =
        growthResult.status === "fulfilled"
          ? normalizeGrowthRecordsResponse(growthResult.value)
          : [];

      const normalizedVaccinations =
        vaccinationResult.status === "fulfilled"
          ? normalizeVaccinationRecordsResponse(vaccinationResult.value)
          : [];

      const partialFailures = [];
      if (appointmentsResult.status === "rejected") {
        partialFailures.push("appointments");
      }
      if (growthResult.status === "rejected") {
        partialFailures.push("growth records");
      }
      if (vaccinationResult.status === "rejected") {
        partialFailures.push("vaccination records");
      }

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setInfant(normalizedInfant);
      setAppointments(normalizedAppointments);
      setGrowthRecords(normalizedGrowthRecords);
      setVaccinations(normalizedVaccinations);

      if (partialFailures.length > 0) {
        setError(
          `Some chart data could not be loaded (${partialFailures.join(", ")}). Showing available information.`,
        );
      }
    } catch (err) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(err.message || "Failed to load immunization chart.");
      setInfant(null);
      setAppointments([]);
      setGrowthRecords([]);
      setVaccinations([]);
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    if (!infantId) {
      setInfant(null);
      setAppointments([]);
      setGrowthRecords([]);
      setVaccinations([]);
      setError(null);
      setLoading(false);
      return;
    }

    void fetchData();
  }, [infantId, fetchData]);

  const getVisitData = (visitAge) => {
    const appointment = appointments.find((app) =>
      app.type?.includes(visitAge.toLowerCase()),
    );
    const growth = growthRecords.find((g) => {
      const ageInWeeks = Math.floor(g.age_in_days / 7);
      return visitAge === "6 WEEKS"
        ? ageInWeeks >= 5 && ageInWeeks <= 7
        : visitAge === "10 WEEKS"
          ? ageInWeeks >= 9 && ageInWeeks <= 11
          : visitAge === "14 WEEKS"
            ? ageInWeeks >= 13 && ageInWeeks <= 15
            : visitAge === "6 MONTHS"
              ? ageInWeeks >= 24 && ageInWeeks <= 28
              : visitAge === "9 MONTHS"
                ? ageInWeeks >= 36 && ageInWeeks <= 40
                : visitAge === "12 MONTHS"
                  ? ageInWeeks >= 48 && ageInWeeks <= 56
                  : false;
    });

    return { appointment, growth };
  };

  const getVaccinesForVisit = (visitAge) => {
    return vaccinations.filter((v) => {
      const adminDate = new Date(v.admin_date);
      const infantDob = new Date(infant.dob);
      const ageInWeeks = Math.floor(
        (adminDate - infantDob) / (7 * 24 * 60 * 60 * 1000),
      );

      return visitAge === "6 WEEKS"
        ? ageInWeeks >= 5 && ageInWeeks <= 7
        : visitAge === "10 WEEKS"
          ? ageInWeeks >= 9 && ageInWeeks <= 11
          : visitAge === "14 WEEKS"
            ? ageInWeeks >= 13 && ageInWeeks <= 15
            : visitAge === "6 MONTHS"
              ? ageInWeeks >= 24 && ageInWeeks <= 28
              : visitAge === "9 MONTHS"
                ? ageInWeeks >= 36 && ageInWeeks <= 40
                : visitAge === "12 MONTHS"
                  ? ageInWeeks >= 48 && ageInWeeks <= 56
                  : false;
    });
  };

  const openVisitModal = (visit) => {
    setSelectedVisit(visit);
    setShowVisitModal(true);
  };

  const handleVisitSave = async (visitData) => {
    if (!isMountedRef.current) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      // Save growth record
      if (visitData.growth) {
        await apiClient.createGrowthRecord({
          infant_id: infantId,
          measurement_date: visitData.visit_date,
          age_in_days: Math.floor(
            (new Date(visitData.visit_date) - new Date(infant.dob)) /
              (24 * 60 * 60 * 1000),
          ),
          weight_kg: parseFloat(visitData.growth.weight) || null,
          length_cm: parseFloat(visitData.growth.height) || null,
          head_circumference_cm:
            parseFloat(visitData.growth.head_circumference) || null,
          temperature_celsius: parseFloat(visitData.growth.temperature) || null,
          heart_rate: parseInt(visitData.growth.heart_rate) || null,
          respiratory_rate: parseInt(visitData.growth.respiratory_rate) || null,
          feeding_status: visitData.growth.breastfeeding
            ? "breastfeeding"
            : "not_breastfeeding",
          health_status: "well",
          measured_by: 1, // Current user ID would be dynamic in real app
          notes: visitData.remarks || "",
        });
      }

      // Save vaccination records
      if (visitData.vaccines && visitData.vaccines.length > 0) {
        const vaccines = toArrayPayload(await apiClient.getVaccines(), ["vaccines"]);
        const batches = toArrayPayload(await apiClient.getVaccineBatches(), ["batches"]);

        for (const vaccineName of visitData.vaccines) {
          if (vaccineName.administered) {
            const vaccine = vaccines.find((v) =>
              v.name
                .toLowerCase()
                .includes(vaccineName.name.toLowerCase().split(" ")[0]),
            );

            if (vaccine) {
              const batch = batches.find(
                (b) => b.vaccine_id === vaccine.id && b.qty_current > 0,
              );

              if (batch) {
                await apiClient.createVaccinationRecord({
                  infant_id: infantId,
                  vaccine_id: vaccine.id,
                  batch_id: batch.id,
                  dose_no: 1, // This would be calculated based on previous doses
                  admin_date: visitData.visit_date,
                  vaccinator_id: 1, // Current user ID would be dynamic
                  notes: `Administered during ${visitData.visit_age} visit`,
                });
              }
            }
          }
        }
      }

      // Refresh data
      await fetchData();

      if (!isMountedRef.current) {
        return;
      }

      setShowVisitModal(false);
      setSaveSuccess(true);
      // Auto-hide success message after 3 seconds
      if (saveSuccessTimeoutRef.current) {
        window.clearTimeout(saveSuccessTimeoutRef.current);
      }
      saveSuccessTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setSaveSuccess(false);
        }
      }, 3000);
    } catch (error) {
      console.error("Error saving visit record:", error);

      if (!isMountedRef.current) {
        return;
      }

      setSaveError(
        error.message || "Failed to save visit record. Please try again.",
      );
    } finally {
      if (!isMountedRef.current) {
        return;
      }

      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">Loading immunization chart...</div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  if (!infant) {
    return (
      <div className="text-center py-8 text-gray-500">Infant not found</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Immunization Chart
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Detailed visit records for {infant.first_name} {infant.last_name}
          </p>
          {/* Success/Error Messages */}
          {saveSuccess && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">
                Visit record saved successfully!
              </p>
            </div>
          )}
          {saveError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            </div>
          )}
        </div>

        {/* Personal Information Header */}
        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Name:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {infant.last_name}, {infant.first_name}{" "}
                {infant.middle_name || ""}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                DOB:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {new Date(infant.dob).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Birth Weight:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {infant.birth_weight ? `${infant.birth_weight} kg` : "N/A"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Place of Birth:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {infant.place_of_birth || "N/A"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Mother:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {infant.mother_name || "N/A"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Age:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {Math.floor(
                  (new Date() - new Date(infant.dob)) /
                    (365.25 * 24 * 60 * 60 * 1000),
                )}{" "}
                years
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                BCG:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {vaccinations.find((v) => v.vaccine_name?.includes("BCG"))
                  ? "✓"
                  : "○"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Gender:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {infant.sex === "M" ? "Male" : "Female"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Hepa B:
              </span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {vaccinations.find(
                  (v) =>
                    v.vaccine_name?.includes("Hepa") ||
                    v.vaccine_name?.includes("Hepatitis B"),
                )
                  ? "✓"
                  : "○"}
              </span>
            </div>
          </div>
        </div>

        {/* Visit Records */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {visitTemplates.map((visit, index) => {
            const visitData = getVisitData(visit.age);
            const visitVaccines = getVaccinesForVisit(visit.age);

            return (
              <div
                key={visit.age}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {visit.title}
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => openVisitModal(visit)}
                    variant={visitData.appointment ? "secondary" : "primary"}
                  >
                    {visitData.appointment ? "View/Edit" : "Record Visit"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vital Signs */}
                  <div>
                    <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      VITAL SIGNS
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>HR:</span>
                        <span>
                          {visitData.growth?.heart_rate
                            ? `${visitData.growth.heart_rate} bpm`
                            : "Not recorded"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>RR:</span>
                        <span>
                          {visitData.growth?.respiratory_rate
                            ? `${visitData.growth.respiratory_rate} rpm`
                            : "Not recorded"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Temp:</span>
                        <span>
                          {visitData.growth?.temperature_celsius
                            ? `${visitData.growth.temperature_celsius}°C`
                            : "Not recorded"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>HT:</span>
                        <span>
                          {visitData.growth?.length_cm
                            ? `${visitData.growth.length_cm} cm`
                            : "Not recorded"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>WT:</span>
                        <span>
                          {visitData.growth?.weight_kg
                            ? `${visitData.growth.weight_kg} kg`
                            : "Not recorded"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>BREASTFEEDING?</span>
                        <span>
                          {visitData.growth?.feeding_status === "breastfeeding"
                            ? "Y"
                            : "N"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>TCB:</span>
                        <span>Not recorded</span>
                      </div>
                    </div>
                  </div>

                  {/* Vaccines */}
                  <div>
                    <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      VACCINES
                    </h5>
                    <div className="space-y-2 text-sm">
                      {visit.vaccines.map((vaccine) => (
                        <div key={vaccine} className="flex justify-between">
                          <span>{vaccine}:</span>
                          <span>
                            {visitVaccines.find((v) =>
                              v.vaccine_name
                                ?.toLowerCase()
                                .includes(vaccine.toLowerCase().split(" ")[0]),
                            )
                              ? "✓"
                              : "○"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm">
                        <span>Others/Remarks:</span>
                        <span className="text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {visitData.appointment?.notes || "No remarks"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {visitData.appointment && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Visit Date:{" "}
                      {new Date(
                        visitData.appointment.scheduled_date,
                      ).toLocaleDateString()}
                      {visitData.appointment.status &&
                        ` • Status: ${visitData.appointment.status}`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Catch-up Section */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700">
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
              CATCH UP
            </h4>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Catch-up vaccination records and notes will appear here...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visit Modal */}
      <Modal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        title={
          selectedVisit
            ? `${selectedVisit.title} - Record Visit`
            : "Record Visit"
        }
        size="lg"
      >
        {saving && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving visit record...
            </p>
          </div>
        )}
        {selectedVisit && (
          <VisitRecordingForm
            infant={infant}
            visit={selectedVisit}
            onClose={() => setShowVisitModal(false)}
            onSave={handleVisitSave}
            disabled={saving}
          />
        )}
      </Modal>
    </div>
  );
}
