import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiClient from "../utils/api";
import { Button, Input, Modal, Card } from "./UI";
import { useAuth } from "../contexts/AuthContext";
import PrintDateRangeControls from "./PrintDateRangeControls";
import usePrintDateRange from "../hooks/usePrintDateRange";
import {
  formatPrintDateRangeLabel,
  formatPrintDateTimeValue,
} from "../utils/printDateRange";
import {
  downloadPdfFromNode,
  downloadWordDocument,
  PRINT_PAGE_PRESETS,
} from "../utils/printDocumentExport";
import { toArrayPayload } from "../utils/adminDataAdapters";

export default function VaccineInventoryLogbook() {
  const { isAdmin } = useAuth();
  const defaultPeriodStart = useMemo(
    () =>
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0],
    [],
  );
  const defaultPeriodEnd = useMemo(
    () => new Date().toISOString().split("T")[0],
    [],
  );
  const [inventory, setInventory] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const printDateRange = usePrintDateRange({
    initialStartDate: defaultPeriodStart,
    initialEndDate: defaultPeriodEnd,
    headerPrefix: "Period",
    fallbackLabel: "All available inventory records",
  });
  const [transactionForm, setTransactionForm] = useState({
    vaccine_id: "",
    transaction_type: "RECEIVE",
    quantity: 0,
    lot_number: "",
    batch_number: "",
    expiry_date: "",
    supplier_name: "",
    reference_number: "",
    notes: "",
  });

  const periodFilter = useMemo(
    () => ({
      start: printDateRange.appliedStartDate,
      end: printDateRange.appliedEndDate,
    }),
    [printDateRange.appliedEndDate, printDateRange.appliedStartDate],
  );

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const inventoryParams = {
        ...(periodFilter.start ? { period_start: periodFilter.start } : {}),
        ...(periodFilter.end ? { period_end: periodFilter.end } : {}),
      };

      const [inventoryData, vaccinesData, alertsData] = await Promise.all([
        apiClient.getVaccineInventory(inventoryParams),
        apiClient.getVaccines(),
        apiClient.getVaccineStockAlerts({
          status: "ACTIVE",
        }),
      ]);

      setInventory(toArrayPayload(inventoryData, ["inventory", "items", "records"]));
      setVaccines(toArrayPayload(vaccinesData, ["vaccines", "items", "records"]));
      setAlerts(toArrayPayload(alertsData, ["alerts", "items", "records"]));
    } catch (err) {
      console.error("Error fetching inventory data:", err);
      setError(err.message || "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [fetchAllData, isAdmin]);

  useEffect(() => {
    const handleSync = () => { if (isAdmin) fetchAllData(); };

    window.addEventListener("vaccination-update", handleSync);
    window.addEventListener("inventory-update", handleSync);

    return () => {
      window.removeEventListener("vaccination-update", handleSync);
      window.removeEventListener("inventory-update", handleSync);
    };
  }, [isAdmin, fetchAllData]);

  const totals = useMemo(
    () =>
      inventory.reduce(
        (accumulator, item) => ({
          beginning_balance:
            accumulator.beginning_balance + (item.beginning_balance || 0),
          received_during_period:
            accumulator.received_during_period +
            (item.received_during_period || 0),
          transferred_in:
            accumulator.transferred_in + (item.transferred_in || 0),
          transferred_out:
            accumulator.transferred_out + (item.transferred_out || 0),
          expired_wasted:
            accumulator.expired_wasted + (item.expired_wasted || 0),
          total_available:
            accumulator.total_available + (item.total_available || 0),
          issuance: accumulator.issuance + (item.issuance || 0),
          stock_on_hand:
            accumulator.stock_on_hand + (item.stock_on_hand || 0),
        }),
        {
          beginning_balance: 0,
          received_during_period: 0,
          transferred_in: 0,
          transferred_out: 0,
          expired_wasted: 0,
          total_available: 0,
          issuance: 0,
          stock_on_hand: 0,
        },
      ),
    [inventory],
  );
  const activePeriodLabel = useMemo(
    () =>
      formatPrintDateRangeLabel({
        startDate: printDateRange.appliedStartDate,
        endDate: printDateRange.appliedEndDate,
        locale: printDateRange.locale,
        timeZone: printDateRange.timeZone,
        prefix: "Period",
        fallbackLabel: "All available inventory records",
      }),
    [
      printDateRange.appliedEndDate,
      printDateRange.appliedStartDate,
      printDateRange.locale,
      printDateRange.timeZone,
    ],
  );

  const getStockStatus = (stockOnHand, criticalThreshold, lowThreshold) => {
    if (stockOnHand <= criticalThreshold) {
      return {
        status: "CRITICAL",
        color: "text-red-600",
        bgColor: "bg-red-100",
      };
    } else if (stockOnHand <= lowThreshold) {
      return {
        status: "LOW",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      };
    } else {
      return {
        status: "GOOD",
        color: "text-green-600",
        bgColor: "bg-green-100",
      };
    }
  };

  // Helper functions for backward compatibility
  // These can be removed if not used elsewhere in the codebase

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.createVaccineInventoryTransaction(transactionForm);
      setShowTransactionModal(false);
      setTransactionForm({
        vaccine_id: "",
        transaction_type: "RECEIVE",
        quantity: 0,
        lot_number: "",
        batch_number: "",
        expiry_date: "",
        supplier_name: "",
        reference_number: "",
        notes: "",
      });
      await fetchAllData(); // Refresh data
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAlertAction = async (alertId, action, notes = "") => {
    try {
      if (action === "acknowledge") {
        await apiClient.acknowledgeVaccineStockAlert(alertId);
      } else if (action === "resolve") {
        await apiClient.resolveVaccineStockAlert(alertId, notes);
      }
      await fetchAllData(); // Refresh data
    } catch (err) {
      setError(err.message);
    }
  };

  const buildPrintableDocument = useCallback(() => {
    const printContent = document.getElementById("vaccine-inventory-print");
    if (!printContent) {
      return "";
    }

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vaccine Inventory Logbook</title>
    <style>
      @page {
        size: legal landscape;
        margin: 10mm;
      }

      body {
        margin: 0;
        padding: 16px;
        font-family: Arial, sans-serif;
        background: #ffffff;
        color: #111827;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th,
      td {
        border: 1px solid #111827;
        padding: 6px 8px;
        font-size: 11px;
        line-height: 1.25;
        vertical-align: middle;
      }

      th {
        background: #f3f4f6;
        font-weight: 700;
        text-align: center;
      }

      td {
        text-align: center;
      }

      td:first-child,
      th:first-child {
        text-align: left;
      }
    </style>
  </head>
  <body>
    ${printContent.outerHTML}
  </body>
</html>`;
  }, []);

  const handlePrint = useCallback(() => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const printableHtml = buildPrintableDocument();
    if (!printableHtml) {
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [buildPrintableDocument, printDateRange]);

  const handleDownload = useCallback(async () => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const printableNode =
      document.querySelector("#vaccine-inventory-print > div") ||
      document.getElementById("vaccine-inventory-print");
    if (!printableNode) {
      return;
    }

    try {
      await downloadPdfFromNode({
        node: printableNode,
        filename: "Vaccine_Inventory_Logbook.pdf",
        title: "Vaccine Inventory Logbook",
        headerText: "Vaccine Inventory Logbook",
        footerText: activePeriodLabel,
        page: PRINT_PAGE_PRESETS.legalLandscape,
        scale: 0.7,
      });
    } catch (downloadError) {
      console.error("Error generating vaccine inventory logbook PDF:", downloadError);
      setError(
        downloadError.message ||
          "Failed to generate the vaccine inventory logbook PDF.",
      );
    }
  }, [activePeriodLabel, printDateRange]);

  const handleDownloadWord = useCallback(() => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const printableHtml = buildPrintableDocument();
    if (!printableHtml) {
      return;
    }

    downloadWordDocument({
      html: printableHtml,
      filename: "Vaccine_Inventory_Logbook.docx",
      title: "Vaccine Inventory Logbook",
      headerText: "Vaccine Inventory Logbook",
      footerText: activePeriodLabel,
      page: PRINT_PAGE_PRESETS.legalLandscape,
    });
  }, [activePeriodLabel, buildPrintableDocument, printDateRange]);

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Insufficient Permissions
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p>
                You do not have permission to access vaccine inventory
                management. Please contact an administrator if you believe this
                is an error.
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
        <Button onClick={fetchAllData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden printable version */}
      <div id="vaccine-inventory-print" className="hidden print:block">
        <div className="bg-white rounded-xl">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800">
              Vaccine Inventory Logbook
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Stock monitoring for Barangay San Nicolas Health Center
            </p>
            <div className="mt-4 text-sm">
              <span className="font-medium">{activePeriodLabel}</span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Generated on{" "}
              {formatPrintDateTimeValue(new Date(), {
                locale: printDateRange.locale,
                timeZone: printDateRange.timeZone,
              })}
            </div>
          </div>

          {/* Inventory Table for Print */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ITEMS
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    BEGINNING BALANCE
                    <br />
                    (VIALS PCS)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RECEIVED DURING THE PERIOD
                    <br />
                    (VIALS PCS)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LOT OF BATCH NUMBER
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TRANSFERRED IN/OUT
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    EXPIRED/WASTED
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TOTAL AVAILABLE
                    <br />
                    (B+C)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ISSUANCE
                    <br />
                    (VIALS PCS)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    STOCK ON HAND AS OF
                    <br />
                    ____________
                    <br />
                    (VIALS PCS)
                    <br />
                    (I+J)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventory.map((item) => {
                  const vaccine = vaccines.find(
                    (v) => v.id === item.vaccine_id,
                  );
                  const stockStatus = getStockStatus(
                    item.stock_on_hand,
                    item.critical_stock_threshold || 5,
                    item.low_stock_threshold || 10,
                  );

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vaccine?.name ||
                            item.vaccine_name ||
                            "Unknown Vaccine"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {item.beginning_balance}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {item.received_during_period}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {item.lot_batch_number || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          <div>{item.transferred_in}</div>
                          <div className="border-t border-gray-300">
                            {item.transferred_out}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {item.expired_wasted}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {item.total_available}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {item.issuance}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div
                          className={`text-sm font-medium ${stockStatus.color}`}
                        >
                          {item.stock_on_hand}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Vaccine Inventory Logbook
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Stock monitoring for Barangay San Nicolas Health Center
              </p>
            </div>
            <div className="flex w-full flex-col gap-4 xl:max-w-[540px]">
              <PrintDateRangeControls
                controller={printDateRange}
                label="Print and Report Date Range"
              />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button onClick={handleDownload} variant="secondary" data-print-action="inventory-logbook-download">
                  📄 Download PDF
                </Button>
                <Button onClick={handleDownloadWord} variant="secondary" data-print-action="inventory-logbook-download-word">
                  Download Word
                </Button>
                <Button onClick={handlePrint} data-print-action="inventory-logbook-print">🖨️ Print</Button>
                <Button onClick={() => setShowTransactionModal(true)}>
                  Add Transaction
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ITEMS
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  BEGINNING BALANCE
                  <br />
                  (VIALS PCS)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  RECEIVED DURING THE PERIOD
                  <br />
                  (VIALS PCS)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  LOT OF BATCH NUMBER
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  TRANSFERRED IN/OUT
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  EXPIRED/WASTED
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  TOTAL AVAILABLE
                  <br />
                  (B+C)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ISSUANCE
                  <br />
                  (VIALS PCS)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  STOCK ON HAND AS OF
                  <br />
                  ____________
                  <br />
                  (VIALS PCS)
                  <br />
                  (I+J)
                </th>
              </tr>
              <tr>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  A
                </th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  B
                </th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  <div>IN</div>
                  <div className="border-t border-gray-300 dark:border-gray-600">
                    OUT
                  </div>
                </th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  E
                </th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  G
                </th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  H
                </th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">
                  K
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {inventory.map((item) => {
                const vaccine = vaccines.find((v) => v.id === item.vaccine_id);
                const stockStatus = getStockStatus(
                  item.stock_on_hand,
                  item.critical_stock_threshold || 5,
                  item.low_stock_threshold || 10,
                );

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {vaccine?.name ||
                          item.vaccine_name ||
                          "Unknown Vaccine"}
                      </div>
                      {vaccine?.code && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {vaccine.code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.beginning_balance}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.received_during_period}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.lot_batch_number || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        <div>{item.transferred_in}</div>
                        <div className="border-t border-gray-300 dark:border-gray-600">
                          {item.transferred_out}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.expired_wasted}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.total_available}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.issuance}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div
                        className={`text-sm font-medium ${stockStatus.color}`}
                      >
                        {item.stock_on_hand}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Totals Row */}
              <tr className="bg-gray-50 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    TOTAL
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {totals.beginning_balance}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {totals.received_during_period}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    -
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    <div>{totals.transferred_in}</div>
                    <div className="border-t border-gray-300 dark:border-gray-600">
                      {totals.transferred_out}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {totals.expired_wasted}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {totals.total_available}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {totals.issuance}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div
                    className={`text-sm font-bold ${
                      totals.stock_on_hand < 500
                        ? "text-red-600"
                        : totals.stock_on_hand < 1000
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {totals.stock_on_hand}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Stock Alerts Section */}
        {alerts.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-yellow-400 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Active Stock Alerts
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {alerts.length} vaccine(s) need attention
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowAlertModal(true)}
              >
                View All Alerts
              </Button>
            </div>
          </div>
        )}

        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">{activePeriodLabel}</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span>Good Stock</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span>Low Stock</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span>Critical</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      <Modal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        title="Add Inventory Transaction"
        footer={
          <div className="form-actions-standardized">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowTransactionModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" actionRole="primary" form="transactionForm">
              Add Transaction
            </Button>
          </div>
        }
      >
        <form
          id="transactionForm"
          onSubmit={handleTransactionSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vaccine
            </label>
            <select
              value={transactionForm.vaccine_id}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transaction Type
              </label>
              <select
                value={transactionForm.transaction_type}
                onChange={(e) =>
                  setTransactionForm({
                    ...transactionForm,
                    transaction_type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                required
              >
                <option value="RECEIVE">Receive</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
                <option value="ISSUE">Issue</option>
                <option value="EXPIRE">Expire</option>
                <option value="WASTE">Waste</option>
                <option value="ADJUST">Adjust</option>
              </select>
            </div>
            <Input
              label="Quantity"
              type="number"
              value={transactionForm.quantity}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  quantity: parseInt(e.target.value),
                })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Lot Number"
              value={transactionForm.lot_number}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  lot_number: e.target.value,
                })
              }
            />
            <Input
              label="Batch Number"
              value={transactionForm.batch_number}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  batch_number: e.target.value,
                })
              }
            />
          </div>

          <Input
            label="Expiry Date"
            type="date"
            value={transactionForm.expiry_date}
            onChange={(e) =>
              setTransactionForm({
                ...transactionForm,
                expiry_date: e.target.value,
              })
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier Name"
              value={transactionForm.supplier_name}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  supplier_name: e.target.value,
                })
              }
            />
            <Input
              label="Reference Number"
              value={transactionForm.reference_number}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  reference_number: e.target.value,
                })
              }
            />
          </div>

          <Input
            label="Notes"
            value={transactionForm.notes}
            onChange={(e) =>
              setTransactionForm({
                ...transactionForm,
                notes: e.target.value,
              })
            }
            multiline
            rows={3}
          />
        </form>
      </Modal>

      {/* Alerts Modal */}
      <Modal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title="Stock Alerts"
        size="lg"
      >
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      alert.alert_type === "CRITICAL_STOCK"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                  ></div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {alert.vaccine_name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {alert.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Created: {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAlertAction(alert.id, "acknowledge")}
                    disabled={
                      alert.status === "ACKNOWLEDGED" ||
                      alert.status === "RESOLVED"
                    }
                  >
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleAlertAction(
                        alert.id,
                        "resolve",
                        "Stock replenished",
                      )
                    }
                    disabled={alert.status === "RESOLVED"}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {alerts.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No active alerts
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
