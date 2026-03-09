import React, { useState, useEffect } from "react";
import apiClient from "../utils/api";
import { Button, Input, Card, Modal } from "./UI";
import { useAuth } from "../contexts/AuthContext";

export default function InventoryMonitoringDashboard() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [inventoryData, vaccinesData, alertsData, suppliersData] =
        await Promise.all([
          apiClient.getVaccineInventory(),
          apiClient.getVaccines(),
          apiClient.getVaccineStockAlerts({ status: "ACTIVE" }),
          apiClient.getSuppliers(),
        ]);

      setInventory(inventoryData);
      setVaccines(vaccinesData);
      setAlerts(alertsData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const getVaccineStats = () => {
    const totalVaccines = inventory.length;
    const criticalStock = alerts.filter(
      (a) => a.alert_type === "CRITICAL_STOCK",
    ).length;
    const lowStock = alerts.filter((a) => a.alert_type === "LOW_STOCK").length;
    const totalStock = inventory.reduce(
      (sum, item) => sum + item.stock_on_hand,
      0,
    );

    return {
      totalVaccines,
      criticalStock,
      lowStock,
      totalStock,
      averageStock:
        totalVaccines > 0 ? Math.round(totalStock / totalVaccines) : 0,
    };
  };

  const getExpiringSoon = () => {
    const today = new Date();
    const thirtyDaysLater = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    return inventory.filter((item) => {
      const expiryDate = new Date(item.expiry_date);
      return expiryDate >= today && expiryDate <= thirtyDaysLater;
    });
  };

  const getTopLowStockVaccines = () => {
    return inventory
      .filter((item) => item.stock_on_hand <= (item.low_stock_threshold || 10))
      .sort((a, b) => a.stock_on_hand - b.stock_on_hand)
      .slice(0, 5);
  };

  if (!isAdmin) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Access Denied
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>
                You do not have permission to access inventory monitoring. This
                feature is restricted to healthcare administrators only.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">Error: {error}</div>
        <Button onClick={fetchDashboardData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const stats = getVaccineStats();
  const expiringSoon = getExpiringSoon();
  const topLowStock = getTopLowStockVaccines();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
          Inventory Monitoring Dashboard
        </h2>
        <div className="flex space-x-3">
          <Button onClick={() => setShowBatchModal(true)}>
            Manage Batches
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowSupplierModal(true)}
          >
            Supplier Management
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Vaccines
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalVaccines}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Critical Stock
              </p>
              <p className="text-2xl font-bold text-red-600">
                {stats.criticalStock}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Low Stock
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.lowStock}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Stock
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalStock}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Section */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Stock Alerts
          </h3>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.alert_type === "CRITICAL_STOCK"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500"
                      : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {alert.vaccine_name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Created: {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          apiClient
                            .acknowledgeVaccineStockAlert(alert.id)
                            .then(fetchDashboardData)
                        }
                        disabled={alert.status === "RESOLVED"}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          apiClient
                            .resolveVaccineStockAlert(alert.id, "Resolved")
                            .then(fetchDashboardData)
                        }
                        disabled={alert.status === "RESOLVED"}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No active alerts
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              Add New Vaccine
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Generate Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Export to Excel
            </Button>
            <Button variant="outline" className="w-full justify-start">
              View Expiry Calendar
            </Button>
          </div>

          {/* Low Stock Summary */}
          {topLowStock.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top Low Stock Items
              </h4>
              <div className="space-y-2">
                {topLowStock.map((item) => {
                  const vaccine = vaccines.find(
                    (v) => v.id === item.vaccine_id,
                  );
                  return (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {vaccine?.name || "Unknown"}
                      </span>
                      <span className="font-medium text-red-600">
                        {item.stock_on_hand} units
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Expiring Soon Section */}
      {expiringSoon.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Expiring Soon (Next 30 Days)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Vaccine
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Batch/Lot
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Expiry Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Stock
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {expiringSoon.map((item) => {
                  const vaccine = vaccines.find(
                    (v) => v.id === item.vaccine_id,
                  );
                  const daysUntilExpiry = Math.ceil(
                    (new Date(item.expiry_date) - new Date()) /
                      (1000 * 60 * 60 * 24),
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {vaccine?.name || "Unknown Vaccine"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {item.lot_batch_number || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(item.expiry_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-yellow-600">
                          {daysUntilExpiry} days left
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {item.stock_on_hand} units
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline">
                          Review
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Batch Management"
      >
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Batch management interface would be implemented here with:
            <ul className="mt-2 text-left list-disc list-inside">
              <li>View all vaccine batches</li>
              <li>Add new batches</li>
              <li>Edit batch information</li>
              <li>Track batch expiry dates</li>
              <li>Manage batch movements</li>
            </ul>
          </div>
          <div className="form-actions-standardized">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowBatchModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="Supplier Management"
      >
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Supplier management interface would be implemented here with:
            <ul className="mt-2 text-left list-disc list-inside">
              <li>View all suppliers</li>
              <li>Add new suppliers</li>
              <li>Manage supplier information</li>
              <li>Track supplier performance</li>
              <li>View supplier history</li>
            </ul>
          </div>
          <div className="form-actions-standardized">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowSupplierModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
