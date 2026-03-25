import React, { useState, useEffect, useCallback } from "react";
import { Button, Input, Modal, Card, Alert } from "./UI";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";

const normalizeDownloadRecord = (record = {}) => ({
  ...record,
  template_name: record.template_name || record.title || "Document",
  template_type: record.template_type || record.document_type || "DOCUMENT",
  infant_first_name: record.infant_first_name || record.first_name || "",
  infant_last_name: record.infant_last_name || record.last_name || "",
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

export default function UserDownloadCenter() {
  const { guardianId } = useAuth();
  const [downloads, setDownloads] = useState([]);
  const [infants, setInfants] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [generateForm, setGenerateForm] = useState({
    infant_id: "",
    template_id: "",
    download_type: "PDF",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [downloadsData, infantsData, templatesData] = await Promise.all([
        apiClient.getDownloadHistory({ limit: 50 }),
        guardianId ? apiClient.getInfantsByGuardian(guardianId) : Promise.resolve({ data: [] }),
        apiClient.getPaperTemplates(),
      ]);

      setDownloads((downloadsData?.data || downloadsData || []).map(normalizeDownloadRecord));
      setInfants(Array.isArray(infantsData) ? infantsData : (infantsData?.data || []));
      setTemplates(templatesData?.data || templatesData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateDocument = async (e) => {
    e.preventDefault();
    try {
      await apiClient.generateDocument(generateForm.template_id, {
        ...generateForm,
        download_reason: "USER_REQUEST",
      });
      setShowGenerateModal(false);
      setGenerateForm({
        infant_id: "",
        template_id: "",
        download_type: "PDF",
      });
      fetchData();
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
        .includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            My Documents
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Download and manage your child's health documents
          </p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          Generate New Document
        </Button>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Search */}
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Available Templates for User */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-100">
          Available Documents
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-gray-100">
                    {template.name}
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {template.template_type}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    template.is_active
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  {template.is_active ? "Available" : "Not Available"}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {template.description}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setGenerateForm((prev) => ({
                      ...prev,
                      template_id: template.id,
                    }));
                    setShowGenerateModal(true);
                  }}
                  disabled={!template.is_active}
                >
                  Generate
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* My Downloads */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-100">
          My Downloads
        </h4>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Child
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date Generated
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
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No documents found. Generate your first document to get started.
            </div>
          )}
        </div>
      </div>

      {/* Generate Document Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Document"
        size="md"
        footer={
          <div className="flex justify-center gap-3">
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
              Select Child
            </label>
            <select
              value={generateForm.infant_id}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, infant_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            >
              <option value="">Select Child</option>
              {infants.map((infant) => (
                <option key={infant.id} value={infant.id}>
                  {infant.first_name} {infant.last_name} - {infant.dob}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type
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
              <option value="">Select Document Type</option>
              {templates
                .filter((t) => t.is_active)
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.template_type})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Format
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
        </form>
      </Modal>
    </div>
  );
}
