import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../../utils/api";
import { Button, Card, PageHeader } from "../../components/UI";
import ImmunizationRecordBooklet from "../../components/ImmunizationRecordBooklet";

export default function UserImmunizationRecords() {
  const { user, guardianId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // "list" or "booklet"

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId]);

  useEffect(() => {
    if (selectedChild) {
      fetchVaccinationRecords(selectedChild.id);
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

  const fetchVaccinationRecords = async (childId) => {
    try {
      const response = await apiClient.getVaccinationsByInfant(childId);
      setVaccinationRecords(response.data || []);
    } catch (err) {
      console.error("Error fetching vaccination records:", err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getVaccineStatus = (vaccine) => {
    if (vaccine.admin_date) {
      return { status: "Completed", color: "green" };
    }
    return { status: "Pending", color: "yellow" };
  };

  const handleDownloadRecord = async (child) => {
    try {
      // This would typically generate and download a PDF
      console.log(
        "Downloading immunization record for:",
        child.first_name,
        child.last_name,
      );
      // You could integrate with the existing ImmunizationRecordBooklet component
      // to generate a downloadable PDF
    } catch (err) {
      console.error("Error downloading record:", err);
    }
  };

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
        title="Immunization Records"
        subtitle="View and download your children's immunization records and vaccination booklets"
        actions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              onClick={() => setViewMode("list")}
            >
              📋 List View
            </Button>
            <Button
              variant={viewMode === "booklet" ? "primary" : "secondary"}
              onClick={() => setViewMode("booklet")}
            >
              📄 Booklet View
            </Button>
          </div>
        }
      />

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">💉</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Children Registered
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to register your children first to view their immunization
            records.
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
                <div
                  key={child.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedChild?.id === child.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedChild(child);
                        handleDownloadRecord(child);
                      }}
                    >
                      📄 Download
                    </Button>
                  </div>
                  <button
                    onClick={() => setSelectedChild(child)}
                    className="w-full text-left"
                  >
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Click to view detailed records
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Records Content */}
          {selectedChild && (
            <>
              {viewMode === "list" ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {selectedChild.first_name}'s Immunization Records
                      </h3>
                      <Button
                        onClick={() => handleDownloadRecord(selectedChild)}
                      >
                        📄 Download Complete Record
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Vaccine
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Dose
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Date Given
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {vaccinationRecords.map((vaccine) => {
                          const status = getVaccineStatus(vaccine);
                          return (
                            <tr
                              key={vaccine.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {vaccine.vaccine_name}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  Dose {vaccine.dose_no || 1}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  {formatDate(vaccine.due_date)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    status.color === "green"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  }`}
                                >
                                  {status.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  {formatDate(vaccine.admin_date)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <Button variant="secondary" size="sm">
                                  📄 Certificate
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {vaccinationRecords.length === 0 && (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                      No immunization records found.
                    </div>
                  )}
                </div>
              ) : (
                <ImmunizationRecordBooklet infantId={selectedChild.id} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
