import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Modal,
  Card,
  EmptyState,
  SkeletonTable,
} from "./UI";
import { toArrayPayload } from "../utils/adminDataAdapters";
import apiClient from "../utils/api";

const DIGITAL_PAPER_SHORTCUTS = [
  {
    key: "chart",
    title: "Immunization Chart",
    description: "View the official chart with visit milestones and printable tracking details.",
    buildPath: (infantId) => `/digital-papers/immunization-chart/${infantId}`,
  },
  {
    key: "record",
    title: "Immunization Record",
    description: "Open the child immunization record booklet sourced from the live vaccination timeline.",
    buildPath: (infantId) => `/digital-papers/immunization-records/${infantId}`,
  },
  {
    key: "schedule",
    title: "Vaccine Schedule",
    description: "Review the dynamic schedule booklet with due, completed, and overdue doses.",
    buildPath: (infantId) => `/digital-papers/vaccine-schedule/${infantId}`,
  },
];

const normalizeDownloadRecord = (record = {}) => ({
  ...record,
  template_name: record.template_name || record.title || "Document",
  template_type: record.template_type || record.document_type || "DOCUMENT",
  infant_first_name: record.infant_first_name || record.first_name || "",
  infant_last_name: record.infant_last_name || record.last_name || "",
  user_first_name: record.user_first_name || record.generated_by_first || "",
  user_last_name: record.user_last_name || record.generated_by_last || "",
  download_type: record.download_type || record.document_type || record.template_type || "PDF",
  download_status:
    record.download_status ||
    (String(record.status || "").toUpperCase() || "COMPLETED"),
  download_date: record.download_date || record.last_downloaded || record.created_at || null,
});

const triggerDocumentDownload = (blob, downloadId) => {
  const normalizedBlob = blob instanceof Blob ? blob : new Blob([blob]);
  const url = window.URL.createObjectURL(normalizedBlob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `document-${downloadId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const formatDownloadDate = (value) => {
  if (!value) {
    return "Not available";
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? "Not available"
    : parsedDate.toLocaleString();
};

export default function DownloadCenter({ onRefresh }) {
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState([]);
  const [infants, setInfants] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedDownload, setSelectedDownload] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [generateForm, setGenerateForm] = useState({
    infant_id: "",
    template_id: "",
    download_type: "PDF",
    download_reason: "USER_REQUEST",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [downloadsData, infantsData, templatesData] = await Promise.all([
        apiClient.getDownloadHistory({ limit: 50 }),
        apiClient.getInfants(),
        apiClient.getPaperTemplates(),
      ]);

      setDownloads((toArrayPayload(downloadsData) || []).map(normalizeDownloadRecord));
      setInfants(Array.isArray(infantsData) ? infantsData : (infantsData?.data || []));
      setTemplates(templatesData?.data || templatesData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateDocument = async (e) => {
    e.preventDefault();
    try {
      await apiClient.generateDocument(generateForm.template_id, generateForm);
      setShowGenerateModal(false);
      setGenerateForm({
        infant_id: "",
        template_id: "",
        download_type: "PDF",
        download_reason: "USER_REQUEST",
      });
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownload = async (downloadId) => {
    try {
      const blob = await apiClient.downloadDocument(downloadId);
      triggerDocumentDownload(blob, downloadId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewDetails = (download) => {
    setSelectedDownload(download);
    setShowDownloadModal(true);
  };

  const filteredDownloads = downloads.filter(
    (download) =>
      download.template_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      download.infant_first_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      download.infant_last_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      download.user_first_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const filteredInfants = infants.filter((infant) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return [
      infant.first_name,
      infant.last_name,
      infant.middle_name,
      infant.control_number,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  const handleOpenOperationalDocument = (path) => {
    navigate(path);
  };

  if (loading && downloads.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <SkeletonTable rows={5} columns={7} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            Download Center
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Generate and manage document downloads for infants
          </p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          Generate New Document
        </Button>
      </div>

      {/* Search */}
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search downloads..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Downloads List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-6 space-y-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Operational document shortcuts
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Open the live digital papers that now read directly from the same vaccination source of truth used by the admin and guardian modules.
          </p>
        </div>

        {filteredInfants.length === 0 ? (
          <EmptyState
            title="No infants available for operational documents"
            description="Register a child first to open their immunization chart, record booklet, or vaccine schedule."
            icon="👶"
            className="border-none shadow-none"
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredInfants.slice(0, 8).map((infant) => (
              <Card key={`digital-paper-shortcuts-${infant.id}`} className="p-4 space-y-4 border border-gray-200 dark:border-gray-700">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {infant.first_name} {infant.last_name}
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {infant.control_number || "No control number yet"}
                  </p>
                </div>

                <div className="space-y-3">
                  {DIGITAL_PAPER_SHORTCUTS.map((shortcut) => (
                    <div
                      key={`${infant.id}-${shortcut.key}`}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {shortcut.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {shortcut.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleOpenOperationalDocument(shortcut.buildPath(infant.id))
                          }
                        >
                          Open document
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Infant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Generated By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDownloads.map((download) => (
                <tr
                  key={download.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {download.template_name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {download.template_type}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {download.infant_first_name} {download.infant_last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {download.user_first_name} {download.user_last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                      {download.download_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDownloadDate(download.download_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        download.download_status === "COMPLETED"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : download.download_status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {download.download_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(download)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      View
                    </button>
                    {download.download_status === "COMPLETED" && (
                      <button
                        onClick={() => handleDownload(download.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      >
                        Download
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDownloads.length === 0 && (
          <EmptyState
            title={
              searchQuery ? "No matching downloads" : "No download history"
            }
            description={
              searchQuery
                ? `We couldn't find any downloads matching "${searchQuery}".`
                : "You haven't generated any documents yet. Use the button above to generate your first document."
            }
            icon="📥"
            actionLabel={searchQuery ? "Clear Search" : "Generate New Document"}
            onAction={
              searchQuery
                ? () => setSearchQuery("")
                : () => setShowGenerateModal(true)
            }
            className="border-none shadow-none"
          />
        )}
      </div>

      {/* Generate Document Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Document"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="cancel"
              onClick={() => setShowGenerateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="generateForm">
              Generate Document
            </Button>
          </div>
        }
      >
        <form
          id="generateForm"
          onSubmit={handleGenerateDocument}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Infant
            </label>
            <select
              value={generateForm.infant_id}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, infant_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            >
              <option value="">Select Infant</option>
              {infants.map((infant) => (
                <option key={infant.id} value={infant.id}>
                  {infant.first_name} {infant.last_name} - {infant.dob}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Template
            </label>
            <select
              value={generateForm.template_id}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  template_id: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            >
              <option value="">Select Template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.template_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Download Type
            </label>
            <select
              value={generateForm.download_type}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  download_type: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="PDF">PDF</option>
              <option value="PRINT">Print</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Generation
            </label>
            <select
              value={generateForm.download_reason}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  download_reason: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="USER_REQUEST">User Request</option>
              <option value="ADMIN_GENERATION">Admin Generation</option>
              <option value="SCHEDULED">Scheduled</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Download Details Modal */}
      <Modal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title="Download Details"
        size="md"
      >
        {selectedDownload && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Document Name
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedDownload.template_name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedDownload.template_type}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Infant
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedDownload.infant_first_name}{" "}
                  {selectedDownload.infant_last_name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Generated By
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedDownload.user_first_name}{" "}
                  {selectedDownload.user_last_name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Download Type
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedDownload.download_type}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedDownload.download_status}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Generated Date
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {formatDownloadDate(selectedDownload.download_date)}
              </p>
            </div>

            {selectedDownload.file_path && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  File Path
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
                  {selectedDownload.file_path}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="cancel"
                onClick={() => setShowDownloadModal(false)}
              >
                Close
              </Button>
              {selectedDownload.download_status === "COMPLETED" && (
                <Button onClick={() => handleDownload(selectedDownload.id)}>
                  Download File
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
