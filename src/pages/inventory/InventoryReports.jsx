import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";
import {
  Card,
  Button,
  PageHeader,
  Alert,
  LoadingSpinner,
} from "../../components/UI";
import {
  FileText,
  Download,
  RefreshCw,
  Package,
  TrendingUp,
  AlertTriangle,
  Printer,
  Calendar,
  BarChart3,
} from "lucide-react";

const InventoryReports = () => {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleGenerateReport = async (reportType) => {
    try {
      setGenerating(reportType);
      setError(null);
      setSuccess(null);

      // Simulate report generation - in production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock report generation
      const reportData = {
        stockSummary: {
          generatedAt: new Date().toISOString(),
          totalItems: 156,
          totalValue: 45230.5,
          lowStock: 12,
          expiringSoon: 8,
        },
        usageReport: {
          generatedAt: new Date().toISOString(),
          period: "Last 30 days",
          totalUsage: 1234,
          topVaccines: ["BCG", "Hepatitis B", "Pentavalent"],
        },
        expiryReport: {
          generatedAt: new Date().toISOString(),
          itemsExpiringSoon: 8,
          totalDoses: 450,
        },
      };

      // Download report as JSON (in production, this would be PDF/Excel)
      const blob = new Blob([JSON.stringify(reportData[reportType], null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(
        `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully!`,
      );
    } catch (err) {
      setError(err.message || "Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  const reportTypes = [
    {
      id: "stockSummary",
      title: "Stock Summary",
      description:
        "Generate a summary of current stock levels, values, and status",
      icon: <Package className="w-8 h-8" />,
      color: "blue",
      stats: ["Total Items", "Total Value", "Low Stock", "Expiring Soon"],
    },
    {
      id: "usageReport",
      title: "Usage Report",
      description:
        "View vaccine usage statistics, trends, and consumption patterns",
      icon: <TrendingUp className="w-8 h-8" />,
      color: "green",
      stats: ["Period", "Total Usage", "Top Vaccines", "Trends"],
    },
    {
      id: "expiryReport",
      title: "Expiry Report",
      description:
        "Check vaccines approaching expiry and manage stock rotation",
      icon: <AlertTriangle className="w-8 h-8" />,
      color: "yellow",
      stats: ["Expiring Items", "Total Doses", "Actions Needed", "Risk Level"],
    },
  ];

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Inventory Reports"
        subtitle="Generate comprehensive reports for inventory management"
        icon={<BarChart3 className="w-6 h-6" />}
      />

      {error && (
        <Alert
          variant="error"
          title="Error generating report"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          title="Success"
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <Card
            key={report.id}
            className={`p-6 border-t-4 border-t-${report.color}-500 hover:shadow-lg transition-shadow`}
            title={
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl bg-${report.color}-100 dark:bg-${report.color}-900/30 flex items-center justify-center text-${report.color}-600 dark:text-${report.color}-400`}
                >
                  {report.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {report.title}
                  </h3>
                </div>
              </div>
            }
          >
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {report.description}
            </p>

            {/* Mock Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {report.id === "stockSummary" && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      156
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Total Items
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      $45.2K
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Total Value
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600">12</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Low Stock
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">8</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Expiring Soon
                    </p>
                  </div>
                </>
              )}
              {report.id === "usageReport" && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      30 Days
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Period
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">1,234</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Total Usage
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center col-span-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Top: BCG, HepB
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Top Vaccines
                    </p>
                  </div>
                </>
              )}
              {report.id === "expiryReport" && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600">8</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Expiring Items
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">450</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Total Doses
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center col-span-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Medium Risk
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Risk Level
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => handleGenerateReport(report.id)}
                disabled={generating === report.id}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {generating === report.id ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" /> Generate
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                disabled={generating === report.id}
                className="flex items-center justify-center"
              >
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Reports Section */}
      <Card title="Recent Reports" className="mt-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Report Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Generated On
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {[
                {
                  name: "Monthly Stock Summary - January 2026",
                  type: "Stock Summary",
                  date: "2026-01-31",
                  status: "Completed",
                },
                {
                  name: "Vaccine Usage Report - Q4 2025",
                  type: "Usage Report",
                  date: "2025-12-31",
                  status: "Completed",
                },
                {
                  name: "Expiry Risk Assessment",
                  type: "Expiry Report",
                  date: "2025-12-15",
                  status: "Completed",
                },
              ].map((report, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {report.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {report.type}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {report.date}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Navigation back to Inventory */}
      <div className="flex justify-start pt-4">
        <Button
          variant="secondary"
          onClick={() => navigate("/inventory?tab=items")}
        >
          ← Back to Inventory Management
        </Button>
      </div>
    </div>
  );
};

export default InventoryReports;
