import React, { useState } from "react";
import { Modal, Button, Input } from "../UI";
import FormActions from "../UI/FormActions";

const AddVaccineModal = ({
  isOpen,
  onClose,
  infant,
  vaccinationSchedules,
  onSubmit,
}) => {
  const [vaccineForm, setVaccineForm] = useState({
    infant_id: infant?.id || "",
    vaccine_id: "",
    dose_no: 1,
    admin_date: new Date().toISOString().split("T")[0],
    healthcare_worker: "",
    batch_number: "",
    notes: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(vaccineForm);
      setVaccineForm({
        infant_id: infant?.id || "",
        vaccine_id: "",
        dose_no: 1,
        admin_date: new Date().toISOString().split("T")[0],
        healthcare_worker: "",
        batch_number: "",
        notes: "",
      });
      onClose();
    } catch (err) {
      console.error("Error submitting vaccine:", err);
    }
  };

  const handleChange = (field, value) => {
    setVaccineForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const selectedVaccine = vaccinationSchedules.find(
    (v) => v.vaccine_id === parseInt(vaccineForm.vaccine_id),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Vaccination for ${infant?.first_name} ${infant?.last_name}`}
      size="lg"
      footer={
        <FormActions>
          <Button variant="cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="addVaccineForm"
            disabled={
              !vaccineForm.vaccine_id ||
              !vaccineForm.admin_date ||
              !vaccineForm.healthcare_worker
            }
          >
            Save Record
          </Button>
        </FormActions>
      }
    >
      <form id="addVaccineForm" onSubmit={handleSubmit} className="space-y-4">
        {/* Child Information */}
        {infant && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Child Information
            </h4>
            <div className="flex items-center gap-4">
              <div className="text-2xl">{infant.sex === "M" ? "👦" : "👧"}</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {infant.first_name} {infant.last_name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.floor(
                    (new Date() - new Date(infant.dob)) /
                      (1000 * 60 * 60 * 24 * 30),
                  )}{" "}
                  months old
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vaccine Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vaccine *
            </label>
            <select
              value={vaccineForm.vaccine_id}
              onChange={(e) =>
                handleChange("vaccine_id", parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Vaccine</option>
              {vaccinationSchedules.map((schedule) => (
                <option key={schedule.id} value={schedule.vaccine_id}>
                  {schedule.vaccine_name} ({schedule.disease_prevented})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Dose Number *"
            type="number"
            value={vaccineForm.dose_no}
            onChange={(e) => handleChange("dose_no", parseInt(e.target.value))}
            min="1"
            required
          />
        </div>

        {/* Date and Healthcare Worker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Date Administered *"
            type="date"
            value={vaccineForm.admin_date}
            onChange={(e) => handleChange("admin_date", e.target.value)}
            required
          />
          <Input
            label="Healthcare Worker *"
            value={vaccineForm.healthcare_worker}
            onChange={(e) => handleChange("healthcare_worker", e.target.value)}
            placeholder="Your name"
            required
          />
        </div>

        {/* Batch Number and Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Batch Number"
            value={vaccineForm.batch_number}
            onChange={(e) => handleChange("batch_number", e.target.value)}
            placeholder="Vaccine batch number"
          />
        </div>

        <Input
          label="Notes"
          value={vaccineForm.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Any reactions, observations, or special notes"
          textarea
          rows={3}
        />

        {/* Vaccine Information */}
        {selectedVaccine && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
              Selected Vaccine Information
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-600 font-medium">Vaccine:</span>{" "}
                {selectedVaccine.vaccine_name}
              </div>
              <div>
                <span className="text-green-600 font-medium">Prevents:</span>{" "}
                {selectedVaccine.disease_prevented}
              </div>
              <div>
                <span className="text-green-600 font-medium">
                  Recommended Age:
                </span>{" "}
                {selectedVaccine.target_age_weeks > 0
                  ? `${Math.floor(selectedVaccine.target_age_weeks / 4)} months`
                  : "Birth"}
              </div>
              <div>
                <span className="text-green-600 font-medium">Dose:</span>{" "}
                {vaccineForm.dose_no}
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            ⚠️ <strong>Important:</strong> Verify all information before saving.
            This record becomes part of the child's permanent health record.
          </p>
        </div>
      </form>
    </Modal>
  );
};

export default AddVaccineModal;
