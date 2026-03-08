import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";
import {
  Button,
  Card,
  PageHeader,
  PageContainer,
  Alert,
} from "../components/UI";
import { BarChart2, Calendar, Download, Bell, Loader2 } from "lucide-react";

export default function HealthInformation() {
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [healthRecords, setHealthRecords] = useState([]);
  const [growthData, setGrowthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define all useCallback hooks BEFORE useEffect hooks that reference them
  const fetchChildren = useCallback(async () => {
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
  }, [guardianId]);

  const fetchHealthRecords = useCallback(async (childId) => {
    try {
      const response = await apiClient.getHealthRecordsByInfant(childId);
      setHealthRecords(response.data || []);
    } catch (err) {
      console.error("Error fetching health records:", err);
    }
  }, []);

  const fetchGrowthData = useCallback(async (childId) => {
    try {
      const response = await apiClient.getGrowthRecordsByInfant(childId);
      setGrowthData(response.data || []);
    } catch (err) {
      console.error("Error fetching growth data:", err);
    }
  }, []);

  // Add useEffect hooks AFTER useCallback definitions
  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  useEffect(() => {
    if (selectedChild) {
      fetchHealthRecords(selectedChild.id);
      fetchGrowthData(selectedChild.id);
    }
  }, [selectedChild, fetchHealthRecords, fetchGrowthData]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateAge = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
            Loading health information...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
        <Button onClick={fetchChildren} className="w-full">
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* PageHeader - Standardized violet gradient design matching My Children module */}
      <PageHeader
        title="Health Information"
        subtitle="Track your children's health metrics and growth records"
        icon={<BarChart2 className="w-8 h-8 text-white" />}
        actions={
          <Button onClick={() => {}}>
            <BarChart2 className="w-4 h-4 mr-2" />
            View Growth Charts
          </Button>
        }
      />

      {children.length === 0 ? (
        <PageContainer>
          <div className="py-12 text-center">
            <div className="w-24 h-24 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-6">
              <BarChart2 className="w-12 h-12 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No Children Registered
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
              You need to register your children first to view their health
              information.
            </p>
            <Button size="lg" onClick={() => navigate("/guardian/children")}>
              Register Child
            </Button>
          </div>
        </PageContainer>
      ) : (
        <>
          {/* Child Selector */}
          <Card title="Select Child">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`p-4 rounded-xl border-2 transition-all text-left group ${
                    selectedChild?.id === child.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        selectedChild?.id === child.id
                          ? "bg-primary-100 dark:bg-primary-800"
                          : "bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30"
                      }`}
                    >
                      <span className="text-2xl">
                        {child.sex === "M" ? "👦" : "👧"}
                      </span>
                    </div>
                    <div>
                      <p
                        className={`font-bold ${
                          selectedChild?.id === child.id
                            ? "text-primary-900 dark:text-primary-100"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {child.first_name} {child.last_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Age: {calculateAge(child.dob)} years
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Health Information Content */}
          {selectedChild && (
            <div className="space-y-6">
              {/* Health Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-5 text-center" noPadding>
                  <div className="p-5">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Current Weight
                    </h3>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                      {growthData.length > 0
                        ? `${growthData[growthData.length - 1].weight} kg`
                        : "N/A"}
                    </p>
                  </div>
                </Card>
                <Card className="p-5 text-center" noPadding>
                  <div className="p-5">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Current Height
                    </h3>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                      {growthData.length > 0
                        ? `${growthData[growthData.length - 1].height} cm`
                        : "N/A"}
                    </p>
                  </div>
                </Card>
                <Card className="p-5 text-center" noPadding>
                  <div className="p-5">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      BMI
                    </h3>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                      {growthData.length > 0
                        ? (
                            growthData[growthData.length - 1].weight /
                            Math.pow(
                              growthData[growthData.length - 1].height / 100,
                              2,
                            )
                          ).toFixed(1)
                        : "N/A"}
                    </p>
                  </div>
                </Card>
                <Card className="p-5 text-center" noPadding>
                  <div className="p-5">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Checkup
                    </h3>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-2">
                      {healthRecords.length > 0
                        ? formatDate(
                            healthRecords[healthRecords.length - 1]
                              .checkup_date,
                          )
                        : "N/A"}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Growth Chart Placeholder */}
              <Card title="Growth Chart">
                <div className="h-80 bg-gray-50 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                      <BarChart2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Growth Visualization
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                      Height and weight tracking over time will be visualized
                      here in the next update.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Health Records Table */}
              <PageContainer title="Health Checkup Records">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Weight
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Height
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          BMI
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Doctor Notes
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                      {healthRecords.map((record) => {
                        const bmi =
                          record.weight && record.height
                            ? (
                                record.weight / Math.pow(record.height / 100, 2)
                              ).toFixed(1)
                            : "N/A";
                        return (
                          <tr
                            key={record.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatDate(record.checkup_date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-300">
                                {record.weight ? `${record.weight} kg` : "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-300">
                                {record.height ? `${record.height} cm` : "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                {bmi}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                {record.notes || "No notes"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <Button variant="ghost" size="sm">
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {healthRecords.length === 0 && (
                  <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-lg font-medium">
                      No health checkup records found.
                    </p>
                  </div>
                )}
              </PageContainer>

              {/* Quick Actions */}
              <PageContainer title="Quick Actions">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="secondary"
                    className="p-6 h-auto flex-col items-center text-center hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors border-dashed border-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-3">
                      <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      Schedule Checkup
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Book a visit with a pediatrician
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    className="p-6 h-auto flex-col items-center text-center hover:bg-success-50 dark:hover:bg-success-900/10 transition-colors border-dashed border-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mb-3">
                      <Download className="w-6 h-6 text-success-600 dark:text-success-400" />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      Download Report
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Get a PDF of all health records
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    className="p-6 h-auto flex-col items-center text-center hover:bg-info-50 dark:hover:bg-info-900/10 transition-colors border-dashed border-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-info-100 dark:bg-info-900/30 flex items-center justify-center mb-3">
                      <Bell className="w-6 h-6 text-info-600 dark:text-info-400" />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      Set Reminders
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Get notified for next checkups
                    </span>
                  </Button>
                </div>
              </PageContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
