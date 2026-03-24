import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";
import { Button, Card } from "./UI";
import { useAuth } from "../contexts/AuthContext";

export default function InventoryMonitoringDashboard() {
  const { isAdmin, user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const clinicId = user?.clinic_id || user?.facility_id || 1;
      const [inventoryRes, vaccinesRes, alertsRes] =
        await Promise.all([
          apiClient.getVaccineInventory().catch(() => ({ data: [] })),
          apiClient.getVaccines().catch(() => ({ data: [] })),
          apiClient.getVaccineStockAlerts({ clinic_id: clinicId, status: "ACTIVE" }).catch(() => ({ data: [] })),
        ]);

      const inventoryList = inventoryRes?.data || inventoryRes?.inventory || inventoryRes || [];
      const vaccinesList = vaccinesRes?.data || vaccinesRes || [];
      const alertsList = alertsRes?.data || alertsRes || [];

      setInventory(inventoryList);
      setVaccines(vaccinesList);

      // Synchronize alerts with actual current inventory data
      const synchronizedAlerts = alertsList.filter((alert) => {
        const invItem = inventoryList.find((i) => i.id === alert.vaccine_inventory_id);
        if (!invItem) return true;

        const currentStock = Number(invItem.stock_on_hand || 0);
        if (alert.alert_type === "OUT_OF_STOCK" || alert.alert_type === "CRITICAL_STOCK") {
          return currentStock === 0;
        }
        if (alert.alert_type === "LOW_STOCK") {
          return currentStock > 0 && currentStock <= (invItem.low_stock_threshold || 10);
        }
        return true;
      });

      setAlerts(synchronizedAlerts);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user?.clinic_id, user?.facility_id]);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin, fetchDashboardData]);

  const getVaccineStats = () => {
    const totalVaccines = inventory.length;
    const criticalStock = alerts.filter(
      (a) => a.alert_type === "CRITICAL_STOCK" || a.alert_type === "OUT_OF_STOCK",
    ).length;
    const lowStock = alerts.filter((a) => a.alert_type === "LOW_STOCK").length;
    const totalStock = inventory.reduce(
      (sum, item) => sum + (Number(item.stock_on_hand) || 0),
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
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading monitoring data...</p>
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

  return (
    <div className="space-y-4">
      {/* Action Controls */}
      <div className="flex justify-end items-center mb-2">
        <div className="flex gap-2">
          {/* Suppressed unimplemented placeholder modals
          <Button size="sm" onClick={() => setShowBatchModal(true)} className="transition-none">
            Manage Batches
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowSupplierModal(true)}
            className="transition-none"
          >
            Supplier Management
          </Button>
          */}
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
      <div className="grid grid-cols-1 gap-6">
        {/* Alerts Section */}
        <Card className="p-6">
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
                        className="transition-none"
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
                        className="transition-none"
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
                        <Button size="sm" variant="outline" className="transition-none">
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
      {/*
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
              className="transition-none"
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
              className="transition-none"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
      */}
    </div>
  );
}
