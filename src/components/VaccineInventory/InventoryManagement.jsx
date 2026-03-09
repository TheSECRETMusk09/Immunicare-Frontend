import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Modal, Input, Select } from "../UI";
import {
  AlertTriangle,
  TrendingUp,
  Package,
  Calendar,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Upload,
} from "lucide-react";
import { useInventory } from "../../hooks/useInventory";

export const InventoryManagement = () => {
  const {
    inventory,
    lowStockAlerts,
    expiryAlerts,
    loading,
    error,
    addStock,
    updateStock,
    deleteStock,
    transferStock,
    getInventoryReport,
  } = useInventory();

  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalType, setModalType] = useState("add"); // 'add', 'edit', 'transfer'
  const [formData, setFormData] = useState({
    vaccineName: "",
    batchNumber: "",
    quantity: "",
    expiryDate: "",
    supplier: "",
    costPerUnit: "",
    storageLocation: "",
    temperature: "",
  });

  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    // Initial load handled by hook
  }, []);

  const handleAddStock = () => {
    setModalType("add");
    setIsEditing(false);
    setFormData({
      vaccineName: "",
      batchNumber: "",
      quantity: "",
      expiryDate: "",
      supplier: "",
      costPerUnit: "",
      storageLocation: "",
      temperature: "",
    });
    setShowModal(true);
  };

  const handleEditStock = (vaccine) => {
    setModalType("edit");
    setIsEditing(true);
    setSelectedVaccine(vaccine);
    setFormData({
      vaccineName: vaccine.name,
      batchNumber: vaccine.batchNumber,
      quantity: vaccine.quantity,
      expiryDate: vaccine.expiryDate,
      supplier: vaccine.supplier,
      costPerUnit: vaccine.costPerUnit,
      storageLocation: vaccine.storageLocation,
      temperature: vaccine.temperature,
    });
    setShowModal(true);
  };

  const handleTransferStock = (vaccine) => {
    setModalType("transfer");
    setSelectedVaccine(vaccine);
    setFormData({
      fromLocation: vaccine.storageLocation,
      toLocation: "",
      quantity: "",
      reason: "",
    });
    setShowModal(true);
  };

  const handleSaveStock = async () => {
    if (modalType === "add") {
      await addStock(formData);
    } else if (modalType === "edit") {
      await updateStock(selectedVaccine.id, formData);
    }
    setShowModal(false);
  };

  const getStockStatus = (vaccine) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(vaccine.expiryDate) - new Date()) / (1000 * 60 * 60 * 24),
    );

    if (vaccine.quantity <= vaccine.minLevel) return "danger";
    if (vaccine.quantity <= vaccine.reorderLevel) return "warning";
    if (daysUntilExpiry <= 30) return "warning";
    if (daysUntilExpiry <= 7) return "danger";
    return "success";
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const days = Math.ceil(
      (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) return "Expired";
    if (days === 0) return "Expires Today";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  const InventoryOverview = () => (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Critical Alerts
              </p>
              <p className="text-2xl font-bold text-red-600">
                {lowStockAlerts.length}
              </p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-500 opacity-50" />
          </div>
        </Card>

        <Card className="border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-yellow-600">
                {expiryAlerts.length}
              </p>
            </div>
            <Calendar className="w-12 h-12 text-yellow-500 opacity-50" />
          </div>
        </Card>

        <Card className="border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-blue-600">
                ₱
                {inventory
                  .reduce(
                    (total, item) => total + item.quantity * item.costPerUnit,
                    0,
                  )
                  .toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card title="Current Inventory Status">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vaccine
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventory.map((vaccine) => (
                <tr key={vaccine.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {vaccine.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {vaccine.manufacturer}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vaccine.batchNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {vaccine.quantity} vials
                    </div>
                    <div className="text-xs text-gray-500">
                      Min: {vaccine.minLevel} | Reorder: {vaccine.reorderLevel}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getStockStatus(vaccine)}>
                      {getStockStatus(vaccine) === "danger"
                        ? "Critical"
                        : getStockStatus(vaccine) === "warning"
                          ? "Warning"
                          : "Good"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getDaysUntilExpiry(vaccine.expiryDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vaccine.storageLocation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditStock(vaccine)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTransferStock(vaccine)}
                    >
                      Transfer
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteStock(vaccine.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const LowStockAlerts = () => (
    <Card title="Low Stock Alerts">
      <div className="space-y-4">
        {lowStockAlerts.map((alert, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
          >
            <div className="flex items-center space-x-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <h4 className="font-semibold text-red-900">
                  {alert.vaccineName}
                </h4>
                <p className="text-sm text-red-600">
                  Current: {alert.currentStock} | Minimum: {alert.minLevel}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="danger" size="sm">
                Order Now
              </Button>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          </div>
        ))}
        {lowStockAlerts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No low stock alerts at this time
          </div>
        )}
      </div>
    </Card>
  );

  const ExpiryAlerts = () => (
    <Card title="Expiry Alerts">
      <div className="space-y-4">
        {expiryAlerts.map((alert, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 border border-yellow-200 rounded-lg bg-yellow-50"
          >
            <div className="flex items-center space-x-4">
              <Calendar className="w-8 h-8 text-yellow-500" />
              <div>
                <h4 className="font-semibold text-yellow-900">
                  {alert.vaccineName}
                </h4>
                <p className="text-sm text-yellow-600">
                  Expires: {alert.expiryDate} | Days Left: {alert.daysLeft}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="warning" size="sm">
                Use First
              </Button>
              <Button variant="outline" size="sm">
                Transfer
              </Button>
            </div>
          </div>
        ))}
        {expiryAlerts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No expiry alerts at this time
          </div>
        )}
      </div>
    </Card>
  );

  const StockTransactions = () => (
    <Card title="Recent Stock Transactions">
      <div className="space-y-4">
        {/* This would be populated with actual transaction data */}
        <div className="text-center py-8 text-gray-500">
          Stock transaction history will be displayed here
        </div>
      </div>
    </Card>
  );

  return (
    <div className="inventory-management space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Vaccine Inventory Management
          </h1>
          <p className="text-gray-600 mt-1">
            Automated stock alerts, batch tracking, and expiration monitoring
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => getInventoryReport()}>
            <Download className="w-5 h-5 mr-2" />
            Export Report
          </Button>
          <Button variant="primary" onClick={handleAddStock}>
            <Plus className="w-5 h-5 mr-2" />
            Add Stock
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "overview"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("low-stock")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "low-stock"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Low Stock Alerts ({lowStockAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab("expiry")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "expiry"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Expiry Alerts ({expiryAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "transactions"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Transactions
          </button>
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === "overview" && <InventoryOverview />}
      {activeTab === "low-stock" && <LowStockAlerts />}
      {activeTab === "expiry" && <ExpiryAlerts />}
      {activeTab === "transactions" && <StockTransactions />}

      {/* Stock Management Modal */}
      {showModal && (
        <Modal
          title={
            modalType === "add"
              ? "Add New Stock"
              : modalType === "edit"
                ? "Edit Stock"
                : "Transfer Stock"
          }
          onClose={() => setShowModal(false)}
          size="md"
        >
          {modalType !== "transfer" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Vaccine Name"
                  value={formData.vaccineName}
                  onChange={(e) =>
                    setFormData({ ...formData, vaccineName: e.target.value })
                  }
                  options={[
                    { value: "BCG", label: "BCG (Tuberculosis)" },
                    { value: "Hepatitis B", label: "Hepatitis B" },
                    {
                      value: "Pentavalent",
                      label: "Pentavalent (DPT-HepB-HIB)",
                    },
                    { value: "OPV", label: "OPV (Oral Polio)" },
                    { value: "IPV", label: "IPV (Inactivated Polio)" },
                    { value: "PCV", label: "PCV (Pneumococcal)" },
                    { value: "MMR", label: "MMR (Measles, Mumps, Rubella)" },
                  ]}
                  required
                />
                <Input
                  label="Batch Number"
                  value={formData.batchNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, batchNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  required
                />
                <Input
                  label="Expiry Date"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Supplier"
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                />
                <Input
                  label="Cost per Unit"
                  type="number"
                  value={formData.costPerUnit}
                  onChange={(e) =>
                    setFormData({ ...formData, costPerUnit: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Storage Location"
                  value={formData.storageLocation}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storageLocation: e.target.value,
                    })
                  }
                />
                <Input
                  label="Storage Temperature"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData({ ...formData, temperature: e.target.value })
                  }
                  placeholder="2-8°C"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Transfer Details</h4>
                <p>
                  <strong>From:</strong> {formData.fromLocation}
                </p>
                <p>
                  <strong>Vaccine:</strong> {selectedVaccine?.name}
                </p>
                <p>
                  <strong>Available:</strong> {selectedVaccine?.quantity} vials
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="To Location"
                  value={formData.toLocation}
                  onChange={(e) =>
                    setFormData({ ...formData, toLocation: e.target.value })
                  }
                  required
                />
                <Input
                  label="Quantity to Transfer"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  required
                />
              </div>
              <Input
                label="Transfer Reason"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                placeholder="e.g., Redistribution, Emergency supply"
              />
            </div>
          )}

          <div className="form-actions-standardized">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              actionRole="primary"
              onClick={handleSaveStock}
              disabled={
                modalType === "transfer" &&
                !formData.toLocation &&
                !formData.quantity
              }
            >
              {modalType === "add"
                ? "Add Stock"
                : modalType === "edit"
                  ? "Update Stock"
                  : "Transfer Stock"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
