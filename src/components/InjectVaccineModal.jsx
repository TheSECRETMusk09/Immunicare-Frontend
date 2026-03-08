import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiClient from "../utils/api";
import { Button, Input, Modal, Select, Alert, AdminModalActions } from "./UI";
import { useAuth } from "../contexts/AuthContext";
import {
  normalizeVaccinesResponse,
  normalizeInfantsResponse,
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationRecordResponse,
  normalizeVaccineInventoryResponse,
} from "../utils/adminDataAdapters";

const injectionSiteOptions = [
  { value: "", label: "Select Site" },
  { value: "Left Arm", label: "Left Arm" },
  { value: "Right Arm", label: "Right Arm" },
  { value: "Left Thigh", label: "Left Thigh" },
  { value: "Right Thigh", label: "Right Thigh" },
  { value: "Left Buttock", label: "Left Buttock" },
  { value: "Right Buttock", label: "Right Buttock" },
];

const routeOfInjectionOptions = [
  { value: "", label: "Select Route" },
  { value: "IM", label: "Intramuscular (IM)" },
  { value: "SC", label: "Subcutaneous (SC)" },
  { value: "ID", label: "Intradermal (ID)" },
  { value: "Oral", label: "Oral" },
];

const generateTimeOptions = () => {
  const options = [{ value: "", label: "Select Time" }];
  for (let hour = 8; hour <= 17; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time = `${hour.toString().padStart(2, "0")}:${min
        .toString()
        .padStart(2, "0")}`;
      const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        },
      );
      options.push({ value: time, label: displayTime });
    }
  }
  return options;
};

const reactionOptions = [
  { value: "", label: "Select reaction (if any)" },
  { value: "None", label: "None" },
  { value: "Mild redness", label: "Mild redness" },
  { value: "Mild swelling", label: "Mild swelling" },
  { value: "Mild fever", label: "Mild fever" },
  { value: "Soreness", label: "Soreness" },
  { value: "Fatigue", label: "Fatigue" },
  { value: "Crying", label: "Crying" },
  { value: "Loss of appetite", label: "Loss of appetite" },
  { value: "Other", label: "Other (specify)" },
];

const nextAppointmentOptions = [
  { value: "", label: "Select next appointment" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Next dose", label: "Next vaccine dose" },
  { value: "Checkup", label: "General checkup" },
  { value: "Consultation", label: "Consultation" },
];

const INITIAL_FORM = {
  vaccine_id: "",
  vaccine_inventory_id: "",
  date_administered: new Date().toISOString().split("T")[0],
  time_administered: "",
  dose_number: 1,
  lot_number: "",
  expiration_date: "",
  site_of_injection: "",
  route_of_injection: "IM",
  administered_by: "",
  batch_number: "",
  manufacturer: "",
  reaction: "",
  reaction_other: "",
  notes: "",
  next_appointment_type: "",
  next_appointment_date: "",
};

export default function InjectVaccineModal({
  isOpen,
  onClose,
  infantId,
  infantName,
  onSuccess = () => {},
}) {
  const { isAdmin, user } = useAuth();

  const [vaccines, setVaccines] = useState([]);
  const [infants, setInfants] = useState([]);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [selectedInfantId, setSelectedInfantId] = useState(infantId || "");

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [vaccinationHistory, setVaccinationHistory] = useState([]);

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const fetchData = useCallback(async () => {
    try {
      const [vaccinesResponse, infantsResponse, inventoryResponse] =
        await Promise.all([
          apiClient.getVaccines(),
          apiClient.getInfants(),
          apiClient.getVaccineInventory(),
        ]);

      const normalizedVaccines = normalizeVaccinesResponse(vaccinesResponse);
      const normalizedInfants = normalizeInfantsResponse(infantsResponse);
      const normalizedInventory = normalizeVaccineInventoryResponse(inventoryResponse);

      setVaccines(normalizedVaccines);
      setInfants(normalizedInfants);
      setInventoryRecords(normalizedInventory);
    } catch (err) {
      console.error("Error fetching data:", err);
      setVaccines([]);
      setInfants([]);
      setInventoryRecords([]);
    }
  }, []);

  const fetchVaccinationHistory = useCallback(async (targetInfantId) => {
    if (!targetInfantId) {
      setVaccinationHistory([]);
      return;
    }

    try {
      const historyResponse = await apiClient.getVaccinationRecordsByInfant(
        Number(targetInfantId),
      );
      setVaccinationHistory(normalizeVaccinationRecordsResponse(historyResponse));
    } catch (err) {
      console.error("Error fetching vaccination history:", err);
      setVaccinationHistory([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchData();
      if (infantId) {
        setSelectedInfantId(infantId);
      } else {
        setSelectedInfantId("");
      }
      setFormData(INITIAL_FORM);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, infantId, fetchData]);

  useEffect(() => {
    if (!isOpen) return;

    const targetInfantId = selectedInfantId || infantId;
    void fetchVaccinationHistory(targetInfantId);
  }, [isOpen, infantId, selectedInfantId, fetchVaccinationHistory]);

  const selectedVaccine = useMemo(
    () => vaccines.find((v) => v.id === Number(formData.vaccine_id)) || null,
    [vaccines, formData.vaccine_id],
  );

  const vaccineInventoryOptions = useMemo(() => {
    if (!formData.vaccine_id) return [];
    return inventoryRecords.filter(
      (record) =>
        record.vaccine_id === Number(formData.vaccine_id) &&
        Number(record.stock_on_hand || 0) > 0,
    );
  }, [inventoryRecords, formData.vaccine_id]);

  const selectedInventoryRecord = useMemo(
    () =>
      inventoryRecords.find(
        (record) => record.id === Number(formData.vaccine_inventory_id),
      ) || null,
    [inventoryRecords, formData.vaccine_inventory_id],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      setError("Only healthcare administrators can record vaccine administrations.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!selectedInfantId) {
      setError("Please select an infant/patient from the dropdown.");
      setLoading(false);
      return;
    }

    if (!formData.vaccine_id) {
      setError("Please select a vaccine.");
      setLoading(false);
      return;
    }

    if (!formData.vaccine_inventory_id) {
      setError("Please select the inventory record to deduct stock from.");
      setLoading(false);
      return;
    }

    let createdVaccinationRecordId = null;

    try {
      const administeredByValue = Number(formData.administered_by);
      const administeredBy =
        Number.isFinite(administeredByValue) && administeredByValue > 0
          ? administeredByValue
          : user?.id || null;

      const recordPayload = {
        patient_id: Number(selectedInfantId),
        vaccine_id: Number(formData.vaccine_id),
        dose_no: Number(formData.dose_number) || 1,
        admin_date: formData.date_administered,
        administered_by: administeredBy,
        site_of_injection: formData.site_of_injection || null,
        route_of_injection: formData.route_of_injection || null,
        reactions:
          formData.reaction === "Other"
            ? formData.reaction_other
            : formData.reaction || null,
        next_due_date: formData.next_appointment_date || null,
        notes: formData.notes || null,
        lot_number: formData.lot_number || null,
        batch_number: formData.batch_number || null,
        manufacturer: formData.manufacturer || null,
        expiration_date: formData.expiration_date || null,
        status: "completed",
      };

      const createdVaccinationResponse =
        await apiClient.createVaccinationRecord(recordPayload);
      const normalizedCreatedVaccination = normalizeVaccinationRecordResponse(
        createdVaccinationResponse,
      );
      createdVaccinationRecordId = normalizedCreatedVaccination?.id || null;

      await apiClient.createVaccineInventoryTransaction({
        vaccine_inventory_id: Number(formData.vaccine_inventory_id),
        vaccine_id: Number(formData.vaccine_id),
        transaction_type: "ISSUE",
        quantity: 1,
        lot_number: formData.lot_number || null,
        batch_number: formData.batch_number || null,
        reference_number: createdVaccinationRecordId
          ? `VAC-${createdVaccinationRecordId}`
          : null,
        notes: createdVaccinationRecordId
          ? `Vaccination record ${createdVaccinationRecordId} administered to infant ID ${selectedInfantId}`
          : `Vaccination administered to infant ID ${selectedInfantId}`,
      });

      setSuccess("Vaccination recorded and inventory updated successfully.");

      setTimeout(() => {
        setSuccess(null);
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      if (createdVaccinationRecordId) {
        try {
          await apiClient.deleteVaccinationRecord(createdVaccinationRecordId);
        } catch (rollbackError) {
          console.error(
            "Failed to rollback vaccination record after inventory transaction failure:",
            rollbackError,
          );
        }
      }

      setError(err.message || "Failed to record vaccination. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "vaccine_id"
        ? { vaccine_inventory_id: "", lot_number: "", batch_number: "" }
        : {}),
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="💉 Record Vaccine Administration"
      size="md"
      footer={
        <AdminModalActions>
          <Button type="button" variant="cancel" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            form="injectVaccineForm"
            disabled={loading || !isAdmin}
          >
            {loading ? "Recording..." : "Record Vaccination"}
          </Button>
        </AdminModalActions>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          className="mb-4"
          dismissible
          onDismiss={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {!isAdmin && (
        <Alert variant="warning" className="mb-4">
          Note: Only healthcare administrators can record vaccine administrations.
        </Alert>
      )}

      <form id="injectVaccineForm" onSubmit={handleSubmit} className="admin-form">
        <div className="admin-field-group">
          <Select
            label="Select Infant"
            name="infant_id"
            value={selectedInfantId}
            onChange={(e) => {
              const newInfantId = e.target.value;
              setSelectedInfantId(newInfantId);
              void fetchVaccinationHistory(newInfantId);
            }}
            options={[
              { value: "", label: infantName ? infantName : "Select Infant" },
              ...infants.map((infant) => ({
                value: infant.id,
                label: `${infant.first_name} ${infant.last_name} (${infant.dob || "N/A"})`,
              })),
            ]}
            required
          />
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Vaccine"
            name="vaccine_id"
            value={formData.vaccine_id}
            onChange={handleChange}
            options={[
              { value: "", label: "Select Vaccine" },
              ...vaccines.map((vaccine) => ({
                value: vaccine.id,
                label: `${vaccine.name} (${vaccine.code || "N/A"})`,
              })),
            ]}
            required
          />
          <Input
            label="Dose Number"
            name="dose_number"
            type="number"
            min="1"
            max="10"
            value={formData.dose_number}
            onChange={handleChange}
            required
          />
        </div>

        <div className="admin-field-group">
          <Select
            label="Inventory Record"
            name="vaccine_inventory_id"
            value={formData.vaccine_inventory_id}
            onChange={(e) => {
              const selectedId = e.target.value;
              const inventoryRecord = inventoryRecords.find(
                (record) => record.id === Number(selectedId),
              );
              setFormData((prev) => ({
                ...prev,
                vaccine_inventory_id: selectedId,
                lot_number: inventoryRecord?.lot_batch_number || prev.lot_number,
              }));
            }}
            options={[
              { value: "", label: "Select inventory source" },
              ...vaccineInventoryOptions.map((record) => ({
                value: record.id,
                label: `${record.facility_name || "Facility"} • Stock ${
                  record.stock_on_hand
                } • Lot ${record.lot_batch_number || "N/A"}`,
              })),
            ]}
            required
          />
        </div>

        {selectedVaccine && (
          <div className="admin-form-card admin-form-card-info">
            <div className="font-medium text-gray-900 dark:text-white">
              {selectedVaccine.name}
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              Code: {selectedVaccine.code || "N/A"} | Manufacturer: {" "}
              {selectedVaccine.manufacturer || "N/A"}
            </div>
            {selectedInventoryRecord && (
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Facility: {selectedInventoryRecord.facility_name || "N/A"}</span>
                <span>Lot: {selectedInventoryRecord.lot_batch_number || "N/A"}</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {selectedInventoryRecord.stock_on_hand || 0} in stock
                </span>
              </div>
            )}
          </div>
        )}

        <div className="admin-form-row-2">
          <Input
            label="Date Administered"
            name="date_administered"
            type="date"
            value={formData.date_administered}
            onChange={handleChange}
            required
          />
          <Select
            label="Time Administered (8AM - 5PM)"
            name="time_administered"
            value={formData.time_administered}
            onChange={handleChange}
            options={timeOptions}
            required
          />
        </div>

        <div className="admin-form-row-2">
          <Input
            label="Lot Number"
            name="lot_number"
            value={formData.lot_number}
            onChange={handleChange}
            placeholder="Enter lot number"
          />
          <Input
            label="Batch Number"
            name="batch_number"
            value={formData.batch_number}
            onChange={handleChange}
            placeholder="Enter batch number"
          />
        </div>

        <div className="admin-form-row-2">
          <Input
            label="Expiration Date"
            name="expiration_date"
            type="date"
            value={formData.expiration_date}
            onChange={handleChange}
          />
          <Input
            label="Manufacturer"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            placeholder="e.g., Pfizer, Moderna"
          />
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Site of Injection"
            name="site_of_injection"
            value={formData.site_of_injection}
            onChange={handleChange}
            options={injectionSiteOptions}
            required
          />
          <Select
            label="Route of Injection"
            name="route_of_injection"
            value={formData.route_of_injection}
            onChange={handleChange}
            options={routeOfInjectionOptions}
            required
          />
        </div>

        <div className="admin-field-group">
          <Input
            label="Administered By (Health Worker)"
            name="administered_by"
            value={formData.administered_by}
            onChange={handleChange}
            placeholder="Health worker user ID (optional)"
          />
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Reaction (if any)"
            name="reaction"
            value={formData.reaction}
            onChange={handleChange}
            options={reactionOptions}
          />
          {formData.reaction === "Other" && (
            <Input
              label="Specify Other Reaction"
              name="reaction_other"
              value={formData.reaction_other}
              onChange={handleChange}
              placeholder="Describe the reaction"
              required
            />
          )}
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Next Appointment Type"
            name="next_appointment_type"
            value={formData.next_appointment_type}
            onChange={handleChange}
            options={nextAppointmentOptions}
          />
          <Input
            label="Next Appointment Date"
            name="next_appointment_date"
            type="date"
            value={formData.next_appointment_date}
            onChange={handleChange}
            min={formData.date_administered}
          />
        </div>

        <div className="admin-field-group">
          <label className="admin-field-label">Additional Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="admin-textarea"
            rows={3}
            placeholder="Any observations or notes..."
          />
        </div>

        {selectedInfantId && vaccinationHistory.length > 0 && (
          <div className="admin-form-section">
            <h4 className="admin-form-section-title">
              Previous Vaccinations for this Infant
            </h4>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead className="admin-table-head">
                  <tr>
                    <th className="admin-table-header">Vaccine</th>
                    <th className="admin-table-header">Date</th>
                    <th className="admin-table-header">Dose</th>
                  </tr>
                </thead>
                <tbody className="admin-table-body">
                  {vaccinationHistory.slice(0, 5).map((record) => (
                    <tr key={record.id}>
                      <td className="admin-table-cell">{record.vaccine_name}</td>
                      <td className="admin-table-cell">
                        {record.admin_date
                          ? new Date(record.admin_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="admin-table-cell">{record.dose_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
