import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Button, Modal, Input, Select, Alert } from "../UI";
import { SkeletonTable, SkeletonPageHeader } from "../UI/SkeletonLoader";
import apiClient from "../../utils/api";
import { matchesTokenizedTextSearch } from "../../utils/infantIdentity";

export const PatientList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    gender: "",
    address: "",
    parentName: "",
    contactNumber: "",
    healthCenter: "",
  });

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getInfants();

      // Transform data for display
      const transformedData = data.map((patient) => ({
        id: patient.id,
        name: patient.name || "N/A",
        age: calculateAge(patient.dob),
        gender: patient.gender || "N/A",
        parentName: patient.parent_name || "N/A",
        contactNumber: patient.contact_number || "N/A",
        lastVisit: patient.last_visit
          ? new Date(patient.last_visit).toLocaleDateString()
          : "N/A",
        status: getPatientStatus(patient),
        ...patient,
      }));

      setPatients(transformedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const calculateAge = (dob) => {
    if (!dob) return "N/A";
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

    if (age < 1) {
      const months =
        today.getMonth() -
        birthDate.getMonth() +
        12 * (today.getFullYear() - birthDate.getFullYear());
      return `${months} months`;
    }

    return `${age} years`;
  };

  const getPatientStatus = (patient) => {
    if (!patient.last_visit) return "New";

    const lastVisit = new Date(patient.last_visit);
    const today = new Date();
    const daysSinceLastVisit = Math.floor(
      (today - lastVisit) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastVisit <= 30) return "Active";
    if (daysSinceLastVisit <= 90) return "Follow-up";
    return "Inactive";
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleAddPatient = () => {
    setCurrentPatient(null);
    setFormData({
      name: "",
      dob: "",
      gender: "",
      address: "",
      parentName: "",
      contactNumber: "",
      healthCenter: "",
    });
    setIsModalOpen(true);
  };

  const handleEditPatient = (patient) => {
    setCurrentPatient(patient);
    setFormData({
      name: patient.name || "",
      dob: patient.dob ? new Date(patient.dob).toISOString().substr(0, 10) : "",
      gender: patient.gender || "",
      address: patient.address || "",
      parentName: patient.parent_name || "",
      contactNumber: patient.contact_number || "",
      healthCenter: patient.health_center || "",
    });
    setIsModalOpen(true);
  };

  const handleViewPatient = (patient) => {
    // Navigate to patient detail page or show detailed modal
    console.log("View patient:", patient);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    try {
      const patientData = {
        name: formData.name,
        dob: formData.dob,
        gender: formData.gender,
        address: formData.address,
        parent_name: formData.parentName,
        contact_number: formData.contactNumber,
        health_center: formData.healthCenter,
      };

      if (currentPatient) {
        // Update existing patient
        await apiClient.updateInfant(currentPatient.id, patientData);
      } else {
        // Create new patient
        await apiClient.createInfant(patientData);
      }

      setIsModalOpen(false);
      fetchPatients(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const columns = [
    { Header: "Name", accessor: "name" },
    { Header: "Age", accessor: "age" },
    { Header: "Gender", accessor: "gender" },
    { Header: "Parent", accessor: "parentName" },
    { Header: "Contact", accessor: "contactNumber" },
    { Header: "Last Visit", accessor: "lastVisit" },
    { Header: "Status", accessor: "status" },
    {
      Header: "Actions",
      Cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleViewPatient(row.original)}>
            View
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEditPatient(row.original)}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const filteredPatients = patients.filter(
    (patient) =>
      matchesTokenizedTextSearch(
        [patient.name, patient.parentName, patient.contactNumber]
          .filter(Boolean)
          .join(" "),
        searchTerm,
      ),
  );

  // Skeleton loading state
  if (loading) {
    return (
      <div className="patient-management p-6">
        <SkeletonPageHeader />
        <div className="mb-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
        </div>
        <SkeletonTable rows={10} columns={7} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-management p-6">
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
        <Button onClick={fetchPatients} variant="primary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="patient-management">
      <h1 className="text-2xl font-bold mb-6">Patient Management</h1>

      {/* Search and Add controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="w-full md:w-1/3">
          <Input
            type="text"
            placeholder="Search patients..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full"
          />
        </div>
        <Button onClick={handleAddPatient} className="whitespace-nowrap">
          + Add New Patient
        </Button>
      </div>

      {/* Patient Table */}
      <DataTable
        columns={columns}
        data={filteredPatients}
        pagination
        pageSize={10}
      />

      {/* Patient Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentPatient ? "Edit Patient" : "Add New Patient"}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              required
            />
            <Input
              label="Date of Birth"
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleFormChange}
              required
            />
            <Select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={handleFormChange}
              required
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
            <Input
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleFormChange}
              required
            />
            <Input
              label="Parent Name"
              name="parentName"
              value={formData.parentName}
              onChange={handleFormChange}
              required
            />
            <Input
              label="Contact Number"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleFormChange}
              required
            />
            <Input
              label="Health Center"
              name="healthCenter"
              value={formData.healthCenter}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="cancel"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {currentPatient ? "Update Patient" : "Add Patient"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
