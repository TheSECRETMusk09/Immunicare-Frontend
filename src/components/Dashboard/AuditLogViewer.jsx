import React, { useState, useEffect, useCallback } from "react";
import { Card, Button, Alert, DataTable } from "../UI";
import apiClient from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  extractAuditLogsPayload,
  formatAuditLogRow,
} from "../../utils/auditLogAdapters";

export const AuditLogViewer = () => {
  const { hasPermission } = useAuth();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    user: "",
    actionType: "",
    dateRange: "week",
    severity: "",
  });
  const [exporting, setExporting] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    if (!hasPermission("system:audit")) {
      setLoading(false);
      setAuditLogs([]);
      return;
    }

    try {
      setLoading(true);
      const params = {
        user: filters.user,
        action_type: filters.actionType,
        dateRange: filters.dateRange,
        severity: filters.severity,
      };
      const response = await apiClient.getAuditLogs(params);
      const formattedLogs = extractAuditLogsPayload(response).logs.map(
        formatAuditLogRow,
      );
      setAuditLogs(formattedLogs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.user, filters.actionType, filters.dateRange, filters.severity, hasPermission]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const exportPayload = await apiClient.exportAuditLogs({
        user: filters.user,
        action_type: filters.actionType,
        dateRange: filters.dateRange,
        severity: filters.severity,
      });
      const blob =
        exportPayload instanceof Blob
          ? exportPayload
          : new Blob([exportPayload], { type: "text/csv;charset=utf-8" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setExporting(false);
    } catch (err) {
      setError(err.message);
      setExporting(false);
    }
  };

  // Real-time monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuditLogs();
    }, 30000); // Refresh logs every 30 seconds

    return () => clearInterval(interval);
  }, [fetchAuditLogs]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "info":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const auditLogColumns = [
    { Header: "Timestamp", accessor: "timestamp" },
    { Header: "User", accessor: "user" },
    { Header: "Action", accessor: "action" },
    {
      Header: "Severity",
      accessor: "severity",
      Cell: ({ value }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${getSeverityColor(
            value,
          )}`}
        >
          {value}
        </span>
      ),
    },
    { Header: "IP Address", accessor: "ipAddress" },
    { Header: "Details", accessor: "details" },
  ];

  if (!hasPermission("system:audit")) {
    return (
      <Alert variant="warning">
        Audit log access requires the system audit permission.
      </Alert>
    );
  }

  if (loading) return <div>Loading audit logs...</div>;
  if (error) return <Alert variant="error">{error}</Alert>;

  return (
    <div className="audit-log-viewer">
      <h1 className="text-2xl font-bold mb-6">Audit Log Viewer</h1>

      {/* Filter Controls */}
      <Card title="Filter Audit Logs" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User
            </label>
            <input
              type="text"
              name="user"
              value={filters.user}
              onChange={handleFilterChange}
              placeholder="Filter by user"
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action Type
            </label>
            <select
              name="actionType"
              value={filters.actionType}
              onChange={handleFilterChange}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="export">Export</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Range
            </label>
            <select
              name="dateRange"
              value={filters.dateRange}
              onChange={handleFilterChange}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Severity
            </label>
            <select
              name="severity"
              value={filters.severity}
              onChange={handleFilterChange}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <Button onClick={fetchAuditLogs} variant="secondary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5"
            />
          </svg>
          Refresh Data
        </Button>
        <Button onClick={handleExport} disabled={exporting}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {exporting ? "Exporting..." : "Export Logs"}
        </Button>
      </div>

      {/* Audit Logs Table */}
      <Card title="Audit Logs">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Showing {auditLogs.length} logs for the selected filters
        </div>
        <DataTable columns={auditLogColumns} data={auditLogs} pagination />
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card title="Total Logs">
          <div className="text-3xl font-bold">{auditLogs.length}</div>
          <div className="text-sm text-gray-500">This period</div>
        </Card>

        <Card title="Critical Events">
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {auditLogs.filter((log) => log.severity === "critical").length}
          </div>
          <div className="text-sm text-gray-500">Requires attention</div>
        </Card>

        <Card title="User Activity">
          <div className="text-3xl font-bold">
            {new Set(auditLogs.map((log) => log.user)).size}
          </div>
          <div className="text-sm text-gray-500">Active users</div>
        </Card>
      </div>
    </div>
  );
};
