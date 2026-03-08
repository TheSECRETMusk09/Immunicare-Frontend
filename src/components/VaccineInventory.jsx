import React, { useState, useEffect } from "react";
import apiClient from "../utils/api";
import { Button, Input, Modal, Card } from "./UI";
import { useAuth } from "../contexts/AuthContext";

export default function VaccineInventory() {
  const { isAdmin } = useAuth();

  const [vaccineInventory, setVaccineInventory] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [stats, setStats] = useState({
    totalInventory: 0,
    lowStockAlerts: 0,
    criticalStockAlerts: 0,
    recentTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: "",
    end: "",
  });

  const [inventoryForm, setInventoryForm] = useState({
    vaccine_id: "",
    beginning_balance: 0,
    received_during_period: 0,
    lot_batch_number: "",
    transferred_in: 0,
    transferred_out: 0,
    expired_wasted: 0,
    issuance: 0,
    low_stock_threshold: 10,
    critical_stock_threshold: 5,
    period_start: "",
    period_end: "",
  });

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vaccinesData, inventoryData, statsData] = await Promise.all([
        apiClient.getVaccines(),
        apiClient.getVaccineInventory(),
        apiClient.getVaccineInventoryStats(),
      ]);
      setVaccines(vaccinesData);
      setVaccineInventory(inventoryData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = () => {
    setEditingRecord(null);
    setInventoryForm({
      vaccine_id: "",
      beginning_balance: 0,
      received_during_period: 0,
      lot_batch_number: "",
      transferred_in: 0,
      transferred_out: 0,
      expired_wasted: 0,
      issuance: 0,
      low_stock_threshold: 10,
      critical_stock_threshold: 5,
      period_start: "",
      period_end: "",
    });
    setShowModal(true);
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setInventoryForm({
      vaccine_id: record.vaccine_id,
      beginning_balance: record.beginning_balance,
      received_during_period: record.received_during_period,
      lot_batch_number: record.lot_batch_number || "",
      transferred_in: record.transferred_in,
      transferred_out: record.transferred_out,
      expired_wasted: record.expired_wasted,
      issuance: record.issuance,
      low_stock_threshold: record.low_stock_threshold,
      critical_stock_threshold: record.critical_stock_threshold,
      period_start: record.period_start,
      period_end: record.period_end,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await apiClient.updateVaccineInventory(editingRecord.id, inventoryForm);
      } else {
        await apiClient.createVaccineInventory(inventoryForm);
      }
      await fetchData();
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const calculateTotalAvailable = (record) => {
    return record.beginning_balance + record.received_during_period;
  };

  const calculateStockOnHand = (record) => {
    return (
      record.total_available +
      record.transferred_in -
      record.transferred_out -
      record.expired_wasted -
      record.issuance
    );
  };

  const getStockStatus = (record) => {
    const stockOnHand = calculateStockOnHand(record);
    if (stockOnHand <= record.critical_stock_threshold) {
      return {
        status: "Critical",
        color: "text-red-600",
        bgColor: "bg-red-100",
      };
    } else if (stockOnHand <= record.low_stock_threshold) {
      return {
        status: "Low",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      };
    } else {
      return {
        status: "Good",
        color: "text-green-600",
        bgColor: "bg-green-100",
      };
    }
  };

  const filteredInventory = vaccineInventory.filter((record) => {
    const vaccine = vaccines.find((v) => v.id === record.vaccine_id);
    const matchesSearch =
      vaccine?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vaccine?.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPeriod =
      !selectedPeriod.start ||
      !selectedPeriod.end ||
      (record.period_start >= selectedPeriod.start &&
        record.period_end <= selectedPeriod.end);

    return matchesSearch && matchesPeriod;
  });

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
        <Button onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Access Control Check */}
      {!isAdmin && (
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
                  You do not have permission to access vaccine inventory
                  management. This feature is restricted to healthcare
                  administrators only.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Only show content for admin users */}
      {isAdmin && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Vaccine Inventory Management
            </h2>
            <Button onClick={handleAddRecord}>Add Inventory Record</Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Total Records
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalInventory}
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Low Stock Alerts
              </h3>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.lowStockAlerts}
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Critical Stock
              </h3>
              <p className="text-2xl font-bold text-red-600">
                {stats.criticalStockAlerts}
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-500">
                Recent Transactions
              </h3>
              <p className="text-2xl font-bold text-blue-600">
                {stats.recentTransactions}
              </p>
            </Card>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Search vaccines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Input
                type="date"
                label="Period Start"
                value={selectedPeriod.start}
                onChange={(e) =>
                  setSelectedPeriod({
                    ...selectedPeriod,
                    start: e.target.value,
                  })
                }
              />
              <Input
                type="date"
                label="Period End"
                value={selectedPeriod.end}
                onChange={(e) =>
                  setSelectedPeriod({ ...selectedPeriod, end: e.target.value })
                }
              />
            </div>
          </div>

          {/* Inventory Table (Based on ITEMS_vaccines.docx structure) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Vaccine
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      A - Beginning Balance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      B - Received During Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      C - Lot/Batch Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      D - Transferred IN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      E - Transferred OUT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      G - Expired/Wasted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      H - Total Available (B+C)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      I - Issuance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      J - Stock on Hand
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredInventory.map((record) => {
                    const vaccine = vaccines.find(
                      (v) => v.id === record.vaccine_id,
                    );
                    const stockStatus = getStockStatus(record);
                    const totalAvailable = calculateTotalAvailable(record);
                    const stockOnHand = calculateStockOnHand(record);

                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {vaccine?.name || "Unknown Vaccine"}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {vaccine?.code}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.beginning_balance}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.received_during_period}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.lot_batch_number || "-"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.transferred_in}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.transferred_out}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.expired_wasted}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {totalAvailable}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {record.issuance}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                          {stockOnHand}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.bgColor} ${stockStatus.color}`}
                          >
                            {stockStatus.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredInventory.length === 0 && (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No inventory records found.
              </div>
            )}
          </div>

          {/* Modal */}
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={
              editingRecord ? "Edit Inventory Record" : "Add Inventory Record"
            }
            footer={
              <div className="form-actions-standardized">
                <Button variant="cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" form="inventoryForm">
                  {editingRecord ? "Update Record" : "Add Record"}
                </Button>
              </div>
            }
          >
            <form
              id="inventoryForm"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vaccine
                </label>
                <select
                  value={inventoryForm.vaccine_id}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      vaccine_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                >
                  <option value="">Select Vaccine</option>
                  {vaccines.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name} ({vaccine.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Period Start"
                  type="date"
                  value={inventoryForm.period_start}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      period_start: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="Period End"
                  type="date"
                  value={inventoryForm.period_end}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      period_end: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="A - Beginning Balance (Vials/PCS)"
                  type="number"
                  value={inventoryForm.beginning_balance}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      beginning_balance: parseInt(e.target.value),
                    })
                  }
                  required
                />
                <Input
                  label="B - Received During Period (Vials/PCS)"
                  type="number"
                  value={inventoryForm.received_during_period}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      received_during_period: parseInt(e.target.value),
                    })
                  }
                  required
                />
              </div>

              <Input
                label="C - Lot of Batch Number"
                value={inventoryForm.lot_batch_number}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    lot_batch_number: e.target.value,
                  })
                }
              />

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="D - Transferred IN"
                  type="number"
                  value={inventoryForm.transferred_in}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      transferred_in: parseInt(e.target.value),
                    })
                  }
                />
                <Input
                  label="E - Transferred OUT"
                  type="number"
                  value={inventoryForm.transferred_out}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      transferred_out: parseInt(e.target.value),
                    })
                  }
                />
                <Input
                  label="G - Expired/Wasted"
                  type="number"
                  value={inventoryForm.expired_wasted}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      expired_wasted: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <Input
                label="I - Issuance (Vials/PCS)"
                type="number"
                value={inventoryForm.issuance}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    issuance: parseInt(e.target.value),
                  })
                }
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Low Stock Threshold"
                  type="number"
                  value={inventoryForm.low_stock_threshold}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      low_stock_threshold: parseInt(e.target.value),
                    })
                  }
                />
                <Input
                  label="Critical Stock Threshold"
                  type="number"
                  value={inventoryForm.critical_stock_threshold}
                  onChange={(e) =>
                    setInventoryForm({
                      ...inventoryForm,
                      critical_stock_threshold: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
