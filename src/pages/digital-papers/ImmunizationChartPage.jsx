import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Button,
  PageHeader,
  Card,
  Alert,
  LoadingSpinner,
} from "../../components/UI";
import ImmunizationChart from "../../components/ImmunizationChart";
import InfantPersonalRecord from "../../components/InfantPersonalRecord";
import apiClient from "../../utils/api";
import { BarChart3, FileText, Printer, Baby, User } from "lucide-react";

export default function ImmunizationChartPage() {
  const { infantId } = useParams();
  const { isGuardian } = useAuth();
  const [infant, setInfant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("chart");

  const fetchInfant = useCallback(async () => {
    if (!infantId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await apiClient.getInfant(infantId);
      setInfant(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    fetchInfant();
  }, [fetchInfant]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a printable version of the immunization chart
    const chartContent = document.querySelector(".space-y-6");
    if (!chartContent) {
      alert("No content available to download");
      return;
    }

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to download the PDF");
      return;
    }

    const infantName = infant
      ? `${infant.first_name} ${infant.last_name}`
      : "Immunization Chart";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${infantName} - Immunization Chart</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            color: #1a1a1a;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #4f46e5;
          }
          .header h1 {
            color: #4f46e5;
            font-size: 24px;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 14px;
          }
          .infant-info {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .infant-info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            font-size: 13px;
          }
          .infant-info-grid div {
            padding: 5px 0;
          }
          .infant-info-grid strong {
            color: #374151;
          }
          .visit-section {
            margin-bottom: 25px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          .visit-header {
            background: #4f46e5;
            color: white;
            padding: 12px 15px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .visit-header .date {
            font-size: 13px;
            opacity: 0.9;
          }
          .visit-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 15px;
          }
          .vital-signs, .vaccines {
            font-size: 13px;
          }
          .vital-signs h5, .vaccines h5 {
            color: #374151;
            margin-bottom: 10px;
            font-size: 14px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
          }
          .vital-signs div, .vaccines div {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .vital-signs span:last-child, .vaccines span:last-child {
            font-weight: 500;
          }
          .completed { color: #16a34a; }
          .pending { color: #9ca3af; }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
          }
          @media print {
            body { padding: 0; }
            .visit-section { break-inside: avoid; }
          }
          @media screen {
            body { background: #f9fafb; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💉 Immunization Chart</h1>
            <p>San Nicolas Health Center - Child Vaccination Record</p>
          </div>

          ${
            infant
              ? `
          <div class="infant-info">
            <div class="infant-info-grid">
              <div><strong>Name:</strong> ${infant.last_name}, ${infant.first_name}</div>}</div>
              <div><strong>Date of Birth:</strong> ${new Date(infant.dob).toLocaleDateString()}</div>
              <div><strong>Sex:</strong> ${infant.sex === "M" ? "Male" : "Female"}</div>
              <div><strong>Birth Weight:</strong> ${infant.birth_weight || "N/A"} kg</div>
              <div><strong>Place of Birth:</strong> ${infant.place_of_birth || "N/A"}</div>
              <div><strong>Mother:</strong> ${infant.mother_name || "N/A"}</div>
              <div><strong>BCG:</strong> ${infant.bcg === 1 ? "✓ Given" : "○ Not Given"}</div>
              <div><strong>Hepatitis B:</strong> ${infant.hepb === 1 ? "✓ Given" : "○ Not Given"}</div>
            </div>
          </div>
          `
              : ""
          }

          <div class="visit-schedule">
            <div class="visit-section">
              <div class="visit-header">
                <span>6 Weeks Visit</span>
                <span class="date">PENTA 1, OPV 1, PCV 1</span>
              </div>
              <div class="visit-content">
                <div class="vital-signs">
                  <h5>VITAL SIGNS</h5>
                  <div><span>HR (Heart Rate):</span><span>___ bpm</span></div>
                  <div><span>RR (Respiratory Rate):</span><span>___ rpm</span></div>
                  <div><span>Temperature:</span><span>___ °C</span></div>
                  <div><span>Height:</span><span>___ cm</span></div>
                  <div><span>Weight:</span><span>___ kg</span></div>
                  <div><span>Breastfeeding:</span><span>Y / N</span></div>
                </div>
                <div class="vaccines">
                  <h5>VACCINES</h5>
                  <div><span>PENTA 1 / HEXA 1:</span><span class="pending">○</span></div>
                  <div><span>OPV 1:</span><span class="pending">○</span></div>
                  <div><span>PCV 1:</span><span class="pending">○</span></div>
                </div>
              </div>
            </div>

            <div class="visit-section">
              <div class="visit-header">
                <span>10 Weeks Visit</span>
                <span class="date">PENTA 2, OPV 2, PCV 2</span>
              </div>
              <div class="visit-content">
                <div class="vital-signs">
                  <h5>VITAL SIGNS</h5>
                  <div><span>HR (Heart Rate):</span><span>___ bpm</span></div>
                  <div><span>RR (Respiratory Rate):</span><span>___ rpm</span></div>
                  <div><span>Temperature:</span><span>___ °C</span></div>
                  <div><span>Height:</span><span>___ cm</span></div>
                  <div><span>Weight:</span><span>___ kg</span></div>
                  <div><span>Breastfeeding:</span><span>Y / N</span></div>
                </div>
                <div class="vaccines">
                  <h5>VACCINES</h5>
                  <div><span>PENTA 2 / HEXA 2:</span><span class="pending">○</span></div>
                  <div><span>OPV 2:</span><span class="pending">○</span></div>
                  <div><span>PCV 2:</span><span class="pending">○</span></div>
                </div>
              </div>
            </div>

            <div class="visit-section">
              <div class="visit-header">
                <span>14 Weeks Visit</span>
                <span class="date">PENTA 3, OPV 3, PCV 3, IPV 1</span>
              </div>
              <div class="visit-content">
                <div class="vital-signs">
                  <h5>VITAL SIGNS</h5>
                  <div><span>HR (Heart Rate):</span><span>___ bpm</span></div>
                  <div><span>RR (Respiratory Rate):</span><span>___ rpm</span></div>
                  <div><span>Temperature:</span><span>___ °C</span></div>
                  <div><span>Height:</span><span>___ cm</span></div>
                  <div><span>Weight:</span><span>___ kg</span></div>
                  <div><span>Breastfeeding:</span><span>Y / N</span></div>
                </div>
                <div class="vaccines">
                  <h5>VACCINES</h5>
                  <div><span>PENTA 3 / HEXA 3:</span><span class="pending">○</span></div>
                  <div><span>OPV 3:</span><span class="pending">○</span></div>
                  <div><span>PCV 3:</span><span class="pending">○</span></div>
                  <div><span>IPV 1:</span><span class="pending">○</span></div>
                </div>
              </div>
            </div>

            <div class="visit-section">
              <div class="visit-header">
                <span>6 Months Visit</span>
                <span class="date">VITAMIN A</span>
              </div>
              <div class="visit-content">
                <div class="vital-signs">
                  <h5>VITAL SIGNS</h5>
                  <div><span>HR (Heart Rate):</span><span>___ bpm</span></div>
                  <div><span>RR (Respiratory Rate):</span><span>___ rpm</span></div>
                  <div><span>Temperature:</span><span>___ °C</span></div>
                  <div><span>Height:</span><span>___ cm</span></div>
                  <div><span>Weight:</span><span>___ kg</span></div>
                  <div><span>Breastfeeding:</span><span>Y / N</span></div>
                </div>
                <div class="vaccines">
                  <h5>VACCINES</h5>
                  <div><span>VITAMIN A:</span><span class="pending">○</span></div>
                </div>
              </div>
            </div>

            <div class="visit-section">
              <div class="visit-header">
                <span>9 Months Visit</span>
                <span class="date">MCV 1, IPV 2</span>
              </div>
              <div class="visit-content">
                <div class="vital-signs">
                  <h5>VITAL SIGNS</h5>
                  <div><span>HR (Heart Rate):</span><span>___ bpm</span></div>
                  <div><span>RR (Respiratory Rate):</span><span>___ rpm</span></div>
                  <div><span>Temperature:</span><span>___ °C</span></div>
                  <div><span>Height:</span><span>___ cm</span></div>
                  <div><span>Weight:</span><span>___ kg</span></div>
                  <div><span>Breastfeeding:</span><span>Y / N</span></div>
                </div>
                <div class="vaccines">
                  <h5>VACCINES</h5>
                  <div><span>MCV 1 (Measles):</span><span class="pending">○</span></div>
                  <div><span>IPV 2:</span><span class="pending">○</span></div>
                </div>
              </div>
            </div>

            <div class="visit-section">
              <div class="visit-header">
                <span>12 Months Visit</span>
                <span class="date">MCV 2</span>
              </div>
              <div class="visit-content">
                <div class="vital-signs">
                  <h5>VITAL SIGNS</h5>
                  <div><span>HR (Heart Rate):</span><span>___ bpm</span></div>
                  <div><span>RR (Respiratory Rate):</span><span>___ rpm</span></div>
                  <div><span>Temperature:</span><span>___ °C</span></div>
                  <div><span>Height:</span><span>___ cm</span></div>
                  <div><span>Weight:</span><span>___ kg</span></div>
                  <div><span>Breastfeeding:</span><span>Y / N</span></div>
                </div>
                <div class="vaccines">
                  <h5>VACCINES</h5>
                  <div><span>MCV 2 (Measles):</span><span class="pending">○</span></div>
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Generated from Immunicare System - San Nicolas Health Center</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then trigger print
    setTimeout(() => {
      printWindow.print();
      // Optionally close after printing (uncomment if desired)
      // printWindow.close();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading immunization chart..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="danger">
          <p>Error loading immunization chart: {error}</p>
        </Alert>
        <Button onClick={fetchInfant} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title="Immunization Chart"
        subtitle={
          infant
            ? `Visit records for ${infant.first_name} ${infant.last_name}`
            : "Detailed visit records with vital signs and vaccines"
        }
        icon={<BarChart3 className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="secondary">
              <FileText className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print</Button>
          </div>
        }
      />

      {/* Infant Summary Card */}
      {infant && (
        <Card className="p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-2xl">
                👶
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {infant.first_name} {infant.middle_name || ""}{" "}
                  {infant.last_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  DOB: {new Date(infant.dob).toLocaleDateString()} •{" "}
                  {infant.sex === "M" ? "Male" : "Female"} • Birth Weight:{" "}
                  {infant.birth_weight || "N/A"} kg
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeSection === "chart" ? "primary" : "secondary"}
                onClick={() => setActiveSection("chart")}
              >
                📊 Chart
              </Button>
              <Button
                size="sm"
                variant={activeSection === "personal" ? "primary" : "secondary"}
                onClick={() => setActiveSection("personal")}
              >
                👤 Personal Info
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Section Navigation for Infant */}
      {infantId && (
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          <Button
            variant={activeSection === "chart" ? "primary" : "ghost"}
            onClick={() => setActiveSection("chart")}
            size="sm"
          >
            📊 Immunization Chart
          </Button>
          <Button
            variant={activeSection === "personal" ? "primary" : "ghost"}
            onClick={() => setActiveSection("personal")}
            size="sm"
          >
            👤 Personal Information
          </Button>
        </div>
      )}

      {/* Content Based on Selection */}
      {infantId ? (
        <>
          {activeSection === "chart" && (
            <ImmunizationChart infantId={infantId} />
          )}
          {activeSection === "personal" && (
            <InfantPersonalRecord
              infantId={infantId}
              onUpdate={fetchInfant}
              readOnly={isGuardian}
            />
          )}
        </>
      ) : (
        <Alert variant="info">
          <p className="font-medium">Select an Infant</p>
          <p className="mt-1">
            Please select an infant to view their immunization chart, or
            navigate from the Infant Management page.
          </p>
        </Alert>
      )}

      {/* Visit Schedule Reference */}
      <Card className="p-6 bg-gray-50 dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          📅 Standard Visit Schedule
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div className="text-center p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              6 Weeks
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              PENTA 1, OPV 1, PCV 1
            </p>
          </div>
          <div className="text-center p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <p className="font-medium text-green-900 dark:text-green-100">
              10 Weeks
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              PENTA 2, OPV 2, PCV 2
            </p>
          </div>
          <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <p className="font-medium text-yellow-900 dark:text-yellow-100">
              14 Weeks
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              PENTA 3, OPV 3, PCV 3, IPV 1
            </p>
          </div>
          <div className="text-center p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <p className="font-medium text-purple-900 dark:text-purple-100">
              6 Months
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              VIT. A
            </p>
          </div>
          <div className="text-center p-3 bg-red-100 dark:bg-red-900 rounded-lg">
            <p className="font-medium text-red-900 dark:text-red-100">
              9 Months
            </p>
            <p className="text-xs text-red-700 dark:text-red-300">
              MCV 1, IPV 2
            </p>
          </div>
          <div className="text-center p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
            <p className="font-medium text-indigo-900 dark:text-indigo-100">
              12 Months
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              MCV 2
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
