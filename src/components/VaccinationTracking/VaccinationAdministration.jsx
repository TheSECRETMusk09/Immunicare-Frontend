import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input, Select, Alert } from "../UI";
import {
  Syringe,
  Calendar,
  User,
  Thermometer,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  Eye,
} from "lucide-react";

export const VaccinationAdministration = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [batchInfo, setBatchInfo] = useState(null);
  const [adminFormData, setAdminFormData] = useState({
    batchNumber: "",
    dosage: "",
    route: "",
    site: "",
    timeGiven: "",
    temperature: "",
    weight: "",
    nurseSignature: "",
    sideEffects: "",
    parentConsent: false,
  });

  useEffect(() => {
    // Load data from API
    loadTodaysSchedule();
    loadPatients();
  }, []);

  const loadTodaysSchedule = async () => {
    // Mock data for demonstration
    const today = new Date().toISOString().split("T")[0];
    const mockSchedule = [
      {
        id: 1,
        patientId: "INF-001",
        patientName: "Baby Alex Santos",
        age: "8 months",
        weight: "8.5 kg",
        scheduledVaccines: [
          {
            name: "Pentavalent (DPT 3)",
            dose: "1",
            route: "IM",
            site: "Left thigh",
          },
          { name: "OPV 3", dose: "2 drops", route: "Oral", site: "Mouth" },
          { name: "PCV 3", dose: "1", route: "IM", site: "Right thigh" },
        ],
        status: "pending",
        appointmentTime: "10:00 AM",
        nurse: "J. Dela Cruz",
      },
      {
        id: 2,
        patientId: "INF-002",
        patientName: "Maria Gonzales",
        age: "12 months",
        weight: "9.2 kg",
        scheduledVaccines: [
          { name: "MMR 1", dose: "1", route: "SC", site: "Left arm" },
        ],
        status: "pending",
        appointmentTime: "10:30 AM",
        nurse: "A. Reyes",
      },
    ];
    setTodaysSchedule(mockSchedule);
  };

  const loadPatients = async () => {
    // Mock patient data
    const mockPatients = [
      {
        id: "INF-001",
        name: "Baby Alex Santos",
        dateOfBirth: "2023-05-01",
        age: "8 months",
        weight: "8.5 kg",
        sex: "Male",
        address: "123 Main St, Manila",
        motherName: "Maria Santos",
        lastVisit: "2023-07-15",
        nextDue: "2024-02-01 (MMR 1)",
        vaccinationHistory: [
          { name: "BCG", date: "2023-05-01", status: "completed" },
          { name: "Hep B", date: "2023-05-01", status: "completed" },
          { name: "DPT 1", date: "2023-06-15", status: "completed" },
          { name: "DPT 2", date: "2023-07-15", status: "completed" },
        ],
      },
    ];
    setPatients(mockPatients);
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setShowAdminModal(true);
    setAdminFormData({
      ...adminFormData,
      timeGiven: new Date().toLocaleTimeString("en-US", { hour12: false }),
      temperature: patient.weight, // Default to patient weight
      weight: patient.weight,
    });
  };

  const handleViewBatchInfo = (vaccine) => {
    setSelectedVaccine(vaccine);
    // Mock batch information
    setBatchInfo({
      name: vaccine.name,
      availableBatches: [
        {
          batchNumber: "DT-2024-001",
          expiryDate: "2024-03-15",
          stock: 45,
          manufacturer: "GSK",
          storageTemp: "2-8°C",
        },
        {
          batchNumber: "DT-2024-002",
          expiryDate: "2024-04-20",
          stock: 23,
          manufacturer: "GSK",
          storageTemp: "2-8°C",
        },
      ],
      recommendedDosage: vaccine.dose,
      administrationRoute: vaccine.route,
      injectionSite: vaccine.site,
    });
    setShowBatchModal(true);
  };

  const handleRecordVaccination = async () => {
    // Record vaccination logic
    console.log("Recording vaccination:", {
      patient: selectedPatient,
      vaccine: selectedVaccine,
      batch: adminFormData.batchNumber,
      details: adminFormData,
    });

    // Update schedule status
    setTodaysSchedule((prev) =>
      prev.map((app) =>
        app.patientId === selectedPatient.id
          ? { ...app, status: "completed" }
          : app,
      ),
    );

    setShowAdminModal(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "overdue":
        return "danger";
      default:
        return "info";
    }
  };

  const getVaccineIcon = (vaccineName) => {
    if (vaccineName.includes("Pentavalent")) return "💉";
    if (vaccineName.includes("OPV")) return "🩹";
    if (vaccineName.includes("MMR")) return "🛡️";
    if (vaccineName.includes("BCG")) return "🦠";
    if (vaccineName.includes("Hepatitis")) return "💉";
    return "💉";
  };

  const TodaySchedule = () => (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Today's Vaccination Schedule</h3>
        <div className="text-sm text-gray-600">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <div className="space-y-4">
        {todaysSchedule.map((appointment) => (
          <div
            key={appointment.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">
                    {appointment.patientName}
                  </h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>ID: {appointment.patientId}</span>
                    <span>Age: {appointment.age}</span>
                    <span>Weight: {appointment.weight}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Nurse: {appointment.nurse}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {appointment.appointmentTime}
                </div>
                <div className="text-sm text-gray-500">Scheduled</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">
                  Scheduled Vaccines:
                </h5>
                <div className="space-y-2">
                  {appointment.scheduledVaccines.map((vaccine, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {getVaccineIcon(vaccine.name)}
                        </span>
                        <div>
                          <div className="font-medium">{vaccine.name}</div>
                          <div className="text-xs text-gray-600">
                            {vaccine.dose} | {vaccine.route} | {vaccine.site}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewBatchInfo(vaccine)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Batch Info
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="font-medium text-gray-900 mb-2">
                  Patient Information:
                </h5>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>
                    Address:{" "}
                    {patients.find((p) => p.id === appointment.patientId)
                      ?.address || "N/A"}
                  </div>
                  <div>
                    Mother:{" "}
                    {patients.find((p) => p.id === appointment.patientId)
                      ?.motherName || "N/A"}
                  </div>
                  <div>
                    Last Visit:{" "}
                    {patients.find((p) => p.id === appointment.patientId)
                      ?.lastVisit || "N/A"}
                  </div>
                  <div>
                    Next Due:{" "}
                    {appointment.patientId === "INF-001"
                      ? "MMR 1 - Feb 1, 2024"
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="primary"
                onClick={() =>
                  handleSelectPatient(
                    patients.find((p) => p.id === appointment.patientId),
                  )
                }
              >
                <Syringe className="w-4 h-4 mr-2" />
                Administer Vaccines
              </Button>
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                View Full Record
              </Button>
            </div>
          </div>
        ))}

        {todaysSchedule.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            No vaccination appointments scheduled for today
          </div>
        )}
      </div>
    </Card>
  );

  const PatientQueue = () => (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Patient Queue</h3>
        <div className="flex space-x-2">
          <Badge variant="success">3 Completed</Badge>
          <Badge variant="warning">2 Pending</Badge>
          <Badge variant="danger">0 Overdue</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vaccines
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {todaysSchedule.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {appointment.patientName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {appointment.patientId} • {appointment.age}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {appointment.appointmentTime}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {appointment.scheduledVaccines.length} vaccines
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getStatusColor(appointment.status)}>
                    {appointment.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      handleSelectPatient(
                        patients.find((p) => p.id === appointment.patientId),
                      )
                    }
                  >
                    Administer
                  </Button>
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const MonitoringDashboard = () => (
    <Card>
      <h3 className="text-lg font-semibold mb-4">
        Post-Vaccination Monitoring
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">
                Immediate Reactions
              </p>
              <p className="text-2xl font-bold text-green-900">0</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">
                Expected Reactions
              </p>
              <p className="text-2xl font-bold text-yellow-900">3</p>
            </div>
            <Thermometer className="w-12 h-12 text-yellow-500 opacity-50" />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">
                Next Appointments
              </p>
              <p className="text-2xl font-bold text-blue-900">5</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-500 opacity-50" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Current Monitoring</h4>
        {todaysSchedule
          .filter((app) => app.status === "pending")
          .map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">{appointment.patientName}</h4>
                  <p className="text-sm text-gray-600">
                    {appointment.scheduledVaccines
                      .map((v) => v.name)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="warning">Monitoring</Badge>
                <span className="text-sm text-gray-500">
                  30 min observation
                </span>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );

  return (
    <div className="vaccination-administration space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Vaccination Administration
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time patient management and vaccine administration
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Download className="w-5 h-5 mr-2" />
            Export Schedule
          </Button>
          <Button variant="primary">
            <Plus className="w-5 h-5 mr-2" />
            Add Patient
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule */}
        <div className="lg:col-span-2">
          <TodaySchedule />
        </div>

        {/* Monitoring */}
        <div className="lg:col-span-1">
          <MonitoringDashboard />
        </div>
      </div>

      {/* Patient Queue */}
      <PatientQueue />

      {/* Vaccination Administration Modal */}
      {showAdminModal && selectedPatient && (
        <Modal
          title={`Administer Vaccines to ${selectedPatient.name}`}
          onClose={() => setShowAdminModal(false)}
          size="lg"
        >
          <div className="space-y-6">
            {/* Patient Information */}
            <Card>
              <h4 className="font-semibold mb-3">Patient Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <p className="mt-1 text-gray-900">{selectedPatient.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Age
                  </label>
                  <p className="mt-1 text-gray-900">{selectedPatient.age}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Weight
                  </label>
                  <p className="mt-1 text-gray-900">{selectedPatient.weight}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Temperature
                  </label>
                  <Input
                    type="number"
                    value={adminFormData.temperature}
                    onChange={(e) =>
                      setAdminFormData({
                        ...adminFormData,
                        temperature: e.target.value,
                      })
                    }
                    placeholder="36.8"
                    suffix="°C"
                  />
                </div>
              </div>
            </Card>

            {/* Vaccine Selection */}
            <Card>
              <h4 className="font-semibold mb-3">Vaccine Administration</h4>
              <div className="space-y-4">
                {todaysSchedule
                  .find((app) => app.patientId === selectedPatient.id)
                  ?.scheduledVaccines.map((vaccine, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl">
                          {getVaccineIcon(vaccine.name)}
                        </span>
                        <div>
                          <h5 className="font-medium">{vaccine.name}</h5>
                          <p className="text-sm text-gray-600">
                            Dose: {vaccine.dose} | Route: {vaccine.route} |
                            Site: {vaccine.site}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewBatchInfo(vaccine)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Batch Info
                        </Button>
                        <Button variant="primary" size="sm">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Administer
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Administration Details */}
            <Card>
              <h4 className="font-semibold mb-3">Administration Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Batch Number
                  </label>
                  <Input
                    value={adminFormData.batchNumber}
                    onChange={(e) =>
                      setAdminFormData({
                        ...adminFormData,
                        batchNumber: e.target.value,
                      })
                    }
                    placeholder="e.g., DT-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Time Given
                  </label>
                  <Input
                    type="time"
                    value={adminFormData.timeGiven}
                    onChange={(e) =>
                      setAdminFormData({
                        ...adminFormData,
                        timeGiven: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nurse Signature
                  </label>
                  <Input
                    value={adminFormData.nurseSignature}
                    onChange={(e) =>
                      setAdminFormData({
                        ...adminFormData,
                        nurseSignature: e.target.value,
                      })
                    }
                    placeholder="J. Dela Cruz, RN"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Side Effects
                  </label>
                  <Input
                    value={adminFormData.sideEffects}
                    onChange={(e) =>
                      setAdminFormData({
                        ...adminFormData,
                        sideEffects: e.target.value,
                      })
                    }
                    placeholder="None observed"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="parentConsent"
                  checked={adminFormData.parentConsent}
                  onChange={(e) =>
                    setAdminFormData({
                      ...adminFormData,
                      parentConsent: e.target.checked,
                    })
                  }
                />
                <label
                  htmlFor="parentConsent"
                  className="text-sm text-gray-700"
                >
                  Parent/guardian consent obtained
                </label>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button variant="cancel" onClick={() => setShowAdminModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRecordVaccination}>
                Record Administration
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Information Modal */}
      {showBatchModal && batchInfo && (
        <Modal
          title={`${batchInfo.name} - Batch Information`}
          onClose={() => setShowBatchModal(false)}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Recommended Dosage
                </label>
                <p className="mt-1 text-gray-900">
                  {batchInfo.recommendedDosage}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Administration Route
                </label>
                <p className="mt-1 text-gray-900">
                  {batchInfo.administrationRoute}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Injection Site
                </label>
                <p className="mt-1 text-gray-900">{batchInfo.injectionSite}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Storage Temperature
                </label>
                <p className="mt-1 text-gray-900">2-8°C</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Available Batches</h4>
              <div className="space-y-3">
                {batchInfo.availableBatches.map((batch, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{batch.batchNumber}</div>
                      <div className="text-sm text-gray-600">
                        Expiry: {batch.expiryDate} | Stock: {batch.stock} vials
                      </div>
                      <div className="text-sm text-gray-600">
                        Manufacturer: {batch.manufacturer}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAdminFormData({
                          ...adminFormData,
                          batchNumber: batch.batchNumber,
                        });
                        setShowBatchModal(false);
                      }}
                    >
                      Select Batch
                    </Button>
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