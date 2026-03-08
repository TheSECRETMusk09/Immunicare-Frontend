import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Alert } from "../UI";
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { useDashboard } from "../../hooks/useDashboard";

ChartJS.register(
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

// Modern Chart Card component
const ModernChartCard = ({ title, children, className = "" }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300 ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
};

export const VaccinationDashboard = () => {
  const { stats, loading, error } = useDashboard();
  const [timeRange, setTimeRange] = useState("week");
  const [appointments, setAppointments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedVaccine, setSelectedVaccine] = useState(null);

  useEffect(() => {
    // Fetch appointments and inventory data
    const fetchData = async () => {
      try {
        // This would typically be API calls
        // Mock data for now
        setAppointments([
          { id: 1, date: "2023-01-15", vaccine: "BCG", status: "completed" },
          {
            id: 2,
            date: "2023-01-16",
            vaccine: "Hepatitis B",
            status: "scheduled",
          },
        ]);

        setInventory([
          { id: 1, name: "BCG", stock: 45, threshold: 10 },
          { id: 2, name: "Hepatitis B", stock: 32, threshold: 5 },
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Vaccination coverage data - modern styling
  const coverageData = {
    labels: ["BCG", "Hepatitis B", "Pentavalent", "OPV", "IPV", "PCV", "MMR"],
    datasets: [
      {
        data: [95, 88, 76, 82, 65, 70, 55],
        backgroundColor: [
          "rgba(16, 185, 129, 0.85)",
          "rgba(59, 130, 246, 0.85)",
          "rgba(245, 158, 11, 0.85)",
          "rgba(239, 68, 68, 0.85)",
          "rgba(139, 92, 246, 0.85)",
          "rgba(6, 182, 212, 0.85)",
          "rgba(244, 63, 94, 0.85)",
        ],
        hoverBackgroundColor: [
          "rgba(16, 185, 129, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(245, 158, 11, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(6, 182, 212, 1)",
          "rgba(244, 63, 94, 1)",
        ],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  // Appointment trends data - modern styling
  const appointmentTrendsData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Scheduled",
        data: [12, 15, 18, 14, 20, 8, 5],
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Completed",
        data: [10, 13, 16, 12, 18, 6, 4],
        borderColor: "rgba(16, 185, 129, 1)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "rgba(16, 185, 129, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Inventory status data - modern styling
  const inventoryData = {
    labels: ["BCG", "Hep B", "Penta", "OPV", "IPV", "PCV", "MMR"],
    datasets: [
      {
        label: "Current Stock",
        data: [45, 32, 68, 8, 15, 42, 28],
        backgroundColor: [
          "rgba(16, 185, 129, 0.85)",
          "rgba(59, 130, 246, 0.85)",
          "rgba(16, 185, 129, 0.85)",
          "rgba(239, 68, 68, 0.85)",
          "rgba(245, 158, 11, 0.85)",
          "rgba(16, 185, 129, 0.85)",
          "rgba(16, 185, 129, 0.85)",
        ],
        borderRadius: 8,
        barThickness: 32,
      },
    ],
  };

  // Modern chart options
  const coverageOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "55%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          color: "#6B7280",
        },
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleFont: {
          size: 13,
          family: "'Inter', sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true,
      },
    },
  };

  const trendsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          color: "#6B7280",
        },
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleFont: {
          size: 13,
          family: "'Inter', sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          font: {
            size: 11,
            family: "'Inter', sans-serif",
          },
          color: "#6B7280",
        },
        border: {
          display: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
            family: "'Inter', sans-serif",
          },
          color: "#6B7280",
        },
        border: {
          display: false,
        },
      },
    },
  };

  const inventoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleFont: {
          size: 13,
          family: "'Inter', sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          font: {
            size: 11,
            family: "'Inter', sans-serif",
          },
          color: "#6B7280",
        },
        border: {
          display: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
            family: "'Inter', sans-serif",
          },
          color: "#6B7280",
        },
        border: {
          display: false,
        },
      },
    },
  };

  if (loading)
    return <div className="loading-spinner">Loading dashboard...</div>;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div className="vaccination-dashboard space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Vaccination Management Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring and management of immunization programs
          </p>
        </div>
        <div className="flex gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="day">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
          </select>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Vaccinations
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalVaccinations || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">This {timeRange}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6l4 2"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Appointments Today
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.appointmentsToday || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scheduled</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Low Stock Alerts
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats?.lowStockAlerts || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Vaccines</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Coverage Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.coverageRate || 0}%
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                    style={{ width: `${stats?.coverageRate || 0}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Target: 95%</span>
              </div>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <svg
                className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vaccination Coverage */}
        <ModernChartCard title="Vaccination Coverage by Type">
          <div className="h-72">
            <Doughnut data={coverageData} options={coverageOptions} />
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span className="text-gray-600 dark:text-gray-400">≥90% (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              <span className="text-gray-600 dark:text-gray-400">70-89% (Warning)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="text-gray-600 dark:text-gray-400">{"<70%"} (Critical)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span className="text-gray-600 dark:text-gray-400">Target: 95%</span>
            </div>
          </div>
        </ModernChartCard>

        {/* Appointment Trends */}
        <ModernChartCard title="Appointment Trends">
          <div className="h-72">
            <Line data={appointmentTrendsData} options={trendsOptions} />
          </div>
        </ModernChartCard>
      </div>

      {/* Inventory Status */}
      <ModernChartCard title="Vaccine Inventory Status">
        <div className="h-80">
          <Bar data={inventoryData} options={inventoryOptions} />
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div className="flex gap-4 text-sm">
            <Badge variant="success">Good Stock</Badge>
            <Badge variant="warning">Low Stock</Badge>
            <Badge variant="danger">Critical</Badge>
          </div>
          <Button variant="secondary" size="sm">
            View Full Inventory
          </Button>
        </div>
      </ModernChartCard>

      {/* Appointments and Inventory Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModernChartCard title="Recent Appointments">
          <div className="space-y-4">
            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{appointment.vaccine}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.date}</p>
                  </div>
                  <Badge
                    variant={
                      appointment.status === "completed" ? "success" : "warning"
                    }
                  >
                    {appointment.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No appointments found</p>
            )}
          </div>
          {selectedVaccine && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Selected Vaccine: {selectedVaccine}
              </p>
            </div>
          )}
        </ModernChartCard>

        <ModernChartCard title="Inventory Alerts">
          <div className="space-y-4">
            {inventory.length > 0 ? (
              inventory.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                  onClick={() => setSelectedVaccine(item.name)}
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Stock: {item.stock}</p>
                  </div>
                  <Badge
                    variant={
                      item.stock <= item.threshold ? "danger" : "success"
                    }
                  >
                    {item.stock <= item.threshold ? "Low Stock" : "Good"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No inventory data</p>
            )}
          </div>
        </ModernChartCard>
      </div>

      {/* Quick Actions */}
      <ModernChartCard title="Quick Actions">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Button variant="primary" size="lg" className="w-full">
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6l4 2"
                />
              </svg>
              Record Vaccination
            </span>
          </Button>
          <Button variant="secondary" size="lg" className="w-full">
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Schedule Appointment
            </span>
          </Button>
          <Button variant="outline" size="lg" className="w-full">
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate Reports
            </span>
          </Button>
          <Button variant="outline" size="lg" className="w-full">
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-5 5v-5zM11 19H6a2 2 0 01-2-2V7a2 2 0 012-2h7l5 5v2"
                />
              </svg>
              Export Data
            </span>
          </Button>
        </div>
      </ModernChartCard>
    </div>
  );
};
