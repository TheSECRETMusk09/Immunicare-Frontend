import React, { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Input, Alert, LoadingSpinner, Select } from "./UI";
import { useAuth } from "../contexts/AuthContext";
import { normalizeInfantResponse } from "../utils/adminDataAdapters";
import InfantDocuments from "./InfantDocuments";
import {
  PUROK_OPTIONS,
  getPurokStreetColorOptions,
} from "../constants/purokOptions";

const EDITABLE_INFANT_FIELDS = [
  "first_name",
  "last_name",
  "middle_name",
  "dob",
  "sex",
  "national_id",
  "address",
  "contact",
  "guardian_id",
  "mother_name",
  "father_name",
  "birth_weight",
  "birth_height",
  "place_of_birth",
  "barangay",
  "health_center",
  "family_no",
  "time_of_delivery",
  "type_of_delivery",
  "doctor_midwife_nurse",
  "nbs_done",
  "nbs_date",
  "cellphone_number",
  "facility_id",
  // NEW: allergy and health care provider fields
  "allergy_information",
  "health_care_provider",
  "purok",
  "street_color",
];

const sanitizeInfantUpdatePayload = (raw = {}) => {
  return EDITABLE_INFANT_FIELDS.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(raw, field)) {
      let value = raw[field];

      // Convert empty strings to null to avoid backend validation errors on dates/times/numbers
      if (value === "") {
        acc[field] = null;
      } else if (field === "birth_weight" || field === "birth_height") {
        acc[field] = value !== null ? Number(value) : null;
      } else {
        acc[field] = value;
      }
    }
    return acc;
  }, {});
};

const formatControlNumberDisplay = (controlNumber, dobValue) => {
  const base = String(controlNumber || "").trim();
  if (!base) return "Not assigned";

  const dob = dobValue ? new Date(dobValue) : null;
  if (!dob || Number.isNaN(dob.getTime())) {
    return base;
  }

  return `${base}-${dob.getMonth() + 1}/${dob.getDate()}/${dob.getFullYear()}`;
};

export default function InfantPersonalRecord({
  infantId,
  onUpdate,
  readOnly = false,
}) {
  const { isAdmin, isGuardian } = useAuth();
  const [infant, setInfant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchInfant = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getInfant(infantId);
      const normalizedInfant = normalizeInfantResponse(data);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setInfant(normalizedInfant);
      setFormData(normalizedInfant);
    } catch (err) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(err.message || "Failed to load infant record.");
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    if (infantId) {
      fetchInfant();
    }
  }, [infantId, fetchInfant]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Prevent submission for guardians
    if (isGuardian) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updatePayload = sanitizeInfantUpdatePayload(formData);
      const updateResponse = await apiClient.request(`/infants/${infantId}`, {
        method: "PUT",
        data: updatePayload
      });
      const updatedInfant = normalizeInfantResponse(updateResponse);

      if (!isMountedRef.current) {
        return;
      }

      setInfant(updatedInfant);
      setFormData(updatedInfant);
      // Refresh the infant data from server to get the updated values
      await fetchInfant();

      // Dispatch event to synchronize charts and dashboards
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("child-data-update", {
            detail: { id: infantId },
          })
        );
      }

      if (!isMountedRef.current) {
        return;
      }

      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      let errorMessage = err.message || "Failed to save changes. Please try again.";

      // Extract detailed validation fields if provided by the backend error
      const validationFields = err.fields || err.response?.data?.fields;
      if (validationFields && typeof validationFields === 'object') {
        const details = Object.entries(validationFields).map(([k, v]) => `${k}: ${v}`).join(", ");
        errorMessage += ` (${details})`;
      }

      setSaveError(errorMessage);
    } finally {
      if (!isMountedRef.current) {
        return;
      }

      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinner size="lg" />
        <span className="mt-3 text-gray-600 dark:text-gray-400">
          Loading infant record...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <Alert variant="error" title="Error loading infant record">
          {error}
          <div className="mt-4">
            <Button onClick={fetchInfant} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!infant) {
    return (
      <div className="text-center py-8 text-gray-500">Infant not found</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Infant Personal Information Record
          </h3>
          {/* Only show edit button for admin users, not for guardians */}
          {(isAdmin || readOnly === false) && !isGuardian && (
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "cancel" : "primary"}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                WORKFLOW STATUS
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    TRANSFER STATUS
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {infant.latest_transfer_case_status || infant.validation_status || "Not started"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    TRANSFER SOURCE
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {infant.latest_transfer_source_facility || "Not specified"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    COMPLETED DOSES
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {Number(infant.completed_vaccinations || 0)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PENDING DOSES
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {Number(infant.pending_vaccinations || 0)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IMPORTED HISTORY
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {Number(infant.imported_vaccinations || 0)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    LAST TRANSFER UPDATE
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {infant.latest_transfer_case_updated_at
                      ? new Date(infant.latest_transfer_case_updated_at).toLocaleString()
                      : "No transfer updates"}
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                PERSONAL INFORMATION
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    NAME (Last, First, MI)
                  </label>
                  {isEditing ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={formData.last_name || ""}
                        onChange={(e) =>
                          handleInputChange("last_name", e.target.value)
                        }
                        placeholder="Last Name"
                        required
                      />
                      <Input
                        value={formData.first_name || ""}
                        onChange={(e) =>
                          handleInputChange("first_name", e.target.value)
                        }
                        placeholder="First Name"
                        required
                      />
                      <Input
                        value={formData.middle_name || ""}
                        onChange={(e) =>
                          handleInputChange("middle_name", e.target.value)
                        }
                        placeholder="MI"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {infant.last_name}, {infant.first_name}{" "}
                      {infant.middle_name || ""}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    DATE OF BIRTH
                  </label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={formData.dob || ""}
                      onChange={(e) => handleInputChange("dob", e.target.value)}
                      required
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {new Date(infant.dob).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    BIRTH WEIGHT
                  </label>
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.birth_weight || ""}
                        onChange={(e) =>
                          handleInputChange("birth_weight", e.target.value)
                        }
                        placeholder="0.00"
                      />
                      <span className="text-gray-500">kg</span>
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.birth_weight
                        ? `${infant.birth_weight} kg`
                        : "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PLACE OF BIRTH
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.place_of_birth || ""}
                      onChange={(e) =>
                        handleInputChange("place_of_birth", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.place_of_birth || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    BIRTH HEIGHT
                  </label>
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.birth_height || ""}
                        onChange={(e) =>
                          handleInputChange("birth_height", e.target.value)
                        }
                        placeholder="0.0"
                      />
                      <span className="text-gray-500">cm</span>
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.birth_height
                        ? `${infant.birth_height} cm`
                        : "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ADDRESS
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.address || ""}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.address || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    MOTHER'S NAME
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.mother_name || ""}
                      onChange={(e) =>
                        handleInputChange("mother_name", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.mother_name || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    AGE
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {infant.dob
                      ? Math.floor(
                          (new Date() - new Date(infant.dob)) /
                            (365.25 * 24 * 60 * 60 * 1000),
                        )
                      : "Not available"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    FATHER'S NAME
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.father_name || ""}
                      onChange={(e) =>
                        handleInputChange("father_name", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.father_name || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GENDER
                  </label>
                  {isEditing ? (
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sex"
                          value="female"
                          checked={
                            formData.sex === "female" || formData.sex === "F"
                          }
                          onChange={(e) =>
                            handleInputChange("sex", e.target.value)
                          }
                          className="mr-2"
                        />
                        FEMALE
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sex"
                          value="male"
                          checked={
                            formData.sex === "male" || formData.sex === "M"
                          }
                          onChange={(e) =>
                            handleInputChange("sex", e.target.value)
                          }
                          className="mr-2"
                        />
                        MALE
                      </label>
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.sex === "male" || infant.sex === "M"
                        ? "MALE"
                        : infant.sex === "female" || infant.sex === "F"
                          ? "FEMALE"
                          : "OTHER"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CELLPHONE NUMBER
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.cellphone_number || ""}
                      onChange={(e) =>
                        handleInputChange("cellphone_number", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.cellphone_number || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    INFANT CONTROL NUMBER
                  </label>
                  {/* Control Number is always read-only, even in edit mode */}
                  {
                    <p className="text-gray-900 dark:text-gray-100 font-mono">
                      {formatControlNumberDisplay(infant.control_number, infant.dob)}
                    </p>
                  }
                </div>

              </div>
            </div>

            {/* Delivery Information Section */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                DELIVERY INFORMATION
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    TIME OF DELIVERY
                  </label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={formData.time_of_delivery || ""}
                      onChange={(e) =>
                        handleInputChange("time_of_delivery", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.time_of_delivery || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    TYPE OF DELIVERY
                  </label>
                  {isEditing ? (
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="type_of_delivery"
                          value="NSD"
                          checked={formData.type_of_delivery === "NSD"}
                          onChange={(e) =>
                            handleInputChange(
                              "type_of_delivery",
                              e.target.value,
                            )
                          }
                          className="mr-2"
                        />
                        NSD
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="type_of_delivery"
                          value="CS"
                          checked={formData.type_of_delivery === "CS"}
                          onChange={(e) =>
                            handleInputChange(
                              "type_of_delivery",
                              e.target.value,
                            )
                          }
                          className="mr-2"
                        />
                        CS
                      </label>
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.type_of_delivery || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ATTENDED BY
                  </label>
                  {isEditing ? (
                    <div className="space-y-2">
                      {["Doctor", "Midwife", "Nurse", "Hilot"].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="radio"
                            name="attended_by"
                            value={option}
                            checked={
                              formData.doctor_midwife_nurse || "" === option
                            }
                            onChange={(e) =>
                              handleInputChange(
                                "doctor_midwife_nurse",
                                e.target.value,
                              )
                            }
                            className="mr-2"
                          />
                          {option.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.doctor_midwife_nurse || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    NBS (Newborn Screening)
                  </label>
                  {isEditing ? (
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="nbs_done"
                          value="true"
                          checked={formData.nbs_done === true}
                          onChange={(e) =>
                            handleInputChange(
                              "nbs_done",
                              e.target.value === "true",
                            )
                          }
                          className="mr-2"
                        />
                        YES
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="nbs_done"
                          value="false"
                          checked={formData.nbs_done === false}
                          onChange={(e) =>
                            handleInputChange(
                              "nbs_done",
                              e.target.value === "false",
                            )
                          }
                          className="mr-2"
                        />
                        NO
                      </label>
                      {formData.nbs_done && (
                        <Input
                          type="date"
                          value={formData.nbs_date || ""}
                          onChange={(e) =>
                            handleInputChange("nbs_date", e.target.value)
                          }
                          placeholder="Date"
                          className="ml-4"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.nbs_done
                        ? `YES - ${
                            infant.nbs_date
                              ? new Date(infant.nbs_date).toLocaleDateString()
                              : ""
                          }`
                        : "NO"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Health Center Information */}
            <div>
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                HEALTH CENTER INFORMATION
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    BARANGAY
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.barangay || ""}
                      onChange={(e) =>
                        handleInputChange("barangay", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.barangay || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    HEALTH CENTER
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.health_center || ""}
                      onChange={(e) =>
                        handleInputChange("health_center", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.health_center || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PUROK
                  </label>
                  {isEditing ? (
                    <Select
                      name="purok"
                      value={formData.purok || ""}
                      onChange={(e) => {
                        handleInputChange("purok", e.target.value);
                        handleInputChange("street_color", "");
                      }}
                      options={PUROK_OPTIONS}
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.purok || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PUROK - STREET - COLOR
                  </label>
                  {isEditing ? (
                    <Select
                      name="street_color"
                      value={formData.street_color || ""}
                      onChange={(e) => handleInputChange("street_color", e.target.value)}
                      options={getPurokStreetColorOptions(formData.purok)}
                      disabled={!formData.purok}
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.street_color || "Not specified"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    FAMILY NO
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.family_no || ""}
                      onChange={(e) =>
                        handleInputChange("family_no", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.family_no || "Not specified"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ALLERGY INFORMATION
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.allergy_information || ""}
                      onChange={(e) =>
                        handleInputChange("allergy_information", e.target.value)
                      }
                      placeholder="Known allergies"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.allergy_information || "No known allergies"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    HEALTH CARE PROVIDER
                  </label>
                  {isEditing ? (
                    <Input
                      value={formData.health_care_provider || ""}
                      onChange={(e) =>
                        handleInputChange("health_care_provider", e.target.value)
                      }
                      placeholder="Provider name"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {infant.health_care_provider || "Not specified"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {isEditing && (isAdmin || readOnly === false) && !isGuardian && (
              <div className="flex justify-center space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="cancel"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
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
        </form>
      </div>

      {/* Documents Section */}
      <div className="mt-6">
        <InfantDocuments
          infantId={infantId}
          onDocumentChange={(doc) => {
            // Refresh if needed when document changes
          }}
        />
      </div>
    </div>
  );
}
