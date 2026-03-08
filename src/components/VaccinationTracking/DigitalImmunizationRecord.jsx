import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "../UI";
import {
  Download,
  Printer,
  Share2,
  Edit,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  MapPin,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export const DigitalImmunizationRecord = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showVaccinationModal, setShowVaccinationModal] = useState(false);
  const [formData, setFormData] = useState({
    vaccine: "",
    dose: "",
    dateGiven: "",
    batchNumber: "",
    administeredBy: "",
    site: "",
    sideEffects: "",
    notes: "",
  });

  useEffect(() => {
    // Load patients from API
    loadPatients();
  }, []);

  const loadPatients = async () => {
    // Mock data for demonstration
    const mockPatients = [
      {
        id: "INF-2023-001",
        name: "Baby Alex Santos",
        dateOfBirth: "2023-05-01",
        sex: "Male",
        address: "123 Main St, Manila",
        motherName: "Maria Santos",
        fatherName: "Juan Santos",
        healthCenter: "Barangay San Nicolas",
        familyNo: "FAM-2023-045",
        birthWeight: "3.2 kg",
        birthHeight: "49 cm",
        vaccinationHistory: [
          {
            id: 1,
            vaccine: "BCG Vaccine",
            dose: "1",
            schedule: "At Birth",
            dueDate: "2023-05-01",
            dateGiven: "2023-05-01",
            status: "completed",
            batchNumber: "BCG-2023-001",
            administeredBy: "Dr. Dela Cruz",
            site: "Left arm",
            sideEffects: "None",
            remarks: "At birth",
          },
          {
            id: 2,
            vaccine: "Hepatitis B Vaccine",
            dose: "1",
            schedule: "At Birth",
            dueDate: "2023-05-01",
            dateGiven: "2023-05-01",
            status: "completed",
            batchNumber: "HEP-2023-001",
            administeredBy: "Dr. Dela Cruz",
            site: "Right thigh",
            sideEffects: "None",
            remarks: "At birth",
          },
          {
            id: 3,
            vaccine: "Pentavalent Vaccine",
            dose: "DPT 1",
            schedule: "1½ months",
            dueDate: "2023-06-15",
            dateGiven: "2023-06-15",
            status: "completed",
            batchNumber: "PENTA-2023-001",
            administeredBy: "Nurse Reyes",
            site: "Left thigh",
            sideEffects: "Mild fever",
            remarks: "Good",
          },
          {
            id: 4,
            vaccine: "Pentavalent Vaccine",
            dose: "DPT 2",
            schedule: "2½ months",
            dueDate: "2023-07-15",
            dateGiven: "2023-07-15",
            status: "completed",
            batchNumber: "PENTA-2023-002",
            administeredBy: "Nurse Reyes",
            site: "Right thigh",
            sideEffects: "None",
            remarks: "Good",
          },
          {
            id: 5,
            vaccine: "Pentavalent Vaccine",
            dose: "DPT 3",
            schedule: "3½ months",
            dueDate: "2023-08-15",
            dateGiven: null,
            status: "due",
            batchNumber: "",
            administeredBy: "",
            site: "",
            sideEffects: "",
            remarks: "",
          },
        ],
        vaccinationSchedule: [
          {
            vaccine: "BCG Vaccine",
            doses: 1,
            schedule: "At Birth",
            dueDate: "2023-05-01",
            status: "completed",
          },
          {
            vaccine: "Hepatitis B Vaccine",
            doses: 1,
            schedule: "At Birth",
            dueDate: "2023-05-01",
            status: "completed",
          },
          {
            vaccine: "Pentavalent Vaccine",
            doses: 3,
            schedule: "1½, 2½, 3½ months",
            dueDate: "2023-08-15",
            status: "in_progress",
          },
          {
            vaccine: "Oral Polio Vaccine",
            doses: 3,
            schedule: "1½, 2½, 3½ months",
            dueDate: "2023-08-15",
            status: "pending",
          },
          {
            vaccine: "Inactivated Polio Vaccine",
            doses: 2,
            schedule: "3½ & 9 months",
            dueDate: "2024-02-01",
            status: "pending",
          },
          {
            vaccine: "Pneumococcal Conjugate Vaccine",
            doses: 3,
            schedule: "1½, 2½, 3½ months",
            dueDate: "2023-08-15",
            status: "pending",
          },
          {
            vaccine: "Measles, Mumps, Rubella",
            doses: 2,
            schedule: "9 & 12 months",
            dueDate: "2024-05-01",
            status: "pending",
          },
        ],
      },
    ];
    setPatients(mockPatients);
  };

  const handleViewRecord = (patient) => {
    setSelectedPatient(patient);
    setShowRecordModal(true);
  };

  const handleRecordVaccination = (patient) => {
    setSelectedPatient(patient);
    setFormData({
      vaccine: "",
      dose: "",
      dateGiven: new Date().toISOString().split("T")[0],
      batchNumber: "",
      administeredBy: "",
      site: "",
      sideEffects: "",
      notes: "",
    });
    setShowVaccinationModal(true);
  };

  const handleSaveVaccination = async () => {
    // Add new vaccination record
    const newVaccination = {
      id: Date.now(),
      ...formData,
      status: "completed",
    };

    setSelectedPatient((prev) => ({
      ...prev,
      vaccinationHistory: [...prev.vaccinationHistory, newVaccination],
    }));

    setShowVaccinationModal(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "due":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "overdue":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "due":
        return "warning";
      case "overdue":
        return "danger";
      default:
        return "info";
    }
  };

  const generatePDF = () => {
    if (!selectedPatient) return;

    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("DIGITAL CHILD IMMUNIZATION RECORD BOOKLET", 20, 20);
    doc.setFontSize(12);
    doc.text("Barangay San Nicolas Health Center", 20, 30);

    // Personal Information
    doc.setFontSize(14);
    doc.text("PERSONAL INFORMATION", 20, 40);
    doc.setFontSize(10);
    doc.text(`Name: ${selectedPatient.name}`, 20, 50);
    doc.text(`Date of Birth: ${selectedPatient.dateOfBirth}`, 20, 55);
    doc.text(`Sex: ${selectedPatient.sex}`, 20, 60);
    doc.text(`Address: ${selectedPatient.address}`, 20, 65);
    doc.text(`Mother's Name: ${selectedPatient.motherName}`, 20, 70);
    doc.text(`Father's Name: ${selectedPatient.fatherName}`, 20, 75);
    doc.text(`Health Center: ${selectedPatient.healthCenter}`, 20, 80);
    doc.text(`Family No: ${selectedPatient.familyNo}`, 20, 85);
    doc.text(`Birth Weight: ${selectedPatient.birthWeight}`, 20, 90);
    doc.text(`Birth Height: ${selectedPatient.birthHeight}`, 20, 95);

    // Vaccination Records
    doc.setFontSize(14);
    doc.text("VACCINATION SCHEDULE & RECORDS", 20, 105);

    const tableData = selectedPatient.vaccinationHistory.map((v) => [
      v.vaccine,
      v.dose,
      v.schedule,
      v.dueDate,
      v.dateGiven || "Not Given",
      v.status,
      v.remarks,
    ]);

    doc.autoTable({
      startY: 115,
      head: [
        [
          "Vaccine",
          "Dose",
          "Schedule",
          "Due Date",
          "Given Date",
          "Status",
          "Remarks",
        ],
      ],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`${selectedPatient.name}_Immunization_Record.pdf`);
  };

  const shareRecord = () => {
    if (!selectedPatient) return;

    const shareData = {
      title: `${selectedPatient.name} - Immunization Record`,
      text: `View ${selectedPatient.name}'s immunization record.`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareData.text);
      alert("Record link copied to clipboard!");
    }
  };

  return (
    <div className="digital-immunization-record space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Digital Immunization Record
          </h1>
          <p className="text-gray-600 mt-1">
            Complete vaccination history and digital record booklet
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setShowRecordModal(true)}>
            <FileText className="w-5 h-5 mr-2" />
            View Sample Record
          </Button>
        </div>
      </div>

      {/* Patient List */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Patient Records</h3>
          <div className="flex space-x-2">
            <Input placeholder="Search patients..." className="w-64" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {patient.name}
                    </h4>
                    <p className="text-sm text-gray-600">{patient.id}</p>
                  </div>
                </div>
                <Badge variant="info">{patient.sex}</Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>DOB: {patient.dateOfBirth}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>{patient.address}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    Mother: {patient.motherName}
                  </span>
                  <span className="text-xs text-gray-500">
                    Age:{" "}
                    {Math.floor(
                      (new Date() - new Date(patient.dateOfBirth)) /
                        (1000 * 60 * 60 * 24 * 365.25),
                    )}{" "}
                    years
                  </span>
                </div>
              </div>

              <div className="mt-4 flex space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleViewRecord(patient)}
                >
                  View Record
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRecordVaccination(patient)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Record Vaccination
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Record Modal */}
      {showRecordModal && (
        <Modal
          title={`${selectedPatient?.name || "Patient"} - Immunization Record`}
          onClose={() => setShowRecordModal(false)}
          size="xl"
        >
          <div className="space-y-6">
            {/* Personal Information */}
            <Card>
              <h3 className="text-lg font-semibold mb-4">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <p className="mt-1 text-gray-900">{selectedPatient?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Date of Birth
                  </label>
                  <p className="mt-1 text-gray-900">
                    {selectedPatient?.dateOfBirth}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Sex
                  </label>
                  <p className="mt-1 text-gray-900">{selectedPatient?.sex}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <p className="mt-1 text-gray-900">
                    {selectedPatient?.address}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mother's Name
                  </label>
                  <p className="mt-1 text-gray-900">
                    {selectedPatient?.motherName}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Father's Name
                  </label>
                  <p className="mt-1 text-gray-900">
                    {selectedPatient?.fatherName}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Health Center
                  </label>
                  <p className="mt-1 text-gray-900">
                    {selectedPatient?.healthCenter}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Family No.
                  </label>
                  <p className="mt-1 text-gray-900">
                    {selectedPatient?.familyNo}
                  </p>
                </div>
              </div>
            </Card>

            {/* Vaccination Schedule */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Vaccination Schedule & Records
                </h3>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={generatePDF}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={shareRecord}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vaccine
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dose
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Given Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedPatient?.vaccinationHistory.map(
                      (vaccine, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {vaccine.vaccine}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {vaccine.dose}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {vaccine.schedule}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {vaccine.dueDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {vaccine.dateGiven || "Not Given"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(vaccine.status)}
                              <Badge variant={getStatusColor(vaccine.status)}>
                                {vaccine.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {vaccine.remarks}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Summary */}
            <Card>
              <h3 className="text-lg font-semibold mb-4">
                Vaccination Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {
                      selectedPatient?.vaccinationHistory.filter(
                        (v) => v.status === "completed",
                      ).length
                    }
                  </div>
                  <div className="text-sm text-green-800">Completed</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {
                      selectedPatient?.vaccinationHistory.filter(
                        (v) => v.status === "due",
                      ).length
                    }
                  </div>
                  <div className="text-sm text-yellow-800">Due</div>
                </div>
                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {
                      selectedPatient?.vaccinationHistory.filter(
                        (v) => v.status === "overdue",
                      ).length
                    }
                  </div>
                  <div className="text-sm text-red-800">Overdue</div>
                </div>
              </div>
            </Card>
          </div>
        </Modal>
      )}

      {/* Vaccination Recording Modal */}
      {showVaccinationModal && (
        <Modal
          title={`Record Vaccination for ${selectedPatient?.name}`}
          onClose={() => setShowVaccinationModal(false)}
          size="md"
        >
          <div className="space-y-4">
            <Select
              label="Vaccine"
              value={formData.vaccine}
              onChange={(e) =>
                setFormData({ ...formData, vaccine: e.target.value })
              }
              options={[
                { value: "BCG Vaccine", label: "BCG Vaccine (Tuberculosis)" },
                { value: "Hepatitis B Vaccine", label: "Hepatitis B Vaccine" },
                {
                  value: "Pentavalent Vaccine",
                  label: "Pentavalent Vaccine (DPT-HepB-HIB)",
                },
                {
                  value: "Oral Polio Vaccine",
                  label: "Oral Polio Vaccine (OPV)",
                },
                {
                  value: "Inactivated Polio Vaccine",
                  label: "Inactivated Polio Vaccine (IPV)",
                },
                {
                  value: "Pneumococcal Conjugate Vaccine",
                  label: "Pneumococcal Conjugate Vaccine (PCV)",
                },
                {
                  value: "Measles, Mumps, Rubella",
                  label: "Measles, Mumps, Rubella (MMR)",
                },
              ]}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Dose"
                value={formData.dose}
                onChange={(e) =>
                  setFormData({ ...formData, dose: e.target.value })
                }
                placeholder="e.g., DPT 1, OPV 2, etc."
              />
              <Input
                label="Date Given"
                type="date"
                value={formData.dateGiven}
                onChange={(e) =>
                  setFormData({ ...formData, dateGiven: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Batch Number"
                value={formData.batchNumber}
                onChange={(e) =>
                  setFormData({ ...formData, batchNumber: e.target.value })
                }
              />
              <Input
                label="Administered By"
                value={formData.administeredBy}
                onChange={(e) =>
                  setFormData({ ...formData, administeredBy: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Administration Site"
                value={formData.site}
                onChange={(e) =>
                  setFormData({ ...formData, site: e.target.value })
                }
                placeholder="e.g., Left thigh, Right arm"
              />
              <Input
                label="Side Effects"
                value={formData.sideEffects}
                onChange={(e) =>
                  setFormData({ ...formData, sideEffects: e.target.value })
                }
                placeholder="None observed"
              />
            </div>
            <Input
              label="Additional Notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional observations or remarks..."
              multiline
              rows={3}
            />
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="cancel"
              onClick={() => setShowVaccinationModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveVaccination}>
              Record Vaccination
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
