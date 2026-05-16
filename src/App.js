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
import OfflineIndicator from "./components/OfflineIndicator";
import LoadingFallback from "./components/UI/LoadingFallback";
import NotificationToast from "./components/Notifications/NotificationToast";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminLayout from "./components/AdminLayout";
import GuardianIntroduction from "./components/GuardianIntroduction";
import QueryProvider from "./providers/QueryProvider";
import {
  getDefaultAuthenticatedRouteFromFlags,
  getLoginRouteFromPathname,
} from "./utils/authRedirect";

// Pages loaded eagerly (small, on the critical path)
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

// Guardian section
const GuardianDashboard = lazy(() => import("./pages/GuardianDashboard"));
const GuardianLayout = lazy(() => import("./components/GuardianLayout"));
const MyChildren = lazy(() => import("./pages/MyChildren"));
const GuardianImmunizationChartPage = lazy(() => import("./pages/GuardianImmunizationChartPage"));
const GuardianDocumentsPage = lazy(() => import("./pages/GuardianDocumentsPage"));
const GuardianNotificationsPage = lazy(() => import("./pages/GuardianNotificationsPage"));
const GuardianAppointmentsPage = lazy(() => import("./pages/GuardianAppointmentsPage"));
const GuardianMessagesPage = lazy(() => import("./pages/GuardianMessagesPage"));
const GuardianAppointmentBooking = lazy(() => import("./pages/GuardianAppointmentBooking"));
const GuardianGrowthChartPage = lazy(() => import("./pages/GuardianGrowthChartPage"));

// Admin section
const Analytics = lazy(() => import("./pages/Analytics"));
const Appointments = lazy(() => import("./pages/Appointments"));
const InfantManagement = lazy(() => import("./pages/InfantManagement"));
const InventoryManagement = lazy(() => import("./pages/InventoryManagement"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Profile = lazy(() => import("./pages/Profile"));
const HealthInformation = lazy(() => import("./pages/HealthInformation"));
const VaccinationsDashboard = lazy(() => import("./pages/VaccinationsDashboard"));
const Reports = lazy(() => import("./pages/Reports"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePassword"));

// Digital papers
const ImmunizationChartPage = lazy(() => import("./pages/digital-papers/ImmunizationChartPage"));
const ImmunizationRecordPage = lazy(() => import("./pages/digital-papers/ImmunizationRecordPage"));
const VaccineSchedulePage = lazy(() => import("./pages/digital-papers/VaccineSchedulePage"));

const prefetchRoute = (importFn) => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(importFn);
  } else {
    setTimeout(importFn, 1000);
  }
};

const preloadCriticalRoutes = () => {
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
  const unauthenticatedLoginRoute = getLoginRouteFromPathname(location.pathname);

  const loginRedirectElement = useMemo(
    () => <Navigate to="/guardian/login" replace />,
    [],
  );

  useEffect(() => {
    if (isAuthenticated) {
      preloadCriticalRoutes();
    }
  }, [isAuthenticated]);

  if (loading) {
    return <LoadingFallback message="Initializing application..." />;
  }

  const isPublicRoute = [
    "/login",
    "/client/login",
    "/admin/login",
    "/guardian/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/guardian/introduction",
  ].includes(location.pathname) || location.pathname === "/";

  if (!isAuthenticated && !isPublicRoute && location.pathname !== "/login") {
    return <Navigate to={unauthenticatedLoginRoute} replace />;
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
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {isAdmin ? (
                  <Navigate to="/analytics" replace />
                ) : isGuardian ? (
                  <Navigate to="/guardian/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )}
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
            path="/transfer-in-cases"
            element={
              <ProtectedRoute requireSystemAdmin>
                <Navigate to="/infants?view=transfer-in" replace />
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
            path="/inventory-management"
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
            element={<Navigate to="/vaccination-management" replace />}
          />
          <Route
            path="/vaccine-tracking-dashboard"
            element={<Navigate to="/vaccination-management" replace />}
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
            path="/inventory/transactions"
            element={<Navigate to="/inventory?tab=stock_movements" replace />}
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
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute adminOnly>
                <Navigate to="/analytics" replace />
              </ProtectedRoute>
            }
          />
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
            <Route path="documents" element={<GuardianDocumentsPage />} />
            <Route
              path="immunization-chart"
              element={<GuardianImmunizationChartPage />}
            />
            <Route
              path="immunization-chart/:childId"
              element={<GuardianImmunizationChartPage />}
            />
            <Route path="messages" element={<GuardianMessagesPage />} />
            <Route
              path="notifications"
              element={<GuardianNotificationsPage />}
            />
            <Route
              path="notifications/:notificationId"
              element={<GuardianNotificationsPage />}
            />
            <Route path="profile" element={<Profile />} />
            <Route path="health-information" element={<HealthInformation />} />
            <Route
              path="health-charts/:childId"
              element={<GuardianGrowthChartPage />}
            />
            <Route
              path="settings"
              element={<Navigate to="/guardian/profile" replace />}
            />
            <Route
              path="vaccinations"
              element={<Navigate to="/guardian/vaccination-records" replace />}
            />
            <Route
              path="vaccinations/*"
              element={<Navigate to="/guardian/vaccination-records" replace />}
            />
            <Route
              path="reports"
              element={<Navigate to="/guardian/immunization-chart" replace />}
            />
            <Route path="*" element={<Navigate to="/guardian/dashboard" replace />} />
          </Route>
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to={authenticatedDefaultRoute} replace />
              ) : (
                <Navigate to={unauthenticatedLoginRoute} replace />
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
