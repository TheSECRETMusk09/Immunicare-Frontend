import { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:5000/api/patients";

export const usePatientManagement = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/all`);
      if (!response.ok) {
        throw new Error("Failed to fetch patients");
      }
      const data = await response.json();
      setPatients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addPatient = async (patientData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patientData),
      });
      if (!response.ok) {
        throw new Error("Failed to add patient");
      }
      await fetchPatients();
    } catch (err) {
      setError(err.message);
    }
  };

  const updatePatient = async (id, patientData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patientData),
      });
      if (!response.ok) {
        throw new Error("Failed to update patient");
      }
      await fetchPatients();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePatient = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/delete/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete patient");
      }
      await fetchPatients();
    } catch (err) {
      setError(err.message);
    }
  };

  const searchPatients = async (query) => {
    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${query}`);
      if (!response.ok) {
        throw new Error("Failed to search patients");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  const getPatientById = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch patient details");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const getPatientVaccinationHistory = async (patientId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${patientId}/vaccinations`);
      if (!response.ok) {
        throw new Error("Failed to fetch vaccination history");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  const addVaccinationRecord = async (patientId, vaccinationData) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/${patientId}/vaccinations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(vaccinationData),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to add vaccination record");
      }
      await fetchPatients();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

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
    addVaccinationRecord,
  };
};
