import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import MyChildren from "../pages/MyChildren";
import UserVaccinationRecords from "../pages/UserVaccinationRecords";
import HealthInformation from "../pages/HealthInformation";
import Profile from "../pages/Profile";
import UserImmunizationRecords from "../pages/digital-documents/UserImmunizationRecords";
import UserHealthCertificates from "../pages/digital-documents/UserHealthCertificates";
import UserVaccinationSchedules from "../pages/digital-documents/UserVaccinationSchedules";
import UserDownloadCenter from "../pages/digital-documents/UserDownloadCenter";
import MobileBottomNav from "./MobileBottomNav";

const userNavItems = [
  { name: "Dashboard", path: "/user/dashboard", icon: "🏠" },
  { name: "My Children", path: "/user/children", icon: "👶" },
  {
    name: "Digital Documents",
    path: "/user/documents",
    icon: "📄",
    subItems: [
      {
        name: "Immunization Records",
        path: "/user/documents/immunization-records",
        icon: "💉",
      },
      {
        name: "Health Certificates",
        path: "/user/documents/health-certificates",
        icon: "🏥",
      },
      {
        name: "Vaccination Schedules",
        path: "/user/documents/vaccination-schedules",
        icon: "📅",
      },
      {
        name: "Download Center",
        path: "/user/documents/download-center",
        icon: "⬇️",
      },
    ],
  },
  {
    name: "Vaccination Records",
    path: "/user/vaccination-records",
    icon: "💉",
  },
  { name: "Health Information", path: "/user/health-information", icon: "📊" },
  { name: "Profile", path: "/user/profile", icon: "👤" },
];

export default function UserDashboardRouter() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Use centralized theme context for consistent dark mode across the app
  const { darkMode, toggleDarkMode } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-expand Digital Documents section when on a documents page
  useEffect(() => {
    if (location.pathname.startsWith("/user/documents")) {
      setExpandedSections((prev) => ({ ...prev, "Digital Documents": true }));
    }
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSection = (sectionName) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const handleNavigation = (path, itemName) => {
    navigate(path);
    setSidebarOpen(false);
    setShowProfile(false);
    setShowNotif(false);
  };

  const isActive = (path) => {
    if (path === "/user/dashboard") {
      return (
        location.pathname === "/user/dashboard" || location.pathname === "/user"
      );
    }
    return location.pathname.startsWith(path);
  };

  const isSubItemActive = (path) => {
    return location.pathname === path;
  };

  const DashboardHome = () => (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back, {user?.name || "Parent"}!
        </h2>
        <p className="text-indigo-100">
          Keep track of your children's vaccination schedules and health
          records.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Children</p>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            2
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Next Appointment</p>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            Mar 15
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Completed Vaccinations</p>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            8
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">Pending</p>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
            3
          </h2>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleNavigation("/user/children", "My Children")}
            className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
          >
            <div className="text-blue-600 dark:text-blue-400 text-2xl mb-2">
              👶
            </div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              My Children
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View children's records
            </p>
          </button>
          <button
            onClick={() =>
              handleNavigation(
                "/user/vaccination-records",
                "Vaccination Records",
              )
            }
            className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
          >
            <div className="text-green-600 dark:text-green-400 text-2xl mb-2">
              💉
            </div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Vaccination Records
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Check vaccination history
            </p>
          </button>
          <button
            onClick={() =>
              handleNavigation("/user/health-information", "Health Information")
            }
            className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
          >
            <div className="text-purple-600 dark:text-purple-400 text-2xl mb-2">
              📊
            </div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Health Information
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Growth monitoring
            </p>
          </button>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Upcoming Appointments
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                DPT Vaccination
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                March 15, 2024 at 10:00 AM
              </p>
            </div>
            <span className="px1 bg-blue-100 dark:bg-blue-2 py--900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
              Confirmed
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Polio Vaccination
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                April 20, 2024 at 2:00 PM
              </p>
            </div>
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
              Pending
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex transition-colors">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed md:static z-30 w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col transform transition-transform duration-200
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="p-6 font-bold text-xl text-indigo-600 dark:text-indigo-400">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏥</div>
              <span>Immunicare</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 text-sm overflow-y-auto">
            {userNavItems.map((item) => (
              <div key={item.name}>
                <button
                  onClick={() => {
                    if (item.subItems) {
                      toggleSection(item.name);
                    } else {
                      handleNavigation(item.path, item.name);
                    }
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group relative flex items-center gap-3
                  ${
                    isActive(item.path) ||
                    (item.subItems &&
                      item.subItems.some((sub) => isSubItemActive(sub.path)))
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:translate-x-1"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                  {item.subItems && (
                    <span className="ml-auto text-sm">
                      {expandedSections[item.name] ? "▼" : "▶"}
                    </span>
                  )}
                </button>

                {/* Sub Items */}
                {item.subItems && expandedSections[item.name] && (
                  <div className="ml-4 mt-2 space-y-1">
                    {item.subItems.map((subItem) => (
                      <button
                        key={subItem.name}
                        onClick={() =>
                          handleNavigation(subItem.path, subItem.name)
                        }
                        className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 group relative flex items-center gap-3 text-sm
                        ${
                          isSubItemActive(subItem.path)
                            ? "bg-indigo-500 text-white"
                            : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:translate-x-1"
                        }`}
                      >
                        <span className="text-base">{subItem.icon}</span>
                        <span>{subItem.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Parent/Guardian
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 space-y-6 relative z-10">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {/* Burger */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                onClick={toggleSidebar}
                title={sidebarOpen ? "Hide navigation" : "Show navigation"}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {sidebarOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
              <h1 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100">
                {userNavItems.find((item) => isActive(item.path))?.name ||
                  "Dashboard"}
              </h1>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              {/* Dark Mode */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {darkMode ? "🌙" : "☀️"}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotif(!showNotif)}
                  className="relative p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  🔔
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                    2
                  </span>
                </button>

                {showNotif && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-3 text-sm">
                    <p className="font-semibold mb-2">Notifications</p>
                    <ul className="space-y-2">
                      <li>Appointment reminder</li>
                      <li>Vaccination due</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center gap-2"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                    {user?.name?.charAt(0) || "U"}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {user?.name || "User"}
                  </span>
                </button>

                {showProfile && (
                  <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 shadow-lg rounded-xl text-sm overflow-hidden">
                    <button
                      onClick={() =>
                        handleNavigation("/user/profile", "Profile")
                      }
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Profile
                    </button>
                    <button
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/children" element={<MyChildren />} />
            <Route
              path="/vaccination-records"
              element={<UserVaccinationRecords />}
            />
            <Route path="/health-information" element={<HealthInformation />} />
            <Route path="/profile" element={<Profile />} />

            {/* Digital Documents Routes */}
            <Route
              path="/documents"
              element={
                <Navigate to="/user/documents/immunization-records" replace />
              }
            />
            <Route
              path="/documents/immunization-records"
              element={<UserImmunizationRecords />}
            />
            <Route
              path="/documents/health-certificates"
              element={<UserHealthCertificates />}
            />
            <Route
              path="/documents/vaccination-schedules"
              element={<UserVaccinationSchedules />}
            />
            <Route
              path="/documents/download-center"
              element={<UserDownloadCenter />}
            />

            {/* Catch all route */}
            <Route
              path="*"
              element={<Navigate to="/user/dashboard" replace />}
            />
          </Routes>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
