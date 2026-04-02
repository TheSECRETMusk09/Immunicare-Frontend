import React, { useState, useEffect, useCallback } from "react";
import {
  AdminModalActions,
  Card,
  Button,
  DataTable,
  Modal,
  Select,
  Input,
  Badge,
  Alert,
  PageHeader,
} from "../components/UI";
import apiClient from "../utils/api";
import { BarChart3 } from "lucide-react";
import {
  hasFieldErrors,
  mergeFieldErrors,
  sanitizeText,
  validateDateRange,
  validateRequired,
} from "../utils/adminFormValidation";
import { useSocket } from "../contexts/SocketContext";

const REPORT_TYPES = Object.freeze([
  "vaccination",
  "inventory",
  "appointment",
  "guardian",
  "infant",
  "system",
  "barangay",
  "compliance",
  "healthcenter",
  "consolidated",
]);

const REPORT_FORMATS = Object.freeze(["pdf"]);

const EMPTY_ADMIN_SUMMARY = Object.freeze({
  vaccination: { total: 0, completed: 0 },
  inventory: { total_items: 0, low_stock_items: 0, expired_items: 0 },
  appointments: { total: 0, completed: 0, no_show: 0 },
  guardians: { total: 0, active: 0 },
  infants: { total: 0, up_to_date: 0 },
  reports: { total_reports: 0, total_downloads: 0 },
  transfers: { avg_turnaround_days: 0, open_cases: 0 },
});

const normalizeReportFormatInput = (value) => {
  const normalized = sanitizeText(value).toLowerCase();
  return normalized;
};

const parseDispositionFilename = (contentDisposition) => {
  if (!contentDisposition || typeof contentDisposition !== "string") {
    return "";
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (_error) {
      return utf8Match[1];
    }
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] ? asciiMatch[1] : "";
};

const formatBackendErrorMessage = (error, fallback = "Request failed") => {
  const backendMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.details ||
    error?.message;

  return sanitizeText(backendMessage) || fallback;
};

const Reports = () => {
  const { on, off } = useSocket();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [reportTemplates, setReportTemplates] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    type: "vaccination",
    format: "pdf",
    startDate: "",
    endDate: "",
    filters: {},
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Default templates fallback
  const getDefaultTemplates = () => [
    {
      type: "vaccination",
      name: "Vaccination Report",
      description:
        "Comprehensive vaccination administration and compliance report",
    },
    {
      type: "inventory",
      name: "Inventory Report",
      description: "Vaccine and medical supply inventory tracking report",
    },
    {
      type: "appointment",
      name: "Appointment Report",
      description: "Appointment scheduling and attendance analysis",
    },
    {
      type: "guardian",
      name: "Guardian Report",
      description: "Guardian registration and engagement statistics",
    },
    {
      type: "infant",
      name: "Infant Health Report",
      description: "Infant health monitoring and vaccination status",
    },
    {
      type: "system",
      name: "System Report",
      description: "System user and access activity report",
    },
    {
      type: "barangay",
      name: "Barangay Health Report",
      description: "Barangay-specific health statistics",
    },
    {
      type: "compliance",
      name: "Compliance Report",
      description: "Vaccination compliance and coverage analysis",
    },
    {
      type: "healthcenter",
      name: "Health Center Report",
      description: "Health center performance and statistics",
    },
    {
      type: "consolidated",
      name: "Consolidated Report",
      description: "All-in-one comprehensive report",
    },
  ];

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.request("/reports");
      setReports(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(formatBackendErrorMessage(err, "Failed to fetch reports."));
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminSummary = useCallback(async () => {
    try {
      const summaryResponse = await apiClient.request("/reports/admin/summary");
      
      // Backend returns { success: true, data: summary }
      // So we need to access summaryResponse.data.data
      const summaryData = summaryResponse?.data?.data || summaryResponse?.data || summaryResponse || {};
      
      setAdminSummary(summaryData);
    } catch (err) {
      console.error("Error fetching admin summary:", err);
      setAdminSummary((current) => current || EMPTY_ADMIN_SUMMARY);
    }
  }, []);

  const fetchReportTemplates = useCallback(async () => {
    try {
      const response = await apiClient.request("/reports/templates");
      const responseTemplates = Array.isArray(response.data) ? response.data : [];
      const normalizedTemplates = responseTemplates
        .map((template) => {
          const normalizedType = sanitizeText(template?.type).toLowerCase();
          if (!REPORT_TYPES.includes(normalizedType)) {
            return null;
          }

          const normalizedFormats = Array.isArray(template?.availableFormats)
            ? template.availableFormats
                .map((value) => normalizeReportFormatInput(value))
                .filter((value, index, arr) =>
                  REPORT_FORMATS.includes(value) && arr.indexOf(value) === index,
                )
            : [...REPORT_FORMATS];

          return {
            ...template,
            type: normalizedType,
            name: sanitizeText(template?.name) || `${normalizedType} report`,
            description: sanitizeText(template?.description),
            availableFormats:
              normalizedFormats.length > 0 ? normalizedFormats : [...REPORT_FORMATS],
          };
        })
        .filter(Boolean);

      setReportTemplates(
        normalizedTemplates.length > 0 ? normalizedTemplates : getDefaultTemplates(),
      );
    } catch (err) {
      console.error("Error fetching report templates:", err);
      // Use fallback templates
      setReportTemplates(getDefaultTemplates());
    }
  }, []);

  // Fetch reports, templates, and admin summary on mount
  useEffect(() => {
    fetchReports();
    fetchReportTemplates();
    fetchAdminSummary();
  }, [fetchReports, fetchReportTemplates, fetchAdminSummary]);

  useEffect(() => {
    const refreshSummary = () => {
      void fetchAdminSummary();
    };

    const socketEvents = [
      "appointment_created",
      "appointment_updated",
      "appointment_deleted",
      "vaccination_created",
      "vaccination_updated",
      "vaccination_deleted",
      "inventory_item_created",
      "inventory_item_updated",
      "inventory_item_deleted",
      "vaccine_inventory_created",
      "vaccine_inventory_updated",
      "vaccine_inventory_transaction_created",
      "infant_created",
      "infant_updated",
      "infant_deleted",
      "guardian_created",
      "guardian_updated",
      "guardian_deleted",
    ];

    socketEvents.forEach((eventName) => on(eventName, refreshSummary));

    const windowEvents = [
      "appointment-update",
      "vaccination-update",
      "guardian-data-update",
      "child-data-update",
    ];

    windowEvents.forEach((eventName) => {
      window.addEventListener(eventName, refreshSummary);
    });

    return () => {
      socketEvents.forEach((eventName) => off(eventName, refreshSummary));
      windowEvents.forEach((eventName) => {
        window.removeEventListener(eventName, refreshSummary);
      });
    };
  }, [fetchAdminSummary, on, off]);

  const handleGenerateReport = useCallback(async (event) => {
    event.preventDefault();
    const trimmedType = sanitizeText(formData.type).toLowerCase();
    const trimmedFormat = normalizeReportFormatInput(formData.format);
    const startDate = formData.startDate || "";
    const endDate = formData.endDate || "";

    const nextErrors = mergeFieldErrors(
      {
        type: validateRequired(trimmedType, "Please select a report type."),
        format: validateRequired(trimmedFormat, "Please select a report format."),
        ...(trimmedType && !REPORT_TYPES.includes(trimmedType)
          ? {
              type: `Report type must be one of: ${REPORT_TYPES.join(", ")}`,
            }
          : {}),
        ...(trimmedFormat && !REPORT_FORMATS.includes(trimmedFormat)
          ? {
              format: `Report format must be one of: ${REPORT_FORMATS.join(", ")}`,
            }
          : {}),
      },
      validateDateRange({
        startDate,
        endDate,
        startKey: "startDate",
        endKey: "endDate",
        startLabel: "Start date",
        endLabel: "End date",
      }),
    );

    if (hasFieldErrors(nextErrors)) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setFormErrors({});

      const safeFilters =
        formData.filters &&
        typeof formData.filters === "object" &&
        !Array.isArray(formData.filters)
          ? formData.filters
          : {};

      const reportData = {
        type: trimmedType,
        format: trimmedFormat,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        filters: safeFilters,
      };

      const response = await apiClient.request("/reports/generate", {
        method: "POST",
        data: reportData,
      });

      if (response?.success && response?.data) {
        setReports((prevReports) => [
          response.data,
          ...prevReports.filter((row) => row.id !== response.data.id),
        ]);
        void fetchAdminSummary();
        setShowGenerateModal(false);
        setFormData({
          type: "vaccination",
          format: "pdf",
          startDate: "",
          endDate: "",
          filters: {},
        });
        setFormErrors({});
        setError(null);
      }
    } catch (err) {
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setFormErrors((prev) => ({
          ...prev,
          ...backendFields,
        }));
      }
      setError(formatBackendErrorMessage(err, "Failed to generate report."));
      console.error("Error generating report:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [fetchAdminSummary, formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "format" ? normalizeReportFormatInput(value) : value;
    const nextFormData = { ...formData, [name]: nextValue };
    setFormData(nextFormData);

    if (name === "type") {
      const template = reportTemplates.find((t) => t.type === nextValue) || null;
      setSelectedTemplate(template);
    }

    const rangeErrors =
      name === "startDate" || name === "endDate"
        ? validateDateRange({
            startDate: nextFormData.startDate,
            endDate: nextFormData.endDate,
            startKey: "startDate",
            endKey: "endDate",
            startLabel: "Start date",
            endLabel: "End date",
          })
        : {};

    setFormErrors((prev) => ({
      ...prev,
      [name]: undefined,
      ...(name === "type" && nextValue && !REPORT_TYPES.includes(nextValue)
        ? {
            type: `Report type must be one of: ${REPORT_TYPES.join(", ")}`,
          }
        : {}),
      ...(name === "format" && nextValue && !REPORT_FORMATS.includes(nextValue)
        ? {
            format: `Report format must be one of: ${REPORT_FORMATS.join(", ")}`,
          }
        : {}),
      ...rangeErrors,
    }));
  };

  const handleDownloadReport = useCallback(
    async (reportId, reportFormat = "pdf") => {
      try {
        const normalizedReportId = Number(reportId);
        if (!Number.isFinite(normalizedReportId) || normalizedReportId <= 0) {
          setError("Invalid report ID.");
          return;
        }

        setDownloadingReportId(normalizedReportId);
        setError(null);

        const response = await apiClient.customRequest(
          `/reports/${normalizedReportId}/download`,
          {
            method: "GET",
            responseType: "blob",
            timeout: 60000, // 60 seconds timeout for downloads
          },
        );

        const contentDisposition = response?.headers?.["content-disposition"];
        const parsedFilename = parseDispositionFilename(contentDisposition);
        const normalizedFormat = normalizeReportFormatInput(reportFormat);
        const safeFormat = REPORT_FORMATS.includes(normalizedFormat)
          ? normalizedFormat
          : "pdf";
        const extension = safeFormat;
        const filename =
          parsedFilename || `report-${normalizedReportId}-${Date.now()}.${extension}`;

        // Create download link
        const responseBlob =
          response?.data instanceof Blob
            ? response.data
            : new Blob([response?.data]);
        const url = window.URL.createObjectURL(responseBlob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setReports((prevReports) =>
          prevReports.map((report) => {
            if (Number(report.id) !== normalizedReportId) {
              return report;
            }

            return {
              ...report,
              download_count: (Number(report.download_count) || 0) + 1,
            };
          }),
        );
        void fetchAdminSummary();
      } catch (err) {
        setError(formatBackendErrorMessage(err, "Failed to download report."));
        console.error("Error downloading report:", err);
      } finally {
        setDownloadingReportId(null);
      }
    },
    [fetchAdminSummary],
  );

  const handleDeleteReport = useCallback((reportId) => {
    // Show confirmation modal instead of window.confirm
    setDeletingReportId(reportId);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteReport = useCallback(async () => {
    if (!deletingReportId) return;

    setIsDeleting(true);
    try {
      await apiClient.request(`/reports/${deletingReportId}`, {
        method: "DELETE",
      });
      setReports((prevReports) => prevReports.filter((r) => r.id !== deletingReportId));
      void fetchAdminSummary();
      setShowDeleteModal(false);
      setDeletingReportId(null);
    } catch (err) {
      setError(err.message || "Failed to delete report");
      console.error("Error deleting report:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [deletingReportId, fetchAdminSummary]);

  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setDeletingReportId(null);
  }, []);

  const handleTemplateSelect = (templateType) => {
    const template = reportTemplates.find((t) => t.type === templateType);
    setSelectedTemplate(template);
    setFormData((prev) => ({ ...prev, type: templateType }));
  };

  const getStatusVariant = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "success";
      case "generating":
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getReportTypeLabel = (type) => {
    const labels = {
      vaccination: "Vaccination",
      inventory: "Inventory",
      appointment: "Appointment",
      guardian: "Guardian",
      infant: "Infant Health",
      system: "System",
      barangay: "Barangay",
      compliance: "Compliance",
      healthcenter: "Health Center",
      consolidated: "Consolidated",
    };
    return labels[type] || type;
  };

  const reportColumns = [
    {
      key: "title",
      label: "Report Name",
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {row.title || `${getReportTypeLabel(row.type)} Report`}
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (val) => (
        <Badge variant="info" className="capitalize">
          {getReportTypeLabel(val)}
        </Badge>
      ),
    },
    {
      key: "file_format",
      label: "Format",
      render: (val) => (
        <span className="uppercase text-xs font-medium">{val || "PDF"}</span>
      ),
    },
    {
      key: "date_generated",
      label: "Date Generated",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "N/A"),
    },
    {
      key: "file_size",
      label: "Size",
      render: (val) => (val ? `${(val / 1024).toFixed(1)} KB` : "N/A"),
    },
    {
      key: "download_count",
      label: "Downloads",
      render: (val) => val || 0,
    },
    {
      key: "status",
      label: "Status",
      render: (val) => (
        <Badge variant={getStatusVariant(val)} className="capitalize">
          {val || "Unknown"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownloadReport(row.id, row.file_format)}
            title="Download Report"
            disabled={downloadingReportId === row.id || isGenerating}
          >
            {downloadingReportId === row.id ? "⏳" : "⬇️"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteReport(row.id)}
            title="Delete Report"
            disabled={downloadingReportId === row.id || isGenerating}
          >
            🗑️
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 ml-auto"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      {/* Page Header - Fixed/Sticky at top */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Reports Management"
          subtitle="Generate and manage comprehensive reports for your facility"
          icon={<BarChart3 className="w-8 h-8 text-white" />}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-4 pt-3 sm:px-6 sm:pb-6">
        <div
          data-testid="reports-scroll-region"
          className="admin-module-scroll-region modern-scrollbar flex h-full min-h-0 flex-col gap-4 scroll-smooth pr-1 sm:pr-2"
        >
          {error && (
            <Alert variant="error" className="flex-shrink-0" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

      {/* Admin Dashboard Summary */}
      {adminSummary && (
        <Card title="📈 Dashboard Overview" className="flex-shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
            {/* Vaccination Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Vaccinations
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {adminSummary.vaccination?.total || 0}
              </div>
              <div className="text-xs text-gray-500">
                Completed: {adminSummary.vaccination?.completed || 0}
              </div>
            </div>

            {/* Inventory Summary */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Inventory Items
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {adminSummary.inventory?.total_items || 0}
              </div>
              <div className="text-xs text-gray-500">
                Low Stock: {adminSummary.inventory?.low_stock_items || 0}
              </div>
            </div>

            {/* Appointments Summary */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Appointments
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {adminSummary.appointments?.total || 0}
              </div>
              <div className="text-xs text-gray-500">
                Completed: {adminSummary.appointments?.completed || 0}
              </div>
            </div>

            <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                No Shows
              </div>
              <div className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-400">
                {adminSummary.appointments?.no_show || 0}
              </div>
              <div className="text-xs text-gray-500">
                Missed appointment load
              </div>
            </div>

            {/* Guardians Summary */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Guardians
              </div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {adminSummary.guardians?.total || 0}
              </div>
              <div className="text-xs text-gray-500">
                Active: {adminSummary.guardians?.active || 0}
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Expired Lots
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {adminSummary.inventory?.expired_items || 0}
              </div>
              <div className="text-xs text-gray-500">
                Inventory expiry risk
              </div>
            </div>

            {/* Infants Summary */}
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Infants
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {adminSummary.infants?.total || 0}
              </div>
              <div className="text-xs text-gray-500">
                Up to Date: {adminSummary.infants?.up_to_date || 0}
              </div>
            </div>

            {/* Reports Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Reports
              </div>
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {adminSummary.reports?.total_reports || 0}
              </div>
              <div className="text-xs text-gray-500">
                Downloads: {adminSummary.reports?.total_downloads || 0}
              </div>
            </div>

            <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Transfer Turnaround
              </div>
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {adminSummary.transfers?.avg_turnaround_days || 0}
              </div>
              <div className="text-xs text-gray-500">
                Days • Open: {adminSummary.transfers?.open_cases || 0}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Report Generation Cards */}
      <Card title="🚀 Quick Report Generation" className="flex-shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {reportTemplates.slice(0, 5).map((template) => (
            <Button
              key={template.type}
              variant="secondary"
              onClick={() => {
                handleTemplateSelect(template.type);
                setShowGenerateModal(true);
              }}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <span className="text-2xl">
                {template.type === "vaccination" && "💉"}
                {template.type === "inventory" && "📦"}
                {template.type === "appointment" && "📅"}
                {template.type === "guardian" && "👨‍👩‍👧"}
                {template.type === "infant" && "👶"}
                {template.type === "barangay" && "🏘️"}
                {template.type === "compliance" && "✅"}
                {template.type === "healthcenter" && "🏥"}
                {template.type === "consolidated" && "📋"}
              </span>
              <span className="text-sm font-medium">{template.name}</span>
            </Button>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Button variant="primary" onClick={() => setShowGenerateModal(true)}>
            View All Report Types →
          </Button>
        </div>
      </Card>

      {/* Generated Reports */}
      <Card title="📁 Generated Reports" className="flex-shrink-0">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total Reports: <strong>{reports.length}</strong>
          </div>
          <Button variant="primary" onClick={() => setShowGenerateModal(true)}>
            + Generate New Report
          </Button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Reports Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Generate your first report to get started.
            </p>
            <Button
              variant="primary"
              onClick={() => setShowGenerateModal(true)}
            >
              Generate Report
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <DataTable columns={reportColumns} data={reports} pagination />
          </div>
        )}
      </Card>

        </div>
      </div>
      {/* Generate Report Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          setSelectedTemplate(null);
          setFormErrors({});
        }}
        title="Generate New Report"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowGenerateModal(false);
                setSelectedTemplate(null);
                setFormErrors({});
              }}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="generateReportForm"
              loading={isGenerating}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Report"}
            </Button>
          </AdminModalActions>
        }
      >
        <form id="generateReportForm" className="admin-form" onSubmit={handleGenerateReport}>
          <div className="admin-form-row-2">
            {/* Report Type Selection */}
            <div className="admin-field-group">
              <label className="admin-field-label required">Report Type</label>
              <Select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                disabled={isGenerating}
                error={formErrors.type}
              >
                {reportTemplates.map((template) => (
                  <option key={template.type} value={template.type}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Format Selection */}
            <div className="admin-field-group">
              <label className="admin-field-label required">Format</label>
              <Select
                name="format"
                value={formData.format}
                onChange={handleInputChange}
                disabled={isGenerating}
                error={formErrors.format}
              >
                <option value="pdf">PDF Document</option>
              </Select>
            </div>
          </div>

          {/* Date Range */}
          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <label className="admin-field-label">Start Date</label>
              <Input
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleInputChange}
                max={formData.endDate || undefined}
                disabled={isGenerating}
                error={formErrors.startDate}
              />
            </div>

            <div className="admin-field-group">
              <label className="admin-field-label">End Date</label>
              <Input
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleInputChange}
                min={formData.startDate || undefined}
                disabled={isGenerating}
                error={formErrors.endDate}
              />
            </div>
          </div>

          {/* Template Description */}
          {selectedTemplate && (
            <div className="admin-form-card admin-form-card-info">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {selectedTemplate.description}
              </p>
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Report"
        size="sm"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={confirmDeleteReport}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "OK"}
            </Button>
          </AdminModalActions>
        }
      >
        <div className="text-center py-4">
          <div className="mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-lg">
            Are you sure you want to delete this report?
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Reports;
