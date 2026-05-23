import React, {
  useState  ,
  useEffect,
  useCallback,
  useMemo    ,
  useRef ,
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
import VaccinationPeriodFilter from "./VaccinationPeriodFilter";
import {
  PERIOD_OPTIONS,
  getVaccinationPeriodRange,
  normalizeVaccinationPeriod,
} from "../utils/vaccinationPeriods";
import {
  filterItemsByPrintDateRange,
  formatPrintDateValue,
  parseDateLikeValue,
  parseDateOnlyValue,
  validatePrintDateRange,
} from "../utils/printDateRange";
import {
  downloadWordDocument,

  PRINT_PAGE_PRESETS ,
} from "../utils/printDocumentExport";
import { normalizeRoleLabel } from "../utils/roleLabels";

/**
 * Paper Configuration Inventory Management Component
 * Implements the layout from INVENTORY SHEET.docx with:
 * - Tab-based navigation only (no sub-navigations)
 * - Paper configuration layout for vaccinations
 */

const DOH_LGU_REPORT_ITEMS = [
  {
    rowNumber: 1,
    label: "BCG",
    aliases: ["bcg"],
  },
  {
    rowNumber: 2,
    label: "Hepatitis B",
    aliases: ["hepa b", "hepatitis b", "hep b", "hepatitis b vaccine"],
  },
  {
    rowNumber: 3,
    label: "Pentavalent Vaccine (DPT-HepaB-Hib Vaccine)",
    aliases: [
      "penta valent",
      "pentavalent",
      "pentavalent vaccine",
      "dpt hepab hib vaccine",
      "dpt hepab hib",
    ],
  },
  {
    rowNumber: 4,
    label: "Bivalent Oral Polio Vaccine (bOPV)",
    aliases: [
      "opv 20 doses",
      "opv 20-doses",
      "opv",
      "bopv",
      "bivalent oral polio vaccine",
    ],
  },
  {
    rowNumber: 5,
    label: "Inactivated Polio Vaccine",
    aliases: ["ipv multi dose", "ipv", "inactivated polio vaccine"],
  },
  {
    rowNumber: 6,
    label: "Pneumococcal Conjugate Vaccine (PCV 13/PCV 10)",
    aliases: [
      "pcv 13",
      "pcv 10",
      "pcv13",
      "pcv10",
      "pcv 13 / pcv 10",
      "pcv",
      "pcv 13/pcv 10",
      "pneumococcal conjugate vaccine",
    ],
  },
  {
    rowNumber: 7,
    label: "Measles Mumps and Rubella (MMR)",
    aliases: ["mmr", "measles mumps rubella", "measles mumps and rubella"],
  },
  {
    rowNumber: 8,
    label: "Tetanus Diphtheria Toxoid",
    aliases: [
      "tetanus diphtheria toxoid",
      "td vaccine",
      "tetanus diphtheria",
    ],
  },
  {
    rowNumber: 9,
    label: "Human Papillomavirus Vaccine",
    aliases: ["human papillomavirus vaccine", "hpv vaccine", "hpv"],
  },
  {
    rowNumber: 10,
    label: "Influenza/Flu Vaccine",
    aliases: ["influenza flu vaccine", "influenza vaccine", "flu vaccine"],
  },
  {
    rowNumber: 11,
    label: "Pneumococcal Polysaccharide Vaccine",
    aliases: [
      "pneumococcal polysaccharide vaccine",
      "ppv vaccine",
      "ppv23",
      "ppv",
    ],
  },
  {
    rowNumber: 12,
    label: "Hexaxim",
    aliases: ["hexaxim"],
  },
  {
    rowNumber: 13,
    label: "Tetanus Toxoid",
    aliases: ["tetanus toxoid", "tt vaccine", "tt"],
  },
];

const INVENTORY_SHEET_FRAME_MAX_WIDTH = "10.4in";
const INVENTORY_SHEET_SURFACE_MAX_WIDTH = "10.05in";
const INVENTORY_SHEET_ROWS_PER_PAGE = 12;
const INVENTORY_SHEET_COLUMN_WIDTH_PERCENTAGES = Object.freeze([
  4, 20, 9, 9, 14, 7, 7, 8, 9, 7, 6,
  ]);
const DOH_LGU_REPORT_LEFT_SEAL_SRC = "/stock-form-doh-seal.png";
const DOH_LGU_REPORT_RIGHT_SEAL_SRC = "/san-nicolas-logo.jpg";
const PASIG_REPORT_SEAL_SRC = "/stock-form-pasig-seal.png";
const DOH_REPORT_SEAL_SRC = DOH_LGU_REPORT_LEFT_SEAL_SRC;
const INVENTORY_SHEET_LEFT_LOGO_SRC = DOH_REPORT_SEAL_SRC;
const INVENTORY_SHEET_RIGHT_LOGO_SRC = "/san-nicolas-logo.jpg";
const INVENTORY_SHEET_PDF_FRAME_WIDTH_MM = 312;
const INVENTORY_SHEET_PDF_FRAME_PADDING_MM = 6.5;
const DOH_LGU_REPORT_FILENAME_PREFIX = "doh-lgu-stock-inventory-report";
const RIS_REPORT_FILENAME_PREFIX = "requisition-and-issue-slip";
const RIS_PRIVATE_CLINIC_VALUE = "(leave blank)";
const PRINT_REPORT_TYPES = Object.freeze({
  INVENTORY_SHEET: "inventory-sheet",
  DOH_LGU_STOCK_FORM: "doh-lgu-stock-form",
  REQUISITION_ISSUE_SLIP: "requisition-issue-slip",
});
const INVENTORY_REPORT_DELIVERY_TYPES = Object.freeze({
  PRINT: "print",
  PDF: "pdf",
  WORD: "word",
});
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
const PRINT_REPORT_COPY = Object.freeze({
  inventorySheetTitle: "EPI VACCINE AND OTHER LOGISTICS INVENTORY FORM",
  inventorySheetDepartment: "DEPARTMENT OF HEALTH (DOH)",
  inventorySheetProgram: "Expanded Program on Immunization",
  inventorySheetProcured: "Department of Health Procured",
  inventorySheetHealthCenterLabel: "HEALTH CENTER:",
  inventorySheetHealthCenterValue: "San Nicolas Health Center",
  inventorySheetInventoryLine: "Inventory of Vaccines and Other Logistic",
  inventorySheetCodeLabel: "Code",
  dohLguTitle: "DOH and LGU Utilization / Stock Inventory Form",
  dohLguSubtitle: "HEALTH FACILITY MONTHLY VACCINE STOCK INVENTORY REPORT",
  risTitle: "REQUISITION AND ISSUE SLIP",
  risSubtitle: "(VACCINES AND SUPPLIES)",
  risMunicipality: "MUNICIPALITY OF PASIG",
});
const DEFAULT_PRINT_HEADER = Object.freeze({
  healthCenter: "San Nicolas Health Center",
  barangay: "San Nicolas",
  city: "Pasig City",
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

const INVENTORY_REPORT_ORIENTATIONS = Object.freeze({
  [PRINT_REPORT_TYPES.INVENTORY_SHEET]: "landscape",
  [PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM]: "landscape",
  [PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP]: "portrait",
});

const getInventoryReportOrientation = (reportType) =>
  INVENTORY_REPORT_ORIENTATIONS[reportType] ||
  INVENTORY_REPORT_ORIENTATIONS[PRINT_REPORT_TYPES.INVENTORY_SHEET];

const getInventoryReportCssPageSettings = (
  reportType = PRINT_REPORT_TYPES.INVENTORY_SHEET,
) => {
  const normalizedReportType = normalizeInventoryReportType(reportType);

  if (normalizedReportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
    return {
      pageCssSize: "legal portrait",
      printMargin: "8mm",
    };
  }

  if (
    normalizedReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET ||
    normalizedReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM
  ) {
    return {
      pageCssSize: "legal landscape",
      printMargin: "8mm",
    };
  }

  return {
    pageCssSize: "A4 landscape",
    printMargin: "15mm",
  };
};

const getInventoryReportWordPagePreset = (
  reportType = PRINT_REPORT_TYPES.INVENTORY_SHEET,
) => {
  const normalizedReportType = normalizeInventoryReportType(reportType);

  if (normalizedReportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
    return {
      ...PRINT_PAGE_PRESETS.legalPortrait,
    };
  }

  if (
    normalizedReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET ||
    normalizedReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM
  ) {
    return {
      ...PRINT_PAGE_PRESETS.legalLandscape,
    };
  }

  return {
    ...PRINT_PAGE_PRESETS.a4Landscape,
  };
};

export function getInventoryReportPdfConfig(reportType = "inventory-sheet") {
  const normalizedReportType = normalizeInventoryReportType(reportType);

  if (normalizedReportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
    return {
      orientation: "portrait",
      format: "legal",
    };
  }

  if (
    normalizedReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET ||
    normalizedReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM
  ) {
    return {
      orientation: "landscape",
      format: "legal",
    };
  }

  return {
    orientation: "landscape",
    format: "a4",
  };
}

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
  "PCV 13/PCV 10": [
    "pcv 13",
    "pcv13",
    "pcv 10",
    "pcv10",
    "pcv 13/pcv 10",
    "pcv 13 / pcv 10",
    "pcv",
  ],
  MMR: ["mmr", "measles mumps rubella"],
  "IPV multi dose": ["ipv multi dose", "inactivated polio vaccine", "ipv"],
});

const normalizeInventoryDisplayVaccineName = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const normalizedValue = rawValue.toLowerCase().replace(/\s+/g, " ");
  const alphanumericValue = normalizedValue.replace(/[^a-z0-9]/g, "");

  if (normalizedValue.includes("diluent")) {
    if (normalizedValue.includes("bcg")) {
      return "BCG";
    }
    if (normalizedValue.includes("mmr") || normalizedValue.includes("measles")) {
      return "MMR";
    }
  }

  const matchedEntry = Object.entries(INVENTORY_VACCINE_MATCH_ALIASES).find(
    ([canonicalName, aliases]) => {
      const normalizedCanonical = canonicalName.toLowerCase();
      return (
        normalizedValue === normalizedCanonical ||
        aliases.some((alias) => {
          const normalizedAlias = alias.toLowerCase();
          const normalizedAliasKey = normalizedAlias.replace(/[^a-z0-9]/g, "");
          return (
            normalizedValue === normalizedAlias ||
            alphanumericValue === normalizedAliasKey
          );
        })
      );
    },
  );

  return matchedEntry?.[0] || rawValue;
};

const normalizeInventoryMatchToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getInventoryMatchTokens = (value) => {
  const normalizedValue = normalizeInventoryDisplayVaccineName(value);
  if (!normalizedValue) {
    return [];
  }

  const aliasValues = INVENTORY_VACCINE_MATCH_ALIASES[normalizedValue] || [];
  return [
    ...new Set(
      [normalizedValue, ...aliasValues]
        .map(normalizeInventoryMatchToken)
        .filter(Boolean),
    ),
  ];
};

const inventoryNamesMatch = (leftValue, rightValue) => {
  const leftTokens = getInventoryMatchTokens(leftValue);
  const rightTokens = getInventoryMatchTokens(rightValue);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  return leftTokens.some((token) => rightTokens.includes(token));
};

const normalizeStockAlertStatus = (value) => {
  const normalizedValue = String(value || "ACTIVE").trim().toLowerCase();
  if (
    normalizedValue === "acknowledged" ||
    normalizedValue === "resolved" ||
    normalizedValue === "active"
  ) {
    return normalizedValue;
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
  const parsedValue = value ? new Date(value) : null;
  if (!parsedValue || Number.isNaN(parsedValue.getTime())) {
    return "-";
  }

  return parsedValue.toLocaleString();
};

const normalizeInventoryReportType = (value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  return Object.values(PRINT_REPORT_TYPES).includes(normalizedValue)
    ? normalizedValue
    : PRINT_REPORT_TYPES.INVENTORY_SHEET;
};

const getAvailableInventoryReportDeliveryOptions = (reportType) => {
  const normalizedReportType = normalizeInventoryReportType(reportType);

  if (
    normalizedReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET ||
    normalizedReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM ||
    normalizedReportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
  ) {
    return INVENTORY_REPORT_DELIVERY_OPTIONS.filter(
      (option) => option.value !== INVENTORY_REPORT_DELIVERY_TYPES.WORD &&
        option.value !== INVENTORY_REPORT_DELIVERY_TYPES.PRINT,
    );
  }

  return INVENTORY_REPORT_DELIVERY_OPTIONS.filter(
    (option) => option.value !== INVENTORY_REPORT_DELIVERY_TYPES.PRINT,
  );
};

const INVENTORY_TAB_STORAGE_KEY = "inventory.activeTab";
const INVENTORY_TAB_CONFIG = [
  { key: "inventory_sheet", label: "Inventory Sheet" },
  { key: "inventory_summary", label: "Inventory Summary" },
  { key: "stock_movements", label: "Stock Movements" },
];
const INVENTORY_DEFAULT_TAB_KEY = INVENTORY_TAB_CONFIG[0].key;
const INVENTORY_TAB_ALIASES = Object.freeze({
  inventory_sheet: "inventory_sheet",
  "inventory-sheet": "inventory_sheet",
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
  stock_movements: "stock_movements",
  "stock-movements": "stock_movements",
  movements: "stock_movements",
  transactions: "stock_movements",
});
const INVENTORY_TAB_PANEL_IDS = Object.freeze({
  inventory_sheet: "inventory-panel-inventory-sheet",
  inventory_summary: "inventory-panel-inventory-summary",
  stock_movements: "inventory-panel-stock-movements",
});

const normalizeInventoryTabKey = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  const normalizedValue = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return INVENTORY_TAB_ALIASES[normalizedValue] || "";
};

const getStoredInventoryTabKey = () =>
  normalizeInventoryTabKey(
    safeSessionStorage.getItem(INVENTORY_TAB_STORAGE_KEY) ||
      safeLocalStorage.getItem(INVENTORY_TAB_STORAGE_KEY),
  );

const persistInventoryTabKey = (value) => {
  const normalizedValue = normalizeInventoryTabKey(value);
  if (!normalizedValue) {
    return;
  }

  safeSessionStorage.setItem(INVENTORY_TAB_STORAGE_KEY, normalizedValue);
  safeLocalStorage.setItem(INVENTORY_TAB_STORAGE_KEY, normalizedValue);
};

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

const formatInventoryActorRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  const titleCased = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
  return normalizeRoleLabel(titleCased);
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
  if (!normalized) {
    return "UNKNOWN";
  }

  return normalized === "WASTAGE" ? "WASTE" : normalized;
};

const INVENTORY_MOVEMENT_TYPE_META = Object.freeze({
  RECEIVE: { label: "Receive", badgeVariant: "success", accentClass: "text-green-700 dark:text-green-300", quantityPrefix: "+" },
  RECEIPT: { label: "Receipt", badgeVariant: "success", accentClass: "text-green-700 dark:text-green-300", quantityPrefix: "+" },
  ISSUE: { label: "Issue", badgeVariant: "info", accentClass: "text-blue-700 dark:text-blue-300", quantityPrefix: "-" },
  WASTE: { label: "Waste", badgeVariant: "danger", accentClass: "text-red-700 dark:text-red-300", quantityPrefix: "-" },
  EXPIRE: { label: "Expired", badgeVariant: "danger", accentClass: "text-red-700 dark:text-red-300", quantityPrefix: "-" },
  TRANSFER_IN: { label: "Transfer In", badgeVariant: "primary", accentClass: "text-purple-700 dark:text-purple-300", quantityPrefix: "+" },
  TRANSFER_OUT: { label: "Transfer Out", badgeVariant: "warning", accentClass: "text-orange-700 dark:text-orange-300", quantityPrefix: "-" },
  ADJUST: { label: "Adjustment", badgeVariant: "secondary", accentClass: "text-gray-700 dark:text-gray-300", quantityPrefix: "" },
  ADJUSTMENT: { label: "Adjustment", badgeVariant: "secondary", accentClass: "text-gray-700 dark:text-gray-300", quantityPrefix: "" },
});

const getInventoryMovementTypeMeta = (type) => {
  const normalizedType = normalizeInventoryMovementType(type);
  return(
    INVENTORY_MOVEMENT_TYPE_META[normalizedType] || {
      label: normalizedType.replace(/_/g, " "),
      badgeVariant: "secondary",
      accentClass: "text-gray-700 dark:text-gray-300",
      quantityPrefix: "",
    })
   ;
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
      normalizeInventoryDisplayVaccineName(
        row.vaccine_name ?? row.product_name ?? row.name,
      ) || "Unknown vaccine",
    lot_batch_number:
      row.lot_batch_number ??
      row.batch_number ??
      row.lot_number ??
      row.lot_no ??
      null,
    reference_number: referenceNumber || null,
    notes: notes || null,
    transaction_date: row.transaction_date ?? row.date ?? null,
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

const getDefaultInventoryFilterDate = () =>
  getVaccinationPeriodRange({
    period: "today",
    referenceDate: new Date(),
  }).startDate || new Date().toISOString().slice(0, 10);

const getInventoryDisplayPeriodRange = (period) => {
  const normalizedPeriod = normalizeVaccinationPeriod(period);
  const today = getDefaultInventoryFilterDate();

  if (!today) {
    return { startDate: "", endDate: "" };
  }

  if (normalizedPeriod === "custom") {
    return { startDate: "", endDate: "" };
  }

  if (normalizedPeriod === "today") {
    return { startDate: today, endDate: today };
  }

  if (normalizedPeriod === "month") {
    return {
      startDate: `${today.slice(0, 7)}-01`,
      endDate: today,
    };
  }

  const parsedToday = new Date(`${today}T00:00:00.000Z`);
  if (Number.isNaN(parsedToday.getTime())) {
    return { startDate: today, endDate: today };
  }

  const weekStart = new Date(parsedToday);
  const dayOfWeek = weekStart.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday);

  return {
    startDate: weekStart.toISOString().slice(0, 10),
    endDate: today,
  };
};

const createDefaultInventoryDisplayFilters = () => {
  const defaultRange = getInventoryDisplayPeriodRange("today");

  return {
    period: "today",
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    vaccine: "all",
    status: "all",
  };
};

const createDefaultStockMovementFilters = () => {
  const today = getDefaultInventoryFilterDate();

  return {
    period: "today",
    type: "all",
    vaccine: "all",
    customStartDate: today,
    customEndDate: today,
  };
};

const INVENTORY_TABLE_PAGE_SIZE = 10;
const INVENTORY_TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const STOCK_MOVEMENT_PERIOD_OPTIONS = Object.freeze(PERIOD_OPTIONS);

const buildStockMovementPeriodRange = (filters = {}) => {
  const normalizedPeriod = normalizeVaccinationPeriod(filters.period || "today");

  if (normalizedPeriod === "custom" &&( !filters.customStartDate || !filters.customEndDate)) {
    return { startDate: "", endDate: "" };
  }

  return getVaccinationPeriodRange({
    period: normalizedPeriod,
    startDate: filters.customStartDate || "",
    endDate: filters.customEndDate || "",
    referenceDate: new Date(),
  });
};

const buildInventoryRowsPerPageOptions = (
  defaultPageSize = INVENTORY_TABLE_PAGE_SIZE,
) =>
  [...new Set([defaultPageSize, ...INVENTORY_TABLE_PAGE_SIZE_OPTIONS])]
    .map((value) => Number(value) || INVENTORY_TABLE_PAGE_SIZE)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

const INVENTORY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "critical", label: "Critical / Out" },
  { value: "expired", label: "Expired" },
  { value: "with_waste", label: "With Waste" },
];

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

const matchesInventoryReportPeriodRange = (
  item = {},
  { period = "", startDate = "", endDate = "" } = {},
) => {
  const parsedStart = parseDateOnlyValue(startDate);
  const parsedEnd = parseDateOnlyValue(endDate, { endOfDay: true });

  if (!parsedStart && !parsedEnd) {
    return true;
  }

  const activityDateCandidates = [
    item.last_transaction_date,
    item.received_date,
    item.transferred_in_date,
    item.transferred_out_date,
    item.issuance_date,
    item.transaction_date,
    item.updated_at,
    item.created_at,
  ];
  const hasActivityDateCandidates = activityDateCandidates.some((candidateValue) =>
    Boolean(parseDateLikeValue(candidateValue)),
  );
  const matchesActivityDateRange = matchesOptionalDateRange(
    activityDateCandidates,
    { startDate, endDate },
  );
  const normalizedPeriod = normalizeVaccinationPeriod(period);

  if (
    hasActivityDateCandidates &&
    (normalizedPeriod === "today" || normalizedPeriod === "week")
  ) {
    return matchesActivityDateRange;
  }

  const periodStart = parseDateOnlyValue(item.period_start);
  const periodEnd = parseDateOnlyValue(item.period_end, { endOfDay: true });

  if (periodStart || periodEnd) {
    const normalizedPeriodStart = periodStart || periodEnd;
    const normalizedPeriodEnd = periodEnd || periodStart;

    if (!normalizedPeriodStart || !normalizedPeriodEnd) {
      return matchesActivityDateRange;
    }

    if (parsedStart && normalizedPeriodEnd.getTime() < parsedStart.getTime()) {
      return matchesActivityDateRange;
    }

    if (parsedEnd && normalizedPeriodStart.getTime() > parsedEnd.getTime()) {
      return matchesActivityDateRange;
    }

    return true;
  }

  return matchesActivityDateRange;
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

const matchesInventoryDisplaySelectionFilters = (item = {}, filters = {}) => {
  const matchesVaccineFilter =
    filters.vaccine === "all" || item.name === filters.vaccine;
  const matchesStatusFilter = matchesInventoryStatusFilter(
    item,
    filters.status,
  );

  return matchesVaccineFilter && matchesStatusFilter;
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

const normalizeInventoryMovementSummary = (summary = null) => {
  if (!summary || typeof summary !== "object") {
    return null;
  }

  return {
    totalRecords: normalizeInventoryNumber(
      summary.totalRecords ?? summary.total_records ?? summary.movement_records,
      0,
    ),
    stockIn: normalizeInventoryNumber(
      summary.stockIn ?? summary.stock_in,
      0,
    ),
    stockOut: normalizeInventoryNumber(
      summary.stockOut ?? summary.stock_out,
      0,
    ),
    wasted: normalizeInventoryNumber(
      summary.wasted ??
        summary.wasted_expired ??
        summary.wastedExpired ??
        summary.wasted_expired_transactions,
      0,
    ),
  };
};

function InventoryDisplayToolbarFilters({
  filters,
  vaccineOptions,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  leadingContent = null,
  trailingContent = null,
  showDivider = true,
}) {
  return(
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      {leadingContent ?(
        <div className="flex min-w-0 max-w-full items-center self-end">
          {leadingContent}
        </div>)
        : null}
      {showDivider ?(
        <>
          <div className="hidden h-10 w-px self-end bg-gray-200 dark:bg-gray-700 xl:block" />
          <div className="hidden self-end pb-2 2xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Inventory Filters
            </p>
          </div>
        </>)
        : null}
      <VaccinationPeriodFilter
        period={filters.period}
        onPeriodChange={(value) => onFilterChange("period", value)}
        startDate={filters.startDate || ""}
        endDate={filters.endDate || ""}
        onStartDateChange={(value) => onFilterChange("startDate", value)}
        onEndDateChange={(value) => onFilterChange("endDate", value)}
        periodOptions={PERIOD_OPTIONS}
        className="w-full xl:w-auto"
        layout="inline"
        startDateLabel="From Date"
        endDateLabel="To Date"
      />
      <Select
        label="Vaccine"
        value={filters.vaccine}
        onChange={(event) => onFilterChange("vaccine", event.target.value)}
        options={vaccineOptions}
        className="text-sm"
        containerClassName="w-full sm:w-[188px] xl:w-[172px] flex-shrink-0"
      />
      <Select
        label="Status"
        value={filters.status}
        onChange={(event) => onFilterChange("status", event.target.value)}
        options={INVENTORY_STATUS_FILTER_OPTIONS}
        className="text-sm"
        containerClassName="w-full sm:w-[188px] xl:w-[172px] flex-shrink-0"
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
      {trailingContent ?(
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 self-end"
          data-testid="inventory-summary-toolbar-stats"
        >
          {trailingContent}
        </div>)
        : null}
    </div>)
   ;
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
  return(
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 xl:justify-end">
      {showDivider ?(
        <>
          <div className="hidden h-10 w-px self-end bg-gray-200 dark:bg-gray-700 xl:block" />
          <div className="hidden self-end pb-2 2xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Stock Movement Filters
            </p>
          </div>
        </>)
        : null}
      <VaccinationPeriodFilter
        period={filters.period}
        onPeriodChange={(value) => onFilterChange("period", value)}
        startDate={filters.customStartDate || ""}
        endDate={filters.customEndDate || ""}
        onStartDateChange={(value) => onFilterChange("customStartDate", value)}
        onEndDateChange={(value) => onFilterChange("customEndDate", value)}
        periodOptions={STOCK_MOVEMENT_PERIOD_OPTIONS}
        className="w-full xl:w-auto"
        layout="inline"
        startDateLabel="From Date"
        endDateLabel="To Date"
      />
      <Select
        label="Type"
        value={filters.type}
        onChange={(event) => onFilterChange("type", event.target.value)}
        options={typeOptions}
        className="text-sm"
        containerClassName="w-full sm:w-44 flex-shrink-0"
      />
      <Select
        label="Vaccine"
        value={filters.vaccine}
        onChange={(event) => onFilterChange("vaccine", event.target.value)}
        options={vaccineOptions}
        className="text-sm"
        containerClassName="w-full sm:w-[188px] xl:w-[172px] flex-shrink-0"
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
    </div>)
   ;
}

function InventoryActiveTabToolbarFilters({
  activeTab,
  inventoryFilters,
  inventoryVaccineOptions,
  onInventoryFilterChange,
  onClearInventoryFilters,
  hasActiveInventoryFilters,
  inventoryLeadingContent,
  inventoryTrailingContent,
  stockMovementFilters,
  stockMovementTypeOptions,
  stockMovementVaccineOptions,
  onStockMovementFilterChange,
  onClearStockMovementFilters,
  hasActiveStockMovementFilters,
  onSaveInventory,
  onGenerateReport,
  showDivider = true,
}) {
  if (activeTab === "stock_movements") {
    return(
      <StockMovementToolbarFilters
        filters={stockMovementFilters}
        typeOptions={stockMovementTypeOptions}
        vaccineOptions={stockMovementVaccineOptions}
        onFilterChange={onStockMovementFilterChange}
        onClearFilters={onClearStockMovementFilters}
        hasActiveFilters={hasActiveStockMovementFilters}
        showDivider={showDivider}
      />)
     ;
  }

  const inventoryControls =(
    <InventoryDisplayToolbarFilters
      filters={inventoryFilters}
      vaccineOptions={inventoryVaccineOptions}
      onFilterChange={onInventoryFilterChange}
      onClearFilters={onClearInventoryFilters}
      hasActiveFilters={hasActiveInventoryFilters}
      leadingContent={null}
      trailingContent={inventoryTrailingContent}
      showDivider={showDivider}
    />)
   ;

  if (activeTab !== "inventory_sheet") {
    return inventoryControls;
  }

  return(
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      {inventoryLeadingContent ?(
        <div className="flex items-center self-end">
          {inventoryLeadingContent}
        </div>)
        : null}
      {inventoryControls}
      <div className="flex items-center gap-2 self-end">
        {typeof onSaveInventory === "function" ?(
          <Button
            variant="secondary"
            size="sm"
            onClick={onSaveInventory}
            className="min-h-[40px] whitespace-nowrap"
          >
            Save Inventory
          </Button>)
          : null}
        <Button
          variant="primary"
          size="sm"
          onClick={onGenerateReport}
          className="min-h-[40px] whitespace-nowrap"
        >
          Generate Report
        </Button>
      </div>
    </div>)
   ;
}

function InventoryHeaderTabs({
  activeTab,
  onTabChange,
  criticalAlertCount = 0,
}) {
  return(
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
        {criticalAlertCount > 0 ?(
          <span
            className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs ${
              activeTab === "inventory_summary"
                ? "bg-red-100 text-red-600"
                : "bg-white/20 text-white"
            }`}
          >
            {criticalAlertCount}
          </span>)
          : null}
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
    </div>)
   ;
}

function InventoryPaginationFooter({
  currentPage,
  itemsPerPage,
  totalItems,
  itemLabel,
  rowsPerPageOptions,
  pageInputId,
  pageInputValue,
  onRowsPerPageChange,
  onPageInputChange,
  onPageInputKeyDown,
  onPageJumpSubmit,
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

  return(
    <div
      data-testid={testId}
      className={`flex flex-shrink-0 flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-center lg:justify-between ${className}`.trim()}
    >
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing {startIndex} to {endIndex} of {totalItems} {itemLabel}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${pageInputId}-rows-per-page`}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Rows
          </label>
          <select
            id={`${pageInputId}-rows-per-page`}
            value={itemsPerPage}
            onChange={onRowsPerPageChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Rows per page"
          >
            {rowsPerPageOptions.map((option) =>(
              <option key={option} value={option}>
                {option}
              </option>)
             )}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevious}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <div className="flex items-center gap-2">
          <label
            htmlFor={pageInputId}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Go to page
          </label>
          <input
            id={pageInputId}
            type="number"
            min="1"
            max={totalPages}
            value={pageInputValue}
            onChange={onPageInputChange}
            onKeyDown={onPageInputKeyDown}
            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Go to page"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onPageJumpSubmit}
            disabled={totalPages <= 1}
          >
            Go
          </Button>
        </div>
      </div>
    </div>)
   ;
}

function StockMovementsPanel({
  movements,
  summaryOverride = null,
  loading,
  error,
  onRetry,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(INVENTORY_TABLE_PAGE_SIZE);
  const [pageInputValue, setPageInputValue] = useState("1");
  const rowsPerPageOptions = useMemo(
    () => buildInventoryRowsPerPageOptions(INVENTORY_TABLE_PAGE_SIZE),
    [],
  );
  const derivedSummary = useMemo(
    () => summarizeStockMovements(movements),
    [movements],
  );
  const summary = summaryOverride || derivedSummary;
  const totalPages = Math.max(
    1,
    Math.ceil(movements.length / itemsPerPage),
  );
  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return movements.slice(
      startIndex,
      startIndex + itemsPerPage,
    );
  }, [currentPage, itemsPerPage, movements]);

  useEffect(() => {
    setCurrentPage(1);
    setPageInputValue("1");
  }, [movements]);

  useEffect(() => {
    setPageInputValue(String(currentPage || 1));
  }, [currentPage]);

  const handlePageJumpSubmit = useCallback(() => {
    const nextPage = Number.parseInt(pageInputValue, 10);
    if (!Number.isFinite(nextPage)) {
      setPageInputValue(String(currentPage || 1));
      return;
    }

    const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
    setCurrentPage(clampedPage);
    setPageInputValue(String(clampedPage));
  }, [currentPage, pageInputValue, totalPages]);

  if (loading && movements.length === 0) {
    return(
      <div className="flex flex-col items-center justify-center py-16 print:hidden">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          Loading stock movement history...
        </p>
      </div>)
     ;
  }

  return(
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

      {error &&(
        <Alert variant="warning" title="Stock movement history unavailable">
          <div className="space-y-3">
            <p>{error}</p>
            <Button onClick={onRetry} size="sm" variant="outline">
              Retry
            </Button>
          </div>
        </Alert>)
       }

      <Card
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col"
        noPadding
      >
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
                {movements.length === 0 ?(
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No stock movement transactions match the selected filters.
                    </td>
                  </tr>)
                  :
                                        (paginatedMovements.map((movement)=>{
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

                    return(
                      <tr
                        key={movement.id}
                        className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/80"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatInventoryMovementDate(
                            movement.created_at || movement.transaction_date,
                          )}
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
                            {movement.notes ?(
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {movement.notes}
                              </div>)
                              : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {performerPrimaryLabel}
                            </div>
                            {performerRoleLabel ?(
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {performerRoleLabel}
                              </div>)
                              : null}
                          </div>
                        </td>
                      </tr>)
                     ;
                  }))
                 }
              </tbody>
            </table>
          </div>
        </div>
        <InventoryPaginationFooter
          testId="stock-movements-pagination"
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={movements.length}
          itemLabel="entries"
          rowsPerPageOptions={rowsPerPageOptions}
          pageInputId="stock-movements-page-jump"
          pageInputValue={pageInputValue}
          onRowsPerPageChange={(event) => {
            const nextPageSize =
              Number(event.target.value) || INVENTORY_TABLE_PAGE_SIZE;
            setItemsPerPage(nextPageSize);
            setCurrentPage(1);
            setPageInputValue("1");
          }}
          onPageInputChange={(event) => setPageInputValue(event.target.value)}
          onPageInputKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handlePageJumpSubmit();
            }
          }}
          onPageJumpSubmit={handlePageJumpSubmit}
          onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNext={() =>
            setCurrentPage((page) => Math.min(totalPages, page + 1))
          }
        />
      </Card>
    </div>)
   ;
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
    period_start: source.period_start ?? fallback.period_start ?? "",
    period_end: source.period_end ?? fallback.period_end ?? "",
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

const getInventoryRecordRecencyTime = (record = {}) => {
  const candidateDates = [
    record.period_end,
    record.last_transaction_date,
    record.updated_at,
    record.created_at,
    record.period_start,
    record.received_date,
    record.transferred_in_date,
    record.transferred_out_date,
    record.issuance_date,
    record.expiry_date,
  ];

  for (const value of candidateDates) {
    if (!value) {
      continue;
    }

    const parsedTime = new Date(value).getTime();
    if (Number.isFinite(parsedTime)) {
      return parsedTime;
    }
  }

  return 0;
};

const getInventoryRecordStartTime = (record = {}) => {
  const candidateDates = [
    record.period_start,
    record.created_at,
    record.received_date,
    record.transferred_in_date,
    record.transferred_out_date,
    record.issuance_date,
    record.expiry_date,
    record.period_end,
    record.updated_at,
    record.last_transaction_date,
  ];

  for (const value of candidateDates) {
    if (!value) {
      continue;
    }

    const parsedTime = new Date(value).getTime();
    if (Number.isFinite(parsedTime)) {
      return parsedTime;
    }
  }

  return 0;
};

const INVENTORY_RECORD_AGGREGATION_MODES = Object.freeze({
  LATEST_SNAPSHOT: "latest_snapshot",
  HISTORICAL_TOTALS: "historical_totals",
});

const aggregateInventoryRecordsByVaccine = (
  records = [],
  vaccineItems = [],
  fallbackFacilityId = null,
  options = {},
) =>
  vaccineItems.map((item) => {
    const aggregationMode =
      options.mode || INVENTORY_RECORD_AGGREGATION_MODES.LATEST_SNAPSHOT;
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

    // Use the latest saved snapshot for the inventory sheet instead of
    // re-summing every historical record for the same vaccine.
    const latestRow = [...matchingRows].sort((left, right) => {
      const recencyDifference =
        getInventoryRecordRecencyTime(right) - getInventoryRecordRecencyTime(left);

      if (recencyDifference !== 0) {
        return recencyDifference;
      }

      return normalizeInventoryNumber(right?.id, 0) - normalizeInventoryNumber(left?.id, 0);
    })[0];

    if (aggregationMode === INVENTORY_RECORD_AGGREGATION_MODES.HISTORICAL_TOTALS) {
      const earliestRow = [...matchingRows].sort((left, right) => {
        const chronologyDifference =
          getInventoryRecordStartTime(left) - getInventoryRecordStartTime(right);

        if (chronologyDifference !== 0) {
          return chronologyDifference;
        }

        return normalizeInventoryNumber(left?.id, 0) - normalizeInventoryNumber(right?.id, 0);
      })[0];

      const movementTotals = matchingRows.reduce(
        (accumulator, row) =>( {
          received: accumulator.received + normalizeInventoryNumber(row.received),
          transferred_in:
            accumulator.transferred_in + normalizeInventoryNumber(row.transferred_in),
          transferred_out:
            accumulator.transferred_out + normalizeInventoryNumber(row.transferred_out),
          expired_wasted:
            accumulator.expired_wasted + normalizeInventoryNumber(row.expired_wasted),
          issuance: accumulator.issuance + normalizeInventoryNumber(row.issuance),
          stock_in: accumulator.stock_in + normalizeInventoryNumber(row.stock_in),
          stock_out: accumulator.stock_out + normalizeInventoryNumber(row.stock_out),
        }),
        {
          received: 0,
          transferred_in: 0,
          transferred_out: 0,
          expired_wasted: 0,
          issuance: 0,
          stock_in: 0,
          stock_out: 0,
        },
      );

      const beginningBalance = normalizeInventoryNumber(earliestRow?.beginning_balance);
      const totalAvailable = normalizeInventoryNumber(
        beginningBalance + movementTotals.received,
      );
      const closingBalance = normalizeInventoryNumber(
        latestRow?.stock_on_hand,
        totalAvailable +
          movementTotals.transferred_in -
          movementTotals.transferred_out -
          movementTotals.expired_wasted -
          movementTotals.issuance,
      );

      return normalizeInventoryRecord(
        {
          ...latestRow,
          beginning_balance: beginningBalance,
          received: movementTotals.received,
          transferred_in: movementTotals.transferred_in,
          transferred_out: movementTotals.transferred_out,
          expired_wasted: movementTotals.expired_wasted,
          issuance: movementTotals.issuance,
          stock_in: movementTotals.stock_in,
          stock_out: movementTotals.stock_out,
          total_available: totalAvailable,
          stock_on_hand: closingBalance,
          lot_batch_number:
            matchingRows.length > 1
              ? `MULTIPLE LOTS (${matchingRows.length})`
              : latestRow?.lot_batch_number || earliestRow?.lot_batch_number || "",
          period_start: earliestRow?.period_start || latestRow?.period_start || "",
          period_end: latestRow?.period_end || earliestRow?.period_end || "",
        },
        {
          ...item,
          _vaccineId: latestRow?._vaccineId || null,
          _facilityId: latestRow?._facilityId || fallbackFacilityId,
        },
      );
    }

    return normalizeInventoryRecord(
      latestRow,
      {
        ...item,
        _vaccineId: latestRow?._vaccineId || null,
        _facilityId: latestRow?._facilityId || fallbackFacilityId,
      },
    );
  });

const findMatchingInventoryRow = (rows = [], target = {}) =>
  rows.find((row) => {
    const rowVaccineId = resolveInventorySaveRowId(row?._vaccineId);
    const targetVaccineId = resolveInventorySaveRowId(target?._vaccineId);

    if (rowVaccineId && targetVaccineId && rowVaccineId === targetVaccineId) {
      return true;
    }

    return inventoryNamesMatch(row?.name, target?.name);
  }) || null;

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
  const rowsWithIndex = inventoryRows.map((row, index) =>( {
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
    ...(othersRows.length > 0
      ? [
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
          ...othersRows,
        ]
      : []),
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

  const controlDate = String(reportDate || getTodayInventoryDateInput())
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
    (acc, row) =>( {
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

const getTodayInventoryDateInput = () => getDefaultInventoryFilterDate();

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
      return(
        normalized === normalizedSegment ||
        normalized.includes(normalizedSegment) ||
        normalizedSegment.includes(normalized))
       ;
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

const isSameInventoryDate = (leftDate, rightDate) =>
  leftDate instanceof Date &&
  rightDate instanceof Date &&
  leftDate.getFullYear() === rightDate.getFullYear() &&
  leftDate.getMonth() === rightDate.getMonth() &&
  leftDate.getDate() === rightDate.getDate();

const isFullCalendarMonthPeriod = (startDate, endDate) => {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    return false;
  }

  const lastDayOfMonth = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    0,
  ).getDate();

  return (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === 1 &&
    endDate.getDate() === lastDayOfMonth
  );
};

const formatInventoryPeriodBoundary = (value) =>
  formatPrintDateValue(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

const computePeriodLabel = ({
  reportDate,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  const fallbackPeriod = {
    label: formatInventoryMonthYear(reportDate).toUpperCase(),
    usesMonthPrefix: true,
  };

  if (!isFiltering) {
    return fallbackPeriod;
  }

  const validation = validatePrintDateRange({
    startDate: dateRangeStart,
    endDate: dateRangeEnd,
    requireBothDates: true,
  });

  if (!validation.isValid || !validation.start || !validation.end) {
    return fallbackPeriod;
  }

  if (isFullCalendarMonthPeriod(validation.start, validation.end)) {
    return {
      label: formatInventoryMonthYear(validation.start).toUpperCase(),
      usesMonthPrefix: true,
    };
  }

  if (isSameInventoryDate(validation.start, validation.end)) {
    return {
      label: formatInventoryPeriodBoundary(validation.start),
      usesMonthPrefix: false,
    };
  }

  return {
    label: `${formatInventoryPeriodBoundary(validation.start)} - ${formatInventoryPeriodBoundary(validation.end)}`,
    usesMonthPrefix: false,
  };
};

const resolveInventoryReportPeriodLabel = ({
  reportDate,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
}) => {
  return computePeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  }).label;
};

const formatInventoryReportDateRangeLabel = ({
  startDate = "",
  endDate = "",
  emptyLabel = "Select both From Date and To Date",
} = {}) => {
  const validation = validatePrintDateRange({
    startDate,
    endDate,
    requireBothDates: true,
  });

  if (!validation.isValid || !validation.start || !validation.end) {
    return emptyLabel;
  }

  return `${formatPrintDateValue(validation.start)} - ${formatPrintDateValue(validation.end)}`;
};

const buildInventoryReportDisplayFilters = (
  displayFilters = {},
  { startDate = "", endDate = "" } = {},
) => ({
  ...displayFilters,
  startDate: String(startDate || "").trim(),
  endDate: String(endDate || "").trim(),
});

const filterInventoryReportSourceForDisplay = (
  inventoryReportSource = [],
  displayFilters = {},
) =>
  inventoryReportSource.filter((item) => {
    const matchesDateFilter = matchesInventoryReportPeriodRange(item, displayFilters);
    const matchesVaccineFilter =
      displayFilters.vaccine === "all" || item.name === displayFilters.vaccine;
    const matchesStatusFilter = matchesInventoryStatusFilter(
      item,
      displayFilters.status,
    );

    return matchesDateFilter && matchesVaccineFilter && matchesStatusFilter;
  });

const buildInventorySheetRowsForDisplay = ({
  inventoryReportSource = [],
  vaccineItems = [],
  fallbackClinicId = null,
  displayFilters = {},
}) => {
  const hasAppliedDateRange = Boolean(
    String(displayFilters.startDate || "").trim() ||
      String(displayFilters.endDate || "").trim(),
  );

  return aggregateInventoryRecordsByVaccine(
    inventoryReportSource,
    vaccineItems,
    fallbackClinicId,
    {
      mode: INVENTORY_RECORD_AGGREGATION_MODES.HISTORICAL_TOTALS,
    },
  )
    .map((item) => ({
      ...item,
      _hasDisplayActivity: Boolean(
        findMatchingInventoryRow(inventoryReportSource, item),
      ),
    }))
    .filter((item) => {
      return displayFilters.vaccine === "all" || item.name === displayFilters.vaccine;
    });
};

const buildInventorySheetRowsWithLiveInventory = ({
  inventoryReportSource = [],
  liveInventoryRows = [],
  vaccineItems = [],
  fallbackClinicId = null,
  displayFilters = {},
}) =>
  buildInventorySheetRowsForDisplay({
    inventoryReportSource,
    vaccineItems,
    fallbackClinicId,
    displayFilters,
  })
    .map((reportRow) => {
      const liveRow = findMatchingInventoryRow(liveInventoryRows, reportRow);
      const actionStockOnHand = liveRow?.stock_on_hand ?? reportRow.stock_on_hand;

      return {
        ...(liveRow || {}),
        ...reportRow,
        id: liveRow?.id ?? reportRow.id,
        _apiId: liveRow?._apiId ?? reportRow._apiId,
        _vaccineId: liveRow?._vaccineId ?? reportRow._vaccineId,
        _facilityId: liveRow?._facilityId ?? reportRow._facilityId,
        _actionStockOnHand: actionStockOnHand,
      };
    })
    .filter((item) => {
      const matchesSelectionFilters = matchesInventoryDisplaySelectionFilters(
        {
          ...item,
          stock_on_hand: item._actionStockOnHand ?? item.stock_on_hand,
        },
        displayFilters,
      );

      return matchesSelectionFilters;
    });

const buildInventoryReportPayload = ({
  inventoryReportSource = [],
  liveInventoryRows = [],
  vaccineItems = [],
  fallbackClinicId = null,
  displayFilters = {},
  facilityInfo = {},
  reportDate,
}) => {
  const filteredInventoryReportSource = filterInventoryReportSourceForDisplay(
    inventoryReportSource,
    displayFilters,
  );
  const inventorySheetRows = buildInventorySheetRowsWithLiveInventory({
    inventoryReportSource: filteredInventoryReportSource,
    liveInventoryRows,
    vaccineItems,
    fallbackClinicId,
    displayFilters,
  });
  const printRows = buildInventoryPrintRows(inventorySheetRows);
  const printTotals = buildInventoryPrintTotals(printRows);
  const dohLguReportRows = buildDohLguReportRows(filteredInventoryReportSource);
  const risReportRows = buildRisReportRows(filteredInventoryReportSource);
  const risControlNumber = resolveRisControlNumber({
    facilityInfo,
    inventoryRows: filteredInventoryReportSource,
    reportDate,
    clinicId: fallbackClinicId,
  });

  return {
    inventoryReportSource: filteredInventoryReportSource,
    inventorySheetRows,
    printRows,
    printTotals,
    dohLguReportRows,
    risReportRows,
    risControlNumber,
  };
};

const resolveDohLguReportFacilityValue = (facilityInfo = {}) =>
  String(resolveInventorySheetFacilityName(facilityInfo) || "").trim() ||
  DEFAULT_PRINT_HEADER.healthCenter;

const resolveDohLguReportAddressValue = (facilityInfo = {}) => {
  const fallbackAddress = [DEFAULT_PRINT_HEADER.barangay, DEFAULT_PRINT_HEADER.city]
    .filter(Boolean)
    .join(", ");

  return String(buildFacilityAddress(facilityInfo) || fallbackAddress).trim();
};

const resolveDohLguReportLguValue = (facilityInfo = {}) => {
  const cityValue = String(facilityInfo.city || "").trim();
  const defaultCityValue = String(DEFAULT_PRINT_HEADER.city || "").trim();

  if (!cityValue) {
    return defaultCityValue.toUpperCase();
  }

  const normalizedCityValue = cityValue.toUpperCase();
  const normalizedDefaultCityBase = defaultCityValue
    .replace(/\s+CITY$/i, "")
    .toUpperCase();

  if (
    defaultCityValue &&
    normalizedDefaultCityBase &&
    normalizedCityValue === normalizedDefaultCityBase
  ) {
    return defaultCityValue.toUpperCase();
  }

  return cityValue.toUpperCase();
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

    return(
      normalizedName === normalizedAlias ||
      normalizedName.startsWith(`${normalizedAlias} `) ||
      normalizedName.endsWith(` ${normalizedAlias}`) ||
      normalizedName.includes(` ${normalizedAlias} `) ||
      normalizedAlias.startsWith(`${normalizedName} `) ||
      normalizedAlias.endsWith(` ${normalizedName}`) ||
      normalizedAlias.includes(` ${normalizedName} `))
     ;
  });
};

const sumInventoryReportBucket = (rows, selector, bucket) =>
  rows.reduce((total, row) => {
    if (resolveInventoryRowSourceBucket(row) !== bucket) {
      return total;
    }

    return total + Number(selector(row) || 0);
  }, 0);

const collectInventoryReportValues = (rows = [], selector) =>
  rows
    .map((row, index) => String(selector(row, index) || "").trim())
    .filter(Boolean);

const collectVaccineLotNumbers = (rows = []) =>
  collectInventoryReportValues(
    rows,
    (row) => row.lot_batch_number || row.lot_number,
  ).join(", ");

const collectVaccineExpiryDates = (rows = []) =>
  collectInventoryReportValues(
    rows,
    (row) => formatInventoryReportDate(row.expiry_date),
  ).join(", ");

const collectVaccineTransactionDates = (rows = []) =>
  rows
    .flatMap((row) => [
      formatInventoryReportDate(row.received_date || row.transferred_in_date),
      formatInventoryReportDate(row.transferred_out_date),
    ])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

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
      lotNumber: collectVaccineLotNumbers(matchedRows),
      expiryDate: collectVaccineExpiryDates(matchedRows),
      transactionDate: collectVaccineTransactionDates(matchedRows),
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
      patientsReceivedDoh: sumInventoryReportBucket(
        matchedRows,
        (row) => row.issuance,
        "DOH",
      ),
      patientsReceivedLgu: sumInventoryReportBucket(
        matchedRows,
        (row) => row.issuance,
        "LGU",
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
      colSpan: 2,
      rowSpan: 2,
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
  [
    "DOH",
    "LGU",
    "DOH",
    "LGU",
    "DOH",
    "LGU",
    "DOH",
    "LGU",
    "DOH",
    "LGU",
    "DOH",
    "LGU",
  ],
];

const DOH_LGU_PDF_COLUMN_WIDTH_WEIGHTS = [
  8, 68, 11, 11, 11, 11, 11, 11, 24, 16, 18, 11, 11, 11, 11, 11, 11,
];

const DOH_LGU_REPORT_TOTAL_COLUMN_WEIGHT = DOH_LGU_PDF_COLUMN_WIDTH_WEIGHTS.reduce(
  (sum, value) => sum + Number(value || 0),
  0,
);

const DOH_LGU_REPORT_COLUMN_WIDTH_PERCENTAGES = Object.freeze(
  DOH_LGU_PDF_COLUMN_WIDTH_WEIGHTS.map((weight) =>
    Number( ((weight/ DOH_LGU_REPORT_TOTAL_COLUMN_WEIGHT) * 100).toFixed(2)),
  ),
);

const getScaledPdfColumnStyles = ({
  weights = [],
  availableWidth,
  alignments = {},
}) => {
  const totalWeight = weights.reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  if (!totalWeight || !availableWidth) {
    return {};
  }

  return weights.reduce((result, weight, index) => {
    result[index] = {
      cellWidth: Number( ((availableWidth* weight) / totalWeight).toFixed(2)),
      ...(alignments[index] ? { halign: alignments[index] } : {}),
    };
    return result;
  }, {});
};

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
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const [leftLogoSrc, rightLogoSrc] = await Promise.all([
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
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const tableStartY = 51;
  const facilityName = resolveDohLguReportFacilityValue(facilityInfo);
  const lguName = resolveDohLguReportLguValue(facilityInfo);
  const address = resolveDohLguReportAddressValue(facilityInfo);
  const reportingPeriod = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });
  const sanitizedReportDate =
    String(reportDate || "").trim() || getTodayInventoryDateInput();

  const drawHeader = () => {
    const contentWidth = pageWidth - margin.left - margin.right;
    const rightEdge = pageWidth - margin.right;
    const centerX = margin.left + contentWidth / 2;
    const logoSize = 12;
    const logoY = 8;

    if (leftLogoSrc) {
      doc.addImage(
        leftLogoSrc,
        resolveImageDataUrlFormat(leftLogoSrc),
        margin.left,
        logoY,
        logoSize,
        logoSize,
      );
    }

    if (rightLogoSrc) {
      doc.addImage(
        rightLogoSrc,
        resolveImageDataUrlFormat(rightLogoSrc),
        rightEdge - logoSize,
        logoY,
        logoSize,
        logoSize,
      );
    }

    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.text("Republic of the Philippines", centerX, 10.5, {
      align: "center",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.1);
    doc.text("METRO MANILA CENTER FOR HEALTH DEVELOPMENT", centerX, 14.3, {
      align: "center",
    });

    doc.setFontSize(8.3);
    doc.text(PRINT_REPORT_COPY.dohLguSubtitle, centerX, 18.2, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.text(PRINT_REPORT_COPY.dohLguTitle, centerX, 21.8, {
      align: "center",
    });

    const infoTop = 24.5;
    const infoRowHeight = 5.5;
    const midX = margin.left + contentWidth / 2;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.18);
    doc.rect(margin.left, infoTop, contentWidth, infoRowHeight * 2);
    doc.line(midX, infoTop, midX, infoTop + infoRowHeight * 2);
    doc.line(
      margin.left,
      infoTop + infoRowHeight,
      rightEdge,
      infoTop + infoRowHeight,
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.7);
    doc.text("FACILITY:", margin.left + 1.4, infoTop + 3.5);
    doc.text("LGU:", midX + 1.4, infoTop + 3.5);
    doc.text("ADDRESS:", margin.left + 1.4, infoTop + infoRowHeight + 3.5);
    doc.text("REPORTING PERIOD:", midX + 1.4, infoTop + infoRowHeight + 3.5);

    doc.setFont("helvetica", "normal");
    doc.text(facilityName, margin.left + 15, infoTop + 3.5);
    doc.text(lguName, midX + 9, infoTop + 3.5);
    doc.text(address, margin.left + 15, infoTop + infoRowHeight + 3.5);
    doc.text(
      String(reportingPeriod || "").toUpperCase(),
      midX + 25,
      infoTop + infoRowHeight + 3.5,
    );
  };

  const formatPdfNumber = (value) =>
    formatRisQuantityDisplay(value, { showZero: true });

  drawHeader();

  runAutoTable({
    startY: tableStartY,
    margin,
    theme: "grid",
    head: buildDohLguPdfHeaderRows(),
    body: reportRows.map((row) => [
      row.rowNumber,
      row.itemName,
      formatPdfNumber(row.previousDoh),
      formatPdfNumber(row.previousLgu),
      formatPdfNumber(row.receivedDoh),
      formatPdfNumber(row.receivedLgu),
      formatPdfNumber(row.transferredDoh),
      formatPdfNumber(row.transferredLgu),
      row.lotNumber || "-",
      row.expiryDate || "-",
      row.transactionDate || "-",
      formatPdfNumber(row.monthlyConsumptionDoh),
      formatPdfNumber(row.monthlyConsumptionLgu),
      formatPdfNumber(row.patientsReceivedDoh),
      formatPdfNumber(row.patientsReceivedLgu),
      formatPdfNumber(row.endStocksDoh),
      formatPdfNumber(row.endStocksLgu),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 6.8,
      cellPadding: 0.9,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.18,
      valign: "top",
      halign: "center",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineWidth: 0.18,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: getScaledPdfColumnStyles({
      weights: DOH_LGU_PDF_COLUMN_WIDTH_WEIGHTS,
      availableWidth: pageWidth - margin.left - margin.right,
      alignments: {
        1: "left",
        8: "left",
      },
    }),
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

const RIS_PDF_COLUMN_WIDTH_WEIGHTS = [73, 20, 28, 24, 24, 22];

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
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const availableTableWidth = pageWidth - margin.left - margin.right;
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
    String(reportDate || "").trim() || getTodayInventoryDateInput();

  const [pasigLogoResult, dohLogoResult] = await Promise.allSettled([
    loadPrintImageAsDataUrl(PASIG_REPORT_SEAL_SRC),
    loadPrintImageAsDataUrl(DOH_REPORT_SEAL_SRC),
  ]);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(4, 4, pageWidth - 8, pageHeight - 8);

  if (pasigLogoResult.status === "fulfilled") {
    doc.addImage(pasigLogoResult.value, "PNG", 22, 11, 18, 18);
  }

  if (dohLogoResult.status === "fulfilled") {
    doc.addImage(dohLogoResult.value, "PNG", pageWidth - 40, 11, 18, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.text(PRINT_REPORT_COPY.risTitle, pageWidth / 2, 16.5, {
    align: "center",
  });

  doc.setFontSize(9.4);
  doc.text(PRINT_REPORT_COPY.risSubtitle, pageWidth / 2, 22.5, {
    align: "center",
  });

  doc.setFontSize(10.9);
  doc.text(PRINT_REPORT_COPY.risMunicipality, pageWidth / 2, 28.5, {
    align: "center",
  });

  runAutoTable({
    startY: 36,
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
      fontSize: 8.7,
      cellPadding: 1.15,
      textColor: [0, 0, 0],
      lineWidth: 0,
      valign: "middle",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 66 },
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
    startY: (doc.lastAutoTable?.finalY || 36) + 2,
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
      fontSize: 8.45,
      cellPadding: 1,
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
    tableWidth: availableTableWidth,
    columnStyles: getScaledPdfColumnStyles({
      weights: RIS_PDF_COLUMN_WIDTH_WEIGHTS,
      availableWidth: availableTableWidth,
      alignments: {
        0: "left",
      },
    }),
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

  @page {
    size: __PRINT_PAGE_SIZE__;
    margin: __PRINT_PAGE_MARGIN__;
  }

  body.inventory-export--landscape {
    padding: 0.08in 0.12in 0.1in;
  }

  body.inventory-export--portrait {
    padding: 0.1in 0.12in 0.12in;
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
    margin: 0 auto;
    min-height: 7.75in;
    padding: 0.05in 0.07in 0.08in;
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

  .inventory-sheet-summary-print-header__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.06cm 0.25cm;
    margin-top: 0.12cm;
    padding-top: 0.1cm;
    border-top: 1px solid #cbd5e1;
    text-align: left;
  }

  .inventory-sheet-summary-print-header__meta-line {
    margin: 0;
    font-size: 9px;
    line-height: 1.22;
  }

  .inventory-sheet-summary-print-header__meta-label {
    font-weight: 800;
    text-transform: uppercase;
  }

  .doh-lgu-stock-print-header__meta-table {
    width: 100%;
    margin-top: 0.08cm;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .doh-lgu-stock-print-header__meta-table td {
    border: 0.5pt solid #111827;
    padding: 0.08cm 0.09cm;
    font-size: 8.7px;
    line-height: 1.16;
    text-align: left;
    vertical-align: middle;
  }

  .doh-lgu-stock-print-header__meta-label {
    font-weight: 800;
    text-transform: uppercase;
  }

  .doh-lgu-stock-print-header__meta-value {
    font-weight: 700;
    letter-spacing: 0.01em;
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
    word-break: keep-all;
    white-space: nowrap;
    overflow-wrap: normal;
    background: #ffffff;
    background-clip: padding-box;
    box-shadow: none;
  }

  .inventory-sheet-summary-print-table th,
  .inventory-sheet-summary-print-table td {
    padding: 0.045cm 0.05cm;
  }

  #doh-lgu-print-table {
    border: 0.5pt solid #111827;
    font-size: 9pt;
    line-height: 1.16;
  }

  #doh-lgu-print-table th,
  #doh-lgu-print-table td {
    border-width: 0.5pt;
    border-color: #111827;
    border-style: solid;
    padding: 0.095cm 0.07cm;
  }

  #doh-lgu-print-table thead th {
    font-size: 9pt;
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
    font-size: 9pt;
    font-weight: 800;
    text-align: center;
  }

  .inventory-sheet-summary-print-table td,
  #doh-lgu-print-table td,
  .ris-print-table td {
    font-size: 9pt;
    line-height: 1.2;
  }

  .inventory-sheet-summary-print-table th,
  .inventory-sheet-summary-print-table td {
    font-size: 7.7pt;
    line-height: 1.12;
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

  #doh-lgu-print-table .print-col-left,
  #doh-lgu-print-table .print-col-wrap {
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    white-space: normal;
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
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .inventory-sheet-summary-print-report__page {
    width: 100%;
    max-width: ${INVENTORY_SHEET_FRAME_MAX_WIDTH};
    min-height: 7.25in;
    margin: 0 auto;
    padding: 0.03in 0;
    display: flex;
    justify-content: center;
    page-break-after: always;
    break-after: page;
  }

  .inventory-sheet-summary-print-report__page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .inventory-sheet-summary-print-report__surface {
    width: 100%;
    max-width: ${INVENTORY_SHEET_SURFACE_MAX_WIDTH};
    margin: 0 auto;
    padding: 0.18in 0.22in 0.16in;
    border: 1.45px solid #111827;
    background: #ffffff;
  }

  .inventory-sheet-summary-print-header {
    width: 100%;
    margin: 0 auto 0.36in;
    padding: 0 0 0.22in;
    border-bottom: 1.35px solid #cbd5e1;
  }

  .inventory-sheet-summary-print-header__branding {
    display: grid;
    grid-template-columns: 1.16in minmax(0, 1fr) 1.16in;
    align-items: center;
    gap: 0.32in;
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
    width: 1in;
    height: 1in;
    object-fit: contain;
    background: transparent;
  }

  .inventory-sheet-summary-print-header__logo--circle {
    border-radius: 9999px;
    clip-path: circle(50% at 50% 50%);
  }

  .inventory-sheet-summary-print-header__line--government {
    margin-bottom: 0.06in;
    font-size: 9.6px;
  }

  .inventory-sheet-summary-print-header__line--title {
    margin-top: 0.05in;
    font-size: 10.8px;
    text-transform: none;
  }

  .inventory-sheet-summary-print-header__detail-row {
    display: grid;
    grid-template-columns: minmax(1.7in, auto) minmax(0, 1fr) minmax(2.6in, auto);
    align-items: end;
    gap: 0.26in;
    width: 100%;
    margin: 0.16in auto 0;
    padding-top: 0.14in;
    border-top: 1px solid #e2e8f0;
  }

  .inventory-sheet-summary-print-header__detail--facility {
    justify-self: center;
    text-align: center;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .inventory-sheet-summary-print-header__detail--month {
    justify-self: end;
  }

  .inventory-sheet-summary-print-report__table-wrap {
    width: 100%;
    margin: 0.12in auto 0;
  }

  .inventory-sheet-summary-print-table {
    width: 100%;
    margin: 0 auto;
  }

  .inventory-sheet-summary-print-footer {
    width: 100%;
    margin: 0.2in auto 0;
    padding-top: 0.14in;
    border-top: 1px solid #d7deea;
    text-align: center;
    font-size: 8.2px;
    line-height: 1.2;
    color: #475569;
  }

  .doh-lgu-stock-print-header {
    padding: 0.12cm 0.14cm 0.1cm;
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
    max-width: 8.12in;
    margin: 0 auto;
    border: 1.4px solid #111827;
    padding: 0.12in 0.14in 0.14in;
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
  pageCssSize = "A4 landscape",
  printMargin = "15mm",
}) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      ${INVENTORY_EXPORT_DOCUMENT_STYLES
        .replace("__PRINT_PAGE_SIZE__", pageCssSize)
        .replace("__PRINT_PAGE_MARGIN__", printMargin)}
    </style>
  </head>
  <body class="inventory-export inventory-export--${orientation}">
    ${bodyMarkup}
  </body>
</html>`;

const buildInventorySheetWordHtml = (
  props,
  reportType = PRINT_REPORT_TYPES.INVENTORY_SHEET,
) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.inventorySheetTitle,
    orientation: getInventoryReportOrientation(reportType),
    ...getInventoryReportCssPageSettings(reportType),
    bodyMarkup: renderToStaticMarkup(<InventorySheetSummaryPrintReport {...props} />),
  });

const buildRisWordHtml = (props) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.risTitle,
    orientation: getInventoryReportOrientation(
      PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP,
    ),
    ...getInventoryReportCssPageSettings(
      PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP,
    ),
    bodyMarkup: renderToStaticMarkup(<RequisitionIssueSlipWordReport {...props} />),
  });

const buildRisPrintHtml = (props) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.risTitle,
    orientation: getInventoryReportOrientation(
      PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP,
    ),
    ...getInventoryReportCssPageSettings(
      PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP,
    ),
    bodyMarkup: renderToStaticMarkup(<RequisitionIssueSlipPrintReport {...props} />),
  });

const buildDohLguReportHtml = (props) =>
  buildInventoryExportDocument({
    title: PRINT_REPORT_COPY.dohLguTitle,
    orientation: getInventoryReportOrientation(
      PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM,
    ),
    ...getInventoryReportCssPageSettings(
      PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM,
    ),
    bodyMarkup: renderToStaticMarkup(<DohLguStockInventoryPrintReport {...props} />),
  });

const buildPrintableInventoryReportHtml = ({
  reportType,
  reportDate,
  reportRange = {},
  reportPayload = {},
  facilityInfo,
  inventorySheetLeftLogoSrc,
  inventorySheetRightLogoSrc,
  risLeftSealSrc,
  risRightSealSrc,
  deliveryType = "print",
}) => {
  const normalizedReportType = normalizeInventoryReportType(reportType);
  const sharedProps = {
    facilityInfo,
    reportDate,
    dateRangeStart: reportRange.startDate || "",
    dateRangeEnd: reportRange.endDate || "",
    isFiltering: Boolean(reportRange.startDate && reportRange.endDate),
    useActiveRangeLabel:
      normalizedReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET,
  };

  if (normalizedReportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
    const risProps = {
      ...sharedProps,
      reportRows: reportPayload.risReportRows || [],
      controlNumber: reportPayload.risControlNumber,
      ...(risLeftSealSrc ? { leftSealSrc: risLeftSealSrc } : {}),
      ...(risRightSealSrc ? { rightSealSrc: risRightSealSrc } : {}),
    };

    return deliveryType === "word"
      ? buildRisWordHtml(risProps)
      : buildRisPrintHtml(risProps);
  }

  if (normalizedReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM) {
    return buildDohLguReportHtml({
      ...sharedProps,
      reportRows: reportPayload.dohLguReportRows || [],
    });
  }

  return buildInventorySheetWordHtml(
    {
      ...sharedProps,
      printRows: reportPayload.printRows || [],
      printTotals: reportPayload.printTotals || buildInventoryPrintTotals([]),
      ...(inventorySheetLeftLogoSrc ? { leftLogoSrc: inventorySheetLeftLogoSrc } : {}),
      ...(inventorySheetRightLogoSrc ? { rightLogoSrc: inventorySheetRightLogoSrc } : {}),
    },
    normalizedReportType,
  );
};

function InventoryStaticHtmlReport({ html }) {
  const parsedHtml = useMemo(() => {
    if (!html || typeof DOMParser === "undefined") {
      return {
        bodyClassName: "",
        styles: "",
        bodyMarkup: "",
      };
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    return {
      bodyClassName: parsed.body?.className || "",
      styles: Array.from(parsed.querySelectorAll("style"))
        .map((node) => node.textContent || "")
        .join("\n"),
      bodyMarkup: parsed.body?.innerHTML || "",
    };
  }, [html]);

  if (!parsedHtml.bodyMarkup) {
    return null;
  }

  return (
    <div className={parsedHtml.bodyClassName}>
      {parsedHtml.styles ? (
        <style dangerouslySetInnerHTML={{ __html: parsedHtml.styles }} />
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: parsedHtml.bodyMarkup }} />
    </div>
  );
}

const createInventoryPdfContainer = (html) => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const container = document.createElement("div");

  container.className = parsed.body?.className || "";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "1123px";
  container.style.background = "#ffffff";

  const styleNodes = parsed.head?.querySelectorAll("style") || [];
  styleNodes.forEach((node) => {
    container.appendChild(node.cloneNode(true));
  });

  const bodyNodes = Array.from(parsed.body?.childNodes || []);
  bodyNodes.forEach((node) => {
    container.appendChild(node);
  });

  document.body.appendChild(container);

  return {
    element: container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
};

const exportInventoryPdfFromHtml = async ({
  html,
  filename,
  reportType = PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM,
  fallbackExport,
}) => {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
  const pdfConfig = getInventoryReportPdfConfig(reportType);
  const doc = new jsPDF({
    orientation: pdfConfig.orientation,
    unit: "pt",
    format: pdfConfig.format,
  });

  if (typeof doc?.html !== "function") {
    if (typeof fallbackExport === "function") {
      await fallbackExport();
      return;
    }

    throw new Error("HTML PDF export is not available in this environment.");
  }

  const { element, cleanup } = createInventoryPdfContainer(html);

  try {
    await doc.html(element, {
      autoPaging: "text",
      html2canvas: {
        scale: 1,
        useCORS: true,
        backgroundColor: "#ffffff",
      },
      windowWidth: element.scrollWidth || undefined,
    });
    doc.save(filename);
  } finally {
    cleanup();
  }
};

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
  useActiveRangeLabel = true,
}) => {
  if (!useActiveRangeLabel) {
    return `FOR THE MONTH: ${resolveInventoryReportPeriodLabel({
      reportDate,
      dateRangeStart,
      dateRangeEnd,
      isFiltering,
    })}`;
  }

  const periodLabel = computePeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });

  return `${periodLabel.usesMonthPrefix ? "FOR THE MONTH" : "FOR THE PERIOD"}: ${periodLabel.label}`;
};

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
  useActiveRangeLabel = true,
  leftLogoSrc = INVENTORY_SHEET_LEFT_LOGO_SRC,
  rightLogoSrc = INVENTORY_SHEET_RIGHT_LOGO_SRC,
}) =>( {
  facilityName: resolveInventorySheetFacilityName(facilityInfo),
  monthLine: resolveInventorySheetMonthLine({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
    useActiveRangeLabel,
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
        cellWidth: Number( ((availableWidth* percentage) / 100).toFixed(2)),
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
  pageHeight,
  margin,
  headerContext,
  leftLogoImage,
  rightLogoImage,
}) => {
  const frameWidth = Math.min(pageWidth - 20, INVENTORY_SHEET_PDF_FRAME_WIDTH_MM);
  const frameLeft = (pageWidth - frameWidth) / 2;
  const frameTop = margin.top - 1;
  const frameHeight = pageHeight -( margin.top + margin.bottom) + 2;
  const contentLeft = frameLeft + INVENTORY_SHEET_PDF_FRAME_PADDING_MM;
  const contentWidth = frameWidth - INVENTORY_SHEET_PDF_FRAME_PADDING_MM * 2;
  const contentRight = contentLeft + contentWidth;
  const centerX = pageWidth / 2;
  const logoSize = 22;
  const logoY = frameTop + 5.5;
  const leftLogoX = contentLeft + 2;
  const rightLogoX = contentRight - logoSize - 2;

  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.35);
  doc.rect(frameLeft, frameTop, frameWidth, frameHeight);

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

  let currentY = frameTop + 8;

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
  doc.line(contentLeft, currentY, contentRight, currentY);

  currentY += 8.6;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  doc.text(PRINT_REPORT_COPY.inventorySheetCodeLabel, contentLeft, currentY);
  doc.line(contentLeft + 9.5, currentY + 0.3, contentLeft + 45, currentY + 0.3);
  doc.text(headerContext.facilityName, centerX, currentY, {
    align: "center",
  });
  doc.text(headerContext.monthLine, contentRight, currentY, {
    align: "right",
  });

  const footerY = frameTop + frameHeight - 3.6;
  doc.setDrawColor(215, 222, 234);
  doc.setLineWidth(0.25);
  doc.line(contentLeft, footerY - 2, contentRight, footerY - 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${headerContext.facilityName} • ${headerContext.monthLine}`,
    centerX,
    footerY,
    {
      align: "center",
    },
  );

  return {
    tableStartY: currentY + 7.6,
    contentLeft,
    contentWidth,
  };
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
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const sanitizedReportDate =
    String(reportDate || "").trim() || getTodayInventoryDateInput();
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

    const { tableStartY, contentLeft, contentWidth } = drawInventorySheetPdfHeader({
      doc,
      pageWidth,
      pageHeight,
      margin,
      headerContext,
      leftLogoImage,
      rightLogoImage,
    });

    runAutoTable({
      startY: tableStartY,
      margin: {
        top: margin.top,
        right: contentLeft,
        bottom: margin.bottom + 6,
        left: contentLeft,
      },
      theme: "grid",
      tableWidth: contentWidth,
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
      columnStyles: getInventorySheetPdfColumnStyles(contentWidth),
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
  headerTestId = "inventory-sheet-print-header",
  monthLineTestId = "inventory-sheet-print-month-year",
}) => {
  return(
    <header
      className="inventory-sheet-summary-print-header"
      data-testid={headerTestId}
    >
      <div className="inventory-sheet-summary-print-header__branding">
        <div className="inventory-sheet-summary-print-header__logo-wrap">
          {leftLogoSrc ?(
            <img
              src={leftLogoSrc}
              alt="Department of Health logo"
              className="inventory-sheet-summary-print-header__logo inventory-sheet-summary-print-header__logo--circle"
            />)
            : null}
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
          {rightLogoSrc ?(
            <img
              src={rightLogoSrc}
              alt="San Nicolas Health Center logo"
              className="inventory-sheet-summary-print-header__logo inventory-sheet-summary-print-header__logo--circle"
            />)
            : null}
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
          data-testid={monthLineTestId}
        >
          {monthLine}
        </p>
      </div>
    </header>)
   ;
};

const InventorySheetSummaryPrintFooter = ({
  facilityName,
  monthLine,
}) =>(
  <footer className="inventory-sheet-summary-print-footer">
    {facilityName} • {monthLine}
  </footer>)
 ;

const renderInventoryReportCellLines = (value) => {
  const lines = String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return lines.map((line, index) =>(
    <React.Fragment key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </React.Fragment>)
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
  useActiveRangeLabel = true,
  leftLogoSrc = INVENTORY_SHEET_LEFT_LOGO_SRC,
  rightLogoSrc = INVENTORY_SHEET_RIGHT_LOGO_SRC,
  reportClassName = "",
  reportTestId = "inventory-sheet-print-report",
  pageTestId = "inventory-sheet-print-page",
  headerTestId = "inventory-sheet-print-header",
  monthLineTestId = "inventory-sheet-print-month-year",
  tableTestId = "inventory-sheet-print-table",
  totalRowTestId = "inventory-sheet-print-total-row",
}) => {
  const headerContext = buildInventorySheetHeaderContext({
    facilityInfo,
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
    useActiveRangeLabel,
    leftLogoSrc,
    rightLogoSrc,
  });
  const pageGroups = buildInventorySheetPages(printRows);

  return(
    <section
      className={`inventory-sheet-summary-print-report ${reportClassName}`.trim()}
      data-testid={reportTestId}
    >
      {pageGroups.map((pageRows, pageIndex) =>(
        <article
          key={`inventory-sheet-print-page-${pageIndex + 1}`}
          className="inventory-sheet-summary-print-report__page"
          data-testid={pageTestId}
        >
          <div className="inventory-sheet-summary-print-report__surface">
            <InventorySheetSummaryPrintHeader
              {...headerContext}
              headerTestId={headerTestId}
              monthLineTestId={monthLineTestId}
            />

            <div className="inventory-sheet-summary-print-report__table-wrap">
              <table
                className="inventory-sheet-summary-print-table"
                data-testid={tableTestId}
              >
                <colgroup>
                  {INVENTORY_SHEET_COLUMN_WIDTH_PERCENTAGES.map((width, index) =>(
                    <col
                      key={`inventory-sheet-col-${index}`}
                      style={{ width: `${width}%` }}
                    />)
                   )}
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
                  {pageRows.map((item) =>(
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
                    </tr>)
                   )}

                  {pageIndex === pageGroups.length - 1 &&(
                    <tr
                      className="inventory-sheet-summary-print-total-row"
                      data-testid={totalRowTestId}
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
                    </tr>)
                   }
                </tbody>
              </table>
            </div>

            <InventorySheetSummaryPrintFooter
              facilityName={headerContext.facilityName}
              monthLine={headerContext.monthLine}
            />
          </div>
        </article>)
       )}
    </section>)
   ;
};

const DohLguStockInventoryPrintReport = ({
  facilityInfo,
  reportDate,
  reportRows = [],
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
  leftLogoSrc = DOH_LGU_REPORT_LEFT_SEAL_SRC,
  rightLogoSrc = DOH_LGU_REPORT_RIGHT_SEAL_SRC,
}) => {
  const facilityName = resolveDohLguReportFacilityValue(facilityInfo);
  const lguName = resolveDohLguReportLguValue(facilityInfo);
  const address = resolveDohLguReportAddressValue(facilityInfo);
  const reportingPeriod = resolveInventoryReportPeriodLabel({
    reportDate,
    dateRangeStart,
    dateRangeEnd,
    isFiltering,
  });

  return(
    <section className="doh-lgu-stock-print-report" data-testid="inventory-print-report">
      <article
        className="doh-lgu-stock-print-report__page"
        data-testid="inventory-print-page"
      >
        <header className="doh-lgu-stock-print-header" data-testid="inventory-print-header">
          <p className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--government">
            Republic of the Philippines
          </p>
          <div className="doh-lgu-stock-print-header__branding">
            <div>
              {leftLogoSrc ?(
                <img
                  src={leftLogoSrc}
                  alt="Department of Health seal"
                  className="doh-lgu-stock-print-header__seal"
                />)
                : null}
            </div>
            <div className="doh-lgu-stock-print-header__branding-copy">
              <p className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--primary">
                METRO MANILA CENTER FOR HEALTH DEVELOPMENT
              </p>
              <p className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--subtitle">
                {PRINT_REPORT_COPY.dohLguSubtitle}
              </p>
              <h1 className="doh-lgu-stock-print-header__line doh-lgu-stock-print-header__line--title">
                {PRINT_REPORT_COPY.dohLguTitle}
              </h1>
            </div>
            <div>
              {rightLogoSrc ?(
                <img
                  src={rightLogoSrc}
                  alt="San Nicolas Health Center logo"
                  className="doh-lgu-stock-print-header__seal"
                />)
                : null}
            </div>
          </div>
          <table className="doh-lgu-stock-print-header__meta-table">
            <tbody>
              <tr>
                <td>
                  <span className="doh-lgu-stock-print-header__meta-label">Facility:</span>{" "}
                  <span className="doh-lgu-stock-print-header__meta-value">
                    {facilityName}
                  </span>
                </td>
                <td>
                  <span className="doh-lgu-stock-print-header__meta-label">LGU:</span>{" "}
                  <span className="doh-lgu-stock-print-header__meta-value">{lguName}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="doh-lgu-stock-print-header__meta-label">Address:</span>{" "}
                  <span className="doh-lgu-stock-print-header__meta-value">{address}</span>
                </td>
                <td data-testid="inventory-print-month-year">
                  <span className="doh-lgu-stock-print-header__meta-label">
                    Reporting Period:
                  </span>{" "}
                  <span className="doh-lgu-stock-print-header__meta-value">
                    {reportingPeriod}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </header>

        <table id="doh-lgu-print-table" data-testid="inventory-print-table">
          <colgroup>
            {DOH_LGU_REPORT_COLUMN_WIDTH_PERCENTAGES.map((width, index) =>(
              <col
                key={`doh-lgu-print-col-${index}`}
                style={{ width: `${width}%` }}
              />)
             )}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={3}>#</th>
              <th rowSpan={3}>NATIONAL IMMUNIZATION PROGRAM (NIP)</th>
              <th colSpan={2} rowSpan={2}>
                Ending Inventory from the PREVIOUS Month
              </th>
              <th colSpan={7}>Stock Transfer (DM 2014-0317)</th>
              <th colSpan={2} rowSpan={2}>
                Monthly Consumption (D)
              </th>
              <th colSpan={2} rowSpan={2}>
                Number of Patients Received the vaccine for this month
              </th>
              <th colSpan={2} rowSpan={2}>
                End of Month Stocks (A+B) - (C+D)
              </th>
            </tr>
            <tr>
              <th colSpan={2}>Received (B)</th>
              <th colSpan={2}>Transferred (C)</th>
              <th rowSpan={2}>Lot Number</th>
              <th rowSpan={2}>Expiry Date</th>
              <th rowSpan={2}>Date Received / Transferred</th>
            </tr>
            <tr>
              <th>DOH</th>
              <th>LGU</th>
              <th>DOH</th>
              <th>LGU</th>
              <th>DOH</th>
              <th>LGU</th>
              <th>DOH</th>
              <th>LGU</th>
              <th>DOH</th>
              <th>LGU</th>
              <th>DOH</th>
              <th>LGU</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((row) =>(
              <tr key={row.key}>
                <td className="print-col-center">{row.rowNumber}</td>
                <td className="print-col-items print-col-item-name">
                  {row.itemName}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.previousDoh, { showZero: true })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.previousLgu, { showZero: true })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.receivedDoh, { showZero: true })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.receivedLgu, { showZero: true })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.transferredDoh, { showZero: true })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.transferredLgu, { showZero: true })}
                </td>
                <td className="print-col-left">
                  {renderInventoryReportCellLines(row.lotNumber)}
                </td>
                <td className="print-col-center print-col-wrap">
                  {renderInventoryReportCellLines(row.expiryDate)}
                </td>
                <td className="print-col-center print-col-wrap">
                  {renderInventoryReportCellLines(row.transactionDate)}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.monthlyConsumptionDoh, {
                    showZero: true,
                  })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.monthlyConsumptionLgu, {
                    showZero: true,
                  })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.patientsReceivedDoh, {
                    showZero: true,
                  })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.patientsReceivedLgu, {
                    showZero: true,
                  })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.endStocksDoh, { showZero: true })}
                </td>
                <td className="print-col-center">
                  {formatRisQuantityDisplay(row.endStocksLgu, { showZero: true })}
                </td>
              </tr>)
             )}
          </tbody>
        </table>
      </article>
    </section>)
   ;
};

const RequisitionIssueSlipDocumentReport = ({
  facilityInfo,
  reportDate,
  reportRows,
  controlNumber,
  dateRangeStart,
  dateRangeEnd,
  isFiltering,
  leftSealSrc = PASIG_REPORT_SEAL_SRC,
  rightSealSrc = DOH_REPORT_SEAL_SRC,
  rootClassName = "ris-print-report",
  pageClassName = "ris-print-report__page",
  reportTestId = "inventory-ris-print-report",
  headerTestId = "inventory-ris-print-header",
  periodTestId = "inventory-ris-print-period",
  tableTestId = "inventory-ris-print-table",
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

  return(
    <section className={rootClassName} data-testid={reportTestId}>
      <div className={pageClassName}>
        <div data-testid={headerTestId}>
          <table className="ris-word-header-table" role="presentation">
            <tbody>
              <tr>
                <td className="ris-word-header-table__seal-cell">
                  {leftSealSrc ?(
                    <img
                      src={leftSealSrc}
                      alt="Municipality of Pasig seal"
                      className="ris-word-header-table__seal"
                    />)
                    : null}
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
                  {rightSealSrc ?(
                    <img
                      src={rightSealSrc}
                      alt="Department of Health seal"
                      className="ris-word-header-table__seal"
                    />)
                    : null}
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
                <td className="ris-word-meta-table__value">
                  {RIS_PRIVATE_CLINIC_VALUE}
                </td>
                <td className="ris-word-meta-table__label">Year:</td>
                <td className="ris-word-meta-table__value">{reportYear}</td>
              </tr>
              <tr>
                <td className="ris-word-meta-table__label">Date:</td>
                <td className="ris-word-meta-table__value">{reportDateLabel}</td>
                <td className="ris-word-meta-table__label">Reporting Period:</td>
                <td className="ris-word-meta-table__value">
                  <span data-testid={periodTestId}>{reportingPeriod}</span>
                </td>
              </tr>
              <tr>
                <td className="ris-word-meta-table__label">Address:</td>
                <td className="ris-word-meta-table__value" colSpan={3}>
                  {address}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table
          className="ris-print-table ris-word-table"
          data-testid={tableTestId}
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
              row.type === "section" ?(
                <tr key={row.key} className="ris-print-table__section-row">
                  <td colSpan={6}>{row.description}</td>
                </tr>)
                :(
                <tr key={row.key}>
                  <td className="ris-print-table__description">
                    {row.description}
                  </td>
                  <td>{row.unit}</td>
                  <td className="ris-print-table__numeric">{row.balanceOnHand}</td>
                  <td className="ris-print-table__numeric">{row.requestQty}</td>
                  <td className="ris-print-table__numeric">{row.issuedQty}</td>
                  <td className="ris-print-table__numeric">{row.totalQty}</td>
                </tr>)
               ,
            )}
          </tbody>
        </table>
      </div>
    </section>)
   ;
};

const RequisitionIssueSlipWordReport = (props) =>(
  <RequisitionIssueSlipDocumentReport
    {...props}
    rootClassName="ris-word-report"
    pageClassName="ris-word-report__page"
    reportTestId="inventory-ris-word-report"
    headerTestId="inventory-ris-word-header"
    periodTestId="inventory-ris-word-period"
    tableTestId="inventory-ris-word-table"
  />)
 ;

const RequisitionIssueSlipPrintReport = (props) =>(
  <RequisitionIssueSlipDocumentReport
    {...props}
    rootClassName="ris-print-report"
    pageClassName="ris-print-report__page"
    reportTestId="inventory-ris-print-report"
    headerTestId="inventory-ris-print-header"
    periodTestId="inventory-ris-print-period"
    tableTestId="inventory-ris-print-table"
  />)
 ;

export default function InventoryManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const fallbackClinicId = user?.clinic_id || user?.facility_id || 1;
  const currentUserId = user?.id ?? null;
  const currentUserFirstName = String(user?.first_name || "").trim() || null;
  const currentUserLastName = String(user?.last_name || "").trim() || null;
  const currentUserUsername = String(user?.username || "").trim() || null;
  const currentUserRole =
    String(user?.role_type || user?.role || "").trim() || null;
  const currentUserEmail = String(user?.email || "").trim() || null;
  const currentUserFullName = String(user?.full_name || user?.name || "").trim() || null;
  const currentUserMiddleName = String(user?.middle_name || "").trim() || null;
  const currentUserDisplayName = useMemo(
    () => {
      const fullName = [
        currentUserFirstName,
        currentUserMiddleName,
        currentUserLastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (fullName) {
        return fullName;
      }

      return currentUserFullName || currentUserUsername || currentUserEmail;
    },
    [
      currentUserEmail,
      currentUserFirstName,
      currentUserFullName,
      currentUserLastName,
      currentUserMiddleName,
      currentUserUsername,
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
  const [stockMovementSummaryData, setStockMovementSummaryData] = useState(null);
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
  const [stockAlertWorkflowItemsPerPage, setStockAlertWorkflowItemsPerPage] =
    useState(INVENTORY_TABLE_PAGE_SIZE);
  const [stockAlertWorkflowPageInputValue, setStockAlertWorkflowPageInputValue] =
    useState("1");
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
  const [activePrintReportHtml, setActivePrintReportHtml] = useState("");
  const [selectedExportReportType, setSelectedExportReportType] = useState(
    normalizeInventoryReportType(PRINT_REPORT_TYPES.INVENTORY_SHEET),
  );
  const [selectedReportDeliveryType, setSelectedReportDeliveryType] = useState(
    INVENTORY_REPORT_DELIVERY_TYPES.PDF,
  );
  const [isGenerateReportModalOpen, setIsGenerateReportModalOpen] =
    useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const hasLoadedInventoryDataRef = useRef(false);
  const activePrintReportTypeRef = useRef(null);
  const printPageStyleRef = useRef(null);

  // Report date range
  const [reportDate, setReportDate] = useState(getTodayInventoryDateInput);
  const [reportPeriod, setReportPeriod] = useState("month");
  const [reportPeriodStartDate, setReportPeriodStartDate] = useState("");
  const [reportPeriodEndDate, setReportPeriodEndDate] = useState("");
  const reportPeriodRange = useMemo(
    () =>
      getVaccinationPeriodRange({
        period: reportPeriod,
        startDate: reportPeriodStartDate,
        endDate: reportPeriodEndDate,
        referenceDate: new Date(),
      }),
    [reportPeriod, reportPeriodStartDate, reportPeriodEndDate],
  );
  const reportPeriodRangeLabel = useMemo(
    () =>
      formatInventoryReportDateRangeLabel({
        startDate: reportPeriodRange.startDate,
        endDate: reportPeriodRange.endDate,
      }),
    [reportPeriodRange.endDate, reportPeriodRange.startDate],
  );
  const stockMovementPeriodRange = useMemo(
    () => buildStockMovementPeriodRange(stockMovementFilters),
    [stockMovementFilters],
  );
  const handleReportPeriodChange = useCallback(
    (nextPeriod) => {
      const normalizedPeriod = normalizeVaccinationPeriod(nextPeriod);
      if (normalizedPeriod === "custom") {
        const fallbackRange = getVaccinationPeriodRange({
          period: reportPeriod,
          startDate: reportPeriodStartDate,
          endDate: reportPeriodEndDate,
          referenceDate: new Date(),
        });
        setReportPeriodStartDate(fallbackRange.startDate || "");
        setReportPeriodEndDate(fallbackRange.endDate || "");
        setReportPeriod(normalizedPeriod);
        return;
      }

      setReportPeriod(normalizedPeriod);
    },
    [reportPeriod, reportPeriodEndDate, reportPeriodStartDate],
  );
  const handleReportPeriodStartDateChange = useCallback(
    (value) => {
      setReportPeriodStartDate(value);
    },
    [],
  );
  const handleReportPeriodEndDateChange = useCallback(
    (value) => {
      setReportPeriodEndDate(value);
    },
    [],
  );

  const printDateRange = usePrintDateRange({
    headerPrefix: "Reporting Period",
    fallbackLabel: "All available records",
  });
  const dateRangeStart = printDateRange.appliedStartDate;
  const dateRangeEnd = printDateRange.appliedEndDate;
  const isFiltering = printDateRange.hasAppliedDateRange;
  const syncPrintDateRange = printDateRange.syncDateRange;
  const availableReportDeliveryOptions = useMemo(
    () =>
      getAvailableInventoryReportDeliveryOptions(selectedExportReportType),
    [selectedExportReportType],
  );

  useEffect(() => {
    const startDate = inventoryDisplayFilters.startDate;
    const endDate = inventoryDisplayFilters.endDate;

    syncPrintDateRange({
      startDate,
      endDate,
      apply: Boolean(startDate && endDate),
      clearIfEmpty: true,
    });
  }, [
    inventoryDisplayFilters.endDate,
    inventoryDisplayFilters.startDate,
    syncPrintDateRange,
  ]);

  useEffect(() => {
    if (!isGenerateReportModalOpen) {
      return;
    }

    const monthRange = getVaccinationPeriodRange({
      period: "month",
      referenceDate: new Date(),
    });
    setReportPeriod("month");
    setReportPeriodStartDate(monthRange.startDate || "");
    setReportPeriodEndDate(monthRange.endDate || "");
    setReportDate(getTodayInventoryDateInput());
  }, [isGenerateReportModalOpen]);

  useEffect(() => {
    if (
      availableReportDeliveryOptions.some(
        (option) => option.value === selectedReportDeliveryType,
      )
    ) {
      return;
    }

    setSelectedReportDeliveryType(
      availableReportDeliveryOptions[0]?.value ||
        INVENTORY_REPORT_DELIVERY_TYPES.PDF,
    );
  }, [availableReportDeliveryOptions, selectedReportDeliveryType]);

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

    return(
      availableLots.find(
        (batch) =>
          resolveInventorySaveRowId(batch.batch_id || batch.inventory_id) ===
          selectedBatchId,
      ) || null)
     ;
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

      (requiresBatchSelection&&(availableLotsLoading||
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
        .map((name) =>( {
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

  const normalizeInventoryApiRows = useCallback(
    (inventoryData) => {
      let apiInventory = [];
      if (inventoryData && inventoryData.success !== undefined) {
        apiInventory = inventoryData.data || inventoryData.inventory || [];
      } else if (Array.isArray(inventoryData)) {
        apiInventory = inventoryData;
      } else if (inventoryData?.inventory) {
        apiInventory = inventoryData.inventory;
      }

      return apiInventory.map((record) =>
        normalizeInventoryRecord(record, {
          _facilityId:
            record.clinic_id || record.facility_id || fallbackClinicId,
        }),
      );
    },
    [fallbackClinicId],
  );

  const currentAppliedReportRange = useMemo(
    () => ({
      startDate: dateRangeStart,
      endDate: dateRangeEnd,
      isFiltering: Boolean(dateRangeStart && dateRangeEnd),
    }),
    [dateRangeEnd, dateRangeStart],
  );

  const generateModalReportRange = useMemo(
    () => ({
      startDate: reportPeriodRange.startDate || "",
      endDate: reportPeriodRange.endDate || "",
      isFiltering: Boolean(reportPeriodRange.startDate && reportPeriodRange.endDate),
    }),
    [reportPeriodRange.endDate, reportPeriodRange.startDate],
  );

  const buildReportPayloadForRange = useCallback(
    ({ inventorySource, reportRange, reportDateValue }) =>
      buildInventoryReportPayload({
        inventoryReportSource: inventorySource,
        liveInventoryRows: inventory,
        vaccineItems,
        fallbackClinicId,
        displayFilters: buildInventoryReportDisplayFilters(
          inventoryDisplayFilters,
          reportRange,
        ),
        facilityInfo,
        reportDate: reportDateValue,
      }),
    [
      facilityInfo,
      fallbackClinicId,
      inventory,
      inventoryDisplayFilters,
      vaccineItems,
    ],
  );

  const loadInventoryReportSourceForRange = useCallback(
    async (reportRange = {}) => {
      const inventoryQuery = {
        clinic_id: fallbackClinicId,
      };

      if (reportRange.startDate) {
        inventoryQuery.period_start = reportRange.startDate;
      }

      if (reportRange.endDate) {
        inventoryQuery.period_end = reportRange.endDate;
      }

      const inventoryData = await apiClient.getVaccineInventory(inventoryQuery);
      return normalizeInventoryApiRows(inventoryData);
    },
    [fallbackClinicId, normalizeInventoryApiRows],
  );

  const buildPrintableReportHtmlFromPayload = useCallback(
    ({
      reportType,
      reportRange,
      reportPayload,
      reportDateValue,
      deliveryType = "print",
      embeddedAssets = {},
    }) =>
      buildPrintableInventoryReportHtml({
        reportType,
        reportDate: reportDateValue,
        reportRange,
        reportPayload,
        facilityInfo,
        inventorySheetLeftLogoSrc: embeddedAssets.inventorySheetLeftLogoSrc,
        inventorySheetRightLogoSrc: embeddedAssets.inventorySheetRightLogoSrc,
        risLeftSealSrc: embeddedAssets.risLeftSealSrc,
        risRightSealSrc: embeddedAssets.risRightSealSrc,
        deliveryType,
      }),
    [facilityInfo],
  );

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
    const canUseSummaryEndpoint =
      typeof apiClient.getInventoryStockMovements === "function";
    const canUseLegacyEndpoint =
      typeof apiClient.getVaccineInventoryTransactions === "function";

    if (!canUseSummaryEndpoint && !canUseLegacyEndpoint) {
      setStockMovements([]);
      setStockMovementSummaryData(null);
      setStockMovementsError(null);
      return [];
    }

    try {
      setStockMovementsLoading(true);
      setStockMovementsError(null);
      const requestFilters = {
        clinic_id: fallbackClinicId,
        limit: 100000,
      };

      if (stockMovementPeriodRange.startDate) {
        requestFilters.start_date = stockMovementPeriodRange.startDate;
      }

      if (stockMovementPeriodRange.endDate) {
        requestFilters.end_date = stockMovementPeriodRange.endDate;
      }

      const response = canUseSummaryEndpoint
        ? await apiClient.getInventoryStockMovements(requestFilters)
        : await apiClient.getVaccineInventoryTransactions(null, requestFilters);

      let movementRows = [];
      let summarySource = null;
      if (response && response.success !== undefined) {
        if (Array.isArray(response.data)) {
          movementRows = response.data;
        } else if (Array.isArray(response.data?.movements)) {
          movementRows = response.data.movements;
        } else if (Array.isArray(response.transactions)) {
          movementRows = response.transactions;
        } else if (Array.isArray(response.data?.transactions)) {
          movementRows = response.data.transactions;
        }
        summarySource =
          response.data?.summary ??
          response.summary ??
          response.data?.data?.summary ??
          null;
      } else if (Array.isArray(response)) {
        movementRows = response;
      } else if (Array.isArray(response?.transactions)) {
        movementRows = response.transactions;
      } else if (Array.isArray(response?.movements)) {
        movementRows = response.movements;
      }

      const normalizedMovements = movementRows
        .map(normalizeInventoryMovementRecord)
        .map((movement) => {
          if (
            (movement.performed_by_name || movement.performed_by_username) ||(
             !currentUserDisplayName && !currentUserUsername)
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
      setStockMovementSummaryData(
        normalizeInventoryMovementSummary(summarySource),
      );
      setStockMovements(normalizedMovements);
      return normalizedMovements;
    } catch (movementErr) {
      console.error("Stock movement history load failed:", movementErr);
      setStockMovements([]);
      setStockMovementSummaryData(null);
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
    stockMovementPeriodRange.endDate,
    stockMovementPeriodRange.startDate,
  ]);

  // Fetch data
  const fetchData = useCallback(async ({ background = false } = {}) => {
    const shouldShowBlockingLoader =
      !background && !hasLoadedInventoryDataRef.current;

    try {
      if (shouldShowBlockingLoader) {
        setLoading(true);
      }
      setError(null);

      // Try to fetch inventory data from API
      try {
        const inventoryQuery = {
          clinic_id: fallbackClinicId,
        };

        const [inventoryData, vaccinesData] = await Promise.all([
          apiClient.getVaccineInventory(inventoryQuery),
          apiClient.getVaccines().catch(() =>( { data: [] })),
        ]);

        let apiVaccines = [];
        if (vaccinesData && vaccinesData.success !== undefined) {
          apiVaccines = vaccinesData.data || [];
        } else if (Array.isArray(vaccinesData)) {
          apiVaccines = vaccinesData;
        } else if (vaccinesData?.data) {
          apiVaccines = vaccinesData.data;
        }

        const normalizedApiInventory = normalizeInventoryApiRows(inventoryData);

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
        setInventoryReportSource(normalizedApiInventory);
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
          setFacilityInfo((prev) =>( {
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

      if (shouldShowBlockingLoader) {
        setLoading(false);
      }
      hasLoadedInventoryDataRef.current = true;
    } catch (err) {
      setError(err.message);
      if (shouldShowBlockingLoader) {
        setLoading(false);
      }
      hasLoadedInventoryDataRef.current = true;
    }
  }, [
    fallbackClinicId,
    fetchPersistedStockAlerts,
    inventoryDisplayFilters.endDate,
    inventoryDisplayFilters.startDate,
    initializeInventory,
    loadStockMovements,
    normalizeInventoryApiRows,
    vaccineItems,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Instantly sync inventory if a vaccination was recorded and deducted stock
  useEffect(() => {
    const handleSyncUpdate = () => fetchData({ background: true });

    window.addEventListener("vaccination-update", handleSyncUpdate);
    window.addEventListener("inventory-update", handleSyncUpdate);

    return () => {
      window.removeEventListener("vaccination-update", handleSyncUpdate);
      window.removeEventListener("inventory-update", handleSyncUpdate);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!showModal || !selectedItem || !requiresBatchSelection) {
      setAvailableLots((prev) =>( prev.length > 0 ? [] : prev));
      setAvailableLotsError((prev) =>( prev ? null : prev));
      setAvailableLotsLoading((prev) =>( prev ? false : prev));
      setLotSearchTerm((prev) =>( prev ? "" : prev));
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
      const existingNode = document.getElementById("inventory-print-page-style");
      const styleNode = existingNode || document.createElement("style");
      styleNode.id = "inventory-print-page-style";
      if (!existingNode) {
        document.head.appendChild(styleNode);
      }
      printPageStyleRef.current = styleNode;
    }

    const { pageCssSize, printMargin } = getInventoryReportCssPageSettings(
      reportType,
    );
    printPageStyleRef.current.textContent = `@media print { @page { size: ${pageCssSize}; margin: ${printMargin}; } }`;
  }, []);

  const clearPrintLayout = useCallback(() => {
    setIsPrintLayoutActive(false);
    setActivePrintReportType(null);
    setActivePrintReportHtml("");
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
        item.period_start,
        item.period_end,
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

    return inventoryReportSource.filter((item) =>
      matchesInventoryReportPeriodRange(item, {
        period: inventoryDisplayFilters.period,
        startDate: dateRangeStart,
        endDate: dateRangeEnd,
      }),
    );
  }, [
    inventoryDisplayFilters.period,
    inventoryReportSource,
    isFiltering,
    dateRangeEnd,
    dateRangeStart,
  ]);

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
      ...vaccineNames.map((name) =>( { value: name, label: name })),
    ];
  }, [inventory]);

  const stockMovementTypeOptions = useMemo(() => {
    const uniqueTypes = Array.from(
      new Set(
        [
          ...stockMovements.map((movement) =>
            normalizeInventoryMovementType(movement.transaction_type),
          ),
          "EXPIRE",
        ].filter(Boolean),
      ),
    ).sort((left, right) =>
      getInventoryMovementTypeMeta(left).label.localeCompare(
        getInventoryMovementTypeMeta(right).label,
      ),
    );

    return [
      { value: "all", label: "All Types" },
      ...uniqueTypes.map((type) =>( {
        value: type,
        label: getInventoryMovementTypeMeta(type).label,
      })),
    ];
  }, [stockMovements]);

  const stockMovementVaccineOptions = useMemo(() => {
    const vaccineNames = Array.from(
      new Set(
        stockMovements
          .map((movement) => normalizeInventoryDisplayVaccineName(movement?.vaccine_name))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return [
      { value: "all", label: "All Vaccines" },
      ...vaccineNames.map((name) =>( { value: name, label: name })),
    ];
  }, [stockMovements]);

  const displayedInventory = useMemo(() => {
    return filteredInventory.filter((item) => {
      const matchesDateFilter = matchesOptionalDateRange(
        [
          item.period_start,
          item.period_end,
          item.last_transaction_date,
          item.received_date,
          item.transferred_in_date,
          item.transferred_out_date,
          item.issuance_date,
          item.expiry_date,
        ],
        inventoryDisplayFilters,
      );

      return (
        matchesDateFilter &&
        matchesInventoryDisplaySelectionFilters(item, inventoryDisplayFilters)
      );
    });
  }, [filteredInventory, inventoryDisplayFilters]);

  const displayedInventoryReportSource = useMemo(() => {
    return filteredInventoryReportSource.filter((item) => {
      return matchesInventoryDisplaySelectionFilters(
        item,
        inventoryDisplayFilters,
      );
    });
  }, [filteredInventoryReportSource, inventoryDisplayFilters]);

  const currentInventoryDisplayRows = useMemo(
    () =>
      inventory.filter((item) =>
        matchesInventoryDisplaySelectionFilters(item, inventoryDisplayFilters),
      ),
    [inventory, inventoryDisplayFilters],
  );

  const currentInventoryReportDisplayRows = useMemo(
    () =>
      inventoryReportSource.filter((item) =>
        matchesInventoryDisplaySelectionFilters(item, inventoryDisplayFilters),
      ),
    [inventoryDisplayFilters, inventoryReportSource],
  );

  const inventorySheetRows = useMemo(
    () =>
      buildInventorySheetRowsWithLiveInventory({
        inventoryReportSource: displayedInventoryReportSource,
        liveInventoryRows: inventory,
        vaccineItems,
        fallbackClinicId,
        displayFilters: inventoryDisplayFilters,
      }),
    [
      displayedInventoryReportSource,
      fallbackClinicId,
      inventory,
      inventoryDisplayFilters,
      vaccineItems,
    ],
  );

  const displayedStockMovements = useMemo(() => {
    return filteredStockMovements.filter((movement) => {
      const matchesDateFilter = matchesOptionalDateRange(
        [movement.created_at, movement.transaction_date],
        stockMovementPeriodRange,
      );
      const normalizedType = normalizeInventoryMovementType(
        movement.transaction_type,
      );
      const matchesTypeFilter =
        stockMovementFilters.type === "all" ||
        normalizedType === stockMovementFilters.type;
      const matchesVaccineFilter =
        stockMovementFilters.vaccine === "all" ||
        normalizeInventoryDisplayVaccineName(movement.vaccine_name) ===
          stockMovementFilters.vaccine;

      return matchesDateFilter && matchesTypeFilter && matchesVaccineFilter;
    });
  }, [filteredStockMovements, stockMovementFilters, stockMovementPeriodRange]);

  const hasActiveInventoryDisplayFilters = useMemo(
    () => {
      const defaultFilters = createDefaultInventoryDisplayFilters();

      return (
        inventoryDisplayFilters.period !== defaultFilters.period ||
        inventoryDisplayFilters.startDate !== defaultFilters.startDate ||
        inventoryDisplayFilters.endDate !== defaultFilters.endDate ||
        inventoryDisplayFilters.vaccine !== defaultFilters.vaccine ||
        inventoryDisplayFilters.status !== defaultFilters.status
      );
    },
    [inventoryDisplayFilters],
  );

  const hasActiveStockMovementFilters = useMemo(
    () => {
      const defaultFilters = createDefaultStockMovementFilters();

      return (
        stockMovementFilters.period !== defaultFilters.period ||
        stockMovementFilters.type !== defaultFilters.type ||
        stockMovementFilters.vaccine !== defaultFilters.vaccine ||
        stockMovementFilters.customStartDate !== defaultFilters.customStartDate ||
        stockMovementFilters.customEndDate !== defaultFilters.customEndDate
      );
    },
    [stockMovementFilters],
  );

  const updateInventoryDisplayFilter = useCallback((field, value) => {
    const nextValue =
      field === "period" ? normalizeVaccinationPeriod(value) : value;

    setInventoryDisplayFilters((previous) => {
      if (field === "period") {
        if (nextValue === previous.period) {
          return previous;
        }

        if (nextValue === "custom") {
          return {
            ...previous,
            period: nextValue,
            startDate: "",
            endDate: "",
          };
        }

        const nextRange = getInventoryDisplayPeriodRange(nextValue);
        return {
          ...previous,
          period: nextValue,
          startDate: nextRange.startDate,
          endDate: nextRange.endDate,
        };
      }

      if (previous[field] === nextValue) {
        return previous;
      }

      return { ...previous, [field]: nextValue };
    });
  }, []);

  const clearInventoryDisplayFilters = useCallback(() => {
    setInventoryDisplayFilters(createDefaultInventoryDisplayFilters());
  }, []);

  const updateStockMovementFilter = useCallback((field, value) => {
    const nextValue =
      field === "period" ? normalizeVaccinationPeriod(value) : value;

    setStockMovementFilters((previous) => {
      if (previous[field] === nextValue) {
        return previous;
      }

      if (field === "period" && nextValue !== "custom") {
        return {
          ...previous,
          period: nextValue,
          customStartDate: "",
          customEndDate: "",
        };
      }

      return { ...previous, [field]: nextValue };
    });
  }, []);

  const clearStockMovementFilters = useCallback(() => {
    setStockMovementFilters(createDefaultStockMovementFilters());
  }, []);

  const trackedInventory = useMemo(
    () =>
      currentInventoryDisplayRows.filter((item) => shouldPersistInventoryRow(item)),
    [currentInventoryDisplayRows],
  );

  const inventorySummaryStats = useMemo(() => {
    const trackedReportRows = currentInventoryReportDisplayRows.filter((item) =>
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
  }, [currentInventoryReportDisplayRows, trackedInventory]);

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

  // Calculate totals from the supplied inventory rows
  const calculateTotals = useCallback((rows = displayedInventory) => {
    return rows.reduce(
      (acc, item) =>( {
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

    if ((modalType === "receive" || expiryDateInput) &&( expiryDateCheck.error || !expiryDate)) {
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
      qty >
        Number(
          selectedItem?._actionStockOnHand ?? selectedItem?.stock_on_hand ?? 0,
        )
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

      console.log('Transaction Debug Info:');
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

      console.log('Sending transaction payload:', JSON.stringify(payload, null, 2));

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
      await Promise.all([
        loadStockMovements(),
        fetchPersistedStockAlerts(),
        fetchData({ background: true }),
      ]);

      // Broadcast event so other charts and dashboards update their inventory figures instantly
      window.dispatchEvent(new CustomEvent("inventory-update"));
    } catch (err) {
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setTransactionErrors((prev) =>( {
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

  const printReport = (
    reportType = PRINT_REPORT_TYPES.INVENTORY_SHEET,
    { html = "" } = {},
  ) => {
    if (!html) {
      return;
    }

    const normalizedReportType = normalizeInventoryReportType(reportType);

    // Ensure we're on the inventory sheet tab
    if (resolvedActiveTab !== INVENTORY_DEFAULT_TAB_KEY) {
      handleTabChange(INVENTORY_DEFAULT_TAB_KEY);
    }

    setActivePrintReportHtml(html);
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
      expiring: []  // Nearly expiring (within 30 days)
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
            days_until_expiry: Math.ceil((expiryDate.getTime() - now.getTime()) /( 24 * 60 * 60 * 1000)),
          });
        }
      }
    });

    return alerts;
  }, [trackedInventory]);

  const stockAlerts = getStockAlerts();
  const currentInventoryTotals = useMemo(
    () => calculateTotals(currentInventoryDisplayRows),
    [calculateTotals, currentInventoryDisplayRows],
  );
  const stockMovementSummary = useMemo(
    () => stockMovementSummaryData || summarizeStockMovements(stockMovements),
    [stockMovementSummaryData, stockMovements],
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
  const stockAlertWorkflowRowsPerPageOptions = useMemo(
    () => buildInventoryRowsPerPageOptions(INVENTORY_TABLE_PAGE_SIZE),
    [],
  );
  const stockAlertWorkflowTotalPages = Math.max(
    1,
    Math.ceil(persistedStockAlerts.length / stockAlertWorkflowItemsPerPage),
  );
  const paginatedPersistedStockAlerts = useMemo(() => {
    const startIndex =
      (stockAlertWorkflowPage - 1) * stockAlertWorkflowItemsPerPage;
    return persistedStockAlerts.slice(
      startIndex,
      startIndex + stockAlertWorkflowItemsPerPage,
    );
  }, [
    persistedStockAlerts,
    stockAlertWorkflowItemsPerPage,
    stockAlertWorkflowPage,
  ]);

  useEffect(() => {
    setStockAlertWorkflowPage(1);
    setStockAlertWorkflowPageInputValue("1");
  }, [persistedStockAlerts]);

  useEffect(() => {
    setStockAlertWorkflowPageInputValue(String(stockAlertWorkflowPage || 1));
  }, [stockAlertWorkflowPage]);

  const handleStockAlertWorkflowPageJumpSubmit = useCallback(() => {
    const nextPage = Number.parseInt(stockAlertWorkflowPageInputValue, 10);
    if (!Number.isFinite(nextPage)) {
      setStockAlertWorkflowPageInputValue(String(stockAlertWorkflowPage || 1));
      return;
    }

    const clampedPage = Math.min(
      Math.max(nextPage, 1),
      stockAlertWorkflowTotalPages,
    );
    setStockAlertWorkflowPage(clampedPage);
    setStockAlertWorkflowPageInputValue(String(clampedPage));
  }, [
    stockAlertWorkflowPage,
    stockAlertWorkflowPageInputValue,
    stockAlertWorkflowTotalPages,
  ]);

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
          response?.message ||(
           pendingBulkStockAlertAction.action === "acknowledge"
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

    return(
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

        {stockAlertFeedback &&(
          <Alert
            variant={stockAlertFeedback.variant}
            className="mt-4"
          >
            {stockAlertFeedback.message}
          </Alert>)
         }

        {stockAlertLoadError &&(
          <Alert variant="error" className="mt-4">
            {stockAlertLoadError}
          </Alert>)
         }

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
              {paginatedPersistedStockAlerts.map((alert) =>(
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
                </tr>)
               )}
            </tbody>
          </table>

          {!stockAlertsLoading && persistedStockAlerts.length === 0 &&(
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No persisted stock alerts are currently tracked for this facility.
            </div>)
           }

          {stockAlertsLoading &&(
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Refreshing stock alert statuses...
            </div>)
           }
        </div>
        <InventoryPaginationFooter
          testId="inventory-summary-workflow-pagination"
          className="-mx-4 -mb-4 mt-4"
          currentPage={stockAlertWorkflowPage}
          itemsPerPage={stockAlertWorkflowItemsPerPage}
          totalItems={persistedStockAlerts.length}
          itemLabel="alerts"
          rowsPerPageOptions={stockAlertWorkflowRowsPerPageOptions}
          pageInputId="inventory-summary-workflow-page-jump"
          pageInputValue={stockAlertWorkflowPageInputValue}
          onRowsPerPageChange={(event) => {
            const nextPageSize =
              Number(event.target.value) || INVENTORY_TABLE_PAGE_SIZE;
            setStockAlertWorkflowItemsPerPage(nextPageSize);
            setStockAlertWorkflowPage(1);
            setStockAlertWorkflowPageInputValue("1");
          }}
          onPageInputChange={(event) =>
            setStockAlertWorkflowPageInputValue(event.target.value)
          }
          onPageInputKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleStockAlertWorkflowPageJumpSubmit();
            }
          }}
          onPageJumpSubmit={handleStockAlertWorkflowPageJumpSubmit}
          onPrevious={() =>
            setStockAlertWorkflowPage((page) => Math.max(1, page - 1))
          }
          onNext={() =>
            setStockAlertWorkflowPage((page) =>
              Math.min(stockAlertWorkflowTotalPages, page + 1),
            )
          }
        />
      </Card>)
     ;
  };

  // Use the currently displayed inventory rows for report generation/export
  const printRows = useMemo(
    () => buildInventoryPrintRows(inventorySheetRows),
    [inventorySheetRows],
  );

  const printTotals = useMemo(
    () => buildInventoryPrintTotals(printRows),
    [printRows],
  );

  const dohLguReportRows = useMemo(
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

  const currentPageReportPayload = useMemo(
    () => ({
      inventoryReportSource: displayedInventoryReportSource,
      inventorySheetRows,
      printRows,
      printTotals,
      dohLguReportRows,
      risReportRows,
      risControlNumber,
    }),
    [
      displayedInventoryReportSource,
      inventorySheetRows,
      printRows,
      printTotals,
      dohLguReportRows,
      risControlNumber,
      risReportRows,
    ],
  );

  const downloadSelectedPdf = async (
    reportTypeOverride,
    {
      reportRange = currentAppliedReportRange,
      reportPayload = currentPageReportPayload,
      reportDateValue = reportDate,
    } = {},
  ) => {
    const reportType = normalizeInventoryReportType(
      typeof reportTypeOverride === "string"
        ? reportTypeOverride
        : selectedExportReportType,
    );

    try {
      const isRangeFiltered = Boolean(
        reportRange.startDate || reportRange.endDate,
      );
      const safeReportDate = reportDateValue || getTodayInventoryDateInput();

      if (reportType === PRINT_REPORT_TYPES.INVENTORY_SHEET) {
        await exportInventorySheetPdf({
          facilityInfo,
          reportDate: reportDateValue,
          printRows: reportPayload.printRows || [],
          printTotals:
            reportPayload.printTotals ||
            buildInventoryPrintTotals(reportPayload.printRows || []),
          dateRangeStart: reportRange.startDate,
          dateRangeEnd: reportRange.endDate,
          isFiltering: isRangeFiltered,
        });
        return;
      }

      if (reportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM) {
        await exportDohLguInventoryPdf({
          facilityInfo,
          reportDate: reportDateValue,
          reportRows:
            reportPayload.dohLguReportRows ||
            buildDohLguReportRows(reportPayload.inventoryReportSource || []),
          dateRangeStart: reportRange.startDate,
          dateRangeEnd: reportRange.endDate,
          isFiltering: isRangeFiltered,
        });
        return;
      }

      if (reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
        await exportRisPdf({
          facilityInfo,
          reportDate: reportDateValue,
          reportRows: reportPayload.risReportRows || [],
          controlNumber: reportPayload.risControlNumber,
          dateRangeStart: reportRange.startDate,
          dateRangeEnd: reportRange.endDate,
          isFiltering: isRangeFiltered,
        });
        return;
      }

      const embeddedAssets =
        reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
          ? {
              risLeftSealSrc:
                (await loadImageDataUrl(PASIG_REPORT_SEAL_SRC)) ||
                PASIG_REPORT_SEAL_SRC,
              risRightSealSrc:
                (await loadImageDataUrl(DOH_REPORT_SEAL_SRC)) || DOH_REPORT_SEAL_SRC,
            }
          : {
              inventorySheetLeftLogoSrc:
                (await loadImageDataUrl(INVENTORY_SHEET_LEFT_LOGO_SRC)) ||
                INVENTORY_SHEET_LEFT_LOGO_SRC,
              inventorySheetRightLogoSrc:
                (await loadImageDataUrl(INVENTORY_SHEET_RIGHT_LOGO_SRC)) ||
                INVENTORY_SHEET_RIGHT_LOGO_SRC,
            };

      const html = buildPrintableReportHtmlFromPayload({
        reportType,
        reportRange,
        reportPayload,
        reportDateValue,
        deliveryType: "pdf",
        embeddedAssets,
      });
      const filename =
        reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
          ? `${RIS_REPORT_FILENAME_PREFIX}-${safeReportDate}.pdf`
          : `inventory-sheet-${safeReportDate}.pdf`;
      const fallbackExport = async () => {
        if (reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP) {
          await exportRisPdf({
            facilityInfo,
            reportDate: reportDateValue,
            reportRows: reportPayload.risReportRows || [],
            controlNumber: reportPayload.risControlNumber,
            dateRangeStart: reportRange.startDate,
            dateRangeEnd: reportRange.endDate,
            isFiltering: isRangeFiltered,
          });
          return;
        }

        await exportInventorySheetPdf({
          facilityInfo,
          reportDate: reportDateValue,
          printRows: reportPayload.printRows || [],
          printTotals:
            reportPayload.printTotals ||
            buildInventoryPrintTotals(reportPayload.printRows || []),
          dateRangeStart: reportRange.startDate,
          dateRangeEnd: reportRange.endDate,
          isFiltering: isRangeFiltered,
        });
      };

      await exportInventoryPdfFromHtml({
        html,
        filename,
        reportType,
        fallbackExport,
      });
      return;
    } catch (pdfError) {
      setError(
        pdfError?.message || "Failed to generate the selected PDF report.",
      );
    }
  };

  const downloadSelectedWord = useCallback(async (
    reportTypeOverride,
    {
      reportRange = currentAppliedReportRange,
      reportPayload = currentPageReportPayload,
      reportDateValue = reportDate,
    } = {},
  ) => {
    const reportType = normalizeInventoryReportType(
      typeof reportTypeOverride === "string"
        ? reportTypeOverride
        : selectedExportReportType,
    );

    try {
      const embeddedAssets =
        reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
          ? {
              risLeftSealSrc:
                (await loadImageDataUrl(PASIG_REPORT_SEAL_SRC)) ||
                PASIG_REPORT_SEAL_SRC,
              risRightSealSrc:
                (await loadImageDataUrl(DOH_REPORT_SEAL_SRC)) || DOH_REPORT_SEAL_SRC,
            }
          : {
              inventorySheetLeftLogoSrc:
                (await loadImageDataUrl(INVENTORY_SHEET_LEFT_LOGO_SRC)) ||
                INVENTORY_SHEET_LEFT_LOGO_SRC,
              inventorySheetRightLogoSrc:
                (await loadImageDataUrl(INVENTORY_SHEET_RIGHT_LOGO_SRC)) ||
                INVENTORY_SHEET_RIGHT_LOGO_SRC,
            };

      const html = buildPrintableReportHtmlFromPayload({
        reportType,
        reportRange,
        reportPayload,
        reportDateValue,
        deliveryType: "word",
        embeddedAssets,
      });
      const safeReportDate = reportDateValue || getTodayInventoryDateInput();

      downloadWordDocument({
        html,
        filename:
          reportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM
            ? `${DOH_LGU_REPORT_FILENAME_PREFIX}-${safeReportDate}.docx`
            : reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
              ? `${RIS_REPORT_FILENAME_PREFIX}-${safeReportDate}.docx`
              : `inventory-sheet-${safeReportDate}.docx`,
        title:
          reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
            ? PRINT_REPORT_COPY.risTitle
            : reportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM
              ? PRINT_REPORT_COPY.dohLguTitle
            : PRINT_REPORT_COPY.inventorySheetTitle,
        headerText: "",
        footerText:
          reportType === PRINT_REPORT_TYPES.REQUISITION_ISSUE_SLIP
            ? "Requisition and issue slip"
            : "",
        page: getInventoryReportWordPagePreset(reportType),
      });
      return;
    } catch (wordError) {
      setError(
        wordError?.message || "Failed to generate the selected Word document.",
      );
    }
  }, [
    buildPrintableReportHtmlFromPayload,
    currentAppliedReportRange,
    currentPageReportPayload,
    reportDate,
    selectedExportReportType,
  ]);

  const handleGenerateReportFromModal = async () => {
    const selectedReportType = normalizeInventoryReportType(
      selectedExportReportType,
    );
    const selectedDeliveryType = selectedReportDeliveryType;

    const rangeValidation = validatePrintDateRange({
      startDate: generateModalReportRange.startDate,
      endDate: generateModalReportRange.endDate,
      requireBothDates: true,
    });
    if (!rangeValidation.isValid) {
      setError(
        reportPeriod === "custom"
          ? "Select both From Date and To Date before generating the report."
          : rangeValidation.error,
      );
      return;
    }

    try {
      setIsGeneratingReport(true);
      setError(null);

      const usesCurrentInventoryReportSource =
        selectedReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET ||
        selectedReportType === PRINT_REPORT_TYPES.DOH_LGU_STOCK_FORM;
      const reportInventorySource = usesCurrentInventoryReportSource
        ? inventoryReportSource
        : await loadInventoryReportSourceForRange(generateModalReportRange);
      const payloadFilterRange = usesCurrentInventoryReportSource
        ? generateModalReportRange
        : { startDate: "", endDate: "", isFiltering: false };
      const reportPayload = buildReportPayloadForRange({
        inventorySource: reportInventorySource,
        reportRange: payloadFilterRange,
        reportDateValue: reportDate,
      });

      setIsGenerateReportModalOpen(false);

      if (selectedDeliveryType === INVENTORY_REPORT_DELIVERY_TYPES.PDF) {
        await downloadSelectedPdf(selectedReportType, {
          reportRange: generateModalReportRange,
          reportPayload,
          reportDateValue: reportDate,
        });
        return;
      }

      if (selectedDeliveryType === INVENTORY_REPORT_DELIVERY_TYPES.WORD) {
        await downloadSelectedWord(selectedReportType, {
          reportRange: generateModalReportRange,
          reportPayload,
          reportDateValue: reportDate,
        });
        return;
      }

      const html = buildPrintableReportHtmlFromPayload({
        reportType: selectedReportType,
        reportRange: generateModalReportRange,
        reportPayload,
        reportDateValue: reportDate,
        deliveryType: "print",
      });

      setTimeout(() => {
        printReport(selectedReportType, { html });
      }, 0);
    } catch (reportGenerationError) {
      setError(
        reportGenerationError?.message ||
          "Failed to prepare the selected inventory report.",
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const activePrintReportMarkup =
    isPrintLayoutActive && activePrintReportHtml ? (
      <InventoryStaticHtmlReport html={activePrintReportHtml} />
    ) : null;

  if (loading) {
    return(
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="large" />
      </div>)
     ;
  }

  if (error) {
    return(
      <div className="p-6">
        <Alert variant="danger" onDismiss={() => setError(null)}>
          {error}
        </Alert>
        <Button onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>)
     ;
  }

  const totals = calculateTotals(inventorySheetRows);
  const inventoryToolbarReportingPeriod = printDateRange.hasAppliedDateRange ? (
    <div
      className="inline-flex min-h-[40px] items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
      data-testid="inventory-sheet-reporting-period-chip"
    >
      {printDateRange.activeDateRangeLabel}
    </div>
  ) : null;
  const inventorySummaryToolbarStats = [
    {
      key: "vaccines",
      label: "Vaccines",
      value: inventorySummaryStats.total_items,
      className:
        "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-700/60 dark:text-gray-100",
    },
    {
      key: "beginning",
      label: "Beginning",
      value: totals.beginning_balance,
      className:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    {
      key: "received",
      label: "Received",
      value: totals.received,
      className:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
    {
      key: "issued",
      label: "Issued",
      value: totals.issuance,
      className:
        "border-yellow-200 bg-yellow-50 text-orange-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-orange-300",
    },
    {
      key: "on-hand",
      label: "On Hand",
      value: currentInventoryTotals.stock_on_hand,
      className:
        "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    },
    {
      key: "expired-lots",
      label: "Expired Lots",
      value: inventorySummaryStats.expired_items,
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
    },
  ].map((stat) => (
    <div
      key={stat.key}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 ${stat.className}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
        {stat.label}
      </span>
      <span className="text-xs font-bold whitespace-nowrap">
        {Number(stat.value || 0).toLocaleString()}
      </span>
    </div>
  ));

  return(
    <div
      className="inventory-management flex h-full min-h-0 flex-col gap-4 overflow-y-auto modern-scrollbar p-4"
      data-active-tab={resolvedActiveTab}
    >
      <div
        className="sticky top-0 z-20 space-y-4 bg-gray-50/95 pb-2 backdrop-blur dark:bg-gray-900/95 print:hidden"
        data-testid="inventory-sticky-shell"
      >
        <PageHeader
          title="Vaccine Inventory Management"
          subtitle="Paper-based inventory tracking system for vaccinations"
          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-xl sm:rounded-2xl text-white shadow-lg w-full border-0"
          actions={
            <InventoryHeaderTabs
              activeTab={resolvedActiveTab}
              onTabChange={handleTabChange}
              criticalAlertCount={stockAlerts.critical.length}
            />
          }
        />

        <div className="mt-4 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
          <div className="flex flex-wrap items-end gap-3">
            <div className="hidden" hidden aria-hidden="true">
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
            <span>Inventory Summary</span>
            {stockAlerts.critical.length > 0 &&(
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full">
                {stockAlerts.critical.length}
              </span>)
             }
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
              inventoryLeadingContent={
                resolvedActiveTab === "inventory_sheet"
                  ? inventoryToolbarReportingPeriod
                  : null
              }
              inventoryTrailingContent={
                resolvedActiveTab === "inventory_summary"
                  ? inventorySummaryToolbarStats
                  : null
              }
              stockMovementFilters={stockMovementFilters}
              stockMovementTypeOptions={stockMovementTypeOptions}
              stockMovementVaccineOptions={stockMovementVaccineOptions}
              onStockMovementFilterChange={updateStockMovementFilter}
              onClearStockMovementFilters={clearStockMovementFilters}
              hasActiveStockMovementFilters={hasActiveStockMovementFilters}
              onSaveInventory={
                resolvedActiveTab === "inventory_sheet"
                  ? handleSaveInventorySheet
                  : undefined
              }
              onGenerateReport={() => {
                setSelectedReportDeliveryType(
                  INVENTORY_REPORT_DELIVERY_TYPES.PDF,
                );
                setIsGenerateReportModalOpen(true);
              }}
              showDivider={false}
            />
          </div>
        </div>

      </div>

      {activePrintReportMarkup ?(
        <InventoryPrintPortal>{activePrintReportMarkup}</InventoryPrintPortal>)
        : null}

      {resolvedActiveTab === "inventory_sheet" &&(
        <section
          id={INVENTORY_TAB_PANEL_IDS.inventory_sheet}
          data-testid="inventory-sheet-panel"
          className="inventory-sheet-print-area space-y-3 print:space-y-1"
        >
          <div className="hidden" hidden aria-hidden="true">
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

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveInventorySheet}
                className="gap-2 mr-2"
              >
Save Inventory
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
                      className="sticky top-0 z-10 w-16 border border-black bg-gray-100 px-2 py-1 text-center font-bold dark:border-gray-500 dark:bg-gray-700"
                    >
                      Expiry
                      <br />
                      Date
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
                  {inventorySheetRows.length === 0 ?(
                    <tr className="bg-white dark:bg-gray-800">
                      <td
                        colSpan={14}
                        className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 print:text-gray-700"
                      >
                        No inventory rows match the selected filters.
                      </td>
                    </tr>)
                    :
                                          (inventorySheetRows.map((item, index) =>( 
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
                        <div className="w-full text-center text-sm text-gray-900 dark:text-gray-100 py-1">
                          {item.expiry_date ? formatInventoryReportDate(item.expiry_date) : "---"}
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
                    </tr>)
                     ))
                   }
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
        </section>)
       }

      {resolvedActiveTab === "inventory_summary" &&(
        <section
          id={INVENTORY_TAB_PANEL_IDS.inventory_summary}
          data-testid="inventory-summary-panel"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div
            className="modern-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
            data-testid="inventory-summary-scroll-region"
          >
            <div
              className="sticky top-0 z-20 bg-gray-50/95 pb-4 backdrop-blur dark:bg-gray-900/95"
              data-testid="inventory-summary-alert-cards-sticky"
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    Critical threshold
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
                    Low threshold
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

              <Card className="p-3 border-l-4 border-orange-500 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Wasted / Expired
                  </p>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {currentInventoryTotals.expired_wasted.toLocaleString()}
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

            {(stockAlerts.critical.length > 0 ||
              stockAlerts.low.length > 0 ||
              stockAlerts.wasted.length > 0) &&(
              <Card className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
              {stockAlerts.critical.length > 0 &&(
                <div className="mb-4">
                  <h3 className="text-sm font-semibold px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-l-4 border-red-500">
                    Critical Stock
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
                        {stockAlerts.critical.map((item) =>(
                          <tr key={item.id} className="dark:bg-gray-800/50">
                            <td className="px-3 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {item.name}
                            </td>
                            <td className="px-3 py-1 text-center text-sm font-bold text-red-600 dark:text-red-400">
                              {item.stock_on_hand}
                            </td>
                            <td className="px-3 py-1 text-center">
                              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded text-xs">
                                {Number(item.stock_on_hand || 0) <= 0
                                  ? "OUT OF STOCK"
                                  : "CRITICAL"}
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
                          </tr>)
                         )}
                      </tbody>
                    </table>
                  </div>
                </div>)
               }

              {stockAlerts.low.length > 0 &&(
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
                        {stockAlerts.low.map((item) =>(
                          <tr key={item.id} className="dark:bg-gray-800/50">
                            <td className="px-3 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {item.name}
                            </td>
                            <td className="px-3 py-1 text-center text-sm font-bold text-yellow-600 dark:text-yellow-400">
                              {item.stock_on_hand}
                            </td>
                            <td className="px-3 py-1 text-center text-sm text-gray-700 dark:text-gray-300">
                              {item.low_stock_threshold || 10}
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
                          </tr>)
                         )}
                      </tbody>
                    </table>
                  </div>
                </div>)
               }

              {stockAlerts.wasted.length > 0 &&(
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
                        {stockAlerts.wasted.map((item) =>(
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
                          </tr>)
                         )}
                      </tbody>
                    </table>
                  </div>
                </div>)
               }
              </Card>)
             }

            {stockAlerts.critical.length === 0 &&
              stockAlerts.low.length === 0 &&
              stockAlerts.wasted.length === 0 &&(
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
                </Card>)
               }
          </div>
        </section>)
       }

      {resolvedActiveTab === "stock_movements" &&(
        <section
          id={INVENTORY_TAB_PANEL_IDS.stock_movements}
          data-testid="inventory-stock-movements-panel"
          className="flex min-h-0 flex-1 flex-col"
        >
          <StockMovementsPanel
            movements={displayedStockMovements}
            summaryOverride={hasActiveStockMovementFilters ? null : stockMovementSummary}
            loading={stockMovementsLoading}
            error={stockMovementsError}
            onRetry={loadStockMovements}
          />
        </section>)
       }

      <Modal
        isOpen={isGenerateReportModalOpen}
        onClose={() => {
          if (!isGeneratingReport) {
            setIsGenerateReportModalOpen(false);
          }
        }}
        title="Generate Report"
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => setIsGenerateReportModalOpen(false)}
              disabled={isGeneratingReport}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleGenerateReportFromModal}
              loading={isGeneratingReport}
              disabled={isGeneratingReport}
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
              options={availableReportDeliveryOptions}
            />
          </div>

          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="max-w-sm">
                  <VaccinationPeriodFilter
                    period={reportPeriod}
                    startDate={reportPeriodStartDate}
                    endDate={reportPeriodEndDate}
                    onPeriodChange={handleReportPeriodChange}
                    onStartDateChange={handleReportPeriodStartDateChange}
                    onEndDateChange={handleReportPeriodEndDateChange}
                    startDateLabel="From Date"
                    endDateLabel="To Date"
                    layout="stacked"
                  />
                </div>
                <div className="max-w-[220px]">
                  <Input
                    label="Report Date"
                    aria-label="Report Date"
                    type="date"
                    value={reportDate}
                    onChange={(event) => setReportDate(event.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedExportReportType === PRINT_REPORT_TYPES.INVENTORY_SHEET
                    ? "Inventory Sheet header and footer labels follow the selected reporting period."
                    : "Report Date only controls the printed header label."}
                </p>
              </div>
              <div className="flex flex-col justify-end">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Date Range
                </p>
                <div className="flex min-h-[40px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {reportPeriodRangeLabel}
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Based on the selected reporting period
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Reports use the selected period together with the active vaccine and
            status filters already applied on the Inventory Sheet tab.
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
            {selectedItem &&(
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
Vaccine Information
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {selectedItem.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Current Stock:{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedItem._actionStockOnHand ?? selectedItem.stock_on_hand}
                  </span>
                </p>
              </div>
            </div>)
           }

          {transactionSubmitError &&(
            <Alert variant="error" className="mb-3">
              {transactionSubmitError}
            </Alert>)
           }

          {hasFieldErrors(transactionErrors) &&(
            <Alert variant="error" className="mb-3">
              Please resolve the highlighted transaction form errors before
              submitting.
            </Alert>)
           }

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
                    setTransactionErrors((prev) =>( {
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
                    setTransactionErrors((prev) =>( {
                      ...prev,
                      date: undefined,
                    }));
                  }}
                  required
                  error={transactionErrors.date}
                  className="w-full"
                />
              </div>

              {modalType === "receive" &&(
                <>
                  <div className="admin-field-group">
                    <Input
                      label="Lot/Batch #"
                      type="text"
                      value={formData.lot_number || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, lot_number: e.target.value });
                        setTransactionErrors((prev) =>( {
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
                        setTransactionErrors((prev) =>( {
                          ...prev,
                          expiry_date: undefined,
                        }));
                      }}
                      required
                      error={transactionErrors.expiry_date}
                      className="w-full"
                    />
                  </div>
                </>)
               }
              {requiresBatchSelection &&(
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
                      setFormData((prev) =>( {
                        ...prev,
                        batch_id: "",
                        lot_number: "",
                        expiry_date: "",
                      }));
                      setTransactionErrors((prev) =>( {
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
                    {availableLotsLoading ?(
                      <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Loading available lot/batch records...
                      </div>)
                      : filteredAvailableLots.length > 0 ?(
                      <div className="max-h-56 overflow-y-auto modern-scrollbar">
                        {filteredAvailableLots.map((batch) => {
                          const isSelected =
                            resolveInventorySaveRowId(
                              batch.batch_id || batch.inventory_id,
                            ) ===
                            resolveInventorySaveRowId(formData.batch_id);

                          return(
                            <button
                              key={batch.batch_id || batch.inventory_id}
                              type="button"
                              onClick={() => {
                                setLotSearchTerm(batch.lot_number || "");
                                setFormData((prev) =>( {
                                  ...prev,
                                  batch_id:
                                    batch.batch_id || batch.inventory_id || "",
                                  lot_number: batch.lot_number || "",
                                  expiry_date: batch.expiry_date || "",
                                }));
                                setTransactionErrors((prev) =>( {
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
                                {batch.storage_location &&(
                                  <span>Storage: {batch.storage_location}</span>)
                                 }
                              </div>
                            </button>)
                           ;
                        })}
                      </div>)
                      :(
                      <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {availableLotsError ||
                          "No selectable lot/batch records match the current search."}
                      </div>)
                     }
                  </div>

                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Only active, non-expired lot/batch records with available stock
                    can be selected.
                  </p>

                  {selectedBatchOption && batchStockPreview &&(
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
                    </div>)
                   }
                </div>)
               }
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {modalType === "waste" ? "Reason for Waste" : "Notes"}
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => {
                setFormData({ ...formData, notes: e.target.value });
                setTransactionErrors((prev) =>( {
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
          {transactionErrors.notes &&(
              <span className="admin-field-error">{transactionErrors.notes}</span>)
             }
          </div>
        </form>
      </Modal>

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
          body.printing-inventory .inventory-sheet-summary-print-table,
          body.printing-inventory #doh-lgu-print-table,
          body.printing-inventory .ris-print-table {
            table-layout: fixed !important;
          }

          body.printing-inventory #doh-lgu-print-table th,
          body.printing-inventory #doh-lgu-print-table td,
          body.printing-inventory .ris-print-table th,
          body.printing-inventory .ris-print-table td {
            font-size: 9pt !important;
            word-break: keep-all !important;
            white-space: nowrap !important;
            overflow-wrap: normal !important;
          }

          body.printing-inventory .inventory-sheet-summary-print-table th,
          body.printing-inventory .inventory-sheet-summary-print-table td {
            font-size: 7.7pt !important;
            line-height: 1.12 !important;
            padding: 0.045cm 0.05cm !important;
            word-break: keep-all !important;
            white-space: nowrap !important;
            overflow-wrap: normal !important;
          }

          :root {
            --inventory-print-page-width: calc(14in - 0.7cm);
            --inventory-print-page-height: calc(8.5in - 0.7cm);
          }

          body.printing-inventory.printing-report-requisition-issue-slip {
            --inventory-print-page-width: calc(8.5in - 0.7cm);
            --inventory-print-page-height: calc(14in - 0.7cm);
          }

          body.printing-inventory.printing-report-inventory-sheet {
            --inventory-print-page-width: calc(14in - 0.5cm);
            --inventory-print-page-height: calc(8.5in - 0.5cm);
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
            margin: 0 auto !important;
            padding: 0.16in !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }

          body.printing-inventory.printing-report-inventory-sheet #inventory-print-root {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: 0.08in 0.12in 0.1in !important;
          }

          body.printing-inventory.printing-report-doh-lgu-stock-form #inventory-print-root {
            padding: 0.08in 0.1in 0.1in !important;
          }

          body.printing-inventory.printing-report-requisition-issue-slip #inventory-print-root {
            padding: 0.1in 0.12in 0.12in !important;
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

          body.printing-inventory.printing-report-inventory-sheet .inventory-sheet-summary-print-report {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }

          .inventory-sheet-summary-print-report__page,
          .doh-lgu-stock-print-report__page,
          .ris-word-report {
    width: 100%;
  }

  .inventory-sheet-summary-print-report__page {
    max-width: ${INVENTORY_SHEET_FRAME_MAX_WIDTH};
    margin: 0 auto;
    padding: 0.03in 0;
    display: flex;
    justify-content: center;
  }

  .inventory-sheet-summary-print-report__surface {
    width: 100%;
    max-width: ${INVENTORY_SHEET_SURFACE_MAX_WIDTH};
    margin: 0 auto;
    padding: 0.18in 0.22in 0.16in;
    border: 1.45px solid #111827;
    background: #ffffff;
    box-sizing: border-box;
  }

  .inventory-sheet-summary-print-report__table-wrap {
    width: 100%;
    margin: 0.12in auto 0;
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
            width: 100% !important;
            max-width: ${INVENTORY_SHEET_FRAME_MAX_WIDTH} !important;
            min-height: calc(var(--inventory-print-page-height) - 0.05in) !important;
            margin: 0 auto 0.08in !important;
            padding: 0.03in 0 !important;
            display: flex !important;
            justify-content: center !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .inventory-sheet-summary-print-report__page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .doh-lgu-stock-print-report__page {
            width: min(calc(100% - 0.08in), var(--inventory-print-page-width)) !important;
            max-width: var(--inventory-print-page-width) !important;
            min-height: calc(var(--inventory-print-page-height) - 0.05in) !important;
            margin: 0 auto 0.08in !important;
            padding: 0.04in 0.06in 0.08in !important;
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
            width: min(calc(100% - 0.12in), 8.14in) !important;
            max-width: 8.14in !important;
            min-height: calc(var(--inventory-print-page-height) - 0.05in) !important;
            margin: 0 auto 0.08in !important;
            padding: 0.12in 0.14in 0.14in !important;
            border: 1.5px solid #111827 !important;
          }

          .inventory-sheet-summary-print-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 0.04cm !important;
            text-align: center !important;
            width: 100% !important;
            margin: 0 auto 0.36in !important;
            padding: 0 0 0.22in !important;
            border-bottom: 1.35px solid #cbd5e1 !important;
            color: #0f172a !important;
          }

          .inventory-sheet-summary-print-header__line {
            margin: 0 !important;
            line-height: 1.24 !important;
            letter-spacing: 0.01em !important;
          }

          .inventory-sheet-summary-print-header__line--primary {
            font-size: 13.6px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.014em !important;
          }

          .inventory-sheet-summary-print-header__line--department {
            font-size: 10.8px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.012em !important;
          }

          .inventory-sheet-summary-print-header__line--title {
            margin-top: 0.01cm !important;
            font-size: 10.4px !important;
            font-weight: 800 !important;
            text-transform: none !important;
          }

          .inventory-sheet-summary-print-header__line--supporting {
            margin-top: 0 !important;
            font-size: 9.2px !important;
            font-weight: 600 !important;
            text-transform: none !important;
            color: #334155 !important;
          }

          .inventory-sheet-summary-print-header__line--label {
            margin-top: 0.04cm !important;
            font-size: 9.2px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.012em !important;
          }

          .inventory-sheet-summary-print-header__line--facility {
            margin-top: 0 !important;
            font-size: 11.4px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.01em !important;
          }

          .inventory-sheet-summary-print-header__line--inventory {
            margin-top: 0.02cm !important;
            font-size: 9.8px !important;
            font-weight: 700 !important;
            text-transform: none !important;
          }

          .inventory-sheet-summary-print-header__detail-row {
            display: grid !important;
            grid-template-columns: minmax(1.7in, auto) minmax(0, 1fr) minmax(2.6in, auto) !important;
            width: 100% !important;
            align-items: end !important;
            gap: 0.26in !important;
            margin: 0.16in auto 0 !important;
            padding-top: 0.14in !important;
            border-top: 1px solid #e2e8f0 !important;
          }

          .inventory-sheet-summary-print-header__detail {
            display: inline-flex !important;
            align-items: center !important;
            gap: 0.08in !important;
            min-width: 0 !important;
            font-size: 9.2px !important;
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
            margin: 0 auto !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            font-size: 10.8px !important;
            line-height: 1.22 !important;
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
            padding: 0.16cm 0.1cm !important;
            vertical-align: middle !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          .inventory-sheet-summary-print-table th {
            font-size: 10.3px !important;
            font-weight: 800 !important;
            text-transform: none !important;
            text-align: center !important;
            letter-spacing: 0.01em !important;
            color: #111827 !important;
          }

          .inventory-sheet-summary-print-table td {
            font-size: 10.7px !important;
            min-height: 0.68cm !important;
            line-height: 1.18 !important;
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

          .inventory-sheet-summary-print-header__branding {
            display: grid !important;
            grid-template-columns: 1.16in minmax(0, 1fr) 1.16in !important;
            align-items: center !important;
            gap: 0.32in !important;
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
            width: 1in !important;
            height: 1in !important;
            object-fit: contain !important;
            background: transparent !important;
          }

          .inventory-sheet-summary-print-header__logo--circle {
            border-radius: 9999px !important;
            clip-path: circle(50% at 50% 50%) !important;
          }

          .inventory-sheet-summary-print-header__line--government {
            margin-bottom: 0.05in !important;
            font-size: 9.4px !important;
          }

          .inventory-sheet-summary-print-header__line--title {
            margin-top: 0.03in !important;
            font-size: 10.4px !important;
            text-transform: none !important;
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

          .inventory-sheet-summary-print-footer {
            width: 100% !important;
            margin: 0.2in auto 0 !important;
            padding-top: 0.14in !important;
            border-top: 1px solid #d7deea !important;
            text-align: center !important;
            font-size: 8.2px !important;
            line-height: 1.2 !important;
            color: #475569 !important;
          }

          .doh-lgu-stock-print-header {
            display: block !important;
            text-align: center !important;
            margin: 0 !important;
            padding: 0.08cm 0.1cm 0.02cm !important;
            border-bottom: none !important;
            color: #0f172a !important;
          }

          .doh-lgu-stock-print-header__line {
            margin: 0 !important;
            line-height: 1.2 !important;
            letter-spacing: 0.008em !important;
          }

          .doh-lgu-stock-print-header__line--government {
            font-size: 9.4px !important;
            margin-bottom: 0.05cm !important;
          }

          .doh-lgu-stock-print-header__branding {
            display: grid !important;
            grid-template-columns: 0.72in minmax(0, 1fr) 0.72in !important;
            align-items: center !important;
            gap: 0.12cm !important;
          }

          .doh-lgu-stock-print-header__seal {
            display: block !important;
            width: 0.74in !important;
            height: 0.74in !important;
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
            font-size: 12px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .doh-lgu-stock-print-header__line--title {
            margin-top: 0.05cm !important;
            font-size: 10.4px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .doh-lgu-stock-print-header__line--subtitle {
            margin-top: 0.03cm !important;
            font-size: 8.9px !important;
            font-weight: 700 !important;
            text-transform: none !important;
            color: #1f2937 !important;
          }

          .doh-lgu-stock-print-header__meta-table {
            width: 100% !important;
            margin-top: 0.08cm !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }

          .doh-lgu-stock-print-header__meta-table td {
            border: 0.5pt solid #111827 !important;
            padding: 0.07cm 0.08cm !important;
            font-size: 8.7px !important;
            line-height: 1.16 !important;
            color: #111827 !important;
            text-align: left !important;
            vertical-align: middle !important;
            background: #ffffff !important;
          }

          .doh-lgu-stock-print-header__meta-label {
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }

          .doh-lgu-stock-print-header__meta-value {
            font-weight: 700 !important;
            letter-spacing: 0.01em !important;
          }

          #doh-lgu-print-table {
            width: 100% !important;
            border: 0.5pt solid #111827 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            color: #0f172a !important;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
          }

          #doh-lgu-print-table th,
          #doh-lgu-print-table td {
            border: 0.5pt solid #111827 !important;
            padding: 0.082cm 0.06cm !important;
            vertical-align: middle !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
            background: #ffffff !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          #doh-lgu-print-table {
            font-size: 8.15px !important;
            line-height: 1.1 !important;
          }

          #doh-lgu-print-table thead {
            display: table-header-group !important;
          }

          #doh-lgu-print-table tbody {
            display: table-row-group !important;
          }

          #doh-lgu-print-table tr {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          #doh-lgu-print-table th {
            font-size: 8px !important;
            font-weight: 800 !important;
            text-transform: none !important;
            text-align: center !important;
            letter-spacing: 0.007em !important;
            line-height: 1.06 !important;
            color: #111827 !important;
          }

          #doh-lgu-print-table td {
            font-size: 8.15px !important;
            min-height: 0.5cm !important;
            line-height: 1.08 !important;
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
      <style>{`
        #inventory-print-root {
          display: none;
        }

        @media print {
          html,
          body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body.printing-inventory #root {
            display: none !important;
          }

          body.printing-inventory #inventory-print-root {
            display: block !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }

          body.printing-inventory .inventory-sheet-summary-print-report,
          body.printing-inventory .doh-lgu-stock-print-report,
          body.printing-inventory .ris-print-report {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          body.printing-inventory .inventory-export,
          body.printing-inventory .inventory-export * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body.printing-inventory .inventory-sheet-summary-print-table,
          body.printing-inventory #doh-lgu-print-table,
          body.printing-inventory .ris-print-table {
            width: 100% !important;
            table-layout: fixed !important;
          }

          body.printing-inventory #doh-lgu-print-table th,
          body.printing-inventory #doh-lgu-print-table td,
          body.printing-inventory .ris-print-table th,
          body.printing-inventory .ris-print-table td {
            font-size: 9pt !important;
            word-break: keep-all !important;
            white-space: nowrap !important;
            overflow-wrap: normal !important;
          }

          body.printing-inventory .inventory-sheet-summary-print-table th,
          body.printing-inventory .inventory-sheet-summary-print-table td {
            font-size: 7.7pt !important;
            line-height: 1.12 !important;
            padding: 0.045cm 0.05cm !important;
            word-break: keep-all !important;
            white-space: nowrap !important;
            overflow-wrap: normal !important;
          }

          body.printing-inventory .inventory-sheet-summary-print-table tr,
          body.printing-inventory #doh-lgu-print-table tr,
          body.printing-inventory .ris-print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>)
   ;
}
