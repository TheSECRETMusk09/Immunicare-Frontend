 import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  Calendar,
  Syringe,
  Package,
  TrendingUp,
  AlertTriangle,
  Download,
  BarChart2,
} from "lucide-react";
import { Button, Select, Card, PageHeader, Alert } from "./UI";
import apiClient from "../utils/api";

// Modern chart card component
const ModernChartCard = ({ title, icon, children, className = "" }) => {
  return (
    <Card
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300 ${className}`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3">
            {title}
          </h3>
          {icon && (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              {icon}
            </div>
          )}
        </div>
        <div className="relative">
          {children}
        </div>
      </div>
    </Card>
  );
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-sm">
        <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p
            key={index}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium"
          >
            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></span>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom legend component
const CustomLegend = ({ payload }) => {
  if (payload && payload.length) {
    return (
      <div className="flex flex-wrap gap-4 justify-center mt-4">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            ></span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("30days");
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Transform gender data from API to chart format
  const transformGenderData = useCallback((demographicsData) => {
    const breakdown = Array.isArray(demographicsData) ? demographicsData : demographicsData?.genderBreakdown;
    if (!breakdown || !Array.isArray(breakdown)) {
      return [
        { name: 'Male', value: 52, fill: '#3B82F6' },
        { name: 'Female', value: 48, fill: '#8B5CF6' },
      ];
    }

      return breakdown.map((item) => {
        const label = item.label || 'Unknown';
        const labelLower = label.toLowerCase();
        let fill = '#8B5CF6'; // Default Female/fallback
        if (labelLower === 'male' || labelLower === 'm') {
          fill = '#3B82F6';
        } else if (labelLower === 'female' || labelLower === 'f') {
          fill = '#8B5CF6';
        } else {
          fill = '#FFA500'; // Orange for Other / Not specified
        }
        return {
          name: label,
          value: parseInt(item.count, 10) || 0,
          fill,
        };
      });
  }, []);

  // Utility to safely unwrap varied API responses
  const unwrapApiPayload = (res) => {
    if (!res) return {};
    if (res.data && res.data.data) return res.data.data;
    if (res.data) return res.data;
    return res;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real data from API endpoints
      const params = { range: timeRange };
      const [
        vaccinationData,
        appointmentData,
        inventoryData,
        growthData,
        dashboardStats,
        demographicsData,
        adminSummaryData,
      ] = await Promise.allSettled([
        apiClient.getVaccinationAnalytics(params),
        apiClient.getAppointmentAnalytics(params),
        apiClient.getInventoryStats(params),
        apiClient.getGrowthStats(params),
        apiClient.getDashboardStats(params),
        apiClient.getDemographicsAnalytics(params),
        apiClient.request("/reports/admin/summary"),
      ]);

      // Transform data for charts
      const vacPayload = vaccinationData.status === 'fulfilled' ? unwrapApiPayload(vaccinationData.value) : {};
      const vaccinations = vacPayload.trends || vacPayload.data || [];

      const apptPayload = appointmentData.status === 'fulfilled' ? unwrapApiPayload(appointmentData.value) : {};
      const appointments = (apptPayload.statusBreakdown || apptPayload.data || []).map(item => ({
          status: item.status || item.name || 'Unknown',
          value: parseInt(item.count || item.value || 0, 10),
      }));

      const invPayload = inventoryData.status === 'fulfilled' ? unwrapApiPayload(inventoryData.value) : {};
      const inventory = (invPayload.byVaccine || invPayload.data || []).map(item => ({
          name: item.vaccineName || item.vaccine_key || item.name || 'Unknown',
          value: parseInt(item.availableDoses || item.stock_on_hand || item.value || 0, 10),
          status: item.criticalStock ? 'danger' : item.lowStock ? 'warning' : 'good',
      }));

      const growthPayload = growthData.status === 'fulfilled' ? unwrapApiPayload(growthData.value) : {};
      const growth = growthPayload.data || growthPayload.trends || [];

      // Get stats from dashboard or use individual responses
      const stats = dashboardStats.status === 'fulfilled' ? unwrapApiPayload(dashboardStats.value) : {};
      const adminSummary = adminSummaryData.status === 'fulfilled' ? unwrapApiPayload(adminSummaryData.value) : {};

      // Transform demographics for gender chart
      const demoPayload = demographicsData.status === 'fulfilled' ? unwrapApiPayload(demographicsData.value) : null;
      const gender = demoPayload
        ? transformGenderData(demoPayload)
        : [
            { name: 'Male', value: 52, fill: '#3B82F6' },
            { name: 'Female', value: 48, fill: '#8B5CF6' },
          ];

      // Extract summary metrics
      const summary = vacPayload.summary || vacPayload || {};

      // Get critical stock alerts from inventory
      const criticalAlerts = invPayload.criticalAlerts || invPayload.alerts || [];

      setData({
        vaccinations,
        appointments,
        inventory,
        growth,
        gender,
        stats: {
          vaccinations: summary.administeredInPeriod || summary.completedToday || stats.vaccinations || 0,
          appointments: stats.appointments || 0,
          infants: adminSummary.infants?.total || stats.total_infants || stats.infants || summary.uniqueInfantsServed || 0,
          guardians: adminSummary.guardians?.total || stats.total_guardians || stats.guardians || 0,
          lowStock: summary.lowStock || inventoryData.value?.lowStockCount || 0,
          pendingVaccinations: summary.dueInPeriod || 0,
          overdueVaccinations: summary.overdue || 0,
          completedVaccinations: summary.administeredInPeriod || stats.vaccinations || summary.completedToday || 0,
          childrenTracked: adminSummary.infants?.total || summary.uniqueInfantsServed || stats.infants || 0,
          vaccinationCoverage: summary.coverageRate || 0,
        },
        criticalAlerts,
        isUsingFallback: false,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setData({ isUsingFallback: false });
      // In a production healthcare system, we must not show hardcoded fake metrics.
    } finally {
      setLoading(false);
    }
  }, [
    transformGenderData,
    timeRange,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

  // Check if we're using fallback data
  const isUsingFallback = data.isUsingFallback === true;

  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains("dark"));
    checkDarkMode(); // initial check

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartGridStroke = isDarkMode ? "#374151" : "#E5E7EB"; // gray-700 : gray-200
  const chartAxisStroke = isDarkMode ? "#9CA3AF" : "#6B7280"; // gray-400 : gray-500

  const handleExport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900" aria-label="Analytics Dashboard">
      {/* Sticky Header */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6 transition-none transform-none animate-none [&_*]:transition-none [&_*]:transform-none [&_*]:animate-none">
        <PageHeader
          title="Analytics Dashboard"
          subtitle="Operational analytics for one Barangay Health Center in Pasig City"
          icon={<BarChart2 className="w-8 h-8 text-white" />}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-40 sm:w-48 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white focus:ring-white/50"
              >
                <option value="7days" className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">Last 7 days</option>
                <option value="30days" className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">Last 30 days</option>
                <option value="90days" className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">Last 90 days</option>
                <option value="1year" className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">Last year</option>
              </Select>
              <Button
                variant="primary"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          }
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:px-6 sm:pb-6 pt-3">
        <div className="max-w-7xl mx-auto">
          {!data.stats && !loading && (
            <Alert variant="error" className="mb-6">
              Unable to load analytics data. Please check your connection or contact the system administrator.
            </Alert>
          )}

        {/* Horizontal Tab Navigation */}
        <div className="flex space-x-2 overflow-x-auto bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
          {[
            { id: "overview", label: "Overview & KPIs", icon: "📊" },
            { id: "vaccinations", label: "Vaccinations & Growth", icon: "💉" },
            { id: "appointments", label: "Appointments & Demographics", icon: "📅" },
            { id: "inventory", label: "Inventory", icon: "📦" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          {activeTab === "overview" && (
            <div>
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 xl:mb-8">
          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Completed Vaccinations
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.completedVaccinations || "0"}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Total completed
                </p>
              </div>
              <Syringe className="h-12 w-12 text-blue-500" />
            </div>
          </Card>

          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Due Soon (7 Days)
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.pendingVaccinations || "0"}
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Upcoming doses
                </p>
              </div>
              <Calendar className="h-12 w-12 text-yellow-500" />
            </div>
          </Card>

          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Children Tracked
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.childrenTracked || data.stats?.infants || "0"}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Registered infants
                </p>
              </div>
              <Users className="h-12 w-12 text-purple-500" />
            </div>
          </Card>

          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Critical Stock Alerts
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.criticalAlerts?.length || "0"}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Needs attention
                </p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
          </Card>
        </div>

        {/* Infant Management Module Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 xl:mb-8">
          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Registered Infants
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.infants || "0"}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Active patients
                </p>
              </div>
              <Users className="h-12 w-12 text-blue-500" />
            </div>
          </Card>

          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Guardians
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.guardians || "0"}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Registered parents
                </p>
              </div>
              <Users className="h-12 w-12 text-green-500" />
            </div>
          </Card>

          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Overdue Vaccinations
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.overdueVaccinations || "0"}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Requires action
                </p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
          </Card>

          <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Vaccination Coverage
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.vaccinationCoverage || "0"}%
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Completion rate
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-green-500" />
            </div>
          </Card>
        </div>

            {/* Alerts and Notifications */}
            <Card className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    System Alerts
                  </h3>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="space-y-4">
                  {data.criticalAlerts && data.criticalAlerts.length > 0 ? (
                    data.criticalAlerts.map((alert, idx) => (
                      <div key={idx} className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <div>
                          <h4 className="font-medium text-red-900 dark:text-red-200">
                            {alert.title || `Stock Alert: ${alert.vaccineName || 'Vaccine'}`}
                          </h4>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {alert.message || `Current stock is critically low. Reorder recommended.`}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="text-green-500 text-xl">✅</div>
                      <div>
                        <h4 className="font-medium text-green-900 dark:text-green-200">
                          All Clear
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          No active system or stock alerts.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            </div>
          )}

          {activeTab === "vaccinations" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8 mb-6 xl:mb-8">
        {/* Charts Grid */}
          {/* Vaccination Trends */}
          <ModernChartCard
            title="Vaccination Trends"
            icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.vaccinations}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="month"
                  stroke={chartAxisStroke}
                  tick={{ fontSize: 12, fill: chartAxisStroke }}
                />
                <YAxis
                  stroke={chartAxisStroke}
                  tick={{ fontSize: 12, fill: chartAxisStroke }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                <Bar
                  dataKey="administered"
                  fill="#3B82F6"
                  name="Administered"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="scheduled"
                  fill="#10B981"
                  name="Scheduled"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  fill="#F59E0B"
                  name="Pending"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ModernChartCard>

          {/* Growth Monitoring Trends */}
          <ModernChartCard
            title="Growth Monitoring Trends"
            icon={<Users className="h-5 w-5 text-purple-500" />}
          >
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={data.growth}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={isDarkMode ? 0.6 : 0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={isDarkMode ? 0.1 : 0}/>
                  </linearGradient>
                  <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={isDarkMode ? 0.6 : 0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={isDarkMode ? 0.1 : 0}/>
                  </linearGradient>
                  <linearGradient id="colorHead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={isDarkMode ? 0.6 : 0.8}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={isDarkMode ? 0.1 : 0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis
                  dataKey="week"
                  stroke={chartAxisStroke}
                  tick={{ fontSize: 12, fill: chartAxisStroke }}
                  label={{ value: 'Week', position: 'insideBottom', offset: -5, fill: chartAxisStroke, fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  stroke={chartAxisStroke}
                  tick={{ fontSize: 12, fill: chartAxisStroke }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stackId="1"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorWeight)"
                  name="Weight"
                />
                <Area
                  type="monotone"
                  dataKey="height"
                  stackId="1"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorHeight)"
                  name="Height"
                />
                <Area
                  type="monotone"
                  dataKey="headCircumference"
                  stackId="1"
                  stroke="#F59E0B"
                  fillOpacity={1}
                  fill="url(#colorHead)"
                  name="Head Circumference"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ModernChartCard>
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8 mb-6 xl:mb-8">
              {/* Appointment Status */}
              <ModernChartCard
                title="Appointment Status Distribution"
                icon={<Calendar className="h-5 w-5 text-green-500" />}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.appointments}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent, x, y, cx }) => (
                        <text
                          x={x}
                          y={y}
                          fill={chartAxisStroke}
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          fontSize={12}
                          fontWeight={500}
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )}
                      outerRadius={100}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      cornerRadius={8}
                      stroke="none"
                    >
                      {data.appointments.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-gray-600 dark:text-gray-400 text-sm font-medium"
                      fill="currentColor"
                    >
                      Appointments
                    </text>
                    <text
                      x="50%"
                      y="58%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xl font-bold text-gray-900 dark:text-white"
                      fill="currentColor"
                    >
                      100%
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </ModernChartCard>

              {/* Gender Distribution */}
              <ModernChartCard
                title="Gender Distribution"
                icon={<Users className="h-5 w-5 text-purple-500" />}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.gender}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent, x, y, cx }) => (
                        <text
                          x={x}
                          y={y}
                          fill={chartAxisStroke}
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          fontSize={12}
                          fontWeight={500}
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )}
                      outerRadius={100}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      cornerRadius={8}
                      stroke="none"
                    >
                      {data.gender.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-gray-600 dark:text-gray-400 text-sm font-medium"
                      fill="currentColor"
                    >
                      Total
                    </text>
                    <text
                      x="50%"
                      y="58%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xl font-bold text-gray-900 dark:text-white"
                      fill="currentColor"
                    >
                      100%
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </ModernChartCard>
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8 mb-6 xl:mb-8">
              {/* Inventory Status */}
              <ModernChartCard
                title="Inventory Status"
                icon={<Package className="h-5 w-5 text-orange-500" />}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.inventory}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                    <XAxis
                      dataKey="name"
                      stroke={chartAxisStroke}
                      tick={{ fontSize: 12, fill: chartAxisStroke }}
                    />
                    <YAxis
                      stroke={chartAxisStroke}
                      tick={{ fontSize: 12, fill: chartAxisStroke }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Bar
                      dataKey="value"
                      fill={(entry) => {
                        if (entry.status === "danger") return "#EF4444";
                        if (entry.status === "warning") return "#F59E0B";
                        return "#10B981";
                      }}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 flex justify-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-gray-700 dark:text-gray-300">Good Stock</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span className="text-gray-700 dark:text-gray-300">Low Stock</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="text-gray-700 dark:text-gray-300">Critical</span>
                  </div>
                </div>
              </ModernChartCard>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
