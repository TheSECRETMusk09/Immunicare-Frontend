import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../../utils/api";
import { Button, Card, PageHeader } from "../../components/UI";
import { normalizeArrayPayload } from "../../utils/apiUtils";

export default function UserVaccinationSchedules() {
  const { user, guardianId } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" or "list"

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId]);

  useEffect(() => {
    if (selectedChild) {
      fetchVaccinationSchedules(selectedChild.id);
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
      const childrenData = normalizeArrayPayload(response, ["infants", "children", "patients"]);
      setChildren(childrenData);
      if (childrenData.length > 0) {
        setSelectedChild(childrenData[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVaccinationSchedules = async (childId) => {
    try {
      // Mock vaccination schedule data
      const mockSchedules = [
        {
          id: 1,
          vaccine_name: "BCG Vaccine",
          dose_no: 1,
          scheduled_date: "2023-01-15",
          status: "completed",
          age_months: 0,
          description: "Birth dose - protects against tuberculosis",
        },
        {
          id: 2,
          vaccine_name: "Hepatitis B",
          dose_no: 1,
          scheduled_date: "2023-01-15",
          status: "completed",
          age_months: 0,
          description: "Birth dose - protects against hepatitis B",
        },
        {
          id: 3,
          vaccine_name: "Pentavalent Vaccine (DPT-Hep B-HIB)",
          dose_no: 1,
          scheduled_date: "2023-02-15",
          status: "completed",
          age_months: 6,
          description:
            "First dose - protects against diphtheria, tetanus, pertussis, hepatitis B, and H. influenzae type B",
        },
        {
          id: 4,
          vaccine_name: "Pentavalent Vaccine (DPT-Hep B-HIB)",
          dose_no: 2,
          scheduled_date: "2023-03-15",
          status: "completed",
          age_months: 10,
          description: "Second dose",
        },
        {
          id: 5,
          vaccine_name: "Pentavalent Vaccine (DPT-Hep B-HIB)",
          dose_no: 3,
          scheduled_date: "2023-04-15",
          status: "pending",
          age_months: 14,
          description: "Third dose",
        },
        {
          id: 6,
          vaccine_name: "Measles, Mumps, Rubella Vaccine (MMR)",
          dose_no: 1,
          scheduled_date: "2023-09-15",
          status: "upcoming",
          age_months: 9,
          description:
            "First dose - protects against measles, mumps, and rubella",
        },
        {
          id: 7,
          vaccine_name: "Measles, Mumps, Rubella Vaccine (MMR)",
          dose_no: 2,
          scheduled_date: "2024-01-15",
          status: "upcoming",
          age_months: 12,
          description: "Second dose - booster",
        },
      ];
      setSchedules(mockSchedules);
    } catch (err) {
      console.error("Error fetching vaccination schedules:", err);
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
      case "completed":
        return { text: "Completed", color: "green", icon: "✅" };
      case "pending":
        return { text: "Pending", color: "yellow", icon: "⏳" };
      case "upcoming":
        return { text: "Upcoming", color: "blue", icon: "📅" };
      case "overdue":
        return { text: "Overdue", color: "red", icon: "⚠️" };
      default:
        return { text: "Unknown", color: "gray", icon: "❓" };
    }
  };

  const getAgeInMonths = (dob, scheduledDate) => {
    const birthDate = new Date(dob);
    const scheduleDate = new Date(scheduledDate);
    const diffTime = Math.abs(scheduleDate - birthDate);
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return diffMonths;
  };

  const handleScheduleAppointment = (schedule) => {
    console.log("Scheduling appointment for:", schedule.vaccine_name);
    // This would typically open a modal or navigate to appointment scheduling
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
        title="Vaccination Schedules"
        subtitle="View upcoming and past vaccination schedules for your children"
        actions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === "calendar" ? "primary" : "secondary"}
              onClick={() => setViewMode("calendar")}
            >
              📅 Calendar View
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              onClick={() => setViewMode("list")}
            >
              📋 List View
            </Button>
          </div>
        }
      />

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Children Registered
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to register your children first to view their vaccination
            schedules.
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
                        DOB: {new Date(child.dob).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Age: {getAgeInMonths(child.dob, new Date())} months
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Summary */}
          {selectedChild && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">
                    Total Vaccines
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {schedules.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">
                    Completed
                  </h3>
                  <p className="text-2xl font-bold text-green-600">
                    {schedules.filter((s) => s.status === "completed").length}
                  </p>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">
                    Upcoming
                  </h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {schedules.filter((s) => s.status === "upcoming").length}
                  </p>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">Pending</h3>
                  <p className="text-2xl font-bold text-yellow-600">
                    {schedules.filter((s) => s.status === "pending").length}
                  </p>
                </Card>
              </div>

              {/* Schedule Content */}
              {viewMode === "list" ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {selectedChild.first_name}'s Vaccination Schedule
                    </h3>
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
                            Scheduled Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Age
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
                        {schedules.map((schedule) => {
                          const status = getStatusBadge(schedule.status);
                          return (
                            <tr
                              key={schedule.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="px-6 py-4">
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {schedule.vaccine_name}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {schedule.description}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  Dose {schedule.dose_no}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                  {formatDate(schedule.scheduled_date)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 dark:text-gray-300">
                                  {schedule.age_months} months
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                                    status.color === "green"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : status.color === "yellow"
                                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                        : status.color === "blue"
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  }`}
                                >
                                  <span>{status.icon}</span>
                                  {status.text}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {schedule.status === "pending" ||
                                schedule.status === "upcoming" ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      handleScheduleAppointment(schedule)
                                    }
                                  >
                                    📅 Schedule
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled
                                  >
                                    ✅ Done
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // Calendar View Placeholder
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Calendar View
                  </h3>
                  <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📅</div>
                      <p className="text-gray-600 dark:text-gray-400">
                        Interactive calendar view
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Shows vaccination appointments on a calendar
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="secondary" className="p-4 h-auto flex-col">
                    <div className="text-2xl mb-2">📅</div>
                    <span className="text-sm">Book Appointment</span>
                  </Button>
                  <Button variant="secondary" className="p-4 h-auto flex-col">
                    <div className="text-2xl mb-2">🔔</div>
                    <span className="text-sm">Set Reminders</span>
                  </Button>
                  <Button variant="secondary" className="p-4 h-auto flex-col">
                    <div className="text-2xl mb-2">📄</div>
                    <span className="text-sm">Download Schedule</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
