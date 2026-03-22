import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Input,
  Card,
  EmptyState,
  SkeletonCard,
} from "./UI";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

export default function MonitoringDashboard({ onRefresh }) {
  const { hasPermission, isAdmin, isAdminOrSuperAdmin, user } = useAuth();
  const [monitoringData, setMonitoringData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertsError, setAlertsError] = useState(null);
  const [timeRange, setTimeRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
  });
  const canAccessMonitoring = hasPermission("dashboard:analytics");

  const fetchData = useCallback(async () => {
    if (!canAccessMonitoring) {
      setLoading(false);
      setMonitoringData(null);
      setAlerts([]);
      setAlertsError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setAlertsError(null);

      // Fetch monitoring data and alerts in parallel
      const monitoringPromise = apiClient.getMonitoringData(timeRange);
      const alertsPromise = apiClient.getDocumentAlerts({
        status: "PENDING",
        limit: 20,
      });

      const [monitoringResponse, alertsResponse] = await Promise.allSettled([
        monitoringPromise,
        alertsPromise,
      ]);

      // Handle monitoring data
      if (monitoringResponse.status === "fulfilled") {
        setMonitoringData(monitoringResponse.value.data);
      } else {
        console.warn(
          "Monitoring data fetch failed:",
          monitoringResponse.reason,
        );
      }

      // Handle alerts separately to not block the entire dashboard
      if (alertsResponse.status === "fulfilled") {
        setAlerts(alertsResponse.value.data);
      } else {
        const errorResponse = alertsResponse.reason?.response;
        if (errorResponse?.status === 403) {
          setAlertsError(
            "Access to monitoring alerts requires analytics permission.",
          );
          setAlerts([]);
        } else {
          setAlertsError("Failed to load alerts");
          setAlerts([]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canAccessMonitoring, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
    if (onRefresh) onRefresh();
  };

  const getAlertSeverity = (alert) => {
    const daysSinceUpdate = alert.days_since_update || 0;
    if (daysSinceUpdate > 30) return "critical";
    if (daysSinceUpdate > 14) return "warning";
    return "info";
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200";
      case "warning":
        return "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200";
      case "info":
        return "bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200";
      default:
        return "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200";
    }
  };

  if (!canAccessMonitoring) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You do not have permission to access monitoring analytics.
        </p>
      </div>
    );
  }

  if (loading && !monitoringData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">Error: {error}</div>
        <Button onClick={handleRefresh} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            Monitoring Dashboard
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring and analytics for digital paper system
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Period:
            </label>
            <Input
              type="date"
              value={timeRange.start_date}
              onChange={(e) =>
                setTimeRange((prev) => ({
                  ...prev,
                  start_date: e.target.value,
                }))
              }
              className="w-32"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              value={timeRange.end_date}
              onChange={(e) =>
                setTimeRange((prev) => ({ ...prev, end_date: e.target.value }))
              }
              className="w-32"
            />
          </div>
          <Button onClick={handleRefresh}>Refresh Data</Button>
        </div>
      </div>

      {/* Stats Cards */}
      {monitoringData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Total Generations
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {monitoringData.generation_stats?.total_generations || 0}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Unique Infants
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {monitoringData.generation_stats?.unique_infants || 0}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Successful Generations
            </h3>
            <p className="text-2xl font-bold text-blue-600">
              {monitoringData.generation_stats?.successful_generations || 0}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Failed Generations
            </h3>
            <p className="text-2xl font-bold text-red-600">
              {monitoringData.generation_stats?.failed_generations || 0}
            </p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts Section */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-100">
            Document Completion Alerts
          </h4>
          <div className="space-y-3">
            {alertsError ? (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {alertsError}
                </p>
              </div>
            ) : alerts.length > 0 ? (
              alerts.map((alert) => {
                const severity = getAlertSeverity(alert);
                return (
                  <Card
                    key={alert.id}
                    className={`p-4 border-l-4 ${getAlertColor(severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {alert.template_name}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                            {alert.template_type}
                          </span>
                        </div>
                        <p className="text-sm">
                          Infant: {alert.infant_first_name}{" "}
                          {alert.infant_last_name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Last updated:{" "}
                          {new Date(alert.last_updated).toLocaleString()}
                        </p>
                        {alert.days_since_update && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {alert.days_since_update} days since last update
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled title="Feature coming soon">
                          View Details
                        </Button>
                        <Button size="sm" disabled title="Feature coming soon">Mark Complete</Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                title="No alerts at this time"
                description="All documents are up to date. Great job!"
                icon="✅"
                className="border-none shadow-none py-12"
              />
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-100">
            Recent Activity
          </h4>
          <div className="space-y-3">
            {monitoringData?.recent_downloads?.length > 0 ? (
              monitoringData.recent_downloads.map((download) => (
                <Card key={download.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {download.template_name}
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                          {download.download_type}
                        </span>
                      </div>
                      <p className="text-sm">
                        Infant: {download.infant_first_name}{" "}
                        {download.infant_last_name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Generated by: {download.user_first_name}{" "}
                        {download.user_last_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {new Date(download.download_date).toLocaleString()}
                      </p>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          download.download_status === "COMPLETED"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }`}
                      >
                        {download.download_status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState
                title="No recent activity"
                description="There has been no document generation activity in the selected period."
                icon="📊"
                className="border-none shadow-none py-12"
              />
            )}
          </div>
        </div>
      </div>

      {/* Completion Overview */}
      {monitoringData?.completion_overview && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-100">
            Completion Status Overview
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {monitoringData.completion_overview.map((status) => (
              <Card key={status.completion_status} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {status.completion_status}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {status.count}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Percentage
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {status.percentage}%
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {monitoringData?.performance_metrics && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-100">
            System Performance
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Avg Generation Time
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {monitoringData.performance_metrics.avg_generation_time || 0}ms
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Failed Generation Rate
              </h3>
              <p className="text-2xl font-bold text-red-600">
                {monitoringData.performance_metrics.failed_generation_rate || 0}
                %
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Avg Completion Percentage
              </h3>
              <p className="text-2xl font-bold text-green-600">
                {monitoringData.performance_metrics.avg_completion_percentage ||
                  0}
                %
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
