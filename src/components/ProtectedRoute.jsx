import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({
  children,
  adminOnly = false,
  requireSystemAdmin = false,
  requireGuardian = false,
}) => {
  const { isAuthenticated, isAdmin, isGuardian, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (adminOnly || requireSystemAdmin) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/guardian/login" replace />;
  }

  if ((adminOnly || requireSystemAdmin) && !isAdmin) {
    return <Navigate to="/guardian/dashboard" replace />;
  }

  if (requireGuardian && !isGuardian) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
