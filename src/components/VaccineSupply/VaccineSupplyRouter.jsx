import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import CityDashboard from "./Dashboard/CityDashboard";
import BarangayDashboard from "./Dashboard/BarangayDashboard";
import RequestList from "./Requests/RequestList";
import RequestForm from "./Requests/RequestForm";
import AllocationList from "./Allocations/AllocationList";
import AllocationForm from "./Allocations/AllocationForm";
import DistributionTracking from "./Distributions/DistributionTracking";
import StorageManagement from "./Storage/StorageManagement";
import TemperatureMonitoring from "./Temperature/TemperatureMonitoring";
import ReportList from "./Reports/ReportList";
import ReportForm from "./Reports/ReportForm";
import ConsolidatedReport from "./Reports/ConsolidatedReport";

const VaccineSupplyRouter = () => {
  const { user } = useAuth();
  const [isCityLevel, setIsCityLevel] = useState(false);

  useEffect(() => {
    // Check if user is city-level
    const cityRoles = ["super_admin", "admin", "city_staff"];
    setIsCityLevel(cityRoles.includes(user?.role));
  }, [user]);

  // Redirect based on user type
  if (isCityLevel) {
    return (
      <Routes>
        <Route path="/" element={<CityDashboard />} />
        <Route path="/dashboard/city" element={<CityDashboard />} />
        <Route path="/requests" element={<RequestList />} />
        <Route path="/requests/:id" element={<RequestList />} />
        <Route path="/allocations" element={<AllocationList />} />
        <Route path="/allocations/new" element={<AllocationForm />} />
        <Route path="/allocations/:id" element={<AllocationList />} />
        <Route path="/distributions" element={<DistributionTracking />} />
        <Route path="/storage/:id" element={<StorageManagement />} />
        <Route path="/temperature/:id" element={<TemperatureMonitoring />} />
        <Route path="/reports" element={<ReportList />} />
        <Route path="/reports/consolidated" element={<ConsolidatedReport />} />
        <Route path="/reports/new" element={<ReportForm />} />
        <Route
          path="*"
          element={<Navigate to="/vaccine-supply/dashboard/city" replace />}
        />
      </Routes>
    );
  }

  // Barangay user routes
  return (
    <Routes>
      <Route path="/" element={<BarangayDashboard />} />
      <Route path="/dashboard/barangay" element={<BarangayDashboard />} />
      <Route path="/requests/new" element={<RequestForm />} />
      <Route path="/requests" element={<RequestList />} />
      <Route path="/requests/:id" element={<RequestList />} />
      <Route path="/allocations" element={<AllocationList />} />
      <Route path="/allocations/:id" element={<AllocationList />} />
      <Route path="/storage" element={<StorageManagement />} />
      <Route path="/storage/:id" element={<StorageManagement />} />
      <Route path="/temperature" element={<TemperatureMonitoring />} />
      <Route path="/temperature/:id" element={<TemperatureMonitoring />} />
      <Route path="/reports/new" element={<ReportForm />} />
      <Route path="/reports" element={<ReportList />} />
      <Route path="/reports/:id" element={<ReportList />} />
      <Route
        path="*"
        element={<Navigate to="/vaccine-supply/dashboard/barangay" replace />}
      />
    </Routes>
  );
};

export default VaccineSupplyRouter;
