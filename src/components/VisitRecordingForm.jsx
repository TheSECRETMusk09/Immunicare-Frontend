import React, { useMemo, useState } from "react";
import { Button, Input } from "./UI";
import { normalizeRoleLabel } from "../utils/roleLabels";

const VISIT_TIME_MIN = "07:00";
const VISIT_TIME_MAX = "16:00";
const HEALTHCARE_WORKER_OPTIONS = ["Midwife", "Nurse"];

const buildWorkerName = (worker = {}) => {
  const composedName = [
    worker.first_name,
    worker.middle_name,
    worker.last_name,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  return (
    composedName ||
    String(worker.displayName || worker.full_name || worker.name || worker.username || worker.email || "").trim()
  );
};

const normalizeWorkerOption = (worker) => {
  if (typeof worker === "string") {
    return {
      id: null,
      value: worker,
      label: worker,
    };
  }

  const id = Number(worker?.id);
  const name = buildWorkerName(worker);
  if (!name) {
    return null;
  }

  const roleLabel = normalizeRoleLabel(
    String(worker?.roleLabel || worker?.role_name || worker?.role || "").trim(),
  );

  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    value: Number.isFinite(id) && id > 0 ? String(id) : name,
    label: roleLabel ? `${name} (${roleLabel})` : name,
    name,
  };
};

const normalizeVisitTime = (value) => {
  const normalizedValue = String(value || "").slice(0, 5);

  if (!normalizedValue) {
    return VISIT_TIME_MIN;
  }

  if (normalizedValue < VISIT_TIME_MIN) {
    return VISIT_TIME_MIN;
  }

  if (normalizedValue > VISIT_TIME_MAX) {
    return VISIT_TIME_MAX;
  }

  return normalizedValue;
};

const SITE_OPTIONS = [
  "Left Arm",
  "Right Arm",
  "Left Thigh",
  "Right Thigh",
  "Oral",
  "Intradermal",
];

const ROUTE_OPTIONS = [
  { value: "IM", label: "Intramuscular (IM)" },
  { value: "SC", label: "Subcutaneous (SC)" },
  { value: "ID", label: "Intradermal (ID)" },
  { value: "Oral", label: "Oral" },
];

const inferSiteRouteForVaccine = (name) => {
  const n = String(name || "").toLowerCase();
  if (/\bbcg\b/.test(n)) return { site: "Left Arm", route: "ID" };
  if (/hep(a|atitis)\s*b/.test(n)) return { site: "Right Thigh", route: "IM" };
  if (/penta/.test(n)) return { site: "Left Thigh", route: "IM" };
  if (/\bopv\b/.test(n)) return { site: "Oral", route: "Oral" };
  if (/\bpcv\b/.test(n)) return { site: "Right Thigh", route: "IM" };
  if (/\bipv\b/.test(n)) return { site: "Right Thigh", route: "IM" };
  if (/\bmmr\b/.test(n)) return { site: "Right Arm", route: "SC" };
  return { site: "Left Arm", route: "IM" };
};

export default function VisitRecordingForm({
  infant,
  visit,
  onClose,
  onSave,
  healthWorkers = [],
  fefoLookup = null,
}) {
  const visitVaccines = Array.isArray(visit?.vaccines) ? visit.vaccines : [];
  const workerOptions = useMemo(() => {
    const normalized = (Array.isArray(healthWorkers) ? healthWorkers : [])
      .map(normalizeWorkerOption)
      .filter(Boolean);

    return normalized.length > 0
      ? normalized
      : HEALTHCARE_WORKER_OPTIONS.map(normalizeWorkerOption).filter(Boolean);
  }, [healthWorkers]);
  const [formData, setFormData] = useState({
    visit_date: new Date().toISOString().split("T")[0],
    visit_time: normalizeVisitTime(new Date().toTimeString().split(" ")[0].substring(0, 5)),
    growth: {
      weight: "",
      height: "",
      head_circumference: "",
      temperature: "",
      heart_rate: "",
      respiratory_rate: "",
      breastfeeding: false,
      tcb: "",
    },
    vaccines: visitVaccines.map((vaccine) => {
      const name = typeof vaccine === "string" ? vaccine : vaccine.name;
      const defaults = inferSiteRouteForVaccine(name);
      return {
        name,
        displayLabel:
          typeof vaccine === "string"
            ? vaccine
            : `${vaccine.name} (Dose ${vaccine.doseNo || 1})`,
        dose_no: typeof vaccine === "string" ? 1 : vaccine.doseNo || 1,
        administered: false,
        lot_number: "",
        expiry_date: "",
        site: defaults.site,
        route: defaults.route,
        reactions: "",
      };
    }),
    remarks: "",
    healthcare_worker: "",
    healthcare_worker_id: null,
    next_visit_date: "",
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleVaccineChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      vaccines: prev.vaccines.map((vaccine, i) =>
        i === index ? { ...vaccine, [field]: value } : vaccine,
      ),
    }));
  };

  const handleVaccineToggle = async (index, checked) => {
    setFormData((prev) => ({
      ...prev,
      vaccines: prev.vaccines.map((vaccine, i) =>
        i === index ? { ...vaccine, administered: checked } : vaccine,
      ),
    }));

    if (!checked || typeof fefoLookup !== "function") {
      return;
    }

    const targetVaccine = formData.vaccines[index];
    if (!targetVaccine) return;

    try {
      const recommendation = await fefoLookup(targetVaccine.name);
      if (!recommendation) return;

      setFormData((prev) => ({
        ...prev,
        vaccines: prev.vaccines.map((vaccine, i) => {
          if (i !== index) return vaccine;
          return {
            ...vaccine,
            lot_number: vaccine.lot_number || recommendation.lot_number || "",
            expiry_date: vaccine.expiry_date || recommendation.expiry_date || "",
          };
        }),
      }));
    } catch (err) {
      console.error("FEFO auto-fill failed:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.visit_date || !formData.healthcare_worker) {
        alert("Please fill in visit date and select a healthcare worker.");
        setLoading(false);
        return;
      }

      if (
        formData.visit_time &&
        (formData.visit_time < VISIT_TIME_MIN || formData.visit_time > VISIT_TIME_MAX)
      ) {
        alert("Visit time must be between 7:00 AM and 4:00 PM only.");
        setLoading(false);
        return;
      }

      // Prepare data for saving
      const visitData = {
        visit_date: `${formData.visit_date}T${formData.visit_time}`,
        visit_age: visit.age,
        growth: formData.growth,
        vaccines: formData.vaccines,
        remarks: formData.remarks,
        healthcare_worker: formData.healthcare_worker,
        healthcare_worker_id: formData.healthcare_worker_id,
        next_visit_date: formData.next_visit_date,
      };

      await onSave(visitData);
    } catch (error) {
      console.error("Error saving visit:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Recording visit for {infant.first_name} {infant.last_name} - {visit.age}
      </div>

      {/* Visit Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Visit Date *
          </label>
          <Input
            type="date"
            value={formData.visit_date}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, visit_date: e.target.value }))
            }
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Visit Time
          </label>
          <Input
            type="time"
            value={formData.visit_time}
            min={VISIT_TIME_MIN}
            max={VISIT_TIME_MAX}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                visit_time: normalizeVisitTime(e.target.value),
              }))
            }
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Allowed time: 7:00 AM to 4:00 PM only
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Healthcare Worker *
          </label>
          <select
            value={formData.healthcare_worker_id ? String(formData.healthcare_worker_id) : formData.healthcare_worker}
            onChange={(e) => {
              const selectedWorker = workerOptions.find(
                (option) => option.value === e.target.value,
              );

              setFormData((prev) => ({
                ...prev,
                healthcare_worker: selectedWorker?.name || selectedWorker?.label || e.target.value,
                healthcare_worker_id: selectedWorker?.id || null,
              }));
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
          >
            <option value="">Select healthcare worker</option>
            {workerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Next Visit Date
          </label>
          <Input
            type="date"
            value={formData.next_visit_date}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                next_visit_date: e.target.value,
              }))
            }
          />
        </div>
      </div>

      {/* Vital Signs */}
      <div className="border-t pt-6">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
          Vital Signs
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Weight (kg)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.growth.weight}
              onChange={(e) =>
                handleInputChange("growth", "weight", e.target.value)
              }
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Height (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              value={formData.growth.height}
              onChange={(e) =>
                handleInputChange("growth", "height", e.target.value)
              }
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Head Circumference (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              value={formData.growth.head_circumference}
              onChange={(e) =>
                handleInputChange(
                  "growth",
                  "head_circumference",
                  e.target.value,
                )
              }
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Temperature (°C)
            </label>
            <Input
              type="number"
              step="0.1"
              value={formData.growth.temperature}
              onChange={(e) =>
                handleInputChange("growth", "temperature", e.target.value)
              }
              placeholder="36.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Heart Rate (bpm)
            </label>
            <Input
              type="number"
              value={formData.growth.heart_rate}
              onChange={(e) =>
                handleInputChange("growth", "heart_rate", e.target.value)
              }
              placeholder="120"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Respiratory Rate (rpm)
            </label>
            <Input
              type="number"
              value={formData.growth.respiratory_rate}
              onChange={(e) =>
                handleInputChange("growth", "respiratory_rate", e.target.value)
              }
              placeholder="30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              TCB
            </label>
            <Input
              type="text"
              value={formData.growth.tcb}
              onChange={(e) =>
                handleInputChange("growth", "tcb", e.target.value)
              }
              placeholder="0.0"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.growth.breastfeeding}
                onChange={(e) =>
                  handleInputChange("growth", "breastfeeding", e.target.checked)
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Currently Breastfeeding
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Vaccinations */}
      <div className="border-t pt-6">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
          Vaccinations
        </h4>
        <div className="space-y-4">
          {formData.vaccines.map((vaccine, index) => (
            <div
              key={`${vaccine.name}-${vaccine.dose_no}`}
              className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={vaccine.administered}
                    onChange={(e) =>
                      handleVaccineToggle(index, e.target.checked)
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {vaccine.displayLabel}
                  </span>
                </label>
              </div>

              {vaccine.administered && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Lot/Batch Number
                    </label>
                    <Input
                      type="text"
                      value={vaccine.lot_number}
                      onChange={(e) =>
                        handleVaccineChange(index, "lot_number", e.target.value)
                      }
                      placeholder="Auto-filled from FEFO inventory"
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Expiry Date
                    </label>
                    <Input
                      type="date"
                      value={vaccine.expiry_date}
                      onChange={(e) =>
                        handleVaccineChange(
                          index,
                          "expiry_date",
                          e.target.value,
                        )
                      }
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Site of Injection
                    </label>
                    <select
                      value={vaccine.site}
                      onChange={(e) =>
                        handleVaccineChange(index, "site", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    >
                      {SITE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Route of Injection
                    </label>
                    <select
                      value={vaccine.route}
                      onChange={(e) =>
                        handleVaccineChange(index, "route", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    >
                      {ROUTE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Remarks */}
      <div className="border-t pt-6">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
          Remarks & Notes
        </h4>
        <textarea
          value={formData.remarks}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, remarks: e.target.value }))
          }
          placeholder="Enter healthcare worker notes, observations, recommendations..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
        />
      </div>

      {/* Form Actions */}
      <div className="form-actions-standardized">
        <Button
          type="button"
          variant="cancel"
          actionRole="cancel"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" actionRole="primary" disabled={loading}>
          {loading ? "Saving..." : "Save Visit Record"}
        </Button>
      </div>
    </form>
  );
}
