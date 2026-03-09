import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../utils/api";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";
import {
  AdminModalActions,
  Button,
  Input,
  Modal,
  Card,
  PageHeader,
  Alert,
  LoadingSpinner,
} from "../components/UI";
import {
  hasFieldErrors,
  sanitizeText,
  validateDate,
  validateLength,
  validateNumberRange,
} from "../utils/adminFormValidation";

/**
 * Paper Configuration Inventory Management Component
 * Implements the layout from INVENTORY SHEET.docx with:
 * - Tab-based navigation only (no sub-navigations)
 * - Paper configuration layout for vaccinations
 * - Downloadable reports (CSV, PDF, Print)
 * - Improved stock alerts for used/unused vaccines and wasted vaccines
 */

const INVENTORY_TAB_CONFIG = [
  { key: "inventory_sheet", label: "Inventory Sheet" },
  { key: "stock_alerts", label: "Stock Alerts" },
  { key: "reports", label: "Reports" },
];

const INVENTORY_DEFAULT_TAB_KEY = INVENTORY_TAB_CONFIG[0].key;
const INVENTORY_TAB_STORAGE_KEY = "admin.inventory.activeTab";

const INVENTORY_TAB_ALIASES = {
  inventory_sheet: "inventory_sheet",
  "inventory-sheet": "inventory_sheet",
  transactions: "inventory_sheet",
  suppliers: "inventory_sheet",
  stock_alerts: "stock_alerts",
  "stock-alerts": "stock_alerts",
  alerts: "stock_alerts",
  reports: "reports",
};

const normalizeInventoryTabKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  return INVENTORY_TAB_ALIASES[normalized] || null;
};

const getStoredInventoryTabKey = () => {
  const sessionTab = normalizeInventoryTabKey(
    safeSessionStorage.getItem(INVENTORY_TAB_STORAGE_KEY),
  );
  if (sessionTab) {
    return sessionTab;
  }

  return normalizeInventoryTabKey(
    safeLocalStorage.getItem(INVENTORY_TAB_STORAGE_KEY),
  );
};

const persistInventoryTabKey = (tabKey) => {
  const normalized = normalizeInventoryTabKey(tabKey);
  if (!normalized) {
    return;
  }

  safeSessionStorage.setItem(INVENTORY_TAB_STORAGE_KEY, normalized);
  safeLocalStorage.setItem(INVENTORY_TAB_STORAGE_KEY, normalized);
};

const DEFAULT_PRINT_HEADER = {
  healthCenter: "IMMUNICARE HEALTH CENTER",
  barangay: "BARANGAY SAN NICOLAS",
  city: "PASIG CITY",
};

const formatInventoryMonthYear = (reportDate) => {
  const parsedDate = reportDate
    ? new Date(`${reportDate}T00:00:00`)
    : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return safeDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const buildInventoryPrintRows = (inventoryRows) =>
  inventoryRows.map((item, index) => {
    const beginningBalance = Number(item.beginning_balance || 0);
    const received = Number(item.received || 0);
    const transferredIn = Number(item.transferred_in || 0);
    const transferredOut = Number(item.transferred_out || 0);
    const expiredWasted = Number(item.expired_wasted || 0);
    const issued = Number(item.issuance || 0);
    const totalAvailable = beginningBalance + received;
    const stockOnHand =
      totalAvailable + transferredIn - transferredOut - expiredWasted - issued;

    return {
      id: item.id,
      rowNumber: index + 1,
      itemName: item.name,
      beginningBalance,
      received,
      lotBatchNumber: String(item.lot_batch_number || "").trim() || "---",
      transferredIn,
      transferredOut,
      expiredWasted,
      totalAvailable,
      issued,
      stockOnHand,
    };
  });

const buildInventoryPrintTotals = (rows) =>
  rows.reduce(
    (acc, row) => ({
      beginningBalance: acc.beginningBalance + row.beginningBalance,
      received: acc.received + row.received,
      transferredIn: acc.transferredIn + row.transferredIn,
      transferredOut: acc.transferredOut + row.transferredOut,
      expiredWasted: acc.expiredWasted + row.expiredWasted,
      totalAvailable: acc.totalAvailable + row.totalAvailable,
      issued: acc.issued + row.issued,
      stockOnHand: acc.stockOnHand + row.stockOnHand,
    }),
    {
      beginningBalance: 0,
      received: 0,
      transferredIn: 0,
      transferredOut: 0,
      expiredWasted: 0,
      totalAvailable: 0,
      issued: 0,
      stockOnHand: 0,
    },
  );

const InventorySheetPrintReport = ({ reportDate, printRows, printTotals }) => {
  const monthYear = formatInventoryMonthYear(reportDate);

  return (
    <section
      className="inventory-sheet-print-report"
      data-testid="inventory-print-report"
    >
      <div className="inventory-sheet-print-report__inner">
        <header className="inventory-sheet-print-header" data-testid="inventory-print-header">
          <h1 className="inventory-sheet-print-header__line inventory-sheet-print-header__line--primary">
            {DEFAULT_PRINT_HEADER.healthCenter}
          </h1>
          <p className="inventory-sheet-print-header__line">{DEFAULT_PRINT_HEADER.barangay}</p>
          <p className="inventory-sheet-print-header__line">{DEFAULT_PRINT_HEADER.city}</p>
          <h2 className="inventory-sheet-print-header__line inventory-sheet-print-header__line--title">
            VACCINE INVENTORY SHEET
          </h2>
          <p
            className="inventory-sheet-print-header__line inventory-sheet-print-header__line--period"
            data-testid="inventory-print-month-year"
          >
            {monthYear}
          </p>
        </header>

        <table
          className="inventory-sheet-print-table"
          id="inventory-print-table"
          data-testid="inventory-print-table"
        >
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className="print-col-base">A</th>
              <th rowSpan={2} className="print-col-base print-col-items">Items</th>
              <th rowSpan={2} className="print-col-base print-col-beginning">
                B
                <br />
                Beginning Balance
              </th>
              <th rowSpan={2} className="print-col-base print-col-received">
                C
                <br />
                Received
              </th>
              <th rowSpan={2} className="print-col-base print-col-lot">
                Lot / Batch Number
              </th>
              <th colSpan={2} className="print-col-base print-col-movement">
                Stock Movement In / Out
              </th>
              <th rowSpan={2} className="print-col-base print-col-expired">
                Expired / Wasted
              </th>
              <th rowSpan={2} className="print-col-base print-col-total">
                G
                <br />
                Total Available
              </th>
              <th rowSpan={2} className="print-col-base print-col-issued">
                H
                <br />
                Issued
              </th>
              <th rowSpan={2} className="print-col-base print-col-stock">
                I+J
                <br />
                Stock On Hand
              </th>
            </tr>
            <tr>
              <th className="print-col-base print-col-movement">In</th>
              <th className="print-col-base print-col-movement">Out</th>
            </tr>
          </thead>
          <tbody>
            {printRows.map((item) => (
              <tr key={`inventory-print-${item.id}`}>
                <td className="print-col-base print-col-center">{item.rowNumber}</td>
                <td className="print-col-base print-col-items print-col-item-name">
                  {item.itemName}
                </td>
                <td className="print-col-base print-col-beginning print-col-center">
                  {item.beginningBalance}
                </td>
                <td className="print-col-base print-col-received print-col-center">
                  {item.received}
                </td>
                <td className="print-col-base print-col-lot print-col-center">
                  {item.lotBatchNumber}
                </td>
                <td className="print-col-base print-col-movement print-col-center">
                  {item.transferredIn}
                </td>
                <td className="print-col-base print-col-movement print-col-center">
                  {item.transferredOut}
                </td>
                <td className="print-col-base print-col-expired print-col-center">
                  {item.expiredWasted}
                </td>
                <td className="print-col-base print-col-total print-col-center">
                  {item.totalAvailable}
                </td>
                <td className="print-col-base print-col-issued print-col-center">
                  {item.issued}
                </td>
                <td className="print-col-base print-col-stock print-col-center">
                  {item.stockOnHand}
                </td>
              </tr>
            ))}

            <tr className="inventory-sheet-print-total-row" data-testid="inventory-print-total-row">
              <td className="print-col-base print-col-total-label" colSpan={2}>
                TOTAL
              </td>
              <td className="print-col-base print-col-beginning print-col-center">
                {printTotals.beginningBalance}
              </td>
              <td className="print-col-base print-col-received print-col-center">
                {printTotals.received}
              </td>
              <td className="print-col-base print-col-lot print-col-center">-</td>
              <td className="print-col-base print-col-movement print-col-center">
                {printTotals.transferredIn}
              </td>
              <td className="print-col-base print-col-movement print-col-center">
                {printTotals.transferredOut}
              </td>
              <td className="print-col-base print-col-expired print-col-center">
                {printTotals.expiredWasted}
              </td>
              <td className="print-col-base print-col-total print-col-center">
                {printTotals.totalAvailable}
              </td>
              <td className="print-col-base print-col-issued print-col-center">
                {printTotals.issued}
              </td>
              <td className="print-col-base print-col-stock print-col-center">
                {printTotals.stockOnHand}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default function InventoryManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const printRef = useRef(null);

  const tabFromUrl = useMemo(
    () => normalizeInventoryTabKey(searchParams.get("tab")),
    [searchParams],
  );

  // Active tab state
  const [activeTab, setActiveTab] = useState(
    () => tabFromUrl || getStoredInventoryTabKey() || INVENTORY_DEFAULT_TAB_KEY,
  );

  useEffect(() => {
    const resolvedTab =
      tabFromUrl || getStoredInventoryTabKey() || INVENTORY_DEFAULT_TAB_KEY;

    setActiveTab((previous) =>
      previous === resolvedTab ? previous : resolvedTab,
    );
    persistInventoryTabKey(resolvedTab);

    if (!tabFromUrl) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", resolvedTab);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [tabFromUrl, searchParams, setSearchParams]);

  // Data states
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [transactionErrors, setTransactionErrors] = useState({});
  const [isPrintLayoutActive, setIsPrintLayoutActive] = useState(false);

  // Report date range
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Facility info for print
  const [facilityInfo, setFacilityInfo] = useState({
    healthCenter: "IMMUNICARE HEALTH CENTER",
    province: "PROVINCE",
    city: DEFAULT_PRINT_HEADER.city,
    barangay: DEFAULT_PRINT_HEADER.barangay,
    monthYear: new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  });

  // Vaccine items based on paper configuration
  const vaccineItems = useMemo(
    () => [
      { id: "bcg", name: "BCG", unit: "vials" },
      { id: "bcg_diluent", name: "BCG, Diluent", unit: "vials" },
      { id: "hepa_b", name: "Hepa B", unit: "vials" },
      { id: "pentavalent", name: "Penta Valent", unit: "vials" },
      { id: "opv", name: "OPV 20-doses", unit: "vials" },
      { id: "pcv", name: "PCV 13 / PCV 10", unit: "vials" },
      { id: "mr", name: "Measles & Rubella (MR)", unit: "vials" },
      { id: "mmr", name: "MMR", unit: "vials" },
      { id: "mmr_diluent", name: "MMR, Diluent 5ml", unit: "vials" },
      { id: "ipv", name: "IPV multi dose", unit: "vials" },
    ],
    [],
  );

  // Initialize inventory data structure based on paper configuration
  const initializeInventory = useCallback(() => {
    const initialData = vaccineItems.map((item) => ({
      ...item,
      beginning_balance: 0,
      received: 0,
      lot_batch_number: "",
      transferred_in: 0,
      transferred_out: 0,
      expired_wasted: 0,
      issuance: 0,
      stock_in: 0,
      stock_out: 0,
      total_available: 0,
      stock_on_hand: 0,
    }));
    setInventory(initialData);
  }, [vaccineItems]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch inventory data from API
      try {
        const inventoryData = await apiClient.getVaccineInventory();

        // Handle both wrapped and unwrapped response formats
        let apiInventory = [];
        if (inventoryData && inventoryData.success !== undefined) {
          apiInventory = inventoryData.data || inventoryData.inventory || [];
        } else if (Array.isArray(inventoryData)) {
          apiInventory = inventoryData;
        } else if (inventoryData?.inventory) {
          apiInventory = inventoryData.inventory;
        }

        if (apiInventory.length > 0) {
          // Map API data to component format
          const mappedInventory = vaccineItems.map((item) => {
            // Find matching inventory record from API
            const apiRecord = apiInventory.find(
              (inv) => inv.vaccine_name === item.name || inv.vaccine_id === item.id
            );

            if (apiRecord) {
              return {
                ...item,
                beginning_balance: apiRecord.beginning_balance || 0,
                received: apiRecord.received_during_period || 0,
                lot_batch_number: apiRecord.lot_batch_number || '',
                transferred_in: apiRecord.transferred_in || 0,
                transferred_out: apiRecord.transferred_out || 0,
                expired_wasted: apiRecord.expired_wasted || 0,
                issuance: apiRecord.issuance || 0,
                total_available: (apiRecord.beginning_balance || 0) + (apiRecord.received_during_period || 0),
                stock_on_hand:
                  (apiRecord.beginning_balance || 0) +
                  (apiRecord.received_during_period || 0) +
                  (apiRecord.transferred_in || 0) -
                  (apiRecord.transferred_out || 0) -
                  (apiRecord.expired_wasted || 0) -
                  (apiRecord.issuance || 0),
                _apiId: apiRecord.id,
              };
            }

            // Return default values if no API record found
            return {
              ...item,
              beginning_balance: 0,
              received: 0,
              lot_batch_number: '',
              transferred_in: 0,
              transferred_out: 0,
              expired_wasted: 0,
              issuance: 0,
              total_available: 0,
              stock_on_hand: 0,
            };
          });
          setInventory(mappedInventory);
        } else {
          // No API data, initialize with zeros
          initializeInventory();
        }
      } catch (apiErr) {
        // API call failed, initialize with zeros
        console.log("Using local inventory data (API unavailable)", apiErr.message);
        initializeInventory();
      }

      // Try to fetch facility info from API
      try {
        const facilityResponse = await apiClient.getFacilityInfo();

        // Handle both wrapped and unwrapped response formats
        let facilityData = null;
        if (facilityResponse && facilityResponse.success !== undefined) {
          facilityData = facilityResponse.data;
        } else {
          facilityData = facilityResponse;
        }

        if (facilityData) {
          setFacilityInfo((prev) => ({
            ...prev,
            healthCenter: facilityData.name || prev.healthCenter,
            province: facilityData.province || prev.province,
            city: facilityData.city || prev.city,
            barangay: facilityData.barangay || prev.barangay,
          }));
        }
      } catch (facilityErr) {
        // Use default facility info if API fails
        console.log("Using default facility info", facilityErr.message);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [initializeInventory, vaccineItems]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleBeforePrint = () => {
      setIsPrintLayoutActive(true);
      document.body.classList.add("printing-inventory");
    };

    const handleAfterPrint = () => {
      setIsPrintLayoutActive(false);
      document.body.classList.remove("printing-inventory");
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("printing-inventory");
    };
  }, []);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    return inventory.reduce(
      (acc, item) => ({
        beginning_balance: acc.beginning_balance + item.beginning_balance,
        received: acc.received + item.received,
        transferred_in: acc.transferred_in + item.transferred_in,
        transferred_out: acc.transferred_out + item.transferred_out,
        expired_wasted: acc.expired_wasted + item.expired_wasted,
        issuance: acc.issuance + item.issuance,
        stock_in: acc.stock_in + item.stock_in,
        stock_out: acc.stock_out + item.stock_out,
        total_available: acc.total_available + item.total_available,
        stock_on_hand: acc.stock_on_hand + item.stock_on_hand,
      }),
      {
        beginning_balance: 0,
        received: 0,
        transferred_in: 0,
        transferred_out: 0,
        expired_wasted: 0,
        issuance: 0,
        stock_in: 0,
        stock_out: 0,
        total_available: 0,
        stock_on_hand: 0,
      },
    );
  }, [inventory]);

  // Update inventory item
  const updateItem = (id, field, value) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Auto-calculate derived fields
          updatedItem.total_available =
            parseInt(updatedItem.beginning_balance || 0) +
            parseInt(updatedItem.received || 0);

          updatedItem.stock_on_hand =
            updatedItem.total_available +
            parseInt(updatedItem.transferred_in || 0) -
            parseInt(updatedItem.transferred_out || 0) -
            parseInt(updatedItem.issuance || 0) -
            parseInt(updatedItem.expired_wasted || 0);

          return updatedItem;
        }
        return item;
      }),
    );
  };

  // Open modal for transaction
  const openTransactionModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setTransactionErrors({});
    setFormData({
      quantity: "",
      lot_number: "",
      reason: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setShowModal(true);
  };

  const mapModalTypeToApiType = useCallback((type) => {
    const mapping = {
      receive: "RECEIVE",
      issue: "ISSUE",
      waste: "WASTE",
      transfer_in: "TRANSFER_IN",
      transfer_out: "TRANSFER_OUT",
    };
    return mapping[type] || "ADJUST";
  }, []);

  const isValidDateInput = useCallback((value) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  }, []);

  const handleTabChange = useCallback(
    (nextTabKey) => {
      const normalizedTab =
        normalizeInventoryTabKey(nextTabKey) || INVENTORY_DEFAULT_TAB_KEY;

      setActiveTab(normalizedTab);
      persistInventoryTabKey(normalizedTab);

      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", normalizedTab);
      setSearchParams(nextSearchParams);
    },
    [searchParams, setSearchParams],
  );

  // Handle transaction submission
  const handleTransaction = async (event) => {
    event.preventDefault();
    if (!selectedItem) return;

    const nextErrors = {};
    const quantityCheck = validateNumberRange(formData.quantity, {
      label: "Quantity",
      required: true,
      min: 1,
      max: 100000,
      integer: true,
    });
    const qty = quantityCheck.value;
    if (quantityCheck.error) {
      nextErrors.quantity = quantityCheck.error;
    }

    const transactionDateCheck = validateDate(formData.date, {
      label: "Transaction date",
      required: true,
    });
    const transactionDate = transactionDateCheck.value;
    if (transactionDateCheck.error || !isValidDateInput(formData.date) || !transactionDate) {
      nextErrors.date =
        transactionDateCheck.error || "A valid transaction date is required.";
    } else if (transactionDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (transactionDate > today) {
        nextErrors.date = "Transaction date cannot be in the future.";
      }
    }

    const lotNumber = sanitizeText(formData.lot_number, { maxLength: 50 });
    if (modalType === "receive") {
      if (!lotNumber) {
        nextErrors.lot_number = "Lot/Batch number is required for received stock.";
      }
    }

    const lotNumberLengthError = validateLength(lotNumber, {
      min: 0,
      max: 50,
      label: "Lot/Batch number",
    });
    if (lotNumberLengthError) {
      nextErrors.lot_number = "Lot/Batch number must not exceed 50 characters.";
    }

    const normalizedNotes = sanitizeText(formData.notes, {
      maxLength: 500,
      preserveNewLines: true,
    });
    const notesLengthError = validateLength(normalizedNotes, {
      min: 0,
      max: 500,
      label: "Notes",
    });
    if (notesLengthError) {
      nextErrors.notes = "Notes must not exceed 500 characters.";
    }

    if (
      ["issue", "waste", "transfer_out"].includes(modalType) &&
      Number.isFinite(qty)
    ) {
      if (qty > Number(selectedItem.stock_on_hand || 0)) {
        nextErrors.quantity = "Quantity cannot exceed current stock on hand.";
      }
    }

    if (hasFieldErrors(nextErrors)) {
      setTransactionErrors(nextErrors);
      return;
    }

    try {
      setError(null);
      setTransactionErrors({});

      const matchedInventory = inventory.find((item) => item.id === selectedItem.id);
      if (!matchedInventory) {
        setError("Selected inventory item was not found.");
        return;
      }

      const payload = {
        vaccine_inventory_id: matchedInventory.id,
        vaccine_id: matchedInventory.vaccine_id || matchedInventory.id,
        transaction_type: mapModalTypeToApiType(modalType),
        quantity: qty,
        lot_number: lotNumber || undefined,
        transaction_date: formData.date,
        notes: normalizedNotes || undefined,
      };

      await apiClient.createVaccineInventoryTransaction(payload);

      setInventory((prev) =>
        prev.map((item) => {
          if (item.id === selectedItem.id) {
            const updatedItem = { ...item };

            switch (modalType) {
              case "receive":
                updatedItem.received += qty;
                updatedItem.lot_batch_number = lotNumber || updatedItem.lot_batch_number;
                break;
              case "issue":
                updatedItem.issuance += qty;
                break;
              case "waste":
                updatedItem.expired_wasted += qty;
                break;
              case "transfer_in":
                updatedItem.transferred_in += qty;
                break;
              case "transfer_out":
                updatedItem.transferred_out += qty;
                break;
              default:
                break;
            }

            // Recalculate totals
            updatedItem.total_available =
              parseInt(updatedItem.beginning_balance || 0) +
              parseInt(updatedItem.received || 0);

            updatedItem.stock_on_hand =
              updatedItem.total_available +
              parseInt(updatedItem.transferred_in || 0) -
              parseInt(updatedItem.transferred_out || 0) -
              parseInt(updatedItem.issuance || 0) -
              parseInt(updatedItem.expired_wasted || 0);

            return updatedItem;
          }
          return item;
        }),
      );

      setShowModal(false);
      setTransactionErrors({});
    } catch (err) {
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setTransactionErrors((prev) => ({
          ...prev,
          ...backendFields,
        }));
      }
      setError(err.message || "Failed to save inventory transaction.");
    }
  };

  const formatStockMovementCell = useCallback(
    (inbound, outbound) => `${Number(inbound || 0)} / ${Number(outbound || 0)}`,
    [],
  );

  // Inventory table export columns aligned with on-screen table order/labels
  const inventoryExportColumns = useMemo(
    () => [
      {
        key: "row_number",
        label: "A",
        value: (_item, index) => index + 1,
      },
      {
        key: "item_name",
        label: "ITEMS",
        value: (item) => item.name,
      },
      {
        key: "beginning_balance",
        label: "B Beginning Balance",
        value: (item) => item.beginning_balance,
      },
      {
        key: "received",
        label: "C Received",
        value: (item) => item.received,
      },
      {
        key: "lot_batch_number",
        label: "Lot / Batch Number",
        value: (item) => item.lot_batch_number,
      },
      {
        key: "stock_movement",
        label: "Stock Movement (In / Out)",
        value: (item) =>
          formatStockMovementCell(item.transferred_in, item.transferred_out),
      },
      {
        key: "expired_wasted",
        label: "Expired / Wasted",
        value: (item) => item.expired_wasted,
      },
      {
        key: "total_available",
        label: "G Total Available",
        value: (item) => item.total_available,
      },
      {
        key: "issuance",
        label: "H Issued",
        value: (item) => item.issuance,
      },
      {
        key: "stock_on_hand",
        label: "I+J Stock On Hand",
        value: (item) => item.stock_on_hand,
      },
    ],
    [formatStockMovementCell],
  );

  const getInventoryExportRows = useCallback(
    (rowsSource, totalsRow) => {
      const dataRows = rowsSource.map((item, index) =>
        inventoryExportColumns.map((column) => column.value(item, index)),
      );

      const totalRow = inventoryExportColumns.map((column, index) => {
        if (index === 0) return "";
        if (column.key === "item_name") return "TOTAL";

        switch (column.key) {
          case "beginning_balance":
            return totalsRow.beginning_balance;
          case "received":
            return totalsRow.received;
          case "lot_batch_number":
            return "-";
          case "stock_movement":
            return formatStockMovementCell(
              totalsRow.transferred_in,
              totalsRow.transferred_out,
            );
          case "expired_wasted":
            return totalsRow.expired_wasted;
          case "total_available":
            return totalsRow.total_available;
          case "issuance":
            return totalsRow.issuance;
          case "stock_on_hand":
            return totalsRow.stock_on_hand;
          default:
            return "";
        }
      });

      return [...dataRows, totalRow];
    },
    [formatStockMovementCell, inventoryExportColumns],
  );

  const formatCsvCell = useCallback((value) => {
    if (value === null || value === undefined) {
      return "";
    }

    const normalized = String(value).replace(/\r?\n|\r/g, " ");
    const escaped = normalized.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  }, []);

  // Download report as CSV
  const downloadCSV = () => {
    const headers = inventoryExportColumns.map((column) => column.label);
    const totals = calculateTotals();
    const rows = getInventoryExportRows(inventory, totals);

    const csvContent = [
      `IMMUNICARE HEALTH CENTER - VACCINE INVENTORY`,
      `Report Date: ${reportDate}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      headers.map((cell) => formatCsvCell(cell)).join(","),
      ...rows.map((row) => row.map((cell) => formatCsvCell(cell)).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vaccine_inventory_${reportDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print report with proper formatting - only prints inventory sheet
  const printReport = () => {
    // Ensure we're on the inventory sheet tab
    if (activeTab !== INVENTORY_DEFAULT_TAB_KEY) {
      handleTabChange(INVENTORY_DEFAULT_TAB_KEY);
    }

    setIsPrintLayoutActive(true);

    // Add a class to body to enable print-specific styles
    document.body.classList.add("printing-inventory");

    // Small delay to ensure DOM updates
    setTimeout(() => {
      window.print();
      // Remove the class after print dialog closes
      setTimeout(() => {
        setIsPrintLayoutActive(false);
        document.body.classList.remove("printing-inventory");
      }, 100);
    }, 100);
  };

  // Download as PDF using browser print
  const downloadPDF = () => {
    printReport();
  };

  // Stock alerts calculation
  const getStockAlerts = useCallback(() => {
    const alerts = {
      critical: [],
      low: [],
      unused: [],
      wasted: [],
    };

    inventory.forEach((item) => {
      if (item.stock_on_hand === 0) {
        alerts.critical.push(item);
      } else if (item.stock_on_hand < 10) {
        alerts.low.push(item);
      }

      if (item.beginning_balance === 0 && item.received === 0) {
        alerts.unused.push(item);
      }

      const totalInput =
        item.beginning_balance + item.received + item.transferred_in;
      const wastePercentage =
        totalInput > 0 ? (item.expired_wasted / totalInput) * 100 : 0;
      if (wastePercentage > 10) {
        alerts.wasted.push({
          ...item,
          waste_percentage: wastePercentage.toFixed(1),
        });
      }
    });

    return alerts;
  }, [inventory]);

  const stockAlerts = getStockAlerts();

  const printRows = useMemo(() => buildInventoryPrintRows(inventory), [inventory]);

  const printTotals = useMemo(
    () => buildInventoryPrintTotals(printRows),
    [printRows],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="danger" onDismiss={() => setError(null)}>
          {error}
        </Alert>
        <Button onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="inventory-management space-y-4 p-4">
      {/* Header - Hidden on Print */}
      <div className="print:hidden">
        <PageHeader
          title="Vaccine Inventory Management"
          subtitle="Paper-based inventory tracking system for vaccinations"
          icon="💉"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="headerOutline"
                size="sm"
                onClick={downloadCSV}
                className="gap-2"
              >
                <svg
                  className="w-4 h-4"
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
                Export CSV
              </Button>
              <Button
                variant="headerOutline"
                size="sm"
                onClick={downloadPDF}
                className="gap-2"
              >
                <svg
                  className="w-4 h-4"
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
                Print / PDF
              </Button>
            </div>
          }
        />

        {/* Tab Navigation */}
        <Card className="mt-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex border-b border-gray-200 dark:border-gray-600 overflow-x-auto">
            <button
              onClick={() => handleTabChange("inventory_sheet")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                activeTab === "inventory_sheet"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Inventory Sheet
            </button>
            <button
              onClick={() => handleTabChange("stock_alerts")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap relative ${
                activeTab === "stock_alerts"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Stock Alerts
              {stockAlerts.critical.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full absolute top-2">
                  {stockAlerts.critical.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange("reports")}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                activeTab === "reports"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Reports
            </button>
          </div>
        </Card>
      </div>

      {isPrintLayoutActive && (
        <InventorySheetPrintReport
          facilityInfo={facilityInfo}
          reportDate={reportDate}
          printRows={printRows}
          printTotals={printTotals}
        />
      )}

      {/* Inventory Sheet Tab - This is the ONLY content that will print */}
      {activeTab === "inventory_sheet" && (
        <div className="inventory-sheet-print-area space-y-3 print:space-y-1">
          {/* Report Date - Hidden on Print, Visible on Screen */}
          <div className="flex justify-end print:hidden">
            <div className="flex items-center gap-2">
              <label
                htmlFor="inventory-report-date"
                className="text-sm font-medium text-gray-700"
              >
                Report Date:
              </label>
              <Input
                id="inventory-report-date"
                aria-label="Report Date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-36 text-sm"
              />
            </div>
          </div>

          {/* Paper Configuration Inventory Table */}
          <Card className="overflow-hidden p-0 print:shadow-none print:border-none dark:bg-gray-800 dark:border-gray-700">
            <div className="overflow-auto print:overflow-visible">
              <table
                ref={printRef}
                className="w-full border-collapse text-xs sm:text-sm"
                id="inventory-table"
              >
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700 print:bg-gray-300">
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 text-gray-900 dark:text-gray-100">
                      A
                    </th>
                    <th className="px-2 py-1 text-left font-bold border border-black dark:border-gray-500 min-w-[100px] text-gray-900 dark:text-gray-100">
                      ITEMS
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-12 bg-blue-100 dark:bg-blue-900/50">
                      B
                      <br />
                      Beginning
                      <br />
                      Balance
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-12 bg-green-100 dark:bg-green-900/50">
                      C
                      <br />
                      Received
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-16 bg-gray-100 dark:bg-gray-700">
                      Lot /
                      <br />
                      Batch Number
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-10 bg-gray-100 dark:bg-gray-700">
                      Stock Movement
                      <br />
                      (In / Out)
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-10 bg-red-50 dark:bg-red-900/30 text-gray-900 dark:text-gray-100">
                      Expired /
                      <br />
                      Wasted
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-12 bg-blue-200 dark:bg-blue-800/50">
                      G
                      <br />
                      Total
                      <br />
                      Available
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-10 bg-yellow-100 dark:bg-yellow-900/50">
                      H
                      <br />
                      Issued
                    </th>
                    <th className="px-2 py-1 text-center font-bold border border-black dark:border-gray-500 w-12 bg-green-200 dark:bg-green-800/50">
                      I+J
                      <br />
                      Stock On
                      <br />
                      Hand
                    </th>
                    <th
                      className="px-1 py-1 text-center font-bold border border-black dark:border-gray-500 w-8 print:hidden text-gray-900 dark:text-gray-100"
                      colSpan={3}
                    >
                      Act
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item, index) => (
                    <tr
                      key={item.id}
                      className={
                        index % 2 === 0
                          ? "bg-white dark:bg-gray-800"
                          : "bg-gray-50 dark:bg-gray-700/50 print:bg-white"
                      }
                    >
                      <td className="px-2 py-1 text-center font-medium border border-black dark:border-gray-500 text-gray-900 dark:text-gray-100">
                        {index + 1}
                      </td>
                      <td className="px-2 py-1 text-left font-bold border border-black dark:border-gray-500 text-gray-900 dark:text-gray-100">
                        {item.name}
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <input
                          type="number"
                          min="0"
                          value={item.beginning_balance}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "beginning_balance",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full text-center text-sm border-none focus:outline-none focus:ring-0 bg-blue-50 dark:bg-blue-900/30 text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <input
                          type="number"
                          min="0"
                          value={item.received}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "received",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full text-center text-sm border-none focus:outline-none focus:ring-0 bg-green-50 dark:bg-green-900/30 text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500 bg-gray-50 dark:bg-gray-700/30">
                        <input
                          type="text"
                          value={item.lot_batch_number}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "lot_batch_number",
                              e.target.value,
                            )
                          }
                          className="w-full text-center text-sm border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                          placeholder="---"
                        />
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500 bg-gray-50 dark:bg-gray-700/30">
                        <div className="flex gap-0.5">
                          <input
                            type="number"
                            min="0"
                            value={item.transferred_in}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "transferred_in",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-1/2 text-center text-sm border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="In"
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.transferred_out}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "transferred_out",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-1/2 text-center text-sm border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Out"
                          />
                        </div>
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <input
                          type="number"
                          min="0"
                          value={item.expired_wasted}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "expired_wasted",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full text-center text-sm border-none focus:outline-none focus:ring-0 bg-red-50 dark:bg-red-900/30 text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-blue-800 dark:text-blue-300 border border-black dark:border-gray-500 bg-blue-100 dark:bg-blue-900/50">
                        {item.total_available}
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <input
                          type="number"
                          min="0"
                          value={item.issuance}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "issuance",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full text-center text-sm border-none focus:outline-none focus:ring-0 bg-yellow-50 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-green-800 dark:text-green-300 border border-black dark:border-gray-500 bg-green-100 dark:bg-green-900/50">
                        {item.stock_on_hand}
                      </td>
                      <td className="px-1 py-0.5 border border-black print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="xs"
                            variant="success"
                            onClick={() =>
                              openTransactionModal("receive", item)
                            }
                            className="text-xs px-2 py-1 h-7 min-h-[28px] font-semibold"
                            title="Receive"
                          >
                            + Receive
                          </Button>
                          <Button
                            size="xs"
                            variant="info"
                            onClick={() => openTransactionModal("issue", item)}
                            className="text-xs px-2 py-1 h-7 min-h-[28px] font-semibold"
                            title="Issue"
                          >
                            − Issue
                          </Button>
                          <Button
                            size="xs"
                            variant="danger"
                            onClick={() => openTransactionModal("waste", item)}
                            className="text-xs px-2 py-1 h-7 min-h-[28px] font-semibold"
                            title="Waste"
                          >
                            ✕ Waste
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gray-300 dark:bg-gray-600 print:bg-gray-400 font-bold">
                    <td
                      colSpan={2}
                      className="px-2 py-1 text-right border border-black dark:border-gray-500 text-gray-900 dark:text-gray-100"
                    >
                      TOTAL
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 bg-blue-200 dark:bg-blue-800/50 text-gray-900 dark:text-gray-100">
                      {totals.beginning_balance}
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 bg-green-200 dark:bg-green-800/50 text-gray-900 dark:text-gray-100">
                      {totals.received}
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 text-gray-900 dark:text-gray-100">
                      -
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500">
                      <span className="text-green-700 dark:text-green-400">
                        {totals.transferred_in}
                      </span>
                      <span className="mx-1">/</span>
                      <span className="text-red-700 dark:text-red-400">
                        {totals.transferred_out}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-300">
                      {totals.expired_wasted}
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 bg-blue-300 dark:bg-blue-700/50 text-gray-900 dark:text-gray-100">
                      {totals.total_available}
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 bg-yellow-200 dark:bg-yellow-800/50 text-gray-900 dark:text-gray-100">
                      {totals.issuance}
                    </td>
                    <td className="px-2 py-1 text-center border border-black dark:border-gray-500 bg-green-300 dark:bg-green-700/50 text-gray-900 dark:text-gray-100">
                      {totals.stock_on_hand}
                    </td>
                    <td
                      className="px-1 py-1 text-center border border-black dark:border-gray-500 print:hidden"
                      colSpan={3}
                    >
                      -
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Print Footer - Visible only on Print */}
          <div className="hidden print:block mt-4">
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <p className="font-bold text-xs uppercase">Prepared By:</p>
                <div className="mt-4">
                  <p className="border-b border-black"></p>
                  <p className="text-xs">Signature over Printed Name</p>
                </div>
              </div>
              <div>
                <p className="font-bold text-xs uppercase">Checked By:</p>
                <div className="mt-4">
                  <p className="border-b border-black"></p>
                  <p className="text-xs">Signature over Printed Name</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Alerts Tab - NOT printed */}
      {activeTab === "stock_alerts" && (
        <div className="space-y-4">
          {/* Alert Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Critical Stock Alert */}
            <Card className="p-3 border-l-4 border-red-500 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Critical
                  </p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {stockAlerts.critical.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Stock = 0
                  </p>
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                  <svg
                    className="w-4 h-4 text-red-600 dark:text-red-400"
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

            {/* Low Stock Alert */}
            <Card className="p-3 border-l-4 border-yellow-500 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Low
                  </p>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stockAlerts.low.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Low
                  </p>
                </div>
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                  <svg
                    className="w-4 h-4 text-yellow-600 dark:text-yellow-400"
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

            {/* Unused Vaccines */}
            <Card className="p-3 border-l-4 border-gray-400 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Unused
                  </p>
                  <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                    {stockAlerts.unused.length}
                  </p>
                </div>
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <svg
                    className="w-4 h-4 text-gray-600 dark:text-gray-400"
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

            {/* Wasted Vaccines */}
            <Card className="p-3 border-l-4 border-orange-500 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Waste
                  </p>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {stockAlerts.wasted.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    High
                  </p>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                  <svg
                    className="w-4 h-4 text-orange-600 dark:text-orange-400"
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
          </div>

          {/* Alerts Tables */}
          {(stockAlerts.critical.length > 0 ||
            stockAlerts.low.length > 0 ||
            stockAlerts.wasted.length > 0) && (
            <Card className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
              {stockAlerts.critical.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-l-4 border-red-500">
                    Critical Stock (Out of Stock)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 dark:bg-red-900/20">
                        <tr>
                          <th className="px-3 py-1 text-left text-gray-700 dark:text-gray-300">
                            Item
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Stock
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Status
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                        {stockAlerts.critical.map((item) => (
                          <tr key={item.id} className="dark:bg-gray-800/50">
                            <td className="px-3 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {item.name}
                            </td>
                            <td className="px-3 py-1 text-center text-sm font-bold text-red-600 dark:text-red-400">
                              0
                            </td>
                            <td className="px-3 py-1 text-center">
                              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded text-xs">
                                OUT OF STOCK
                              </span>
                            </td>
                            <td className="px-3 py-1 text-center">
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() =>
                                  openTransactionModal("receive", item)
                                }
                              >
                                Receive
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {stockAlerts.low.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-l-4 border-yellow-500">
                    Low Stock Warning
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-yellow-50 dark:bg-yellow-900/20">
                        <tr>
                          <th className="px-3 py-1 text-left text-gray-700 dark:text-gray-300">
                            Item
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Stock
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Threshold
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-yellow-100 dark:divide-yellow-900/30">
                        {stockAlerts.low.map((item) => (
                          <tr key={item.id} className="dark:bg-gray-800/50">
                            <td className="px-3 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {item.name}
                            </td>
                            <td className="px-3 py-1 text-center text-sm font-bold text-yellow-600 dark:text-yellow-400">
                              {item.stock_on_hand}
                            </td>
                            <td className="px-3 py-1 text-center text-sm text-gray-700 dark:text-gray-300">
                              10
                            </td>
                            <td className="px-3 py-1 text-center">
                              <Button
                                size="xs"
                                variant="warning"
                                onClick={() =>
                                  openTransactionModal("receive", item)
                                }
                              >
                                Restock
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {stockAlerts.wasted.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-l-4 border-orange-500">
                    High Waste Items
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-orange-50 dark:bg-orange-900/20">
                        <tr>
                          <th className="px-3 py-1 text-left text-gray-700 dark:text-gray-300">
                            Item
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Wasted
                          </th>
                          <th className="px-3 py-1 text-center text-gray-700 dark:text-gray-300">
                            Waste %
                          </th>
                          <th className="px-3 py-1 text-left text-gray-700 dark:text-gray-300">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100 dark:divide-orange-900/30">
                        {stockAlerts.wasted.map((item) => (
                          <tr key={item.id} className="dark:bg-gray-800/50">
                            <td className="px-3 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {item.name}
                            </td>
                            <td className="px-3 py-1 text-center text-sm font-bold text-orange-600 dark:text-orange-400">
                              {item.expired_wasted}
                            </td>
                            <td className="px-3 py-1 text-center">
                              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 rounded text-sm">
                                {item.waste_percentage}%
                              </span>
                            </td>
                            <td className="px-3 py-1 text-gray-700 dark:text-gray-300">
                              Review
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* No Alerts Message */}
          {stockAlerts.critical.length === 0 &&
            stockAlerts.low.length === 0 &&
            stockAlerts.wasted.length === 0 && (
              <Card className="p-6 text-center dark:bg-gray-800 dark:border-gray-700">
                <div className="flex flex-col items-center">
                  <svg
                    className="w-12 h-12 text-green-500 dark:text-green-400 mb-3"
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
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    All Clear!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No stock alerts at this time.
                  </p>
                </div>
              </Card>
            )}
        </div>
      )}

      {/* Reports Tab - NOT printed */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* Report Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
              onClick={downloadCSV}
            >
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Export to CSV
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Download as spreadsheet
              </p>
            </Card>

            <Card
              className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
              onClick={printReport}
            >
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
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
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Print / PDF
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Save as PDF document
              </p>
            </Card>

            <Card className="p-4 text-center dark:bg-gray-800 dark:border-gray-700">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Summary
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Statistics overview
              </p>
            </Card>
          </div>

          {/* Report Summary */}
          <Card className="p-4 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Inventory Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Vaccines
                </p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {inventory.length}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Beginning
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {totals.beginning_balance}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Received
                </p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {totals.received}
                </p>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Issued
                </p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {totals.issuance}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  On Hand
                </p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {totals.stock_on_hand}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Transaction Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setTransactionErrors({});
        }}
        title={
          modalType === "receive"
            ? "Receive Stock"
            : modalType === "issue"
              ? "Issue Stock"
              : modalType === "waste"
                ? "Record Wasted"
                : "Transfer"
        }
        size="sm"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowModal(false);
                setTransactionErrors({});
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="inventoryTransactionForm">
              {modalType === "receive"
                ? "Receive"
                : modalType === "issue"
                  ? "Issue"
                  : modalType === "waste"
                    ? "Record"
                    : "Transfer"}
            </Button>
          </AdminModalActions>
        }
      >
          <form id="inventoryTransactionForm" className="admin-form" onSubmit={handleTransaction}>
            {selectedItem && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <span>💉</span> Vaccine Information
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {selectedItem.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Current Stock:{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedItem.stock_on_hand}
                  </span>
                </p>
              </div>
            </div>
          )}

          {hasFieldErrors(transactionErrors) && (
            <Alert variant="error" className="mb-3">
              Please resolve the highlighted transaction form errors before
              submitting.
            </Alert>
          )}

          {/* Transaction Details */}
          <div
            className={
              modalType === "receive"
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
                : modalType === "issue"
                  ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
            }
          >
            <h4
              className={`text-sm font-semibold mb-3 flex items-center gap-2 ${modalType === "receive" ? "text-green-900 dark:text-green-100" : modalType === "issue" ? "text-blue-900 dark:text-blue-100" : "text-red-900 dark:text-red-100"}`}
            >
              <span>
                {modalType === "receive"
                  ? "📥"
                  : modalType === "issue"
                    ? "📤"
                    : "🗑️"}
              </span>
              Transaction Details
            </h4>
            <div className="admin-form-row-2">
              <div className="admin-field-group">
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={formData.quantity || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, quantity: e.target.value });
                    setTransactionErrors((prev) => ({
                      ...prev,
                      quantity: undefined,
                    }));
                  }}
                  required
                  error={transactionErrors.quantity}
                  className="w-full"
                />
              </div>

              <div className="admin-field-group">
                <Input
                  label="Date"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={formData.date || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, date: e.target.value });
                    setTransactionErrors((prev) => ({
                      ...prev,
                      date: undefined,
                    }));
                  }}
                  required
                  error={transactionErrors.date}
                  className="w-full"
                />
              </div>

              {modalType !== "issue" && (
                <div className="admin-field-group sm:col-span-2">
                  <Input
                    label="Lot/Batch #"
                    type="text"
                    value={formData.lot_number || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, lot_number: e.target.value });
                      setTransactionErrors((prev) => ({
                        ...prev,
                        lot_number: undefined,
                      }));
                    }}
                    error={transactionErrors.lot_number}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {modalType === "waste" ? "Reason for Waste" : "Notes"}
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => {
                setFormData({ ...formData, notes: e.target.value });
                setTransactionErrors((prev) => ({
                  ...prev,
                  notes: undefined,
                }));
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
              rows={2}
              placeholder={
                modalType === "waste" ? "e.g., Expired" : "Optional notes"
              }
              maxLength={500}
            />
          {transactionErrors.notes && (
              <span className="admin-field-error">{transactionErrors.notes}</span>
            )}
          </div>
        </form>
      </Modal>

      {/* Print Styles - Only prints dedicated inventory report, hides app shell and controls */}
      <style>{`
        .inventory-sheet-print-report {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0.35cm;
          }

          html,
          body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #ffffff !important;
          }

          body.printing-inventory * {
            visibility: hidden !important;
          }

          body.printing-inventory .inventory-sheet-print-report,
          body.printing-inventory .inventory-sheet-print-report * {
            visibility: visible !important;
          }

          body.printing-inventory .inventory-sheet-print-report {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            z-index: 9999 !important;
            page-break-inside: avoid !important;
          }

          .inventory-sheet-print-report__inner {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .inventory-sheet-print-header {
            display: block !important;
            text-align: center !important;
            margin: 0 0 0.2cm 0 !important;
            padding-bottom: 0.12cm !important;
            border-bottom: 1.6px solid #111827 !important;
            color: #0f172a !important;
          }

          .inventory-sheet-print-header__line {
            margin: 0 !important;
            line-height: 1.18 !important;
            letter-spacing: 0.02em !important;
          }

          .inventory-sheet-print-header__line--primary {
            font-size: 13px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .inventory-sheet-print-header__line--title {
            margin-top: 0.04cm !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .inventory-sheet-print-header__line--period {
            margin-top: 0.04cm !important;
            font-size: 11px !important;
            font-weight: 700 !important;
          }

          #inventory-print-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            color: #0f172a !important;
          }

          #inventory-print-table thead {
            display: table-header-group !important;
          }

          #inventory-print-table tbody {
            display: table-row-group !important;
          }

          #inventory-print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #inventory-print-table th,
          #inventory-print-table td {
            border: 1.35px solid #0f172a !important;
            padding: 0.14cm 0.08cm !important;
            vertical-align: middle !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          #inventory-print-table th {
            font-size: 9.5px !important;
            font-weight: 800 !important;
            text-transform: none !important;
            text-align: center !important;
          }

          #inventory-print-table td {
            font-size: 10px !important;
            min-height: 0.64cm !important;
          }

          #inventory-print-table .print-col-center {
            text-align: center !important;
          }

          #inventory-print-table .print-col-items {
            text-align: left !important;
          }

          #inventory-print-table .print-col-item-name {
            font-weight: 800 !important;
          }

          #inventory-print-table .print-col-total-label {
            text-align: right !important;
            font-weight: 800 !important;
            background-color: #e5e7eb !important;
          }

          #inventory-print-table .inventory-sheet-print-total-row td {
            font-weight: 800 !important;
          }

          /* Print-friendly color system (also readable in grayscale by contrast) */
          #inventory-print-table .print-col-base {
            background-color: #ffffff !important;
          }

          #inventory-print-table .print-col-beginning {
            background-color: #dce8f6 !important;
          }

          #inventory-print-table .print-col-received,
          #inventory-print-table .print-col-stock {
            background-color: #d8efe1 !important;
          }

          #inventory-print-table .print-col-lot,
          #inventory-print-table .print-col-movement {
            background-color: #f3f4f6 !important;
          }

          #inventory-print-table .print-col-total {
            background-color: #d2e3f6 !important;
            color: #0f3d8f !important;
          }

          #inventory-print-table .print-col-issued {
            background-color: #f9efc8 !important;
          }

          #inventory-print-table .print-col-expired {
            background-color: #f7dede !important;
          }

          .inventory-sheet-print-report,
          .inventory-sheet-print-report__inner,
          #inventory-print-table {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
