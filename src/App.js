import React, { Suspense, lazy, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { SocketProvider } from "./contexts/SocketContext";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
// Prefetch hooks - available for future use
// import {
//   usePrefetchDashboard,
//   usePrefetchGuardian,
// } from "./hooks/useCachedData";
import OfflineIndicator from "./components/OfflineIndicator";
import LoadingFallback from "./components/UI/LoadingFallback";
import NotificationToast from "./components/Notifications/NotificationToast";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminLayout from "./components/AdminLayout";
import GuardianIntroduction from "./components/GuardianIntroduction";
import QueryProvider from "./providers/QueryProvider"; // Guardian introduction page
import { getDefaultAuthenticatedRouteFromFlags } from "./utils/authRedirect";

// Lazy load components for better performance
// Core components loaded immediately
import GuardianLoginPage from "./pages/GuardianLoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import TestLogin from "./pages/TestLogin";
import SimpleTest from "./pages/SimpleTest";
import DOMTest from "./pages/DOMTest";
import SimpleLoginTest from "./pages/SimpleLoginTest";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import UserVaccinationRecords from "./pages/UserVaccinationRecords";

// Dashboard components - lazy loaded
const Dashboard = lazy(() =>
  import("./components/Dashboard/DashboardOverview").then((module) => ({
    default: module.default,
  })),
);

const GuardianDashboard = lazy(() =>
  import("./pages/GuardianDashboard").then((module) => ({
    default: module.default,
  })),
);

const GuardianLayout = lazy(() =>
  import("./components/GuardianLayout").then((module) => ({
    default: module.default,
  })),
);

const MyChildren = lazy(() => import("./pages/MyChildren"));

// Vaccination Dashboard - Main component with full UI design
const VaccinationsDashboard = lazy(() =>
  import("./pages/VaccinationsDashboard").then((module) => ({
    default: module.default,
  })),
);

// Page components - lazy loaded with prefetching
const Analytics = lazy(() => import("./pages/Analytics"));
const Appointments = lazy(() => import("./pages/Appointments"));
const InfantManagement = lazy(() => import("./pages/InfantManagement"));
const InventoryManagement = lazy(() => import("./pages/InventoryManagement"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Profile = lazy(() => import("./pages/Profile"));
const HealthInformation = lazy(() => import("./pages/HealthInformation"));

const GuardianImmunizationChartPage = lazy(() =>
  import("./pages/GuardianImmunizationChartPage").then((module) => ({
    default: module.default,
  })),
);

const GuardianGrowthChartPage = lazy(() =>
  import("./pages/GuardianGrowthChartPage").then((module) => ({
    default: module.default,
  })),
);

const GuardianNotificationsPage = lazy(() =>
  import("./pages/GuardianNotificationsPage").then((module) => ({
    default: module.default,
  })),
);

const GuardianAppointmentsPage = lazy(() =>
  import("./pages/GuardianAppointmentsPage").then((module) => ({
    default: module.default,
  })),
);

const GuardianAppointmentBooking = lazy(() =>
  import("./pages/GuardianAppointmentBooking").then((module) => ({
    default: module.default,
  })),
);

// Missing page components - lazy loaded
const VaccineTracking = lazy(() => import("./pages/VaccineTracking"));
const Reports = lazy(() => import("./pages/Reports"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));

// Digital Papers Pages - lazy loaded
const DigitalPapersDashboard = lazy(
  () => import("./pages/DigitalPapersDashboard"),
);

// Import digital papers pages
const ImmunizationChartPage = lazy(
  () => import("./pages/digital-papers/ImmunizationChartPage"),
);

const ImmunizationRecordPage = lazy(
  () => import("./pages/digital-papers/ImmunizationRecordPage"),
);

const VaccineSchedulePage = lazy(
  () => import("./pages/digital-papers/VaccineSchedulePage"),
);

const DownloadCenter = lazy(
  () => import("./pages/digital-papers/DownloadCenter"),
);

// Prefetch function for route preloading
const prefetchRoute = (importFn) => {
  // Use requestIdleCallback for non-critical preloading
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      importFn();
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(importFn, 1000);
  }
};

// Preload critical routes after initial load
const preloadCriticalRoutes = () => {
  // Prefetch commonly accessed routes
  prefetchRoute(() => import("./pages/Analytics"));
  prefetchRoute(() => import("./pages/Appointments"));
  prefetchRoute(() => import("./pages/Profile"));
};

function AppContent() {
  const {
    isAuthenticated,
    isAdmin,
    isGuardian,
    loading,
  } = useAuth();
  const { isOnline, isBackendReachable } = useNetworkStatus();
  const location = useLocation();
  const authenticatedDefaultRoute = getDefaultAuthenticatedRouteFromFlags({
    isGuardian,
    isAdmin,
  });

  const loginRedirectElement = useMemo(
    () => <Navigate to="/guardian/login" replace />,
    [],
  );

  // Preload critical routes after authentication
  useEffect(() => {
    if (isAuthenticated) {
      preloadCriticalRoutes();
    }
  }, [isAuthenticated]);

  if (loading) {
    return <LoadingFallback message="Initializing application..." />;
  }

  // Define public routes that don't require authentication
  const isPublicRoute = [
    "/",
    "/login",
    "/client/login",
    "/admin/login",
    "/guardian/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].some((route) => location.pathname.startsWith(route));

  // If not authenticated and not on a public route, redirect to login
  // But prevent redirect loops by checking if we're already on login page
  if (!isAuthenticated && !isPublicRoute && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <OfflineIndicator
        isOnline={isOnline}
        isBackendReachable={isBackendReachable}
      />
      <NotificationToast />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Routes - Guardian Introduction */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <GuardianIntroduction />
              )
            }
          />
          <Route
            path="/guardian/introduction"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <GuardianIntroduction />
              )
            }
          />
          {/* Public Routes - Login Pages */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                loginRedirectElement
              )
            }
          />
          <Route
            path="/client/login"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                loginRedirectElement
              )
            }
          />
          <Route
            path="/admin-guardian-login"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <Navigate to="/admin/login" replace />
              )
            }
          />
          <Route
            path="/admin/login"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <AdminLoginPage />
              )
            }
          />
          <Route
            path="/guardian/login"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <GuardianLoginPage />
              )
            }
          />
          <Route
            path="/test-login"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <TestLogin />
              )
            }
          />
          <Route
            path="/simple-test"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <SimpleTest />
              )
            }
          />
          <Route
            path="/dom-test"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <DOMTest />
              )
            }
          />
          <Route
            path="/simple-login-test"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <SimpleLoginTest />
              )
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <Register />
              )
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  {isAdmin ? (
                    <Dashboard />
                  ) : isGuardian ? (
                    <Navigate to="/guardian/dashboard" replace />
                  ) : (
                    <Navigate to="/login" replace />
                  )}
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Analytics />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Appointments />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/infants"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <InfantManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <InventoryManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <UserManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Profile />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-information"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <HealthInformation />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* Digital Papers Routes - Main dashboard with tabs */}
          <Route
            path="/digital-papers"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <DigitalPapersDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/digital-papers/downloads"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <DownloadCenter />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* Digital Papers - Immunization Chart */}
          <Route
            path="/digital-papers/immunization-chart"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <ImmunizationChartPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/digital-papers/immunization-chart/:infantId"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <ImmunizationChartPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* Digital Papers - Immunization Records */}
          <Route
            path="/digital-papers/immunization-records"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <ImmunizationRecordPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/digital-papers/immunization-records/:infantId"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <ImmunizationRecordPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* Digital Papers - Vaccine Schedule */}
          <Route
            path="/digital-papers/vaccine-schedule"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <VaccineSchedulePage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/digital-papers/vaccine-schedule/:infantId"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <VaccineSchedulePage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* Vaccination Management Route - Using main VaccinationsDashboard with full UI design */}
          <Route
            path="/vaccination-management/*"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <VaccinationsDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vaccine-tracking"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <VaccineTracking />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Reports />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Announcements />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Notifications />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requireSystemAdmin>
                <AdminLayout>
                  <Settings />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* Redirect old inventory routes to main inventory with tab parameter */}
          <Route
            path="/inventory/transactions"
            element={<Navigate to="/inventory?tab=transactions" replace />}
          />
          <Route
            path="/inventory/alerts"
            element={<Navigate to="/inventory?tab=alerts" replace />}
          />
          <Route
            path="/inventory/reports"
            element={<Navigate to="/inventory?tab=reports" replace />}
          />
          <Route
            path="/inventory/suppliers"
            element={<Navigate to="/inventory?tab=suppliers" replace />}
          />
          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute adminOnly>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* User routes removed in two-role model */}
          {/* Guardian routes using GuardianLayout */}
          <Route
            path="/guardian"
            element={
              <ProtectedRoute requireGuardian>
                <GuardianLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<Navigate to="/guardian/dashboard" replace />}
            />
            {/* Use GuardianDashboard component for dashboard route */}
            <Route path="dashboard" element={<GuardianDashboard />} />
            <Route path="children" element={<MyChildren />} />
            <Route path="children/new" element={<MyChildren />} />
            <Route path="children/:childId" element={<MyChildren />} />
            <Route path="appointments" element={<GuardianAppointmentsPage />} />
            <Route path="appointments/new" element={<GuardianAppointmentBooking />} />
            <Route path="appointments/book" element={<GuardianAppointmentBooking />} />
            <Route
              path="appointments/:appointmentId"
              element={<GuardianAppointmentsPage />}
            />
            <Route
              path="vaccination-records"
              element={<UserVaccinationRecords />}
            />
            <Route
              path="vaccination-records/:childId"
              element={<UserVaccinationRecords />}
            />
            <Route
              path="health-charts"
              element={<GuardianGrowthChartPage />}
            />
            <Route
              path="health-charts/:childId"
              element={<GuardianGrowthChartPage />}
            />
            <Route
              path="immunization-chart"
              element={<GuardianImmunizationChartPage />}
            />
            <Route
              path="immunization-chart/:childId"
              element={<GuardianImmunizationChartPage />}
            />
            <Route path="messages" element={<Notifications />} />
            <Route
              path="notifications"
              element={<GuardianNotificationsPage />}
            />
            <Route
              path="notifications/:notificationId"
              element={<GuardianNotificationsPage />}
            />
            <Route path="profile" element={<Profile />} />
            <Route
              path="settings"
              element={<Navigate to="/guardian/profile" replace />}
            />
            {/* Redirect legacy/missing routes */}
            <Route
              path="vaccinations"
              element={<Navigate to="/guardian/vaccination-records" replace />}
            />
            <Route
              path="vaccinations/*"
              element={<Navigate to="/guardian/vaccination-records" replace />}
            />
            <Route
              path="health-records"
              element={<Navigate to="/guardian/health-charts" replace />}
            />
            <Route
              path="growth-chart"
              element={<Navigate to="/guardian/health-charts" replace />}
            />
            <Route
              path="medical-history"
              element={<Navigate to="/guardian/health-charts" replace />}
            />
            <Route
              path="reports"
              element={<Navigate to="/guardian/immunization-chart" replace />}
            />
            {/* Catch-all route for guardian - ensure something always renders */}
            <Route path="*" element={null} />
          </Route>
          {/* Default redirects */}
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
              <QueryProvider>
                <Router>
                  <AppContent />
                </Router>
              </QueryProvider>
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
