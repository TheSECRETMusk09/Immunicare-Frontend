import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import { Card, LoadingSpinner, Alert, Button } from "./UI";

export default function StockTransactions() {
  const { isAdmin } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getStockTransactions({});
      setTransactions(data || []);
    } catch (err) {
      setError(err.message || "Failed to load stock transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchTransactions();
  }, [isAdmin, fetchTransactions]);

  useEffect(() => {
    const handleSync = () => { if (isAdmin) fetchTransactions(); };

    window.addEventListener("vaccination-update", handleSync);
    window.addEventListener("inventory-update", handleSync);

    return () => {
      window.removeEventListener("vaccination-update", handleSync);
      window.removeEventListener("inventory-update", handleSync);
    };
  }, [isAdmin, fetchTransactions]);

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <div className="space-y-6">
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
                  You do not have permission to access stock transactions. This
                  feature is restricted to healthcare administrators only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getTransactionTypeBadge = (type) => {
    const variants = {
      receipt: { color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400", label: "Receipt" },
      issue: { color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400", label: "Issue" },
      transfer: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400", label: "Transfer" },
      adjustment: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400", label: "Adjustment" },
      return: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400", label: "Return" },
    };
    const variant = variants[type] || { color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400", label: type };
    return <span className={`px-2 py-0.5 text-xs rounded ${variant.color}`}>{variant.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
          Stock Transactions
        </h2>
        <Button onClick={fetchTransactions} variant="outline">Refresh</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center p-8"><LoadingSpinner /></div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Transaction #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Source / Destination</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No transactions recorded.
                    </td>
                  </tr>
                ) : transactions.map(trans => (
                  <tr key={trans.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">{trans.transaction_number}</td>
                    <td className="px-4 py-3">{getTransactionTypeBadge(trans.transaction_type)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{trans.product_name}</div>
                      <div className="text-xs text-gray-500">{trans.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {trans.quantity > 0 ? "+" : ""}{trans.quantity} {trans.unit_of_measure}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {trans.source_warehouse || "N/A"} → {trans.destination_warehouse || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(trans.transaction_date).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${trans.transaction_status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"}`}>
                        {trans.transaction_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
