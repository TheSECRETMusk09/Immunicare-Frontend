import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../utils/api";
import {
  Card,
  Badge,
  Button,
  PageHeader,
  DataTable,
  Alert,
  LoadingSpinner,
  EmptyState,
} from "../components/UI";
import InjectVaccineModal from "../components/InjectVaccineModal";
import useVaccinationSocket from "../hooks/useVaccinationSocket";
import useInventorySocket from "../hooks/useInventorySocket";
import {
  normalizeVaccinesResponse,
  normalizeVaccinationRecordsResponse,
  normalizeVaccineInventoryResponse,
  normalizeVaccineInventoryTransactionsResponse,
  normalizeVaccineStockAlertsResponse,
  computeVaccinationRecordStats,
} from "../utils/adminDataAdapters";
import {
  Syringe,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowDownUp,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const pollingIntervalMs = 60000;

const VaccineTracking = () => {
  const { user } = useAuth();
  const scopedClinicId = user?.clinic_id || user?.facility_id || null;
  const [vaccines, setVaccines] = useState([]);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [activeTab, setActiveTab] = useState("tracking");
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState(null);

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const [vaccinesData, recordsData, inventoryData, transactionsData, alertsData] =
          await Promise.all([
            apiClient.getVaccines(),
            apiClient.getVaccinationRecords(),
            apiClient.getVaccineInventory({
              ...(scopedClinicId ? { clinic_id: scopedClinicId } : {}),
            }),
            apiClient.getVaccineInventoryTransactions(null, {
              ...(scopedClinicId ? { clinic_id: scopedClinicId } : {}),
            }),
            apiClient.getVaccineStockAlerts({
              status: "ACTIVE",
              ...(scopedClinicId ? { clinic_id: scopedClinicId } : {}),
            }),
          ]);

        setVaccines(normalizeVaccinesResponse(vaccinesData));
        setVaccinationRecords(normalizeVaccinationRecordsResponse(recordsData));
        setInventory(normalizeVaccineInventoryResponse(inventoryData));
        setTransactions(normalizeVaccineInventoryTransactionsResponse(transactionsData));
        setAlerts(normalizeVaccineStockAlertsResponse(alertsData));
      } catch (err) {
        console.error("Error fetching vaccine tracking data:", err);
        setError(err.message || "Failed to fetch vaccine tracking data.");
        setVaccines([]);
        setVaccinationRecords([]);
        setInventory([]);
        setTransactions([]);
        setAlerts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scopedClinicId],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchData({ silent: true });
    }, pollingIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [fetchData]);

  useVaccinationSocket({
    setVaccinations: setVaccinationRecords,
    onChange: () => {
      void fetchData({ silent: true });
    },
  });

  useInventorySocket({
    setVaccineInventory: setInventory,
    setVaccineTransactions: setTransactions,
    setStockAlerts: setAlerts,
    onChange: () => {
      void fetchData({ silent: true });
    },
  });

  const stats = useMemo(() => {
    const vaccinationStats = computeVaccinationRecordStats(vaccinationRecords);

    const pendingSchedules = vaccinationRecords.filter(
      (record) => (record.status || "pending") === "pending" && !record.admin_date,
    ).length;

    const lowStockCount = inventory.filter((item) => item.is_low_stock).length;

    const recentMovements = transactions.filter((transaction) => {
      if (!transaction.created_at) return false;
      const createdAt = new Date(transaction.created_at);
      if (Number.isNaN(createdAt.getTime())) return false;
      const diffMs = Date.now() - createdAt.getTime();
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      totalAdministered: vaccinationStats.completed,
      pendingSchedules,
      recentMovements,
      lowStockCount,
      overdue: vaccinationStats.overdue,
    };
  }, [vaccinationRecords, inventory, transactions]);

  const movementRows = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 25)
      .map((transaction) => ({
        ...transaction,
        created_display: transaction.created_at
          ? new Date(transaction.created_at).toLocaleString()
          : "-",
      }));
  }, [transactions]);

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      setAcknowledgingAlertId(alertId);
      await apiClient.acknowledgeVaccineStockAlert(alertId);
      await fetchData({ silent: true });
    } catch (err) {
      setError(err.message || "Failed to acknowledge stock alert.");
    } finally {
      setAcknowledgingAlertId(null);
    }
  };

  const handleInjectSuccess = () => {
    setShowInjectModal(false);
    void fetchData({ silent: true });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading vaccine tracking data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Alert variant="error" title="Error loading vaccine data">
          {error}
          <div className="mt-4">
            <Button onClick={() => void fetchData()} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="Vaccine Tracking"
        subtitle="Track vaccine inventory, movements, alerts, and recorded vaccinations from live backend data"
        icon={Syringe}
        actions={
          <Button
            onClick={() => setShowInjectModal(true)}
            className="flex items-center gap-2"
          >
            <Syringe className="w-4 h-4" /> Record Vaccination
          </Button>
        }
      />

      {refreshing && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Synchronizing latest records...
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 text-center border-l-4 border-l-blue-500">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mx-auto mb-4">
            <Syringe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalAdministered}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Vaccinations</p>
        </Card>

        <Card className="p-6 text-center border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mx-auto mb-4">
            <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.pendingSchedules}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Pending Schedules</p>
        </Card>

        <Card className="p-6 text-center border-l-4 border-l-purple-500">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mx-auto mb-4">
            <ArrowDownUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.recentMovements}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Movements (7 days)</p>
        </Card>

        <Card className="p-6 text-center border-l-4 border-l-red-500">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.lowStockCount}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock Alerts</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          {
            id: "tracking",
            label: "Inventory Tracking",
            icon: <Package className="w-4 h-4" />,
          },
          {
            id: "movements",
            label: "Stock Movements",
            icon: <ArrowDownUp className="w-4 h-4" />,
          },
          {
            id: "alerts",
            label: "Active Alerts",
            icon: <AlertTriangle className="w-4 h-4" />,
          },
          {
            id: "history",
            label: "Vaccination History",
            icon: <BarChart3 className="w-4 h-4" />,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === tab.id
                ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "tracking" && (
        <div className="space-y-6">
          <Card title="Current Inventory Status">
            {inventory.length === 0 ? (
              <EmptyState
                title="No inventory records"
                description="No vaccine inventory records were returned by the backend."
                icon="📦"
                className="border-none shadow-none py-10"
              />
            ) : (
              <DataTable
                data={inventory}
                columns={[
                  { key: "vaccine_name", label: "Vaccine" },
                  { key: "vaccine_code", label: "Code" },
                  {
                    key: "stock_on_hand",
                    label: "Stock On Hand",
                    render: (value) => <span>{value ?? 0}</span>,
                  },
                  {
                    key: "facility_name",
                    label: "Facility",
                    render: (value) => value || "-",
                  },
                  {
                    key: "status",
                    label: "Stock Status",
                    render: (_v, row) => (
                      <Badge
                        variant={
                          row.is_critical_stock
                            ? "danger"
                            : row.is_low_stock
                              ? "warning"
                              : "success"
                        }
                      >
                        {row.is_critical_stock
                          ? "Critical"
                          : row.is_low_stock
                            ? "Low"
                            : "Healthy"}
                      </Badge>
                    ),
                  },
                ]}
                emptyMessage="No inventory data found."
                emptyIcon={<Package className="w-8 h-8" />}
              />
            )}
          </Card>
        </div>
      )}

      {activeTab === "movements" && (
        <Card title="Recent Stock Movements">
          {movementRows.length === 0 ? (
            <EmptyState
              title="No stock movement transactions"
              description="No inventory movements are available from the backend."
              icon="🔄"
              className="border-none shadow-none py-10"
            />
          ) : (
            <DataTable
              data={movementRows}
              columns={[
                { key: "created_display", label: "Date/Time" },
                { key: "vaccine_name", label: "Vaccine" },
                { key: "transaction_type", label: "Type" },
                { key: "quantity", label: "Quantity" },
                { key: "previous_balance", label: "Previous Balance" },
                { key: "new_balance", label: "New Balance" },
              ]}
              emptyMessage="No movement history found."
              emptyIcon={<ArrowDownUp className="w-8 h-8" />}
            />
          )}
        </Card>
      )}

      {activeTab === "alerts" && (
        <Card title="Active Stock Alerts">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-green-600 dark:text-green-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-2" />
              <p>All vaccine stock levels are currently healthy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {alert.vaccine_name || "Vaccine"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {alert.message || "Stock alert"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.priority === "URGENT" ? "danger" : "warning"}>
                      {alert.alert_type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleAcknowledgeAlert(alert.id)}
                      disabled={acknowledgingAlertId === alert.id}
                    >
                      {acknowledgingAlertId === alert.id ? "Saving..." : "Acknowledge"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "history" && (
        <Card title="Vaccination History">
          <DataTable
            data={vaccinationRecords}
            columns={[
              { key: "vaccine_name", label: "Vaccine" },
              { key: "infant_name", label: "Infant" },
              { key: "date_administered", label: "Date", type: "date" },
              { key: "dose_number", label: "Dose" },
              {
                key: "status",
                label: "Status",
                render: (value, row) => value || (row.admin_date ? "completed" : "pending"),
              },
            ]}
            emptyMessage="No vaccination records found."
            emptyIcon={<Syringe className="w-8 h-8" />}
          />
        </Card>
      )}

      <div className="fixed bottom-6 right-6">
        <Button
          onClick={() => setShowInjectModal(true)}
          className="flex items-center gap-2 shadow-lg"
          size="lg"
        >
          <Syringe className="w-5 h-5" /> Record Vaccination
        </Button>
      </div>

      <InjectVaccineModal
        isOpen={showInjectModal}
        onClose={() => setShowInjectModal(false)}
        onSuccess={handleInjectSuccess}
      />
    </div>
  );
};

export default VaccineTracking;
