import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, PageHeader, PageContainer } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { LayoutDashboard } from "lucide-react";
import HolidayDisplay from "../components/Dashboard/HolidayDisplay";
import UserManagement from "./UserManagement";
import InfantManagement from "./InfantManagement";
import Appointments from "./Appointments";
import InventoryManagement from "./InventoryManagement";
import Reports from "./Reports";
import Analytics from "./Analytics";
import Announcements from "./Announcements";
import Notifications from "./Notifications";
import Settings from "./Settings";
import HealthInformation from "./HealthInformation";

export default function ManagementDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");

  const navItems = [
    { id: "overview", name: "Overview", icon: "📊" },
    { id: "users", name: "User Management", icon: "👥" },
    { id: "infants", name: "Infant Management", icon: "👶" },
    { id: "appointments", name: "Appointments", icon: "📅" },
    { id: "inventory", name: "Inventory", icon: "📦" },
    { id: "vaccinations", name: "Vaccinations", icon: "💉" },
    { id: "vaccine-tracking", name: "Vaccine Tracking", icon: "📍" },
    { id: "analytics", name: "Analytics", icon: "📈" },
    { id: "digital-papers", name: "Digital Papers", icon: "📄" },
    { id: "announcements", name: "Announcements", icon: "📢" },
    { id: "notifications", name: "Notifications", icon: "🔔" },
    { id: "health-info", name: "Health Info", icon: "🏥" },
    { id: "reports", name: "Reports", icon: "📑" },
    { id: "settings", name: "Settings", icon: "⚙️" },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "users":
        return <UserManagement />;
      case "infants":
        return <InfantManagement />;
      case "appointments":
        return <Appointments />;
      case "inventory":
        navigate("/inventory");
        return null;
      case "vaccinations":
        navigate("/vaccination-management");
        return null;
      case "vaccine-tracking":
        navigate("/vaccine-tracking");
        return null;
      case "analytics":
        navigate("/analytics");
        return null;
      case "digital-papers":
        navigate("/digital-papers");
        return null;
      case "announcements":
        return <Announcements />;
      case "notifications":
        return <Notifications />;
      case "health-info":
        navigate("/health-information");
        return null;
      case "reports":
        return <Reports />;
      case "settings":
        navigate("/settings");
        return null;
      case "overview":
      default:
        return (
          <div className="space-y-8">
            {/* Management Overview Header */}
            <PageHeader
              title="Comprehensive Management Dashboard"
              subtitle="Centralized management for all healthcare facility operations"
              icon={<LayoutDashboard className="w-8 h-8 text-white" />}
            />

            {/* Philippine Holidays Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HolidayDisplay />
            </div>

            {/* Quick Stats - Top Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-primary-500"
                onClick={() => setActiveSection("users")}
              >
                <div className="text-4xl mb-3">👥</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  User Management
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Manage guardians and system users
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-success-500"
                onClick={() => setActiveSection("infants")}
              >
                <div className="text-4xl mb-3">👶</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Infant Management
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Track infant records and growth
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-info-500"
                onClick={() => setActiveSection("appointments")}
              >
                <div className="text-4xl mb-3">📅</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Appointments
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Schedule and manage visits
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-warning-500"
                onClick={() => navigate("/inventory")}
              >
                <div className="text-4xl mb-3">📦</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Inventory
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Monitor vaccine stock
                </p>
              </Card>
            </div>

            {/* Quick Stats - Second Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-danger-500"
                onClick={() => navigate("/vaccination-management")}
              >
                <div className="text-4xl mb-3">💉</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Vaccinations
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Manage vaccination records
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-primary-400"
                onClick={() => navigate("/vaccine-tracking")}
              >
                <div className="text-4xl mb-3">📍</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Vaccine Tracking
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Track vaccine distribution
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-purple-500"
                onClick={() => navigate("/analytics")}
              >
                <div className="text-4xl mb-3">📈</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Analytics
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  View data insights
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-indigo-500"
                onClick={() => navigate("/digital-papers")}
              >
                <div className="text-4xl mb-3">📄</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Digital Papers
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Manage digital documents
                </p>
              </Card>
            </div>

            {/* Quick Stats - Third Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-pink-500"
                onClick={() => navigate("/announcements")}
              >
                <div className="text-4xl mb-3">📢</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Announcements
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Post facility announcements
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-yellow-500"
                onClick={() => navigate("/notifications")}
              >
                <div className="text-4xl mb-3">🔔</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Notifications
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Manage notifications
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-teal-500"
                onClick={() => navigate("/health-information")}
              >
                <div className="text-4xl mb-3">🏥</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Health Information
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  View health records
                </p>
              </Card>
            </div>

            {/* Reports and Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-cyan-500"
                onClick={() => setActiveSection("reports")}
              >
                <div className="text-4xl mb-3">📑</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Reports
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Generate reports
                </p>
              </Card>
              <Card
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-gray-500"
                onClick={() => setActiveSection("settings")}
              >
                <div className="text-4xl mb-3">⚙️</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  System configuration
                </p>
              </Card>
            </div>

            {/* Management Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card
                className="p-6 flex flex-col h-full"
                title="👥 User Management"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Comprehensive user management system for guardians and
                  healthcare workers. Control access and manage profiles.
                </p>
                <Button
                  onClick={() => setActiveSection("users")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Users
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="👶 Infant Management"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Digital booklets and records for pediatric patients. Track
                  vaccination history and growth milestones.
                </p>
                <Button
                  onClick={() => setActiveSection("infants")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Infants
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="📅 Appointment System"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Schedule and track vaccination appointments. View upcoming
                  visits in list or calendar format.
                </p>
                <Button
                  onClick={() => setActiveSection("appointments")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Appointments
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="📦 Inventory Control"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Monitor vaccine stock levels and usage. Receive alerts for low
                  stock and manage transactions.
                </p>
                <Button
                  onClick={() => navigate("/inventory")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Inventory
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="💉 Vaccination Management"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Manage vaccination records, schedules, and immunization
                  charts. Track vaccine administration and patient history.
                </p>
                <Button
                  onClick={() => setActiveSection("vaccinations")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Vaccinations
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="📍 Vaccine Tracking"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Track vaccine distribution across facilities. Monitor supply
                  chain and inventory movements.
                </p>
                <Button
                  onClick={() => setActiveSection("vaccine-tracking")}
                  variant="secondary"
                  className="w-full"
                >
                  Track Vaccines
                </Button>
              </Card>

              <Card className="p-6 flex flex-col h-full" title="📈 Analytics">
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  View comprehensive analytics and insights. Analyze vaccination
                  trends and facility performance.
                </p>
                <Button
                  onClick={() => setActiveSection("analytics")}
                  variant="secondary"
                  className="w-full"
                >
                  View Analytics
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="📄 Digital Papers"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Manage digital immunization records and documents. Create and
                  distribute digital booklets.
                </p>
                <Button
                  onClick={() => setActiveSection("digital-papers")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Digital Papers
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="📢 Announcements"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Post and manage facility announcements. Keep guardians and
                  staff informed of important updates.
                </p>
                <Button
                  onClick={() => setActiveSection("announcements")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Announcements
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="🔔 Notifications"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Send and manage notifications. Alert users about appointments,
                  reminders, and updates.
                </p>
                <Button
                  onClick={() => setActiveSection("notifications")}
                  variant="secondary"
                  className="w-full"
                >
                  Manage Notifications
                </Button>
              </Card>

              <Card
                className="p-6 flex flex-col h-full"
                title="🏥 Health Information"
              >
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Access and manage patient health information. View medical
                  histories and health records.
                </p>
                <Button
                  onClick={() => setActiveSection("health-info")}
                  variant="secondary"
                  className="w-full"
                >
                  View Health Info
                </Button>
              </Card>

              <Card className="p-6 flex flex-col h-full" title="📊 Reporting">
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Generate comprehensive reports for facility management.
                  Analyze vaccination coverage and inventory trends.
                </p>
                <Button
                  onClick={() => navigate("/reports")}
                  variant="secondary"
                  className="w-full"
                >
                  View Reports
                </Button>
              </Card>

              <Card className="p-6 flex flex-col h-full" title="⚙️ Settings">
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
                  Configure system settings, facility information, and global
                  preferences. Manage user roles and permissions.
                </p>
                <Button
                  onClick={() => navigate("/settings")}
                  variant="secondary"
                  className="w-full"
                >
                  System Settings
                </Button>
              </Card>
            </div>

            {/* Admin Features */}
            {isAdmin && (
              <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-warning-800 dark:text-warning-200 mb-6 flex items-center gap-3">
                  <span className="text-2xl">🔒</span> Administrator Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-warning-100 dark:bg-warning-900/50 flex items-center justify-center text-warning-600 dark:text-warning-400 text-2xl flex-shrink-0">
                      🔐
                    </div>
                    <div>
                      <h4 className="font-bold text-warning-800 dark:text-warning-200 mb-1">
                        System Configuration
                      </h4>
                      <p className="text-sm text-warning-700 dark:text-warning-300 leading-relaxed">
                        Manage system settings, facility information, and global
                        configurations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-warning-100 dark:bg-warning-900/50 flex items-center justify-center text-warning-600 dark:text-warning-400 text-2xl flex-shrink-0">
                      📋
                    </div>
                    <div>
                      <h4 className="font-bold text-warning-800 dark:text-warning-200 mb-1">
                        Audit Logs
                      </h4>
                      <p className="text-sm text-warning-700 dark:text-warning-300 leading-relaxed">
                        Review system activity, security events, and user
                        actions for compliance.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-warning-100 dark:bg-warning-900/50 flex items-center justify-center text-warning-600 dark:text-warning-400 text-2xl flex-shrink-0">
                      🛡️
                    </div>
                    <div>
                      <h4 className="font-bold text-warning-800 dark:text-warning-200 mb-1">
                        Security Settings
                      </h4>
                      <p className="text-sm text-warning-700 dark:text-warning-300 leading-relaxed">
                        Configure security policies, password requirements, and
                        access controls.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Section Content */}
      <div className="animate-fade-in">{renderSection()}</div>
    </div>
  );
}
