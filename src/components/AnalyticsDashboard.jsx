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
} from "lucide-react";
import { Button, Select, Card } from "./UI";
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
            style={{ color: entry.color }}
            className="flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
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
            <span className="text-gray-700 dark:text-gray-300">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("30days");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Deterministic mock data fallbacks (no random values)
  const mockVaccinationData = useCallback(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((month, index) => ({
      month,
      administered: 35 + index * 5,
      scheduled: 25 + index * 3,
      pending: 10 + index * 2,
    }));
  }, []);

  const mockAppointmentData = useCallback(() => {
    return [
      { status: "Scheduled", value: 45 },
      { status: "Completed", value: 35 },
      { status: "Cancelled", value: 15 },
      { status: "No Show", value: 5 },
    ];
  }, []);

  const mockInventoryData = useCallback(() => {
    return [
      { name: "BCG", value: 150, status: "good" },
      { name: "Hepatitis B", value: 89, status: "warning" },
      { name: "Penta", value: 45, status: "danger" },
      { name: "OPV", value: 120, status: "good" },
      { name: "PCV", value: 67, status: "warning" },
      { name: "MR", value: 23, status: "danger" },
    ];
  }, []);

  const mockGrowthData = useCallback(() => {
    const weeks = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44];
    return weeks.map((week) => ({
      week,
      weight: 2.5 + week * 0.2,
      height: 50 + week * 1.5,
      headCircumference: 34 + week * 0.5,
    }));
  }, []);

  // Transform gender data from API to chart format
  const transformGenderData = (demographicsData) => {
    if (!demographicsData?.genderBreakdown || !Array.isArray(demographicsData.genderBreakdown)) {
      return [
        { name: 'Male', value: 52, fill: '#3B82F6' },
        { name: 'Female', value: 48, fill: '#8B5CF6' },
      ];
    }

    return demographicsData.genderBreakdown.map((item, index) => ({
      name: item.label || 'Unknown',
      value: parseInt(item.count, 10) || 0,
      fill: index === 0 ? '#3B82F6' : '#8B5CF6',
    }));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real data from API endpoints
      const [
        vaccinationData,
        appointmentData,
        inventoryData,
        growthData,
        dashboardStats,
        demographicsData,
      ] = await Promise.allSettled([
        apiClient.getVaccinationAnalytics(),
        apiClient.getAppointmentAnalytics(),
        apiClient.getInventoryStats(),
        apiClient.getGrowthStats(),
        apiClient.getDashboardStats(),
        apiClient.getDemographicsAnalytics(),
      ]);

      // Transform data for charts
      const vaccinations = vaccinationData.status === 'fulfilled'
        ? (vaccinationData.value?.trends || [])
        : mockVaccinationData();

      const appointments = appointmentData.status === 'fulfilled'
        ? (appointmentData.value?.statusBreakdown || []).map(item => ({
            status: item.status,
            value: item.count,
          }))
        : mockAppointmentData();

      const inventory = inventoryData.status === 'fulfilled'
        ? (inventoryData.value?.byVaccine || []).map(item => ({
            name: item.vaccineName || item.vaccine_key,
            value: item.availableDoses || 0,
            status: item.criticalStock ? 'danger' : item.lowStock ? 'warning' : 'good',
          }))
        : mockInventoryData();

      const growth = growthData.status === 'fulfilled'
        ? (growthData.value?.data || [])
        : mockGrowthData();

      // Get stats from dashboard or use individual responses
      const stats = dashboardStats.status === 'fulfilled'
        ? dashboardStats.value
        : {};

      // Transform demographics for gender chart
      const gender = demographicsData.status === 'fulfilled'
        ? transformGenderData(demographicsData.value)
        : [
            { name: 'Male', value: 52, fill: '#3B82F6' },
            { name: 'Female', value: 48, fill: '#8B5CF6' },
          ];

      // Extract summary metrics
      const summary = vaccinationData.status === 'fulfilled'
        ? vaccinationData.value?.summary || {}
        : {};

      // Get critical stock alerts from inventory
      const criticalAlerts = inventoryData.status === 'fulfilled'
        ? inventoryData.value?.criticalAlerts || []
        : [];

      setData({
        vaccinations,
        appointments,
        inventory,
        growth,
        gender,
        stats: {
          vaccinations: summary.administeredInPeriod || summary.completedToday || stats.vaccinations || 0,
          appointments: stats.appointments || 0,
          infants: stats.infants || summary.uniqueInfantsServed || 0,
          guardians: stats.guardians || 0,
          lowStock: summary.lowStock || inventoryData.value?.lowStockCount || 0,
          pendingVaccinations: summary.dueInPeriod || 0,
          overdueVaccinations: summary.overdue || 0,
          completedVaccinations: summary.completedToday || 0,
          childrenTracked: summary.uniqueInfantsServed || stats.infants || 0,
          vaccinationCoverage: summary.coverageRate || 0,
        },
        criticalAlerts,
        isUsingFallback: false,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      // Use empty arrays instead of mock data - let the UI show empty states
      setData({
        vaccinations: [],
        appointments: [],
        inventory: [],
        growth: [],
        gender: [],
        stats: {},
        criticalAlerts: [],
        isUsingFallback: true,
      });
    } finally {
      setLoading(false);
    }
  }, [
    mockVaccinationData,
    mockAppointmentData,
    mockInventoryData,
    mockGrowthData,
    transformGenderData,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

  // Check if we're using fallback data
  const isUsingFallback = data.isUsingFallback === true;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasData = data.vaccinations?.length > 0 || data.appointments?.length > 0 || data.inventory?.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Comprehensive insights and metrics for your healthcare center
              </p>
              {isUsingFallback && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  ⚠️ Showing demo data - API connection unavailable
                </p>
              )}
            </div>
            <div className="flex space-x-4">
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-48"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="1year">Last year</option>
              </Select>
              <Button
                variant="primary"
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                  Pending Vaccinations
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats?.pendingVaccinations || "0"}
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Awaiting schedule
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
                  {data.stats?.lowStock || "0"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" dark:stroke="#374151" />
                <XAxis
                  dataKey="month"
                  stroke="#6B7280"
                  dark:stroke="#D1D5DB"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="#6B7280"
                  dark:stroke="#D1D5DB"
                  tick={{ fontSize: 12 }}
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
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
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
                  className="text-gray-600 dark:text-gray-400 text-sm"
                >
                  Total
                </text>
                <text
                  x="50%"
                  y="58%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xl font-bold text-gray-900 dark:text-white"
                >
                  100%
                </text>
              </PieChart>
            </ResponsiveContainer>
          </ModernChartCard>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" dark:stroke="#374151" />
                <XAxis
                  dataKey="name"
                  stroke="#6B7280"
                  dark:stroke="#D1D5DB"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="#6B7280"
                  dark:stroke="#D1D5DB"
                  tick={{ fontSize: 12 }}
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
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" dark:stroke="#374151" />
                <XAxis
                  dataKey="week"
                  stroke="#6B7280"
                  dark:stroke="#D1D5DB"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Week', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  stroke="#6B7280"
                  dark:stroke="#D1D5DB"
                  tick={{ fontSize: 12 }}
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

        {/* Appointment Status */}
        <ModernChartCard
          title="Appointment Status Distribution"
          icon={<Calendar className="h-5 w-5 text-green-500" />}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.appointments}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
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
                className="text-gray-600 dark:text-gray-400 text-sm"
              >
                Appointments
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xl font-bold text-gray-900 dark:text-white"
              >
                100%
              </text>
            </PieChart>
          </ResponsiveContainer>
        </ModernChartCard>

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
              <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-200">
                    Low Stock Alert: Penta Vaccine
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Current stock: 45 vials. Reorder recommended.
                  </p>
                </div>
                <Button size="sm" variant="danger">
                  Restock
                </Button>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-200">
                    Upcoming Appointments
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    15 appointments scheduled for next week. Ensure adequate
                    staffing.
                  </p>
                </div>
                <Button size="sm" variant="warning">
                  View Schedule
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
