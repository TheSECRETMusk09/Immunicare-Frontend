import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiClient from "../utils/api";
import { Button, Input, Card, Modal, Badge, Select, Tabs, Tab } from "./UI";
import { useAuth } from "../contexts/AuthContext";

/**
 * Enhanced Inventory Reports Component
 * Implements comprehensive inventory management with:
 * - Inventory items with SKU, categorization, and valuation
 * - Stock alerts (low stock, overstock, expiring)
 * - Stock transactions (receipts, issues, transfers, adjustments)
 * - Supplier management integration
 */
export default function InventoryReports() {
  const { isAdmin, user } = useAuth();

  // Active tab state
  const [activeTab, setActiveTab] = useState("inventory");

  // Data states
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    category: "",
    warehouse: "",
    supplier: "",
    stockStatus: "",
    dateRange: {
      start: new Date(new Date().getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0],
      end: new Date().toISOString().split("T")[0],
    },
  });

  // Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Report type state
  const [reportType, setReportType] = useState("summary");

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        period_start: filters.dateRange.start,
        period_end: filters.dateRange.end,
        category_id: filters.category || undefined,
        warehouse_id: filters.warehouse || undefined,
        supplier_id: filters.supplier || undefined,
      };

      const [
        inventoryData,
        categoriesData,
        warehousesData,
        suppliersData,
        alertsData,
        transactionsData,
      ] = await Promise.all([
        apiClient.getInventoryItems(params),
        apiClient.getInventoryCategories(),
        apiClient.getWarehouses(),
        apiClient.getSuppliers(),
        apiClient.getStockAlerts({ status: "active" }),
        apiClient.getStockTransactions(params),
      ]);

      setInventory(inventoryData || []);
      setCategories(categoriesData || []);
      setWarehouses(warehousesData || []);
      setSuppliers(suppliersData || []);
      setAlerts(alertsData || []);
      setTransactions(transactionsData || []);
    } catch (err) {
      console.error("Error fetching inventory data:", err);
      setError(err.message || "Failed to load inventory data");

      // Set mock data for demo
      setInventory(getMockInventory());
      setCategories(getMockCategories());
      setWarehouses(getMockWarehouses());
      setSuppliers(getMockSuppliers());
      setAlerts(getMockAlerts());
      setTransactions(getMockTransactions());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  // Computed data
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (filters.stockStatus) {
        if (
          filters.stockStatus === "critical" &&
          item.stock_status !== "critical"
        )
          return false;
        if (filters.stockStatus === "low" && item.stock_status !== "low")
          return false;
        if (
          filters.stockStatus === "adequate" &&
          item.stock_status !== "adequate"
        )
          return false;
        if (
          filters.stockStatus === "overstock" &&
          item.stock_status !== "overstock"
        )
          return false;
      }
      return true;
    });
  }, [inventory, filters.stockStatus]);

  const inventoryStats = useMemo(() => {
    const totalItems = filteredInventory.length;
    const totalValue = filteredInventory.reduce(
      (sum, item) => sum + (item.total_value || 0),
      0,
    );
    const criticalCount = filteredInventory.filter(
      (i) => i.stock_status === "critical",
    ).length;
    const lowStockCount = filteredInventory.filter(
      (i) => i.stock_status === "low",
    ).length;
    const overstockCount = filteredInventory.filter(
      (i) => i.stock_status === "overstock",
    ).length;
    const totalQuantity = filteredInventory.reduce(
      (sum, item) => sum + (item.current_stock_level || 0),
      0,
    );

    return {
      totalItems,
      totalValue,
      criticalCount,
      lowStockCount,
      overstockCount,
      totalQuantity,
    };
  }, [filteredInventory]);

  // Export functions
  const exportToCSV = () => {
    const headers = [
      "SKU",
      "Product Name",
      "Category",
      "Current Stock",
      "Unit of Measure",
      "Reorder Point",
      "Unit Cost",
      "Total Value",
      "Warehouse",
      "Supplier",
      "Stock Status",
      "Last Updated",
    ];

    const rows = filteredInventory.map((item) => [
      item.sku || "",
      item.product_name || "",
      item.category_name || "",
      item.current_stock_level || 0,
      item.unit_of_measure || "",
      item.reorder_point || 0,
      item.unit_cost || 0,
      item.total_value || 0,
      item.warehouse_name || "",
      item.supplier_name || "",
      item.stock_status || "",
      item.updated_at || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    downloadFile(csvContent, "inventory_report.csv", "text/csv");
  };

  const exportToPDF = () => {
    alert(
      "PDF export would use jsPDF library with the new inventory schema structure",
    );
  };

  const exportToExcel = () => {
    alert(
      "Excel export would use SheetJS library with multiple sheets for inventory, alerts, and transactions",
    );
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Stock status badge helper
  const getStockStatusBadge = (status) => {
    const variants = {
      critical: {
        color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Critical",
      },
      low: {
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        label: "Low Stock",
      },
      adequate: {
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Adequate",
      },
      overstock: {
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Overstock",
      },
    };
    const variant = variants[status] || variants.adequate;
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${variant.color}`}
      >
        {variant.label}
      </span>
    );
  };

  // Alert severity badge helper
  const getSeverityBadge = (severity) => {
    const variants = {
      critical: {
        color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        icon: "🔴",
      },
      high: {
        color:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
        icon: "🟠",
      },
      medium: {
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        icon: "🟡",
      },
      low: {
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        icon: "🔵",
      },
    };
    const variant = variants[severity] || variants.low;
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${variant.color}`}>
        {variant.icon} {severity?.toUpperCase()}
      </span>
    );
  };

  // Transaction type badge helper
  const getTransactionTypeBadge = (type) => {
    const variants = {
      receipt: {
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Receipt",
      },
      issue: {
        color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Issue",
      },
      transfer: {
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Transfer",
      },
      adjustment: {
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        label: "Adjustment",
      },
      return: {
        color:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
        label: "Return",
      },
    };
    const variant = variants[type] || {
      color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
      label: type,
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${variant.color}`}>
        {variant.label}
      </span>
    );
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
                You do not have permission to access inventory reports. This
                feature is restricted to healthcare administrators only.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Inventory Management Reports
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive inventory tracking, stock alerts, and transaction
            management
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowExportModal(true)}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export Report
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Items
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {inventoryStats.totalItems}
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-full">
              <svg
                className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Value
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ₱{inventoryStats.totalValue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Critical Stock
              </p>
              <p className="text-2xl font-bold text-red-600">
                {inventoryStats.criticalCount}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active Alerts
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {alerts.length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <Select
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Warehouse
            </label>
            <Select
              value={filters.warehouse}
              onChange={(e) =>
                setFilters({ ...filters, warehouse: e.target.value })
              }
            >
              <option value="">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.warehouse_id} value={wh.warehouse_id}>
                  {wh.warehouse_name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stock Status
            </label>
            <Select
              value={filters.stockStatus}
              onChange={(e) =>
                setFilters({ ...filters, stockStatus: e.target.value })
              }
            >
              <option value="">All Status</option>
              <option value="critical">Critical</option>
              <option value="low">Low Stock</option>
              <option value="adequate">Adequate</option>
              <option value="overstock">Overstock</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, start: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, end: e.target.value },
                })
              }
            />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
        <Tab id="inventory" label="Inventory Items" icon="📦">
          {/* Inventory Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Product Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Stock Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Location
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
                  {filteredInventory.map((item) => (
                    <tr
                      key={item.item_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.product_name}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {item.category_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.current_stock_level} {item.unit_of_measure}
                        </div>
                        <div className="text-xs text-gray-500">
                          Reorder: {item.reorder_point}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        ₱{(item.total_value || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {item.warehouse_name || "N/A"}
                        {item.bin_location && (
                          <div className="text-xs">
                            Bin: {item.bin_location}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getStockStatusBadge(item.stock_status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowItemModal(true);
                            }}
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowTransactionModal(true);
                            }}
                          >
                            Transact
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Tab>

        <Tab id="alerts" label="Stock Alerts" icon="🔔">
          {/* Alerts Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Current Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {alerts.map((alert) => (
                    <tr
                      key={alert.alert_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3">
                        {getSeverityBadge(alert.severity_level)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {alert.alert_type?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {alert.alert_title}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {alert.sku}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {alert.current_value}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            alert.alert_status === "active"
                              ? "bg-red-100 text-red-800"
                              : alert.alert_status === "acknowledged"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {alert.alert_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline">
                          {alert.alert_status === "active"
                            ? "Acknowledge"
                            : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Tab>

        <Tab id="transactions" label="Transactions" icon="📋">
          {/* Transactions Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Transaction #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Source / Destination
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.slice(0, 20).map((trans) => (
                    <tr
                      key={trans.transaction_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {trans.transaction_number}
                      </td>
                      <td className="px-4 py-3">
                        {getTransactionTypeBadge(trans.transaction_type)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {trans.product_name}
                        </div>
                        <div className="text-xs text-gray-500">{trans.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {trans.quantity > 0 ? "+" : ""}
                        {trans.quantity} {trans.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {trans.source_warehouse || "N/A"} →{" "}
                        {trans.destination_warehouse || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(trans.transaction_date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            trans.transaction_status === "completed"
                              ? "bg-green-100 text-green-800"
                              : trans.transaction_status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {trans.transaction_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Tab>

        <Tab id="suppliers" label="Suppliers" icon="🏢">
          {/* Suppliers Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Supplier Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Supplier Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Performance Score
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
                  {suppliers.map((supplier) => (
                    <tr
                      key={supplier.supplier_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {supplier.supplier_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {supplier.supplier_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {supplier.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div>{supplier.contact_person}</div>
                        <div>{supplier.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{
                                width: `${supplier.avg_overall_score || 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {supplier.avg_overall_score?.toFixed(1) || "N/A"}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            supplier.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {supplier.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Tab>
      </Tabs>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Options"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                exportToCSV();
                setShowExportModal(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span>Export to CSV</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                exportToExcel();
                setShowExportModal(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span>Export to Excel</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                exportToPDF();
                setShowExportModal(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span>Export to PDF</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                window.print();
                setShowExportModal(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span>Print Report</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
              </div>
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Report Summary
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>
                <strong>Total Items:</strong> {inventoryStats.totalItems}
              </p>
              <p>
                <strong>Total Value:</strong> ₱
                {inventoryStats.totalValue.toLocaleString()}
              </p>
              <p>
                <strong>Critical Items:</strong> {inventoryStats.criticalCount}
              </p>
              <p>
                <strong>Low Stock Items:</strong> {inventoryStats.lowStockCount}
              </p>
            </div>
          </div>

          <div className="form-actions-standardized">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowExportModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Item Details Modal */}
      <Modal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        title="Item Details"
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  SKU
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.sku}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Barcode
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.barcode || "N/A"}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Product Name
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.product_name}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Description
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.description || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Category
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.category_name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Supplier
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.supplier_name || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Current Stock
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.current_stock_level}{" "}
                  {selectedItem.unit_of_measure}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Unit Cost
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  ₱{selectedItem.unit_cost?.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Value
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  ₱{selectedItem.total_value?.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Location
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedItem.warehouse_name} -{" "}
                  {selectedItem.bin_location || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Status
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {getStockStatusBadge(selectedItem.stock_status)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Last Updated
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {new Date(selectedItem.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex justify-center pt-4 border-t">
              <Button
                variant="cancel"
                actionRole="cancel"
                onClick={() => setShowItemModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Mock data functions for demo purposes
function getMockInventory() {
  return [
    {
      item_id: "1",
      sku: "VAC-001",
      product_name: "Pfizer-BioNTech COVID-19 Vaccine",
      description: "COVID-19 mRNA vaccine, 30mcg dose",
      category_name: "Vaccines",
      current_stock_level: 500,
      unit_of_measure: "doses",
      reorder_point: 100,
      unit_cost: 15.5,
      total_value: 7750,
      warehouse_name: "Main Warehouse",
      bin_location: "A-12-3",
      stock_status: "adequate",
      updated_at: new Date().toISOString(),
    },
    {
      item_id: "2",
      sku: "VAC-002",
      product_name: "Influenza Vaccine (Quadrivalent)",
      description: "Seasonal flu vaccine, 2024-2025 strain",
      category_name: "Vaccines",
      current_stock_level: 45,
      unit_of_measure: "doses",
      reorder_point: 50,
      unit_cost: 12.0,
      total_value: 540,
      warehouse_name: "Cold Storage",
      bin_location: "C-01-1",
      stock_status: "low",
      updated_at: new Date().toISOString(),
    },
    {
      item_id: "3",
      sku: "MED-001",
      product_name: "Paracetamol 500mg",
      description: "Analgesic and antipyretic tablets",
      category_name: "Medicines",
      current_stock_level: 5000,
      unit_of_measure: "tablets",
      reorder_point: 1000,
      unit_cost: 0.25,
      total_value: 1250,
      warehouse_name: "Main Warehouse",
      bin_location: "B-05-2",
      stock_status: "adequate",
      updated_at: new Date().toISOString(),
    },
    {
      item_id: "4",
      sku: "SUP-001",
      product_name: "Surgical Face Masks",
      description: "3-ply disposable surgical masks",
      category_name: "Supplies",
      current_stock_level: 3,
      unit_of_measure: "boxes",
      reorder_point: 50,
      unit_cost: 15.0,
      total_value: 45,
      warehouse_name: "Main Warehouse",
      bin_location: "D-01-1",
      stock_status: "critical",
      updated_at: new Date().toISOString(),
    },
    {
      item_id: "5",
      sku: "LAB-001",
      product_name: "COVID-19 Rapid Test Kit",
      description: "Antigen rapid test for COVID-19",
      category_name: "Laboratory",
      current_stock_level: 2000,
      unit_of_measure: "kits",
      reorder_point: 200,
      unit_cost: 5.0,
      total_value: 10000,
      warehouse_name: "Main Warehouse",
      bin_location: "E-03-1",
      stock_status: "adequate",
      updated_at: new Date().toISOString(),
    },
  ];
}

function getMockCategories() {
  return [
    { category_id: "1", category_code: "VACC", category_name: "Vaccines" },
    { category_id: "2", category_code: "MEDS", category_name: "Medicines" },
    { category_id: "3", category_code: "SUPPL", category_name: "Supplies" },
    { category_id: "4", category_code: "LAB", category_name: "Laboratory" },
    { category_id: "5", category_code: "EQUIP", category_name: "Equipment" },
  ];
}

function getMockWarehouses() {
  return [
    {
      warehouse_id: "1",
      warehouse_code: "WH-MAIN",
      warehouse_name: "Main Warehouse",
    },
    {
      warehouse_id: "2",
      warehouse_code: "WH-COLD",
      warehouse_name: "Cold Storage Facility",
    },
    {
      warehouse_id: "3",
      warehouse_code: "WH-SUB",
      warehouse_name: "Satellite Warehouse",
    },
  ];
}

function getMockSuppliers() {
  return [
    {
      supplier_id: "1",
      supplier_code: "SUP-001",
      supplier_name: "PharmaCare Distributors Inc.",
      email: "sales@pharmacare.com",
      phone: "+632-8123-4567",
      contact_person: "John Smith",
      is_active: true,
      avg_overall_score: 92.5,
    },
    {
      supplier_id: "2",
      supplier_code: "SUP-002",
      supplier_name: "Medical Supplies Co.",
      email: "orders@medsupplies.com",
      phone: "+632-8234-5678",
      contact_person: "Jane Doe",
      is_active: true,
      avg_overall_score: 88.0,
    },
  ];
}

function getMockAlerts() {
  return [
    {
      alert_id: "1",
      alert_type: "low_stock",
      severity_level: "critical",
      alert_title: "Critical Stock Level: Surgical Face Masks",
      current_value: 3,
      alert_status: "active",
      sku: "SUP-001",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      alert_id: "2",
      alert_type: "low_stock",
      severity_level: "high",
      alert_title: "Low Stock Warning: Influenza Vaccine",
      current_value: 45,
      alert_status: "active",
      sku: "VAC-002",
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      alert_id: "3",
      alert_type: "expiring",
      severity_level: "medium",
      alert_title: "Expiring Soon: COVID-19 Vaccine Batch",
      current_value: "2024-03-15",
      alert_status: "acknowledged",
      sku: "VAC-001",
      created_at: new Date(Date.now() - 259200000).toISOString(),
    },
  ];
}

function getMockTransactions() {
  return [
    {
      transaction_id: "1",
      transaction_number: "2024-01-REC-000001",
      transaction_type: "receipt",
      product_name: "Pfizer-BioNTech COVID-19 Vaccine",
      sku: "VAC-001",
      quantity: 100,
      unit_of_measure: "doses",
      source_warehouse: "Supplier",
      destination_warehouse: "Main Warehouse",
      transaction_date: new Date(Date.now() - 86400000).toISOString(),
      transaction_status: "completed",
    },
    {
      transaction_id: "2",
      transaction_number: "2024-01-ISS-000001",
      transaction_type: "issue",
      product_name: "Paracetamol 500mg",
      sku: "MED-001",
      quantity: -50,
      unit_of_measure: "tablets",
      source_warehouse: "Main Warehouse",
      destination_warehouse: "Clinic A",
      transaction_date: new Date(Date.now() - 172800000).toISOString(),
      transaction_status: "completed",
    },
    {
      transaction_id: "3",
      transaction_number: "2024-01-TRF-000001",
      transaction_type: "transfer",
      product_name: "Influenza Vaccine",
      sku: "VAC-002",
      quantity: 25,
      unit_of_measure: "doses",
      source_warehouse: "Cold Storage",
      destination_warehouse: "Satellite Warehouse",
      transaction_date: new Date(Date.now() - 259200000).toISOString(),
      transaction_status: "completed",
    },
  ];
}
