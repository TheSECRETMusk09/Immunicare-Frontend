import React, { useState, useEffect, useMemo } from "react";
import apiClient from "../utils/api";
import infantService from "../services/infantService";
import { Button, Input, Modal, Select, Alert, AdminModalActions, TextArea } from "./UI";
import { useDebounce } from "../hooks/usePerformance";

const createInitialFormData = () => ({
  first_name: "",
  last_name: "",
  dob: "",
  sex: "male",
  birth_weight: "",
  birth_length: "",
  birth_head_circumference: "",
  blood_type: "",
  birthplace: "",
  guardian_id: "",
  notes: "",
});

const mapEditingInfantToFormData = (editingInfant = null) => {
  if (!editingInfant) {
    return createInitialFormData();
  }

  return {
    first_name: editingInfant.first_name || "",
    last_name: editingInfant.last_name || "",
    dob: editingInfant.dob ? editingInfant.dob.split("T")[0] : "",
    sex: editingInfant.sex || "male",
    birth_weight: editingInfant.birth_weight || "",
    birth_length:
      editingInfant.birth_height || editingInfant.birth_length || "",
    birth_head_circumference: editingInfant.birth_head_circumference || "",
    blood_type: editingInfant.blood_type || "",
    birthplace:
      editingInfant.place_of_birth || editingInfant.birthplace || "",
    guardian_id: editingInfant.guardian_id || "",
    notes: editingInfant.notes || "",
  };
};

export default function AddInfantModal({
  isOpen,
  onClose,
  onSuccess,
  editingInfant = null,
}) {
  const [formData, setFormData] = useState(createInitialFormData);
  const [guardians, setGuardians] = useState([]);
  const [guardianSearchQuery, setGuardianSearchQuery] = useState("");
  const [guardianLookupLoading, setGuardianLookupLoading] = useState(false);
  const [guardianLookupError, setGuardianLookupError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const debouncedGuardianSearchQuery = useDebounce(guardianSearchQuery, 350);

  const normalizeGuardiansResponse = (response) =>
    Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.guardians)
          ? response.guardians
          : Array.isArray(response?.data?.guardians)
            ? response.data.guardians
            : [];

  const buildGuardianLabel = (guardian = {}) =>
    guardian.name ||
    guardian.full_name ||
    guardian.guardian_name ||
    [guardian.first_name, guardian.last_name].filter(Boolean).join(" ") ||
    `Guardian #${guardian.id}`;

  const initialGuardianFallback = useMemo(() => {
    if (!editingInfant?.guardian_id) {
      return null;
    }

    return {
      id: editingInfant.guardian_id,
      name:
        editingInfant?.guardian_name ||
        editingInfant?.guardian?.name ||
        editingInfant?.guardian_full_name ||
        `Guardian #${editingInfant.guardian_id}`,
    };
  }, [editingInfant]);

  const selectedGuardianRecord = useMemo(() => {
    if (!formData.guardian_id) {
      return initialGuardianFallback;
    }

    return (
      guardians.find(
        (guardian) => String(guardian.id) === String(formData.guardian_id),
      ) || initialGuardianFallback
    );
  }, [formData.guardian_id, guardians, initialGuardianFallback]);

  useEffect(() => {
    if (isOpen) {
      if (editingInfant) {
        setFormData(mapEditingInfantToFormData(editingInfant));
        setGuardians(initialGuardianFallback ? [initialGuardianFallback] : []);
      } else {
        resetForm();
        setGuardians([]);
      }
      setGuardianSearchQuery("");
      setGuardianLookupError(null);
      setGuardianLookupLoading(false);
    }
  }, [editingInfant, initialGuardianFallback, isOpen]);

  const resetForm = () => {
    setFormData(createInitialFormData());
    setErrors({});
    setTouched({});
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const trimmedQuery = String(debouncedGuardianSearchQuery || "").trim();

    if (trimmedQuery.length < 2) {
      setGuardianLookupLoading(false);
      setGuardianLookupError(null);
      setGuardians(selectedGuardianRecord ? [selectedGuardianRecord] : []);
      return undefined;
    }

    const abortController = new AbortController();
    let isMounted = true;

    const searchGuardians = async () => {
      setGuardianLookupLoading(true);
      setGuardianLookupError(null);

      try {
        const response = await apiClient.getGuardians(
          {
            search: trimmedQuery,
            limit: 20,
            view: "lookup",
          },
          {
            signal: abortController.signal,
            disableRetry: true,
            timeout: 15000,
          },
        );

        if (!isMounted) {
          return;
        }

        const normalizedGuardians = normalizeGuardiansResponse(response);
        const mergedGuardians = [...normalizedGuardians];

        if (
          selectedGuardianRecord &&
          !mergedGuardians.some(
            (guardian) =>
              String(guardian.id) === String(selectedGuardianRecord.id),
          )
        ) {
          mergedGuardians.unshift(selectedGuardianRecord);
        }

        setGuardians(mergedGuardians);
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error("Error fetching guardians:", err);
        if (!isMounted) {
          return;
        }

        setGuardianLookupError(
          err.message || "Failed to search guardians. Please try again.",
        );
        setGuardians(selectedGuardianRecord ? [selectedGuardianRecord] : []);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setGuardianLookupLoading(false);
        }
      }
    };

    searchGuardians();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [
    debouncedGuardianSearchQuery,
    isOpen,
    selectedGuardianRecord?.id,
    selectedGuardianRecord?.name,
  ]);

  const guardianOptions = [
    { value: "", label: "Select Guardian" },
    ...(Array.isArray(guardians) ? guardians : []).map((guardian) => ({
      value: guardian.id,
      label: buildGuardianLabel(guardian),
    })),
  ];

  const guardianSearchHelpText = guardianLookupLoading
    ? "Searching guardians..."
    : guardianSearchQuery.trim().length < 2
      ? "Type at least 2 characters to search the guardian directory."
      : guardians.length > 0
        ? `${guardians.length} guardian option${guardians.length === 1 ? "" : "s"} available.`
        : "No guardians matched your search.";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const submitErrors = {};
    ["first_name", "last_name", "dob", "guardian_id"].forEach((field) => {
      const fieldError = validateField(field, formData[field]);
      if (fieldError) {
        submitErrors[field] = fieldError;
      }
    });

    if (Object.keys(submitErrors).length > 0) {
      setErrors(submitErrors);
      setTouched({
        first_name: true,
        last_name: true,
        dob: true,
        guardian_id: true,
      });
      setLoading(false);
      return;
    }

    try {
      if (editingInfant) {
        await infantService.update(editingInfant.id, formData);
        setSuccess("Infant record updated successfully!");
      } else {
        await infantService.create(formData);
        setSuccess("Infant registered successfully!");
      }

      setTimeout(() => {
        setSuccess(null);
        onSuccess();
        resetForm();
      }, 1500);
    } catch (err) {
      setError(
        err.message || "Failed to save infant record. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validate individual field
  const validateField = (name, value) => {
    if (name === "first_name" || name === "last_name") {
      if (!value || value.trim() === "") return "This field is required";
      if (value.trim().length < 2) return "Must be at least 2 characters";
    }
    if (name === "dob") {
      if (!value) return "Date of birth is required";
      const dob = new Date(value);
      const today = new Date();
      if (dob > today) return "Date cannot be in the future";
    }
    if (name === "guardian_id") {
      if (!value) return "Please select a guardian";
    }
    return null;
  };

  // Handle blur for real-time validation
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingInfant ? "Edit Infant Record" : "Add New Infant"}
      size="md"
      footer={
        <AdminModalActions>
          <Button type="button" variant="cancel" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" form="infantForm" disabled={loading}>
            {loading
              ? "Saving..."
              : editingInfant
                ? "Update Infant"
                : "Register Infant"}
          </Button>
        </AdminModalActions>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          className="mb-4"
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <form id="infantForm" onSubmit={handleSubmit} className="admin-form">
        {/* Personal Information */}
        <div className="admin-form-row-2">
          <div className="admin-field-group">
            <label className="admin-field-label">Infant Control Number</label>
            <Input
              name="control_number"
              surface="light"
              value={editingInfant?.control_number || "Auto-generated upon creation"}
              disabled
              readOnly
              className="bg-gray-50 text-gray-500 font-mono text-sm"
            />
          </div>
        </div>
        <div className="admin-form-row-2">
          <Input
            label="First Name"
            surface="light"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.first_name ? errors.first_name : undefined}
            required
            placeholder="Enter first name"
          />
          <Input
            label="Last Name"
            surface="light"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.last_name ? errors.last_name : undefined}
            required
            placeholder="Enter last name"
          />
        </div>

        <div className="admin-form-row-2">
          <Input
            label="Date of Birth"
            surface="light"
            name="dob"
            type="date"
            value={formData.dob}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.dob ? errors.dob : undefined}
            required
          />
          <Select
            label="Gender"
            surface="light"
            name="sex"
            value={formData.sex}
            onChange={handleChange}
            options={[
              { value: "", label: "Select Gender" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            required
          />
        </div>

        {/* Birth Information */}
        <div className="admin-form-section">
          <h4 className="admin-form-section-title">Birth Information</h4>
          <div className="admin-form-row-2">
            <Input
              label="Birth Weight (kg)"
              surface="light"
              name="birth_weight"
              type="number"
              step="0.01"
              value={formData.birth_weight}
              onChange={handleChange}
              placeholder="e.g., 3.2"
            />
            <Input
              label="Birth Length (cm)"
              surface="light"
              name="birth_length"
              type="number"
              step="0.1"
              value={formData.birth_length}
              onChange={handleChange}
              placeholder="e.g., 50"
            />
          </div>
          <div className="admin-form-row-2">
            <Input
              label="Head Circumference (cm)"
              surface="light"
              name="birth_head_circumference"
              type="number"
              step="0.1"
              value={formData.birth_head_circumference}
              onChange={handleChange}
              placeholder="e.g., 35"
            />
            <Select
              label="Blood Type"
              surface="light"
              name="blood_type"
              value={formData.blood_type}
              onChange={handleChange}
              options={[
                { value: "", label: "Select Blood Type" },
                { value: "A+", label: "A+" },
                { value: "A-", label: "A-" },
                { value: "B+", label: "B+" },
                { value: "B-", label: "B-" },
                { value: "AB+", label: "AB+" },
                { value: "AB-", label: "AB-" },
                { value: "O+", label: "O+" },
                { value: "O-", label: "O-" },
              ]}
            />
          </div>
        </div>

        {/* Guardian & Location */}
        <div className="admin-form-section">
          <h4 className="admin-form-section-title">Guardian & Location</h4>
          <div className="admin-form-row-2">
            <Input
              label="Search Guardian"
              surface="light"
              value={guardianSearchQuery}
              onChange={(e) => setGuardianSearchQuery(e.target.value)}
              helpText={guardianSearchHelpText}
              error={guardianLookupError || undefined}
              placeholder="Type guardian name, phone, or username"
            />
          </div>
          <div className="admin-form-row-2">
            <Select
              label="Assign Guardian"
              surface="light"
              name="guardian_id"
              value={formData.guardian_id}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.guardian_id ? errors.guardian_id : undefined}
              options={guardianOptions}
              helpText="Pick a guardian from the current search results."
              required
            />
            <Input
              label="Birthplace"
              surface="light"
              name="birthplace"
              value={formData.birthplace}
              onChange={handleChange}
              placeholder="Hospital or address"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="admin-form-section">
          <TextArea
            label="Additional Notes"
            surface="light"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional information about the infant..."
          />
        </div>
      </form>
    </Modal>
  );
}
