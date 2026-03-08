import React, { useState, useEffect, useCallback } from "react";
import { Card, Button, Select, Alert } from "../UI";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import apiClient from "../../utils/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export const ReportingDashboard = () => {
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("month");
  const [reportType, setReportType] = useState("vaccination");

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);

      let data;
      switch (reportType) {
        case "vaccination":
          data = await apiClient.getVaccinationAnalytics();
          break;
        case "appointment":
          data = await apiClient.getAppointmentAnalytics();
          break;
        case "inventory":
          data = await apiClient.getVaccineInventoryStats();
          break;
        default:
          data = await apiClient.getVaccinationAnalytics();
      }

      setReportData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData, timeRange]);

  const getVaccinationCoverageData = () => {
    if (!reportData.vaccinationCoverage) return null;

    return {
      labels: reportData.vaccinationCoverage.map((item) => item.vaccineName),
      datasets: [
        {
          label: "Coverage Rate",
          data: reportData.vaccinationCoverage.map((item) => item.coverageRate),
          backgroundColor: "rgba(59, 130, 246, 0.5)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
      ],
    };
  };

  const getAppointmentTrendsData = () => {
    if (!reportData.appointmentTrends) return null;

    return {
      labels: reportData.appointmentTrends.map((item) => item.date),
      datasets: [
        {
          label: "Completed",
          data: reportData.appointmentTrends.map((item) => item.completed),
          backgroundColor: "rgba(76, 175, 80, 0.5)",
          borderColor: "rgba(76, 175, 80, 1)",
          borderWidth: 1,
        },
        {
          label: "Missed",
          data: reportData.appointmentTrends.map((item) => item.missed),
          backgroundColor: "rgba(244, 67, 54, 0.5)",
          borderColor: "rgba(244, 67, 54, 1)",
          borderWidth: 1,
        },
        {
          label: "Cancelled",
          data: reportData.appointmentTrends.map((item) => item.cancelled),
          backgroundColor: "rgba(255, 193, 7, 0.5)",
          borderColor: "rgba(255, 193, 7, 1)",
          borderWidth: 1,
        },
      ],
    };
  };

  const getInventoryStatusData = () => {
    if (!reportData.inventoryStatus) return null;

    return {
      labels: reportData.inventoryStatus.map((item) => item.vaccineName),
      datasets: [
        {
          label: "Current Stock",
          data: reportData.inventoryStatus.map((item) => item.currentStock),
          backgroundColor: "rgba(33, 150, 243, 0.5)",
          borderColor: "rgba(33, 150, 243, 1)",
          borderWidth: 1,
        },
        {
          label: "Minimum Level",
          data: reportData.inventoryStatus.map((item) => item.minLevel),
          backgroundColor: "rgba(244, 67, 54, 0.5)",
          borderColor: "rgba(244, 67, 54, 1)",
          borderWidth: 1,
        },
      ],
    };
  };

  const getVaccineDistributionData = () => {
    if (!reportData.vaccineDistribution) return null;

    return {
      labels: reportData.vaccineDistribution.map((item) => item.vaccineName),
      datasets: [
        {
          data: reportData.vaccineDistribution.map((item) => item.count),
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
            "#FF9F40",
          ],
          hoverBackgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
            "#FF9F40",
          ],
        },
      ],
    };
  };

  if (loading) return <div>Loading reports...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="reporting-dashboard">
      <h1 className="text-2xl font-bold mb-6">Reporting & Analytics</h1>

      {/* Report Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex gap-4">
          <Select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="min-w-[200px]"
          >
            <option value="vaccination">Vaccination Coverage</option>
            <option value="appointment">Appointment Trends</option>
            <option value="inventory">Inventory Status</option>
          </Select>

          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="min-w-[150px]"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
          </Select>
        </div>

        <Button
          onClick={() => {
            // Export report functionality
            console.log("Export report");
          }}
          variant="secondary"
        >
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card title="Total Vaccinations">
          <div className="text-3xl font-bold">
            {reportData.totalVaccinations || 0}
          </div>
          <div className="text-sm text-gray-500">This {timeRange}</div>
        </Card>

        <Card title="Coverage Rate">
          <div className="text-3xl font-bold">
            {reportData.coverageRate || 0}%
          </div>
          <div className="text-sm text-gray-500">Target: 95%</div>
        </Card>

        <Card title="Appointments Completed">
          <div className="text-3xl font-bold">
            {reportData.completedAppointments || 0}
          </div>
          <div className="text-sm text-gray-500">This {timeRange}</div>
        </Card>

        <Card title="Low Stock Alerts">
          <div className="text-3xl font-bold">
            {reportData.lowStockAlerts || 0}
          </div>
          <div className="text-sm text-gray-500">Active alerts</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {reportType === "vaccination" && (
          <>
            <Card title="Vaccination Coverage by Type">
              <div className="h-80">
                <Bar
                  data={getVaccinationCoverageData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "top",
                      },
                    },
                  }}
                />
              </div>
            </Card>

            <Card title="Vaccine Distribution">
              <div className="h-80">
                <Doughnut
                  data={getVaccineDistributionData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "right",
                      },
                    },
                  }}
                />
              </div>
            </Card>
          </>
        )}

        {reportType === "appointment" && (
          <Card title="Appointment Trends" className="lg:col-span-2">
            <div className="h-80">
              <Line
                data={getAppointmentTrendsData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                    },
                  },
                }}
              />
            </div>
          </Card>
        )}

        {reportType === "inventory" && (
          <Card title="Inventory Status" className="lg:col-span-2">
            <div className="h-80">
              <Bar
                data={getInventoryStatusData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                    },
                  },
                }}
              />
            </div>
          </Card>
        )}
      </div>

      {/* Detailed Reports Section */}
      <Card title="Detailed Reports">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Compliance Reports</h3>
            <Button size="sm" variant="secondary">
              Generate Compliance Report
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Coverage Reports</h3>
            <Button size="sm" variant="secondary">
              Generate Coverage Report
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Adverse Events Report</h3>
            <Button size="sm" variant="secondary">
              Generate Adverse Events Report
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
