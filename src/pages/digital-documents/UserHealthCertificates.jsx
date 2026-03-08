import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../../utils/api";
import { Button, Card, PageHeader } from "../../components/UI";

export default function UserHealthCertificates() {
  const { user, guardianId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // "all", "available", "requested"

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId]);

  useEffect(() => {
    if (selectedChild) {
      fetchHealthCertificates(selectedChild.id);
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

  const fetchHealthCertificates = async (childId) => {
    try {
      // This would fetch health certificates from the backend
      // For now, using mock data
      const mockCertificates = [
        {
          id: 1,
          type: "Birth Certificate",
          status: "available",
          issued_date: "2023-01-15",
          expiry_date: null,
          document_url: "/certificates/birth-certificate.pdf",
        },
        {
          id: 2,
          type: "Health Clearance",
          status: "available",
          issued_date: "2024-03-10",
          expiry_date: "2025-03-10",
          document_url: "/certificates/health-clearance.pdf",
        },
        {
          id: 3,
          type: "Vaccination Certificate",
          status: "requested",
          issued_date: null,
          expiry_date: null,
          document_url: null,
        },
      ];
      setCertificates(mockCertificates);
    } catch (err) {
      console.error("Error fetching health certificates:", err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "available":
        return { text: "Available", color: "green" };
      case "requested":
        return { text: "Requested", color: "yellow" };
      case "expired":
        return { text: "Expired", color: "red" };
      default:
        return { text: "Unknown", color: "gray" };
    }
  };

  const handleRequestCertificate = async (type) => {
    try {
      // This would send a request to the backend
      console.log("Requesting certificate:", type);
      // Update local state to reflect the request
      const newCertificate = {
        id: certificates.length + 1,
        type: type,
        status: "requested",
        issued_date: null,
        expiry_date: null,
        document_url: null,
      };
      setCertificates([...certificates, newCertificate]);
    } catch (err) {
      console.error("Error requesting certificate:", err);
    }
  };

  const handleDownload = (certificate) => {
    if (certificate.document_url) {
      // This would trigger the download
      console.log("Downloading certificate:", certificate.type);
    }
  };

  const filteredCertificates = certificates.filter((cert) => {
    if (filter === "all") return true;
    return cert.status === filter;
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
        title="Health Certificates"
        subtitle="View and download health certificates for your children"
        actions={<Button>📋 Request Certificate</Button>}
      />

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🏥</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Children Registered
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to register your children first to view their health
            certificates.
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

          {/* Filter Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { key: "all", label: "All Certificates" },
                { key: "available", label: "Available" },
                { key: "requested", label: "Requested" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === tab.key
                      ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Certificates List */}
          {selectedChild && (
            <div className="space-y-4">
              {filteredCertificates.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    No Certificates Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    No certificates match the current filter.
                  </p>
                </div>
              ) : (
                filteredCertificates.map((certificate) => {
                  const status = getStatusBadge(certificate.status);
                  return (
                    <Card key={certificate.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 text-xl">
                              🏥
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {certificate.type}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  status.color === "green"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : status.color === "yellow"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }`}
                              >
                                {status.text}
                              </span>
                              {certificate.issued_date && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  Issued: {formatDate(certificate.issued_date)}
                                </span>
                              )}
                              {certificate.expiry_date && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  Expires: {formatDate(certificate.expiry_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {certificate.status === "available" &&
                          certificate.document_url ? (
                            <Button onClick={() => handleDownload(certificate)}>
                              📄 Download
                            </Button>
                          ) : certificate.status === "requested" ? (
                            <Button variant="secondary" disabled>
                              ⏳ Processing
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() =>
                                handleRequestCertificate(certificate.type)
                              }
                            >
                              📋 Request
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Available Certificate Types */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Request New Certificate
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  type: "Birth Certificate",
                  icon: "👶",
                  description: "Official birth record",
                },
                {
                  type: "Health Clearance",
                  icon: "🏥",
                  description: "General health assessment",
                },
                {
                  type: "Vaccination Certificate",
                  icon: "💉",
                  description: "Complete vaccination record",
                },
                {
                  type: "Physical Examination",
                  icon: "🔍",
                  description: "Recent physical checkup",
                },
                {
                  type: "Growth Certificate",
                  icon: "📏",
                  description: "Growth and development record",
                },
                {
                  type: "School Medical",
                  icon: "🏫",
                  description: "School enrollment medical form",
                },
              ].map((cert) => (
                <div
                  key={cert.type}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{cert.icon}</span>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {cert.type}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {cert.description}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRequestCertificate(cert.type)}
                  >
                    📋 Request
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
