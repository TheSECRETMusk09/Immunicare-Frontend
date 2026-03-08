import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../../utils/api";
import { Button, Card, PageHeader } from "../../components/UI";

export default function UserDownloadCenter() {
  const { user, guardianId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // "all", "recent", "documents", "certificates", "schedules"
  const [sortBy, setSortBy] = useState("date"); // "date", "name", "type"

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId]);

  useEffect(() => {
    if (selectedChild) {
      fetchDownloadHistory(selectedChild.id);
    }
  }, [selectedChild]);

  const fetchChildren = async () => {
    if (!guardianId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.getInfantsByGuardian(guardianId);
      setChildren(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedChild(response.data[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDownloadHistory = async (childId) => {
    try {
      // Mock download history data
      const mockHistory = [
        {
          id: 1,
          filename: "immunization_record_john_doe.pdf",
          document_type: "Immunization Record",
          download_date: "2024-03-15T10:30:00Z",
          file_size: "2.4 MB",
          status: "completed",
        },
        {
          id: 2,
          filename: "health_certificate_john_doe.pdf",
          document_type: "Health Certificate",
          download_date: "2024-03-10T14:20:00Z",
          file_size: "1.8 MB",
          status: "completed",
        },
        {
          id: 3,
          filename: "vaccination_schedule_john_doe.pdf",
          document_type: "Vaccination Schedule",
          download_date: "2024-03-08T09:15:00Z",
          file_size: "956 KB",
          status: "completed",
        },
        {
          id: 4,
          filename: "birth_certificate_john_doe.pdf",
          document_type: "Birth Certificate",
          download_date: "2024-03-05T16:45:00Z",
          file_size: "1.2 MB",
          status: "completed",
        },
        {
          id: 5,
          filename: "growth_chart_john_doe.pdf",
          document_type: "Growth Chart",
          download_date: "2024-03-01T11:30:00Z",
          file_size: "3.1 MB",
          status: "completed",
        },
      ];
      setDownloadHistory(mockHistory);
    } catch (err) {
      console.error("Error fetching download history:", err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case "Immunization Record":
        return "💉";
      case "Health Certificate":
        return "🏥";
      case "Vaccination Schedule":
        return "📅";
      case "Birth Certificate":
        return "👶";
      case "Growth Chart":
        return "📊";
      default:
        return "📄";
    }
  };

  const handleDownload = async (item) => {
    try {
      console.log("Downloading:", item.filename);
      // This would typically trigger an actual download
      // For now, we'll just update the history
    } catch (err) {
      console.error("Error downloading file:", err);
    }
  };

  const handleDelete = async (itemId) => {
    try {
      setDownloadHistory(downloadHistory.filter((item) => item.id !== itemId));
      console.log("Deleted item:", itemId);
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const filteredAndSortedHistory = downloadHistory
    .filter((item) => {
      if (filter === "all") return true;
      if (filter === "recent") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(item.download_date) > weekAgo;
      }
      return item.document_type.toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.filename.localeCompare(b.filename);
        case "type":
          return a.document_type.localeCompare(b.document_type);
        case "date":
        default:
          return new Date(b.download_date) - new Date(a.download_date);
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">Error: {error}</div>
        <Button onClick={fetchChildren} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Download Center"
        subtitle="Access and manage your downloaded documents and certificates"
        actions={<Button>📄 Generate New Report</Button>}
      />

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Children Registered
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to register your children first to access their documents.
          </p>
          <Button onClick={() => navigate("/guardian/children")}>
            Register Child
          </Button>
        </div>
      ) : (
        <>
          {/* Child Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Select Child
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedChild?.id === child.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {child.sex === "M" ? "👦" : "👧"}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {child.first_name} {child.last_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(child.dob).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters and Sorting */}
          {selectedChild && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter by Type
                  </label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Documents</option>
                    <option value="recent">Recent (Last 7 days)</option>
                    <option value="immunization">Immunization Records</option>
                    <option value="certificate">Certificates</option>
                    <option value="schedule">Schedules</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sort by
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="date">Download Date</option>
                    <option value="name">File Name</option>
                    <option value="type">Document Type</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Download History */}
          {selectedChild && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Download History - {selectedChild.first_name}{" "}
                  {selectedChild.last_name}
                </h3>
              </div>

              {filteredAndSortedHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    No Downloads Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {filter === "all"
                      ? "You haven't downloaded any documents yet."
                      : "No documents match the current filter."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Document
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Downloaded
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAndSortedHistory.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">
                                {getDocumentIcon(item.document_type)}
                              </span>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {item.filename}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                              {item.document_type}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {formatDate(item.download_date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                              {item.file_size}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDownload(item)}
                              >
                                📄 Download
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                🗑️ Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Quick Download Options */}
          {selectedChild && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Quick Downloads
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    type: "Complete Immunization Record",
                    icon: "💉",
                    description: "All vaccination history",
                  },
                  {
                    type: "Health Summary",
                    icon: "🏥",
                    description: "General health overview",
                  },
                  {
                    type: "Growth Chart",
                    icon: "📊",
                    description: "Height and weight tracking",
                  },
                  {
                    type: "School Medical Form",
                    icon: "🏫",
                    description: "For school enrollment",
                  },
                ].map((option) => (
                  <div
                    key={option.type}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{option.icon}</span>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {option.type}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {option.description}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => console.log("Generating:", option.type)}
                    >
                      📄 Generate
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
