import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import apiClient from "../utils/api";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";
import {
  AdminModalActions,
  Button,
  Input,
  Select,
  Badge,
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
import { APPROVED_VACCINE_NAMES } from "../constants/approvedVaccines";
import { useAuth } from "../contexts/AuthContext";
import PrintDateRangeControls from "./PrintDateRangeControls";
import usePrintDateRange from "../hooks/usePrintDateRange";
import {
  filterItemsByPrintDateRange,
  formatPrintDateRangeLabel,
  formatPrintDateValue,
  parseDateLikeValue,
  parseDateOnlyValue,
} from "../utils/printDateRange";
import {
  downloadWordDocument,
  PRINT_PAGE_PRESETS,
} from "../utils/printDocumentExport";

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
  { key: "inventory_summary", label: "Inventory Summary" },
  { key: "stock_movements", label: "Stock Movements" }
];

const INVENTORY_TABLE_PAGE_SIZE = 20;

const INVENTORY_DEFAULT_TAB_KEY = INVENTORY_TAB_CONFIG[0].key;
const INVENTORY_TAB_STORAGE_KEY = "admin.inventory.activeTab";

const INVENTORY_TAB_ALIASES = {
  inventory_sheet: "inventory_sheet",
  "inventory-sheet": "inventory_sheet",
  stock_movements: "stock_movements",
  "stock-movements": "stock_movements",
  movements: "stock_movements",
  transactions: "stock_movements",
  suppliers: "inventory_sheet",
  reports: "inventory_sheet",
  inventory_summary: "inventory_summary",
  "inventory-summary": "inventory_summary",
  summary: "inventory_summary",
  stock_alerts: "inventory_summary",
  "stock-alerts": "inventory_summary",
  alerts: "inventory_summary",
  vaccine_monitoring: "inventory_summary",
  "vaccine-monitoring": "inventory_summary",
  monitoring: "inventory_summary",
};

const INVENTORY_TAB_PANEL_IDS = {
  inventory_sheet: "inventory-panel-inventory-sheet",
  inventory_summary: "inventory-panel-inventory-summary",
  stock_movements: "inventory-panel-stock-movements",
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

const PRINT_REPORT_TYPES = {
  INVENTORY_SHEET: "inventory-sheet",
  DOH_LGU_STOCK_FORM: "doh-lgu-stock-form",
  REQUISITION_ISSUE_SLIP: "requisition-issue-slip",
};

const INVENTORY_VACCINE_MATCH_ALIASES = Object.freeze({
  BCG: ["bcg"],
  "Hepa B": ["hepa b", "hepatitis b", "hep b"],
  "Penta Valent": ["penta valent", "pentavalent", "pentavalent vaccine"],
  "OPV 20-doses": [
    "opv 20 doses",
    "opv 20-doses",
    "opv",
    "bopv",
    "bivalent oral polio vaccine",
  ],
  "PCV 13/PCV 10": ["pcv 13", "pcv13", "pcv 10", "pcv10", "pcv 13/pcv 10", "pcv"],
  MMR: ["mmr", "measles mumps rubella"],
  "IPV multi dose": ["ipv multi dose", "inactivated polio vaccine", "ipv"],
});

const PRINT_REPORT_COPY = {
  inventorySheetTitle: "EPI VACCINE AND OTHER LOGISTICS INVENTORY FORM",
  inventorySheetDepartment: "DEPARTMENT OF HEALTH (DOH)",
  inventorySheetProgram: "Expanded Program on Immunization",
  inventorySheetProcured: "Department of Health Procured",
  inventorySheetHealthCenterLabel: "HEALTH CENTER:",
  inventorySheetHealthCenterValue: "SAN NICOLAS HC",
  inventorySheetInventoryLine: "Inventory of Vaccines and Other Logistics",
  inventorySheetCodeLabel: "Code",
  inventorySheetMonthLine: "For the Month: JANUARY",
  dohLguTitle: "HEALTH FACILITY MONTHLY VACCINE STOCK INVENTORY REPORT",
  dohLguSubtitle: "DOH and LGU Utilization / Stock Inventory Form",
  risTitle: "REQUISITION AND ISSUE SLIP",
  risSubtitle: "(VACCINES AND SUPPLIES)",
  risMunicipality: "MUNICIPALITY OF PASIG",
};

const INVENTORY_PRINT_REPORT_OPTIONS = [
  {
    value: PRINT_REPORT_TYPES.INVENTORY_SHEET,
    label: "Inventory Sheet",
  },
  {
    value: PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM,
    label: "DOH/LGU Stock Form",
  },
  {
    value: PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP,
    label: "RIS Form",
  },
];

const INVENTORY_REPORT_DELIVERY_TYPES = Object.freeze({
  PRINT: "print",
  PDF: "pdf",
  WORD: "word",
});

const INVENTORY_REPORT_DELIVERY_OPTIONS = [
  {
    value: INVENTORY_REPORT_DELIVERY_TYPES.PRINT,
    label: "Print Preview",
  },
  {
    value: INVENTORY_REPORT_DELIVERY_TYPES.PDF,
    label: "PDF Document",
  },
  {
    value: INVENTORY_REPORT_DELIVERY_TYPES.WORD,
    label: "Word Document",
  },
];

const INVENTORY_REPORT_ORIENTATIONS = {
  [PRINT_REPORT_TYPES.INVENTORY_SHEET]: "landscape",
  [PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM]: "landscape",
  [PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP]: "portrait",
};

// Keep RIS exports portrait-only within the Inventory module so other
// document templates can continue using their existing page settings.
const RIS_EXPORT_PAGE = Object.freeze({
  orientation: "portrait",
  wordPagePreset: PRINT_PAGE_PRESETS.legalPortrait,
  pdfFormat: "legal",
  printPageSize: "legal portrait",
});

const INVENTORY_PRINT_PAGE_SIZES = {
  [PRINT_REPORT_TYPES.INVENTORY_SHEET]: "legal portrait",
  [PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM]: "legal landscape",
  [PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP]: RIS_EXPORT_PAGE.printPageSize,
};

const getInventoryReportOrientation = (reportType) =>
  INVENTORY_REPORT_ORIENTATIONS[reportType] ||
  INVENTORY_REPORT_ORIENTATIONS[PRINT_REPORT_TYPES.INVENTORY_SHEET];

const getInventoryReportWordPagePreset = (reportType) =>
  getInventoryReportOrientation(reportType) === "portrait"
    ? PRINT_PAGE_PRESETS.legalPortrait
    : PRINT_PAGE_PRESETS.legalLandscape;

const getInventoryPrintPageSize = (reportType) =>
  INVENTORY_PRINT_PAGE_SIZES[reportType] ||
  INVENTORY_PRINT_PAGE_SIZES[PRINT_REPORT_TYPES.INVENTORY_SHEET];

export const getInventoryReportPdfConfig = (reportType) => ({
  orientation:
    reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
      ? RIS_EXPORT_PAGE.orientation
      : getInventoryReportOrientation(reportType),
  format:
    reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
      ? RIS_EXPORT_PAGE.pdfFormat
      : "legal",
});

const normalizeInventoryMatchToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getInventoryMatchTokens = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return [];
  }

  const aliasValues = INVENTORY_VACCINE_MATCH_ALIASES[normalizedValue] || [];
  return [...new Set([normalizedValue, ...aliasValues].map(normalizeInventoryMatchToken).filter(Boolean))];
};

const inventoryNamesMatch = (leftValue, rightValue) => {
  const leftTokens = getInventoryMatchTokens(leftValue);
  const rightTokens = getInventoryMatchTokens(rightValue);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  return leftTokens.some((token) => rightTokens.includes(token));
};

const normalizeInventoryReportType = (value) =>
  INVENTORY_PRINT_REPORT_OPTIONS.some((option) => option.value === value)
    ? value
    : PRINT_REPORT_TYPES.INVENTORY_SHEET;

const normalizeStockAlertStatus = (value) => {
  const normalized = String(value || "ACTIVE").trim().toLowerCase();
  if (
    normalized === "acknowledged" ||
    normalized === "resolved" ||
    normalized === "active"
  ) {
    return normalized;
  }
  return "active";
};

const normalizeStockAlertRecord = (row = {}) => {
  const alertId = Number.parseInt(row.id, 10);
  const clinicId = Number.parseInt(row.clinic_id ?? row.facility_id, 10);
  const currentStock = Number(row.current_stock);
  const thresholdValue = Number(row.threshold_value);

  return {
    ...row,
    id: Number.isInteger(alertId) ? alertId : null,
    clinic_id: Number.isInteger(clinicId) ? clinicId : null,
    vaccine_name: row.vaccine_name || row.name || "Unknown vaccine",
    alert_type: String(row.alert_type || "").trim().toUpperCase(),
    status: normalizeStockAlertStatus(row.status),
    priority: String(row.priority || "").trim().toUpperCase(),
    current_stock: Number.isFinite(currentStock) ? currentStock : 0,
    threshold_value: Number.isFinite(thresholdValue) ? thresholdValue : 0,
  };
};

const formatStockAlertTypeLabel = (value) => {
  switch (String(value || "").trim().toUpperCase()) {
    case "CRITICAL_STOCK":
      return "Critical Stock";
    case "LOW_STOCK":
      return "Low Stock";
    case "OUT_OF_STOCK":
      return "Out of Stock";
    default:
      return "Stock Alert";
  }
};

const formatStockAlertStatusLabel = (value) => {
  switch (normalizeStockAlertStatus(value)) {
    case "acknowledged":
      return "Acknowledged";
    case "resolved":
      return "Resolved";
    case "active":
    default:
      return "Pending";
  }
};

const getStockAlertStatusVariant = (value) => {
  switch (normalizeStockAlertStatus(value)) {
    case "resolved":
      return "success";
    case "acknowledged":
      return "warning";
    case "active":
    default:
      return "info";
  }
};

const getStockAlertPriorityVariant = (value) => {
  switch (String(value || "").trim().toUpperCase()) {
    case "URGENT":
    case "HIGH":
      return "danger";
    case "MEDIUM":
      return "warning";
    case "LOW":
    default:
      return "secondary";
  }
};

const formatStockAlertTimestamp = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

const DOH_LGU_REPORT_LEFT_SEAL_SRC = "/stock-form-doh-seal.png";
const DOH_LGU_REPORT_RIGHT_SEAL_SRC = "/stock-form-pasig-seal.png";
const DOH_LGU_REPORT_FILENAME_PREFIX = "doh-lgu-stock-inventory-report";
const PASIG_REPORT_SEAL_SRC = DOH_LGU_REPORT_RIGHT_SEAL_SRC;
const DOH_REPORT_SEAL_SRC = DOH_LGU_REPORT_LEFT_SEAL_SRC;
const INVENTORY_SHEET_LEFT_LOGO_SRC = DOH_REPORT_SEAL_SRC;
const INVENTORY_SHEET_RIGHT_LOGO_SRC = "/san-nicolas-logo.jpg";
const INVENTORY_SHEET_ROWS_PER_PAGE = 18;
const INVENTORY_SHEET_COLUMN_WIDTH_PERCENTAGES = Object.freeze([
  4, 20, 9, 9, 14, 7, 7, 8, 9, 7, 6,
]);
const RIS_REPORT_FILENAME_PREFIX = "requisition-and-issue-slip";
const RIS_PRIVATE_CLINIC_VALUE = "(leave blank)";
const DOH_LGU_REPORT_ITEMS = [
  { rowNumber: "1", label: "BCG", aliases: ["bcg"] },
  {
    rowNumber: "2",
    label: "Hepatitis B",
    aliases: ["hepatitis b", "hepa b"],
  },
  {
    rowNumber: "3",
    label: "Pentavalent Vaccine (DPT-HepaB-Hib Vaccine)",
    aliases: [
      "pentavalent vaccine",
      "dpt hepab hib vaccine",
      "penta valent",
      "pentavalent",
    ],
  },
  {
    rowNumber: "4",
    label: "Bivalent Oral Polio Vaccine (bOPV)",
    aliases: ["bivalent oral polio vaccine", "bopv", "opv 20 doses", "opv"],
  },
  {
    rowNumber: "5",
    label: "Inactivated Polio Vaccine",
    aliases: ["inactivated polio vaccine", "ipv multi dose", "ipv"],
  },
  {
    rowNumber: "6",
    label: "Pneumococcal Conjugate Vaccine (PCV 13/PCV 10)",
    aliases: [
      "pneumococcal conjugate vaccine",
      "pcv 10",
      "pcv10",
      "pcv 13",
      "pcv13",
      "pcv 13/pcv 10",
      "pcv",
    ],
  },
  {
    rowNumber: "7",
    label: "Measles, Mumps and Rubella (MMR)",
    aliases: ["measles mumps and rubella", "mmr"],
  },
  {
    rowNumber: "9",
    label: "Tetanus Diphtheria (TD) Toxoid Vaccine",
    aliases: ["tetanus diphtheria td toxoid vaccine", "td toxoid", "td"],
  },
  {
    rowNumber: "10",
    label: "Human Papillomavirus Vaccine (HPV)",
    aliases: ["human papillomavirus vaccine", "hpv"],
  },
  {
    rowNumber: "11",
    label: "Influenza / Flu Vaccine",
    aliases: ["influenza", "flu vaccine"],
  },
  {
    rowNumber: "12",
    label: "Pneumococcal Polysaccharide Vaccine (PPV23)",
    aliases: ["pneumococcal polysaccharide vaccine", "ppv23"],
  },
  {
    rowNumber: "13",
    label: "Hexaxim",
    aliases: ["hexaxim", "hexavalent"],
  },
  {
    rowNumber: "14",
    label: "Tetanus Toxoid (TT)",
    aliases: ["tetanus toxoid", "tt"],
  },
];

const RIS_PRIMARY_REPORT_ITEMS = [
  {
    key: "bcg",
    label: "BCG, 20 DOSES",
    unit: "VIAL",
    aliases: ["bcg"],
  },
  {
    key: "bcg-diluent",
    label: "BCG, diluent, 1 ml",
    unit: "VIAL",
    aliases: ["bcg diluent", "diluent"],
  },
  {
    key: "hepab",
    label: "Hepa B 0.5ml / 10 doses",
    unit: "VIAL",
    aliases: ["hepa b", "hepatitis b", "hep b"],
  },
  {
    key: "pentavalent",
    label: "Penta Valent 0.5ml single dose",
    unit: "VIAL",
    aliases: ["penta valent", "pentavalent", "pentavalent vaccine"],
  },
  {
    key: "opv",
    label: "OPV 20-doses",
    unit: "VIAL",
    aliases: ["opv 20 doses", "opv", "bopv", "bivalent oral polio vaccine"],
  },
  {
    key: "opv-dropper",
    label: "OPV DROPPER",
    unit: "PCS",
    aliases: ["opv dropper", "dropper"],
  },
  {
    key: "pcv",
    label: "PCV 13 / PCV 10",
    unit: "VIAL",
    aliases: ["pcv 13", "pcv 10", "pcv13", "pcv10", "pcv 13 / pcv 10", "pcv", "pcv 13/pcv 10"],
  },
  {
    key: "mmr",
    label: "MMR 0.5ml dose / 10 doses",
    unit: "VIAL",
    aliases: ["mmr"],
  },
  {
    key: "mmr-diluent",
    label: "MMR, diluent 5 ml",
    unit: "VIAL",
    aliases: ["mmr diluent", "diluent 5ml"],
  },
  {
    key: "ipv",
    label: "IPV multi dose 10 vial",
    unit: "VIAL",
    aliases: ["ipv multi dose", "ipv"],
  },
  {
    key: "hpv",
    label: "HPV",
    unit: "VIAL",
    aliases: ["hpv", "human papillomavirus vaccine"],
  },
  {
    key: "td",
    label: "Tetanus Diphtheria - (TD) 0.5ml multi dose",
    unit: "AMPULL",
    aliases: ["tetanus diphtheria", "td toxoid", "td"],
  },
  {
    key: "tt",
    label: "Tetanus Toxoid - (TT) Single Dose",
    unit: "AMPULL",
    aliases: ["tetanus toxoid", "tt"],
  },
  {
    key: "syringe-005",
    label: "Syringe w/ needle 0.05ml G.27x10mm",
    unit: "PCS",
    aliases: ["syringe w needle 0 05ml", "0.05ml syringe", "g27x10mm"],
  },
  {
    key: "auto-disable-05",
    label: "Auto disable syringe with needle 0.5ml G.23 x 10mm",
    unit: "PCS",
    aliases: ["auto disable syringe", "0.5ml syringe", "g23 x 10mm"],
  },
  {
    key: "mixing-1ml-25",
    label: "Mixing syringe 1ml G.25 x 5/8 (1cc)",
    unit: "PCS",
    aliases: ["mixing syringe 1ml g25", "1ml g25 x 5 8", "1cc g25"],
  },
  {
    key: "mixing-1ml-23",
    label: "Mixing syringe 1ml G.23 x 1 (1cc)",
    unit: "PCS",
    aliases: ["mixing syringe 1ml g23", "1ml g23 x 1", "1cc g23"],
  },
  {
    key: "mixing-5ml-18",
    label: "Mixing syringe 5ml G.18 x 50mm (5cc)",
    unit: "PCS",
    aliases: ["mixing syringe 5ml g18", "5ml g18 x 50mm", "5cc g18"],
  },
];

const RIS_REQUEST_KEYS = [
  "request_quantity",
  "requested_quantity",
  "requisition_qty",
  "request_qty",
  "requested_qty",
  "health_center_request_qty",
];

const RIS_ISSUED_KEYS = [
  "issued_by_cho_qty",
  "cho_issued_quantity",
  "issued_quantity",
  "issued_qty",
  "issued_from_cho_qty",
  "cho_qty",
];

const RIS_TOTAL_KEYS = [
  "fulfilled_quantity",
  "total_quantity",
  "total_qty",
];

const RIS_CONTROL_NUMBER_KEYS = [
  "ris_control_number",
  "requisition_control_number",
  "request_control_number",
  "slip_control_number",
  "control_number",
];

const RIS_REPORT_VALUE_KEYS = [
  ...new Set([
    ...RIS_REQUEST_KEYS,
    ...RIS_ISSUED_KEYS,
    ...RIS_TOTAL_KEYS,
    ...RIS_CONTROL_NUMBER_KEYS,
  ]),
];

const normalizeInventoryNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getInventoryActorDisplayName = (user = {}) => {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  return (
    String(
      user.display_name ||
        user.role_display_name ||
        user.name ||
        user.username ||
        "",
    ).trim() || null
  );
};

const formatInventoryActorRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const decodeInventoryHtmlEntities = (value, maxPasses = 3) => {
  if (value === undefined || value === null) {
    return "";
  }

  let decodedValue = String(value);
  const safeMaxPasses =
    Number.isInteger(maxPasses) && maxPasses > 0 ? maxPasses : 1;

  const decodeCodePoint = (rawValue, radix, fallbackMatch) => {
    const parsedValue = Number.parseInt(rawValue, radix);
    if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 0x10ffff) {
      return fallbackMatch;
    }

    try {
      return String.fromCodePoint(parsedValue);
    } catch (_error) {
      return fallbackMatch;
    }
  };

  for (let passIndex = 0; passIndex < safeMaxPasses; passIndex += 1) {
    const previousValue = decodedValue;

    decodedValue = decodedValue
      .replace(/&#(\d+);/g, (match, numericValue) =>
        decodeCodePoint(numericValue, 10, match),
      )
      .replace(/&#x([0-9a-f]+);/gi, (match, numericValue) =>
        decodeCodePoint(numericValue, 16, match),
      )
      .replace(/&(amp|apos|gt|lt|quot);/gi, (match, entityName) => {
        switch (entityName.toLowerCase()) {
          case "amp":
            return "&";
          case "apos":
            return "'";
          case "gt":
            return ">";
          case "lt":
            return "<";
          case "quot":
            return '"';
          default:
            return match;
        }
      });

    if (decodedValue === previousValue) {
      break;
    }
  }

  return decodedValue;
};

const normalizeInventoryMovementType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || "UNKNOWN";
};

const INVENTORY_MOVEMENT_TYPE_META = Object.freeze({
  RECEIVE: { label: "Receive", badgeVariant: "success", accentClass: "text-green-700 dark:text-green-300", quantityPrefix: "+" },
  RECEIPT: { label: "Receipt", badgeVariant: "success", accentClass: "text-green-700 dark:text-green-300", quantityPrefix: "+" },
  ISSUE: { label: "Issue", badgeVariant: "info", accentClass: "text-blue-700 dark:text-blue-300", quantityPrefix: "-" },
  WASTE: { label: "Waste", badgeVariant: "danger", accentClass: "text-red-700 dark:text-red-300", quantityPrefix: "-" },
  WASTAGE: { label: "Wastage", badgeVariant: "danger", accentClass: "text-red-700 dark:text-red-300", quantityPrefix: "-" },
  EXPIRE: { label: "Expired", badgeVariant: "danger", accentClass: "text-red-700 dark:text-red-300", quantityPrefix: "-" },
  TRANSFER_IN: { label: "Transfer In", badgeVariant: "primary", accentClass: "text-purple-700 dark:text-purple-300", quantityPrefix: "+" },
  TRANSFER_OUT: { label: "Transfer Out", badgeVariant: "warning", accentClass: "text-orange-700 dark:text-orange-300", quantityPrefix: "-" },
  ADJUST: { label: "Adjustment", badgeVariant: "secondary", accentClass: "text-gray-700 dark:text-gray-300", quantityPrefix: "" },
  ADJUSTMENT: { label: "Adjustment", badgeVariant: "secondary", accentClass: "text-gray-700 dark:text-gray-300", quantityPrefix: "" },
});

const getInventoryMovementTypeMeta = (type) => {
  const normalizedType = normalizeInventoryMovementType(type);
  return (
    INVENTORY_MOVEMENT_TYPE_META[normalizedType] || {
      label: normalizedType.replace(/_/g, " "),
      badgeVariant: "secondary",
      accentClass: "text-gray-700 dark:text-gray-300",
      quantityPrefix: "",
    }
  );
};

const normalizeInventoryMovementRecord = (row = {}) => {
  const quantity = normalizeInventoryNumber(row.quantity ?? row.qty, 0);
  const previousBalance = normalizeInventoryNumber(row.previous_balance, 0);
  const newBalance = normalizeInventoryNumber(
    row.new_balance,
    previousBalance,
  );
  const referenceNumber = decodeInventoryHtmlEntities(
    row.reference_number ?? row.reference ?? row.transaction_number ?? null,
  ).trim();
  const notes = decodeInventoryHtmlEntities(row.notes ?? null).trim();
  const performedByName = decodeInventoryHtmlEntities(
    row.performed_by_name ?? null,
  ).trim();
  const performedByUsername = decodeInventoryHtmlEntities(
    row.performed_by_username ?? row.user_name ?? row.username ?? null,
  ).trim();
  const performedByRole = decodeInventoryHtmlEntities(
    row.performed_by_role ?? row.role_name ?? row.user_role ?? null,
  ).trim();

  return {
    ...row,
    id:
      row.id ??
      row.transaction_id ??
      row.reference_number ??
      `${row.vaccine_id || row.vaccine_name || "movement"}-${row.created_at || row.transaction_date || ""}-${row.transaction_type || row.txn_type || row.type || ""}`,
    transaction_type: normalizeInventoryMovementType(
      row.transaction_type ?? row.txn_type ?? row.type,
    ),
    quantity,
    previous_balance: previousBalance,
    new_balance: newBalance,
    vaccine_name:
      row.vaccine_name ?? row.product_name ?? row.name ?? "Unknown vaccine",
    lot_batch_number:
      row.lot_batch_number ??
      row.batch_number ??
      row.lot_number ??
      row.lot_no ??
      null,
    reference_number: referenceNumber || null,
    notes: notes || null,
    created_at: row.created_at ?? row.transaction_date ?? row.date ?? null,
    performed_by_name: performedByName || null,
    performed_by_username: performedByUsername || null,
    performed_by_role: performedByRole || null,
  };
};

const formatInventoryMovementDate = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

const formatInventoryBatchDate = (value) => {
  if (!value) {
    return "No expiry";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "No expiry";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInventoryBatchSearchText = (batch) =>
  [
    batch?.lot_number,
    batch?.batch_number,
    batch?.vaccine_name,
    batch?.storage_location,
    batch?.expiry_date,
    batch?.available_quantity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const createDefaultInventoryDisplayFilters = () => ({
  startDate: "",
  endDate: "",
  vaccine: "all",
  status: "all",
});

const createDefaultStockMovementFilters = () => ({
  startDate: "",
  endDate: "",
  type: "all",
  vaccine: "all",
});

const INVENTORY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "critical", label: "Critical / Out" },
  { value: "expired", label: "Expired" },
  { value: "with_waste", label: "With Waste" },
];

const hasDisplayDateRangeValue = ({ startDate = "", endDate = "" } = {}) =>
  Boolean(String(startDate || "").trim() || String(endDate || "").trim());

const matchesOptionalDateRange = (
  candidateValues = [],
  { startDate = "", endDate = "" } = {},
) => {
  const parsedStart = parseDateOnlyValue(startDate);
  const parsedEnd = parseDateOnlyValue(endDate, { endOfDay: true });

  if (!parsedStart && !parsedEnd) {
    return true;
  }

  return []
    .concat(candidateValues || [])
    .some((candidateValue) => {
      const parsedCandidate = parseDateLikeValue(candidateValue);
      if (!parsedCandidate) {
        return false;
      }

      if (parsedStart && parsedCandidate.getTime() < parsedStart.getTime()) {
        return false;
      }

      if (parsedEnd && parsedCandidate.getTime() > parsedEnd.getTime()) {
        return false;
      }

      return true;
    });
};

const matchesInventoryStatusFilter = (item = {}, status = "all") => {
  const normalizedStatus = String(status || "all").trim().toLowerCase();
  const stockOnHand = Number(item.stock_on_hand || 0);
  const criticalThreshold = Number(item.critical_stock_threshold || 5);
  const lowThreshold = Number(item.low_stock_threshold || 10);

  switch (normalizedStatus) {
    case "in_stock":
      return stockOnHand > 0;
    case "low_stock":
      return stockOnHand <= lowThreshold && stockOnHand > criticalThreshold;
    case "critical":
      return stockOnHand <= criticalThreshold;
    case "expired":
      return isExpiredInventoryDate(item.expiry_date);
    case "with_waste":
      return Number(item.expired_wasted || 0) > 0;
    default:
      return true;
  }
};

const summarizeStockMovements = (rows = []) =>
  rows.reduce(
    (result, movement) => {
      const type = normalizeInventoryMovementType(movement.transaction_type);
      const quantity = Math.abs(normalizeInventoryNumber(movement.quantity, 0));

      result.totalRecords += 1;

      switch (type) {
        case "RECEIVE":
        case "RECEIPT":
        case "TRANSFER_IN":
          result.stockIn += quantity;
          break;
        case "ISSUE":
        case "TRANSFER_OUT":
          result.stockOut += quantity;
          break;
        case "WASTE":
        case "WASTAGE":
        case "EXPIRE":
          result.wasted += quantity;
          break;
        default:
          break;
      }

      return result;
    },
    {
      totalRecords: 0,
      stockIn: 0,
      stockOut: 0,
      wasted: 0,
    },
  );

function InventoryDisplayToolbarFilters({
  filters,
  vaccineOptions,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  selectedReportType,
  onReportTypeChange,
  showDivider = true,
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 xl:justify-end">
      {showDivider ? (
        <>
          <div className="hidden h-10 w-px self-end bg-gray-200 dark:bg-gray-700 xl:block" />
          <div className="hidden self-end pb-2 2xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Inventory Filters
            </p>
          </div>
        </>
      ) : null}
      <Input
        label="From Date"
        type="date"
        value={filters.startDate}
        onChange={(event) => onFilterChange("startDate", event.target.value)}
        className="text-sm"
        containerClassName="w-full sm:w-[160px] xl:w-[144px]"
      />
      <Input
        label="To Date"
        type="date"
        value={filters.endDate}
        onChange={(event) => onFilterChange("endDate", event.target.value)}
        className="text-sm"
        containerClassName="w-full sm:w-[160px] xl:w-[144px]"
      />
      <Select
        label="Vaccine"
        value={filters.vaccine}
        onChange={(event) => onFilterChange("vaccine", event.target.value)}
        options={vaccineOptions}
        className="text-sm"
        containerClassName="w-full sm:w-[188px] xl:w-[172px]"
      />
      <Select
        label="Status"
        value={filters.status}
        onChange={(event) => onFilterChange("status", event.target.value)}
        options={INVENTORY_STATUS_FILTER_OPTIONS}
        className="text-sm"
        containerClassName="w-full sm:w-[188px] xl:w-[172px]"
      />
      {typeof onReportTypeChange === "function" ? (
        <Select
          label="Report Format"
          value={selectedReportType}
          onChange={(event) => onReportTypeChange(event.target.value)}
          options={INVENTORY_PRINT_REPORT_OPTIONS}
          className="text-sm"
          containerClassName="w-full sm:w-[220px] xl:w-[196px]"
        />
      ) : null}
      <div className="flex items-center gap-2 self-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className="min-h-[40px] whitespace-nowrap"
        >
          Clear Filters
        </Button>
      </div>
    </div>
  );
}

function StockMovementToolbarFilters({
  filters,
  typeOptions,
  vaccineOptions,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  showDivider = true,
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 xl:justify-end">
      {showDivider ? (
        <>
          <div className="hidden h-10 w-px self-end bg-gray-200 dark:bg-gray-700 xl:block" />
          <div className="hidden self-end pb-2 2xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Stock Movement Filters
            </p>
          </div>
        </>
      ) : null}
      <Input
        label="From Date"
        type="date"
        value={filters.startDate}
        onChange={(event) => onFilterChange("startDate", event.target.value)}
        className="text-sm"
        containerClassName="w-full sm:w-[160px] xl:w-[144px]"
      />
      <Input
        label="To Date"
        type="date"
        value={filters.endDate}
        onChange={(event) => onFilterChange("endDate", event.target.value)}
        className="text-sm"
        containerClassName="w-full sm:w-[160px] xl:w-[144px]"
      />
      <Select
        label="Type"
        value={filters.type}
        onChange={(event) => onFilterChange("type", event.target.value)}
        options={typeOptions}
        className="text-sm"
        containerClassName="w-full sm:w-[176px] xl:w-[160px]"
      />
      <Select
        label="Vaccine"
        value={filters.vaccine}
        onChange={(event) => onFilterChange("vaccine", event.target.value)}
        options={vaccineOptions}
        className="text-sm"
        containerClassName="w-full sm:w-[188px] xl:w-[172px]"
      />
      <div className="flex items-center gap-2 self-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className="min-h-[40px] whitespace-nowrap"
        >
          Clear Filters
        </Button>
      </div>
    </div>
  );
}

function InventoryActiveTabToolbarFilters({
  activeTab,
  inventoryFilters,
  inventoryVaccineOptions,
  onInventoryFilterChange,
  onClearInventoryFilters,
  hasActiveInventoryFilters,
  stockMovementFilters,
  stockMovementTypeOptions,
  stockMovementVaccineOptions,
  onStockMovementFilterChange,
  onClearStockMovementFilters,
  hasActiveStockMovementFilters,
  selectedReportType,
  onReportTypeChange,
  onSaveInventory,
  onPrintReport,
  onGenerateReport,
  showDivider = true,
}) {
  if (activeTab === "stock_movements") {
    return (
      <StockMovementToolbarFilters
        filters={stockMovementFilters}
        typeOptions={stockMovementTypeOptions}
        vaccineOptions={stockMovementVaccineOptions}
        onFilterChange={onStockMovementFilterChange}
        onClearFilters={onClearStockMovementFilters}
        hasActiveFilters={hasActiveStockMovementFilters}
        showDivider={showDivider}
      />
    );
  }

  const inventoryControls = (
    <InventoryDisplayToolbarFilters
      filters={inventoryFilters}
      vaccineOptions={inventoryVaccineOptions}
      onFilterChange={onInventoryFilterChange}
      onClearFilters={onClearInventoryFilters}
      hasActiveFilters={hasActiveInventoryFilters}
      selectedReportType={selectedReportType}
      onReportTypeChange={onReportTypeChange}
      showDivider={showDivider}
    />
  );

  if (activeTab !== "inventory_sheet") {
    return inventoryControls;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 xl:justify-end">
      {inventoryControls}
      <div className="flex items-center gap-2 self-end">
        {typeof onSaveInventory === "function" ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSaveInventory}
            className="min-h-[40px] whitespace-nowrap"
          >
            Save Inventory
          </Button>
        ) : null}
        {typeof onPrintReport === "function" ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPrintReport()}
            className="min-h-[40px] whitespace-nowrap"
          >
            Print Report
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          onClick={onGenerateReport}
          className="min-h-[40px] whitespace-nowrap"
        >
          Generate Report
        </Button>
      </div>
    </div>
  );
}

function InventoryHeaderTabs({
  activeTab,
  onTabChange,
  criticalAlertCount = 0,
}) {
  return (
    <div className="flex space-x-2 overflow-x-auto rounded-xl border border-white/10 bg-white/20 p-1.5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/50">
      <button
        onClick={() => onTabChange("inventory_sheet")}
        aria-pressed={activeTab === "inventory_sheet"}
        data-tab-key="inventory_sheet"
        className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
          activeTab === "inventory_sheet"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        Inventory Sheet
      </button>
      <button
        onClick={() => onTabChange("inventory_summary")}
        aria-pressed={activeTab === "inventory_summary"}
        data-tab-key="inventory_summary"
        className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
          activeTab === "inventory_summary"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span>Inventory Summary</span>
        {criticalAlertCount > 0 ? (
          <span
            className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs ${
              activeTab === "inventory_summary"
                ? "bg-red-100 text-red-600"
                : "bg-white/20 text-white"
            }`}
          >
            {criticalAlertCount}
          </span>
        ) : null}
      </button>
      <button
        onClick={() => onTabChange("stock_movements")}
        aria-pressed={activeTab === "stock_movements"}
        data-tab-key="stock_movements"
        className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
          activeTab === "stock_movements"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        Stock Movements
      </button>
    </div>
  );
}

function InventoryPaginationFooter({
  currentPage,
  itemsPerPage,
  totalItems,
  itemLabel,
  onPrevious,
  onNext,
  className = "",
  testId,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div
      data-testid={testId}
      className={`flex flex-shrink-0 items-center justify-between border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 ${className}`.trim()}
    >
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing {startIndex} to {endIndex} of {totalItems} {itemLabel}
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrevious}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function StockMovementsPanel({
  movements,
  loading,
  error,
  onRetry,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const summary = useMemo(
    () => summarizeStockMovements(movements),
    [movements],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(movements.length / INVENTORY_TABLE_PAGE_SIZE),
  );
  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * INVENTORY_TABLE_PAGE_SIZE;
    return movements.slice(
      startIndex,
      startIndex + INVENTORY_TABLE_PAGE_SIZE,
    );
  }, [currentPage, movements]);

  useEffect(() => {
    setCurrentPage(1);
  }, [movements]);

  if (loading && movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 print:hidden">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          Loading stock movement history...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 print:hidden">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Movement Records
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {summary.totalRecords.toLocaleString()}
          </p>
        </Card>
        <Card className="border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Stock In
          </p>
          <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-200">
            {summary.stockIn.toLocaleString()}
          </p>
        </Card>
        <Card className="border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Stock Out
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">
            {summary.stockOut.toLocaleString()}
          </p>
        </Card>
        <Card className="border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Wasted / Expired
          </p>
          <p className="mt-2 text-2xl font-bold text-red-900 dark:text-red-200">
            {summary.wasted.toLocaleString()}
          </p>
        </Card>
      </div>

      {error && (
        <Alert variant="warning" title="Stock movement history unavailable">
          <div className="space-y-3">
            <p>{error}</p>
            <Button onClick={onRetry} size="sm" variant="outline">
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Stock Movement History
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Stock in/out transactions recorded for vaccine inventory.
              </p>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? "Refreshing..." : `${movements.length} entries`}
            </div>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-auto auto-hide-scrollbar"
          data-testid="stock-movements-scroll-region"
        >
          <div className="min-w-full">
            <table className="min-w-full">
              <thead className="sticky top-0 z-10 bg-white shadow-sm dark:bg-gray-900">
                <tr>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Date
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Type
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Vaccine
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Quantity
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Balance
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Lot / Batch
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Reference / Notes
                  </th>
                  <th className="bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    Performed By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No stock movement transactions match the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((movement) => {
                    const typeMeta = getInventoryMovementTypeMeta(
                      movement.transaction_type,
                    );
                    const numericQuantity = normalizeInventoryNumber(
                      movement.quantity,
                      0,
                    );
                    const quantityLabel = typeMeta.quantityPrefix
                      ? `${typeMeta.quantityPrefix}${Math.abs(numericQuantity).toLocaleString()}`
                      : `${numericQuantity > 0 ? "+" : ""}${numericQuantity.toLocaleString()}`;
                    const performerPrimaryLabel =
                      movement.performed_by_username ||
                      movement.performed_by_name ||
                      "-";
                    const performerRoleLabel = formatInventoryActorRole(
                      movement.performed_by_role,
                    );

                    return (
                      <tr
                        key={movement.id}
                        className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/80"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatInventoryMovementDate(movement.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={typeMeta.badgeVariant}>
                            {typeMeta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {movement.vaccine_name}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          <span className={typeMeta.accentClass}>{quantityLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {`${normalizeInventoryNumber(movement.previous_balance, 0).toLocaleString()} -> ${normalizeInventoryNumber(movement.new_balance, 0).toLocaleString()}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {movement.lot_batch_number || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="space-y-1">
                            <div>{movement.reference_number || "-"}</div>
                            {movement.notes ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {movement.notes}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {performerPrimaryLabel}
                            </div>
                            {performerRoleLabel ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {performerRoleLabel}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <InventoryPaginationFooter
          testId="stock-movements-pagination"
          currentPage={currentPage}
          itemsPerPage={INVENTORY_TABLE_PAGE_SIZE}
          totalItems={movements.length}
          itemLabel="entries"
          onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNext={() =>
            setCurrentPage((page) => Math.min(totalPages, page + 1))
          }
        />
      </Card>
    </div>
  );
}

function InventoryPrintPortal({ children }) {
  const [portalNode, setPortalNode] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const existingNode = document.getElementById("inventory-print-root");
    const node = existingNode || document.createElement("div");
    node.id = "inventory-print-root";

    if (!existingNode) {
      document.body.appendChild(node);
    }

    setPortalNode(node);

    return () => {
      if (!existingNode && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    };
  }, []);

  return portalNode ? createPortal(children, portalNode) : null;
}

const resolveInventoryVaccineMatch = (item = {}, vaccine = {}) => {
  if (!item || !vaccine) {
    return false;
  }

  const normalizedItemVaccineId = normalizeInventoryNumber(item._vaccineId, null);
  const normalizedVaccineId = normalizeInventoryNumber(vaccine.id, null);

  if (
    Number.isInteger(normalizedItemVaccineId) &&
    Number.isInteger(normalizedVaccineId) &&
    normalizedItemVaccineId === normalizedVaccineId
  ) {
    return true;
  }

  const itemCode = String(item.code || "").trim().toUpperCase();
  const vaccineCode = String(vaccine.code || "").trim().toUpperCase();
  if (itemCode && vaccineCode && itemCode === vaccineCode) {
    return true;
  }

  return inventoryNamesMatch(item.name, vaccine.name);
};

const normalizeInventoryRecord = (source = {}, fallback = {}) => {
  const beginningBalance = normalizeInventoryNumber(
    source.beginning_balance ?? fallback.beginning_balance,
  );
  const received = normalizeInventoryNumber(
    source.received_during_period ?? source.received ?? fallback.received,
  );
  const transferredIn = normalizeInventoryNumber(
    source.transferred_in ?? fallback.transferred_in,
  );
  const transferredOut = normalizeInventoryNumber(
    source.transferred_out ?? fallback.transferred_out,
  );
  const expiredWasted = normalizeInventoryNumber(
    source.expired_wasted ?? fallback.expired_wasted,
  );
  const issuance = normalizeInventoryNumber(source.issuance ?? fallback.issuance);
  const totalAvailable = normalizeInventoryNumber(
    source.total_available ?? fallback.total_available,
    beginningBalance + received,
  );
  const stockOnHand = normalizeInventoryNumber(
    source.stock_on_hand ?? fallback.stock_on_hand,
    totalAvailable + transferredIn - transferredOut - expiredWasted - issuance,
  );

  const normalized = {
    ...fallback,
    id:
      source.id ??
      fallback.id ??
      source.vaccine_id ??
      source.vaccine_name ??
      fallback.name ??
      "",
    name:
      String(
        source.vaccine_name ?? source.name ?? fallback.name ?? "",
      ).trim() || "Unnamed item",
    unit: source.unit ?? fallback.unit ?? "vials",
    beginning_balance: beginningBalance,
    received,
    lot_batch_number:
      source.lot_batch_number ?? source.lot_number ?? fallback.lot_batch_number ?? "",
    expiry_date: source.expiry_date ?? fallback.expiry_date ?? "",
    received_date:
      source.received_date ?? source.receipt_date ?? fallback.received_date ?? "",
    received_from:
      source.received_from ??
      source.supplier_name ??
      fallback.received_from ??
      "",
    received_reference:
      source.received_reference ?? fallback.received_reference ?? "",
    transferred_in: transferredIn,
    transferred_in_date:
      source.transferred_in_date ?? fallback.transferred_in_date ?? "",
    transferred_in_source:
      source.transferred_in_source ?? fallback.transferred_in_source ?? "",
    transferred_out: transferredOut,
    transferred_out_date:
      source.transferred_out_date ?? fallback.transferred_out_date ?? "",
    transferred_out_destination:
      source.transferred_out_destination ??
      fallback.transferred_out_destination ??
      "",
    expired_wasted: expiredWasted,
    issuance,
    issuance_date: source.issuance_date ?? fallback.issuance_date ?? "",
    stock_in: normalizeInventoryNumber(source.stock_in ?? fallback.stock_in),
    stock_out: normalizeInventoryNumber(source.stock_out ?? fallback.stock_out),
    total_available: totalAvailable,
    stock_on_hand: stockOnHand,
    low_stock_threshold: normalizeInventoryNumber(
      source.low_stock_threshold ?? fallback.low_stock_threshold,
      10,
    ),
    critical_stock_threshold: normalizeInventoryNumber(
      source.critical_stock_threshold ?? fallback.critical_stock_threshold,
      5,
    ),
    last_transaction_date:
      source.last_transaction_date ??
      source.transferred_out_date ??
      source.received_date ??
      source.transferred_in_date ??
      source.issuance_date ??
      source.updated_at ??
      source.created_at ??
      fallback.last_transaction_date ??
      "",
    _apiId: source.id ?? fallback._apiId,
    _vaccineId: source.vaccine_id ?? fallback._vaccineId ?? null,
    _facilityId:
      source.clinic_id ??
      source.facility_id ??
      fallback._facilityId ??
      null,
  };

  RIS_REPORT_VALUE_KEYS.forEach((key) => {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      normalized[key] = source[key];
    } else if (
      fallback[key] !== undefined &&
      fallback[key] !== null &&
      fallback[key] !== ""
    ) {
      normalized[key] = fallback[key];
    }
  });

  return normalized;
};

const aggregateInventoryRecordsByVaccine = (
  records = [],
  vaccineItems = [],
  fallbackFacilityId = null,
) =>
  vaccineItems.map((item) => {
    const matchingRows = records.filter((record) => {
      const recordVaccineId = resolveInventorySaveRowId(record?._vaccineId);
      const itemVaccineId = resolveInventorySaveRowId(item?._vaccineId);

      if (recordVaccineId && itemVaccineId && recordVaccineId === itemVaccineId) {
        return true;
      }

      return inventoryNamesMatch(record?.name, item?.name);
    });

    if (matchingRows.length === 0) {
      return normalizeInventoryRecord(
        {},
        {
          ...item,
          _facilityId: fallbackFacilityId,
        },
      );
    }

    const latestRow = [...matchingRows].sort((left, right) => {
      const leftTimestamp = new Date(
        left?.last_transaction_date || left?.updated_at || left?.created_at || 0,
      ).getTime();
      const rightTimestamp = new Date(
        right?.last_transaction_date || right?.updated_at || right?.created_at || 0,
      ).getTime();

      return rightTimestamp - leftTimestamp;
    })[0];

    const aggregated = matchingRows.reduce(
      (accumulator, row) => ({
        beginning_balance:
          accumulator.beginning_balance + normalizeInventoryNumber(row.beginning_balance),
        received:
          accumulator.received + normalizeInventoryNumber(row.received),
        transferred_in:
          accumulator.transferred_in + normalizeInventoryNumber(row.transferred_in),
        transferred_out:
          accumulator.transferred_out + normalizeInventoryNumber(row.transferred_out),
        expired_wasted:
          accumulator.expired_wasted + normalizeInventoryNumber(row.expired_wasted),
        issuance: accumulator.issuance + normalizeInventoryNumber(row.issuance),
        stock_in: accumulator.stock_in + normalizeInventoryNumber(row.stock_in),
        stock_out: accumulator.stock_out + normalizeInventoryNumber(row.stock_out),
        total_available:
          accumulator.total_available + normalizeInventoryNumber(row.total_available),
        stock_on_hand:
          accumulator.stock_on_hand + normalizeInventoryNumber(row.stock_on_hand),
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

    return normalizeInventoryRecord(
      {
        ...latestRow,
        ...aggregated,
        lot_batch_number:
          matchingRows.length > 1
            ? `MULTIPLE LOTS (${matchingRows.length})`
            : latestRow?.lot_batch_number || "",
      },
      {
        ...item,
        _vaccineId: latestRow?._vaccineId || null,
        _facilityId: latestRow?._facilityId || fallbackFacilityId,
      },
    );
  });

const getInventoryReportFieldValue = (item = {}, keys = []) => {
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(item, key) &&
      item[key] !== undefined &&
      item[key] !== null &&
      String(item[key]).trim() !== ""
    ) {
      return item[key];
    }
  }

  return "";
};

const getInventoryReportNumericValue = (item = {}, keys = []) => {
  const value = getInventoryReportFieldValue(item, keys);
  if (value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeInventoryUnitLabel = (value, fallback = "VIAL") => {
  const normalized = normalizeInventoryReportText(value);

  if (!normalized) {
    return fallback;
  }

  if (/(ampul|ampoule|ampull)/.test(normalized)) {
    return "AMPULL";
  }

  if (/(piece|pcs|pc|dropper|syringe)/.test(normalized)) {
    return "PCS";
  }

  if (/(dose|doses|vial|vials)/.test(normalized)) {
    return "VIAL";
  }

  return String(value).trim().toUpperCase() || fallback;
};

const hasInventoryReportActivity = (row = {}) =>
  [
    row.beginning_balance,
    row.received,
    row.transferred_in,
    row.transferred_out,
    row.expired_wasted,
    row.issuance,
    row.total_available,
    row.stock_on_hand,
  ].some((value) => normalizeInventoryNumber(value) > 0) ||
  Boolean(
    row.lot_batch_number ||
      row.expiry_date ||
      row.received_date ||
      row.transferred_in_date ||
      row.transferred_out_date ||
      row.issuance_date,
  );

const formatRisQuantityDisplay = (value, { showZero = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    return showZero ? "0" : "";
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric === 0 && !showZero) {
      return "";
    }

    return Number.isInteger(numeric) ? String(numeric) : String(numeric);
  }

  return String(value).trim();
};

const sumRisReportValues = (
  matchedRows = [],
  {
    explicitKeys = [],
    fallbackSelector = () => 0,
  } = {},
) => {
  let hasExplicitValues = false;
  let explicitTotal = 0;

  matchedRows.forEach((row) => {
    const explicitValue = getInventoryReportNumericValue(row, explicitKeys);
    if (explicitValue !== null) {
      hasExplicitValues = true;
      explicitTotal += explicitValue;
    }
  });

  if (hasExplicitValues) {
    return explicitTotal;
  }

  return matchedRows.reduce(
    (total, row) => total + normalizeInventoryNumber(fallbackSelector(row)),
    0,
  );
};

const buildRisLineItem = ({ definition, matchedRows = [] }) => {
  const hasMatchedRows = matchedRows.length > 0;
  const rowHasActivity = matchedRows.some((row) => hasInventoryReportActivity(row));
  const balanceOnHand = matchedRows.reduce(
    (total, row) => total + normalizeInventoryNumber(row.beginning_balance),
    0,
  );
  const requestQty = sumRisReportValues(matchedRows, {
    explicitKeys: RIS_REQUEST_KEYS,
    fallbackSelector: (row) => row.received,
  });
  const issuedQty = sumRisReportValues(matchedRows, {
    explicitKeys: RIS_ISSUED_KEYS,
    fallbackSelector: (row) => row.received,
  });
  const totalQty = sumRisReportValues(matchedRows, {
    explicitKeys: RIS_TOTAL_KEYS,
    fallbackSelector: (row) =>
      row.total_available ??
      normalizeInventoryNumber(row.beginning_balance) +
        normalizeInventoryNumber(row.received),
  });
  const shouldShowZero = hasMatchedRows && rowHasActivity;
  const fallbackUnit = definition?.unit || "VIAL";
  const unitSource =
    matchedRows.find((row) => String(row.unit || "").trim())?.unit || fallbackUnit;

  return {
    type: "item",
    key: definition?.key || definition?.label || unitSource,
    description: definition?.label || matchedRows[0]?.name || "",
    unit: normalizeInventoryUnitLabel(unitSource, fallbackUnit),
    balanceOnHand: formatRisQuantityDisplay(balanceOnHand, {
      showZero: shouldShowZero,
    }),
    requestQty: formatRisQuantityDisplay(requestQty, {
      showZero: shouldShowZero,
    }),
    issuedQty: formatRisQuantityDisplay(issuedQty, {
      showZero: shouldShowZero,
    }),
    totalQty: formatRisQuantityDisplay(totalQty, {
      showZero: shouldShowZero,
    }),
    hasData: rowHasActivity,
  };
};

const buildRisReportRows = (inventoryRows = []) => {
  const rowsWithIndex = inventoryRows.map((row, index) => ({
    ...row,
    __reportIndex: index,
  }));
  const consumedRows = new Set();

  const primaryRows = RIS_PRIMARY_REPORT_ITEMS.map((definition) => {
    const matchedRows = rowsWithIndex.filter((row) => {
      if (consumedRows.has(row.__reportIndex)) {
        return false;
      }

      return matchesInventoryReportItem(row.name, definition.aliases);
    });

    matchedRows.forEach((row) => {
      consumedRows.add(row.__reportIndex);
    });

    return buildRisLineItem({ definition, matchedRows });
  });

  const othersRows = rowsWithIndex
    .filter((row) => !consumedRows.has(row.__reportIndex))
    .filter(
      (row) =>
        String(row.name || "").trim() &&
        hasInventoryReportActivity(row),
    )
    .map((row, index) =>
      buildRisLineItem({
        definition: {
          key: `other-${row.__reportIndex || index}`,
          label: row.name,
          unit: row.unit,
        },
        matchedRows: [row],
      }),
    );

  return [
    ...primaryRows,
    {
      type: "section",
      key: "others",
      description: "OTHERS",
      unit: "",
      balanceOnHand: "",
      requestQty: "",
      issuedQty: "",
      totalQty: "",
    },
    ...(othersRows.length > 0
      ? othersRows
      : [
          {
            type: "item",
            key: "others-empty",
            description: "",
            unit: "",
            balanceOnHand: "",
            requestQty: "",
            issuedQty: "",
            totalQty: "",
            hasData: false,
          },
        ]),
  ];
};

const resolveRisControlNumber = ({
  facilityInfo,
  inventoryRows = [],
  reportDate,
  clinicId,
}) => {
  const facilityControlNumber = getInventoryReportFieldValue(
    facilityInfo,
    RIS_CONTROL_NUMBER_KEYS,
  );

  if (facilityControlNumber) {
    return String(facilityControlNumber).trim();
  }

  for (const row of inventoryRows) {
    const rowControlNumber = getInventoryReportFieldValue(
      row,
      RIS_CONTROL_NUMBER_KEYS,
    );
    if (rowControlNumber) {
      return String(rowControlNumber).trim();
    }
  }

  const controlDate = String(reportDate || new Date().toISOString().split("T")[0])
    .replace(/[^0-9]/g, "")
    .slice(0, 8);
  const facilitySegment = String(clinicId || "")
    .replace(/[^0-9A-Za-z]/g, "")
    .padStart(3, "0")
    .slice(-3);

  return facilitySegment
    ? `RIS-${controlDate}-${facilitySegment}`
    : `RIS-${controlDate}`;
};

const formatInventoryMonthYear = (reportDate) => {
  return formatPrintDateValue(reportDate || new Date(), {
    month: "long",
    year: "numeric",
  });
};

const buildInventoryPrintRows = (inventoryRows = []) =>
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
      id: item.id || item.name || index,
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

const buildInventoryPrintTotals = (rows = []) =>
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

const normalizeInventoryReportText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatInventoryReportDate = (value) => {
  if (!value) {
    return "";
  }
  return formatPrintDateValue(value, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const isValidInventoryDateInput = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

const getTodayInventoryDateInput = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isExpiredInventoryDate = (value) => {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  parsedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsedDate < today;
};

const resolveInventorySavePeriod = ({
  reportDate,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  if (
    isFiltering &&
    isValidInventoryDateInput(dateRangeStart) &&
    isValidInventoryDateInput(dateRangeEnd)
  ) {
    return {
      period_start: dateRangeStart,
      period_end: dateRangeEnd,
    };
  }

  const fallbackDate = isValidInventoryDateInput(reportDate)
    ? reportDate
    : getTodayInventoryDateInput();
  const [year, month] = fallbackDate.split("-").map((part, index) =>
    index < 2 ? Number(part) : part,
  );
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const monthSegment = String(month).padStart(2, "0");

  return {
    period_start: `${year}-${monthSegment}-01`,
    period_end: `${year}-${monthSegment}-${String(lastDayOfMonth).padStart(2, "0")}`,
  };
};

const normalizeInventorySaveNumber = (value) => Number(value) || 0;

const resolveInventorySaveRowId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const shouldPersistInventoryRow = (item = {}) => {
  if (resolveInventorySaveRowId(item._apiId)) {
    return true;
  }

  const lotBatchNumber = sanitizeText(item.lot_batch_number || "");
  if (lotBatchNumber) {
    return true;
  }

  return [
    item.beginning_balance,
    item.received,
    item.transferred_in,
    item.transferred_out,
    item.expired_wasted,
    item.issuance,
  ].some((value) => normalizeInventorySaveNumber(value) !== 0);
};

const summarizeInventoryRowLabels = (labels = [], limit = 5) => {
  const normalizedLabels = labels
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (normalizedLabels.length <= limit) {
    return normalizedLabels.join(", ");
  }

  return `${normalizedLabels.slice(0, limit).join(", ")} and ${
    normalizedLabels.length - limit
  } more`;
};

const normalizeFacilityAddressSegment = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[().]/g, " ")
    .replace(/\b(barangay|brgy|city|municipality|province)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildFacilityAddress = (facilityInfo = {}) => {
  const uniqueSegments = [];
  const rawSegments = [
    facilityInfo.address,
    facilityInfo.barangay,
    facilityInfo.city,
    facilityInfo.province,
  ].flatMap((value) =>
    String(value || "")
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean),
  );

  rawSegments.forEach((segment) => {
    const normalizedSegment = normalizeFacilityAddressSegment(segment);

    if (!normalizedSegment) {
      return;
    }

    const duplicateIndex = uniqueSegments.findIndex(({ normalized }) => {
      return (
        normalized === normalizedSegment ||
        normalized.includes(normalizedSegment) ||
        normalizedSegment.includes(normalized)
      );
    });

    if (duplicateIndex === -1) {
      uniqueSegments.push({ raw: segment, normalized: normalizedSegment });
      return;
    }

    if (segment.length > uniqueSegments[duplicateIndex].raw.length) {
      uniqueSegments[duplicateIndex] = {
        raw: segment,
        normalized: normalizedSegment,
      };
    }
  });

  return uniqueSegments.map(({ raw }) => raw).join(", ");
};

const uniqueJoin = (values, separator = ", ") =>
  [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].join(
    separator,
  );

const resolveInventoryReportPeriodLabel = ({
  reportDate,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  if (isFiltering && dateRangeStart && dateRangeEnd) {
    return formatPrintDateRangeLabel({
      startDate: dateRangeStart,
      endDate: dateRangeEnd,
      prefix: "Reporting Period",
      fallbackLabel: "All available records",
    }).replace(/^Reporting Period:\s*/, "");
  }

  return formatInventoryMonthYear(reportDate).toUpperCase();
};

const resolveInventoryRowSourceBucket = (item = {}) => {
  const sourceText = normalizeInventoryReportText(
    [
      item.stock_source,
      item.received_from,
      item.transferred_in_source,
      item.supplier_name,
      item.received_reference,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!sourceText) {
    return "DOH";
  }

  if (/(^|\s)(lgu|barangay|municipal|municipality)(\s|$)/.test(sourceText)) {
    return "LGU";
  }

  if (
    /department of health|(^|\s)doh(\s|$)|mmchd|metro manila center for health development/.test(
      sourceText,
    )
  ) {
    return "DOH";
  }

  return "DOH";
};

const matchesInventoryReportItem = (itemName, aliases = []) => {
  const normalizedName = normalizeInventoryReportText(itemName);

  return aliases.some((alias) => {
    const normalizedAlias = normalizeInventoryReportText(alias);
    if (!normalizedAlias) {
      return false;
    }

    return (
      normalizedName === normalizedAlias ||
      normalizedName.startsWith(`${normalizedAlias} `) ||
      normalizedName.endsWith(` ${normalizedAlias}`) ||
      normalizedName.includes(` ${normalizedAlias} `) ||
      normalizedAlias.startsWith(`${normalizedName} `) ||
      normalizedAlias.endsWith(` ${normalizedName}`) ||
      normalizedAlias.includes(` ${normalizedName} `)
    );
  });
};

const sumInventoryReportBucket = (rows, selector, bucket) =>
  rows.reduce((total, row) => {
    if (resolveInventoryRowSourceBucket(row) !== bucket) {
      return total;
    }

    return total + Number(selector(row) || 0);
  }, 0);

const buildDohLguReportRows = (inventoryRows = []) =>
  DOH_LGU_REPORT_ITEMS.map((definition) => {
    const matchedRows = inventoryRows.filter((row) =>
      matchesInventoryReportItem(row.name, definition.aliases),
    );

    return {
      key: definition.label,
      rowNumber: definition.rowNumber,
      itemName: definition.label,
      previousDoh: sumInventoryReportBucket(
        matchedRows,
        (row) => row.beginning_balance,
        "DOH",
      ),
      previousLgu: sumInventoryReportBucket(
        matchedRows,
        (row) => row.beginning_balance,
        "LGU",
      ),
      receivedDoh: sumInventoryReportBucket(
        matchedRows,
        (row) => Number(row.received || 0) + Number(row.transferred_in || 0),
        "DOH",
      ),
      receivedLgu: sumInventoryReportBucket(
        matchedRows,
        (row) => Number(row.received || 0) + Number(row.transferred_in || 0),
        "LGU",
      ),
      transferredDoh: sumInventoryReportBucket(
        matchedRows,
        (row) => row.transferred_out,
        "DOH",
      ),
      transferredLgu: sumInventoryReportBucket(
        matchedRows,
        (row) => row.transferred_out,
        "LGU",
      ),
      lotNumber: uniqueJoin(matchedRows.map((row) => row.lot_batch_number || row.lot_number)),
      expiryDate: uniqueJoin(
        matchedRows.map((row) => formatInventoryReportDate(row.expiry_date)),
      ),
      transactionDate: uniqueJoin(
        matchedRows.flatMap((row) => [
          formatInventoryReportDate(row.received_date || row.transferred_in_date),
          formatInventoryReportDate(row.transferred_out_date),
        ]),
        " / ",
      ),
      monthlyConsumptionDoh: sumInventoryReportBucket(
        matchedRows,
        (row) => row.issuance,
        "DOH",
      ),
      monthlyConsumptionLgu: sumInventoryReportBucket(
        matchedRows,
        (row) => row.issuance,
        "LGU",
      ),
      patientsReceived: matchedRows.reduce(
        (total, row) => total + Number(row.issuance || 0),
        0,
      ),
      endStocksDoh: sumInventoryReportBucket(
        matchedRows,
        (row) => row.stock_on_hand,
        "DOH",
      ),
      endStocksLgu: sumInventoryReportBucket(
        matchedRows,
        (row) => row.stock_on_hand,
        "LGU",
      ),
    };
  });

const buildDohLguPdfHeaderRows = () => [
  [
    { content: "#", rowSpan: 3 },
    { content: "NATIONAL IMMUNIZATION PROGRAM (NIP)", rowSpan: 3 },
    {
      content: "Ending Inventory from the PREVIOUS Month",
      colSpan: 2,
      rowSpan: 2,
    },
    { content: "Stock Transfer\n(DM 2014-0317)", colSpan: 7 },
    { content: "Monthly Consumption\n(D)", colSpan: 2, rowSpan: 2 },
    {
      content: "Number of Patients Received the vaccine for this month",
      rowSpan: 3,
    },
    { content: "End of Month Stocks\n(A+B) - (C+D)", colSpan: 2, rowSpan: 2 },
  ],
  [
    { content: "Received\n(B)", colSpan: 2 },
    { content: "Transferred\n(C)", colSpan: 2 },
    { content: "Lot Number", rowSpan: 2 },
    { content: "Expiry Date", rowSpan: 2 },
    { content: "Date Received /\nTransferred", rowSpan: 2 },
  ],
  ["DOH", "LGU", "DOH", "LGU", "DOH", "LGU", "DOH", "LGU", "DOH", "LGU"],
];

const resolvePdfAutoTableRunner = ({ doc, autoTableModule }) => {
  const moduleAutoTable =
    typeof autoTableModule?.default === "function"
      ? autoTableModule.default
      : typeof autoTableModule?.autoTable === "function"
        ? autoTableModule.autoTable
        : null;

  if (moduleAutoTable) {
    return (options) => moduleAutoTable(doc, options);
  }

  if (typeof doc?.autoTable === "function") {
    return (options) => doc.autoTable(options);
  }

  throw new Error("Unable to initialize the PDF table generator.");
};

const exportDohLguInventoryPdf = async ({
  facilityInfo,
  reportDate,
  reportRows,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  const [{ default: jsPDF }, autoTableModule, leftSealImage, rightSealImage] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadImageDataUrl(DOH_LGU_REPORT_LEFT_SEAL_SRC),
    loadImageDataUrl(DOH_LGU_REPORT_RIGHT_SEAL_SRC),
  ]);
  const pdfConfig = getInventoryReportPdfConfig(
    PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM,
  );
  const doc = new jsPDF({
    orientation: pdfConfig.orientation,
    unit: "mm",
    format: pdfConfig.format,
  });
  const runAutoTable = resolvePdfAutoTableRunner({ doc, autoTableModule });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { top: 6, right: 6, bottom: 6, left: 6 };
  const facilityName =
    String(facilityInfo?.healthCenter || "").trim() ||
    DEFAULT_PRINT_HEADER.healthCenter;
  const lguLabel =
    String(facilityInfo?.city || "").trim() || DEFAULT_PRINT_HEADER.city;
  const address =
    buildFacilityAddress(facilityInfo) || DEFAULT_PRINT_HEADER.barangay;
  const reportPeriodLabel = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });
  const sanitizedReportDate =
    String(reportDate || "").trim() || new Date().toISOString().split("T")[0];

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.22);
  doc.rect(3, 3, pageWidth - 6, pageHeight - 6);

  const sealSize = 12.5;
  const sealY = 6.5;
  if (leftSealImage) {
    doc.addImage(leftSealImage, "PNG", margin.left + 1.2, sealY, sealSize, sealSize);
  }
  if (rightSealImage) {
    doc.addImage(
      rightSealImage,
      "PNG",
      pageWidth - margin.right - sealSize - 1.2,
      sealY,
      sealSize,
      sealSize,
    );
  }

  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text("Republic of the Philippines", pageWidth / 2, 10, {
    align: "center",
  });

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("METRO MANILA CENTER FOR HEALTH DEVELOPMENT", pageWidth / 2, 16, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.text(PRINT_REPORT_COPY.dohLguTitle, pageWidth / 2, 22, {
    align: "center",
  });

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text(PRINT_REPORT_COPY.dohLguSubtitle, pageWidth / 2, 26, {
    align: "center",
  });

  runAutoTable({
    startY: 30,
    margin,
    theme: "grid",
    body: [
      [
        {
          content: `Facility: ${facilityName}`,
          colSpan: 10,
          styles: { fontStyle: "bold" },
        },
        {
          content: `LGU: ${lguLabel}`,
          colSpan: 6,
          styles: { fontStyle: "bold" },
        },
      ],
      [
        {
          content: `Address: ${address}`,
          colSpan: 10,
          styles: { fontStyle: "bold" },
        },
        {
          content: `Reporting Period: ${reportPeriodLabel}`,
          colSpan: 6,
          styles: { fontStyle: "bold" },
        },
      ],
    ],
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: 0.7,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.22,
      valign: "middle",
      halign: "left",
    },
    tableWidth: pageWidth - margin.left - margin.right,
  });

  runAutoTable({
    startY: doc.lastAutoTable?.finalY || 30,
    margin,
    theme: "grid",
    head: buildDohLguPdfHeaderRows(),
    body: reportRows.map((row) => [
      row.rowNumber,
      row.itemName,
      row.previousDoh,
      row.previousLgu,
      row.receivedDoh,
      row.receivedLgu,
      row.transferredDoh,
      row.transferredLgu,
      row.lotNumber || "",
      row.expiryDate || "",
      row.transactionDate || "",
      row.monthlyConsumptionDoh,
      row.monthlyConsumptionLgu,
      row.patientsReceived,
      row.endStocksDoh,
      row.endStocksLgu,
    ]),
    styles: {
      font: "times",
      fontSize: 6.5,
      cellPadding: 0.55,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.24,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 72, halign: "left" },
      2: { cellWidth: 12 },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 12 },
      6: { cellWidth: 12 },
      7: { cellWidth: 12 },
      8: { cellWidth: 22, halign: "left" },
      9: { cellWidth: 17 },
      10: { cellWidth: 20 },
      11: { cellWidth: 12 },
      12: { cellWidth: 12 },
      13: { cellWidth: 18 },
      14: { cellWidth: 12 },
      15: { cellWidth: 12 },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 1) {
        hook.cell.styles.fontStyle = "bold";
      }

      if (hook.section === "head") {
        hook.cell.styles.lineWidth = 0.24;
      }
    },
  });

  doc.save(`${DOH_LGU_REPORT_FILENAME_PREFIX}-${sanitizedReportDate}.pdf`);
};

const loadPrintImageAsDataUrl = async (src) => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load print asset: ${src}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read print asset: ${src}`));
    reader.readAsDataURL(blob);
  });
};

const buildRisPdfHeaderRows = () => [
  [
    { content: "REQUISITION", colSpan: 3 },
    { content: "REQUEST FORM", colSpan: 1 },
    { content: "ISSUED BY FROM", colSpan: 1 },
    { content: "TOTAL", rowSpan: 3 },
  ],
  [
    { content: "DESCRIPTION", rowSpan: 2 },
    { content: "UNIT", rowSpan: 2 },
    { content: "BALANCE ON HAND", rowSpan: 2 },
    { content: "HEALTH CENTER", rowSpan: 1 },
    { content: "CHO", rowSpan: 1 },
  ],
  ["QTY", "QTY"],
];

const exportRisPdf = async ({
  facilityInfo,
  reportDate,
  reportRows,
  controlNumber,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdfConfig = getInventoryReportPdfConfig(
    PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP,
  );

  const doc = new jsPDF({
    orientation: pdfConfig.orientation,
    unit: "mm",
    format: pdfConfig.format,
  });
  const runAutoTable = resolvePdfAutoTableRunner({ doc, autoTableModule });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const facilityName =
    String(facilityInfo?.healthCenter || "").trim() ||
    DEFAULT_PRINT_HEADER.healthCenter;
  const address =
    buildFacilityAddress(facilityInfo) || DEFAULT_PRINT_HEADER.barangay;
  const reportDateLabel = formatPrintDateValue(reportDate || new Date(), {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const reportYear = formatPrintDateValue(reportDate || new Date(), {
    year: "numeric",
  });
  const reportPeriodLabel = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });
  const sanitizedReportDate =
    String(reportDate || "").trim() || new Date().toISOString().split("T")[0];

  const [pasigLogoResult, dohLogoResult] = await Promise.allSettled([
    loadPrintImageAsDataUrl(PASIG_REPORT_SEAL_SRC),
    loadPrintImageAsDataUrl(DOH_REPORT_SEAL_SRC),
  ]);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

  if (pasigLogoResult.status === "fulfilled") {
    doc.addImage(pasigLogoResult.value, "PNG", 24, 12, 18, 18);
  }

  if (dohLogoResult.status === "fulfilled") {
    doc.addImage(dohLogoResult.value, "PNG", pageWidth - 42, 12, 18, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(PRINT_REPORT_COPY.risTitle, pageWidth / 2, 17, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.text(PRINT_REPORT_COPY.risSubtitle, pageWidth / 2, 23, {
    align: "center",
  });

  doc.setFontSize(10.5);
  doc.text(PRINT_REPORT_COPY.risMunicipality, pageWidth / 2, 29, {
    align: "center",
  });

  runAutoTable({
    startY: 38,
    margin,
    theme: "plain",
    body: [
      [
        { content: "Health Center:", styles: { fontStyle: "bold" } },
        { content: facilityName, colSpan: 2 },
        { content: "Control Number:", styles: { fontStyle: "bold" } },
        { content: controlNumber },
      ],
      [
        { content: "Private Clinic:", styles: { fontStyle: "bold" } },
        { content: RIS_PRIVATE_CLINIC_VALUE, colSpan: 2 },
        { content: "Year:", styles: { fontStyle: "bold" } },
        { content: reportYear },
      ],
      [
        { content: "Date:", styles: { fontStyle: "bold" } },
        { content: reportDateLabel, colSpan: 2 },
        { content: "Reporting Period:", styles: { fontStyle: "bold" } },
        { content: reportPeriodLabel },
      ],
      [
        { content: "Address:", styles: { fontStyle: "bold" } },
        { content: address, colSpan: 4 },
      ],
    ],
    styles: {
      font: "helvetica",
      fontSize: 8.4,
      cellPadding: 1.2,
      textColor: [0, 0, 0],
      lineWidth: 0,
      valign: "middle",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 62 },
      2: { cellWidth: 10 },
      3: { cellWidth: 28 },
      4: { cellWidth: 48 },
    },
    didDrawCell: (hook) => {
      if (
        hook.section === "body" &&
        [1, 4].includes(hook.column.index) &&
        hook.cell.text &&
        hook.cell.text.join("").trim()
      ) {
        const lineY = hook.cell.y + hook.cell.height - 1.2;
        doc.setLineWidth(0.2);
        doc.line(hook.cell.x, lineY, hook.cell.x + hook.cell.width, lineY);
      }
    },
  });

  runAutoTable({
    startY: (doc.lastAutoTable?.finalY || 38) + 2,
    margin,
    theme: "grid",
    head: buildRisPdfHeaderRows(),
    body: reportRows.map((row) => [
      {
        content: row.description,
        colSpan: row.type === "section" ? 6 : 1,
        styles:
          row.type === "section"
            ? { halign: "left", fontStyle: "bold" }
            : { halign: "left" },
      },
      ...(row.type === "section"
        ? []
        : [
            row.unit,
            row.balanceOnHand,
            row.requestQty,
            row.issuedQty,
            row.totalQty,
          ]),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 1.1,
      textColor: [0, 0, 0],
      lineColor: [17, 24, 39],
      lineWidth: 0.2,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [17, 24, 39],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 73, halign: "left" },
      1: { cellWidth: 20 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 22 },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.raw?.[0]?.colSpan === 6) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fillColor = [249, 250, 251];
      }

      if (
        hook.section === "body" &&
        hook.column.index >= 2 &&
        hook.row.raw?.[0]?.colSpan !== 6
      ) {
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save(`${RIS_REPORT_FILENAME_PREFIX}-${sanitizedReportDate}.pdf`);
};

const INVENTORY_EXPORT_DOCUMENT_STYLES = `
  :root {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  }

  body.inventory-export--landscape {
    padding: 0.18in;
  }

  body.inventory-export--portrait {
    padding: 0.22in;
  }

  .inventory-sheet-summary-print-report,
  .doh-lgu-stock-print-report,
  .ris-print-report {
    display: block !important;
  }

  .inventory-sheet-summary-print-report__page,
  .doh-lgu-stock-print-report__page,
  .ris-word-report {
    width: 100%;
  }

  .ris-word-report__page {
    width: 100%;
    max-width: 7.9in;
    margin: 0 auto;
    border: 1.4px solid #111827;
    padding: 0.18in;
    background: #ffffff;
  }

  .ris-word-header-table,
  .ris-word-meta-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    color: #111827;
  }

  .ris-word-header-table {
    margin-bottom: 0.12in;
  }

  .ris-word-header-table__seal-cell {
    width: 0.92in;
    text-align: center;
    vertical-align: middle;
  }

  .ris-word-header-table__seal {
    display: block;
    width: 0.68in;
    height: 0.68in;
    margin: 0 auto;
    object-fit: cover;
    border-radius: 9999px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ris-word-header-table__title-cell {
    text-align: center;
    vertical-align: middle;
    padding: 0 0.1in;
  }

  .ris-word-header-table__title,
  .ris-word-header-table__subtitle,
  .ris-word-header-table__municipality {
    margin: 0;
    color: #111827;
  }

  .ris-word-header-table__title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .ris-word-header-table__subtitle {
    margin-top: 0.03in;
    font-size: 10px;
    font-weight: 700;
  }

  .ris-word-header-table__municipality {
    margin-top: 0.03in;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .ris-word-meta-table {
    margin-bottom: 0.12in;
  }

  .ris-word-meta-table td {
    padding: 0.04in 0.03in;
    font-size: 10px;
    vertical-align: bottom;
  }

  .ris-word-meta-table__label {
    font-weight: 700;
    white-space: nowrap;
  }

  .ris-word-meta-table__value {
    border-bottom: 1px solid #111827;
  }

  .ris-word-table {
    margin-top: 0.02in;
  }
  .ris-print-report__page {
    margin: 0 auto;
    background: #ffffff;
    color: #111827;
  }

  .inventory-sheet-summary-print-report__page,
  .doh-lgu-stock-print-report__page {
    width: 100%;
    max-width: 13.1in;
  }

  .doh-lgu-stock-print-report__page {
    border: 1.4px solid #111827;
  }

  .inventory-sheet-summary-print-header,
  .doh-lgu-stock-print-header,
  .ris-print-header {
    text-align: center;
    color: #0f172a;
  }

  .inventory-sheet-summary-print-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.04cm;
    margin: 0 0 0.28in 0;
    padding: 0 0 0.16in;
    border-bottom: 1.2px solid #cbd5e1;
  }

  .inventory-sheet-summary-print-header__line,
  .doh-lgu-stock-print-header__line,
  .ris-print-header__title,
  .ris-print-header__subtitle,
  .ris-print-header__municipality {
    margin: 0;
  }

  .inventory-sheet-summary-print-header__line--title,
  .doh-lgu-stock-print-header__line--title,
  .ris-print-header__title {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  .inventory-sheet-summary-print-header__line--primary {
    font-size: 12.6px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.014em;
  }

  .inventory-sheet-summary-print-header__line--department {
    font-size: 10.2px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.012em;
  }

  .inventory-sheet-summary-print-header__line--subtitle,
  .doh-lgu-stock-print-header__line--subtitle,
  .ris-print-header__subtitle {
    margin-top: 0.04cm;
    font-size: 9px;
    font-weight: 700;
  }

  .inventory-sheet-summary-print-header__line--supporting {
    margin-top: 0;
    font-size: 9px;
    font-weight: 600;
    text-transform: none;
    color: #334155;
  }

  .inventory-sheet-summary-print-header__line--label {
    margin-top: 0.04cm;
    font-size: 9.1px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.012em;
  }

  .inventory-sheet-summary-print-header__line--facility {
    margin-top: 0;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  .inventory-sheet-summary-print-header__line--inventory {
    margin-top: 0.02cm;
    font-size: 9.3px;
    font-weight: 700;
    text-transform: none;
  }

  .inventory-sheet-summary-print-header__detail-row {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.25in;
    margin-top: 0.08in;
    padding-top: 0.08in;
    border-top: 1px solid #e2e8f0;
  }

  .inventory-sheet-summary-print-header__detail {
    display: inline-flex;
    align-items: center;
    gap: 0.08in;
    min-width: 0;
    font-size: 9px;
    font-weight: 700;
    color: #111827;
  }

  .inventory-sheet-summary-print-header__detail-value {
    display: inline-block;
    min-width: 1.2in;
    min-height: 0.16in;
    border-bottom: 1px solid #111827;
  }

  .inventory-sheet-summary-print-header__detail--month {
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  .inventory-sheet-summary-print-header__meta,
  .doh-lgu-stock-print-header__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.06cm 0.25cm;
    margin-top: 0.12cm;
    padding-top: 0.1cm;
    border-top: 1px solid #cbd5e1;
    text-align: left;
  }

  .inventory-sheet-summary-print-header__meta-line,
  .doh-lgu-stock-print-header__meta-line {
    margin: 0;
    font-size: 9px;
    line-height: 1.22;
  }

  .inventory-sheet-summary-print-header__meta-label,
  .doh-lgu-stock-print-header__meta-label {
    font-weight: 800;
    text-transform: uppercase;
  }

  .inventory-sheet-summary-print-table,
  #doh-lgu-print-table,
  .ris-print-table {
    width: 100%;
    margin-top: 0.04in;
    table-layout: fixed;
    border-collapse: collapse;
    border-spacing: 0;
    color: #111827;
  }

  .inventory-sheet-summary-print-table th,
  .inventory-sheet-summary-print-table td,
  #doh-lgu-print-table th,
  #doh-lgu-print-table td,
  .ris-print-table th,
  .ris-print-table td {
    border: 1.1px solid #111827;
    padding: 0.11cm 0.08cm;
    vertical-align: middle;
    word-break: break-word;
    overflow-wrap: anywhere;
    background: #ffffff;
    background-clip: padding-box;
    box-shadow: none;
  }

  #doh-lgu-print-table {
    border: 1.35px solid #111827;
    font-size: 7.95px;
    line-height: 1.16;
  }

  #doh-lgu-print-table th,
  #doh-lgu-print-table td {
    border-width: 1.15px;
    border-color: #111827;
    border-style: solid;
    padding: 0.095cm 0.07cm;
  }

  #doh-lgu-print-table thead th {
    font-size: 7.85px;
    line-height: 1.12;
    letter-spacing: 0.007em;
  }

  #doh-lgu-print-table tbody td {
    min-height: 0.54cm;
    line-height: 1.15;
  }

  .inventory-sheet-summary-print-table th,
  #doh-lgu-print-table th,
  .ris-print-table th {
    font-size: 8.2px;
    font-weight: 800;
    text-align: center;
  }

  .inventory-sheet-summary-print-table td,
  #doh-lgu-print-table td,
  .ris-print-table td {
    font-size: 8.7px;
    line-height: 1.2;
  }

  .inventory-sheet-summary-print-table .print-col-center,
  #doh-lgu-print-table .print-col-center,
  .ris-print-table__numeric,
  .ris-print-table td:nth-child(2),
  .ris-print-table td:nth-child(3),
  .ris-print-table td:nth-child(4),
  .ris-print-table td:nth-child(5),
  .ris-print-table td:nth-child(6) {
    text-align: center;
  }

  .inventory-sheet-summary-print-table .print-col-items,
  #doh-lgu-print-table .print-col-items,
  #doh-lgu-print-table .print-col-left,
  .ris-print-table__description {
    text-align: left;
  }

  .inventory-sheet-summary-print-table .print-col-item-name,
  #doh-lgu-print-table .print-col-item-name,
  .ris-print-table__description,
  .ris-print-table__numeric,
  .inventory-sheet-summary-print-total-row td {
    font-weight: 800;
  }

  .inventory-sheet-summary-print-table .print-col-beginning {
    background: #e7eef8;
  }

  .inventory-sheet-summary-print-table .print-col-received,
  .inventory-sheet-summary-print-table .print-col-stock {
    background: #e5f3e9;
  }

  .inventory-sheet-summary-print-table .print-col-lot,
  .inventory-sheet-summary-print-table .print-col-movement {
    background: #f7f8fa;
  }

  .inventory-sheet-summary-print-table .print-col-total {
    background: #e3edf9;
  }

  .inventory-sheet-summary-print-table .print-col-issued {
    background: #fbf3d8;
  }

  .inventory-sheet-summary-print-table .print-col-expired {
    background: #fae6e6;
  }

  .inventory-sheet-summary-print-report {
    width: 100%;
  }

  .inventory-sheet-summary-print-report__page {
    width: 100%;
    max-width: 13.1in;
    min-height: 7.6in;
    margin: 0 auto;
    padding: 0 0 0.08in;
    page-break-after: always;
    break-after: page;
  }

  .inventory-sheet-summary-print-report__page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .inventory-sheet-summary-print-header {
    margin: 0 0 0.18in 0;
    padding: 0 0 0.14in;
    border-bottom: 1.2px solid #cbd5e1;
  }

  .inventory-sheet-summary-print-header__branding {
    display: grid;
    grid-template-columns: 0.96in minmax(0, 1fr) 0.96in;
    align-items: center;
    gap: 0.18in;
  }

  .inventory-sheet-summary-print-header__branding-copy {
    text-align: center;
  }

  .inventory-sheet-summary-print-header__logo-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .inventory-sheet-summary-print-header__logo {
    width: 0.9in;
    height: 0.9in;
    object-fit: contain;
    background: transparent;
  }

  .inventory-sheet-summary-print-header__logo--circle {
    border-radius: 9999px;
    clip-path: circle(50% at 50% 50%);
  }

  .inventory-sheet-summary-print-header__line--government {
    margin-bottom: 0.04in;
    font-size: 9.1px;
  }

  .inventory-sheet-summary-print-header__line--title {
    margin-top: 0.02in;
    font-size: 10px;
    text-transform: none;
  }

  .inventory-sheet-summary-print-header__detail-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: end;
    gap: 0.16in;
  }

  .inventory-sheet-summary-print-header__detail--facility {
    justify-self: center;
    text-align: center;
    font-size: 8.8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .inventory-sheet-summary-print-header__detail--month {
    justify-self: end;
  }

  .inventory-sheet-summary-print-table {
    margin-top: 0;
  }

  .doh-lgu-stock-print-header {
    padding: 0.16cm 0.2cm 0.13cm;
    border-bottom: 1.2px solid #111827;
  }

  .doh-lgu-stock-print-header__line--government {
    font-size: 9px;
    margin-bottom: 0.06cm;
  }

  .doh-lgu-stock-print-header__branding {
    display: grid;
    grid-template-columns: 0.72in minmax(0, 1fr) 0.72in;
    align-items: center;
    gap: 0.18cm;
  }

  .doh-lgu-stock-print-header__seal,
  .ris-print-header__seal {
    width: 0.68in;
    height: 0.68in;
    object-fit: cover;
    border-radius: 9999px;
    clip-path: circle(50% at 50% 50%);
    background: transparent;
    mix-blend-mode: multiply;
    border: none;
    box-shadow: none;
  }

  .ris-word-report {
    width: 100%;
  }

  .ris-word-report__page {
    width: 100%;
    max-width: 7.9in;
    margin: 0 auto;
    border: 1.4px solid #111827;
    padding: 0.18in;
    background: #ffffff;
  }

  .ris-word-header-table,
  .ris-word-meta-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    color: #111827;
  }

  .ris-word-header-table {
    margin-bottom: 0.12in;
  }

  .ris-word-header-table__seal-cell {
    width: 0.92in;
    text-align: center;
    vertical-align: middle;
  }

  .ris-word-header-table__seal {
    display: block;
    width: 0.68in;
    height: 0.68in;
    margin: 0 auto;
    object-fit: cover;
    border-radius: 9999px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ris-word-header-table__title-cell {
    text-align: center;
    vertical-align: middle;
    padding: 0 0.1in;
  }

  .ris-word-header-table__title,
  .ris-word-header-table__subtitle,
  .ris-word-header-table__municipality {
    margin: 0;
    color: #111827;
  }

  .ris-word-header-table__title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .ris-word-header-table__subtitle {
    margin-top: 0.03in;
    font-size: 10px;
    font-weight: 700;
  }

  .ris-word-header-table__municipality {
    margin-top: 0.03in;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .ris-word-meta-table {
    margin-bottom: 0.12in;
  }

  .ris-word-meta-table td {
    padding: 0.04in 0.03in;
    font-size: 10px;
    vertical-align: bottom;
  }

  .ris-word-meta-table__label {
    font-weight: 700;
    white-space: nowrap;
  }

  .ris-word-meta-table__value {
    border-bottom: 1px solid #111827;
  }

  .ris-word-table {
    margin-top: 0.02in;
  }
  .ris-print-report__page {
    width: 100%;
    max-width: 7.9in;
    border: 1.4px solid #111827;
    padding: 0.18in;
  }

  .ris-print-header {
    margin: 0 0 0.12in 0;
    padding-bottom: 0.08in;
    border-bottom: 1.2px solid #111827;
  }

  .ris-print-header__branding {
    display: grid;
    grid-template-columns: 0.72in minmax(0, 1fr) 0.72in;
    align-items: center;
    gap: 0.12in;
    margin-bottom: 0.1in;
  }

  .ris-print-header__branding-copy {
    text-align: center;
  }

  .ris-print-header__municipality {
    margin-top: 0.03in;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .ris-print-header__meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.08in 0.16in;
  }

  .ris-print-header__field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: end;
    gap: 0.08in;
  }

  .ris-print-header__field--full {
    grid-column: 1 / -1;
  }

  .ris-print-header__field-label {
    font-size: 8.7px;
    font-weight: 700;
    white-space: nowrap;
  }

  .ris-print-header__field-value {
    min-height: 0.18in;
    padding: 0 0.04in 0.02in;
    border-bottom: 1px solid #111827;
    font-size: 8.9px;
    font-weight: 600;
  }

  .ris-print-table__section-row td {
    font-weight: 800;
    text-align: left;
    background: #f9fafb;
  }
`;

const buildInventoryExportDocument = ({
  title,
  bodyMarkup,
  orientation = "landscape",
}) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      ${INVENTORY_EXPORT_DOCUMENT_STYLES}
    </style>
  </head>
  <body class="inventory-export inventory-export--${orientation}">
    ${bodyMarkup}
  </body>
</html>`;

const buildInventorySheetWordHtml = (props) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.inventorySheetTitle,
    orientation: getInventoryReportOrientation(
      PRINT_REPORT_TYPES.INVENTORY_SHEET,
    ),
    bodyMarkup: renderToStaticMarkup(<InventorySheetSummaryPrintReport {...props} />),
  });

const buildDohLguStockWordHtml = (props) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.dohLguTitle,
    orientation: getInventoryReportOrientation(
      PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM,
    ),
    bodyMarkup: renderToStaticMarkup(<DohLguStockInventoryPrintReport {...props} />),
  });

const buildRisWordHtml = (props) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.risTitle,
    orientation: RIS_EXPORT_PAGE.orientation,
    bodyMarkup: renderToStaticMarkup(<RequisitionIssueSlipWordReport {...props} />),
  });

const loadImageDataUrl = async (src) => {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      return null;
    }

    const imageBlob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(imageBlob);
    });
  } catch (error) {
    return null;
  }
};

const resolveInventorySheetMonthLine = ({
  reportDate,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) =>
  `FOR THE MONTH: ${resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  })}`;

const resolveInventorySheetFacilityName = (facilityInfo = {}) =>
  String(facilityInfo?.healthCenter || "").trim() ||
  PRINT_REPORT_COPY.inventorySheetHealthCenterValue;

const buildInventorySheetPages = (
  printRows = [],
  rowsPerPage = INVENTORY_SHEET_ROWS_PER_PAGE,
) => {
  const normalizedRows = Array.isArray(printRows) ? printRows : [];

  if (normalizedRows.length === 0) {
    return [[]];
  }

  const pages = [];
  for (let index = 0; index < normalizedRows.length; index += rowsPerPage) {
    pages.push(normalizedRows.slice(index, index + rowsPerPage));
  }

  return pages;
};

const buildInventorySheetHeaderContext = ({
  facilityInfo,
  reportDate,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
  leftLogoSrc = INVENTORY_SHEET_LEFT_LOGO_SRC,
  rightLogoSrc = INVENTORY_SHEET_RIGHT_LOGO_SRC,
}) => ({
  facilityName: resolveInventorySheetFacilityName(facilityInfo),
  monthLine: resolveInventorySheetMonthLine({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  }),
  leftLogoSrc,
  rightLogoSrc,
});

const resolveImageDataUrlFormat = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.startsWith("data:image/jpeg") ||
    normalized.startsWith("data:image/jpg")
    ? "JPEG"
    : "PNG";
};

const getInventorySheetPdfColumnStyles = (availableWidth) => {
  return INVENTORY_SHEET_COLUMN_WIDTH_PERCENTAGES.reduce(
    (result, percentage, index) => {
      result[index] = {
        cellWidth: Number(((availableWidth * percentage) / 100).toFixed(2)),
        halign: index === 1 ? "left" : "center",
      };
      return result;
    },
    {},
  );
};

const getInventorySheetPdfFillColor = (columnIndex) => {
  switch (columnIndex) {
    case 2:
      return [231, 238, 248];
    case 3:
    case 10:
      return [229, 243, 233];
    case 4:
    case 5:
    case 6:
      return [247, 248, 250];
    case 7:
      return [250, 230, 230];
    case 8:
      return [227, 237, 249];
    case 9:
      return [251, 243, 216];
    default:
      return [255, 255, 255];
  }
};

const buildInventorySheetPdfHeaderRows = () => [
  [
    { content: "A", rowSpan: 2 },
    { content: "Items", rowSpan: 2 },
    { content: "B\nBeginning Balance", rowSpan: 2 },
    { content: "C\nReceived", rowSpan: 2 },
    { content: "Lot / Batch Number", rowSpan: 2 },
    { content: "Stock Movement In / Out", colSpan: 2 },
    { content: "Expired / Wasted", rowSpan: 2 },
    { content: "G\nTotal Available", rowSpan: 2 },
    { content: "H\nIssued", rowSpan: 2 },
    { content: "I+J\nStock On Hand", rowSpan: 2 },
  ],
  [{ content: "In" }, { content: "Out" }],
];

const buildInventorySheetPdfBodyRows = ({
  rows,
  printTotals,
  showTotals,
}) => {
  const bodyRows = rows.map((row) => [
    row.rowNumber,
    row.itemName,
    row.beginningBalance,
    row.received,
    row.lotBatchNumber,
    row.transferredIn,
    row.transferredOut,
    row.expiredWasted,
    row.totalAvailable,
    row.issued,
    row.stockOnHand,
  ]);

  if (showTotals) {
    bodyRows.push([
      {
        content: "TOTAL",
        colSpan: 2,
        styles: {
          halign: "right",
          fontStyle: "bold",
          fillColor: [229, 231, 235],
        },
      },
      printTotals.beginningBalance,
      printTotals.received,
      "-",
      printTotals.transferredIn,
      printTotals.transferredOut,
      printTotals.expiredWasted,
      printTotals.totalAvailable,
      printTotals.issued,
      printTotals.stockOnHand,
    ]);
  }

  return bodyRows;
};

const drawInventorySheetPdfHeader = ({
  doc,
  pageWidth,
  margin,
  headerContext,
  leftLogoImage,
  rightLogoImage,
}) => {
  const centerX = pageWidth / 2;
  const logoSize = 18;
  const logoY = margin.top + 1;
  const leftLogoX = margin.left + 18;
  const rightLogoX = pageWidth - margin.right - logoSize - 18;

  if (leftLogoImage) {
    doc.addImage(
      leftLogoImage,
      resolveImageDataUrlFormat(leftLogoImage),
      leftLogoX,
      logoY,
      logoSize,
      logoSize,
    );
  }

  if (rightLogoImage) {
    doc.addImage(
      rightLogoImage,
      resolveImageDataUrlFormat(rightLogoImage),
      rightLogoX,
      logoY,
      logoSize,
      logoSize,
    );
  }

  let currentY = margin.top + 3;

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.text("Republic of the Philippines", centerX, currentY, {
    align: "center",
  });

  currentY += 5.4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.4);
  doc.text(PRINT_REPORT_COPY.inventorySheetTitle, centerX, currentY, {
    align: "center",
  });

  currentY += 4.7;
  doc.setFontSize(10.6);
  doc.text(PRINT_REPORT_COPY.inventorySheetDepartment, centerX, currentY, {
    align: "center",
  });

  currentY += 4.1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.text(PRINT_REPORT_COPY.inventorySheetProgram, centerX, currentY, {
    align: "center",
  });

  currentY += 3.9;
  doc.text(PRINT_REPORT_COPY.inventorySheetProcured, centerX, currentY, {
    align: "center",
  });

  currentY += 4.3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.4);
  doc.text(PRINT_REPORT_COPY.inventorySheetHealthCenterLabel, centerX, currentY, {
    align: "center",
  });

  currentY += 4.3;
  doc.setFontSize(10);
  doc.text(PRINT_REPORT_COPY.inventorySheetInventoryLine, centerX, currentY, {
    align: "center",
  });

  currentY += 4.8;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(margin.left, currentY, pageWidth - margin.right, currentY);

  currentY += 5.8;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  doc.text(PRINT_REPORT_COPY.inventorySheetCodeLabel, margin.left, currentY);
  doc.line(margin.left + 9.5, currentY + 0.3, margin.left + 45, currentY + 0.3);
  doc.text(headerContext.facilityName, centerX, currentY, {
    align: "center",
  });
  doc.text(headerContext.monthLine, pageWidth - margin.right, currentY, {
    align: "right",
  });

  return currentY + 4.8;
};

const exportInventorySheetPdf = async ({
  facilityInfo,
  reportDate,
  printRows,
  printTotals,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdfConfig = getInventoryReportPdfConfig(
    PRINT_REPORT_TYPES.INVENTORY_SHEET,
  );

  const doc = new jsPDF({
    orientation: pdfConfig.orientation,
    unit: "mm",
    format: pdfConfig.format,
  });
  const runAutoTable = resolvePdfAutoTableRunner({ doc, autoTableModule });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const availableWidth = pageWidth - margin.left - margin.right;
  const sanitizedReportDate =
    String(reportDate || "").trim() || new Date().toISOString().split("T")[0];
  const headerContext = buildInventorySheetHeaderContext({
    facilityInfo,
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });
  const pageGroups = buildInventorySheetPages(printRows);
  const [leftLogoImage, rightLogoImage] = await Promise.all([
    loadImageDataUrl(INVENTORY_SHEET_LEFT_LOGO_SRC),
    loadImageDataUrl(INVENTORY_SHEET_RIGHT_LOGO_SRC),
  ]);

  pageGroups.forEach((pageRows, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const tableStartY = drawInventorySheetPdfHeader({
      doc,
      pageWidth,
      margin,
      headerContext,
      leftLogoImage,
      rightLogoImage,
    });

    runAutoTable({
      startY: tableStartY,
      margin,
      theme: "grid",
      tableWidth: availableWidth,
      head: buildInventorySheetPdfHeaderRows(),
      body: buildInventorySheetPdfBodyRows({
        rows: pageRows,
        printTotals,
        showTotals: pageIndex === pageGroups.length - 1,
      }),
      styles: {
        font: "helvetica",
        fontSize: 7.7,
        cellPadding: 1.15,
        textColor: [17, 24, 39],
        lineColor: [17, 24, 39],
        lineWidth: 0.26,
        valign: "middle",
        halign: "center",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [17, 24, 39],
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: getInventorySheetPdfColumnStyles(availableWidth),
      didParseCell: (hook) => {
        if (hook.section === "head") {
          hook.cell.styles.fillColor = getInventorySheetPdfFillColor(
            hook.column.index,
          );
          hook.cell.styles.fontStyle = "bold";
        }

        if (hook.section === "body") {
          const isTotalsRow =
            pageIndex === pageGroups.length - 1 &&
            hook.row.index === pageRows.length;

          if (!(isTotalsRow && hook.column.index === 0)) {
            hook.cell.styles.fillColor = getInventorySheetPdfFillColor(
              hook.column.index,
            );
          }

          if (hook.column.index === 1 || isTotalsRow) {
            hook.cell.styles.fontStyle = "bold";
          }

          if (hook.column.index === 1) {
            hook.cell.styles.halign = "left";
          }
        }
      },
    });
  });

  doc.save(`inventory-sheet-${sanitizedReportDate}.pdf`);
};

const InventorySheetSummaryPrintHeader = ({
  leftLogoSrc,
  rightLogoSrc,
  monthLine,
  facilityName,
}) => {
  return (
    <header
      className="inventory-sheet-summary-print-header"
      data-testid="inventory-sheet-print-header"
    >
      <div className="inventory-sheet-summary-print-header__branding">
        <div className="inventory-sheet-summary-print-header__logo-wrap">
          {leftLogoSrc ? (
            <img
              src={leftLogoSrc}
              alt="Department of Health logo"
              className="inventory-sheet-summary-print-header__logo inventory-sheet-summary-print-header__logo--circle"
            />
          ) : null}
        </div>
        <div
          className="inventory-sheet-summary-print-header__branding-copy"
          aria-label={`Inventory sheet header for ${facilityName}`}
        >
          <p className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--government">
            Republic of the Philippines
          </p>
          <h1 className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--primary">
            {PRINT_REPORT_COPY.inventorySheetTitle}
          </h1>
          <p className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--department">
            {PRINT_REPORT_COPY.inventorySheetDepartment}
          </p>
          <p className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--supporting">
            {PRINT_REPORT_COPY.inventorySheetProgram}
          </p>
          <p className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--supporting">
            {PRINT_REPORT_COPY.inventorySheetProcured}
          </p>
          <p className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--label">
            {PRINT_REPORT_COPY.inventorySheetHealthCenterLabel}
          </p>
          <h2 className="inventory-sheet-summary-print-header__line inventory-sheet-summary-print-header__line--title">
            {PRINT_REPORT_COPY.inventorySheetInventoryLine}
          </h2>
        </div>
        <div className="inventory-sheet-summary-print-header__logo-wrap">
          {rightLogoSrc ? (
            <img
              src={rightLogoSrc}
              alt="San Nicolas Health Center logo"
              className="inventory-sheet-summary-print-header__logo inventory-sheet-summary-print-header__logo--circle"
            />
          ) : null}
        </div>
      </div>
      <div className="inventory-sheet-summary-print-header__detail-row">
        <p className="inventory-sheet-summary-print-header__detail">
          <span>{PRINT_REPORT_COPY.inventorySheetCodeLabel}</span>
          <span
            className="inventory-sheet-summary-print-header__detail-value"
            aria-hidden="true"
          />
        </p>
        <p className="inventory-sheet-summary-print-header__detail inventory-sheet-summary-print-header__detail--facility">
          {facilityName}
        </p>
        <p
          className="inventory-sheet-summary-print-header__detail inventory-sheet-summary-print-header__detail--month"
          data-testid="inventory-sheet-print-month-year"
        >
          {monthLine}
        </p>
      </div>
    </header>
  );
};

const InventorySheetSummaryPrintReport = ({
  facilityInfo,
  reportDate,
  printRows,
  printTotals,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
  leftLogoSrc = INVENTORY_SHEET_LEFT_LOGO_SRC,
  rightLogoSrc = INVENTORY_SHEET_RIGHT_LOGO_SRC,
}) => {
  const headerContext = buildInventorySheetHeaderContext({
    facilityInfo,
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
    leftLogoSrc,
    rightLogoSrc,
  });
  const pageGroups = buildInventorySheetPages(printRows);

  return (
    <section
      className="inventory-sheet-summary-print-report"
      data-testid="inventory-sheet-print-report"
    >
      {pageGroups.map((pageRows, pageIndex) => (
        <article
          key={`inventory-sheet-print-page-${pageIndex + 1}`}
          className="inventory-sheet-summary-print-report__page"
          data-testid="inventory-sheet-print-page"
        >
          <InventorySheetSummaryPrintHeader {...headerContext} />

          <table
            className="inventory-sheet-summary-print-table"
            data-testid="inventory-sheet-print-table"
          >
            <colgroup>
              {INVENTORY_SHEET_COLUMN_WIDTH_PERCENTAGES.map((width, index) => (
                <col
                  key={`inventory-sheet-col-${index}`}
                  style={{ width: `${width}%` }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2} className="print-col-base">
                  A
                </th>
                <th rowSpan={2} className="print-col-base print-col-items">
                  Items
                </th>
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
              {pageRows.map((item) => (
                <tr key={`inventory-sheet-print-${pageIndex + 1}-${item.id}`}>
                  <td className="print-col-base print-col-center">
                    {item.rowNumber}
                  </td>
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

              {pageIndex === pageGroups.length - 1 && (
                <tr
                  className="inventory-sheet-summary-print-total-row"
                  data-testid="inventory-sheet-print-total-row"
                >
                  <td className="print-col-base print-col-total-label" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="print-col-base print-col-beginning print-col-center">
                    {printTotals.beginningBalance}
                  </td>
                  <td className="print-col-base print-col-received print-col-center">
                    {printTotals.received}
                  </td>
                  <td className="print-col-base print-col-lot print-col-center">
                    -
                  </td>
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
              )}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
};

const DohLguStockInventoryPrintReport = ({
  facilityInfo,
  reportDate,
  reportRows,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  const facilityName =
    String(facilityInfo?.healthCenter || "").trim() ||
    DEFAULT_PRINT_HEADER.healthCenter;
  const lguLabel =
    String(facilityInfo?.city || "").trim() || DEFAULT_PRINT_HEADER.city;
  const address =
    buildFacilityAddress(facilityInfo) || DEFAULT_PRINT_HEADER.barangay;
  const reportingPeriod = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });

  return (
    <section
      className="doh-lgu-stock-print-report"
      data-testid="inventory-print-report"
    >
      <div className="doh-lgu-stock-print-report__page">
        <header
          className="doh-lgu-stock-print-header"
          data-testid="inventory-print-header"
        >
          <p className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--government">
            Republic of the Philippines
          </p>
          <div className="doh-lgu-stock-print-header__branding">
            <img
              src={DOH_LGU_REPORT_LEFT_SEAL_SRC}
              alt="Department of Health seal"
              className="doh-lgu-stock-print-header__seal"
            />
            <div className="doh-lgu-stock-print-header__branding-copy">
              <h1 className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--primary">
                METRO MANILA CENTER FOR HEALTH DEVELOPMENT
              </h1>
              <h2 className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--title">
                {PRINT_REPORT_COPY.dohLguTitle}
              </h2>
              <p className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--subtitle">
                {PRINT_REPORT_COPY.dohLguSubtitle}
              </p>
            </div>
            <img
              src={DOH_LGU_REPORT_RIGHT_SEAL_SRC}
              alt="Pasig City seal"
              className="doh-lgu-stock-print-header__seal"
            />
          </div>
          <div className="doh-lgu-stock-print-header__meta">
            <p className="doh-lgu-stock-print-header__meta-line">
              <span className="doh-lgu-stock-print-header__meta-label">
                Facility:
              </span>{" "}
              {facilityName}
            </p>
            <p className="doh-lgu-stock-print-header__meta-line">
              <span className="doh-lgu-stock-print-header__meta-label">LGU:</span>{" "}
              {lguLabel}
            </p>
            <p className="doh-lgu-stock-print-header__meta-line">
              <span className="doh-lgu-stock-print-header__meta-label">
                Address:
              </span>{" "}
              {address}
            </p>
            <p
              className="doh-lgu-stock-print-header__meta-line doh-lgu-stock-print-header__meta-line--period"
              data-testid="inventory-print-month-year"
            >
              <span className="doh-lgu-stock-print-header__meta-label">
                Reporting Period:
              </span>{" "}
              {reportingPeriod}
            </p>
          </div>
        </header>

        <table
          className="doh-lgu-stock-print-table"
          id="doh-lgu-print-table"
          data-testid="inventory-print-table"
        >
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={3} className="print-col-base print-col-center">#</th>
              <th rowSpan={3} className="print-col-base print-col-items">
                NATIONAL IMMUNIZATION PROGRAM (NIP)
              </th>
              <th rowSpan={2} colSpan={2} className="print-col-base">
                Ending Inventory from the PREVIOUS Month
              </th>
              <th colSpan={7} className="print-col-base">
                Stock Transfer
                <br />
                (DM 2014-0317)
              </th>
              <th rowSpan={2} colSpan={2} className="print-col-base">
                Monthly Consumption
                <br />
                (D)
              </th>
              <th rowSpan={3} className="print-col-base">
                Number of Patients Received the vaccine for this month
              </th>
              <th rowSpan={2} colSpan={2} className="print-col-base">
                <br />
                End of Month Stocks
                <br />
                (A+B) - (C+D)
              </th>
            </tr>
            <tr>
              <th colSpan={2} className="print-col-base">
                Received
                <br />
                (B)
              </th>
              <th colSpan={2} className="print-col-base">
                Transferred
                <br />
                (C)
              </th>
              <th rowSpan={2} className="print-col-base">Lot Number</th>
              <th rowSpan={2} className="print-col-base">Expiry Date</th>
              <th rowSpan={2} className="print-col-base">
                Date Received / Transferred
              </th>
            </tr>
            <tr>
              <th className="print-col-base">DOH</th>
              <th className="print-col-base">LGU</th>
              <th className="print-col-base">DOH</th>
              <th className="print-col-base">LGU</th>
              <th className="print-col-base">DOH</th>
              <th className="print-col-base">LGU</th>
              <th className="print-col-base">DOH</th>
              <th className="print-col-base">LGU</th>
              <th className="print-col-base">DOH</th>
              <th className="print-col-base">LGU</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((item) => (
              <tr key={`inventory-print-${item.key}`}>
                <td className="print-col-base print-col-center">{item.rowNumber}</td>
                <td className="print-col-base print-col-items print-col-item-name">
                  {item.itemName}
                </td>
                <td className="print-col-base print-col-center">{item.previousDoh}</td>
                <td className="print-col-base print-col-center">{item.previousLgu}</td>
                <td className="print-col-base print-col-center">{item.receivedDoh}</td>
                <td className="print-col-base print-col-center">{item.receivedLgu}</td>
                <td className="print-col-base print-col-center">{item.transferredDoh}</td>
                <td className="print-col-base print-col-center">{item.transferredLgu}</td>
                <td className="print-col-base print-col-left">{item.lotNumber}</td>
                <td className="print-col-base print-col-center">{item.expiryDate}</td>
                <td className="print-col-base print-col-center">{item.transactionDate}</td>
                <td className="print-col-base print-col-center">
                  {item.monthlyConsumptionDoh}
                </td>
                <td className="print-col-base print-col-center">
                  {item.monthlyConsumptionLgu}
                </td>
                <td className="print-col-base print-col-center">
                  {item.patientsReceived}
                </td>
                <td className="print-col-base print-col-center">{item.endStocksDoh}</td>
                <td className="print-col-base print-col-center">{item.endStocksLgu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const RequisitionIssueSlipWordReport = ({
  facilityInfo,
  reportDate,
  reportRows,
  controlNumber,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
  leftSealSrc = PASIG_REPORT_SEAL_SRC,
  rightSealSrc = DOH_REPORT_SEAL_SRC,
}) => {
  const facilityName =
    String(facilityInfo?.healthCenter || "").trim() ||
    DEFAULT_PRINT_HEADER.healthCenter;
  const address =
    buildFacilityAddress(facilityInfo) || DEFAULT_PRINT_HEADER.barangay;
  const reportDateLabel = formatPrintDateValue(reportDate || new Date(), {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const reportYear = formatPrintDateValue(reportDate || new Date(), {
    year: "numeric",
  });
  const reportingPeriod = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });

  return (
    <section className="ris-word-report" data-testid="inventory-ris-word-report">
      <div className="ris-word-report__page">
        <table className="ris-word-header-table" role="presentation">
          <tbody>
            <tr>
              <td className="ris-word-header-table__seal-cell">
                {leftSealSrc ? (
                  <img
                    src={leftSealSrc}
                    alt="Municipality of Pasig seal"
                    className="ris-word-header-table__seal"
                  />
                ) : null}
              </td>
              <td className="ris-word-header-table__title-cell">
                <h1 className="ris-word-header-table__title">
                  {PRINT_REPORT_COPY.risTitle}
                </h1>
                <p className="ris-word-header-table__subtitle">
                  {PRINT_REPORT_COPY.risSubtitle}
                </p>
                <p className="ris-word-header-table__municipality">
                  {PRINT_REPORT_COPY.risMunicipality}
                </p>
              </td>
              <td className="ris-word-header-table__seal-cell">
                {rightSealSrc ? (
                  <img
                    src={rightSealSrc}
                    alt="Department of Health seal"
                    className="ris-word-header-table__seal"
                  />
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="ris-word-meta-table" role="presentation">
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "48%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "24%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="ris-word-meta-table__label">Health Center:</td>
              <td className="ris-word-meta-table__value">{facilityName}</td>
              <td className="ris-word-meta-table__label">Control Number:</td>
              <td className="ris-word-meta-table__value">{controlNumber}</td>
            </tr>
            <tr>
              <td className="ris-word-meta-table__label">Private Clinic:</td>
              <td className="ris-word-meta-table__value">{RIS_PRIVATE_CLINIC_VALUE}</td>
              <td className="ris-word-meta-table__label">Year:</td>
              <td className="ris-word-meta-table__value">{reportYear}</td>
            </tr>
            <tr>
              <td className="ris-word-meta-table__label">Date:</td>
              <td className="ris-word-meta-table__value">{reportDateLabel}</td>
              <td className="ris-word-meta-table__label">Reporting Period:</td>
              <td className="ris-word-meta-table__value">{reportingPeriod}</td>
            </tr>
            <tr>
              <td className="ris-word-meta-table__label">Address:</td>
              <td className="ris-word-meta-table__value" colSpan={3}>{address}</td>
            </tr>
          </tbody>
        </table>

        <table className="ris-print-table ris-word-table" data-testid="inventory-ris-word-table">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={3}>REQUISITION</th>
              <th>REQUEST FORM</th>
              <th>ISSUED BY FROM</th>
              <th rowSpan={3}>TOTAL</th>
            </tr>
            <tr>
              <th rowSpan={2}>DESCRIPTION</th>
              <th rowSpan={2}>UNIT</th>
              <th rowSpan={2}>BALANCE ON HAND</th>
              <th>HEALTH CENTER</th>
              <th>CHO</th>
            </tr>
            <tr>
              <th>QTY</th>
              <th>QTY</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((row) =>
              row.type === "section" ? (
                <tr key={row.key} className="ris-print-table__section-row">
                  <td colSpan={6}>{row.description}</td>
                </tr>
              ) : (
                <tr key={row.key}>
                  <td className="ris-print-table__description">{row.description}</td>
                  <td>{row.unit}</td>
                  <td className="ris-print-table__numeric">{row.balanceOnHand}</td>
                  <td className="ris-print-table__numeric">{row.requestQty}</td>
                  <td className="ris-print-table__numeric">{row.issuedQty}</td>
                  <td className="ris-print-table__numeric">{row.totalQty}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const RequisitionIssueSlipPrintReport = ({
  facilityInfo,
  reportDate,
  reportRows,
  controlNumber,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  const facilityName =
    String(facilityInfo?.healthCenter || "").trim() ||
    DEFAULT_PRINT_HEADER.healthCenter;
  const address =
    buildFacilityAddress(facilityInfo) || DEFAULT_PRINT_HEADER.barangay;
  const reportDateLabel = formatPrintDateValue(reportDate || new Date(), {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const reportYear = formatPrintDateValue(reportDate || new Date(), {
    year: "numeric",
  });
  const reportingPeriod = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });

  return (
    <section
      className="ris-print-report"
      data-testid="inventory-ris-print-report"
    >
      <div className="ris-print-report__page">
        <header
          className="ris-print-header"
          data-testid="inventory-ris-print-header"
        >
          <div className="ris-print-header__branding">
            <img
              src={PASIG_REPORT_SEAL_SRC}
              alt="Municipality of Pasig seal"
              className="ris-print-header__seal"
            />
            <div className="ris-print-header__branding-copy">
              <h1 className="ris-print-header__title">
                {PRINT_REPORT_COPY.risTitle}
              </h1>
              <p className="ris-print-header__subtitle">
                {PRINT_REPORT_COPY.risSubtitle}
              </p>
              <p className="ris-print-header__municipality">
                {PRINT_REPORT_COPY.risMunicipality}
              </p>
            </div>
            <img
              src={DOH_REPORT_SEAL_SRC}
              alt="Department of Health seal"
              className="ris-print-header__seal"
            />
          </div>

          <div className="ris-print-header__meta-grid">
            <div className="ris-print-header__field">
              <span className="ris-print-header__field-label">
                Health Center:
              </span>
              <span className="ris-print-header__field-value">
                {facilityName}
              </span>
            </div>
            <div className="ris-print-header__field">
              <span className="ris-print-header__field-label">
                Control Number:
              </span>
              <span className="ris-print-header__field-value">
                {controlNumber}
              </span>
            </div>
            <div className="ris-print-header__field">
              <span className="ris-print-header__field-label">
                Private Clinic:
              </span>
              <span className="ris-print-header__field-value">
                {RIS_PRIVATE_CLINIC_VALUE}
              </span>
            </div>
            <div className="ris-print-header__field">
              <span className="ris-print-header__field-label">Year:</span>
              <span className="ris-print-header__field-value">{reportYear}</span>
            </div>
            <div className="ris-print-header__field">
              <span className="ris-print-header__field-label">Date:</span>
              <span className="ris-print-header__field-value">
                {reportDateLabel}
              </span>
            </div>
            <div className="ris-print-header__field">
              <span className="ris-print-header__field-label">
                Reporting Period:
              </span>
              <span
                className="ris-print-header__field-value"
                data-testid="inventory-ris-print-period"
              >
                {reportingPeriod}
              </span>
            </div>
            <div className="ris-print-header__field ris-print-header__field--full">
              <span className="ris-print-header__field-label">Address:</span>
              <span className="ris-print-header__field-value">{address}</span>
            </div>
          </div>
        </header>

        <table
          className="ris-print-table"
          data-testid="inventory-ris-print-table"
        >
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={3}>REQUISITION</th>
              <th>REQUEST FORM</th>
              <th>ISSUED BY FROM</th>
              <th rowSpan={3}>TOTAL</th>
            </tr>
            <tr>
              <th rowSpan={2}>DESCRIPTION</th>
              <th rowSpan={2}>UNIT</th>
              <th rowSpan={2}>BALANCE ON HAND</th>
              <th>HEALTH CENTER</th>
              <th>CHO</th>
            </tr>
            <tr>
              <th>QTY</th>
              <th>QTY</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((row) =>
              row.type === "section" ? (
                <tr key={row.key} className="ris-print-table__section-row">
                  <td colSpan={6}>{row.description}</td>
                </tr>
              ) : (
                <tr key={row.key}>
                  <td className="ris-print-table__description">
                    {row.description}
                  </td>
                  <td>{row.unit}</td>
                  <td className="ris-print-table__numeric">{row.balanceOnHand}</td>
                  <td className="ris-print-table__numeric">{row.requestQty}</td>
                  <td className="ris-print-table__numeric">{row.issuedQty}</td>
                  <td className="ris-print-table__numeric">{row.totalQty}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default function InventoryManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const fallbackClinicId = user?.clinic_id || user?.facility_id || 1;
  const currentUserId = user?.id ?? null;
  const currentUserUsername = String(user?.username || "").trim() || null;
  const currentUserRole =
    String(user?.role_type || user?.role || "").trim() || null;
  const currentUserDisplayName = useMemo(
    () => getInventoryActorDisplayName(user),
    [
      currentUserId,
      currentUserRole,
      currentUserUsername,
      user?.first_name,
      user?.last_name,
    ],
  );
  const canManageStockAlertActions =
    String(user?.role_type || user?.role || "").trim().toUpperCase() ===
    "SYSTEM_ADMIN";

  const tabFromUrl = useMemo(
    () => normalizeInventoryTabKey(searchParams.get("tab")),
    [searchParams],
  );

  // Active tab state
  const [activeTab, setActiveTab] = useState(
    () => tabFromUrl || getStoredInventoryTabKey() || INVENTORY_DEFAULT_TAB_KEY,
  );
  const resolvedActiveTab =
    normalizeInventoryTabKey(activeTab) || INVENTORY_DEFAULT_TAB_KEY;

  useEffect(() => {
    const resolvedTab =
      tabFromUrl || getStoredInventoryTabKey() || INVENTORY_DEFAULT_TAB_KEY;

    setActiveTab((previous) =>
      previous === resolvedTab ? previous : resolvedTab,
    );
    persistInventoryTabKey(resolvedTab);

    if (searchParams.get("tab") !== resolvedTab) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", resolvedTab);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [tabFromUrl, searchParams, setSearchParams]);

  // Data states
  const [inventory, setInventory] = useState([]);
  const [inventoryReportSource, setInventoryReportSource] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [inventoryDisplayFilters, setInventoryDisplayFilters] = useState(
    createDefaultInventoryDisplayFilters,
  );
  const [stockMovementFilters, setStockMovementFilters] = useState(
    createDefaultStockMovementFilters,
  );
  const [stockMovementsLoading, setStockMovementsLoading] = useState(false);
  const [stockMovementsError, setStockMovementsError] = useState(null);
  const [persistedStockAlerts, setPersistedStockAlerts] = useState([]);
  const [stockAlertFeedback, setStockAlertFeedback] = useState(null);
  const [stockAlertLoadError, setStockAlertLoadError] = useState(null);
  const [stockAlertsLoading, setStockAlertsLoading] = useState(false);
  const [stockAlertWorkflowPage, setStockAlertWorkflowPage] = useState(1);
  const [pendingBulkStockAlertAction, setPendingBulkStockAlertAction] =
    useState(null);
  const [isSubmittingBulkStockAlertAction, setIsSubmittingBulkStockAlertAction] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [transactionErrors, setTransactionErrors] = useState({});
  const [transactionSubmitError, setTransactionSubmitError] = useState(null);
  const [isTransactionSubmitting, setIsTransactionSubmitting] = useState(false);
  const [availableLots, setAvailableLots] = useState([]);
  const [availableLotsLoading, setAvailableLotsLoading] = useState(false);
  const [availableLotsError, setAvailableLotsError] = useState(null);
  const [lotSearchTerm, setLotSearchTerm] = useState("");
  const [isPrintLayoutActive, setIsPrintLayoutActive] = useState(false);
  const [activePrintReportType, setActivePrintReportType] = useState(null);
  const [selectedExportReportType, setSelectedExportReportType] = useState(
    normalizeInventoryReportType(PRINT_REPORT_TYPES.INVENTORY_SHEET),
  );
  const [selectedReportDeliveryType, setSelectedReportDeliveryType] = useState(
    INVENTORY_REPORT_DELIVERY_TYPES.PRINT,
  );
  const [isGenerateReportModalOpen, setIsGenerateReportModalOpen] =
    useState(false);
  const activePrintReportTypeRef = useRef(null);
  const printPageStyleRef = useRef(null);

  // Report date range
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const printDateRange = usePrintDateRange({
    headerPrefix: "Reporting Period",
    fallbackLabel: "All available records",
  });
  const dateRangeStart = printDateRange.appliedStartDate;
  const dateRangeEnd = printDateRange.appliedEndDate;
  const isFiltering = printDateRange.hasAppliedDateRange;
  const requiresBatchSelection =
    modalType === "issue" || modalType === "waste";

  const resolveTransactionInventoryContext = useCallback(
    (item) => {
      const matchedInventory =
        inventory.find((inventoryItem) => inventoryItem.id === item?.id) || item;

      return {
        matchedInventory,
        inventoryId: resolveInventorySaveRowId(matchedInventory?._apiId),
        vaccineId: resolveInventorySaveRowId(matchedInventory?._vaccineId),
        clinicId:
          resolveInventorySaveRowId(matchedInventory?._facilityId) ||
          resolveInventorySaveRowId(matchedInventory?.clinic_id) ||
          resolveInventorySaveRowId(matchedInventory?.facility_id) ||
          Number(fallbackClinicId) ||
          1,
      };
    },
    [fallbackClinicId, inventory],
  );

  const selectedBatchOption = useMemo(() => {
    const selectedBatchId = resolveInventorySaveRowId(formData.batch_id);
    if (!selectedBatchId) {
      return null;
    }

    return (
      availableLots.find(
        (batch) =>
          resolveInventorySaveRowId(batch.batch_id || batch.inventory_id) ===
          selectedBatchId,
      ) || null
    );
  }, [availableLots, formData.batch_id]);

  const filteredAvailableLots = useMemo(() => {
    const normalizedQuery = lotSearchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableLots;
    }

    return availableLots.filter((batch) =>
      getInventoryBatchSearchText(batch).includes(normalizedQuery),
    );
  }, [availableLots, lotSearchTerm]);

  const parsedTransactionQuantity = useMemo(() => {
    const parsed = Number.parseInt(formData.quantity, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [formData.quantity]);

  const batchStockPreview = useMemo(() => {
    if (!selectedBatchOption) {
      return null;
    }

    const available = Number(
      selectedBatchOption.available_quantity ?? selectedBatchOption.stock ?? 0,
    );
    const transactionQuantity = parsedTransactionQuantity;
    const remaining = available - transactionQuantity;

    return {
      available,
      transactionQuantity,
      remaining,
      insufficientStock: transactionQuantity > available,
      unavailable: available <= 0,
    };
  }, [parsedTransactionQuantity, selectedBatchOption]);

  const liveBatchQuantityError = useMemo(() => {
    if (!requiresBatchSelection || !selectedBatchOption || !batchStockPreview) {
      return null;
    }

    if (batchStockPreview.unavailable) {
      return "The selected lot/batch has no available stock remaining.";
    }

    if (batchStockPreview.insufficientStock) {
      return `Only ${batchStockPreview.available} units are available in the selected lot/batch.`;
    }

    return null;
  }, [batchStockPreview, requiresBatchSelection, selectedBatchOption]);

  const isTransactionSubmitDisabled =
    isTransactionSubmitting ||
    (requiresBatchSelection &&
      (availableLotsLoading ||
        !selectedBatchOption ||
        batchStockPreview?.unavailable ||
        batchStockPreview?.insufficientStock));

  // Facility info for print
  const [facilityInfo, setFacilityInfo] = useState({
    healthCenter: "IMMUNICARE HEALTH CENTER",
    address: "",
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
    () =>
      APPROVED_VACCINE_NAMES
        .filter((name) => !name.toLowerCase().includes("diluent 5ml") && name !== "Diluent")
        .map((name) => ({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          name,
          unit: "vials",
        })),
    [],
  );

  // Initialize inventory data structure based on paper configuration
  const initializeInventory = useCallback(() => {
    const initialData = vaccineItems.map((item) => normalizeInventoryRecord({}, item));
    setInventory(initialData);
    setInventoryReportSource(initialData);
  }, [vaccineItems]);

  const fetchPersistedStockAlerts = useCallback(async () => {
    if (
      !canManageStockAlertActions ||
      typeof apiClient.getVaccineStockAlerts !== "function"
    ) {
      setPersistedStockAlerts([]);
      setStockAlertLoadError(null);
      return [];
    }

    try {
      setStockAlertsLoading(true);
      setStockAlertLoadError(null);

      const alertResponse = await apiClient.getVaccineStockAlerts({
        clinic_id: fallbackClinicId,
      });
      const normalizedAlerts = Array.isArray(alertResponse)
        ? alertResponse
            .map((row) => normalizeStockAlertRecord(row))
            .filter((row) => row.id !== null)
        : [];

      setPersistedStockAlerts(normalizedAlerts);
      return normalizedAlerts;
    } catch (stockAlertError) {
      console.error("Persisted stock alerts load failed:", stockAlertError);
      setPersistedStockAlerts([]);
      setStockAlertLoadError(
        stockAlertError?.message ||
          "Unable to load persisted stock alerts for this facility.",
      );
      return [];
    } finally {
      setStockAlertsLoading(false);
    }
  }, [canManageStockAlertActions, fallbackClinicId]);

  const loadStockMovements = useCallback(async () => {
    if (typeof apiClient.getVaccineInventoryTransactions !== "function") {
      setStockMovements([]);
      setStockMovementsError(null);
      return [];
    }

    try {
      setStockMovementsLoading(true);
      setStockMovementsError(null);

      const response = await apiClient.getVaccineInventoryTransactions(null, {
        clinic_id: fallbackClinicId,
        limit: 250,
      });

      let movementRows = [];
      if (response && response.success !== undefined) {
        if (Array.isArray(response.data)) {
          movementRows = response.data;
        } else if (Array.isArray(response.transactions)) {
          movementRows = response.transactions;
        } else if (Array.isArray(response.data?.transactions)) {
          movementRows = response.data.transactions;
        }
      } else if (Array.isArray(response)) {
        movementRows = response;
      } else if (Array.isArray(response?.transactions)) {
        movementRows = response.transactions;
      }

      const normalizedMovements = movementRows
        .map(normalizeInventoryMovementRecord)
        .map((movement) => {
          if (
            (movement.performed_by_name || movement.performed_by_username) ||
            (!currentUserDisplayName && !currentUserUsername)
          ) {
            return movement;
          }

          const rawPerformedBy =
            movement.performed_by ??
            movement.performed_by_id ??
            movement.user_id ??
            null;

          if (
            rawPerformedBy !== null &&
            rawPerformedBy !== undefined &&
            String(rawPerformedBy) === String(currentUserId)
          ) {
            return {
              ...movement,
              performed_by_name: currentUserDisplayName,
              performed_by_username:
                movement.performed_by_username || currentUserUsername,
              performed_by_role: movement.performed_by_role || currentUserRole,
            };
          }

          return movement;
        });
      setStockMovements(normalizedMovements);
      return normalizedMovements;
    } catch (movementErr) {
      console.error("Stock movement history load failed:", movementErr);
      setStockMovements([]);
      setStockMovementsError(
        movementErr?.message || "Failed to load stock movement history.",
      );
      return [];
    } finally {
      setStockMovementsLoading(false);
    }
  }, [
    currentUserDisplayName,
    currentUserId,
    currentUserRole,
    currentUserUsername,
    fallbackClinicId,
  ]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch inventory data from API
      try {
        const [inventoryData, vaccinesData] = await Promise.all([
          apiClient.getVaccineInventory({ clinic_id: fallbackClinicId }),
          apiClient.getVaccines().catch(() => ({ data: [] })),
        ]);

        let apiVaccines = [];
        if (vaccinesData && vaccinesData.success !== undefined) {
          apiVaccines = vaccinesData.data || [];
        } else if (Array.isArray(vaccinesData)) {
          apiVaccines = vaccinesData;
        } else if (vaccinesData?.data) {
          apiVaccines = vaccinesData.data;
        }

        // Handle both wrapped and unwrapped response formats
        let apiInventory = [];
        if (inventoryData && inventoryData.success !== undefined) {
          apiInventory = inventoryData.data || inventoryData.inventory || [];
        } else if (Array.isArray(inventoryData)) {
          apiInventory = inventoryData;
        } else if (inventoryData?.inventory) {
          apiInventory = inventoryData.inventory;
        }

        const normalizedApiInventory = apiInventory.map((record) =>
          normalizeInventoryRecord(record, {
            _facilityId:
              record.clinic_id || record.facility_id || fallbackClinicId,
          }),
        );

        const enrichedVaccineItems = vaccineItems.map((item) => {
          const matchedVaccine = apiVaccines.find(
            (vaccine) => resolveInventoryVaccineMatch(item, vaccine),
          );

          return {
            ...item,
            _vaccineId: matchedVaccine ? matchedVaccine.id : null,
            code: matchedVaccine?.code || null,
          };
        });

        const mappedInventory = aggregateInventoryRecordsByVaccine(
          normalizedApiInventory,
          enrichedVaccineItems,
          fallbackClinicId,
        );

        setInventory(mappedInventory);
        setInventoryReportSource(
          normalizedApiInventory.length > 0 ? normalizedApiInventory : mappedInventory,
        );
      } catch (apiErr) {
        console.error("Inventory data load failed:", apiErr);
        setError(
          apiErr?.message ||
            "Failed to load live inventory data. The inventory sheet was not replaced with fallback zero values.",
        );
        initializeInventory();
      }

      await Promise.all([
        loadStockMovements(),
        fetchPersistedStockAlerts(),
      ]);

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
            address: facilityData.address || prev.address,
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
  }, [
    fallbackClinicId,
    fetchPersistedStockAlerts,
    initializeInventory,
    loadStockMovements,
    vaccineItems,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Instantly sync inventory if a vaccination was recorded and deducted stock
  useEffect(() => {
    const handleSyncUpdate = () => fetchData();

    window.addEventListener("vaccination-update", handleSyncUpdate);
    window.addEventListener("inventory-update", handleSyncUpdate);

    return () => {
      window.removeEventListener("vaccination-update", handleSyncUpdate);
      window.removeEventListener("inventory-update", handleSyncUpdate);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!showModal || !selectedItem || !requiresBatchSelection) {
      setAvailableLots((prev) => (prev.length > 0 ? [] : prev));
      setAvailableLotsError((prev) => (prev ? null : prev));
      setAvailableLotsLoading((prev) => (prev ? false : prev));
      setLotSearchTerm((prev) => (prev ? "" : prev));
      return undefined;
    }

    const { vaccineId } = resolveTransactionInventoryContext(selectedItem);

    if (!vaccineId) {
      setAvailableLots([]);
      setAvailableLotsError(
        "Available lot/batch records could not be loaded for this vaccine.",
      );
      setAvailableLotsLoading(false);
      return undefined;
    }

    let isActive = true;

    const loadAvailableLots = async () => {
      setAvailableLotsLoading(true);
      setAvailableLotsError(null);

      try {
        const response = await apiClient.getAvailableInventoryLots({
          vaccine_id: vaccineId,
        });
        const normalizedLots = (Array.isArray(response) ? response : [])
          .map((batch) => {
            const batchId = resolveInventorySaveRowId(
              batch.batch_id || batch.inventory_id,
            );
            const availableQuantity = Number(
              batch.available_quantity ?? batch.stock ?? 0,
            );
            const lotNumber = sanitizeText(
              batch.lot_number || batch.batch_number,
              {
                maxLength: 100,
              },
            );

            return {
              batch_id: batchId,
              inventory_id: batch.inventory_id || batchId,
              lot_number: lotNumber,
              batch_number: lotNumber,
              available_quantity: availableQuantity,
              stock: availableQuantity,
              expiry_date: sanitizeText(batch.expiry_date, { maxLength: 10 }) || null,
              storage_location:
                sanitizeText(batch.storage_location, { maxLength: 120 }) || null,
              vaccine_name:
                sanitizeText(batch.vaccine_name, { maxLength: 120 }) ||
                selectedItem?.name ||
                "Vaccine",
            };
          })
          .filter(
            (batch) =>
              batch.batch_id &&
              batch.available_quantity > 0 &&
              batch.lot_number,
          );

        if (!isActive) {
          return;
        }

        setAvailableLots(normalizedLots);
        if (normalizedLots.length === 0) {
          setAvailableLotsError(
            "No active lot/batch records with available stock were found for this vaccine.",
          );
        }
      } catch (lotError) {
        if (!isActive) {
          return;
        }

        setAvailableLots([]);
        setAvailableLotsError(
          lotError?.response?.data?.error ||
            lotError?.message ||
            "Failed to load available lot/batch records.",
        );
      } finally {
        if (isActive) {
          setAvailableLotsLoading(false);
        }
      }
    };

    loadAvailableLots();

    return () => {
      isActive = false;
    };
  }, [
    modalType,
    requiresBatchSelection,
    resolveTransactionInventoryContext,
    selectedItem,
    showModal,
  ]);

  const updatePrintPageStyle = useCallback((reportType) => {
    if (typeof document === "undefined") {
      return;
    }

    if (!printPageStyleRef.current) {
      const styleNode = document.createElement("style");
      styleNode.id = "inventory-print-page-style";
      document.head.appendChild(styleNode);
      printPageStyleRef.current = styleNode;
    }

    const printPageSize = getInventoryPrintPageSize(reportType);
    printPageStyleRef.current.textContent = `@media print { @page { size: ${printPageSize}; margin: 0.35cm; } }`;
  }, []);

  const clearPrintLayout = useCallback(() => {
    setIsPrintLayoutActive(false);
    setActivePrintReportType(null);
    activePrintReportTypeRef.current = null;
    document.body.classList.remove(
      "printing-inventory",
      "printing-report-inventory-sheet",
      "printing-report-doh-lgu-stock-form",
      "printing-report-requisition-issue-slip",
    );
    if (printPageStyleRef.current) {
      printPageStyleRef.current.textContent = "";
    }
  }, []);

  const activatePrintLayout = useCallback((reportType) => {
    setActivePrintReportType(reportType);
    activePrintReportTypeRef.current = reportType;
    setIsPrintLayoutActive(true);
    updatePrintPageStyle(reportType);
    document.body.classList.add("printing-inventory");
    document.body.classList.remove(
      "printing-report-inventory-sheet",
      "printing-report-doh-lgu-stock-form",
      "printing-report-requisition-issue-slip",
    );
    document.body.classList.add(`printing-report-${reportType}`);
  }, [updatePrintPageStyle]);

  useEffect(() => {
    activePrintReportTypeRef.current = activePrintReportType;
  }, [activePrintReportType]);

  useEffect(() => {
    const handleBeforePrint = () => {
      activatePrintLayout(
        activePrintReportTypeRef.current || PRINT_REPORT_TYPES.INVENTORY_SHEET,
      );
    };

    const handleAfterPrint = () => {
      clearPrintLayout();
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      clearPrintLayout();
      if (printPageStyleRef.current?.parentNode) {
        printPageStyleRef.current.parentNode.removeChild(printPageStyleRef.current);
        printPageStyleRef.current = null;
      }
    };
  }, [activatePrintLayout, clearPrintLayout]);

  // Filter inventory by date range
  const filteredInventory = useMemo(() => {
    if (!isFiltering || !dateRangeStart || !dateRangeEnd) {
      return inventory;
    }

    return filterItemsByPrintDateRange(inventory, {
      startDate: dateRangeStart,
      endDate: dateRangeEnd,
      getItemDates: (item) => [
        item.last_transaction_date,
        item.received_date,
        item.transferred_in_date,
        item.transferred_out_date,
        item.issuance_date,
        item.expiry_date,
      ],
    });
  }, [inventory, isFiltering, dateRangeStart, dateRangeEnd]);

  const filteredInventoryReportSource = useMemo(() => {
    if (!isFiltering || !dateRangeStart || !dateRangeEnd) {
      return inventoryReportSource;
    }

    return filterItemsByPrintDateRange(inventoryReportSource, {
      startDate: dateRangeStart,
      endDate: dateRangeEnd,
      getItemDates: (item) => [
        item.last_transaction_date,
        item.received_date,
        item.transferred_in_date,
        item.transferred_out_date,
        item.issuance_date,
        item.expiry_date,
      ],
    });
  }, [inventoryReportSource, isFiltering, dateRangeStart, dateRangeEnd]);

  const filteredStockMovements = useMemo(() => {
    if (!isFiltering || !dateRangeStart || !dateRangeEnd) {
      return stockMovements;
    }

    return filterItemsByPrintDateRange(stockMovements, {
      startDate: dateRangeStart,
      endDate: dateRangeEnd,
      getItemDates: (item) => [item.created_at, item.transaction_date],
    });
  }, [stockMovements, isFiltering, dateRangeStart, dateRangeEnd]);

  const inventoryFilterVaccineOptions = useMemo(() => {
    const vaccineNames = Array.from(
      new Set(
        inventory
          .map((item) => String(item?.name || "").trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return [
      { value: "all", label: "All Vaccines" },
      ...vaccineNames.map((name) => ({ value: name, label: name })),
    ];
  }, [inventory]);

  const stockMovementTypeOptions = useMemo(() => {
    const uniqueTypes = Array.from(
      new Set(
        stockMovements
          .map((movement) => normalizeInventoryMovementType(movement.transaction_type))
          .filter(Boolean),
      ),
    ).sort((left, right) =>
      getInventoryMovementTypeMeta(left).label.localeCompare(
        getInventoryMovementTypeMeta(right).label,
      ),
    );

    return [
      { value: "all", label: "All Types" },
      ...uniqueTypes.map((type) => ({
        value: type,
        label: getInventoryMovementTypeMeta(type).label,
      })),
    ];
  }, [stockMovements]);

  const stockMovementVaccineOptions = useMemo(() => {
    const vaccineNames = Array.from(
      new Set(
        stockMovements
          .map((movement) => String(movement?.vaccine_name || "").trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return [
      { value: "all", label: "All Vaccines" },
      ...vaccineNames.map((name) => ({ value: name, label: name })),
    ];
  }, [stockMovements]);

  const displayedInventory = useMemo(() => {
    return filteredInventory.filter((item) => {
      const matchesDateFilter = matchesOptionalDateRange(
        [
          item.last_transaction_date,
          item.received_date,
          item.transferred_in_date,
          item.transferred_out_date,
          item.issuance_date,
          item.expiry_date,
        ],
        inventoryDisplayFilters,
      );

      const matchesVaccineFilter =
        inventoryDisplayFilters.vaccine === "all" ||
        item.name === inventoryDisplayFilters.vaccine;
      const matchesStatusFilter = matchesInventoryStatusFilter(
        item,
        inventoryDisplayFilters.status,
      );

      return matchesDateFilter && matchesVaccineFilter && matchesStatusFilter;
    });
  }, [filteredInventory, inventoryDisplayFilters]);

  const displayedInventoryReportSource = useMemo(() => {
    return filteredInventoryReportSource.filter((item) => {
      const matchesDateFilter = matchesOptionalDateRange(
        [
          item.last_transaction_date,
          item.received_date,
          item.transferred_in_date,
          item.transferred_out_date,
          item.issuance_date,
          item.expiry_date,
        ],
        inventoryDisplayFilters,
      );

      const matchesVaccineFilter =
        inventoryDisplayFilters.vaccine === "all" ||
        item.name === inventoryDisplayFilters.vaccine;
      const matchesStatusFilter = matchesInventoryStatusFilter(
        item,
        inventoryDisplayFilters.status,
      );

      return matchesDateFilter && matchesVaccineFilter && matchesStatusFilter;
    });
  }, [filteredInventoryReportSource, inventoryDisplayFilters]);

  const displayedStockMovements = useMemo(() => {
    return filteredStockMovements.filter((movement) => {
      const matchesDateFilter = matchesOptionalDateRange(
        [movement.created_at, movement.transaction_date],
        stockMovementFilters,
      );
      const normalizedType = normalizeInventoryMovementType(
        movement.transaction_type,
      );
      const matchesTypeFilter =
        stockMovementFilters.type === "all" ||
        normalizedType === stockMovementFilters.type;
      const matchesVaccineFilter =
        stockMovementFilters.vaccine === "all" ||
        movement.vaccine_name === stockMovementFilters.vaccine;

      return matchesDateFilter && matchesTypeFilter && matchesVaccineFilter;
    });
  }, [filteredStockMovements, stockMovementFilters]);

  const hasActiveInventoryDisplayFilters = useMemo(
    () =>
      hasDisplayDateRangeValue(inventoryDisplayFilters) ||
      inventoryDisplayFilters.vaccine !== "all" ||
      inventoryDisplayFilters.status !== "all",
    [inventoryDisplayFilters],
  );

  const hasActiveStockMovementFilters = useMemo(
    () =>
      hasDisplayDateRangeValue(stockMovementFilters) ||
      stockMovementFilters.type !== "all" ||
      stockMovementFilters.vaccine !== "all",
    [stockMovementFilters],
  );

  const updateInventoryDisplayFilter = useCallback((field, value) => {
    setInventoryDisplayFilters((previous) =>
      previous[field] === value ? previous : { ...previous, [field]: value },
    );
  }, []);

  const clearInventoryDisplayFilters = useCallback(() => {
    setInventoryDisplayFilters(createDefaultInventoryDisplayFilters());
  }, []);

  const updateStockMovementFilter = useCallback((field, value) => {
    setStockMovementFilters((previous) =>
      previous[field] === value ? previous : { ...previous, [field]: value },
    );
  }, []);

  const clearStockMovementFilters = useCallback(() => {
    setStockMovementFilters(createDefaultStockMovementFilters());
  }, []);

  const trackedInventory = useMemo(
    () => displayedInventory.filter((item) => shouldPersistInventoryRow(item)),
    [displayedInventory],
  );

  const inventorySummaryStats = useMemo(() => {
    const trackedReportRows = displayedInventoryReportSource.filter((item) =>
      shouldPersistInventoryRow(item),
    );

    return {
      total_items: trackedInventory.length,
      low_stock_items: trackedInventory.filter(
        (item) =>
          Number(item.stock_on_hand || 0) <= Number(item.low_stock_threshold || 10),
      ).length,
      expired_items: trackedReportRows.filter(
        (item) =>
          Number(item.stock_on_hand || 0) > 0 &&
          isExpiredInventoryDate(item.expiry_date),
      ).length,
    };
  }, [displayedInventoryReportSource, trackedInventory]);

  // Persist inventory sheet to backend
  const handleSaveInventorySheet = async () => {
    try {
      setLoading(true);
      setError(null);

      const savePeriod = resolveInventorySavePeriod({
        reportDate,
        dateRangeStart,
        dateRangeEnd,
        isFiltering,
      });

      const rowsToPersist = inventory.filter((item) => shouldPersistInventoryRow(item));
      if (rowsToPersist.length === 0) {
        alert("No inventory rows need saving yet.");
        return;
      }

      const unresolvedRows = [];
      const saveOperations = rowsToPersist.map((item) => {
        const payload = {
          beginning_balance: normalizeInventorySaveNumber(item.beginning_balance),
          received_during_period: normalizeInventorySaveNumber(item.received),
          transferred_in: normalizeInventorySaveNumber(item.transferred_in),
          transferred_out: normalizeInventorySaveNumber(item.transferred_out),
          expired_wasted: normalizeInventorySaveNumber(item.expired_wasted),
          issuance: normalizeInventorySaveNumber(item.issuance),
          period_start: savePeriod.period_start,
          period_end: savePeriod.period_end,
        };

        const lotBatchNumber = sanitizeText(item.lot_batch_number || "");
        if (lotBatchNumber) {
          payload.lot_batch_number = lotBatchNumber;
        }

        const existingInventoryId = resolveInventorySaveRowId(item._apiId);
        if (existingInventoryId) {
          return () => apiClient.updateVaccineInventory(existingInventoryId, payload);
        }

        const vaccineId = resolveInventorySaveRowId(item._vaccineId);
        const clinicId = resolveInventorySaveRowId(item._facilityId || fallbackClinicId);

        if (!vaccineId) {
          unresolvedRows.push(item.name || "Unnamed vaccine");
          return null;
        }

        return () =>
          apiClient.createVaccineInventory({
            ...payload,
            vaccine_id: vaccineId,
            clinic_id: clinicId || undefined,
          });
      });

      if (unresolvedRows.length > 0) {
        throw new Error(
          `Unable to save these inventory rows because they are not linked to a vaccine record: ${summarizeInventoryRowLabels(
            unresolvedRows,
          )}.`,
        );
      }

      for (const operation of saveOperations) {
        if (typeof operation === "function") {
          await operation();
        }
      }

      alert("Inventory sheet saved successfully.");

      // Refresh data so the frontend captures the newly generated database IDs required for transactions
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save inventory sheet data.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals from the currently displayed inventory rows
  const calculateTotals = useCallback(() => {
    return displayedInventory.reduce(
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
  }, [displayedInventory]);

  const closeTransactionModal = useCallback(() => {
    setShowModal(false);
    setTransactionErrors({});
    setTransactionSubmitError(null);
    setIsTransactionSubmitting(false);
    setAvailableLots([]);
    setAvailableLotsError(null);
    setAvailableLotsLoading(false);
    setLotSearchTerm("");
  }, []);

  // Open modal for transaction
  const openTransactionModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setTransactionErrors({});
    setTransactionSubmitError(null);
    setIsTransactionSubmitting(false);
    setAvailableLots([]);
    setAvailableLotsError(null);
    setAvailableLotsLoading(false);
    setLotSearchTerm("");
    setFormData({
      batch_id: "",
      quantity: "",
      lot_number: "",
      expiry_date: "",
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

    setTransactionSubmitError(null);

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
    const expiryDateInput = sanitizeText(formData.expiry_date);
    const expiryDateCheck = validateDate(expiryDateInput, {
      label: "Expiry date",
      required: modalType === "receive",
    });
    const expiryDate = expiryDateCheck.value;
    if (modalType === "receive") {
      if (!lotNumber) {
        nextErrors.lot_number = "Lot/Batch number is required for received stock.";
      }
    }

    if ((modalType === "receive" || expiryDateInput) && (expiryDateCheck.error || !expiryDate)) {
      nextErrors.expiry_date =
        expiryDateCheck.error || "A valid expiry date is required.";
    } else if (expiryDate && transactionDate && expiryDate < transactionDate) {
      nextErrors.expiry_date =
        "Expiry date must be on or after the transaction date.";
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

    if (requiresBatchSelection) {
      if (!selectedBatchOption) {
        nextErrors.batch_id = availableLotsLoading
          ? "Available lot/batch records are still loading."
          : "Select the exact lot/batch to continue.";
      } else if (batchStockPreview?.unavailable) {
        nextErrors.batch_id =
          "The selected lot/batch has no available stock remaining.";
      } else if (Number.isFinite(qty) && batchStockPreview?.insufficientStock) {
        nextErrors.quantity = `Only ${batchStockPreview.available} units are available in the selected lot/batch.`;
      }
    } else if (
      ["issue", "waste", "transfer_out"].includes(modalType) &&
      Number.isFinite(qty) &&
      qty > Number(selectedItem.stock_on_hand || 0)
    ) {
      nextErrors.quantity = "Quantity cannot exceed current stock on hand.";
    }

    if (hasFieldErrors(nextErrors)) {
      setTransactionErrors(nextErrors);
      return;
    }

    try {
      setIsTransactionSubmitting(true);
      setTransactionErrors({});
      setTransactionSubmitError(null);

      const {
        matchedInventory,
        inventoryId: dbInventoryId,
        vaccineId: matchedVaccineId,
        clinicId,
      } = resolveTransactionInventoryContext(selectedItem);
      if (!matchedInventory) {
        setTransactionSubmitError("Selected inventory item was not found.");
        return;
      }

      // For RECEIVE transactions, we can auto-create the inventory record if it doesn't exist
      // For other transaction types, the inventory record must exist first
      if (!dbInventoryId && modalType !== 'receive') {
        setTransactionSubmitError("Please save the inventory record first before creating transactions. Click on the Save Inventory button to save your current inventory data to the database.");
        return;
      }
      
      if (!matchedVaccineId) {
        setTransactionSubmitError("Vaccine ID not found. Please ensure the vaccine is properly configured.");
        return;
      }

      const effectiveLotNumber =
        requiresBatchSelection
          ? sanitizeText(
              selectedBatchOption?.lot_number || selectedBatchOption?.batch_number,
              { maxLength: 50 },
            )
          : lotNumber ||
            sanitizeText(
              matchedInventory.lot_batch_number || matchedInventory.lot_number,
              { maxLength: 50 },
            );
      const effectiveExpiryDate =
        requiresBatchSelection
          ? sanitizeText(selectedBatchOption?.expiry_date, { maxLength: 10 })
          : expiryDateInput ||
            sanitizeText(matchedInventory.expiry_date, { maxLength: 10 });

      if (!Number.isInteger(Number(clinicId)) || Number(clinicId) < 1) {
        setTransactionSubmitError(
          "Clinic ID not found. Please refresh the page and try again.",
        );
        return;
      }

      console.log('🔍 Transaction Debug Info:');
      console.log('- modalType:', modalType);
      console.log('- dbInventoryId:', dbInventoryId);
      console.log('- matchedVaccineId:', matchedVaccineId);
      console.log('- clinicId:', clinicId);
      console.log('- fallbackClinicId:', fallbackClinicId);
      console.log('- clinicId:', clinicId);
      console.log('- formData:', formData);

      const payload = {
        // For RECEIVE transactions without existing inventory, use a placeholder ID (backend will auto-create)
        vaccine_inventory_id: dbInventoryId || 0,
        transaction_type: mapModalTypeToApiType(modalType),
        quantity: Number(qty),
        transaction_date: formData.date,
        vaccine_id: matchedVaccineId,
        clinic_id: Number(clinicId),
      };

      if (requiresBatchSelection && selectedBatchOption?.batch_id) {
        payload.batch_id = Number(selectedBatchOption.batch_id);
      }
      if (effectiveLotNumber) {
        payload.lot_number = effectiveLotNumber;
        payload.lot_batch_number = effectiveLotNumber;
      }
      if (normalizedNotes) {
        payload.notes = normalizedNotes;
      }
      if (effectiveExpiryDate) {
        payload.expiry_date = effectiveExpiryDate;
      }

      console.log('📤 Sending transaction payload:', JSON.stringify(payload, null, 2));

      const transactionResponse =
        await apiClient.createVaccineInventoryTransaction(payload);

      setInventory((prev) =>
        prev.map((item) => {
          if (item.id === selectedItem.id) {
            const updatedItem = { ...item };

            switch (modalType) {
              case "receive":
                updatedItem.received += qty;
                updatedItem.lot_batch_number =
                  effectiveLotNumber || updatedItem.lot_batch_number;
                updatedItem.expiry_date = formData.expiry_date || updatedItem.expiry_date;
                updatedItem.received_date = formData.date || updatedItem.received_date;
                break;
              case "issue":
                updatedItem.issuance += qty;
                updatedItem.issuance_date = formData.date || updatedItem.issuance_date;
                break;
              case "waste":
                updatedItem.expired_wasted += qty;
                break;
              case "transfer_in":
                updatedItem.transferred_in += qty;
                updatedItem.transferred_in_date =
                  formData.date || updatedItem.transferred_in_date;
                break;
              case "transfer_out":
                updatedItem.transferred_out += qty;
                updatedItem.transferred_out_date =
                  formData.date || updatedItem.transferred_out_date;
                break;
              default:
                break;
            }

            updatedItem.last_transaction_date =
              formData.date || updatedItem.last_transaction_date;

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

      if (requiresBatchSelection && selectedBatchOption?.batch_id) {
        const remainingQuantity = Number(
          transactionResponse?.selected_batch?.remaining_quantity ??
            Math.max(
              Number(selectedBatchOption.available_quantity || 0) - Number(qty || 0),
              0,
            ),
        );

        setAvailableLots((prev) =>
          prev
            .map((batch) => {
              if (
                resolveInventorySaveRowId(batch.batch_id || batch.inventory_id) !==
                resolveInventorySaveRowId(selectedBatchOption.batch_id)
              ) {
                return batch;
              }

              return {
                ...batch,
                available_quantity: remainingQuantity,
                stock: remainingQuantity,
              };
            })
            .filter((batch) => Number(batch.available_quantity || 0) > 0),
        );
      }

      closeTransactionModal();

      // Broadcast event so other charts and dashboards update their inventory figures instantly
      window.dispatchEvent(new CustomEvent("inventory-update"));
    } catch (err) {
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setTransactionErrors((prev) => ({
          ...prev,
          ...backendFields,
        }));
      }
      const firstBackendFieldError = Object.values(backendFields).find(
        (value) => typeof value === "string" && value.trim(),
      );
      setTransactionSubmitError(
        firstBackendFieldError ||
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err.message ||
          "Failed to save inventory transaction.",
      );
    } finally {
      setIsTransactionSubmitting(false);
    }
  };

  const printReport = (reportType = PRINT_REPORT_TYPES.INVENTORY_SHEET) => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const normalizedReportType = normalizeInventoryReportType(reportType);

    // Ensure we're on the inventory sheet tab
    if (resolvedActiveTab !== INVENTORY_DEFAULT_TAB_KEY) {
      handleTabChange(INVENTORY_DEFAULT_TAB_KEY);
    }

    activatePrintLayout(normalizedReportType);

    // Small delay to ensure DOM updates
    setTimeout(() => {
      window.print();
      // Remove the class after print dialog closes
      setTimeout(() => {
        clearPrintLayout();
      }, 100);
    }, 100);
  };

  // Stock alerts calculation - now includes expiring vaccines
  const getStockAlerts = useCallback(() => {
    const alerts = {
      critical: [],
      low: [],
      unused: [],
      wasted: [],
      expiring: [], // Nearly expiring (within 30 days)
    };

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    trackedInventory.forEach((item) => {
      const criticalThreshold = Number(item.critical_stock_threshold || 5);
      const lowThreshold = Number(item.low_stock_threshold || 10);

      if (item.stock_on_hand <= criticalThreshold) {
        alerts.critical.push(item);
      } else if (item.stock_on_hand <= lowThreshold) {
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

      // Check for nearly expiring vaccines (expiry_date within 30 days)
      if (item.expiry_date) {
        const expiryDate = new Date(item.expiry_date);
        if (!Number.isNaN(expiryDate.getTime()) &&
            expiryDate >= now &&
            expiryDate <= thirtyDaysFromNow &&
            item.stock_on_hand > 0) {
          alerts.expiring.push({
            ...item,
            days_until_expiry: Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
          });
        }
      }
    });

    return alerts;
  }, [trackedInventory]);

  const stockAlerts = getStockAlerts();
  const stockMovementSummary = useMemo(
    () => summarizeStockMovements(stockMovements),
    [stockMovements],
  );
  const pendingPersistedStockAlerts = useMemo(
    () =>
      persistedStockAlerts.filter(
        (alert) => normalizeStockAlertStatus(alert.status) === "active",
      ),
    [persistedStockAlerts],
  );
  const resolvablePersistedStockAlerts = useMemo(
    () =>
      persistedStockAlerts.filter(
        (alert) => normalizeStockAlertStatus(alert.status) !== "resolved",
      ),
    [persistedStockAlerts],
  );
  const resolvedPersistedStockAlerts = useMemo(
    () =>
      persistedStockAlerts.filter(
        (alert) => normalizeStockAlertStatus(alert.status) === "resolved",
      ),
    [persistedStockAlerts],
  );
  const stockAlertWorkflowTotalPages = Math.max(
    1,
    Math.ceil(persistedStockAlerts.length / INVENTORY_TABLE_PAGE_SIZE),
  );
  const paginatedPersistedStockAlerts = useMemo(() => {
    const startIndex =
      (stockAlertWorkflowPage - 1) * INVENTORY_TABLE_PAGE_SIZE;
    return persistedStockAlerts.slice(
      startIndex,
      startIndex + INVENTORY_TABLE_PAGE_SIZE,
    );
  }, [persistedStockAlerts, stockAlertWorkflowPage]);

  useEffect(() => {
    setStockAlertWorkflowPage(1);
  }, [persistedStockAlerts]);

  const openBulkStockAlertConfirmation = useCallback(
    (action) => {
      if (!canManageStockAlertActions) {
        return;
      }

      const eligibleAlerts =
        action === "acknowledge"
          ? pendingPersistedStockAlerts
          : resolvablePersistedStockAlerts;

      if (eligibleAlerts.length === 0) {
        return;
      }

      setPendingBulkStockAlertAction({
        action,
        alertIds: eligibleAlerts.map((alert) => alert.id),
        count: eligibleAlerts.length,
        title:
          action === "acknowledge"
            ? "Confirm Acknowledge All"
            : "Confirm Resolve All",
        description:
          action === "acknowledge"
            ? `Acknowledge all ${eligibleAlerts.length} pending stock alert${eligibleAlerts.length === 1 ? "" : "s"} for this facility?`
            : `Resolve all ${eligibleAlerts.length} eligible stock alert${eligibleAlerts.length === 1 ? "" : "s"} for this facility?`,
        confirmLabel:
          action === "acknowledge" ? "Acknowledge All" : "Resolve All",
      });
      setStockAlertFeedback(null);
    },
    [
      canManageStockAlertActions,
      pendingPersistedStockAlerts,
      resolvablePersistedStockAlerts,
    ],
  );

  const handleConfirmBulkStockAlertAction = useCallback(async () => {
    if (!pendingBulkStockAlertAction) {
      return;
    }

    try {
      setIsSubmittingBulkStockAlertAction(true);
      setStockAlertFeedback(null);

      const payload = {
        clinic_id: fallbackClinicId,
        alert_ids: pendingBulkStockAlertAction.alertIds,
      };

      const response =
        pendingBulkStockAlertAction.action === "acknowledge"
          ? await apiClient.acknowledgeAllVaccineStockAlerts(payload)
          : await apiClient.resolveAllVaccineStockAlerts({
              ...payload,
              resolution_notes: "Resolved in bulk from the Inventory module.",
            });

      await fetchPersistedStockAlerts();
      setStockAlertFeedback({
        variant: "success",
        message:
          response?.message ||
          (pendingBulkStockAlertAction.action === "acknowledge"
            ? `Acknowledged ${pendingBulkStockAlertAction.count} stock alerts.`
            : `Resolved ${pendingBulkStockAlertAction.count} stock alerts.`),
      });
      setPendingBulkStockAlertAction(null);
    } catch (bulkActionError) {
      setStockAlertFeedback({
        variant: "error",
        message:
          bulkActionError?.response?.data?.error ||
          bulkActionError?.message ||
          "Unable to complete the bulk stock-alert action.",
      });
    } finally {
      setIsSubmittingBulkStockAlertAction(false);
    }
  }, [fallbackClinicId, fetchPersistedStockAlerts, pendingBulkStockAlertAction]);

  const renderAlertWorkflowCard = () => {
    if (!canManageStockAlertActions) {
      return null;
    }

    return (
      <Card className="flex min-h-0 flex-col overflow-hidden p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Alert Workflow
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bulk-manage persisted stock alerts for the current facility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="info">
                Pending: {pendingPersistedStockAlerts.length}
              </Badge>
              <Badge variant="warning">
                Acknowledged:{" "}
                {resolvablePersistedStockAlerts.length - pendingPersistedStockAlerts.length}
              </Badge>
              <Badge variant="success">
                Resolved: {resolvedPersistedStockAlerts.length}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openBulkStockAlertConfirmation("acknowledge")}
              disabled={
                stockAlertsLoading ||
                isSubmittingBulkStockAlertAction ||
                pendingPersistedStockAlerts.length === 0
              }
            >
              Acknowledge All
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => openBulkStockAlertConfirmation("resolve")}
              disabled={
                stockAlertsLoading ||
                isSubmittingBulkStockAlertAction ||
                resolvablePersistedStockAlerts.length === 0
              }
            >
              Resolve All
            </Button>
          </div>
        </div>

        {stockAlertFeedback && (
          <Alert
            variant={stockAlertFeedback.variant}
            className="mt-4"
          >
            {stockAlertFeedback.message}
          </Alert>
        )}

        {stockAlertLoadError && (
          <Alert variant="error" className="mt-4">
            {stockAlertLoadError}
          </Alert>
        )}

        <div
          className="auto-hide-scrollbar mt-4 min-h-0 max-h-[min(52vh,30rem)] overflow-auto"
          data-testid="inventory-summary-workflow-scroll-region"
        >
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-[1] bg-gray-50 dark:bg-gray-700/40">
              <tr>
                <th className="bg-gray-50 px-3 py-2 text-left text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Vaccine
                </th>
                <th className="bg-gray-50 px-3 py-2 text-left text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Alert
                </th>
                <th className="bg-gray-50 px-3 py-2 text-left text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Priority
                </th>
                <th className="bg-gray-50 px-3 py-2 text-center text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Current
                </th>
                <th className="bg-gray-50 px-3 py-2 text-center text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Threshold
                </th>
                <th className="bg-gray-50 px-3 py-2 text-left text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Status
                </th>
                <th className="bg-gray-50 px-3 py-2 text-left text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {paginatedPersistedStockAlerts.map((alert) => (
                <tr key={alert.id} className="dark:bg-gray-800/40">
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {alert.vaccine_name}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex flex-col gap-1">
                      <span>{formatStockAlertTypeLabel(alert.alert_type)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {alert.message || "No message provided."}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={getStockAlertPriorityVariant(alert.priority)}>
                      {alert.priority || "LOW"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                    {alert.current_stock}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                    {alert.threshold_value}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={getStockAlertStatusVariant(alert.status)}>
                      {formatStockAlertStatusLabel(alert.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                    {formatStockAlertTimestamp(
                      alert.resolved_at ||
                        alert.acknowledged_at ||
                        alert.updated_at ||
                        alert.created_at,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!stockAlertsLoading && persistedStockAlerts.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No persisted stock alerts are currently tracked for this facility.
            </div>
          )}

          {stockAlertsLoading && (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Refreshing stock alert statuses...
            </div>
          )}
        </div>
        <InventoryPaginationFooter
          testId="inventory-summary-workflow-pagination"
          className="-mx-4 -mb-4 mt-4"
          currentPage={stockAlertWorkflowPage}
          itemsPerPage={INVENTORY_TABLE_PAGE_SIZE}
          totalItems={persistedStockAlerts.length}
          itemLabel="alerts"
          onPrevious={() =>
            setStockAlertWorkflowPage((page) => Math.max(1, page - 1))
          }
          onNext={() =>
            setStockAlertWorkflowPage((page) =>
              Math.min(stockAlertWorkflowTotalPages, page + 1),
            )
          }
        />
      </Card>
    );
  };

  // Use the currently displayed inventory rows for report generation/export
  const printRows = useMemo(
    () => buildInventoryPrintRows(displayedInventory),
    [displayedInventory],
  );

  const printTotals = useMemo(
    () => buildInventoryPrintTotals(printRows),
    [printRows],
  );

  const reportRows = useMemo(
    () => buildDohLguReportRows(displayedInventoryReportSource),
    [displayedInventoryReportSource],
  );

  const risReportRows = useMemo(
    () => buildRisReportRows(displayedInventoryReportSource),
    [displayedInventoryReportSource],
  );

  const risControlNumber = useMemo(
    () =>
      resolveRisControlNumber({
        facilityInfo,
        inventoryRows: displayedInventoryReportSource,
        reportDate,
        clinicId: fallbackClinicId,
      }),
    [
      facilityInfo,
      displayedInventoryReportSource,
      reportDate,
      fallbackClinicId,
    ],
  );

  const downloadSelectedPdf = async (reportTypeOverride) => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const reportType = normalizeInventoryReportType(
      typeof reportTypeOverride === "string"
        ? reportTypeOverride
        : selectedExportReportType,
    );

    try {
      if (reportType === PRINT_REPORT_TYPES.INVENTORY_SHEET) {
        await exportInventorySheetPdf({
          facilityInfo,
          reportDate,
          printRows,
          printTotals,
          dateRangeStart,
          dateRangeEnd,
          isFiltering,
        });
        return;
      }

      if (reportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM) {
        await exportDohLguInventoryPdf({
          facilityInfo,
          reportDate,
          reportRows,
          dateRangeStart,
          dateRangeEnd,
          isFiltering,
        });
        return;
      }

      if (reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
        await exportRisPdf({
          facilityInfo,
          reportDate,
          reportRows: risReportRows,
          controlNumber: risControlNumber,
          dateRangeStart,
          dateRangeEnd,
          isFiltering,
        });
        return;
      }

      throw new Error("Unsupported inventory PDF report format selected.");
    } catch (pdfError) {
      setError(
        pdfError?.message || "Failed to generate the selected PDF report.",
      );
    }
  };

  const downloadSelectedWord = useCallback(async (reportTypeOverride) => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const reportType = normalizeInventoryReportType(
      typeof reportTypeOverride === "string"
        ? reportTypeOverride
        : selectedExportReportType,
    );

    try {
      const commonProps = {
        facilityInfo,
        reportDate,
        dateRangeStart,
        dateRangeEnd,
        isFiltering,
      };

      if (reportType === PRINT_REPORT_TYPES.INVENTORY_SHEET) {
        const [embeddedLeftLogoSrc, embeddedRightLogoSrc] = await Promise.all([
          loadImageDataUrl(INVENTORY_SHEET_LEFT_LOGO_SRC),
          loadImageDataUrl(INVENTORY_SHEET_RIGHT_LOGO_SRC),
        ]);

        downloadWordDocument({
          html: buildInventorySheetWordHtml({
            ...commonProps,
            printRows,
            printTotals,
            leftLogoSrc: embeddedLeftLogoSrc || INVENTORY_SHEET_LEFT_LOGO_SRC,
            rightLogoSrc: embeddedRightLogoSrc || INVENTORY_SHEET_RIGHT_LOGO_SRC,
          }),
          filename: `inventory-sheet-${reportDate || "report"}.docx`,
          title: PRINT_REPORT_COPY.inventorySheetTitle,
          headerText: "",
          footerText: "",
          page: getInventoryReportWordPagePreset(reportType),
        });
        return;
      }

      if (reportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM) {
        downloadWordDocument({
          html: buildDohLguStockWordHtml({
            ...commonProps,
            reportRows,
          }),
          filename: `${DOH_LGU_REPORT_FILENAME_PREFIX}-${reportDate || "report"}.docx`,
          title: PRINT_REPORT_COPY.dohLguTitle,
          headerText: PRINT_REPORT_COPY.dohLguTitle,
          footerText: "DOH and LGU stock inventory report",
          page: getInventoryReportWordPagePreset(reportType),
        });
        return;
      }

      if (reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
        const [embeddedLeftSealSrc, embeddedRightSealSrc] = await Promise.all([
          loadImageDataUrl(PASIG_REPORT_SEAL_SRC),
          loadImageDataUrl(DOH_REPORT_SEAL_SRC),
        ]);

        downloadWordDocument({
          html: buildRisWordHtml({
            ...commonProps,
            reportRows: risReportRows,
            controlNumber: risControlNumber,
            leftSealSrc: embeddedLeftSealSrc || PASIG_REPORT_SEAL_SRC,
            rightSealSrc: embeddedRightSealSrc || DOH_REPORT_SEAL_SRC,
          }),
          filename: `${RIS_REPORT_FILENAME_PREFIX}-${reportDate || "report"}.docx`,
          title: PRINT_REPORT_COPY.risTitle,
          headerText: "",
          footerText: "Requisition and issue slip",
          page: RIS_EXPORT_PAGE.wordPagePreset,
        });
        return;
      }

      throw new Error("Unsupported inventory Word report format selected.");
    } catch (wordError) {
      setError(
        wordError?.message || "Failed to generate the selected Word document.",
      );
    }
  }, [
    dateRangeEnd,
    dateRangeStart,
    facilityInfo,
    isFiltering,
    printDateRange,
    printRows,
    printTotals,
    reportDate,
    reportRows,
    risControlNumber,
    risReportRows,
    selectedExportReportType,
  ]);

  const handleSelectedReportPrint = (reportTypeOverride) => {
    printReport(
      normalizeInventoryReportType(
        reportTypeOverride ?? selectedExportReportType,
      ),
    );
  };

  const handleGenerateReportFromModal = async () => {
    const selectedReportType = normalizeInventoryReportType(
      selectedExportReportType,
    );
    const selectedDeliveryType = selectedReportDeliveryType;

    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    setIsGenerateReportModalOpen(false);

    if (selectedDeliveryType === INVENTORY_REPORT_DELIVERY_TYPES.PDF) {
      await downloadSelectedPdf(selectedReportType);
      return;
    }

    if (selectedDeliveryType === INVENTORY_REPORT_DELIVERY_TYPES.WORD) {
      await downloadSelectedWord(selectedReportType);
      return;
    }

    setTimeout(() => {
      handleSelectedReportPrint(selectedReportType);
    }, 0);
  };

  const activePrintReportMarkup =
    isPrintLayoutActive &&
    (activePrintReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET ? (
      <InventorySheetSummaryPrintReport
        facilityInfo={facilityInfo}
        reportDate={reportDate}
        printRows={printRows}
        printTotals={printTotals}
        dateRangeStart={dateRangeStart}
        dateRangeEnd={dateRangeEnd}
        isFiltering={isFiltering}
      />
    ) : activePrintReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM ? (
      <DohLguStockInventoryPrintReport
        facilityInfo={facilityInfo}
        reportDate={reportDate}
        reportRows={reportRows}
        dateRangeStart={dateRangeStart}
        dateRangeEnd={dateRangeEnd}
        isFiltering={isFiltering}
      />
    ) : activePrintReportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP ? (
      <RequisitionIssueSlipPrintReport
        facilityInfo={facilityInfo}
        reportDate={reportDate}
        reportRows={risReportRows}
        controlNumber={risControlNumber}
        dateRangeStart={dateRangeStart}
        dateRangeEnd={dateRangeEnd}
        isFiltering={isFiltering}
      />
    ) : null);

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
    <div
      className="inventory-management flex h-full min-h-0 flex-col gap-4 overflow-y-auto modern-scrollbar p-4"
      data-active-tab={resolvedActiveTab}
    >
      {/* Header - Hidden on Print */}
      <div
        className="sticky top-0 z-20 space-y-4 bg-gray-50/95 pb-2 backdrop-blur dark:bg-gray-900/95 print:hidden"
        data-testid="inventory-sticky-shell"
      >
        <PageHeader
          title="Vaccine Inventory Management"
          subtitle="Paper-based inventory tracking system for vaccinations"
          icon={<span className="text-2xl drop-shadow-md">💉</span>}
          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-xl sm:rounded-2xl text-white shadow-lg w-full border-0"
          actions={
            <InventoryHeaderTabs
              activeTab={resolvedActiveTab}
              onTabChange={handleTabChange}
              criticalAlertCount={stockAlerts.critical.length}
            />
          }
        />

        {/* Tab Navigation */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
          <div className="flex flex-wrap items-end gap-3">
            <div className="hidden">
              <div className="inline-flex min-w-max gap-2 rounded-xl bg-gray-100 p-1.5 dark:bg-gray-900/70">
                <button
            onClick={() => handleTabChange("inventory_sheet")}
            aria-controls={INVENTORY_TAB_PANEL_IDS.inventory_sheet}
            aria-pressed={resolvedActiveTab === "inventory_sheet"}
            data-tab-key="inventory_sheet"
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              resolvedActiveTab === "inventory_sheet"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <span>📋</span>
            <span>Inventory Sheet</span>
          </button>
                <button
            onClick={() => handleTabChange("inventory_summary")}
            aria-controls={INVENTORY_TAB_PANEL_IDS.inventory_summary}
            aria-pressed={resolvedActiveTab === "inventory_summary"}
            data-tab-key="inventory_summary"
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap relative ${
              resolvedActiveTab === "inventory_summary"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <span>📊</span>
            <span>Inventory Summary</span>
            {stockAlerts.critical.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full">
                {stockAlerts.critical.length}
              </span>
            )}
          </button>
                <button
            onClick={() => handleTabChange("stock_movements")}
            aria-controls={INVENTORY_TAB_PANEL_IDS.stock_movements}
            aria-pressed={resolvedActiveTab === "stock_movements"}
            data-tab-key="stock_movements"
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              resolvedActiveTab === "stock_movements"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <span>📦</span>
            <span>Stock Movements</span>
          </button>
        </div>
      </div>
            <InventoryActiveTabToolbarFilters
              activeTab={resolvedActiveTab}
              inventoryFilters={inventoryDisplayFilters}
              inventoryVaccineOptions={inventoryFilterVaccineOptions}
              onInventoryFilterChange={updateInventoryDisplayFilter}
              onClearInventoryFilters={clearInventoryDisplayFilters}
              hasActiveInventoryFilters={hasActiveInventoryDisplayFilters}
              stockMovementFilters={stockMovementFilters}
              stockMovementTypeOptions={stockMovementTypeOptions}
              stockMovementVaccineOptions={stockMovementVaccineOptions}
              onStockMovementFilterChange={updateStockMovementFilter}
              onClearStockMovementFilters={clearStockMovementFilters}
              hasActiveStockMovementFilters={hasActiveStockMovementFilters}
              selectedReportType={selectedExportReportType}
              onReportTypeChange={(value) =>
                setSelectedExportReportType(
                  normalizeInventoryReportType(value),
                )
              }
              onSaveInventory={
                resolvedActiveTab === "inventory_sheet"
                  ? handleSaveInventorySheet
                  : undefined
              }
              onPrintReport={
                resolvedActiveTab === "inventory_sheet"
                  ? handleSelectedReportPrint
                  : undefined
              }
              onGenerateReport={() => {
                setSelectedReportDeliveryType(
                  INVENTORY_REPORT_DELIVERY_TYPES.PRINT,
                );
                setIsGenerateReportModalOpen(true);
              }}
              showDivider={false}
            />
          </div>
        </div>

      </div>

      {activePrintReportMarkup ? (
        <InventoryPrintPortal>{activePrintReportMarkup}</InventoryPrintPortal>
      ) : null}

      {/* Inventory Sheet Tab - This is the ONLY content that will print */}
      {resolvedActiveTab === "inventory_sheet" && (
        <section
          id={INVENTORY_TAB_PANEL_IDS.inventory_sheet}
          data-testid="inventory-sheet-panel"
          className="inventory-sheet-print-area space-y-3 print:space-y-1"
        >
          {printDateRange.hasAppliedDateRange ? (
            <div className="print:hidden flex flex-wrap items-center justify-end gap-2">
              <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                {printDateRange.activeDateRangeLabel}
              </div>
            </div>
          ) : null}

           {/* Report Date and Date Range Filter - Hidden on Print, Visible on Screen */}
          <div className="hidden" hidden aria-hidden="true">
            {/* Single Date Picker */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="inventory-report-date"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
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

            <PrintDateRangeControls
              controller={printDateRange}
              label="Print Date Range"
              className="min-w-[320px] flex-1"
            />

            {/* Export buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveInventorySheet}
                className="gap-2 mr-2"
              >
                💾 Save Inventory
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => printReport(PRINT_REPORT_TYPES.INVENTORY_SHEET)}
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
                    d="M6 9V4h12v5M6 18h12v2H6zm-3-8h18a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z"
                  />
                </svg>
                Print Inventory Sheet
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  printReport(PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM)
                }
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
                    d="M6 9V4h12v5M6 18h12v2H6zm-3-8h18a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z"
                  />
                </svg>
                Print Stock Form
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadSelectedPdf(PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM)
                }
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
                Download Stock Form PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  printReport(PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP)
                }
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
                    d="M6 9V4h12v5M6 18h12v2H6zm-3-8h18a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z"
                  />
                </svg>
                Print RIS Form
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadSelectedPdf(PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP)
                }
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
                Download RIS PDF
              </Button>
            </div>
          </div>

          {/* Paper Configuration Inventory Table */}
          <Card className="overflow-hidden p-0 print:shadow-none print:border-none dark:bg-gray-800 dark:border-gray-700">
            <div className="overflow-x-auto overflow-y-visible print:overflow-visible">
              <table
                className="w-full border-collapse text-xs sm:text-sm"
                id="inventory-table"
              >
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700 print:bg-gray-300">
                    <th
                      className="sticky top-0 z-10 border border-black bg-gray-200 px-2 py-1 text-center font-bold text-gray-900 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 print:bg-gray-300"
                    >
                      A
                    </th>
                    <th
                      className="sticky top-0 z-10 min-w-[100px] border border-black bg-gray-200 px-2 py-1 text-left font-bold text-gray-900 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 print:bg-gray-300"
                    >
                      ITEMS
                    </th>
                    <th
                      className="sticky top-0 z-10 w-12 border border-black bg-blue-100 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-blue-900/50"
                    >
                      B
                      <br />
                      Beginning
                      <br />
                      Balance
                    </th>
                    <th
                      className="sticky top-0 z-10 w-12 border border-black bg-green-100 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-green-900/50"
                    >
                      C
                      <br />
                      Received
                    </th>
                    <th
                      className="sticky top-0 z-10 w-16 border border-black bg-gray-100 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-gray-700"
                    >
                      Lot /
                      <br />
                      Batch Number
                    </th>
                    <th
                      className="sticky top-0 z-10 w-10 border border-black bg-gray-100 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-gray-700"
                    >
                      Stock Movement
                      <br />
                      (In / Out)
                    </th>
                    <th
                      className="sticky top-0 z-10 w-10 border border-black bg-red-50 px-2 py-1 text-center font-bold text-gray-900 dark:border-gray-500 dark:bg-red-900/30 dark:text-gray-100"
                    >
                      Expired /
                      <br />
                      Wasted
                    </th>
                    <th
                      className="sticky top-0 z-10 w-12 border border-black bg-blue-200 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-blue-800/50"
                    >
                      G
                      <br />
                      Total
                      <br />
                      Available
                    </th>
                    <th
                      className="sticky top-0 z-10 w-10 border border-black bg-yellow-100 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-yellow-900/50"
                    >
                      H
                      <br />
                      Issued
                    </th>
                    <th
                      className="sticky top-0 z-10 w-12 border border-black bg-green-200 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-green-800/50"
                    >
                      I+J
                      <br />
                      Stock On
                      <br />
                      Hand
                    </th>
                    <th
                      className="sticky top-0 z-10 w-8 border border-black bg-gray-200 px-1 py-1 text-center font-bold text-gray-900 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 print:hidden print:bg-gray-300"
                      colSpan={3}
                    >
                      Act
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedInventory.length === 0 ? (
                    <tr className="bg-white dark:bg-gray-800">
                      <td
                        colSpan={13}
                        className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 print:text-gray-700"
                      >
                        No inventory rows match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    displayedInventory.map((item, index) => (
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
                        <div className="w-full text-center text-sm bg-blue-50 dark:bg-blue-900/30 text-gray-900 dark:text-gray-100 py-1">
                          {item.beginning_balance}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <div className="w-full text-center text-sm bg-green-50 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 py-1">
                          {item.received}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500 bg-gray-50 dark:bg-gray-700/30">
                        <div className="w-full text-center text-sm text-gray-900 dark:text-gray-100 py-1">
                          {item.lot_batch_number || "---"}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500 bg-gray-50 dark:bg-gray-700/30">
                        <div className="flex gap-0.5">
                          <div className="w-1/2 text-center text-sm text-gray-900 dark:text-gray-100 py-1" title="Transferred In">
                            {item.transferred_in}
                          </div>
                          <div className="w-1/2 text-center text-sm text-gray-900 dark:text-gray-100 py-1" title="Transferred Out">
                            {item.transferred_out}
                          </div>
                        </div>
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <div className="w-full text-center text-sm bg-red-50 dark:bg-red-900/30 text-gray-900 dark:text-gray-100 py-1">
                          {item.expired_wasted}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-blue-800 dark:text-blue-300 border border-black dark:border-gray-500 bg-blue-100 dark:bg-blue-900/50">
                        {item.total_available}
                      </td>
                      <td className="px-1 py-0.5 border border-black dark:border-gray-500">
                        <div className="w-full text-center text-sm bg-yellow-50 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100 py-1">
                          {item.issuance}
                        </div>
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
                    ))
                  )}
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
        </section>
      )}

      {/* Inventory Summary Tab - NOT printed */}
      {resolvedActiveTab === "inventory_summary" && (
        <section
          id={INVENTORY_TAB_PANEL_IDS.inventory_summary}
          data-testid="inventory-summary-panel"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          {/* Inventory Summary */}
          <Card className="shrink-0 p-4 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Inventory Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Vaccines
                </p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {inventorySummaryStats.total_items}
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
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Expired Lots
                </p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {inventorySummaryStats.expired_items}
                </p>
              </div>
            </div>
          </Card>

          <div
            className="modern-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
            data-testid="inventory-summary-scroll-region"
          >
            {/* Alert Summary Cards */}
            <div
              className="sticky top-0 z-20 bg-gray-50/95 pb-4 backdrop-blur dark:bg-gray-900/95"
              data-testid="inventory-summary-alert-cards-sticky"
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    Wasted / Expired
                  </p>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {stockMovementSummary.wasted.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    High items: {stockAlerts.wasted.length}
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
            </div>

            {renderAlertWorkflowCard()}

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
        </section>
      )}

      {/* Stock Movements Tab - NOT printed */}
      {resolvedActiveTab === "stock_movements" && (
        <section
          id={INVENTORY_TAB_PANEL_IDS.stock_movements}
          data-testid="inventory-stock-movements-panel"
          className="flex min-h-0 flex-1 flex-col"
        >
          <StockMovementsPanel
            movements={displayedStockMovements}
            loading={stockMovementsLoading}
            error={stockMovementsError}
            onRetry={loadStockMovements}
          />
        </section>
      )}

      <Modal
        isOpen={isGenerateReportModalOpen}
        onClose={() => setIsGenerateReportModalOpen(false)}
        title="Generate Report"
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => setIsGenerateReportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleGenerateReportFromModal}
            >
              Generate Report
            </Button>
          </AdminModalActions>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Report Type *"
              value={selectedExportReportType}
              onChange={(event) =>
                setSelectedExportReportType(
                  normalizeInventoryReportType(event.target.value),
                )
              }
              options={INVENTORY_PRINT_REPORT_OPTIONS}
            />
            <Select
              label="Format *"
              value={selectedReportDeliveryType}
              onChange={(event) =>
                setSelectedReportDeliveryType(event.target.value)
              }
              options={INVENTORY_REPORT_DELIVERY_OPTIONS}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Report Date"
              aria-label="Report Date"
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
            />
            <Input
              label="Start Date"
              aria-label="Start Date"
              type="date"
              value={printDateRange.startDateInput}
              onChange={(event) =>
                printDateRange.setStartDateInput(event.target.value)
              }
              className={
                printDateRange.validationError
                  ? "border-danger-300 focus:border-danger-500 focus:ring-danger-500"
                  : ""
              }
            />
            <Input
              label="End Date"
              aria-label="End Date"
              type="date"
              value={printDateRange.endDateInput}
              onChange={(event) =>
                printDateRange.setEndDateInput(event.target.value)
              }
              className={
                printDateRange.validationError
                  ? "border-danger-300 focus:border-danger-500 focus:ring-danger-500"
                  : ""
              }
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={printDateRange.applyDateRange}
                  className="min-h-[40px] whitespace-nowrap"
                >
                  Apply Range
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={printDateRange.clearDateRange}
                  className="min-h-[40px] whitespace-nowrap"
                >
                  Clear Range
                </Button>
              </div>

              {printDateRange.hasAppliedDateRange ? (
                <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  {printDateRange.activeDateRangeLabel}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave both dates blank to include all available records.
                </p>
              )}
            </div>
          </div>

          {printDateRange.validationError ? (
            <Alert variant="error">{printDateRange.validationError}</Alert>
          ) : null}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Reports use the current Inventory Sheet data and the active table
            filters already applied on the page.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(pendingBulkStockAlertAction)}
        onClose={() => {
          if (!isSubmittingBulkStockAlertAction) {
            setPendingBulkStockAlertAction(null);
          }
        }}
        title={pendingBulkStockAlertAction?.title || "Confirm Bulk Action"}
        size="sm"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => setPendingBulkStockAlertAction(null)}
              disabled={isSubmittingBulkStockAlertAction}
            >
              Cancel
            </Button>
            <Button
              variant={
                pendingBulkStockAlertAction?.action === "resolve"
                  ? "primary"
                  : "outline"
              }
              type="button"
              onClick={handleConfirmBulkStockAlertAction}
              loading={isSubmittingBulkStockAlertAction}
              disabled={isSubmittingBulkStockAlertAction}
            >
              {pendingBulkStockAlertAction?.confirmLabel || "Confirm"}
            </Button>
          </AdminModalActions>
        }
      >
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>{pendingBulkStockAlertAction?.description}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This action updates the persisted stock-alert status records for the
            current facility and refreshes the workflow table immediately after
            completion.
          </p>
        </div>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeTransactionModal}
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
              onClick={closeTransactionModal}
              disabled={isTransactionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="inventoryTransactionForm"
              loading={isTransactionSubmitting}
              disabled={isTransactionSubmitDisabled}
            >
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

          {transactionSubmitError && (
            <Alert variant="error" className="mb-3">
              {transactionSubmitError}
            </Alert>
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
                  error={transactionErrors.quantity || liveBatchQuantityError}
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

              {modalType === "receive" && (
                <>
                  <div className="admin-field-group">
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
                  <div className="admin-field-group">
                    <Input
                      label="Expiry Date"
                      type="date"
                      value={formData.expiry_date || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, expiry_date: e.target.value });
                        setTransactionErrors((prev) => ({
                          ...prev,
                          expiry_date: undefined,
                        }));
                      }}
                      required
                      error={transactionErrors.expiry_date}
                      className="w-full"
                    />
                  </div>
                </>
              )}
              {requiresBatchSelection && (
                <div
                  className="admin-field-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <Input
                    label="Select Lot/Batch"
                    type="text"
                    value={lotSearchTerm}
                    onChange={(e) => {
                      setLotSearchTerm(e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        batch_id: "",
                        lot_number: "",
                        expiry_date: "",
                      }));
                      setTransactionErrors((prev) => ({
                        ...prev,
                        batch_id: undefined,
                        quantity: undefined,
                      }));
                    }}
                    placeholder="Search lot number, item, quantity, storage, or expiry"
                    autoComplete="off"
                    error={transactionErrors.batch_id}
                    className="w-full"
                  />

                  <div className="mt-2 rounded-xl border border-white/10 bg-white/80 dark:bg-gray-800/80 dark:border-gray-700">
                    {availableLotsLoading ? (
                      <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Loading available lot/batch records...
                      </div>
                    ) : filteredAvailableLots.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto">
                        {filteredAvailableLots.map((batch) => {
                          const isSelected =
                            resolveInventorySaveRowId(
                              batch.batch_id || batch.inventory_id,
                            ) ===
                            resolveInventorySaveRowId(formData.batch_id);

                          return (
                            <button
                              key={batch.batch_id || batch.inventory_id}
                              type="button"
                              onClick={() => {
                                setLotSearchTerm(batch.lot_number || "");
                                setFormData((prev) => ({
                                  ...prev,
                                  batch_id:
                                    batch.batch_id || batch.inventory_id || "",
                                  lot_number: batch.lot_number || "",
                                  expiry_date: batch.expiry_date || "",
                                }));
                                setTransactionErrors((prev) => ({
                                  ...prev,
                                  batch_id: undefined,
                                  quantity: undefined,
                                }));
                              }}
                              className={`w-full border-b border-gray-100 px-3 py-3 text-left transition last:border-b-0 dark:border-gray-700 ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {batch.lot_number}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {batch.vaccine_name}
                                  </p>
                                </div>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-100">
                                  {batch.available_quantity} available
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <span>Expiry: {formatInventoryBatchDate(batch.expiry_date)}</span>
                                {batch.storage_location && (
                                  <span>Storage: {batch.storage_location}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {availableLotsError ||
                          "No selectable lot/batch records match the current search."}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Only active, non-expired lot/batch records with available stock
                    can be selected.
                  </p>

                  {selectedBatchOption && batchStockPreview && (
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-white/70 px-3 py-2 dark:bg-gray-800/80 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Available in Batch
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {batchStockPreview.available}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/70 px-3 py-2 dark:bg-gray-800/80 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {modalType === "issue" ? "Issued Quantity" : "Wasted Quantity"}
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {batchStockPreview.transactionQuantity}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/70 px-3 py-2 dark:bg-gray-800/80 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Remaining After Transaction
                        </p>
                        <p
                          className={`text-base font-semibold ${batchStockPreview.insufficientStock ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}
                        >
                          {Math.max(batchStockPreview.remaining, 0)}
                        </p>
                      </div>
                    </div>
                  )}
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
        .inventory-sheet-summary-print-report,
        .doh-lgu-stock-print-report,
        .ris-print-report {
          display: none;
        }

        #inventory-print-root {
          display: none;
        }

        .doh-lgu-stock-print-header__seal {
          display: none;
        }

        @media print {
          :root {
            --inventory-print-page-width: calc(14in - 0.7cm);
            --inventory-print-page-height: calc(8.5in - 0.7cm);
          }

          body.printing-inventory.printing-report-requisition-issue-slip {
            --inventory-print-page-width: calc(8.5in - 0.7cm);
            --inventory-print-page-height: calc(14in - 0.7cm);
          }

          body.printing-inventory.printing-report-inventory-sheet {
            --inventory-print-page-width: calc(8.5in - 0.7cm);
            --inventory-print-page-height: calc(14in - 0.7cm);
          }

          html,
          body {
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #ffffff !important;
          }

          body.printing-inventory #root {
            display: none !important;
          }

          body.printing-inventory #inventory-print-root {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0.16in !important;
            background: #ffffff !important;
          }

          body.printing-inventory.printing-report-inventory-sheet .inventory-sheet-summary-print-report,
          body.printing-inventory.printing-report-doh-lgu-stock-form .doh-lgu-stock-print-report,
          body.printing-inventory.printing-report-requisition-issue-slip .ris-print-report {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
          }

          .inventory-sheet-summary-print-report__page,
          .doh-lgu-stock-print-report__page,
          .ris-word-report {
    width: 100%;
  }

  .ris-word-report__page {
    width: 100%;
    max-width: 7.9in;
    margin: 0 auto;
    border: 1.4px solid #111827;
    padding: 0.18in;
    background: #ffffff;
  }

  .ris-word-header-table,
  .ris-word-meta-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    color: #111827;
  }

  .ris-word-header-table {
    margin-bottom: 0.12in;
  }

  .ris-word-header-table__seal-cell {
    width: 0.92in;
    text-align: center;
    vertical-align: middle;
  }

  .ris-word-header-table__seal {
    display: block;
    width: 0.68in;
    height: 0.68in;
    margin: 0 auto;
    object-fit: cover;
    border-radius: 9999px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ris-word-header-table__title-cell {
    text-align: center;
    vertical-align: middle;
    padding: 0 0.1in;
  }

  .ris-word-header-table__title,
  .ris-word-header-table__subtitle,
  .ris-word-header-table__municipality {
    margin: 0;
    color: #111827;
  }

  .ris-word-header-table__title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .ris-word-header-table__subtitle {
    margin-top: 0.03in;
    font-size: 10px;
    font-weight: 700;
  }

  .ris-word-header-table__municipality {
    margin-top: 0.03in;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .ris-word-meta-table {
    margin-bottom: 0.12in;
  }

  .ris-word-meta-table td {
    padding: 0.04in 0.03in;
    font-size: 10px;
    vertical-align: bottom;
  }

  .ris-word-meta-table__label {
    font-weight: 700;
    white-space: nowrap;
  }

  .ris-word-meta-table__value {
    border-bottom: 1px solid #111827;
  }

  .ris-word-table {
    margin-top: 0.02in;
  }
  .ris-print-report__page {
            display: block !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            box-sizing: border-box !important;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            color: #111827 !important;
            text-rendering: geometricPrecision !important;
          }

          .inventory-sheet-summary-print-report__page {
            width: min(calc(100% - 0.8cm), var(--inventory-print-page-width)) !important;
            max-width: var(--inventory-print-page-width) !important;
            min-height: var(--inventory-print-page-height) !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .inventory-sheet-summary-print-report__page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .doh-lgu-stock-print-report__page {
            width: min(calc(100% - 0.8cm), 13.1in) !important;
            max-width: 13.1in !important;
            max-height: var(--inventory-print-page-height) !important;
            border: 1.6px solid #111827 !important;
          }

          .ris-word-report {
    width: 100%;
  }

  .ris-word-report__page {
    width: 100%;
    max-width: 7.9in;
    margin: 0 auto;
    border: 1.4px solid #111827;
    padding: 0.18in;
    background: #ffffff;
  }

  .ris-word-header-table,
  .ris-word-meta-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    color: #111827;
  }

  .ris-word-header-table {
    margin-bottom: 0.12in;
  }

  .ris-word-header-table__seal-cell {
    width: 0.92in;
    text-align: center;
    vertical-align: middle;
  }

  .ris-word-header-table__seal {
    display: block;
    width: 0.68in;
    height: 0.68in;
    margin: 0 auto;
    object-fit: cover;
    border-radius: 9999px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ris-word-header-table__title-cell {
    text-align: center;
    vertical-align: middle;
    padding: 0 0.1in;
  }

  .ris-word-header-table__title,
  .ris-word-header-table__subtitle,
  .ris-word-header-table__municipality {
    margin: 0;
    color: #111827;
  }

  .ris-word-header-table__title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .ris-word-header-table__subtitle {
    margin-top: 0.03in;
    font-size: 10px;
    font-weight: 700;
  }

  .ris-word-header-table__municipality {
    margin-top: 0.03in;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .ris-word-meta-table {
    margin-bottom: 0.12in;
  }

  .ris-word-meta-table td {
    padding: 0.04in 0.03in;
    font-size: 10px;
    vertical-align: bottom;
  }

  .ris-word-meta-table__label {
    font-weight: 700;
    white-space: nowrap;
  }

  .ris-word-meta-table__value {
    border-bottom: 1px solid #111827;
  }

  .ris-word-table {
    margin-top: 0.02in;
  }
  .ris-print-report__page {
            width: min(calc(100% - 1.8cm), 8.1in) !important;
            max-width: 8.1in !important;
            max-height: var(--inventory-print-page-height) !important;
            padding: 0.18in 0.18in 0.14in !important;
            border: 1.5px solid #111827 !important;
          }

          .inventory-sheet-summary-print-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 0.04cm !important;
            text-align: center !important;
            margin: 0 0 0.28in 0 !important;
            padding: 0 0 0.16in !important;
            border-bottom: 1.2px solid #cbd5e1 !important;
            color: #0f172a !important;
          }

          .inventory-sheet-summary-print-header__line {
            margin: 0 !important;
            line-height: 1.24 !important;
            letter-spacing: 0.01em !important;
          }

          .inventory-sheet-summary-print-header__line--primary {
            font-size: 12.8px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.014em !important;
          }

          .inventory-sheet-summary-print-header__line--department {
            font-size: 10.4px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.012em !important;
          }

          .inventory-sheet-summary-print-header__line--title {
            margin-top: 0.01cm !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            text-transform: none !important;
          }

          .inventory-sheet-summary-print-header__line--supporting {
            margin-top: 0 !important;
            font-size: 9px !important;
            font-weight: 600 !important;
            text-transform: none !important;
            color: #334155 !important;
          }

          .inventory-sheet-summary-print-header__line--label {
            margin-top: 0.04cm !important;
            font-size: 9px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.012em !important;
          }

          .inventory-sheet-summary-print-header__line--facility {
            margin-top: 0 !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.01em !important;
          }

          .inventory-sheet-summary-print-header__line--inventory {
            margin-top: 0.02cm !important;
            font-size: 9.4px !important;
            font-weight: 700 !important;
            text-transform: none !important;
          }

          .inventory-sheet-summary-print-header__detail-row {
            display: flex !important;
            width: 100% !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 0.25in !important;
            margin-top: 0.08in !important;
            padding-top: 0.08in !important;
            border-top: 1px solid #e2e8f0 !important;
          }

          .inventory-sheet-summary-print-header__detail {
            display: inline-flex !important;
            align-items: center !important;
            gap: 0.08in !important;
            min-width: 0 !important;
            font-size: 9px !important;
            font-weight: 700 !important;
            color: #111827 !important;
          }

          .inventory-sheet-summary-print-header__detail-value {
            display: inline-block !important;
            min-width: 1.2in !important;
            min-height: 0.16in !important;
            border-bottom: 1px solid #111827 !important;
          }

          .inventory-sheet-summary-print-header__detail--month {
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.01em !important;
          }

          .inventory-sheet-summary-print-table {
            width: 100% !important;
            margin-top: 0.04in !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            font-size: 10.2px !important;
            line-height: 1.24 !important;
            color: #0f172a !important;
          }

          .inventory-sheet-summary-print-table thead {
            display: table-header-group !important;
          }

          .inventory-sheet-summary-print-table tbody {
            display: table-row-group !important;
          }

          .inventory-sheet-summary-print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .inventory-sheet-summary-print-table th,
          .inventory-sheet-summary-print-table td {
            border: 1.35px solid #0f172a !important;
            padding: 0.14cm 0.08cm !important;
            vertical-align: middle !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          .inventory-sheet-summary-print-table th {
            font-size: 9.8px !important;
            font-weight: 800 !important;
            text-transform: none !important;
            text-align: center !important;
            letter-spacing: 0.01em !important;
            color: #111827 !important;
          }

          .inventory-sheet-summary-print-table td {
            font-size: 10.3px !important;
            min-height: 0.64cm !important;
            line-height: 1.22 !important;
            letter-spacing: 0.005em !important;
            font-weight: 500 !important;
            color: #111827 !important;
          }

          .inventory-sheet-summary-print-table .print-col-center {
            text-align: center !important;
          }

          .inventory-sheet-summary-print-table .print-col-items {
            text-align: left !important;
          }

          .inventory-sheet-summary-print-table .print-col-item-name {
            font-weight: 800 !important;
          }

          .inventory-sheet-summary-print-table tbody td:nth-child(1),
          .inventory-sheet-summary-print-table tbody td:nth-child(3),
          .inventory-sheet-summary-print-table tbody td:nth-child(4),
          .inventory-sheet-summary-print-table tbody td:nth-child(6),
          .inventory-sheet-summary-print-table tbody td:nth-child(7),
          .inventory-sheet-summary-print-table tbody td:nth-child(8),
          .inventory-sheet-summary-print-table tbody td:nth-child(9),
          .inventory-sheet-summary-print-table tbody td:nth-child(10),
          .inventory-sheet-summary-print-table tbody td:nth-child(11) {
            font-weight: 800 !important;
            color: #0b1220 !important;
          }

          .inventory-sheet-summary-print-table .print-col-total-label {
            text-align: right !important;
            font-weight: 800 !important;
            background-color: #e5e7eb !important;
          }

          .inventory-sheet-summary-print-table .inventory-sheet-summary-print-total-row td {
            font-weight: 800 !important;
          }

          .inventory-sheet-summary-print-table .print-col-base {
            background-color: #ffffff !important;
          }

          .inventory-sheet-summary-print-table .print-col-beginning {
            background-color: #e7eef8 !important;
          }

          .inventory-sheet-summary-print-table .print-col-received,
          .inventory-sheet-summary-print-table .print-col-stock {
            background-color: #e5f3e9 !important;
          }

          .inventory-sheet-summary-print-table .print-col-lot,
          .inventory-sheet-summary-print-table .print-col-movement {
            background-color: #f7f8fa !important;
          }

          .inventory-sheet-summary-print-table .print-col-total {
            background-color: #e3edf9 !important;
            color: #153e75 !important;
          }

          .inventory-sheet-summary-print-table .print-col-issued {
            background-color: #fbf3d8 !important;
          }

          .inventory-sheet-summary-print-table .print-col-expired {
            background-color: #fae6e6 !important;
          }

          .inventory-sheet-summary-print-header {
            margin: 0 0 0.18in 0 !important;
            padding: 0 0 0.14in !important;
          }

          .inventory-sheet-summary-print-header__branding {
            display: grid !important;
            grid-template-columns: 0.96in minmax(0, 1fr) 0.96in !important;
            align-items: center !important;
            gap: 0.18in !important;
          }

          .inventory-sheet-summary-print-header__branding-copy {
            text-align: center !important;
          }

          .inventory-sheet-summary-print-header__logo-wrap {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .inventory-sheet-summary-print-header__logo {
            width: 0.9in !important;
            height: 0.9in !important;
            object-fit: contain !important;
            background: transparent !important;
          }

          .inventory-sheet-summary-print-header__logo--circle {
            border-radius: 9999px !important;
            clip-path: circle(50% at 50% 50%) !important;
          }

          .inventory-sheet-summary-print-header__line--government {
            margin-bottom: 0.04in !important;
            font-size: 9.1px !important;
          }

          .inventory-sheet-summary-print-header__line--title {
            margin-top: 0.02in !important;
            font-size: 10px !important;
            text-transform: none !important;
          }

          .inventory-sheet-summary-print-header__detail-row {
            display: grid !important;
            grid-template-columns: auto minmax(0, 1fr) auto !important;
            align-items: end !important;
            gap: 0.16in !important;
          }

          .inventory-sheet-summary-print-header__detail--facility {
            justify-self: center !important;
            text-align: center !important;
            font-size: 8.8px !important;
            font-weight: 700 !important;
            letter-spacing: 0.06em !important;
            text-transform: uppercase !important;
          }

          .inventory-sheet-summary-print-header__detail--month {
            justify-self: end !important;
          }

          .inventory-sheet-summary-print-table {
            margin-top: 0 !important;
          }

          .doh-lgu-stock-print-header {
            display: block !important;
            text-align: center !important;
            margin: 0 !important;
            padding: 0.18cm 0.22cm 0.14cm !important;
            border-bottom: 1.35px solid #111827 !important;
            color: #0f172a !important;
          }

          .doh-lgu-stock-print-header__line {
            margin: 0 !important;
            line-height: 1.2 !important;
            letter-spacing: 0.008em !important;
          }

          .doh-lgu-stock-print-header__line--government {
            font-size: 9.2px !important;
            margin-bottom: 0.08cm !important;
          }

          .doh-lgu-stock-print-header__branding {
            display: grid !important;
            grid-template-columns: 0.72in minmax(0, 1fr) 0.72in !important;
            align-items: center !important;
            gap: 0.22cm !important;
          }

          .doh-lgu-stock-print-header__seal {
            display: block !important;
            width: 0.7in !important;
            height: 0.7in !important;
            object-fit: cover !important;
            border-radius: 9999px !important;
            clip-path: circle(50% at 50% 50%) !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            mix-blend-mode: multiply !important;
            flex: 0 0 auto !important;
          }

          .doh-lgu-stock-print-header__branding-copy {
            display: block !important;
          }

          .doh-lgu-stock-print-header__line--primary {
            font-size: 11.2px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .doh-lgu-stock-print-header__line--title {
            margin-top: 0.05cm !important;
            font-size: 9.9px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .doh-lgu-stock-print-header__line--subtitle {
            margin-top: 0.03cm !important;
            font-size: 8.6px !important;
            font-weight: 700 !important;
            text-transform: none !important;
            color: #1f2937 !important;
          }

          .doh-lgu-stock-print-header__meta {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.08cm 0.28cm !important;
            margin-top: 0.14cm !important;
            padding-top: 0.12cm !important;
            border-top: 1px solid #cbd5e1 !important;
            text-align: left !important;
          }

          .doh-lgu-stock-print-header__meta-line {
            margin: 0 !important;
            font-size: 8.5px !important;
            line-height: 1.22 !important;
            color: #111827 !important;
          }

          .doh-lgu-stock-print-header__meta-label {
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          #doh-lgu-print-table {
            width: 100% !important;
            border: 1.35px solid #111827 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            color: #0f172a !important;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
          }

          #doh-lgu-print-table th,
          #doh-lgu-print-table td {
            border: 1.15px solid #111827 !important;
            padding: 0.095cm 0.07cm !important;
            vertical-align: middle !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
            background: #ffffff !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          #doh-lgu-print-table {
            font-size: 7.95px !important;
            line-height: 1.16 !important;
          }

          #doh-lgu-print-table thead {
            display: table-header-group !important;
          }

          #doh-lgu-print-table tbody {
            display: table-row-group !important;
          }

          #doh-lgu-print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #doh-lgu-print-table th {
            font-size: 7.85px !important;
            font-weight: 800 !important;
            text-transform: none !important;
            text-align: center !important;
            letter-spacing: 0.007em !important;
            line-height: 1.12 !important;
            color: #111827 !important;
          }

          #doh-lgu-print-table td {
            font-size: 8px !important;
            min-height: 0.54cm !important;
            line-height: 1.15 !important;
            letter-spacing: 0.004em !important;
            font-weight: 500 !important;
            color: #111827 !important;
          }

          #doh-lgu-print-table .print-col-center {
            text-align: center !important;
          }

          #doh-lgu-print-table .print-col-items {
            text-align: left !important;
          }

          #doh-lgu-print-table .print-col-left {
            text-align: left !important;
          }

          #doh-lgu-print-table .print-col-item-name {
            font-weight: 800 !important;
          }

          #doh-lgu-print-table tbody td:nth-child(1),
          #doh-lgu-print-table tbody td:nth-child(3),
          #doh-lgu-print-table tbody td:nth-child(4),
          #doh-lgu-print-table tbody td:nth-child(5),
          #doh-lgu-print-table tbody td:nth-child(6),
          #doh-lgu-print-table tbody td:nth-child(7),
          #doh-lgu-print-table tbody td:nth-child(8),
          #doh-lgu-print-table tbody td:nth-child(10),
          #doh-lgu-print-table tbody td:nth-child(11),
          #doh-lgu-print-table tbody td:nth-child(12),
          #doh-lgu-print-table tbody td:nth-child(13),
          #doh-lgu-print-table tbody td:nth-child(14),
          #doh-lgu-print-table tbody td:nth-child(15),
          #doh-lgu-print-table tbody td:nth-child(16) {
            font-weight: 800 !important;
            color: #0b1220 !important;
          }

          .ris-print-header {
            display: block !important;
            margin: 0 0 0.12in 0 !important;
            padding-bottom: 0.08in !important;
            border-bottom: 1.2px solid #111827 !important;
            color: #0f172a !important;
          }

          .ris-print-header__branding {
            display: grid !important;
            grid-template-columns: 0.72in minmax(0, 1fr) 0.72in !important;
            align-items: center !important;
            gap: 0.14in !important;
            margin-bottom: 0.1in !important;
          }

          .ris-print-header__seal {
            display: block !important;
            width: 0.68in !important;
            height: 0.68in !important;
            object-fit: cover !important;
            border-radius: 9999px !important;
            clip-path: circle(50% at 50% 50%) !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            mix-blend-mode: multiply !important;
            justify-self: center !important;
          }

          .ris-print-header__branding-copy {
            text-align: center !important;
          }

          .ris-print-header__title,
          .ris-print-header__subtitle,
          .ris-print-header__municipality {
            margin: 0 !important;
            color: #111827 !important;
          }

          .ris-print-header__title {
            font-size: 12.4px !important;
            font-weight: 800 !important;
            letter-spacing: 0.02em !important;
            text-transform: uppercase !important;
          }

          .ris-print-header__subtitle {
            margin-top: 0.03in !important;
            font-size: 9px !important;
            font-weight: 700 !important;
          }

          .ris-print-header__municipality {
            margin-top: 0.03in !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            letter-spacing: 0.01em !important;
            text-transform: uppercase !important;
          }

          .ris-print-header__meta-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.08in 0.18in !important;
          }

          .ris-print-header__field {
            display: grid !important;
            grid-template-columns: auto minmax(0, 1fr) !important;
            align-items: end !important;
            gap: 0.08in !important;
          }

          .ris-print-header__field--full {
            grid-column: 1 / -1 !important;
          }

          .ris-print-header__field-label {
            font-size: 8.8px !important;
            font-weight: 700 !important;
            color: #111827 !important;
            white-space: nowrap !important;
          }

          .ris-print-header__field-value {
            display: block !important;
            min-height: 0.18in !important;
            padding: 0 0.04in 0.02in !important;
            border-bottom: 1px solid #111827 !important;
            font-size: 9px !important;
            font-weight: 600 !important;
            line-height: 1.24 !important;
            color: #0b1220 !important;
          }

          .ris-print-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            font-size: 8.8px !important;
            line-height: 1.18 !important;
            color: #111827 !important;
          }

          .ris-print-table thead {
            display: table-header-group !important;
          }

          .ris-print-table tbody {
            display: table-row-group !important;
          }

          .ris-print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .ris-print-table th,
          .ris-print-table td {
            border: 1.1px solid #111827 !important;
            padding: 0.08in 0.05in !important;
            vertical-align: middle !important;
            background: #ffffff !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }

          .ris-print-table th {
            font-size: 8.4px !important;
            font-weight: 800 !important;
            text-align: center !important;
            color: #111827 !important;
          }

          .ris-print-table td {
            font-size: 8.8px !important;
            font-weight: 500 !important;
            min-height: 0.28in !important;
            color: #111827 !important;
          }

          .ris-print-table td:nth-child(2),
          .ris-print-table td:nth-child(3),
          .ris-print-table td:nth-child(4),
          .ris-print-table td:nth-child(5),
          .ris-print-table td:nth-child(6),
          .ris-print-table__numeric {
            text-align: center !important;
          }

          .ris-print-table__description {
            text-align: left !important;
            font-weight: 700 !important;
          }

          .ris-print-table__numeric {
            font-weight: 800 !important;
            color: #0b1220 !important;
          }

          .ris-print-table__section-row td {
            font-weight: 800 !important;
            text-align: left !important;
            background: #f9fafb !important;
          }

          .inventory-sheet-summary-print-report,
          .inventory-sheet-summary-print-report__page,
          .inventory-sheet-summary-print-table,
          .doh-lgu-stock-print-report,
          .doh-lgu-stock-print-report__page,
          #doh-lgu-print-table,
          .ris-print-report,
          .ris-print-report__page,
          .ris-print-table {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
