import { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";

const unwrapData = (payload) => payload?.data ?? payload ?? [];

const splitFullName = (value = "") => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      first_name: "",
      middle_name: "",
      last_name: "",
    };
  }

  if (parts.length === 1) {
    return {
      first_name: parts[0],
      middle_name: "",
      last_name: parts[0],
    };
  }

  return {
    first_name: parts[0],
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    last_name: parts[parts.length - 1],
  };
};

const normalizePatientRecord = (record) => {
  const completedVaccinations = Number(record?.completed_vaccinations || 0);
  const pendingVaccinations = Number(record?.pending_vaccinations || 0);
  const synthesizedHistory = [
    ...Array.from({ length: completedVaccinations }, () => ({ status: "completed" })),
    ...Array.from({ length: pendingVaccinations }, () => ({ status: "pending" })),
  ];

  return {
    id: record?.id,
    name:
      [record?.first_name, record?.middle_name, record?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || record?.name || "",
    dateOfBirth: record?.dob || record?.dateOfBirth || "",
    sex: record?.sex || "",
    address: record?.address || "",
    motherName: record?.mother_name || record?.motherName || "",
    fatherName: record?.father_name || record?.fatherName || "",
    contactNumber:
      record?.cellphone_number ||
      record?.primary_contact ||
      record?.guardian_phone ||
      record?.contact ||
      "",
    guardianConsent: true,
    medicalHistory: record?.medical_history || "",
    allergies: Array.isArray(record?.allergies)
      ? record.allergies.map((item) => item?.allergen || item?.allergy_type).filter(Boolean).join(", ")
      : record?.allergies || "",
    vaccinationHistory: synthesizedHistory,
    vaccinationSchedule: Array.from(
      { length: completedVaccinations + pendingVaccinations },
      () => ({ status: "scheduled" }),
    ),
    nextVaccination: null,
    raw: record,
  };
};

const mapPatientPayloadToInfant = (patientData = {}) => {
  const { first_name, middle_name, last_name } = splitFullName(patientData.name);

  return {
    first_name,
    middle_name: middle_name || null,
    last_name,
    dob: patientData.dateOfBirth,
    sex: patientData.sex,
    address: patientData.address || null,
    mother_name: patientData.motherName || null,
    father_name: patientData.fatherName || null,
    cellphone_number: patientData.contactNumber || null,
  };
};

export const usePatientManagement = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getInfants();
      const normalizedPatients = unwrapData(response).map(normalizePatientRecord);
      setPatients(normalizedPatients);
      return normalizedPatients;
    } catch (err) {
      setError(err.message || "Failed to fetch patients");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addPatient = useCallback(
    async (patientData) => {
      try {
        setError(null);
        await apiClient.createInfant(mapPatientPayloadToInfant(patientData));
        await fetchPatients();
      } catch (err) {
        setError(err.message || "Failed to add patient");
        throw err;
      }
    },
    [fetchPatients],
  );

  const updatePatient = useCallback(
    async (id, patientData) => {
      try {
        setError(null);
        await apiClient.updateInfant(id, mapPatientPayloadToInfant(patientData));
        await fetchPatients();
      } catch (err) {
        setError(err.message || "Failed to update patient");
        throw err;
      }
    },
    [fetchPatients],
  );

  const deletePatient = useCallback(
    async (id) => {
      try {
        setError(null);
        await apiClient.deleteInfant(id);
        await fetchPatients();
      } catch (err) {
        setError(err.message || "Failed to delete patient");
        throw err;
      }
    },
    [fetchPatients],
  );

  const searchPatients = useCallback(async (query) => {
    if (!String(query || "").trim()) {
      return patients;
    }

    try {
      setError(null);
      const response = await apiClient.searchInfants(query);
      const normalizedPatients = unwrapData(response).map(normalizePatientRecord);
      setPatients(normalizedPatients);
      return normalizedPatients;
    } catch (err) {
      setError(err.message || "Failed to search patients");
      return [];
    }
  }, [patients]);

  const getPatientById = useCallback(async (id) => {
    try {
      setError(null);
      const response = await apiClient.getInfant(id);
      const patient = unwrapData(response);
      return patient ? normalizePatientRecord(patient) : null;
    } catch (err) {
      setError(err.message || "Failed to fetch patient details");
      return null;
    }
  }, []);

  const getPatientVaccinationHistory = useCallback(async (patientId) => {
    try {
      setError(null);
      const response = await apiClient.getVaccinationRecordsByInfant(patientId);
      return unwrapData(response);
    } catch (err) {
      setError(err.message || "Failed to fetch vaccination history");
      return [];
    }
  }, []);

  const addVaccinationRecord = useCallback(
    async (patientId, vaccinationData) => {
      try {
        setError(null);
        await apiClient.createVaccinationRecord({
          ...vaccinationData,
          infant_id: patientId,
          patient_id: patientId,
        });
        await fetchPatients();
      } catch (err) {
        setError(err.message || "Failed to add vaccination record");
        throw err;
      }
    },
    [fetchPatients],
  );

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return {
    patients,
    loading,
    error,
    addPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    getPatientById,
    getPatientVaccinationHistory,
    getPatientHistory: getPatientVaccinationHistory,
    addVaccinationRecord,
    refreshPatients: fetchPatients,
  };
};
