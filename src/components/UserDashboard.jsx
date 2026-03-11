import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";
import { Card, Button, Badge } from "./UI";
import HealthAlerts from "./HealthAlerts";
import { Calendar, Users, FileText, Bell, Plus } from "lucide-react";

export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const [infants, setInfants] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [notifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");

      // Fetch user profile
      const userResult = await apiClient.getUserProfile(userId);
      setUser(userResult);

      // Fetch infants by guardian
      const infantsResult = await apiClient.getInfantsByGuardian(userId);
      setInfants(infantsResult);

      // Fetch appointments for all infants
      const appointmentsResult = await apiClient.getAppointments();

      // Filter appointments for the user's infants
      const userInfantIds = infantsResult.map((i) => i.id);
      const userAppointments = appointmentsResult.filter((a) =>
        userInfantIds.includes(a.infant_id),
      );
      setAppointments(userAppointments);

      // Fetch vaccinations for all infants
      let allVaccinations = [];
      for (const infant of infantsResult) {
        try {
          const infantVaccinations =
            await apiClient.getVaccinationRecordsByInfant(infant.id);
          allVaccinations = [...allVaccinations, ...infantVaccinations];
        } catch (e) {
          console.warn(`Could not fetch vaccinations for infant ${infant.id}`);
        }
      }
      setVaccinations(allVaccinations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUpcomingAppointments = () => {
    return appointments
      .filter((a) => new Date(a.scheduled_date) >= new Date())
      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
      .slice(0, 5);
  };

  const getVaccinationStatus = (infantId) => {
    const infantVaccinations = vaccinations.filter(
      (v) => v.infant_id === infantId,
    );
    const totalVaccines = infantVaccinations.length;
    const completedVaccines = infantVaccinations.filter(
      (v) => v.status === "completed",
    ).length;

    return {
      total: totalVaccines,
      completed: completedVaccines,
      pending: totalVaccines - completedVaccines,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error Loading Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">{error}</p>
          <Button onClick={fetchData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user?.name || "Guardian"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your family's health and vaccination records
              </p>
            </div>
            <div className="flex space-x-4">
              <Button
                variant="primary"
                onClick={() => navigate("/appointments")}
                leftIcon={<Calendar className="h-4 w-4" />}
              >
                Book Appointment
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/my-children")}
                leftIcon={<Users className="h-4 w-4" />}
              >
                View Children
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: "overview", name: "Overview", icon: Users },
                { id: "appointments", name: "Appointments", icon: Calendar },
                { id: "documents", name: "Documents", icon: FileText },
                { id: "notifications", name: "Notifications", icon: Bell },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "overview" && (
              <OverviewTab
                infants={infants}
                appointments={getUpcomingAppointments()}
                vaccinations={vaccinations}
                getVaccinationStatus={getVaccinationStatus}
              />
            )}

            {activeTab === "appointments" && (
              <AppointmentsTab appointments={appointments} infants={infants} />
            )}

            {activeTab === "documents" && <DocumentsTab infants={infants} />}

            {activeTab === "notifications" && (
              <NotificationsTab notifications={notifications} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  infants,
  appointments,
  vaccinations,
  getVaccinationStatus,
  onViewAllAlerts,
}) {
  const navigate = useNavigate();

  const handleViewAllAlerts = () => {
    if (onViewAllAlerts) {
      onViewAllAlerts();
    } else {
      navigate("/health-alerts");
    }
  };
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Children
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {infants.length}
              </p>
            </div>
            <Users className="h-12 w-12 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Upcoming Appointments
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {appointments.length}
              </p>
            </div>
            <Calendar className="h-12 w-12 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Vaccinations
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {vaccinations.length}
              </p>
            </div>
            <FileText className="h-12 w-12 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Children Overview */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your Children
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {infants.map((infant) => {
            const status = getVaccinationStatus(infant.id);
            const upcomingAppointments = appointments.filter(
              (a) => a.infant_id === infant.id,
            );

            return (
              <Card
                key={infant.id}
                className="hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {infant.first_name} {infant.last_name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Age:{" "}
                      {Math.floor(
                        (new Date() - new Date(infant.dob)) /
                          (365.25 * 24 * 60 * 60 * 1000),
                      )}{" "}
                      years
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Vaccinations
                        </span>
                        <span className="font-medium">
                          {status.completed}/{status.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${
                              status.total > 0
                                ? (status.completed / status.total) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {upcomingAppointments.length > 0 && (
                      <div className="mt-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Next appointment:{" "}
                          {new Date(
                            upcomingAppointments[0].scheduled_date,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <Badge
                      variant={
                        status.completed === status.total
                          ? "success"
                          : "warning"
                      }
                    >
                      {status.completed === status.total
                        ? "Up to Date"
                        : "Due Soon"}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {appointments.slice(0, 3).map((appointment) => (
              <div
                key={appointment.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {appointment.type || "Appointment"}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(
                        appointment.scheduled_date,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="info">{appointment.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Health Alerts */}
      {infants.length > 0 && (
        <HealthAlerts
          infants={infants}
          maxAlerts={5}
          showViewAll={true}
          onViewAllClick={handleViewAllAlerts}
        />
      )}
    </div>
  );
}

// Appointments Tab Component
function AppointmentsTab({ appointments, infants }) {
  const navigate = useNavigate();

  const getInfantName = (infantId) => {
    const infant = infants.find((i) => i.id === infantId);
    return infant ? `${infant.first_name} ${infant.last_name}` : "Unknown";
  };

  const handleBookAppointment = () => {
    navigate("/appointments");
  };

  const handleViewDetails = (appointmentId) => {
    navigate(`/appointments/${appointmentId}`);
  };

  const handleReschedule = (appointmentId) => {
    navigate(`/appointments/${appointmentId}/reschedule`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          All Appointments
        </h3>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={handleBookAppointment}
        >
          Book New Appointment
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {appointments.length === 0 ? (
            <div className="p-6 text-center text-gray-600 dark:text-gray-400">
              No appointments found. Book an appointment to get started.
            </div>
          ) : (
            appointments.map((appointment) => (
              <div key={appointment.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {appointment.type || "Medical Appointment"}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      For: {getInfantName(appointment.infant_id)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Date:{" "}
                      {new Date(appointment.scheduled_date).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Status: {appointment.status}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleViewDetails(appointment.id)}
                    >
                      View Details
                    </Button>
                    {appointment.status === "scheduled" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleReschedule(appointment.id)}
                      >
                        Reschedule
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Documents Tab Component
function DocumentsTab({ infants }) {
  const navigate = useNavigate();

  const handleGenerateSchedule = (infantId) => {
    // Navigate to vaccination schedule page for the infant
    navigate(`/vaccinations/schedule/${infantId}`);
  };

  const handleViewGrowthChart = (infantId) => {
    // Navigate to growth chart page for the infant
    navigate(`/guardian/health-charts/${infantId}`);
  };

  const handleDownloadRecords = async (infantId) => {
    try {
      // Fetch completion status and download documents
      const status = await apiClient.getCompletionStatus(infantId);
      if (status && status.completionStatus) {
        // Generate and download immunization record
        const infant = infants.find((i) => i.id === infantId);
        if (infant) {
          alert(
            `Downloading records for ${infant.first_name} ${infant.last_name}...`,
          );
          // In a real implementation, this would trigger document generation and download
        }
      }
    } catch (error) {
      console.error("Error downloading records:", error);
      alert("Failed to download records. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Available Documents
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {infants.map((infant) => (
          <Card key={infant.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {infant.first_name} {infant.last_name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Vaccination Records & Growth Charts
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>

            <div className="mt-4 space-y-2">
              <Button
                size="sm"
                variant="primary"
                className="w-full"
                onClick={() => handleGenerateSchedule(infant.id)}
              >
                Generate Vaccine Schedule
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => handleViewGrowthChart(infant.id)}
              >
                View Growth Chart
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => handleDownloadRecords(infant.id)}
              >
                Download Records
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Notifications Tab Component
function NotificationsTab({ notifications }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Notifications
      </h3>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-600 dark:text-gray-400">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="p-6">
                <div className="flex items-start space-x-3">
                  <Bell className="h-6 w-6 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {notification.priority === "high" && (
                    <Badge variant="danger">Important</Badge>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Default notifications if none from API */}
          {notifications.length === 0 && (
            <>
              <div className="p-6">
                <div className="flex items-start space-x-3">
                  <Bell className="h-6 w-6 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Upcoming Vaccination Reminder
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your child's next vaccination is due in 2 weeks. Please
                      schedule an appointment.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      2 days ago
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-start space-x-3">
                  <Calendar className="h-6 w-6 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Appointment Confirmed
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your appointment for routine checkup has been confirmed
                      for tomorrow at 10:00 AM.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      5 days ago
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
