import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Input, Select, Modal } from "../UI";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Users,
  Calendar,
  Shield,
} from "lucide-react";
import { usePatientManagement } from "../../hooks/usePatientManagement";

export const PatientManagement = () => {
  const {
    patients,
    loading,
    error,
    addPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    getPatientHistory,
  } = usePatientManagement();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVaccine, setFilterVaccine] = useState("all");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    sex: "",
    address: "",
    motherName: "",
    fatherName: "",
    contactNumber: "",
    guardianConsent: false,
    medicalHistory: "",
    allergies: "",
  });

  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    // Initial load would be handled by the hook
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    searchPatients(e.target.value);
  };

  const handleAddPatient = () => {
    setIsEditing(false);
    setFormData({
      name: "",
      dateOfBirth: "",
      sex: "",
      address: "",
      motherName: "",
      fatherName: "",
      contactNumber: "",
      guardianConsent: false,
      medicalHistory: "",
      allergies: "",
    });
    setShowModal(true);
  };

  const handleEditPatient = (patient) => {
    setIsEditing(true);
    setFormData({
      name: patient.name,
      dateOfBirth: patient.dateOfBirth,
      sex: patient.sex,
      address: patient.address,
      motherName: patient.motherName,
      fatherName: patient.fatherName,
      contactNumber: patient.contactNumber,
      guardianConsent: patient.guardianConsent,
      medicalHistory: patient.medicalHistory,
      allergies: patient.allergies,
    });
    setSelectedPatient(patient);
    setShowModal(true);
  };

  const handleSavePatient = async () => {
    if (isEditing) {
      await updatePatient(selectedPatient.id, formData);
    } else {
      await addPatient(formData);
    }
    setShowModal(false);
  };

  const getStatusColor = (patient) => {
    const ageMonths = getAgeInMonths(patient.dateOfBirth);
    const completedVaccines =
      patient.vaccinationHistory?.filter((v) => v.status === "completed")
        .length || 0;
    const totalVaccines = patient.vaccinationSchedule?.length || 0;

    if (completedVaccines === totalVaccines) return "success";
    if (ageMonths > 24 && completedVaccines < totalVaccines * 0.8)
      return "danger";
    if (patient.vaccinationHistory?.some((v) => v.status === "overdue"))
      return "warning";
    return "info";
  };

  const getAgeInMonths = (dob) => {
    const birthDate = new Date(dob);
    const today = new Date();
    const diffTime = Math.abs(today - birthDate);
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    return diffMonths;
  };

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.motherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.contactNumber.includes(searchTerm);

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "up-to-date" &&
        getStatusColor(patient) === "success") ||
      (filterStatus === "overdue" && getStatusColor(patient) === "warning") ||
      (filterStatus === "critical" && getStatusColor(patient) === "danger");

    return matchesSearch && matchesStatus;
  });

  const patientColumns = [
    { Header: "Patient Name", accessor: "name" },
    { Header: "Age", accessor: "age" },
    { Header: "Sex", accessor: "sex" },
    { Header: "Contact", accessor: "contactNumber" },
    { Header: "Status", accessor: "status" },
    { Header: "Last Visit", accessor: "lastVisit" },
    { Header: "Actions", accessor: "actions" },
  ];

  return (
    <div className="patient-management space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Patient Management
          </h1>
          <p className="text-gray-600 mt-1">
            Secure patient record handling and vaccination history tracking
          </p>
        </div>
        <Button variant="primary" onClick={handleAddPatient}>
          <Plus className="w-5 h-5 mr-2" />
          Add New Patient
        </Button>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "list"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Patient List
          </button>
          <button
            onClick={() => setActiveTab("consent")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "consent"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Consent Tracking
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "analytics"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Analytics
          </button>
        </div>
      </Card>

      {/* Patient List Tab */}
      {activeTab === "list" && (
        <>
          {/* Filters and Search */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search patients by name, parent, or contact..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "up-to-date", label: "Up to Date" },
                  { value: "overdue", label: "Overdue" },
                  { value: "critical", label: "Critical" },
                ]}
              />
              <Select
                value={filterVaccine}
                onChange={(e) => setFilterVaccine(e.target.value)}
                options={[
                  { value: "all", label: "All Vaccines" },
                  { value: "bcg", label: "BCG" },
                  { value: "hepb", label: "Hepatitis B" },
                  { value: "penta", label: "Pentavalent" },
                  { value: "opv", label: "OPV" },
                  { value: "ipv", label: "IPV" },
                  { value: "pcv", label: "PCV" },
                  { value: "mmr", label: "MMR" },
                ]}
              />
            </div>
          </Card>

          {/* Patient Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Due
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {patient.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Mother: {patient.motherName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getAgeInMonths(patient.dateOfBirth)} months
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.contactNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusColor(patient)}>
                          {getStatusColor(patient) === "success"
                            ? "Up to Date"
                            : getStatusColor(patient) === "warning"
                              ? "Overdue"
                              : getStatusColor(patient) === "danger"
                                ? "Critical"
                                : "Info"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.nextVaccination?.date || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditPatient(patient)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deletePatient(patient.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Consent Tracking Tab */}
      {activeTab === "consent" && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">
                    Consent Given
                  </p>
                  <p className="text-2xl font-bold text-green-900">85%</p>
                </div>
                <Shield className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900">12%</p>
                </div>
                <Calendar className="w-12 h-12 text-yellow-500" />
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Not Given</p>
                  <p className="text-2xl font-bold text-red-900">3%</p>
                </div>
                <Users className="w-12 h-12 text-red-500" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {patients.length}
              </div>
              <div className="text-sm text-gray-600">Total Patients</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {patients.filter((p) => getStatusColor(p) === "success").length}
              </div>
              <div className="text-sm text-gray-600">Up to Date</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {patients.filter((p) => getStatusColor(p) === "warning").length}
              </div>
              <div className="text-sm text-gray-600">Overdue</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {patients.filter((p) => getStatusColor(p) === "danger").length}
              </div>
              <div className="text-sm text-gray-600">Critical</div>
            </div>
          </div>
        </Card>
      )}

      {/* Patient Modal */}
      {showModal && (
        <Modal
          title={isEditing ? "Edit Patient Record" : "Add New Patient"}
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Sex"
                value={formData.sex}
                onChange={(e) =>
                  setFormData({ ...formData, sex: e.target.value })
                }
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
                required
              />
              <Input
                label="Contact Number"
                value={formData.contactNumber}
                onChange={(e) =>
                  setFormData({ ...formData, contactNumber: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Mother's Name"
                value={formData.motherName}
                onChange={(e) =>
                  setFormData({ ...formData, motherName: e.target.value })
                }
                required
              />
              <Input
                label="Father's Name"
                value={formData.fatherName}
                onChange={(e) =>
                  setFormData({ ...formData, fatherName: e.target.value })
                }
              />
            </div>
            <Input
              label="Address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Medical History"
                value={formData.medicalHistory}
                onChange={(e) =>
                  setFormData({ ...formData, medicalHistory: e.target.value })
                }
                placeholder="Any medical conditions, previous vaccinations, etc."
              />
              <Input
                label="Allergies"
                value={formData.allergies}
                onChange={(e) =>
                  setFormData({ ...formData, allergies: e.target.value })
                }
                placeholder="Known allergies to vaccines or medications"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="guardianConsent"
                checked={formData.guardianConsent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    guardianConsent: e.target.checked,
                  })
                }
              />
              <label
                htmlFor="guardianConsent"
                className="text-sm text-gray-700"
              >
                Guardian consent obtained for vaccination
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="cancel" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSavePatient}>
              {isEditing ? "Update Patient" : "Add Patient"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Selected Patient Details Modal */}
      {selectedPatient && (
        <Modal
          title={`${selectedPatient.name} - Vaccination History`}
          onClose={() => setSelectedPatient(null)}
          size="xl"
        >
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Personal Information
                </h4>
                <p>
                  <strong>Name:</strong> {selectedPatient.name}
                </p>
                <p>
                  <strong>DOB:</strong> {selectedPatient.dateOfBirth}
                </p>
                <p>
                  <strong>Age:</strong>{" "}
                  {getAgeInMonths(selectedPatient.dateOfBirth)} months
                </p>
                <p>
                  <strong>Sex:</strong> {selectedPatient.sex}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Contact Information
                </h4>
                <p>
                  <strong>Contact:</strong> {selectedPatient.contactNumber}
                </p>
                <p>
                  <strong>Mother:</strong> {selectedPatient.motherName}
                </p>
                <p>
                  <strong>Father:</strong> {selectedPatient.fatherName}
                </p>
                <p>
                  <strong>Address:</strong> {selectedPatient.address}
                </p>
              </div>
            </div>

            {/* Vaccination History */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">
                Vaccination History
              </h4>
              <div className="space-y-2">
                {selectedPatient.vaccinationHistory?.map((vaccine, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{vaccine.name}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {vaccine.dose}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">
                        {vaccine.dateGiven}
                      </span>
                      <Badge
                        variant={
                          vaccine.status === "completed" ? "success" : "warning"
                        }
                      >
                        {vaccine.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
