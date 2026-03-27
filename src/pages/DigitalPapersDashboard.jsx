import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  PageHeader,
  Alert,
  LoadingSpinner,
} from "../components/UI";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { FileText } from "lucide-react";
import PaperConfiguration from "../components/PaperConfiguration";
import DownloadCenter from "../components/DownloadCenter";
import MonitoringDashboard from "../components/MonitoringDashboard";
import DocumentTemplates from "../components/DocumentTemplates";

export default function DigitalPapersDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTab = searchParams.get("tab");
  const { user, isAdmin, isAdminOrSuperAdmin, isHealthcareWorker } = useAuth();
  const [activeTab, setActiveTab] = useState(urlTab || "paper_configuration");
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalDownloads: 0,
    pendingCompletions: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user has access (admin, doctor, nurse, or healthcare worker)
  const hasAccess =
    isAdmin ||
    isAdminOrSuperAdmin ||
    user?.role_type === "SYSTEM_ADMIN" ||
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    isHealthcareWorker ||
    user?.role === "doctor" ||
    user?.role === "nurse" ||
    user?.role === "physician" ||
    user?.role === "midwife";

  const userRoleDisplay =
    user?.role?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) ||
    "User";

  useEffect(() => {
    if (hasAccess) {
      fetchStats();
    }
  }, [hasAccess]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [templatesResult, recentDownloadsResult, allDownloadsResult, completionsResult] =
        await Promise.allSettled([
          apiClient.getPaperTemplates(),
          apiClient.getDownloadHistory({ limit: 10 }),
          apiClient.getDownloadHistory(), // Fetch absolute totals to prevent artificial shrinkage
          apiClient.getDocumentAlerts({ status: "PENDING", limit: 5 }),
        ]);

      const templates =
        templatesResult.status === "fulfilled" ? templatesResult.value : null;
      const recentDownloads =
        recentDownloadsResult.status === "fulfilled"
          ? recentDownloadsResult.value
          : null;
      const allDownloads =
        allDownloadsResult.status === "fulfilled" ? allDownloadsResult.value : null;
      const completions =
        completionsResult.status === "fulfilled" ? completionsResult.value : null;

      setStats({
        totalTemplates: templates.data?.length || 0,
        totalDownloads:
          allDownloads.pagination?.total ||
          allDownloads.total ||
          allDownloads.data?.length ||
          allDownloads.length ||
          0,
        pendingCompletions: completions.data?.length || 0,
        recentActivity: recentDownloads.data || recentDownloads || [],
      });

      if (
        templatesResult.status === "rejected" &&
        recentDownloadsResult.status === "rejected" &&
        allDownloadsResult.status === "rejected"
      ) {
        throw new Error("Failed to load digital papers overview");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Alert variant="warning" className="mb-6">
          <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
          <p className="mb-4">
            You do not have permission to access digital papers management. This
            feature is restricted to healthcare administrators and staff only.
          </p>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>
              <strong>Your current role:</strong> {userRoleDisplay}
            </p>
            <p className="mt-2">
              <strong>Required roles:</strong>
            </p>
            <ul className="list-disc list-inside mt-1">
              <li>Administrator (Super Admin, Admin, Clinic Manager)</li>
              <li>
                Healthcare Worker (Doctor, Nurse, Physician, Midwife, Staff)
              </li>
            </ul>
          </div>
        </Alert>

        {/* Navigation back to dashboard */}
        <div className="mt-6">
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (loading && stats.totalTemplates === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading dashboard data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Alert variant="danger" className="mb-4">
          Error: {error}
        </Alert>
        <Button onClick={fetchStats}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Digital Papers Management"
          subtitle="Configure, monitor, and manage digitized paper forms and documents"
          icon={<FileText className="w-8 h-8 text-white" />}
          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-xl sm:rounded-2xl text-white shadow-lg w-full border-0"
          actions={
            <div className="flex space-x-2 overflow-x-auto bg-white/20 dark:bg-gray-800/50 p-1.5 rounded-xl backdrop-blur-sm border border-white/10 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("paper_configuration")}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "paper_configuration"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Paper Configuration
              </button>
              <button
                onClick={() => setActiveTab("download_center")}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "download_center"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Download Center
              </button>
              <button
                onClick={() => setActiveTab("monitoring_dashboard")}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "monitoring_dashboard"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Monitoring Dashboard
              </button>
              <button
                onClick={() => setActiveTab("document_templates")}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "document_templates"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Document Templates
              </button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:px-6 sm:pb-6 pt-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-4 flex-shrink-0">
        <Card className="p-6 text-center">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Templates
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {stats.totalTemplates}
          </p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Downloads
          </h3>
          <p className="text-2xl font-bold text-success-600 mt-2">
            {stats.totalDownloads}
          </p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Pending Completions
          </h3>
          <p className="text-2xl font-bold text-warning-600 mt-2">
            {stats.pendingCompletions}
          </p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Recent Activity
          </h3>
          <p className="text-2xl font-bold text-primary-600 mt-2">
            {stats.recentActivity.length}
          </p>
        </Card>
      </div>

        {/* Active Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-6 flex-shrink-0">
          {activeTab === "paper_configuration" && (
            <PaperConfiguration onRefresh={fetchStats} />
          )}
          {activeTab === "download_center" && (
            <DownloadCenter onRefresh={fetchStats} />
          )}
          {activeTab === "monitoring_dashboard" && (
            <MonitoringDashboard onRefresh={fetchStats} />
          )}
          {activeTab === "document_templates" && (
            <DocumentTemplates onRefresh={fetchStats} />
          )}
        </div>
      </div>
    </div>
  );
}
