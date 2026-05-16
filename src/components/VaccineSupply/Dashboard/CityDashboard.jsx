import React, { useState, useEffect } from "react";
import { Card, Button, Badge,        Alert } from "../UI";
import { useNavigate } from "react-router-dom";
import apiClient from "../../../utils/api";

const CityDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
    fetchAlerts();
  }, []);

  const fetchDashboard = async () => {
    try {
      const data = await apiClient.getVaccineSupplyCityDashboard();
      if (data.success) {
        setDashboard(data.dashboard);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const data = await apiClient.getVaccineSupplyDashboardAlerts();
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <Alert type="error">{error}</Alert>;
  }

  const pendingRequests = dashboard?.pendingRequests || {};
  const activeDistributions = dashboard?.activeDistributions || {};
  const temperatureAlerts = dashboard?.temperatureAlerts || {};
  const facilities = dashboard?.facilities || {};
  const recentReports = dashboard?.recentReports || {};

  return(
    <div className="city-dashboard">
      <div className="dashboard-header">
        <h1>City Health Office Dashboard</h1>
        <div className="header-actions">
          <Button onClick={() => navigate("/vaccine-supply/requests")}>
            View All Requests
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/vaccine-supply/allocations/new")}
          >
            New Allocation
          </Button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.total > 0 &&(
        <Alert type="warning" className="mb-4">
          <strong>Active Alerts:</strong> {alerts.temperature.length}{" "}
          temperature alerts, {alerts.lowStock.length} low stock alerts,{" "}
          {alerts.expiring.length} expiring vaccines
        </Alert>)
       }

      {/* Stats Cards */}
      <div className="stats-grid">
        <Card className="stat-card">
          <Card.Header>
            <h3>Pending Requests</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">
              {pendingRequests.total_pending || 0}
            </div>
            <div className="stat-breakdown">
              <Badge variant="danger">
                {pendingRequests.high_priority || 0} High
              </Badge>
              <Badge variant="warning">
                {pendingRequests.medium_priority || 0} Medium
              </Badge>
              <Badge variant="info">
                {pendingRequests.low_priority || 0} Low
              </Badge>
            </div>
          </Card.Body>
        </Card>

        <Card className="stat-card">
          <Card.Header>
            <h3>Active Distributions</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">
              {activeDistributions.total_active || 0}
            </div>
            <div className="stat-breakdown">
              <span>{activeDistributions.pending || 0} Pending</span>
              <span>{activeDistributions.in_transit || 0} In Transit</span>
              <span>{activeDistributions.delivered || 0} Delivered</span>
            </div>
          </Card.Body>
        </Card>

        <Card className="stat-card">
          <Card.Header>
            <h3>Temperature Alerts (7 days)</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">
              {temperatureAlerts.total_alerts || 0}
            </div>
            <div className="stat-breakdown">
              <Badge variant="danger">
                {temperatureAlerts.critical || 0} Critical
              </Badge>
              <Badge variant="warning">
                {temperatureAlerts.warning || 0} Warning
              </Badge>
            </div>
          </Card.Body>
        </Card>

        <Card className="stat-card">
          <Card.Header>
            <h3>Barangay Health Centers</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">{facilities.total_barangays || 0}</div>
            <div className="stat-breakdown">
              <span>Warehouses: {facilities.warehouses || 0}</span>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card className="mt-4">
        <Card.Header>
          <h3>Recent Reports (30 days)</h3>
        </Card.Header>
        <Card.Body>
          <div className="report-summary">
            <div className="summary-item">
              <span className="summary-label">Total Reports:</span>
              <span className="summary-value">
                {recentReports.total_reports || 0}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Pending Review:</span>
              <span className="summary-value">
                {recentReports.pending_review || 0}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Reviewed:</span>
              <span className="summary-value">
                {recentReports.reviewed || 0}
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate("/vaccine-supply/reports/consolidated")}
          >
            View Consolidated Report
          </Button>
        </Card.Body>
      </Card>

      {/* Quick Actions */}
      <div className="quick-actions mt-4">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <Button onClick={() => navigate("/vaccine-supply/requests")}>
            Review Requests
          </Button>
          <Button onClick={() => navigate("/vaccine-supply/distributions")}>
            Track Distributions
          </Button>
          <Button onClick={() => navigate("/vaccine-supply/reports")}>
            Review Reports
          </Button>
        </div>
      </div>
    </div>)
   ;
};

export default CityDashboard;