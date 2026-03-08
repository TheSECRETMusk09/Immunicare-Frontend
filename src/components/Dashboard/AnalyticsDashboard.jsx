import React, { useState, useEffect } from "react";
import { Card, Button, Alert } from "../UI";
import { useDashboard } from "../../hooks/useDashboard";
import { apiClient } from "../../utils/api";
import useWebSocket from "../../hooks/useWebSocket";
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
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
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

export const AnalyticsDashboard = () => {
  const { stats, analytics, loading, error } = useDashboard();
  const [timeRange, setTimeRange] = useState("month");
  const [chartType, setChartType] = useState("vaccinations");
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const { isConnected, on } = useWebSocket();
  const [realtimeStats, setRealtimeStats] = useState(null);

  // Sync with fetched stats initially
  useEffect(() => {
    if (stats) {
      setRealtimeStats(stats);
    }
  }, [stats]);

  // Default zero values to ensure UI renders without degradation
  const defaultStats = {
    totalVaccinations: 0,
    coverageRate: 0,
    appointmentCompletion: 0,
    inventoryStatus: 0,
    activeUsers: 0,
    activeUsersChange: 0,
    systemHealth: 100,
    pendingApprovals: 0,
    apiResponseTime: 0,
    databaseQueries: 0,
    storageUsage: 0,
    storageFree: 0,
    onTimeVaccinations: 0,
    missedAppointments: 0,
    stockTurnout: 0,
    dataCompleteness: 0
  };

  const displayStats = realtimeStats || defaultStats;

  // Sample data for vaccination coverage by age group - modern styling
  const coverageByAgeData = {
    labels: ["0-6 months", "6-12 months", "1-2 years", "2-5 years"],
    datasets: [
      {
        label: "Coverage Rate",
        data: [85, 72, 65, 58],
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 40,
      },
    ],
  };

  // Sample data for appointment trends - modern styling
  const appointmentTrendsData = {
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    datasets: [
      {
        label: "Completed",
        data: [120, 150, 180, 200, 220, 210, 230, 250, 240, 260, 270, 280],
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
      {
        label: "Missed",
        data: [20, 15, 18, 12, 10, 14, 16, 18, 15, 12, 10, 8],
        borderColor: "rgba(239, 68, 68, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "rgba(239, 68, 68, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Sample data for vaccine inventory levels - modern styling
  const inventoryLevelsData = {
    labels: ["BCG", "Hepatitis B", "Pentavalent", "OPV", "IPV", "PCV", "MMR"],
    datasets: [
      {
        label: "Stock Level",
        data: [150, 200, 180, 250, 120, 170, 140],
        backgroundColor: [
          "rgba(139, 92, 246, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(239, 68, 68, 0.8)",
          "rgba(236, 72, 153, 0.8)",
          "rgba(20, 184, 166, 0.8)",
        ],
        borderColor: [
          "rgba(139, 92, 246, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(245, 158, 11, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(236, 72, 153, 1)",
          "rgba(20, 184, 166, 1)",
        ],
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 32,
      },
    ],
  };

  // Sample data for vaccination coverage by vaccine type - modern doughnut
  const coverageByVaccineData = {
    labels: ["BCG", "Hepatitis B", "Pentavalent", "OPV", "IPV", "PCV", "MMR"],
    datasets: [
      {
        data: [95, 88, 76, 82, 65, 70, 55],
        backgroundColor: [
          "rgba(59, 130, 246, 0.85)",
          "rgba(16, 185, 129, 0.85)",
          "rgba(245, 158, 11, 0.85)",
          "rgba(139, 92, 246, 0.85)",
          "rgba(236, 72, 153, 0.85)",
          "rgba(20, 184, 166, 0.85)",
          "rgba(249, 115, 22, 0.85)",
        ],
        hoverBackgroundColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(245, 158, 11, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(236, 72, 153, 1)",
          "rgba(20, 184, 166, 1)",
          "rgba(249, 115, 22, 1)",
        ],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  // Gender data for male vs female doughnut chart
  const genderData = {
    labels: ["Male", "Female"],
    datasets: [
      {
        data: [52, 48],
        backgroundColor: [
          "rgba(59, 130, 246, 0.9)",
          "rgba(139, 92, 246, 0.9)",
        ],
        hoverBackgroundColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(139, 92, 246, 1)",
        ],
        borderWidth: 0,
        hoverOffset: 6,
        cutout: "65%",
      },
    ],
  };

  // Fetch chart data
  useEffect(() => {
    const fetchChartData = async () => {
      setChartLoading(true);
      try {
        let data;
        switch (chartType) {
          case "vaccinations":
            data = await apiClient.getVaccinationAnalytics({
              period: timeRange,
            });
            break;
          case "appointments":
            data = await apiClient.getAppointmentAnalytics({
              period: timeRange,
            });
            break;
          case "inventory":
            data = await apiClient.getVaccineInventoryStats({
              period: timeRange,
            });
            break;
          default:
            data = null;
        }
        setChartData(data);
      } catch (error) {
        console.error("Failed to fetch chart data:", error);
        setChartData(null);
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, [chartType, timeRange]);

  // Real-time data updates via WebSocket
  useEffect(() => {
    if (isConnected) {
      on("stats-update", (updatedStats) => {
        setRealtimeStats((prev) => ({ ...prev, ...updatedStats }));
      });

      on("chart-data-update", (data) => {
        console.log("Real-time chart data update:", data);
        setChartData(data);
      });
    }

    if (!isConnected) {
      const interval = setInterval(() => {
        const updatedStats = {
          ...displayStats,
          activeUsers:
            displayStats.activeUsers + Math.floor(Math.random() * 3) - 1,
          systemHealth:
            Math.min(100, Math.max(90, displayStats.systemHealth - Math.floor(Math.random() * 2))),
          databaseQueries:
            Math.max(0, displayStats.databaseQueries + Math.floor(Math.random() * 5)),
          apiResponseTime:
            Math.max(0, displayStats.apiResponseTime + Math.floor(Math.random() * 10) - 5),
        };
        setRealtimeStats((prev) => ({ ...(prev || defaultStats), ...updatedStats }));
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isConnected, on]);

  if (error) return <Alert type="error">{error}</Alert>;

  // Common chart options for modern styling
  const getCommonChartOptions = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 20,
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
      title: {
        display: false,
      },
    },
    scales: {
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
      y: {
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
    },
  });

  const renderChart = () => {
    if (chartLoading) {
      return <div className="h-64 flex items-center justify-center text-gray-500">Loading chart data...</div>;
    }

    const data = chartData || getFallbackData(chartType);

    switch (chartType) {
      case "vaccinations":
        return (
          <Bar
            data={data}
            options={{
              ...getCommonChartOptions("Vaccination Coverage"),
              scales: {
                ...getCommonChartOptions().scales,
                y: {
                  ...getCommonChartOptions().scales.y,
                  beginAtZero: true,
                  max: 100,
                },
              },
            }}
          />
        );
      case "appointments":
        return (
          <Line
            data={data}
            options={{
              ...getCommonChartOptions("Appointment Trends"),
              interaction: {
                mode: "index",
                intersect: false,
              },
              plugins: {
                ...getCommonChartOptions().plugins,
              },
            }}
          />
        );
      case "inventory":
        return (
          <Bar
            data={data}
            options={{
              ...getCommonChartOptions("Vaccine Inventory"),
            }}
          />
        );
      default:
        return null;
    }
  };

  const getFallbackData = (type) => {
    switch (type) {
      case "vaccinations":
        return coverageByAgeData;
      case "appointments":
        return appointmentTrendsData;
      case "inventory":
        return inventoryLevelsData;
      default:
        return null;
    }
  };

  return (
    <div className="analytics-dashboard p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Analytics Dashboard</h1>

      {/* Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Button
            variant={chartType === "vaccinations" ? "primary" : "secondary"}
            onClick={() => setChartType("vaccinations")}
            aria-label="Show vaccinations chart"
          >
            Vaccinations
          </Button>
          <Button
            variant={chartType === "appointments" ? "primary" : "secondary"}
            onClick={() => setChartType("appointments")}
            aria-label="Show appointments chart"
          >
            Appointments
          </Button>
          <Button
            variant={chartType === "inventory" ? "primary" : "secondary"}
            onClick={() => setChartType("inventory")}
            aria-label="Show inventory chart"
          >
            Inventory
          </Button>
        </div>

        <div className="relative">
          <label htmlFor="timeRange" className="sr-only">
            Select time range
          </label>
          <select
            id="timeRange"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Select time range"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Vaccinations</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {displayStats.totalVaccinations.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">This {timeRange}</div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Coverage Rate</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{displayStats.coverageRate}%</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Target: 95%</div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Appointment Completion</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {displayStats.appointmentCompletion}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Completion Rate</div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Inventory Status</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {displayStats.inventoryStatus}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Adequate Stock</div>
        </Card>
      </div>

      {/* Main Chart */}
      <ModernChartCard title="Analytics Overview" className="mb-6">
        <div className="h-80">{renderChart()}</div>
      </ModernChartCard>

      {/* Real-time Data Section */}
      <ModernChartCard title="Real-time Monitoring" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Active Users
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayStats.activeUsers}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ {displayStats.activeUsersChange}% increase
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                System Health
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayStats.systemHealth}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                All systems operational
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Pending Approvals
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayStats.pendingApprovals}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠ Requires attention
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                API Response Time
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayStats.apiResponseTime}ms
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Average latency
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Database Queries
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayStats.databaseQueries}/sec
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Current load
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Storage Usage
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayStats.storageUsage}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {displayStats.storageFree}GB available
              </div>
            </div>
          </div>
        </div>
      </ModernChartCard>

      {/* Additional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <ModernChartCard title="Vaccination Coverage by Type">
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={coverageByVaccineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "55%",
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      usePointStyle: true,
                      padding: 15,
                      font: {
                        size: 11,
                      },
                    },
                  },
                  tooltip: {
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    padding: 12,
                    cornerRadius: 8,
                  },
                },
              }}
            />
          </div>
        </ModernChartCard>

        <ModernChartCard title="Gender Distribution">
          <div className="h-64 flex items-center justify-center relative">
            <Doughnut
              data={genderData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      usePointStyle: true,
                      padding: 15,
                      font: {
                        size: 12,
                      },
                      color: "#6B7280",
                    },
                  },
                  tooltip: {
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: function(context) {
                        return `${context.label}: ${context.raw}%`;
                      }
                    }
                  },
                },
              }}
            />
            {/* Centered summary text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">100%</span>
            </div>
          </div>
        </ModernChartCard>

        <ModernChartCard title="Performance Metrics">
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">On-time Vaccinations</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {displayStats.onTimeVaccinations}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Missed Appointments</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {displayStats.missedAppointments}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Stock Turnout Rate</span>
              <span className="font-bold text-gray-900 dark:text-white">{displayStats.stockTurnout}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 dark:text-gray-400">Data Completeness</span>
              <span className="font-bold text-gray-900 dark:text-white">{displayStats.dataCompleteness}%</span>
            </div>
          </div>
        </ModernChartCard>
      </div>

      {/* Export Options */}
      <ModernChartCard title="Export Options">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" aria-label="Export as PDF" className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export as PDF
          </Button>
          <Button variant="secondary" aria-label="Export as Excel" className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export as Excel
          </Button>
          <Button variant="secondary" aria-label="Export as CSV" className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="-4 mr-2"
              fill="none"
              viewBox="0h-4 w 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export as CSV
          </Button>
        </div>
      </ModernChartCard>
    </div>
  );
};
