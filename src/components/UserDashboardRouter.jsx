import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function UserDashboardRouter() {
  const location = useLocation();

  // Map legacy /user/* routes to /guardian/*
  const newPath = location.pathname.replace(/^\/user/, '/guardian');

  return <Navigate to={newPath} replace />;
}
