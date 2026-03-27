import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Alert } from "../UI";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import apiClient from "../../../utils/api";

const BarangayDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const facilityId = user?.facility_id || user?.clinic_id;

  useEffect(() => {
    if (facilityId) {
      fetchDashboard();
      fetchAlerts();
    }
  }, [facilityId]);

  const fetchDashboard = async () => {
    try {
      const data = await apiClient.getVaccineSupplyBarangayDashboard(facilityId);
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

  const inventory = dashboard?.inventory || {};
  const pendingRequests = dashboard?.pendingRequests || 0;
  const pendingAllocations = dashboard?.pendingAllocations || 0;
  const temperature = dashboard?.temperature || {};
  const recentReports = dashboard?.recentReports || 0;

  return (
    <div className="barangay-dashboard">
      <div className="dashboard-header">
        <h1>Barangay Health Center Dashboard</h1>
        <div className="header-actions">
          <Button onClick={() => navigate("/vaccine-supply/requests/new")}>
            Submit Request
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/vaccine-supply/reports/new")}
          >
            Submit Report
          </Button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.total > 0 && (
        <Alert type="warning" className="mb-4">
          <strong>Active Alerts:</strong>{" "}
          {alerts.temperature.length > 0 &&
            `${alerts.temperature.length} temperature alerts, `}
          {alerts.lowStock.length > 0 &&
            `${alerts.lowStock.length} low stock alerts, `}
          {alerts.expiring.length > 0 &&
            `${alerts.expiring.length} expiring vaccines`}
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <Card className="stat-card">
          <Card.Header>
            <h3>Inventory Status</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">{inventory.total_items || 0}</div>
            <div className="stat-details">
              <div className="detail-row">
                <span>Total Vaccines:</span>
                <span>{inventory.total_quantity || 0}</span>
              </div>
              <div className="detail-row">
                <span>Expiring Soon:</span>
                <Badge variant="warning">{inventory.expiring_soon || 0}</Badge>
              </div>
              <div className="detail-row">
                <span>Expired:</span>
                <Badge variant="danger">{inventory.expired || 0}</Badge>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card className="stat-card">
          <Card.Header>
            <h3>Pending Requests</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">{pendingRequests}</div>
            <p className="stat-description">
              Vaccine requests awaiting city approval
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/vaccine-supply/requests")}
            >
              View Requests
            </Button>
          </Card.Body>
        </Card>

        <Card className="stat-card">
          <Card.Header>
            <h3>Pending Allocations</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">{pendingAllocations}</div>
            <p className="stat-description">
              Vaccines awaiting pickup or delivery
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/vaccine-supply/allocations")}
            >
              View Allocations
            </Button>
          </Card.Body>
        </Card>

        <Card className="stat-card">
          <Card.Header>
            <h3>Temperature Compliance (7 days)</h3>
          </Card.Header>
          <Card.Body>
            <div className="stat-value">
              {temperature.total_readings > 0
                ? Math.round(
                    (temperature.normal_readings / temperature.total_readings) *
                      100,
                  )
                : 0}
              %
            </div>
            <div className="stat-breakdown">
              <span>{temperature.normal_readings || 0} Normal</span>
              <Badge variant="danger">{temperature.alerts || 0} Alerts</Badge>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="quick-links-grid mt-4">
        <Card className="quick-link-card">
          <Card.Body>
            <h4>📦 Inventory</h4>
            <p>Manage your vaccine stock</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/vaccine-supply/storage")}
            >
              View Inventory
            </Button>
          </Card.Body>
        </Card>

        <Card className="quick-link-card">
          <Card.Body>
            <h4>🌡️ Temperature</h4>
            <p>Log and monitor temperatures</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/vaccine-supply/temperature")}
            >
              Log Temperature
            </Button>
          </Card.Body>
        </Card>

        <Card className="quick-link-card">
          <Card.Body>
            <h4>📋 Reports</h4>
            <p>Submit periodic reports</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/vaccine-supply/reports/new")}
            >
              Submit Report
            </Button>
          </Card.Body>
        </Card>

        <Card className="quick-link-card">
          <Card.Body>
            <h4>🚚 Allocations</h4>
            <p>Track incoming vaccines</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/vaccine-supply/allocations")}
            >
              View Allocations
            </Button>
          </Card.Body>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="mt-4">
        <Card.Header>
          <h3>Recent Activity</h3>
        </Card.Header>
        <Card.Body>
          <div className="activity-summary">
            <div className="activity-item">
              <span className="activity-icon">📝</span>
              <span className="activity-text">
                Recent Reports: {recentReports}
              </span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">📦</span>
              <span className="activity-text">
                Pending Allocations: {pendingAllocations}
              </span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">📋</span>
              <span className="activity-text">
                Pending Requests: {pendingRequests}
              </span>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default BarangayDashboard;
