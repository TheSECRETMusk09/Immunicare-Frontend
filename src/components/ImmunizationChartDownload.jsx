import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";
import { Button, Card, PageHeader, Alert, LoadingSpinner } from "./UI";
import { Download, Printer, FileText } from "lucide-react";
import { isApprovedVaccineName } from "../constants/approvedVaccines";

/**
 * ImmunizationChartDownload Component
 *
 * This component displays and allows downloading of the official immunization chart
 * in the same format as the IMMUNIZATION CHART.docx document.
 *
 * Features:
 * - Displays personal information section
 * - Shows vaccination records at different milestones (6, 10, 14 weeks, 6, 9, 12 months)
 * - Download as PDF functionality
 * - Print functionality
 * - Health center management workflow integration
 */
export default function ImmunizationChartDownload({
  infantId,
  showViewMode = true,
}) {
  const [infant, setInfant] = useState(null);
  const [vaccinations, setVaccinations] = useState([]);
  const [growthRecords, setGrowthRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);

  const { guardianId } = require("../contexts/AuthContext").useAuth();

  // Visit templates matching the immunization chart document
  const visitTemplates = [
    {
      age: "6 WEEKS",
      title: "6 WEEKS",
      vaccines: [
        { name: "Penta Valent", doseNo: 1 },
        { name: "OPV 20-doses", doseNo: 1 },
        { name: "PCV 10", doseNo: 1 },
      ],
      vaccineCodes: ["Penta Valent", "OPV 20-doses", "PCV 10"],
      ageRange: { minWeeks: 5, maxWeeks: 7 },
    },
    {
      age: "10 WEEKS",
      title: "10 WEEKS",
      vaccines: [
        { name: "Penta Valent", doseNo: 2 },
        { name: "OPV 20-doses", doseNo: 2 },
        { name: "PCV 10", doseNo: 2 },
      ],
      vaccineCodes: ["Penta Valent", "OPV 20-doses", "PCV 10"],
      ageRange: { minWeeks: 9, maxWeeks: 11 },
    },
    {
      age: "14 WEEKS",
      title: "14 WEEKS",
      vaccines: [
        { name: "Penta Valent", doseNo: 3 },
        { name: "OPV 20-doses", doseNo: 3 },
        { name: "PCV 10", doseNo: 3 },
        { name: "IPV multi dose", doseNo: 1 },
      ],
      vaccineCodes: ["Penta Valent", "OPV 20-doses", "PCV 10", "IPV multi dose"],
      ageRange: { minWeeks: 13, maxWeeks: 15 },
    },
    {
      age: "6 MONTHS",
      title: "6 MONTHS",
      vaccines: [],
      vaccineCodes: [],
      ageRange: { minWeeks: 24, maxWeeks: 28 },
    },
    {
      age: "9 MONTHS",
      title: "9 MONTHS",
      vaccines: [
        { name: "Measles & Rubella (MR)", doseNo: 1 },
        { name: "IPV multi dose", doseNo: 2 },
      ],
      vaccineCodes: ["Measles & Rubella (MR)", "IPV multi dose"],
      ageRange: { minWeeks: 36, maxWeeks: 40 },
    },
    {
      age: "12 MONTHS",
      title: "12 MONTHS",
      vaccines: [{ name: "MMR", doseNo: 1 }],
      vaccineCodes: ["MMR"],
      ageRange: { minWeeks: 48, maxWeeks: 56 },
    },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch children if infantId not provided
      if (!infantId) {
        const childrenData = await apiClient.getInfantsByGuardian(guardianId);
        setChildren(childrenData.data || childrenData || []);
        if (childrenData.length > 0 && !selectedChild) {
          setSelectedChild(childrenData[0]);
        }
        return;
      }

      const [infantData, vaccinationData, growthData, appointmentData] =
        await Promise.all([
          apiClient.getInfant(infantId),
          apiClient.getVaccinationRecordsByInfant(infantId),
          apiClient.getGrowthRecordsByInfant(infantId),
          apiClient.getAppointmentsByInfant(infantId),
        ]);

      setInfant(infantData);
      setVaccinations(vaccinationData.data || vaccinationData || []);
      setGrowthRecords(growthData.data || growthData || []);
      setAppointments(appointmentData.data || appointmentData || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load immunization chart data");
    } finally {
      setLoading(false);
    }
  }, [infantId, guardianId, selectedChild]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (children.length > 0 && !infantId) {
      setSelectedChild(children[0]);
    }
  }, [children, infantId]);

  useEffect(() => {
    if (selectedChild) {
      const fetchChildData = async () => {
        try {
          const [infantData, vaccinationData, growthData, appointmentData] =
            await Promise.all([
              apiClient.getInfant(selectedChild.id),
              apiClient.getVaccinationRecordsByInfant(selectedChild.id),
              apiClient.getGrowthRecordsByInfant(selectedChild.id),
              apiClient.getAppointmentsByInfant(selectedChild.id),
            ]);

          setInfant(infantData);
          setVaccinations(vaccinationData.data || vaccinationData || []);
          setGrowthRecords(growthData.data || growthData || []);
          setAppointments(appointmentData.data || appointmentData || []);
        } catch (err) {
          console.error("Error fetching child data:", err);
        }
      };
      fetchChildData();
    }
  }, [selectedChild]);

  const formatDate = (dateString) => {
    if (!dateString) return "__________";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const calculateAgeInWeeks = (dob, checkDate) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const targetDate = checkDate ? new Date(checkDate) : new Date();
    const diffTime = targetDate - birthDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays / 7);
  };

  const getVisitDate = (visitAge) => {
    const infantDob = infant?.dob;
    if (!infantDob) return null;

    const appointment = appointments.find((apt) => {
      if (!apt?.scheduled_date) return false;
      const ageInWeeks = calculateAgeInWeeks(infantDob, apt.scheduled_date);
      const template = visitTemplates.find((t) => t.age === visitAge);
      if (!template) return false;
      return (
        ageInWeeks >= template.ageRange.minWeeks &&
        ageInWeeks <= template.ageRange.maxWeeks
      );
    });

    return appointment?.scheduled_date || null;
  };

  const getVaccinesForVisit = (visitAge) => {
    const infantDob = infant?.dob;
    if (!infantDob) return [];

    const visitVaccines = visitTemplates.find((t) => t.age === visitAge);
    if (!visitVaccines) return [];

    return vaccinations.filter((v) => {
      if (!v?.admin_date) return false;
      const ageInWeeks = calculateAgeInWeeks(infantDob, v.admin_date);
      return (
        ageInWeeks >= visitVaccines.ageRange.minWeeks &&
        ageInWeeks <= visitVaccines.ageRange.maxWeeks
      );
    });
  };

  const getGrowthForVisit = (visitAge) => {
    const infantDob = infant?.dob;
    if (!infantDob) return null;

    const template = visitTemplates.find((t) => t.age === visitAge);
    if (!template) return null;

    return growthRecords.find((g) => {
      if (!g?.measurement_date) return false;
      const ageInWeeks = calculateAgeInWeeks(infantDob, g.measurement_date);
      return (
        ageInWeeks >= template.ageRange.minWeeks &&
        ageInWeeks <= template.ageRange.maxWeeks
      );
    });
  };

  const isVaccineAdministered = (vaccineName) => {
    return vaccinations.some((v) => {
      if (!isApprovedVaccineName(v?.vaccine_name)) return false;
      return v.vaccine_name === vaccineName;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a printable version
    const printContent = document.getElementById("immunization-chart-print");
    if (!printContent) {
      alert("No content to download");
      return;
    }

    // Create a blob from the print content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Immunization Chart - ${infant?.first_name} ${infant?.last_name}</title>
        <style>
          @media print {
            body { font-family: Arial, sans-serif; font-size: 12px; }
            .print-container { width: 100%; max-width: 800px; margin: 0 auto; }
            .section { margin-bottom: 20px; }
            .row { display: flex; margin-bottom: 8px; }
            .col { flex: 1; padding: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: left; }
            .header { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; }
          }
          body { font-family: Arial, sans-serif; font-size: 12px; }
          .print-container { width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; }
          .section { margin-bottom: 20px; }
          .row { display: flex; flex-wrap: wrap; margin-bottom: 8px; }
          .col { flex: 1; min-width: 200px; padding: 5px; }
          .section-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .checkbox { display: inline-block; width: 15px; height: 15px; border: 1px solid #000; margin-right: 5px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .underline { border-bottom: 1px solid #000; display: inline-block; min-width: 100px; }
          .vaccine-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .vital-signs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; font-size: 11px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Immunization_Chart_${infant?.last_name}_${infant?.first_name}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Loading immunization chart..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error Loading Data">
        {error}
        <Button onClick={fetchData} variant="outline" className="mt-4">
          Retry
        </Button>
      </Alert>
    );
  }

  const displayInfant = infant || selectedChild;

  // Child selector if multiple children
  const childSelector = children.length > 1 && (
    <Card className="mb-6">
      <div className="flex items-center gap-4">
        <label className="font-medium text-gray-700">Select Child:</label>
        <select
          className="flex-1 p-2 border rounded-lg"
          value={displayInfant?.id || ""}
          onChange={(e) => {
            const child = children.find(
              (c) => c.id === parseInt(e.target.value),
            );
            setSelectedChild(child);
          }}
        >
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.last_name}, {child.first_name}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );

  if (!displayInfant && showViewMode) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No Child Selected
        </h3>
        <p className="text-gray-500">
          Please select a child to view their immunization chart.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showViewMode && (
        <PageHeader
          title="Immunization Chart"
          subtitle={`Official vaccination record for ${displayInfant?.first_name} ${displayInfant?.last_name}`}
          icon={<FileText className="w-8 h-8 text-white" />}
        />
      )}

      {/* Child Selector */}
      {showViewMode && childSelector}

      {/* Action Buttons */}
      {showViewMode && (
        <div className="flex gap-4 justify-end">
          <Button
            onClick={handlePrint}
            variant="secondary"
            icon={<Printer className="w-4 h-4" />}
          >
            Print
          </Button>
          <Button
            onClick={handleDownload}
            icon={<Download className="w-4 h-4" />}
          >
            Download
          </Button>
        </div>
      )}

      {/* Print-friendly Immunization Chart */}
      <div
        id="immunization-chart-print"
        className="print-container bg-white p-8 max-w-4xl mx-auto"
      >
        {/* Official Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            IMMUNIZATION CHART
          </h1>
          <p className="text-sm text-gray-600">
            Department of Health - Republic of the Philippines
          </p>
        </div>

        {/* Personal Information Section */}
        <div className="section mb-6">
          <div className="section-title">PERSONAL INFORMATION</div>
          <div className="row">
            <div className="col">
              <span className="font-bold">NAME:</span>{" "}
              <span className="underline">
                {displayInfant?.last_name}, {displayInfant?.first_name}{" "}
                {displayInfant?.middle_name}
              </span>
            </div>
            <div className="col">
              <span className="font-bold">ADDRESS:</span>{" "}
              <span className="underline">
                {displayInfant?.address || "__________"}
              </span>
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">DATE OF BIRTH:</span>{" "}
              <span className="underline">
                {formatDate(displayInfant?.dob)}
              </span>
            </div>
            <div className="col">
              <span className="font-bold">BIRTH WEIGHT:</span>{" "}
              <span className="underline">
                {displayInfant?.birth_weight || "____"} kg
              </span>{" "}
              <span className="underline">
                {displayInfant?.birth_height || "____"} cm
              </span>
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">PLACE OF BIRTH:</span>{" "}
              <span className="underline">
                {displayInfant?.place_of_birth || "__________"}
              </span>
            </div>
            <div className="col">
              <span className="font-bold">MOTHER'S NAME:</span>{" "}
              <span className="underline">
                {displayInfant?.mother_name || "__________"}
              </span>
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">AGE:</span>{" "}
              <span className="underline">
                {displayInfant?.dob
                  ? Math.floor(
                      (new Date() - new Date(displayInfant.dob)) /
                        (365.25 * 24 * 60 * 60 * 1000),
                    )
                  : "____"}{" "}
                years
              </span>
            </div>
            <div className="col">
              <span className="font-bold">GENDER:</span>{" "}
              <span className="checkbox">
                {displayInfant?.sex === "F" ? "✓" : "○"}
              </span>{" "}
              FEMALE{" "}
              <span className="checkbox">
                {displayInfant?.sex === "M" ? "✓" : "○"}
              </span>{" "}
              MALE
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">BCG:</span>{" "}
              <span className="checkbox">
                {isVaccineAdministered("BCG") ? "✓" : "□"}
              </span>
            </div>
            <div className="col">
              <span className="font-bold">HEPA B:</span>{" "}
              <span className="checkbox">
                {isVaccineAdministered("Hepa B") ? "✓" : "□"}
              </span>
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">TIME OF DELIVERY:</span>{" "}
              <span className="underline">__________</span>
            </div>
            <div className="col">
              <span className="font-bold">NBS:</span>{" "}
              <span className="checkbox">□</span> YES{" "}
              <span className="checkbox">□</span> NO{" "}
              <span className="font-bold ml-4">DATE:</span>{" "}
              <span className="underline">__________</span>
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">DELIVERED BY:</span>{" "}
              <span className="checkbox">□</span> DOCTOR{" "}
              <span className="checkbox">□</span> MIDWIFE{" "}
              <span className="checkbox">□</span> NURSE{" "}
              <span className="checkbox">□</span> HILOT
            </div>
          </div>
          <div className="row">
            <div className="col">
              <span className="font-bold">TYPE OF DELIVERY:</span>{" "}
              <span className="checkbox">□</span> NSD{" "}
              <span className="checkbox">□</span> CS
            </div>
            <div className="col">
              <span className="font-bold">CELLPHONE NUMBER:</span>{" "}
              <span className="underline">
                {displayInfant?.contact_number || "__________"}
              </span>
            </div>
          </div>
        </div>

        {/* Vaccination Records Section */}
        <div className="section mb-6">
          <div className="section-title">VACCINATION RECORD</div>

          {visitTemplates.map((visit) => {
            const visitDate = getVisitDate(visit.age);
            const visitVaccines = getVaccinesForVisit(visit.age);
            const growthData = getGrowthForVisit(visit.age);

            return (
              <div
                key={visit.age}
                className="visit-record mb-4 border border-gray-300 p-4"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold">{visit.title}</div>
                  <div>
                    <span className="font-bold">DATE:</span>{" "}
                    <span className="underline">{formatDate(visitDate)}</span>
                  </div>
                </div>

                <div className="row">
                  {/* Vital Signs */}
                  <div className="col w-1/2 pr-4">
                    <div className="font-bold mb-1">VITAL SIGNS</div>
                    <div className="vital-signs">
                      <div>
                        <span className="font-bold">HR:</span>{" "}
                        {growthData?.heart_rate || "____"} bpm
                      </div>
                      <div>
                        <span className="font-bold">RR:</span>{" "}
                        {growthData?.respiratory_rate || "____"} rpm
                      </div>
                      <div>
                        <span className="font-bold">Temp:</span>{" "}
                        {growthData?.temperature_celsius || "____"}°C
                      </div>
                      <div>
                        <span className="font-bold">HT:</span>{" "}
                        {growthData?.length_cm || "____"} cm
                      </div>
                      <div>
                        <span className="font-bold">WT:</span>{" "}
                        {growthData?.weight_kg || "____"} kg
                      </div>
                      <div>
                        <span className="font-bold">BREASTFEEDING:</span>{" "}
                        {growthData?.feeding_status === "breastfeeding"
                          ? "Y"
                          : growthData?.feeding_status === "not_breastfeeding"
                            ? "N"
                            : "____"}
                      </div>
                      <div>
                        <span className="font-bold">TCB:</span> ____
                      </div>
                    </div>
                  </div>

                    {/* Vaccines */}
                    <div className="col w-1/2 pl-4">
                      <div className="font-bold mb-1">VACCINES</div>
                    {visit.vaccines.length === 0 ? (
                      <div className="vaccine-row">
                        <span>No approved vaccine scheduled</span>
                        <span>○</span>
                      </div>
                    ) : (
                      visit.vaccines.map((vaccine) => (
                        <div
                          key={`${vaccine.name}-${vaccine.doseNo}`}
                          className="vaccine-row"
                        >
                          <span>{`${vaccine.name} (Dose ${vaccine.doseNo})`}:</span>
                          <span>
                            {visitVaccines.some(
                              (entry) =>
                                entry.vaccine_name === vaccine.name &&
                                Number(entry.dose_no || entry.dose_number || 1) === vaccine.doseNo,
                            )
                              ? "✓"
                              : "○"}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="mt-2">
                      <span className="font-bold">Others/Remarks:</span>{" "}
                      {visitVaccines[0]?.notes || "__________"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Catch-up Section */}
          <div className="section-title mt-6">CATCH-UP</div>
          <div className="border border-gray-300 p-4 min-h-[100px]">
            <p className="text-gray-500 italic">
              Catch-up vaccination records and notes appear here...
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="section mt-8 pt-4 border-t border-gray-300">
          <div className="text-center text-xs text-gray-500">
            <p>Generated by Immunicare Vaccination Management System</p>
            <p>
              Generated on:{" "}
              {new Date().toLocaleDateString("en-US", { dateStyle: "full" })}
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          body {
            margin: 0 !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
