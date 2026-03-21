import React from "react";
import AdminLayout from "../../components/AdminLayout";
import { Card, Badge } from "../../components/UI";
import { useAuth } from "../../contexts/AuthContext";

const MonitoringDashboard = () => {
  const { isAdmin, isAdminOrSuperAdmin, hasPermission, user } = useAuth();
  const canAccessMonitoring = isAdmin || isAdminOrSuperAdmin || user?.role === "admin" || user?.role === "super_admin" || hasPermission("dashboard:analytics");

  if (!canAccessMonitoring) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 m-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Admin Access Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p>
                You do not have permission to access the monitoring dashboard.
                Analytics permission is required for this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Monitoring Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card title="Total Records">
            <p className="text-3xl font-bold">1,234</p>
            <p className="text-sm text-gray-500">Digital records generated</p>
          </Card>
          <Card title="Active Templates">
            <p className="text-3xl font-bold">8</p>
            <p className="text-sm text-gray-500">Configured templates</p>
          </Card>
          <Card title="System Health">
            <p className="text-3xl font-bold text-green-600">98%</p>
            <Badge variant="success">Operational</Badge>
          </Card>
          <Card title="Pending Tasks">
            <p className="text-3xl font-bold text-yellow-600">12</p>
            <p className="text-sm text-gray-500">Awaiting processing</p>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default MonitoringDashboard;
