import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Upload } from "lucide-react";
import apiClient from "../utils/api";
import { Alert, Button, Input, Modal } from "./UI";

const emptyFormState = {
  admin_date: "",
  source_facility: "",
  notes: "",
  vaccination_card: null,
};

const resolveUploadUrl = (uploadResponse) =>
  uploadResponse?.data?.downloadUrl ||
  uploadResponse?.data?.path ||
  uploadResponse?.downloadUrl ||
  uploadResponse?.path ||
  null;

export default function GuardianVaccinationCompletionModal({
  isOpen,
  onClose,
  child,
  vaccination,
  onSuccess,
}) {
  const [formData, setFormData] = useState(emptyFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const recordId = vaccination?.recordId || vaccination?.id || null;
  const vaccineId =
    vaccination?.vaccine_id ||
    vaccination?.vaccineId ||
    vaccination?.vaccine?.id ||
    null;
  const vaccineName =
    vaccination?.vaccine_name ||
    vaccination?.vaccineName ||
    vaccination?.vaccine?.name ||
    "Selected vaccine";
  const doseNo =
    vaccination?.dose_no ||
    vaccination?.doseNumber ||
    vaccination?.dose?.number ||
    1;
  const scheduleId =
    vaccination?.schedule_id ||
    vaccination?.scheduleId ||
    vaccination?.schedule?.id ||
    null;

  const isEditingCompletedDose = useMemo(() => {
    const normalizedStatus = String(vaccination?.status || "").toLowerCase();
    return Boolean(
      recordId &&
        (vaccination?.admin_date || vaccination?.adminDate || normalizedStatus === "completed"),
    );
  }, [recordId, vaccination]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormData({
      admin_date: vaccination?.admin_date || vaccination?.adminDate || "",
      source_facility:
        vaccination?.source_facility || vaccination?.health_care_provider || "",
      notes: "",
      vaccination_card: null,
    });
    setError("");
    setSuccessMessage("");
  }, [isOpen, vaccination]);

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!child?.id || !vaccineId || !doseNo) {
      setError("Unable to resolve the selected child or vaccine.");
      return;
    }

    if (!formData.admin_date) {
      setError("Administration date is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      let uploadedCardUrl = null;

      if (formData.vaccination_card) {
        const uploadResponse = await apiClient.uploadFile(formData.vaccination_card);
        uploadedCardUrl = resolveUploadUrl(uploadResponse);
      }

      const payload = {
        admin_date: formData.admin_date,
        source_facility: formData.source_facility || null,
        health_care_provider: formData.source_facility || null,
        notes: formData.notes || null,
        vaccination_card_url: uploadedCardUrl,
      };

      if (isEditingCompletedDose) {
        await apiClient.updateGuardianVaccinationAdminDate(recordId, payload);
      } else {
        await apiClient.markGuardianVaccinationCompleted({
          patient_id: child.id,
          vaccine_id: vaccineId,
          dose_no: doseNo,
          schedule_id: scheduleId,
          ...payload,
        });
      }

      const confirmationMessage = isEditingCompletedDose
        ? `${vaccineName} dose ${doseNo} was updated successfully.`
        : `${vaccineName} dose ${doseNo} was marked as completed successfully.`;

      setSuccessMessage(confirmationMessage);

      if (typeof onSuccess === "function") {
        await onSuccess(confirmationMessage);
      }
    } catch (requestError) {
      const backendMessage =
        requestError?.response?.data?.error ||
        requestError?.response?.data?.message ||
        requestError?.message;
      setError(backendMessage || "Failed to save the vaccination update.");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="button" variant="cancel" onClick={onClose} disabled={submitting}>
        Close
      </Button>
      <Button type="button" onClick={handleSubmit} loading={submitting} disabled={submitting}>
        {isEditingCompletedDose ? "Save Date" : "Mark Completed"}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditingCompletedDose ? "Edit Vaccination Date" : "Mark Vaccine as Completed"}
      footer={footer}
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                {child?.first_name} {child?.last_name}
              </p>
              <p>
                {vaccineName} dose {doseNo}
              </p>
            </div>
          </div>
        </div>

        <Alert variant="info" title="When to use this">
          Use this if your child already received the vaccine at another health center or you need
          to correct the recorded administered date. Uploading transfer proof is optional but
          strongly recommended for faster verification.
        </Alert>

        {error ? (
          <Alert variant="error" title="Unable to save">
            {error}
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert variant="success" title="Saved">
            {successMessage}
          </Alert>
        ) : null}

        <Input
          label="Date Administered"
          type="date"
          required
          value={formData.admin_date}
          onChange={(event) => handleFieldChange("admin_date", event.target.value)}
          icon={CalendarDays}
        />

        <Input
          label="Source Health Center"
          value={formData.source_facility}
          onChange={(event) => handleFieldChange("source_facility", event.target.value)}
          placeholder="Where the vaccine was actually given"
          helpText="This helps explain why the dose may not have been recorded by your current health center."
        />

        <Input
          label="Notes"
          value={formData.notes}
          onChange={(event) => handleFieldChange("notes", event.target.value)}
          textarea
          rows={3}
          placeholder="Optional details such as vaccine card remarks or provider notes"
        />

        <div className="rounded-xl border border-dashed border-gray-300 p-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
            <Upload className="h-4 w-4" />
            Transfer File or Vaccination Proof
          </label>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(event) =>
              handleFieldChange("vaccination_card", event.target.files?.[0] || null)
            }
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
          />
          <p className="mt-2 text-xs text-gray-500">
            Accepted: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX. Maximum file size: 10 MB.
          </p>
          {formData.vaccination_card ? (
            <p className="mt-2 text-sm text-gray-700">
              Selected file: <span className="font-medium">{formData.vaccination_card.name}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              If the dose still shows as pending after you save, refresh the page and confirm that
              the administered date is not before your child&apos;s birth date, before a required
              previous dose, or after a later recorded dose.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
