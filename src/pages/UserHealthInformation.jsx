import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Alert,
  PageHeader,
  PageContainer,
  TextInput,
  FormActions,
} from "../components/UI";
import apiClient from "../utils/api";
import { Activity, ArrowLeft, Plus, Loader2 } from "lucide-react";
import { trackEvent } from "../utils/telemetry";

const unwrapApiData = (response) => response?.data ?? response ?? null;

const toNullableNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const calculateAgeInDays = (dob, measurementDate) => {
  if (!dob || !measurementDate) {
    return null;
  }

  const birthDate = new Date(dob);
  const recordedDate = new Date(measurementDate);
  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(recordedDate.getTime())
  ) {
    return null;
  }

  return Math.floor(
    (recordedDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24),
  );
};

const formatRecordAge = (ageInDays) => {
  const parsedAgeInDays = Number(ageInDays);
  if (!Number.isFinite(parsedAgeInDays) || parsedAgeInDays < 0) {
    return "N/A";
  }

  if (parsedAgeInDays < 30) {
    return `${parsedAgeInDays} day${parsedAgeInDays === 1 ? "" : "s"}`;
  }

  const ageInMonths = Math.floor(parsedAgeInDays / 30.44);
  return `${ageInMonths} month${ageInMonths === 1 ? "" : "s"}`;
};

const normalizeHealthRecord = (record = {}) => ({
  ...record,
  date: record.measurement_date || record.date || null,
  height: record.length_cm ?? record.height ?? null,
  weight: record.weight_kg ?? record.weight ?? null,
  headCircumference:
    record.head_circumference_cm ??
    record.headCircumference ??
    record.head_circumference ??
    null,
  temperature: record.temperature_celsius ?? record.temperature ?? null,
  notes: record.notes ?? "",
  recordedBy: record.measured_by_username ?? record.recordedBy ?? null,
  age: formatRecordAge(record.age_in_days),
});

export default function UserHealthInformation() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const [child, setChild] = useState(null);
  const [healthRecords, setHealthRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newRecord, setNewRecord] = useState({
    date: "",
    height: "",
    weight: "",
    headCircumference: "",
    temperature: "",
    notes: "",
  });

  const fetchChildData = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.getInfant(childId);
      setChild(unwrapApiData(response));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [childId]);

  const fetchHealthRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getHealthRecordsByInfant(childId);
      const records = Array.isArray(response)
        ? response
        : unwrapApiData(response) || [];
      setHealthRecords(records.map(normalizeHealthRecord));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    if (childId) {
      fetchChildData();
      fetchHealthRecords();
    }
  }, [childId, fetchChildData, fetchHealthRecords]);

  useEffect(() => {
    if (child) {
      trackEvent("health_information_viewed", { childId: child.id });
    }
  }, [child]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewRecord((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const ageInDays = calculateAgeInDays(child?.dob, newRecord.date);

      if (ageInDays === null || ageInDays < 0) {
        setError(
          "Unable to save this record because the child age could not be calculated.",
        );
        return;
      }

      setError(null);
      await apiClient.createGrowthRecord({
        patient_id: Number(childId),
        measurement_date: newRecord.date,
        age_in_days: ageInDays,
        length_cm: toNullableNumber(newRecord.height),
        weight_kg: toNullableNumber(newRecord.weight),
        head_circumference_cm: toNullableNumber(newRecord.headCircumference),
        temperature_celsius: toNullableNumber(newRecord.temperature),
        notes: newRecord.notes?.trim() || null,
      });
      setNewRecord({
        date: "",
        height: "",
        weight: "",
        headCircumference: "",
        temperature: "",
        notes: "",
      });
      trackEvent("health_record_added", { childId });
      await fetchHealthRecords();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return "Unknown";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return `${age} years`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading && !child) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
            Loading health records...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
        <Button
          onClick={() => {
            void fetchChildData();
            void fetchHealthRecords();
          }}
          className="w-full"
        >
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PageHeader - Standardized violet gradient design matching My Children module */}
      <PageHeader
        title="Health Information"
        subtitle={`${child?.first_name} ${child?.last_name} - ${calculateAge(child?.dob)}`}
        icon={<Activity className="w-8 h-8 text-white" />}
        actions={
          <Button onClick={() => navigate(-1)} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Add New Record */}
          <Card title="Add New Health Record">
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-form-row-2">
                <div className="admin-field-group">
                  <TextInput
                    label="Date"
                    type="date"
                    name="date"
                    value={newRecord.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="admin-field-group">
                  <TextInput
                    label="Height (cm)"
                    type="number"
                    name="height"
                    value={newRecord.height}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="e.g. 50.5"
                  />
                </div>
                <div className="admin-field-group">
                  <TextInput
                    label="Weight (kg)"
                    type="number"
                    name="weight"
                    value={newRecord.weight}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="e.g. 3.5"
                  />
                </div>
                <div className="admin-field-group">
                  <TextInput
                    label="Head Circumference (cm)"
                    type="number"
                    name="headCircumference"
                    value={newRecord.headCircumference}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="e.g. 35.0"
                  />
                </div>
                <div className="admin-field-group">
                  <TextInput
                    label={"Temperature (\u00B0C)"}
                    type="number"
                    name="temperature"
                    value={newRecord.temperature}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="e.g. 36.5"
                  />
                </div>
              </div>

              <div className="admin-field-group">
                <label className="admin-field-label">Notes</label>
                <textarea
                  name="notes"
                  value={newRecord.notes}
                  onChange={handleInputChange}
                  rows="3"
                  className="admin-textarea"
                  placeholder="Any observations or concerns..."
                />
              </div>

              <FormActions>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Health Record
                </Button>
              </FormActions>
            </form>
          </Card>

          {/* Health Records History */}
          <PageContainer title="Health Records History">
            {healthRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-4" aria-hidden="true">
                  {"\u{1F4CB}"}
                </div>
                <p className="text-lg font-medium">
                  No health records found for this child.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {healthRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-100 dark:border-gray-700 rounded-2xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatDate(record.date)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Recorded by:{" "}
                          <span className="font-medium text-primary-600 dark:text-primary-400">
                            {record.recordedBy || "Health Worker"}
                          </span>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold rounded-full uppercase tracking-wider">
                        Age: {record.age}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Height
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white">
                          {record.height ?? "N/A"}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            cm
                          </span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Weight
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white">
                          {record.weight ?? "N/A"}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            kg
                          </span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Head Circ.
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white">
                          {record.headCircumference ?? "N/A"}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            cm
                          </span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Temp.
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white">
                          {record.temperature ?? "N/A"}{" "}
                          <span className="text-xs font-normal text-gray-500">
                              {"\u00B0C"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {record.notes && (
                      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                          Notes
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {record.notes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </PageContainer>
        </div>

        <div className="space-y-6">
          {/* Child Information Summary */}
          <Card title="Child Information">
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">
                    {child?.sex === "M" ? "👦" : "👧"}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    {child?.first_name} {child?.last_name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {calculateAge(child?.dob)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Date of Birth
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDate(child?.dob)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Sex</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {child?.sex === "M" ? "Male" : "Female"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Birth Weight
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {child?.birth_weight || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Birth Height
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {child?.birth_height || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    Blood Type
                  </span>
                  <span className="font-semibold text-primary-600 dark:text-primary-400">
                    {child?.blood_type || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Growth Charts Placeholder */}
          <Card title="Growth Charts">
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <Activity className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Growth charts visualization will be available in the next
                update.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
