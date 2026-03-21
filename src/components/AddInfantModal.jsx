import React, { useState, useEffect } from "react";
import apiClient from "../utils/api";
import infantService from "../services/infantService";
import { Button, Input, Modal, Select, Alert, AdminModalActions } from "./UI";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchGuardians();
      if (editingInfant) {
        setFormData(mapEditingInfantToFormData(editingInfant));
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingInfant]);

  const resetForm = () => {
    setFormData(createInitialFormData());
    setErrors({});
    setTouched({});
  };

  const fetchGuardians = async () => {
    try {
      const response = await apiClient.getGuardians();
      const normalizedGuardians = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.guardians)
            ? response.guardians
            : Array.isArray(response?.data?.guardians)
              ? response.data.guardians
              : [];
      setGuardians(normalizedGuardians);
    } catch (err) {
      console.error("Error fetching guardians:", err);
      setGuardians([]);
    }
  };

  const guardianOptions = [
    { value: "", label: "Select Guardian" },
    ...(Array.isArray(guardians) ? guardians : []).map((guardian) => ({
      value: guardian.id,
      label:
        guardian.name ||
        guardian.full_name ||
        [guardian.first_name, guardian.last_name].filter(Boolean).join(" ") ||
        `Guardian #${guardian.id}`,
    })),
  ];

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
              name="birth_weight"
              type="number"
              step="0.01"
              value={formData.birth_weight}
              onChange={handleChange}
              placeholder="e.g., 3.2"
            />
            <Input
              label="Birth Length (cm)"
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
              name="birth_head_circumference"
              type="number"
              step="0.1"
              value={formData.birth_head_circumference}
              onChange={handleChange}
              placeholder="e.g., 35"
            />
            <Select
              label="Blood Type"
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
            <Select
              label="Assign Guardian"
              name="guardian_id"
              value={formData.guardian_id}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.guardian_id ? errors.guardian_id : undefined}
              options={guardianOptions}
              required
            />
            <Input
              label="Birthplace"
              name="birthplace"
              value={formData.birthplace}
              onChange={handleChange}
              placeholder="Hospital or address"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="admin-form-section">
          <label className="admin-field-label">Additional Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="admin-textarea"
            rows={3}
            placeholder="Any additional information about the infant..."
          />
        </div>
      </form>
    </Modal>
  );
}
