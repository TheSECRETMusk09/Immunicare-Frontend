import React, { useState, useEffect } from "react";
import { Card, Button, Modal, Select, Badge } from "../UI";
import {
  FileText,
  Download,
  Share2,
  Printer,
  Smartphone,
  Mail,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Plus,
  Eye,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export const CertificateGeneration = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateType, setCertificateType] = useState("official");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // Load data from API
    loadPatients();
    loadCertificates();
  }, []);

  const loadPatients = async () => {
    // Mock patient data
    const mockPatients = [
      {
        id: "INF-2023-001",
        name: "Baby Alex Santos",
        dateOfBirth: "2023-05-01",
        sex: "Male",
        address: "123 Main St, Manila",
        motherName: "Maria Santos",
        fatherName: "Juan Santos",
        healthCenter: "Barangay San Nicolas Health Center",
        familyNo: "FAM-2023-045",
        vaccinationHistory: [
          {
            name: "BCG Vaccine",
            status: "completed",
            dateGiven: "2023-05-01",
            batch: "BCG-2023-001",
          },
          {
            name: "Hepatitis B Vaccine",
            status: "completed",
            dateGiven: "2023-05-01",
            batch: "HEP-2023-001",
          },
          {
            name: "Pentavalent (DPT 1)",
            status: "completed",
            dateGiven: "2023-06-15",
            batch: "PENTA-2023-001",
          },
          {
            name: "Pentavalent (DPT 2)",
            status: "completed",
            dateGiven: "2023-07-15",
            batch: "PENTA-2023-002",
          },
          {
            name: "Pentavalent (DPT 3)",
            status: "pending",
            dateGiven: null,
            batch: "",
          },
          {
            name: "OPV 1",
            status: "completed",
            dateGiven: "2023-06-15",
            batch: "OPV-2023-001",
          },
          {
            name: "OPV 2",
            status: "completed",
            dateGiven: "2023-07-15",
            batch: "OPV-2023-002",
          },
          { name: "OPV 3", status: "pending", dateGiven: null, batch: "" },
          {
            name: "PCV 1",
            status: "completed",
            dateGiven: "2023-06-15",
            batch: "PCV-2023-001",
          },
          {
            name: "PCV 2",
            status: "completed",
            dateGiven: "2023-07-15",
            batch: "PCV-2023-002",
          },
          { name: "PCV 3", status: "pending", dateGiven: null, batch: "" },
          { name: "MMR 1", status: "pending", dateGiven: null, batch: "" },
          { name: "MMR 2", status: "pending", dateGiven: null, batch: "" },
        ],
      },
    ];
    setPatients(mockPatients);
  };

  const loadCertificates = async () => {
    // Mock certificate data
    const mockCertificates = [
      {
        id: 1,
        patientId: "INF-2023-001",
        patientName: "Baby Alex Santos",
        type: "Official Certificate",
        dateIssued: "2024-01-15",
        validUntil: "2025-01-15",
        status: "active",
        digitalSignature: "Verified",
        qrCode: "https://immunicare.gov.ph/verify/ABC123",
      },
      {
        id: 2,
        patientId: "INF-2023-001",
        patientName: "Baby Alex Santos",
        type: "Digital Wallet Pass",
        dateIssued: "2024-01-10",
        validUntil: "2025-01-10",
        status: "active",
        digitalSignature: "Verified",
        qrCode: "https://immunicare.gov.ph/wallet/XYZ789",
      },
    ];
    setCertificates(mockCertificates);
  };

  const handleGenerateCertificate = (patient) => {
    setSelectedPatient(patient);
    setShowCertificateModal(true);
  };

  const generatePDF = () => {
    if (!selectedPatient) return;

    const doc = new jsPDF();

    // Certificate Header
    doc.setFontSize(16);
    doc.setTextColor(22, 34, 57);
    doc.text("BARANGAY SAN NICOLAS HEALTH CENTER", 20, 30, { align: "center" });
    doc.setFontSize(14);
    doc.text("IMMUNIZATION CERTIFICATE", 20, 40, { align: "center" });

    // Decorative line
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(2);
    doc.line(20, 45, 190, 45);

    // Patient Information
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("This certifies that", 20, 60);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(selectedPatient.name.toUpperCase(), 20, 70);
    doc.setFont("helvetica", "normal");
    doc.text(
      `born on ${new Date(selectedPatient.dateOfBirth).toLocaleDateString()}`,
      20,
      80,
    );
    doc.text(
      "has received the following immunizations according to the Department of Health schedule:",
      20,
      90,
    );

    // Vaccination Table
    const completedVaccines = selectedPatient.vaccinationHistory.filter(
      (v) => v.status === "completed",
    );
    const tableData = completedVaccines.map((v) => [
      v.name,
      v.dateGiven,
      v.batch,
      "✅ Completed",
    ]);

    doc.autoTable({
      startY: 100,
      head: [["Vaccine", "Date Given", "Batch No.", "Status"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
      },
    });

    // Footer Information
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text("Date of Issue:", 20, finalY);
    doc.text(new Date().toLocaleDateString(), 60, finalY);
    doc.text("Valid Until:", 20, finalY + 10);
    doc.text(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      60,
      finalY + 10,
    );

    // Signatures
    doc.text("_________________________", 20, finalY + 30);
    doc.text("Dr. Juan Dela Cruz, MD", 20, finalY + 38);
    doc.text("Municipal Health Officer", 20, finalY + 46);
    doc.text("License No: MD-2010-12345", 20, finalY + 54);

    doc.text("_________________________", 120, finalY + 30);
    doc.text("Nurse Maria Santos, RN", 120, finalY + 38);
    doc.text("Vaccination Nurse", 120, finalY + 46);
    doc.text("License No: RN-2015-67890", 120, finalY + 54);

    // Digital Signature
    doc.setFillColor(34, 197, 94);
    doc.rect(20, finalY + 65, 50, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("Digital Signature: Verified", 22, finalY + 72);

    doc.save(`${selectedPatient.name}_Immunization_Certificate.pdf`);
  };

  const shareCertificate = () => {
    if (!selectedPatient) return;

    const shareData = {
      title: `${selectedPatient.name} - Immunization Certificate`,
      text: `View ${selectedPatient.name}'s immunization certificate.`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(shareData.text);
      alert("Certificate link copied to clipboard!");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "expired":
        return "danger";
      case "pending":
        return "warning";
      default:
        return "info";
    }
  };

  const getCertificateIcon = (type) => {
    switch (type) {
      case "Official Certificate":
        return "📄";
      case "Digital Wallet Pass":
        return "📱";
      case "Print-Friendly Version":
        return "🖨️";
      case "Summary Report":
        return "📊";
      default:
        return "📄";
    }
  };

  const CertificatePreview = () => (
    <div className="certificate-preview space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          IMMUNIZATION CERTIFICATE
        </h1>
        <p className="text-gray-600">Barangay San Nicolas Health Center</p>
      </div>

      {/* Patient Info */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2">Child Information</h4>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Name:</strong> {selectedPatient?.name}
              </p>
              <p>
                <strong>Date of Birth:</strong> {selectedPatient?.dateOfBirth}
              </p>
              <p>
                <strong>Sex:</strong> {selectedPatient?.sex}
              </p>
              <p>
                <strong>Address:</strong> {selectedPatient?.address}
              </p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Parent Information</h4>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Mother:</strong> {selectedPatient?.motherName}
              </p>
              <p>
                <strong>Father:</strong> {selectedPatient?.fatherName}
              </p>
              <p>
                <strong>Family No:</strong> {selectedPatient?.familyNo}
              </p>
              <p>
                <strong>Health Center:</strong> {selectedPatient?.healthCenter}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Vaccination Records */}
      <Card>
        <h4 className="font-semibold mb-4">Vaccination Records</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vaccine
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Given
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedPatient?.vaccinationHistory.map((vaccine, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {vaccine.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vaccine.dateGiven || "Not Given"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vaccine.batch || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={
                        vaccine.status === "completed" ? "success" : "warning"
                      }
                    >
                      {vaccine.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Certificate Actions */}
      <Card>
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-semibold">Certificate Actions</h4>
            <p className="text-sm text-gray-600">
              Choose how to access and share this certificate
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={generatePDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={shareCertificate}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="certificate-generation space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Certificate Generation
          </h1>
          <p className="text-gray-600 mt-1">
            Official vaccination certificates with digital signatures and
            verification
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Calendar className="w-5 h-5 mr-2" />
            View Expiry Calendar
          </Button>
          <Button variant="primary">
            <Plus className="w-5 h-5 mr-2" />
            Generate New Certificate
          </Button>
        </div>
      </div>

      {/* Certificate Types */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="font-semibold mb-2">Official Certificate</h3>
          <p className="text-sm text-gray-600 mb-4">
            Department of Health standard certificate with official signatures
          </p>
          <Button variant="outline" size="sm">
            Generate
          </Button>
        </Card>

        <Card className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">📱</div>
          <h3 className="font-semibold mb-2">Digital Wallet Pass</h3>
          <p className="text-sm text-gray-600 mb-4">
            Mobile wallet compatible digital certificate
          </p>
          <Button variant="outline" size="sm">
            Generate
          </Button>
        </Card>

        <Card className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">🖨️</div>
          <h3 className="font-semibold mb-2">Print-Friendly Version</h3>
          <p className="text-sm text-gray-600 mb-4">
            High-resolution printable certificate
          </p>
          <Button variant="outline" size="sm">
            Generate
          </Button>
        </Card>

        <Card className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="font-semibold mb-2">Summary Report</h3>
          <p className="text-sm text-gray-600 mb-4">
            Detailed vaccination summary report
          </p>
          <Button variant="outline" size="sm">
            Generate
          </Button>
        </Card>
      </div>

      {/* Patient Selection */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Select Patient</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {patient.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {patient.id} • {patient.age}
                    </p>
                  </div>
                </div>
                <Badge variant="info">{patient.sex}</Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div>Address: {patient.address}</div>
                <div>Mother: {patient.motherName}</div>
                <div>
                  Vaccines Completed:{" "}
                  {
                    patient.vaccinationHistory.filter(
                      (v) => v.status === "completed",
                    ).length
                  }
                  /13
                </div>
              </div>

              <div className="mt-4 flex space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleGenerateCertificate(patient)}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Generate Certificate
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-1" />
                  View History
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Certificate History */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Certificate History</h3>
          <div className="flex space-x-2">
            <Badge variant="success">2 Active</Badge>
            <Badge variant="warning">0 Expiring</Badge>
            <Badge variant="danger">0 Expired</Badge>
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
                  Certificate Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Issued
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valid Until
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
              {certificates.map((cert) => (
                <tr key={cert.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {cert.patientName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {cert.patientId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">
                        {getCertificateIcon(cert.type)}
                      </span>
                      <span className="text-sm font-medium">{cert.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cert.dateIssued}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cert.validUntil}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getStatusColor(cert.status)}>
                      {cert.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="w-4 h-4 mr-1" />
                      Share
                    </Button>
                    <Button variant="outline" size="sm">
                      <Printer className="w-4 h-4 mr-1" />
                      Print
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Certificate Generation Modal */}
      {showCertificateModal && (
        <Modal
          title={`Generate Certificate for ${selectedPatient?.name}`}
          onClose={() => setShowCertificateModal(false)}
          size="xl"
        >
          <div className="space-y-6">
            {/* Certificate Type Selection */}
            <Card>
              <h4 className="font-semibold mb-4">Select Certificate Type</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    value: "official",
                    label: "Official Certificate",
                    description:
                      "Department of Health standard certificate with official signatures",
                    icon: "📄",
                  },
                  {
                    value: "wallet",
                    label: "Digital Wallet Pass",
                    description: "Mobile wallet compatible digital certificate",
                    icon: "📱",
                  },
                  {
                    value: "print",
                    label: "Print-Friendly Version",
                    description: "High-resolution printable certificate",
                    icon: "🖨️",
                  },
                  {
                    value: "summary",
                    label: "Summary Report",
                    description: "Detailed vaccination summary report",
                    icon: "📊",
                  },
                ].map((type) => (
                  <div
                    key={type.value}
                    className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      id={type.value}
                      name="certificateType"
                      value={type.value}
                      checked={certificateType === type.value}
                      onChange={(e) => setCertificateType(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label
                      htmlFor={type.value}
                      className="flex items-center space-x-3 cursor-pointer"
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-gray-600">
                          {type.description}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </Card>

            {/* Preview */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">Certificate Preview</h4>
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </Button>
              </div>

              {showPreview && <CertificatePreview />}
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                variant="cancel"
                onClick={() => setShowCertificateModal(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={generatePDF}>
                <Download className="w-4 h-4 mr-2" />
                Generate Certificate
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
