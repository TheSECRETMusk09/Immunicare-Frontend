import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Printer } from "lucide-react";
import apiClient from "../utils/api";
import { Button, Modal, Select } from "./UI";
import VisitRecordingForm from "./VisitRecordingForm";
import {
  normalizeInfantResponse,
  normalizeVaccinationRecordsResponse,
  normalizeVaccineInventoryResponse,
  buildFefoBatchOptions,
  toArrayPayload,
} from "../utils/adminDataAdapters";
import { useAuth } from "../contexts/AuthContext";
import usePrintDateRange from "../hooks/usePrintDateRange";
import {
  filterItemsByPrintDateRange,
  formatPrintDateValue,
} from "../utils/printDateRange";
import {
  downloadWordDocument,
  PRINT_PAGE_PRESETS,
} from "../utils/printDocumentExport";
import { resolveLotBatchValue } from "../utils/vaccinationFormOptions";

const sanitizeFileSegment = (value) =>
  String(value || "document")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "document";

const toFiniteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAppointmentsResponse = (response) =>
  toArrayPayload(response, ["appointments"]).map((entry) => ({
    ...entry,
    id: toFiniteNumber(entry?.id),
    type: entry?.type ?? entry?.appointment_type ?? "",
    scheduled_date:
      entry?.scheduled_date ?? entry?.appointment_date ?? entry?.date ?? null,
    status: entry?.status ?? "pending",
    notes: entry?.notes ?? entry?.remarks ?? "",
  }));

const normalizeGrowthRecordsResponse = (response) =>
  toArrayPayload(response, ["growthRecords", "records", "growth"]).map((entry) => ({
    ...entry,
    id: toFiniteNumber(entry?.id),
    age_in_days: toFiniteNumber(entry?.age_in_days, null),
    heart_rate: toFiniteNumber(entry?.heart_rate, null),
    respiratory_rate: toFiniteNumber(entry?.respiratory_rate, null),
    temperature_celsius: toFiniteNumber(entry?.temperature_celsius, null),
    length_cm: toFiniteNumber(entry?.length_cm, null),
    weight_kg: toFiniteNumber(entry?.weight_kg, null),
    feeding_status: entry?.feeding_status ?? null,
    notes: entry?.notes ?? entry?.remarks ?? "",
    measurement_date: entry?.measurement_date ?? entry?.date ?? null,
  }));

const VISIT_TEMPLATES = [
  {
    age: "6 WEEKS",
    title: "6 Weeks Visit",
    column: "left",
    window: { minWeeks: 5, maxWeeks: 7 },
    vaccines: [
      {
        key: "penta-1",
        name: "Penta Valent",
        doseNo: 1,
        label: "PENTA 1 / HEXA 1",
        matchNames: ["Penta Valent"],
      },
      {
        key: "opv-1",
        name: "OPV 20-doses",
        doseNo: 1,
        label: "OPV 1",
        matchNames: ["OPV 20-doses"],
      },
      {
        key: "pcv-1",
        name: "PCV 10",
        doseNo: 1,
        label: "PCV 1",
        matchNames: ["PCV 10", "PCV 13"],
      },
    ],
  },
  {
    age: "10 WEEKS",
    title: "10 Weeks Visit",
    column: "left",
    window: { minWeeks: 9, maxWeeks: 11 },
    vaccines: [
      {
        key: "penta-2",
        name: "Penta Valent",
        doseNo: 2,
        label: "PENTA 2 / HEXA 2",
        matchNames: ["Penta Valent"],
      },
      {
        key: "opv-2",
        name: "OPV 20-doses",
        doseNo: 2,
        label: "OPV 2",
        matchNames: ["OPV 20-doses"],
      },
      {
        key: "pcv-2",
        name: "PCV 10",
        doseNo: 2,
        label: "PCV 2",
        matchNames: ["PCV 10", "PCV 13"],
      },
    ],
  },
  {
    age: "14 WEEKS",
    title: "14 Weeks Visit",
    column: "left",
    window: { minWeeks: 13, maxWeeks: 15 },
    vaccines: [
      {
        key: "penta-3",
        name: "Penta Valent",
        doseNo: 3,
        label: "PENTA 3 / HEXA 3",
        matchNames: ["Penta Valent"],
      },
      {
        key: "opv-3",
        name: "OPV 20-doses",
        doseNo: 3,
        label: "OPV 3",
        matchNames: ["OPV 20-doses"],
      },
      {
        key: "pcv-3",
        name: "PCV 10",
        doseNo: 3,
        label: "PCV 3",
        matchNames: ["PCV 10", "PCV 13"],
      },
      {
        key: "ipv-1",
        name: "IPV multi dose",
        doseNo: 1,
        label: "IPV 1",
        matchNames: ["IPV multi dose"],
      },
    ],
  },
  {
    age: "6 MONTHS",
    title: "6 Months Visit",
    column: "left",
    layout: "sixMonths",
    window: { minWeeks: 24, maxWeeks: 28 },
    vaccines: [
      {
        key: "vit-a-1",
        name: "Vitamin A",
        doseNo: 1,
        label: "VIT. A",
        matchNames: ["Vitamin A", "Vit. A", "VITA"],
        allowDoseFallback: true,
      },
    ],
  },
  {
    age: "9 MONTHS",
    title: "9 Months Visit",
    column: "right",
    window: { minWeeks: 36, maxWeeks: 40 },
    vaccines: [
      {
        key: "mcv-1",
        name: "Measles & Rubella (MR)",
        doseNo: 1,
        label: "MCV 1",
        matchNames: ["Measles & Rubella (MR)", "MR", "MCV 1"],
      },
      {
        key: "ipv-2",
        name: "IPV multi dose",
        doseNo: 2,
        label: "IPV 2",
        matchNames: ["IPV multi dose"],
      },
    ],
  },
  {
    age: "12 MONTHS",
    title: "12 Months Visit",
    column: "right",
    window: { minWeeks: 48, maxWeeks: 56 },
    vaccines: [
      {
        key: "mcv-2",
        name: "MMR",
        doseNo: 1,
        label: "MCV 2",
        matchNames: ["MMR", "Measles & Rubella (MR)", "MCV 2"],
      },
    ],
  },
];

const DEFAULT_PRINT_PAPER_SIZE = "a4";

const PRINT_PAPER_OPTIONS = [
  { value: "a4", label: "A4 portrait" },
  { value: "long", label: "Long portrait" },
];

const PRINT_PAPER_CONFIGS = {
  a4: {
    pageSize: "210mm 297mm",
    pageMargin: "7mm 7mm 8mm",
    documentWidth: "196mm",
    documentMinHeight: "279mm",
    documentPadding: "5mm 6mm 6mm",
    outerPadding: "8mm 0",
  },
  long: {
    pageSize: "216mm 330mm",
    pageMargin: "7mm 7mm 8mm",
    documentWidth: "202mm",
    documentMinHeight: "312mm",
    documentPadding: "5mm 6mm 6mm",
    outerPadding: "8mm 0",
  },
};

const getPrintPaperConfig = (paperSize = DEFAULT_PRINT_PAPER_SIZE) =>
  PRINT_PAPER_CONFIGS[paperSize] || PRINT_PAPER_CONFIGS[DEFAULT_PRINT_PAPER_SIZE];

const getPrintPagePreset = (paperSize = DEFAULT_PRINT_PAPER_SIZE) =>
  paperSize === "long"
    ? PRINT_PAGE_PRESETS.folioPortrait
    : PRINT_PAGE_PRESETS.a4Portrait;

const buildPrintPaperStyles = (paperSize = DEFAULT_PRINT_PAPER_SIZE) => {
  const config = getPrintPaperConfig(paperSize);

  return `
    .immunization-chart-export,
    .immunization-chart__document {
      --immunization-print-page-size: ${config.pageSize};
      --immunization-print-page-margin: ${config.pageMargin};
      --immunization-print-document-width: ${config.documentWidth};
      --immunization-print-document-min-height: ${config.documentMinHeight};
      --immunization-print-document-padding: ${config.documentPadding};
      --immunization-print-outer-padding: ${config.outerPadding};
    }

    @media print {
      @page {
        size: ${config.pageSize};
        margin: ${config.pageMargin};
      }
    }
  `;
};

const buildPrintDocumentStyles = (paperSize = DEFAULT_PRINT_PAPER_SIZE) => {
  const config = getPrintPaperConfig(paperSize);

  return `
    .immunization-chart__print-only {
      display: none;
    }

    .immunization-chart-print {
      width: min(100%, ${config.documentWidth});
      min-height: ${config.documentMinHeight};
      margin: 0 auto;
      padding: ${config.documentPadding};
      background: #ffffff;
      color: #000000;
      font-family: "Times New Roman", Georgia, serif;
    }

    .immunization-chart-print__header {
      display: grid;
      grid-template-columns: 23mm 1fr 25mm;
      align-items: start;
      column-gap: 7mm;
      margin-bottom: 4mm;
    }

    .immunization-chart-print__logo-wrap {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
    }

    .immunization-chart-print__logo-wrap:last-child {
      justify-content: flex-end;
    }

    .immunization-chart-print__logo {
      width: 22mm;
      height: 22mm;
      object-fit: cover;
      display: block;
      border-radius: 50%;
      clip-path: circle(50% at 50% 50%);
      background: transparent;
      border: none;
      box-shadow: none;
      mix-blend-mode: multiply;
    }

    .immunization-chart-print__logo--circle {
      width: 23.5mm;
      height: 23.5mm;
      border-radius: 50%;
      object-fit: cover;
      clip-path: circle(50% at 50% 50%);
      background: transparent;
      border: none;
      box-shadow: none;
      mix-blend-mode: multiply;
    }

    .immunization-chart-print__logo--shield {
      border-radius: 0;
      clip-path: none;
      object-fit: contain;
    }

    .immunization-chart-print__title-wrap {
      text-align: center;
      padding-top: 1.5mm;
    }

    .immunization-chart-print__title {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14.5pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.05;
    }

    .immunization-chart-print__title-meta {
      margin-top: 1.5mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5pt;
      font-weight: 600;
      line-height: 1.3;
    }

    .immunization-chart-print__section-title {
      margin: 0 0 2.1mm;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.01em;
    }

    .immunization-chart-print__identity-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.96fr);
      column-gap: 8mm;
      align-items: start;
      margin-bottom: 4.1mm;
    }

    .immunization-chart-print__section-column {
      min-width: 0;
    }

    .immunization-chart-print__field-group {
      margin-bottom: 1.1mm;
    }

    .immunization-chart-print__field-row {
      display: flex;
      align-items: flex-end;
      gap: 1.2mm;
      width: 100%;
      font-size: 9.6px;
      line-height: 1.02;
      margin-bottom: 0.7mm;
    }

    .immunization-chart-print__field-row--wrap {
      align-items: flex-start;
    }

    .immunization-chart-print__label {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .immunization-chart-print__stacked-label {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-end;
      min-width: 11mm;
      font-size: 9px;
      line-height: 0.96;
    }

    .immunization-chart-print__line {
      flex: 1;
      width: 100%;
      min-height: 3.35mm;
      border-bottom: 1px solid #000000;
      display: block;
      padding: 0 0.45mm 0.3mm;
      font-size: 9.6px;
      line-height: 1;
      word-break: break-word;
    }

    .immunization-chart-print__line--tiny {
      flex: 0 0 12mm;
      max-width: 12mm;
    }

    .immunization-chart-print__line--short {
      flex: 0 0 26mm;
      max-width: 26mm;
    }

    .immunization-chart-print__line--medium {
      flex: 0 0 39mm;
      max-width: 39mm;
    }

    .immunization-chart-print__line--long {
      flex: 0 0 52mm;
      max-width: 52mm;
    }

    .immunization-chart-print__line--remarks {
      flex: 0 0 34mm;
      max-width: 34mm;
      min-height: 4.8mm;
    }

    .immunization-chart-print__line-stack {
      flex: 1;
      width: 100%;
      display: block;
    }

    .immunization-chart-print__line-stack .immunization-chart-print__line + .immunization-chart-print__line {
      margin-top: 0.75mm;
    }

    .immunization-chart-print__caption {
      margin: 0.25mm 0 0 10mm;
      font-size: 7.7px;
      font-style: italic;
      line-height: 1;
    }

    .immunization-chart-print__choice-row {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 0.9mm 1.8mm;
      font-size: 9.6px;
      line-height: 1.02;
      margin-bottom: 0.85mm;
    }

    .immunization-chart-print__choice-set {
      display: inline-flex;
      align-items: flex-end;
      gap: 0.3mm;
      margin: 0;
      font-weight: 700;
    }

    .immunization-chart-print__choice-indicator {
      display: inline-block;
      min-width: 4.5mm;
      text-align: center;
      font-weight: 700;
    }

    .immunization-chart-print__visit-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      column-gap: 8mm;
      align-items: start;
    }

    .immunization-chart-print__visit-column {
      min-width: 0;
    }

    .immunization-chart-print__visit-card {
      margin-bottom: 4mm;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .immunization-chart-print__visit-header {
      margin-bottom: 0.65mm;
    }

    .immunization-chart-print__visit-kicker {
      display: block;
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1;
    }

    .immunization-chart-print__visit-body,
    .immunization-chart-print__visit-body--six-months {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 16mm;
      column-gap: 2.5mm;
      align-items: start;
    }

    .immunization-chart-print__visit-subtitle,
    .immunization-chart-print__visit-vitals-title {
      margin: 0 0 0.3mm;
      font-size: 8.6px;
      font-weight: 700;
      text-transform: uppercase;
      line-height: 1;
    }

    .immunization-chart-print__vaccine-row,
    .immunization-chart-print__vital-row {
      display: flex;
      align-items: flex-end;
      gap: 0.8mm;
      width: 100%;
      font-size: 8.8px;
      line-height: 1;
      margin-bottom: 0.3mm;
    }

    .immunization-chart-print__vaccine-label,
    .immunization-chart-print__vital-label {
      font-weight: 700;
      white-space: nowrap;
    }

    .immunization-chart-print__vaccine-check {
      min-width: 8.5mm;
      white-space: nowrap;
    }

    .immunization-chart-print__catchup {
      margin-top: 0.6mm;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .immunization-chart-print__catchup-title {
      display: block;
      margin: 0 0 0.9mm;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }

    .immunization-chart-print__catchup-lines .immunization-chart-print__line + .immunization-chart-print__line {
      margin-top: 0.85mm;
    }

    .immunization-chart-print__catchup-footer {
      margin-top: 2mm;
    }

    .immunization-chart-print__catchup-footer .immunization-chart-print__field-row {
      margin-bottom: 0.6mm;
    }

    @media print {
      @page {
        size: ${config.pageSize};
        margin: ${config.pageMargin};
      }

      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .immunization-chart__screen-shell,
      .immunization-chart__screen-only,
      .immunization-chart-page__screen-only,
      [role="dialog"] {
        display: none !important;
      }

      .immunization-chart__print-only {
        display: block !important;
      }

      .immunization-chart-print {
        width: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: ${config.documentPadding} !important;
        box-shadow: none !important;
      }
    }
  `;
};

const PRINTABLE_STYLES = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #edf1f5;
    color: #000000;
    font-family: "Times New Roman", Georgia, serif;
  }

  .immunization-chart-export {
    background: #ffffff;
    margin: 0;
    padding: var(--immunization-print-outer-padding, 8mm 0);
  }

  .immunization-chart__shell {
    border: 1px solid #e5e7eb;
  }

  .immunization-chart__canvas {
    background: #edf1f5;
    padding: 24px;
  }

  .immunization-chart__document {
    width: min(100%, var(--immunization-print-document-width, 190mm));
    min-height: var(--immunization-print-document-min-height, 279mm);
    margin: 0 auto;
    background: #ffffff;
    color: #000000;
    padding: var(--immunization-print-document-padding, 5.5mm 7mm 7mm);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
  }

  .immunization-chart__header {
    display: grid;
    grid-template-columns: 28mm 1fr 31mm;
    align-items: start;
    column-gap: 8mm;
    margin-bottom: 6.5mm;
  }

  .immunization-chart__logo-wrap {
    display: flex;
    align-items: flex-start;
  }

  .immunization-chart__logo-wrap:last-child {
    justify-content: flex-end;
  }

  .immunization-chart__logo {
    width: 25mm;
    height: 25mm;
    object-fit: cover;
    display: block;
    border-radius: 50%;
    clip-path: circle(50% at 50% 50%);
    background: transparent;
    border: none;
    box-shadow: none;
    mix-blend-mode: multiply;
  }

  .immunization-chart__logo--circle {
    width: 27mm;
    height: 27mm;
    border-radius: 50%;
    object-fit: cover;
    clip-path: circle(50% at 50% 50%);
    background: transparent;
    border: none;
    box-shadow: none;
    mix-blend-mode: multiply;
  }

  .immunization-chart__logo--shield {
    border-radius: 0;
    clip-path: none;
    object-fit: contain;
  }

  .immunization-chart__title-wrap {
    text-align: center;
    padding-top: 8.5mm;
  }

  .immunization-chart__title {
    display: block;
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14.5pt;
    font-weight: 700;
    letter-spacing: 0.03em;
    line-height: 1.1;
  }

  .immunization-chart__title-meta {
    margin-top: 6px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    color: #334155;
  }

  .immunization-chart__identity-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 11mm;
    align-items: start;
    margin-bottom: 9mm;
  }

  .immunization-chart__section-column {
    min-width: 0;
  }

  .immunization-chart__field-group {
    margin-bottom: 2mm;
  }

  .immunization-chart__field-row {
    display: flex;
    align-items: flex-end;
    gap: 1.6mm;
    width: 100%;
    font-size: 11px;
    line-height: 1.1;
    margin-bottom: 1mm;
  }

  .immunization-chart__field-row--wrap {
    align-items: flex-start;
  }

  .immunization-chart__label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .immunization-chart__line {
    flex: 1;
    width: 100%;
    min-height: 4.2mm;
    border-bottom: 1px solid #000000;
    display: block;
    padding: 0 0.7mm 0.5mm;
    font-size: 11px;
    line-height: 1.05;
    word-break: break-word;
  }

  .immunization-chart__line--tiny {
    flex: 0 0 13mm;
  }

  .immunization-chart__line--short {
    flex: 0 0 33mm;
  }

  .immunization-chart__line--medium {
    flex: 0 0 46mm;
  }

  .immunization-chart__line--date {
    flex: 0 0 20mm;
    max-width: 20mm;
  }

  .immunization-chart__line--vital {
    flex: 0 0 14mm;
    max-width: 14mm;
  }

  .immunization-chart__line--catchup {
    flex: 0 0 58mm;
    max-width: 58mm;
  }

  .immunization-chart__line--remarks {
    flex: 0 0 30mm;
    max-width: 40mm;
  }

  .immunization-chart__line-stack {
    flex: 1;
    width: 100%;
    display: block;
  }

  .immunization-chart__line-stack .immunization-chart__line + .immunization-chart__line {
    margin-top: 1.2mm;
  }

  .immunization-chart__caption {
    margin: 0.4mm 0 0 12mm;
    font-size: 9.5px;
    font-style: italic;
    line-height: 1;
  }

  .immunization-chart__choice-row {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 1.4mm 2.4mm;
    font-size: 11px;
    line-height: 1.1;
    margin-bottom: 3mm;
  }

  .immunization-chart__choice-row--tight {
    margin-bottom: 2.2mm;
  }

  .immunization-chart__choice-set {
    display: inline-flex;
    align-items: flex-end;
    gap: 0.4mm;
    margin: 0;
    font-weight: 700;
  }

  .immunization-chart__choice-indicator {
    display: inline-block;
    min-width: 5.5mm;
    text-align: center;
    font-weight: 700;
  }

  .immunization-chart__section-title {
    margin: 0 0 3mm;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  .immunization-chart__section-title--personal {
    margin-bottom: 3.5mm;
  }

  .immunization-chart__section-title--visits {
    margin: 0 0 3.2mm;
  }

  .immunization-chart__visit-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 12mm;
    align-items: start;
  }

  .immunization-chart__visit-column {
    min-width: 0;
  }

  .immunization-chart__visit-card {
    margin-bottom: 6mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .immunization-chart__visit-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4mm;
    margin-bottom: 1.3mm;
  }

  .immunization-chart__visit-heading {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
  }

  .immunization-chart__visit-action {
    flex-shrink: 0;
  }

  .immunization-chart__visit-kicker {
    display: block;
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .immunization-chart__visit-title {
    margin: 0;
    font-family: "Times New Roman", Georgia, serif;
    font-size: 12.5px;
    font-weight: 700;
    font-style: normal;
    text-decoration: underline;
    letter-spacing: 0.02em;
    line-height: 1.05;
    display: inline-block;
  }

  .immunization-chart__visit-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content;
    column-gap: 3.4mm;
    align-items: start;
  }

  .immunization-chart__visit-body--six-months {
    grid-template-columns: minmax(0, 1fr) max-content;
  }

  .immunization-chart__visit-details,
  .immunization-chart__visit-vitals {
    min-width: 0;
  }

  .immunization-chart__visit-vitals {
    width: max-content;
    max-width: 100%;
  }

  .immunization-chart__visit-subtitle,
  .immunization-chart__visit-vitals-title {
    margin: 0 0 0.8mm;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .immunization-chart__vaccine-row,
  .immunization-chart__vital-row {
    display: flex;
    align-items: flex-end;
    gap: 1.2mm;
    width: 100%;
    font-size: 10px;
    line-height: 1.05;
    margin-bottom: 0.7mm;
  }

  .immunization-chart__vaccine-label,
  .immunization-chart__vital-label {
    font-weight: 700;
    white-space: nowrap;
  }

  .immunization-chart__vaccine-check {
    min-width: 11mm;
    white-space: nowrap;
  }

  .immunization-chart__remarks-line {
    min-height: 6mm;
  }

  .immunization-chart__catchup {
    margin-top: 1mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .immunization-chart__catchup-title {
    display: block;
    margin: 0 0 1.5mm;
    font-family: "Times New Roman", Georgia, serif;
    font-size: 12px;
    font-weight: 700;
  }

  .immunization-chart__catchup-lines {
    display: block;
  }

  .immunization-chart__catchup-lines .immunization-chart__line + .immunization-chart__line {
    margin-top: 1.35mm;
  }

  .immunization-chart__catchup-footer {
    margin-top: 5mm;
  }

  .immunization-chart__catchup-footer .immunization-chart__field-row {
    margin-bottom: 1.15mm;
  }

  .immunization-chart__screen-only {
    display: inline-flex;
  }

  .immunization-chart-export .immunization-chart__screen-only {
    display: none !important;
  }

  @media (max-width: 1080px) {
    .immunization-chart__canvas {
      padding: 16px;
    }

    .immunization-chart__document {
      width: 100%;
      min-height: 0;
    }
  }

  @media (max-width: 860px) {
    .immunization-chart__header,
    .immunization-chart__identity-grid,
    .immunization-chart__visit-grid,
    .immunization-chart__visit-body {
      display: block;
    }

    .immunization-chart__title-wrap {
      padding-top: 0;
      margin: 10px 0 14px;
    }

    .immunization-chart__logo-wrap,
    .immunization-chart__logo-wrap:last-child {
      justify-content: center;
      margin-bottom: 10px;
    }

    .immunization-chart__section-column,
    .immunization-chart__visit-column,
    .immunization-chart__visit-details,
    .immunization-chart__visit-vitals {
      width: 100%;
    }

    .immunization-chart__section-column + .immunization-chart__section-column,
    .immunization-chart__visit-column + .immunization-chart__visit-column {
      margin-top: 18px;
    }

    .immunization-chart__visit-vitals {
      margin-top: 10px;
    }

    .immunization-chart__visit-action {
      margin-top: 8px;
    }
  }

  @media (max-width: 640px) {
    .immunization-chart__canvas,
    .immunization-chart__document {
      padding: 14px;
    }

    .immunization-chart__field-row,
    .immunization-chart__choice-row,
    .immunization-chart__vaccine-row,
    .immunization-chart__vital-row {
      display: block;
    }

    .immunization-chart__field-row > *,
    .immunization-chart__choice-row > *,
    .immunization-chart__vaccine-row > *,
    .immunization-chart__vital-row > * {
      display: block;
      width: 100%;
      margin-bottom: 4px;
    }

    .immunization-chart__line--tiny,
    .immunization-chart__line--short,
    .immunization-chart__line--medium,
    .immunization-chart__line--date,
    .immunization-chart__line--vital,
    .immunization-chart__line--catchup,
    .immunization-chart__line--remarks {
      width: 100%;
      max-width: none;
    }

    .immunization-chart__caption {
      margin-left: 0;
    }
  }

  @media print {
    body,
    .immunization-chart-export {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .immunization-chart__shell {
      border: none !important;
      box-shadow: none !important;
      overflow: visible !important;
    }

    .immunization-chart__canvas {
      padding: 0 !important;
      background: #ffffff !important;
      overflow: visible !important;
    }

    .immunization-chart__document {
      width: auto !important;
      min-height: 0 !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .immunization-chart__screen-only {
      display: none !important;
    }

    .immunization-chart__header,
    .immunization-chart__identity-grid,
    .immunization-chart__visit-grid,
    .immunization-chart__visit-card,
    .immunization-chart__catchup,
    .immunization-chart__catchup-footer {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;

const EMBEDDED_ASSET_CACHE = new Map();

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(new Error("Failed to read the asset file."));
    reader.readAsDataURL(blob);
  });

const toEmbeddedAssetUrl = async (assetUrl) => {
  if (!assetUrl || typeof window === "undefined") {
    return assetUrl;
  }

  if (String(assetUrl).startsWith("data:")) {
    return assetUrl;
  }

  if (EMBEDDED_ASSET_CACHE.has(assetUrl)) {
    return EMBEDDED_ASSET_CACHE.get(assetUrl);
  }

  try {
    const response = await fetch(assetUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load asset: ${assetUrl}`);
    }

    const embeddedUrl = await blobToDataUrl(await response.blob());
    const resolvedUrl = embeddedUrl || assetUrl;
    EMBEDDED_ASSET_CACHE.set(assetUrl, resolvedUrl);
    return resolvedUrl;
  } catch (error) {
    console.error("Unable to embed print asset:", error);
    EMBEDDED_ASSET_CACHE.set(assetUrl, assetUrl);
    return assetUrl;
  }
};

const createPrintFrame = () => {
  if (typeof document === "undefined") {
    return null;
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.border = "0";
  document.body.appendChild(frame);
  return frame;
};

const cleanupPrintFrame = (frame) => {
  if (frame?.parentNode) {
    frame.parentNode.removeChild(frame);
  }
};

const writeHtmlToPrintFrame = async (html) => {
  const frame = createPrintFrame();
  const frameWindow = frame?.contentWindow;
  const frameDocument = frameWindow?.document;

  if (!frame || !frameWindow || !frameDocument) {
    cleanupPrintFrame(frame);
    return null;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  await new Promise((resolve) => window.setTimeout(resolve, 120));
  await waitForDocumentImages(frameDocument);

  return { frame, frameWindow, frameDocument };
};

const waitForDocumentImages = async (targetDocument) => {
  const images = Array.from(targetDocument?.images || []);
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        }),
    ),
  );
};

const hasDisplayValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const normalizeNameToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const DATE_ONLY_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseChartDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const dateOnlyMatch = trimmedValue.match(DATE_ONLY_VALUE_PATTERN);

    if (dateOnlyMatch) {
      const [, yearText, monthText, dayText] = dateOnlyMatch;
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const parsedDate = new Date(year, month - 1, day);

      if (
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month - 1 &&
        parsedDate.getDate() === day
      ) {
        return parsedDate;
      }

      return null;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseChartDate(value);
  if (!parsed) {
    return "";
  }

  return formatPrintDateValue(parsed, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatTimeOfDelivery = (value) => {
  if (!hasDisplayValue(value)) {
    return "";
  }

  const text = String(value).trim();
  if (!text.includes(":")) {
    return text;
  }

  const [hourText = "0", minuteText = "0"] = text.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return text;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const formatMeasurement = (value) => {
  if (!hasDisplayValue(value)) {
    return "";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value).trim();
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(1).replace(/\.0$/, "");
};

const formatDoseText = (record) => {
  const doseNumber = Number(record?.dose_no || record?.dose_number || 0);
  return Number.isFinite(doseNumber) && doseNumber > 0 ? ` Dose ${doseNumber}` : "";
};

const buildFullName = (infant) => {
  if (!infant) return "";

  const middleInitial = hasDisplayValue(infant.middle_name)
    ? String(infant.middle_name).trim().charAt(0)
    : "";

  return [
    [infant.last_name, infant.first_name].filter(hasDisplayValue).join(", "),
    middleInitial,
  ]
    .filter(hasDisplayValue)
    .join(" ");
};

const buildAddress = (infant) => {
  if (!infant) return "";

  const addressParts = [
    infant.address,
    infant.street_color,
    infant.purok,
    infant.barangay,
  ]
    .filter(hasDisplayValue)
    .map((value) => String(value).trim());

  return [...new Set(addressParts)].join(", ");
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const formatFeedingStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "breastfeeding") return "Y";
  if (normalized === "not_breastfeeding") return "N";
  return "";
};

const buildDateFromOffset = (dob, days) => {
  const birthDate = parseChartDate(dob);
  if (!birthDate || !Number.isFinite(days)) {
    return null;
  }

  const computedDate = new Date(birthDate);
  computedDate.setDate(computedDate.getDate() + days);
  return computedDate;
};

const getValidDate = (value) => {
  return parseChartDate(value);
};

const formatAgeDisplay = (dob, referenceDate = new Date()) => {
  const birthDate = getValidDate(dob);
  const currentDate = getValidDate(referenceDate);
  if (!birthDate || !currentDate || birthDate > currentDate) {
    return "";
  }

  let months =
    (currentDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (currentDate.getMonth() - birthDate.getMonth());

  if (currentDate.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  months = Math.max(months, 0);
  if (months < 1) {
    const days = Math.max(
      0,
      Math.floor((currentDate - birthDate) / (24 * 60 * 60 * 1000)),
    );
    return days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "Newborn";
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths > 0) {
    return `${years} yr${years === 1 ? "" : "s"} ${remainingMonths} mo${remainingMonths === 1 ? "" : "s"}`;
  }

  if (years > 0) {
    return `${years} yr${years === 1 ? "" : "s"}`;
  }

  return `${months} mo${months === 1 ? "" : "s"}`;
};

const getWeeksFromDate = (dob, value) => {
  const birthDate = getValidDate(dob);
  const targetDate = getValidDate(value);
  if (!birthDate || !targetDate) {
    return null;
  }

  return Math.floor((targetDate - birthDate) / (7 * 24 * 60 * 60 * 1000));
};

const getGrowthDate = (record, dob) => {
  return (
    getValidDate(record?.measurement_date) ||
    buildDateFromOffset(dob, toFiniteNumber(record?.age_in_days, null))
  );
};

const getGrowthAgeInWeeks = (record, dob) => {
  if (Number.isFinite(Number(record?.age_in_days))) {
    return Math.floor(Number(record.age_in_days) / 7);
  }

  return getWeeksFromDate(dob, record?.measurement_date);
};

const isWeeksWithinWindow = (weeks, window) =>
  Number.isFinite(weeks) && weeks >= window.minWeeks && weeks <= window.maxWeeks;

const getTargetVisitDate = (dob, window) => {
  const birthDate = getValidDate(dob);
  if (!birthDate) return null;

  const midpoint = Math.round(((window.minWeeks + window.maxWeeks) / 2) * 7);
  const targetDate = new Date(birthDate);
  targetDate.setDate(targetDate.getDate() + midpoint);
  return targetDate;
};

const pickClosestRecord = (records, getDate, targetDate) => {
  const normalizedTargetDate = getValidDate(targetDate);
  return (Array.isArray(records) ? records : [])
    .map((record) => ({ record, recordDate: getValidDate(getDate(record)) }))
    .filter((entry) => entry.recordDate)
    .sort((left, right) => {
      if (normalizedTargetDate) {
        const leftDistance = Math.abs(left.recordDate - normalizedTargetDate);
        const rightDistance = Math.abs(right.recordDate - normalizedTargetDate);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
      }

      return left.recordDate - right.recordDate;
    })[0]?.record || null;
};

const pickClosestDateValue = (values, targetDate) => {
  const normalizedTargetDate = getValidDate(targetDate);
  return (Array.isArray(values) ? values : [])
    .map((value) => getValidDate(value))
    .filter(Boolean)
    .sort((left, right) => {
      if (normalizedTargetDate) {
        const leftDistance = Math.abs(left - normalizedTargetDate);
        const rightDistance = Math.abs(right - normalizedTargetDate);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
      }

      return left - right;
    })[0] || null;
};

const buildRemarks = (...sources) => {
  const remarks = sources
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(hasDisplayValue)
    .map((value) => String(value).trim());

  return [...new Set(remarks)].join(" • ");
};

const isMatchingVaccineRecord = (record, vaccineDefinition) => {
  const recordName = normalizeNameToken(record?.vaccine_name);
  if (!recordName) {
    return false;
  }

  const allowedNames = (vaccineDefinition.matchNames || [vaccineDefinition.name])
    .map(normalizeNameToken)
    .filter(Boolean);

  const matchesName = allowedNames.some(
    (candidate) =>
      candidate === recordName ||
      recordName.includes(candidate) ||
      candidate.includes(recordName),
  );

  if (!matchesName) {
    return false;
  }

  if (vaccineDefinition.doseNo === undefined || vaccineDefinition.doseNo === null) {
    return true;
  }

  const doseNumber = Number(record?.dose_no || record?.dose_number || 1);
  if (!Number.isFinite(doseNumber)) {
    return Boolean(vaccineDefinition.allowDoseFallback);
  }

  return doseNumber === vaccineDefinition.doseNo;
};

const ChoiceIndicator = ({ checked }) => (
  <span
    className="immunization-chart__choice-indicator"
    aria-hidden="true"
  >
    ({checked ? "✓" : "\u00A0"})
  </span>
);

const LinedValue = ({ value, className = "" }) => (
  <span className={`immunization-chart__line ${className}`.trim()}>
    {hasDisplayValue(value) ? value : "\u00A0"}
  </span>
);

const PrintChoiceIndicator = ({ checked }) => (
  <span
    className="immunization-chart-print__choice-indicator"
    aria-hidden="true"
  >
    ({checked ? "✓" : "\u00A0"})
  </span>
);

const PrintLinedValue = ({ value, className = "" }) => (
  <span className={`immunization-chart-print__line ${className}`.trim()}>
    {hasDisplayValue(value) ? value : "\u00A0"}
  </span>
);

const PrintVisitSection = ({ summary }) => {
  const {
    template,
    visitDate,
    growth,
    vaccineRows,
    remarks,
    breastfeeding,
    tcb,
  } = summary;

  const showBreastfeeding = ["6 WEEKS", "10 WEEKS", "14 WEEKS"].includes(template.age);
  const showTcb = template.age !== "12 MONTHS";
  const isSixMonthsLayout = template.layout === "sixMonths" || template.age === "6 MONTHS";

  if (isSixMonthsLayout) {
    return (
      <section className="immunization-chart-print__visit-card">
        <div className="immunization-chart-print__visit-header">
          <div className="immunization-chart-print__visit-kicker">{template.age}</div>
        </div>

        <div className="immunization-chart-print__visit-body--six-months">
          <div>
            <div className="immunization-chart-print__field-row">
              <span className="immunization-chart-print__label">TCB:</span>
              <PrintLinedValue value={tcb} className="immunization-chart-print__line--medium" />
            </div>

            <div className="immunization-chart-print__field-row">
              <span className="immunization-chart-print__label">DATE:</span>
              <PrintLinedValue
                value={formatDate(visitDate)}
                className="immunization-chart-print__line--short"
              />
            </div>

            {vaccineRows.map((vaccine) => (
              <div key={vaccine.key} className="immunization-chart-print__vaccine-row">
                <span className="immunization-chart-print__vaccine-label">{vaccine.label}</span>
                <span className="immunization-chart-print__vaccine-check">
                  <PrintChoiceIndicator checked={vaccine.checked} />
                </span>
              </div>
            ))}

            <div className="immunization-chart-print__field-row">
              <span className="immunization-chart-print__label">BREASTFEEDING? (Y/N):</span>
              <PrintLinedValue
                value={breastfeeding}
                className="immunization-chart-print__line--tiny"
              />
            </div>

            <div className="immunization-chart-print__field-row">
              <span className="immunization-chart-print__label">OTHERS/REMARKS:</span>
              <PrintLinedValue
                value={remarks}
                className="immunization-chart-print__line--remarks"
              />
            </div>
          </div>

          <div>
            <div className="immunization-chart-print__visit-vitals-title">VITAL SIGNS:</div>
            <div className="immunization-chart-print__vital-row">
              <span className="immunization-chart-print__vital-label">HR:</span>
              <PrintLinedValue
                value={formatMeasurement(growth?.heart_rate)}
                className="immunization-chart-print__line--tiny"
              />
            </div>
            <div className="immunization-chart-print__vital-row">
              <span className="immunization-chart-print__vital-label">RR:</span>
              <PrintLinedValue
                value={formatMeasurement(growth?.respiratory_rate)}
                className="immunization-chart-print__line--tiny"
              />
            </div>
            <div className="immunization-chart-print__vital-row">
              <span className="immunization-chart-print__vital-label">HT:</span>
              <PrintLinedValue
                value={formatMeasurement(growth?.length_cm)}
                className="immunization-chart-print__line--tiny"
              />
            </div>
            <div className="immunization-chart-print__vital-row">
              <span className="immunization-chart-print__vital-label">Temp:</span>
              <PrintLinedValue
                value={formatMeasurement(growth?.temperature_celsius)}
                className="immunization-chart-print__line--tiny"
              />
            </div>
            <div className="immunization-chart-print__vital-row">
              <span className="immunization-chart-print__vital-label">WT:</span>
              <PrintLinedValue
                value={formatMeasurement(growth?.weight_kg)}
                className="immunization-chart-print__line--tiny"
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="immunization-chart-print__visit-card">
      <div className="immunization-chart-print__visit-header">
        <div className="immunization-chart-print__visit-kicker">{template.age}</div>
      </div>

      <div className="immunization-chart-print__visit-body">
        <div>
          <div className="immunization-chart-print__field-row">
            <span className="immunization-chart-print__label">DATE:</span>
            <PrintLinedValue
              value={formatDate(visitDate)}
              className="immunization-chart-print__line--short"
            />
          </div>

          <div className="immunization-chart-print__visit-subtitle">VACCINES:</div>
          {vaccineRows.map((vaccine) => (
            <div key={vaccine.key} className="immunization-chart-print__vaccine-row">
              <span className="immunization-chart-print__vaccine-label">{vaccine.label}</span>
              <span className="immunization-chart-print__vaccine-check">
                <PrintChoiceIndicator checked={vaccine.checked} />
              </span>
            </div>
          ))}

          <div className="immunization-chart-print__field-row">
            <span className="immunization-chart-print__label">OTHERS/REMARKS:</span>
            <PrintLinedValue
              value={remarks}
              className="immunization-chart-print__line--remarks"
            />
          </div>

          {showBreastfeeding && (
            <div className="immunization-chart-print__field-row">
              <span className="immunization-chart-print__label">BREASTFEEDING? (Y/N):</span>
              <PrintLinedValue
                value={breastfeeding}
                className="immunization-chart-print__line--tiny"
              />
            </div>
          )}

          {showTcb && (
            <div className="immunization-chart-print__field-row">
              <span className="immunization-chart-print__label">TCB:</span>
              <PrintLinedValue value={tcb} className="immunization-chart-print__line--short" />
            </div>
          )}
        </div>

        <div>
          <div className="immunization-chart-print__visit-vitals-title">VITAL SIGNS:</div>
          <div className="immunization-chart-print__vital-row">
            <span className="immunization-chart-print__vital-label">HR:</span>
            <PrintLinedValue
              value={formatMeasurement(growth?.heart_rate)}
              className="immunization-chart-print__line--tiny"
            />
          </div>
          <div className="immunization-chart-print__vital-row">
            <span className="immunization-chart-print__vital-label">RR:</span>
            <PrintLinedValue
              value={formatMeasurement(growth?.respiratory_rate)}
              className="immunization-chart-print__line--tiny"
            />
          </div>
          <div className="immunization-chart-print__vital-row">
            <span className="immunization-chart-print__vital-label">Temp:</span>
            <PrintLinedValue
              value={formatMeasurement(growth?.temperature_celsius)}
              className="immunization-chart-print__line--tiny"
            />
          </div>
          <div className="immunization-chart-print__vital-row">
            <span className="immunization-chart-print__vital-label">HT:</span>
            <PrintLinedValue
              value={formatMeasurement(growth?.length_cm)}
              className="immunization-chart-print__line--tiny"
            />
          </div>
          <div className="immunization-chart-print__vital-row">
            <span className="immunization-chart-print__vital-label">WT:</span>
            <PrintLinedValue
              value={formatMeasurement(growth?.weight_kg)}
              className="immunization-chart-print__line--tiny"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const VisitSection = ({ summary, onRecordVisit }) => {
  const { template, visitDate, growth, vaccineRows, remarks, breastfeeding, tcb, hasRecordedData } =
    summary;

  const showBreastfeeding = ["6 WEEKS", "10 WEEKS", "14 WEEKS"].includes(template.age);
  const showTcb = template.age !== "12 MONTHS";
  const isSixMonthsLayout = template.layout === "sixMonths" || template.age === "6 MONTHS";
  const recordButtonLabel = hasRecordedData ? "View / Edit" : "Record Visit";

  if (isSixMonthsLayout) {
    return (
      <section className="immunization-chart__visit-card">
        <div className="immunization-chart__visit-header">
          <div className="immunization-chart__visit-heading">
            <div className="immunization-chart__visit-kicker">{template.age}</div>
          </div>

          <div className="immunization-chart__visit-action">
            <Button
              size="sm"
              variant={hasRecordedData ? "secondary" : "primary"}
              onClick={() => onRecordVisit(template)}
              className="immunization-chart__screen-only"
            >
              {recordButtonLabel}
            </Button>
          </div>
        </div>

        <div className="immunization-chart__visit-body immunization-chart__visit-body--six-months">
          <div className="immunization-chart__visit-details">
            <div className="immunization-chart__field-row">
              <span className="immunization-chart__label">TCB:</span>
              <LinedValue value={tcb} className="immunization-chart__line--medium" />
            </div>

            <div className="immunization-chart__field-row">
              <span className="immunization-chart__label">DATE:</span>
              <LinedValue value={formatDate(visitDate)} className="immunization-chart__line--date" />
            </div>

            {vaccineRows.map((vaccine) => (
              <div key={vaccine.key} className="immunization-chart__vaccine-row">
                <span className="immunization-chart__vaccine-label">{vaccine.label}</span>
                <span className="immunization-chart__vaccine-check">
                  <ChoiceIndicator checked={vaccine.checked} />
                </span>
              </div>
            ))}

            <div className="immunization-chart__field-row">
              <span className="immunization-chart__label">BREASTFEEDING? (Y/N):</span>
              <LinedValue value={breastfeeding} className="immunization-chart__line--tiny" />
            </div>

            <div className="immunization-chart__field-row immunization-chart__field-row--wrap">
              <span className="immunization-chart__label">OTHERS/REMARKS:</span>
              <LinedValue
                value={remarks}
                className="immunization-chart__remarks-line immunization-chart__line--remarks"
              />
            </div>
          </div>

          <div className="immunization-chart__visit-vitals">
            <div className="immunization-chart__visit-vitals-title">VITAL SIGNS:</div>
            <div className="immunization-chart__vital-row">
              <span className="immunization-chart__vital-label">HR:</span>
              <LinedValue
                value={formatMeasurement(growth?.heart_rate)}
                className="immunization-chart__line--vital"
              />
            </div>
            <div className="immunization-chart__vital-row">
              <span className="immunization-chart__vital-label">RR:</span>
              <LinedValue
                value={formatMeasurement(growth?.respiratory_rate)}
                className="immunization-chart__line--vital"
              />
            </div>

            <div className="immunization-chart__vital-row">
              <span className="immunization-chart__vital-label">HT:</span>
              <LinedValue
                value={formatMeasurement(growth?.length_cm)}
                className="immunization-chart__line--vital"
              />
            </div>

            <div className="immunization-chart__vital-row">
              <span className="immunization-chart__vital-label">Temp:</span>
              <LinedValue
                value={formatMeasurement(growth?.temperature_celsius)}
                className="immunization-chart__line--vital"
              />
            </div>

            <div className="immunization-chart__vital-row">
              <span className="immunization-chart__vital-label">WT:</span>
              <LinedValue
                value={formatMeasurement(growth?.weight_kg)}
                className="immunization-chart__line--vital"
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="immunization-chart__visit-card">
      <div className="immunization-chart__visit-header">
        <div className="immunization-chart__visit-heading">
          <div className="immunization-chart__visit-kicker">{template.age}</div>
        </div>

        <div className="immunization-chart__visit-action">
          <Button
            size="sm"
            variant={hasRecordedData ? "secondary" : "primary"}
            onClick={() => onRecordVisit(template)}
            className="immunization-chart__screen-only"
          >
            {recordButtonLabel}
          </Button>
        </div>
      </div>

      <div className="immunization-chart__visit-body">
        <div className="immunization-chart__visit-details">
          <div className="immunization-chart__field-row">
            <span className="immunization-chart__label">DATE:</span>
            <LinedValue value={formatDate(visitDate)} className="immunization-chart__line--date" />
          </div>

          <div className="immunization-chart__visit-subtitle">VACCINES:</div>

          {vaccineRows.map((vaccine) => (
            <div key={vaccine.key} className="immunization-chart__vaccine-row">
              <span className="immunization-chart__vaccine-label">{vaccine.label}</span>
              <span className="immunization-chart__vaccine-check">
                <ChoiceIndicator checked={vaccine.checked} />
              </span>
            </div>
          ))}

          <div className="immunization-chart__field-row immunization-chart__field-row--wrap">
            <span className="immunization-chart__label">OTHERS/REMARKS:</span>
            <LinedValue
              value={remarks}
              className="immunization-chart__remarks-line immunization-chart__line--remarks"
            />
          </div>

          {showBreastfeeding && (
            <div className="immunization-chart__field-row">
              <span className="immunization-chart__label">BREASTFEEDING? (Y/N):</span>
              <LinedValue value={breastfeeding} className="immunization-chart__line--tiny" />
            </div>
          )}

          {showTcb && (
            <div className="immunization-chart__field-row">
              <span className="immunization-chart__label">TCB:</span>
              <LinedValue value={tcb} className="immunization-chart__line--short" />
            </div>
          )}
        </div>

        <div className="immunization-chart__visit-vitals">
          <div className="immunization-chart__visit-vitals-title">VITAL SIGNS:</div>
          <div className="immunization-chart__vital-row">
            <span className="immunization-chart__vital-label">HR:</span>
            <LinedValue
              value={formatMeasurement(growth?.heart_rate)}
              className="immunization-chart__line--vital"
            />
          </div>
          <div className="immunization-chart__vital-row">
            <span className="immunization-chart__vital-label">RR:</span>
            <LinedValue
              value={formatMeasurement(growth?.respiratory_rate)}
              className="immunization-chart__line--vital"
            />
          </div>
          <div className="immunization-chart__vital-row">
            <span className="immunization-chart__vital-label">Temp:</span>
            <LinedValue
              value={formatMeasurement(growth?.temperature_celsius)}
              className="immunization-chart__line--vital"
            />
          </div>
          <div className="immunization-chart__vital-row">
            <span className="immunization-chart__vital-label">HT:</span>
            <LinedValue
              value={formatMeasurement(growth?.length_cm)}
              className="immunization-chart__line--vital"
            />
          </div>
          <div className="immunization-chart__vital-row">
            <span className="immunization-chart__vital-label">WT:</span>
            <LinedValue
              value={formatMeasurement(growth?.weight_kg)}
              className="immunization-chart__line--vital"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default function ImmunizationChart({ infantId }) {
  const { user } = useAuth();
  const scopedClinicId = Number(user?.clinic_id || user?.facility_id || 0) || null;
  const [infant, setInfant] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [growthRecords, setGrowthRecords] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [loadError, setLoadError] = useState(null);
  const [loadWarning, setLoadWarning] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [printPaperSize, setPrintPaperSize] = useState(DEFAULT_PRINT_PAPER_SIZE);
  const printDateRange = usePrintDateRange({
    headerPrefix: "Date Range",
    fallbackLabel: "All immunization chart records",
  });

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const saveSuccessTimeoutRef = useRef(null);
  const printAreaRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveSuccessTimeoutRef.current) {
        window.clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!infantId) {
      if (!isMountedRef.current) {
        return;
      }

      setInfant(null);
      setAppointments([]);
      setGrowthRecords([]);
      setVaccinations([]);
      setLoadError(null);
      setLoadWarning(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      setLoadWarning(null);

      const [infantResult, appointmentsResult, growthResult, vaccinationResult] =
        await Promise.allSettled([
          apiClient.getInfant(infantId),
          apiClient.getAppointmentsByInfant(infantId),
          apiClient.getGrowthRecordsByInfant(infantId),
          apiClient.getVaccinationRecordsByInfant(infantId),
        ]);

      if (infantResult.status !== "fulfilled") {
        throw infantResult.reason || new Error("Failed to load infant details.");
      }

      const partialFailures = [];
      if (appointmentsResult.status === "rejected") partialFailures.push("appointments");
      if (growthResult.status === "rejected") partialFailures.push("growth records");
      if (vaccinationResult.status === "rejected") {
        partialFailures.push("vaccination records");
      }

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setInfant(normalizeInfantResponse(infantResult.value));
      setAppointments(
        appointmentsResult.status === "fulfilled"
          ? normalizeAppointmentsResponse(appointmentsResult.value)
          : [],
      );
      setGrowthRecords(
        growthResult.status === "fulfilled"
          ? normalizeGrowthRecordsResponse(growthResult.value)
          : [],
      );
      setVaccinations(
        vaccinationResult.status === "fulfilled"
          ? normalizeVaccinationRecordsResponse(vaccinationResult.value)
          : [],
      );

      if (partialFailures.length > 0) {
        setLoadWarning(
          `Some chart data could not be loaded (${partialFailures.join(", ")}). Showing available information.`,
        );
      }
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoadError(error.message || "Failed to load immunization chart.");
      setLoadWarning(null);
      setInfant(null);
      setAppointments([]);
      setGrowthRecords([]);
      setVaccinations([]);
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Real-time synchronization listeners
  useEffect(() => {
    if (!infantId) {
      return undefined;
    }

    const normalizedInfantId = Number(infantId);
    const shouldRefreshForInfant = (detail = {}) => {
      const detailInfantId = Number(
        detail?.patient_id ?? detail?.infant_id ?? detail?.child_id ?? detail?.id,
      );
      return !detailInfantId || detailInfantId === normalizedInfantId;
    };

    const handleUpdate = (event) => {
      if (shouldRefreshForInfant(event?.detail)) {
        void fetchData();
      }
    };

    window.addEventListener("vaccination-update", handleUpdate);
    window.addEventListener("appointment-update", handleUpdate);
    window.addEventListener("child-data-update", handleUpdate);
    window.addEventListener("vaccination-readiness-update", handleUpdate);

    return () => {
      window.removeEventListener("vaccination-update", handleUpdate);
      window.removeEventListener("appointment-update", handleUpdate);
      window.removeEventListener("child-data-update", handleUpdate);
      window.removeEventListener("vaccination-readiness-update", handleUpdate);
    };
  }, [fetchData, infantId]);

  const printableAppointments = useMemo(() => {
    if (!printDateRange.hasAppliedDateRange) {
      return appointments;
    }

    return filterItemsByPrintDateRange(appointments, {
      startDate: printDateRange.appliedStartDate,
      endDate: printDateRange.appliedEndDate,
      getItemDates: (entry) => [entry?.scheduled_date],
    });
  }, [
    appointments,
    printDateRange.appliedEndDate,
    printDateRange.appliedStartDate,
    printDateRange.hasAppliedDateRange,
  ]);

  const printableGrowthRecords = useMemo(() => {
    if (!printDateRange.hasAppliedDateRange) {
      return growthRecords;
    }

    return filterItemsByPrintDateRange(growthRecords, {
      startDate: printDateRange.appliedStartDate,
      endDate: printDateRange.appliedEndDate,
      getItemDates: (entry) => [entry?.measurement_date, entry?.date],
    });
  }, [
    growthRecords,
    printDateRange.appliedEndDate,
    printDateRange.appliedStartDate,
    printDateRange.hasAppliedDateRange,
  ]);

  const printableVaccinations = useMemo(() => {
    if (!printDateRange.hasAppliedDateRange) {
      return vaccinations;
    }

    return filterItemsByPrintDateRange(vaccinations, {
      startDate: printDateRange.appliedStartDate,
      endDate: printDateRange.appliedEndDate,
      getItemDates: (entry) => [entry?.admin_date, entry?.next_due_date],
    });
  }, [
    printDateRange.appliedEndDate,
    printDateRange.appliedStartDate,
    printDateRange.hasAppliedDateRange,
    vaccinations,
  ]);

  const visitSummaries = useMemo(() => {
    return VISIT_TEMPLATES.map((template) => {
      const targetDate = getTargetVisitDate(infant?.dob, template.window);
      const appointmentCandidates = printableAppointments.filter((entry) =>
        isWeeksWithinWindow(getWeeksFromDate(infant?.dob, entry?.scheduled_date), template.window),
      );
      const appointment = pickClosestRecord(
        appointmentCandidates,
        (entry) => entry?.scheduled_date,
        targetDate,
      );

      const vaccineRows = template.vaccines.map((vaccineDefinition) => {
        const matches = printableVaccinations.filter((record) =>
          isMatchingVaccineRecord(record, vaccineDefinition),
        );
        const inWindowMatches = matches.filter((record) =>
          isWeeksWithinWindow(getWeeksFromDate(infant?.dob, record?.admin_date), template.window),
        );
        const record = pickClosestRecord(
          inWindowMatches.length > 0 ? inWindowMatches : matches,
          (entry) => entry?.admin_date,
          targetDate,
        );

        return {
          ...vaccineDefinition,
          record,
          checked:
            Boolean(record?.admin_date) ||
            String(record?.status || "").trim().toLowerCase() === "completed",
        };
      });

      const growthInWindow = printableGrowthRecords.filter((record) =>
        isWeeksWithinWindow(getGrowthAgeInWeeks(record, infant?.dob), template.window),
      );

      const vaccineDate = pickClosestDateValue(
        vaccineRows.map((entry) => entry.record?.admin_date),
        targetDate,
      );
      const visitDate = pickClosestDateValue(
        [appointment?.scheduled_date, vaccineDate],
        targetDate,
      );
      const growth = pickClosestRecord(
        growthInWindow.length > 0 ? growthInWindow : growthRecords,
        (entry) => getGrowthDate(entry, infant?.dob),
        visitDate || targetDate,
      );

      const remarks = buildRemarks(
        appointment?.notes,
        growth?.notes,
        vaccineRows.map((entry) => entry.record?.notes),
      );

      const breastfeeding = formatFeedingStatus(growth?.feeding_status);

      return {
        template,
        appointment,
        growth,
        vaccineRows,
        visitDate,
        remarks,
        breastfeeding,
        tcb: "",
        hasRecordedData:
          Boolean(visitDate) ||
          Boolean(growth) ||
          vaccineRows.some((entry) => entry.checked) ||
          hasDisplayValue(remarks),
      };
    });
  }, [growthRecords, infant?.dob, printableAppointments, printableGrowthRecords, printableVaccinations]);

  const leftColumnVisits = useMemo(
    () => visitSummaries.filter((summary) => summary.template.column === "left"),
    [visitSummaries],
  );

  const rightColumnVisits = useMemo(
    () => visitSummaries.filter((summary) => summary.template.column === "right"),
    [visitSummaries],
  );

  const catchUpData = useMemo(() => {
    const matchedVaccinationIds = new Set(
      visitSummaries.flatMap((summary) =>
        summary.vaccineRows
          .map((entry) => entry.record?.id)
          .filter((value) => Number.isFinite(Number(value))),
      ),
    );

    const matchedGrowthIds = new Set(
      visitSummaries
        .map((summary) => summary.growth?.id)
        .filter((value) => Number.isFinite(Number(value))),
    );

    const matchedAppointmentIds = new Set(
      visitSummaries
        .map((summary) => summary.appointment?.id)
        .filter((value) => Number.isFinite(Number(value))),
    );

    const catchUpVaccinations = printableVaccinations.filter((record) => {
      if (!record) return false;

      if (
        Number.isFinite(Number(record.id)) &&
        matchedVaccinationIds.has(Number(record.id))
      ) {
        return false;
      }

      const vaccineKey = normalizeNameToken(record.vaccine_name);
      if ([normalizeNameToken("BCG"), normalizeNameToken("Hepa B")].includes(vaccineKey)) {
        return false;
      }

      return (
        hasDisplayValue(record.admin_date) ||
        hasDisplayValue(record.notes) ||
        hasDisplayValue(record.status) ||
        hasDisplayValue(record.next_due_date)
      );
    });

    const catchUpLines = catchUpVaccinations
      .map((record) => {
        const dateText = formatDate(record.admin_date);
        const nextDoseText = formatDate(record.next_due_date);
        const statusText = hasDisplayValue(record.status)
          ? String(record.status).trim().toUpperCase()
          : record.admin_date
            ? "COMPLETED"
            : "";

        return [
          dateText || "No date",
          [record.vaccine_name || "Unlabeled vaccine", formatDoseText(record).trim()]
            .filter(Boolean)
            .join(" "),
          statusText ? `Status: ${statusText}` : "",
          nextDoseText ? `Next: ${nextDoseText}` : "",
          hasDisplayValue(record.notes)
            ? `Notes: ${String(record.notes).trim()}`
            : "",
        ]
          .filter(Boolean)
          .join(" • ");
      })
      .slice(0, 5);

    const catchUpGrowth = [...printableGrowthRecords]
      .filter((record) => {
        const recordId = Number(record?.id);
        return !Number.isFinite(recordId) || !matchedGrowthIds.has(recordId);
      })
      .sort((left, right) => {
        const leftDate = getGrowthDate(left, infant?.dob)?.getTime() || 0;
        const rightDate = getGrowthDate(right, infant?.dob)?.getTime() || 0;
        return rightDate - leftDate;
      })[0] || null;

    const catchUpAppointment = [...printableAppointments]
      .filter((record) => {
        const recordId = Number(record?.id);
        return !Number.isFinite(recordId) || !matchedAppointmentIds.has(recordId);
      })
      .sort((left, right) => {
        const leftDate = getValidDate(left?.scheduled_date)?.getTime() || 0;
        const rightDate = getValidDate(right?.scheduled_date)?.getTime() || 0;
        return rightDate - leftDate;
      })[0] || null;

    return {
      lines: catchUpLines,
      breastfeeding: formatFeedingStatus(catchUpGrowth?.feeding_status),
      remarks: buildRemarks(
        catchUpAppointment?.notes,
        catchUpGrowth?.notes,
        catchUpVaccinations.map((record) => record?.notes).slice(0, 2),
      ),
      height: formatMeasurement(catchUpGrowth?.length_cm),
      temperature: formatMeasurement(catchUpGrowth?.temperature_celsius),
    };
  }, [
    infant?.dob,
    printableAppointments,
    printableGrowthRecords,
    printableVaccinations,
    visitSummaries,
  ]);

  const fullName = buildFullName(infant);
  const address = buildAddress(infant);
  const ageDisplay = formatAgeDisplay(infant?.dob);
  const sexValue = String(infant?.sex || "").trim().toLowerCase();
  const attendant = String(infant?.doctor_midwife_nurse || "").trim().toLowerCase();
  const deliveryType = String(infant?.type_of_delivery || "").trim().toLowerCase();
  const nbsDone = normalizeBoolean(infant?.nbs_done);
  const logoBase =
    typeof window !== "undefined" ? window.location.origin : "";
  const leftLogoSrc = logoBase ? `${logoBase}/brgy-san-nicolas-logo.png` : "/brgy-san-nicolas-logo.png";
  const rightLogoSrc = logoBase ? `${logoBase}/pasig-logo.png` : "/pasig-logo.png";

  const bcgRecord = useMemo(
    () =>
      printableVaccinations.find(
        (record) => normalizeNameToken(record?.vaccine_name) === normalizeNameToken("BCG"),
      ) || null,
    [printableVaccinations],
  );

  const hepaBRecord = useMemo(
    () =>
      printableVaccinations.find(
        (record) =>
          normalizeNameToken(record?.vaccine_name) === normalizeNameToken("Hepa B"),
      ) || null,
    [printableVaccinations],
  );

  const buildPrintableDocument = useCallback(async () => {
    const printableNode = printAreaRef.current;
    if (!printableNode) {
      return "";
    }

    const safeTitle = fullName || "Infant";
    const printableClone = printableNode.cloneNode(true);
    const printPaperConfig = getPrintPaperConfig(printPaperSize);

    const [embeddedLeftLogoSrc, embeddedRightLogoSrc] = await Promise.all([
      toEmbeddedAssetUrl(leftLogoSrc),
      toEmbeddedAssetUrl(rightLogoSrc),
    ]);

    const logoNodes = printableClone.querySelectorAll(".immunization-chart-print__logo");
    if (logoNodes[0]) {
      logoNodes[0].setAttribute("src", embeddedLeftLogoSrc);
    }
    if (logoNodes[1]) {
      logoNodes[1].setAttribute("src", embeddedRightLogoSrc);
    }

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Immunization Chart - ${safeTitle}</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @page WordSection1 {
        size: ${printPaperConfig.pageSize};
        margin: ${printPaperConfig.pageMargin};
      }

      div.WordSection1 {
        page: WordSection1;
      }

      ${buildPrintDocumentStyles(printPaperSize)}
    </style>
  </head>
  <body class="immunization-chart-export">
    <div class="WordSection1">
      ${printableClone.outerHTML}
    </div>
  </body>
</html>`;
  }, [fullName, leftLogoSrc, printPaperSize, rightLogoSrc]);

  const buildWordDocument = useCallback(async () => {
    const printPaperConfig = getPrintPaperConfig(printPaperSize);

    const [embeddedLeftLogoSrc, embeddedRightLogoSrc] = await Promise.all([
      toEmbeddedAssetUrl(leftLogoSrc),
      toEmbeddedAssetUrl(rightLogoSrc),
    ]);

    const safeTitle = fullName || "Infant";
    const ch = (checked) => `(${checked ? "\u2713" : "\u00a0"})`;

    const lbl = (text) =>
      `<td style="white-space:nowrap;font-weight:bold;font-size:7.5pt;padding-right:1mm;vertical-align:bottom;">${text}</td>`;

    const val = (text, width) => {
      const display =
        text !== null && text !== undefined && String(text).trim() !== ""
          ? String(text)
          : "\u00a0";
      return `<td style="border-bottom:1px solid #000;font-size:7.5pt;padding:0 1mm 0.2mm;vertical-align:bottom;${width ? `width:${width};` : ""}">${display}</td>`;
    };

    const vitalsBlock = (growth) =>
      `<table style="border-collapse:collapse;width:100%;">
        <tr><td colspan="2" style="font-size:7pt;font-weight:bold;text-transform:uppercase;font-family:Arial,sans-serif;padding-bottom:0.8mm;">VITAL SIGNS:</td></tr>
        <tr>${lbl("HR:")}${val(formatMeasurement(growth?.heart_rate), "14mm")}</tr>
        <tr>${lbl("RR:")}${val(formatMeasurement(growth?.respiratory_rate), "14mm")}</tr>
        <tr>${lbl("Temp:")}${val(formatMeasurement(growth?.temperature_celsius), "14mm")}</tr>
        <tr>${lbl("HT:")}${val(formatMeasurement(growth?.length_cm), "14mm")}</tr>
        <tr>${lbl("WT:")}${val(formatMeasurement(growth?.weight_kg), "14mm")}</tr>
      </table>`;

    const visitBlock = (summary) => {
      const { template, visitDate, growth, vaccineRows, remarks, breastfeeding, tcb } = summary;
      const isSixMonths = template.layout === "sixMonths" || template.age === "6 MONTHS";
      const showBf = ["6 WEEKS", "10 WEEKS", "14 WEEKS"].includes(template.age);
      const showTcb = template.age !== "12 MONTHS";

      const detailsRows = isSixMonths
        ? `${showTcb ? `<tr>${lbl("TCB:")}${val(tcb, "20mm")}</tr>` : ""}
          <tr>${lbl("DATE:")}${val(formatDate(visitDate), "20mm")}</tr>
          ${vaccineRows.map((v) => `<tr><td colspan="2" style="font-size:7.5pt;padding:0.2mm 0;"><b>${v.label}</b>&nbsp;${ch(v.checked)}</td></tr>`).join("")}
          <tr>${lbl("BREASTFEEDING? (Y/N):")}${val(breastfeeding, "10mm")}</tr>
          <tr>${lbl("OTHERS/REMARKS:")}${val(remarks, "")}</tr>`
        : `<tr>${lbl("DATE:")}${val(formatDate(visitDate), "20mm")}</tr>
          <tr><td colspan="2" style="font-size:7pt;font-weight:bold;text-transform:uppercase;font-family:Arial,sans-serif;padding:0.3mm 0;">VACCINES:</td></tr>
          ${vaccineRows.map((v) => `<tr><td colspan="2" style="font-size:7.5pt;padding:0.2mm 0;"><b>${v.label}</b>&nbsp;${ch(v.checked)}</td></tr>`).join("")}
          <tr>${lbl("OTHERS/REMARKS:")}${val(remarks, "")}</tr>
          ${showBf ? `<tr>${lbl("BREASTFEEDING? (Y/N):")}${val(breastfeeding, "10mm")}</tr>` : ""}
          ${showTcb ? `<tr>${lbl("TCB:")}${val(tcb, "20mm")}</tr>` : ""}`;

      return `
        <p style="margin:0 0 1mm;font-family:Arial,sans-serif;font-size:8.5pt;font-weight:bold;text-transform:uppercase;">${template.age}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:3mm;">
          <tr>
            <td style="vertical-align:top;width:62%;padding-right:1.5mm;">
              <table style="border-collapse:collapse;width:100%;">${detailsRows}</table>
            </td>
            <td style="vertical-align:top;">${vitalsBlock(growth)}</td>
          </tr>
        </table>`;
    };

    const catchUpRows = [0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<tr><td style="border-bottom:1px solid #000;font-size:7.5pt;padding:0 0.5mm 0.2mm;">${catchUpData.lines[i] || "\u00a0"}</td></tr>`,
      )
      .join("");

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <title>Immunization Chart - ${safeTitle}</title>
  <!--[if gte mso 9]><xml>
    <w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>
  </xml><![endif]-->
  <style>
    @page WordSection1 { size: ${printPaperConfig.pageSize}; margin: ${printPaperConfig.pageMargin}; }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 9pt; margin: 0; padding: 0; color: #000; }
    p { margin: 0; padding: 0; }
    b { font-weight: bold; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
<div class="WordSection1">
  <table style="width:100%;border-collapse:collapse;margin-bottom:3mm;">
    <tr>
      <td style="width:22mm;vertical-align:top;">
        <img src="${embeddedLeftLogoSrc}" width="83" height="83" style="width:83px;height:83px;display:block;" alt=""/>
      </td>
      <td style="text-align:center;vertical-align:middle;padding:2mm 4mm;">
        <p style="font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;margin:0;">IMMUNIZATION CHART</p>
      </td>
      <td style="width:22mm;vertical-align:top;text-align:right;">
        <img src="${embeddedRightLogoSrc}" width="83" height="83" style="width:83px;height:83px;display:block;margin-left:auto;" alt=""/>
      </td>
    </tr>
  </table>
  <p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;margin:0 0 2mm;text-transform:uppercase;">PERSONAL INFORMATION</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:3mm;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:4mm;">
        <table style="border-collapse:collapse;width:100%;">
          <tr>${lbl("NAME:")}${val(fullName, "")}</tr>
          <tr><td colspan="2" style="font-size:6.5pt;font-style:italic;padding:0.2mm 0 1mm;">&nbsp;&nbsp;&nbsp;(Last, First, MI)</td></tr>
          <tr>${lbl("ADDRESS:")}${val(address, "")}</tr>
          <tr><td style="height:1.5mm;" colspan="2"></td></tr>
          <tr>${lbl("DATE OF BIRTH:")}${val(formatDate(infant?.dob), "")}</tr>
          <tr>
            ${lbl("BIRTH WEIGHT:")}
            ${val(formatMeasurement(infant?.birth_weight), "12mm")}
            <td style="font-weight:bold;font-size:7.5pt;white-space:nowrap;padding:0 1mm;vertical-align:bottom;">KG</td>
            ${val(formatMeasurement(infant?.birth_height), "12mm")}
            <td style="font-weight:bold;font-size:7.5pt;white-space:nowrap;padding-left:1mm;vertical-align:bottom;">CM</td>
          </tr>
          <tr>${lbl("PLACE OF BIRTH:")}${val(infant?.place_of_birth, "")}</tr>
          <tr>${lbl("MOTHER'S NAME:")}${val(infant?.mother_name, "")}</tr>
          <tr>${lbl("AGE:")}${val(ageDisplay, "")}</tr>
          <tr>${lbl("BCG:")}${val(formatDate(bcgRecord?.admin_date), "28mm")}</tr>
          <tr>${lbl("HEPA B:")}${val(formatDate(hepaBRecord?.admin_date), "28mm")}</tr>
        </table>
      </td>
      <td style="width:50%;vertical-align:top;padding-left:4mm;">
        <table style="border-collapse:collapse;width:100%;">
          <tr>
            <td colspan="2" style="font-size:7.5pt;padding-bottom:1.5mm;">
              <b>GENDER:</b>&nbsp;<b>FEMALE</b>&nbsp;${ch(sexValue === "female" || sexValue === "f")}&nbsp;&nbsp;<b>MALE</b>&nbsp;${ch(sexValue === "male" || sexValue === "m")}
            </td>
          </tr>
          <tr>${lbl("TIME OF DELIVERY:")}${val(formatTimeOfDelivery(infant?.time_of_delivery), "25mm")}</tr>
          <tr>
            <td colspan="2" style="font-size:7.5pt;padding:1mm 0;">
              <b>DOCTOR</b>&nbsp;${ch(attendant.includes("doctor"))}&nbsp;
              <b>MIDWIFE</b>&nbsp;${ch(attendant.includes("midwife"))}&nbsp;
              <b>NURSE</b>&nbsp;${ch(attendant.includes("nurse"))}&nbsp;
              <b>HILOT</b>&nbsp;${ch(attendant.includes("hilot"))}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="font-size:7.5pt;padding-bottom:1mm;">
              <b>TYPE OF DELIVERY:</b>&nbsp;
              <b>NSD</b>&nbsp;${ch(deliveryType.includes("nsd") || deliveryType.includes("normal"))}&nbsp;
              <b>CS</b>&nbsp;${ch(deliveryType.includes("cs") || deliveryType.includes("c-section") || deliveryType.includes("caesarean"))}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="font-size:7.5pt;padding-bottom:1mm;">
              <b>NBS:</b>&nbsp;<b>YES</b>&nbsp;${ch(nbsDone === true)}&nbsp;<b>NO</b>&nbsp;${ch(nbsDone === false)}
            </td>
          </tr>
          <tr>${lbl("DATE:")}${val(formatDate(infant?.nbs_date), "25mm")}</tr>
        </table>
      </td>
    </tr>
  </table>
  <p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;margin:0 0 2mm;text-transform:uppercase;">VACCINATION:</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:4mm;">
        ${leftColumnVisits.map(visitBlock).join("")}
      </td>
      <td style="width:50%;vertical-align:top;padding-left:4mm;">
        ${rightColumnVisits.map(visitBlock).join("")}
        <p style="margin:1mm 0 0.8mm;font-size:9pt;font-weight:bold;font-family:'Times New Roman',serif;">CATCH UP:</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:2mm;">${catchUpRows}</table>
        <table style="border-collapse:collapse;width:100%;">
          <tr>${lbl("BREASTFEEDING? (Y/N)")}${val(catchUpData.breastfeeding, "10mm")}</tr>
          <tr>${lbl("OTHERS/REMARKS:")}${val(catchUpData.remarks, "")}</tr>
          <tr>${lbl("HT:")}${val(catchUpData.height, "12mm")}</tr>
          <tr>${lbl("TEMP:")}${val(catchUpData.temperature, "12mm")}</tr>
        </table>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
  }, [
    ageDisplay,
    address,
    attendant,
    bcgRecord,
    catchUpData,
    deliveryType,
    fullName,
    hepaBRecord,
    infant,
    leftColumnVisits,
    leftLogoSrc,
    nbsDone,
    printPaperSize,
    rightColumnVisits,
    rightLogoSrc,
    sexValue,
  ]);

  const handlePrintPdf = useCallback(async () => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const printableHtml = await buildPrintableDocument();
    if (!printableHtml || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const printFrameHandle = await writeHtmlToPrintFrame(printableHtml);
    if (!printFrameHandle) {
      return;
    }

    const { frame, frameWindow } = printFrameHandle;
    const cleanup = () => cleanupPrintFrame(frame);
    frameWindow.addEventListener?.("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 2000);
    frameWindow.focus();
    frameWindow.print();
  }, [buildPrintableDocument, printDateRange]);

  const handleDownloadPdf = useCallback(async () => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }
    if (!printAreaRef.current) {
      return;
    }

    const printEl = printAreaRef.current;
    const wrapperEl = printEl.closest(".immunization-chart__print-only");
    const paperCfg = getPrintPaperConfig(printPaperSize);
    const pagePreset = getPrintPagePreset(printPaperSize);
    const twipsToMm = (t) => (t * 25.4) / 1440;
    const pageWidthMm = twipsToMm(pagePreset.widthTwips);
    const pageHeightMm = twipsToMm(pagePreset.heightTwips);
    const contentWidthMm = parseFloat(paperCfg.documentWidth);
    const pageWidthPx = Math.round((pageWidthMm * 96) / 25.4);

    let prevWrapperStyle = null;

    try {
      if (wrapperEl) {
        prevWrapperStyle = wrapperEl.getAttribute("style") || "";
        wrapperEl.setAttribute(
          "style",
          `display:block;position:fixed;left:-${pageWidthPx + 100}px;top:0;width:${pageWidthPx}px;z-index:-1;pointer-events:none;overflow:visible;`,
        );
      }

      const images = Array.from(printEl.querySelectorAll("img"));
      await Promise.all(
        images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }
            }),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(printEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgWidthMm = contentWidthMm;
      const imgHeightMm = (canvas.height / canvas.width) * contentWidthMm;
      const leftMarginMm = (pageWidthMm - contentWidthMm) / 2;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageWidthMm, Math.max(pageHeightMm, imgHeightMm)],
        compress: true,
        putOnlyUsedFonts: true,
      });

      doc.setProperties({ title: "Immunization Chart" });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      doc.addImage(imgData, "JPEG", leftMarginMm, 0, imgWidthMm, imgHeightMm, undefined, "FAST");
      doc.save(
        `Immunization_Chart_${sanitizeFileSegment(fullName || infantId || "child")}.pdf`,
      );
    } catch (downloadError) {
      console.error("Error generating immunization chart PDF:", downloadError);
      setLoadError(
        downloadError.message || "Failed to generate the immunization chart PDF.",
      );
    } finally {
      if (wrapperEl && prevWrapperStyle !== null) {
        if (prevWrapperStyle) {
          wrapperEl.setAttribute("style", prevWrapperStyle);
        } else {
          wrapperEl.removeAttribute("style");
        }
      }
    }
  }, [fullName, infantId, printDateRange, printPaperSize]);

  const handleDownloadWord = useCallback(async () => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    try {
      const wordHtml = await buildWordDocument();
      if (!wordHtml) {
        return;
      }

      const paperCfg = getPrintPaperConfig(printPaperSize);
      const mmToTwips = (mm) => Math.round((parseFloat(mm) * 1440) / 25.4);
      const [marginTop, marginSide, marginBottom] = paperCfg.pageMargin
        .trim()
        .split(/\s+/)
        .map((v) => mmToTwips(v));
      downloadWordDocument({
        html: wordHtml,
        filename: `Immunization_Chart_${sanitizeFileSegment(fullName || infantId || "child")}.docx`,
        title: "Immunization Chart",
        page: {
          ...getPrintPagePreset(printPaperSize),
          margins: {
            top: marginTop,
            bottom: marginBottom,
            left: marginSide,
            right: marginSide,
            header: 360,
            footer: 360,
            gutter: 0,
          },
        },
      });
    } catch (downloadError) {
      console.error("Error generating immunization chart Word document:", downloadError);
      setLoadError(
        downloadError.message ||
          "Failed to generate the immunization chart Word document.",
      );
    }
  }, [buildWordDocument, fullName, infantId, printDateRange, printPaperSize]);

  const openVisitModal = (visit) => {
    setSelectedVisit(visit);
    setShowVisitModal(true);
  };

  const handleVisitSave = async (visitData) => {
    if (!isMountedRef.current || !infant) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (visitData.growth) {
        await apiClient.createGrowthRecord({
          infant_id: infantId,
          measurement_date: visitData.visit_date,
          age_in_days: Math.floor(
            (new Date(visitData.visit_date) - new Date(infant.dob)) /
              (24 * 60 * 60 * 1000),
          ),
          weight_kg: parseFloat(visitData.growth.weight) || null,
          length_cm: parseFloat(visitData.growth.height) || null,
          head_circumference_cm:
            parseFloat(visitData.growth.head_circumference) || null,
          temperature_celsius: parseFloat(visitData.growth.temperature) || null,
          heart_rate: parseInt(visitData.growth.heart_rate, 10) || null,
          respiratory_rate:
            parseInt(visitData.growth.respiratory_rate, 10) || null,
          feeding_status: visitData.growth.breastfeeding
            ? "breastfeeding"
            : "not_breastfeeding",
          health_status: "well",
          measured_by: 1,
          notes: visitData.remarks || "",
        });
      }

      if (Array.isArray(visitData.vaccines) && visitData.vaccines.length > 0) {
        const vaccines = toArrayPayload(await apiClient.getVaccines(), ["vaccines"]);
        const inventoryRecords = normalizeVaccineInventoryResponse(
          await apiClient.getVaccineInventory(
            scopedClinicId ? { clinic_id: scopedClinicId } : {},
          ),
        );

        for (const vaccineEntry of visitData.vaccines) {
          if (!vaccineEntry?.administered) {
            continue;
          }

          const vaccine = vaccines.find((entry) => entry?.name === vaccineEntry.name);
          if (!vaccine) {
            continue;
          }

          const availableLots = toArrayPayload(
            await apiClient.getAvailableInventoryLots({ vaccine_id: vaccine.id }),
            ["inventory", "lots", "batches"],
          );
          const fefoBatchOptions = buildFefoBatchOptions({
            batches: availableLots,
            inventoryRecords,
            vaccineId: vaccine.id,
            clinicId: scopedClinicId,
          });
          const selectedBatchOption =
            fefoBatchOptions.find((entry) => !entry.selection_disabled) || null;
          const selectedInventoryRecord = selectedBatchOption?.matched_inventory_record || null;
          const selectedLotBatchNumber = resolveLotBatchValue(
            selectedBatchOption?.lot_batch_number,
            selectedInventoryRecord?.lot_batch_number,
            selectedBatchOption?.lot_number,
            selectedBatchOption?.batch_number,
            vaccineEntry.lot_number,
            vaccineEntry.batch_number,
          );

          const basePayload = {
            patient_id: infantId,
            vaccine_id: vaccine.id,
            dose_no: vaccineEntry.dose_no || 1,
            admin_date: visitData.visit_date,
            administered_by: user?.id || 1,
            health_care_provider: visitData.healthcare_worker || null,
            site_of_injection: vaccineEntry.site || "Left arm",
            reactions: vaccineEntry.reactions || null,
            lot_number: selectedLotBatchNumber || vaccineEntry.lot_number || null,
            batch_number: selectedLotBatchNumber || vaccineEntry.lot_number || null,
            notes:
              visitData.remarks || `Administered during ${visitData.visit_age} visit`,
          };

          if (
            selectedBatchOption &&
            !selectedBatchOption.selection_disabled &&
            selectedInventoryRecord &&
            typeof apiClient.recordVaccinationWithInventory === "function"
          ) {
            await apiClient.recordVaccinationWithInventory({
              ...basePayload,
              batch_id: selectedBatchOption.batch_id,
              vaccine_inventory_id: selectedInventoryRecord.id,
              lot_batch_number: selectedLotBatchNumber || null,
              lot_number: selectedLotBatchNumber || null,
              batch_number: selectedLotBatchNumber || null,
              expiration_date: selectedBatchOption.expiry_date || null,
            });
          } else {
            await apiClient.createVaccinationRecord(basePayload);
          }
        }
      }

      await fetchData();

      if (!isMountedRef.current) {
        return;
      }

      setShowVisitModal(false);
      setSaveSuccess(true);

      if (saveSuccessTimeoutRef.current) {
        window.clearTimeout(saveSuccessTimeoutRef.current);
      }

      saveSuccessTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setSaveSuccess(false);
        }
      }, 3000);
    } catch (error) {
      console.error("Error saving visit record:", error);
      if (!isMountedRef.current) {
        return;
      }

      setSaveError(
        error.message || "Failed to save visit record. Please try again.",
      );
    } finally {
      if (!isMountedRef.current) {
        return;
      }

      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading immunization chart...</div>;
  }

  if (loadError) {
    return <div className="text-center py-8 text-red-600">Error: {loadError}</div>;
  }

  if (!infant) {
    return (
      <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-3">
        <FileText className="w-10 h-10 text-gray-400" />
        <span>Infant not found</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="immunization-chart__screen-shell">
        <div className="immunization-chart__shell bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="immunization-chart__screen-only p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Immunization Chart
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Detailed visit records for {infant.first_name} {infant.last_name}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <Select
                  label="Print paper size"
                  value={printPaperSize}
                  onChange={(event) => setPrintPaperSize(event.target.value)}
                  options={PRINT_PAPER_OPTIONS}
                  containerClassName="w-full sm:w-auto sm:min-w-[190px]"
                  className="min-h-[40px] py-2 text-sm"
                />
                <Button
                  variant="secondary"
                  leftIcon={<Printer className="w-4 h-4" />}
                  onClick={handlePrintPdf}
                  data-print-action="immunization-chart-print"
                >
                  Print
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<FileText className="w-4 h-4" />}
                  onClick={handleDownloadPdf}
                  data-print-action="immunization-chart-download"
                >
                  Download PDF
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<FileText className="w-4 h-4" />}
                  onClick={handleDownloadWord}
                  data-print-action="immunization-chart-download-word"
                  aria-label="Download Word"
                  title="Download Word"
                />
              </div>
            </div>

            {saveSuccess && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">
                  Visit record saved successfully!
                </p>
              </div>
            )}

            {saveError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
              </div>
            )}

            {loadWarning && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {loadWarning}
                </p>
              </div>
            )}
          </div>

          <div className="immunization-chart__canvas p-4 sm:p-6 bg-gray-100 dark:bg-gray-900/30 overflow-x-auto">
            <div className="immunization-chart__document" data-paper-size={printPaperSize}>
              <header className="immunization-chart__header">
                <div className="immunization-chart__logo-wrap">
                  <img
                    src={leftLogoSrc}
                    alt="Barangay San Nicolas logo"
                    className="immunization-chart__logo immunization-chart__logo--shield"
                  />
                </div>

                <div className="immunization-chart__title-wrap">
                  <div className="immunization-chart__title">IMMUNIZATION CHART</div>
                </div>

                <div className="immunization-chart__logo-wrap">
                  <img
                    src={rightLogoSrc}
                    alt="Pasig City logo"
                    className="immunization-chart__logo immunization-chart__logo--circle"
                  />
                </div>
              </header>

              <div className="immunization-chart__section-title immunization-chart__section-title--personal">
                PERSONAL INFORMATION
              </div>

              <section className="immunization-chart__identity-grid">
                <div className="immunization-chart__section-column">
                  <div className="immunization-chart__field-group">
                    <div className="immunization-chart__field-row">
                      <span className="immunization-chart__label">Name:</span>
                      <LinedValue value={fullName} />
                    </div>
                    <div className="immunization-chart__caption">(Last, First, MI)</div>
                  </div>

                  <div className="immunization-chart__field-group">
                    <div className="immunization-chart__field-row immunization-chart__field-row--wrap">
                      <span className="immunization-chart__label">Address:</span>
                      <div className="immunization-chart__line-stack">
                        <LinedValue value={address} />

                      </div>
                    </div>
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__line--tiny">Date of Birth:</span>
                    <LinedValue value={formatDate(infant.dob)} />
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">Birth Weight:</span>
                    <LinedValue
                      value={formatMeasurement(infant.birth_weight)}
                      className="immunization-chart__line--tiny"
                    />
                    <span className="immunization-chart__label">kg</span>
                    <LinedValue
                      value={formatMeasurement(infant.birth_height)}
                      className="immunization-chart__line--tiny"
                    />
                    <span className="immunization-chart__label">cm</span>
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">Place of Birth:</span>
                    <LinedValue value={infant.place_of_birth} />
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">Mother's Name:</span>
                    <LinedValue value={infant.mother_name} />
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">Age:</span>
                    <LinedValue value={ageDisplay} />
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">BCG:</span>
                    <LinedValue value={formatDate(bcgRecord?.admin_date)} className="immunization-chart__line--short" />
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">HEPA B:</span>
                    <LinedValue value={formatDate(hepaBRecord?.admin_date)} className="immunization-chart__line--short" />
                  </div>
                </div>

                <div className="immunization-chart__section-column">
                  <div className="immunization-chart__choice-row">
                    <span className="immunization-chart__label">Gender:</span>
                    <span className="immunization-chart__choice-set">
                      FEMALE <ChoiceIndicator checked={sexValue === "female" || sexValue === "f"} />
                    </span>
                    <span className="immunization-chart__choice-set">
                      MALE <ChoiceIndicator checked={sexValue === "male" || sexValue === "m"} />
                    </span>
                  </div>

                  <div className="immunization-chart__field-row">
                    <span className="immunization-chart__label">Time of Delivery:</span>
                    <LinedValue value={formatTimeOfDelivery(infant.time_of_delivery)} className="immunization-chart__line--short" />
                  </div>

                  <div className="immunization-chart__choice-row immunization-chart__choice-row--tight">
                    <span className="immunization-chart__choice-set">
                      DOCTOR <ChoiceIndicator checked={attendant.includes("doctor")} />
                    </span>
                    <span className="immunization-chart__choice-set">
                      MIDWIFE <ChoiceIndicator checked={attendant.includes("midwife")} />
                    </span>
                    <span className="immunization-chart__choice-set">
                      NURSE <ChoiceIndicator checked={attendant.includes("nurse")} />
                    </span>
                    <span className="immunization-chart__choice-set">
                      HILOT <ChoiceIndicator checked={attendant.includes("hilot")} />
                    </span>
                  </div>

                  <div className="immunization-chart__choice-row">
                    <span className="immunization-chart__label">Type of Delivery:</span>
                    <span className="immunization-chart__choice-set">
                      NSD <ChoiceIndicator checked={deliveryType.includes("nsd") || deliveryType.includes("normal")} />
                    </span>
                    <span className="immunization-chart__choice-set">
                      CS <ChoiceIndicator checked={deliveryType.includes("cs") || deliveryType.includes("c-section") || deliveryType.includes("caesarean")} />
                    </span>
                  </div>

                  <div className="immunization-chart__choice-row">
                    <span className="immunization-chart__label">NBS:</span>
                    <span className="immunization-chart__choice-set">
                      YES <ChoiceIndicator checked={nbsDone === true} />
                    </span>
                    <span className="immunization-chart__choice-set">
                      NO <ChoiceIndicator checked={nbsDone === false} />
                    </span>
                    <span className="immunization-chart__label">DATE:</span>
                    <LinedValue value={formatDate(infant.nbs_date)} className="immunization-chart__line--short" />
                  </div>
                </div>
              </section>

              <div className="immunization-chart__section-title immunization-chart__section-title--visits">
                VACCINATION:
              </div>

              <section className="immunization-chart__visit-grid">
                <div className="immunization-chart__visit-column">
                  {leftColumnVisits.map((summary) => (
                    <VisitSection
                      key={summary.template.age}
                      summary={summary}
                      onRecordVisit={openVisitModal}
                    />
                  ))}
                </div>

                <div className="immunization-chart__visit-column">
                  {rightColumnVisits.map((summary) => (
                    <VisitSection
                      key={summary.template.age}
                      summary={summary}
                      onRecordVisit={openVisitModal}
                    />
                  ))}

                  <section className="immunization-chart__catchup">
                    <div className="immunization-chart__catchup-title">CATCH UP:</div>
                    <div className="immunization-chart__catchup-lines">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <LinedValue key={`catchup-${index}`} value={catchUpData.lines[index] || ""} />
                      ))}
                    </div>
                  </section>

                  <section className="immunization-chart__catchup-footer">
                    <div className="immunization-chart__field-row">
                      <span className="immunization-chart__label">Breastfeeding? (Y/N)</span>
                      <LinedValue
                        value={catchUpData.breastfeeding}
                        className="immunization-chart__line--tiny"
                      />
                    </div>

                    <div className="immunization-chart__field-row immunization-chart__field-row--wrap">
                      <span className="immunization-chart__label">Others/Remarks:</span>
                      <LinedValue
                        value={catchUpData.remarks}
                        className="immunization-chart__line--tiny"
                      />
                    </div>

                    <div className="immunization-chart__field-row">
                      <span className="immunization-chart__label">HT:</span>
                      <LinedValue value={catchUpData.height} className="immunization-chart__line--tiny" />
                    </div>

                    <div className="immunization-chart__field-row">
                      <span className="immunization-chart__label">TEMP:</span>
                      <LinedValue
                        value={catchUpData.temperature}
                        className="immunization-chart__line--tiny"
                      />
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="immunization-chart__print-only">
        <div ref={printAreaRef} className="immunization-chart-print" data-paper-size={printPaperSize}>
          <header className="immunization-chart-print__header">
            <div className="immunization-chart-print__logo-wrap">
              <img
                src={leftLogoSrc}
                alt="Barangay San Nicolas logo"
                className="immunization-chart-print__logo immunization-chart-print__logo--shield"
              />
            </div>

            <div className="immunization-chart-print__title-wrap">
              <div className="immunization-chart-print__title">IMMUNIZATION CHART</div>
            </div>

            <div className="immunization-chart-print__logo-wrap">
              <img
                src={rightLogoSrc}
                alt="Pasig City logo"
                className="immunization-chart-print__logo immunization-chart-print__logo--circle"
              />
            </div>
          </header>

          <div className="immunization-chart-print__section-title">PERSONAL INFORMATION</div>

          <section className="immunization-chart-print__identity-grid">
            <div className="immunization-chart-print__section-column">
              <div className="immunization-chart-print__field-group">
                <div className="immunization-chart-print__field-row">
                  <span className="immunization-chart-print__label">NAME:</span>
                  <PrintLinedValue value={fullName} />
                </div>
                <div className="immunization-chart-print__caption">(Last, First, MI)</div>
              </div>

              <div className="immunization-chart-print__field-group">
                <div className="immunization-chart-print__field-row immunization-chart-print__field-row--wrap">
                  <span className="immunization-chart-print__label">ADDRESS:</span>
                  <div className="immunization-chart-print__line-stack">
                    <PrintLinedValue value={address} />
                    <PrintLinedValue value="" />
                  </div>
                </div>
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__stacked-label">
                  <span>Date of</span>
                  <span>Birth:</span>
                </span>
                <PrintLinedValue value={formatDate(infant.dob)} />
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">BIRTH WEIGHT:</span>
                <PrintLinedValue
                  value={formatMeasurement(infant.birth_weight)}
                  className="immunization-chart-print__line--tiny"
                />
                <span className="immunization-chart-print__label">KG</span>
                <PrintLinedValue
                  value={formatMeasurement(infant.birth_height)}
                  className="immunization-chart-print__line--tiny"
                />
                <span className="immunization-chart-print__label">CM</span>
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">PLACE OF BIRTH:</span>
                <PrintLinedValue value={infant.place_of_birth} />
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">MOTHER'S NAME:</span>
                <PrintLinedValue value={infant.mother_name} />
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">AGE:</span>
                <PrintLinedValue value={ageDisplay} className="immunization-chart-print__line--medium" />
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">BCG:</span>
                <PrintLinedValue
                  value={formatDate(bcgRecord?.admin_date)}
                  className="immunization-chart-print__line--short"
                />
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">HEPA B:</span>
                <PrintLinedValue
                  value={formatDate(hepaBRecord?.admin_date)}
                  className="immunization-chart-print__line--short"
                />
              </div>
            </div>

            <div className="immunization-chart-print__section-column">
              <div className="immunization-chart-print__choice-row">
                <span className="immunization-chart-print__label">GENDER:</span>
                <span className="immunization-chart-print__choice-set">
                  FEMALE <PrintChoiceIndicator checked={sexValue === "female" || sexValue === "f"} />
                </span>
                <span className="immunization-chart-print__choice-set">
                  MALE <PrintChoiceIndicator checked={sexValue === "male" || sexValue === "m"} />
                </span>
              </div>

              <div className="immunization-chart-print__field-row">
                <span className="immunization-chart-print__label">TIME OF DELIVERY:</span>
                <PrintLinedValue
                  value={formatTimeOfDelivery(infant.time_of_delivery)}
                  className="immunization-chart-print__line--medium"
                />
              </div>

              <div className="immunization-chart-print__choice-row">
                <span className="immunization-chart-print__choice-set">
                  DOCTOR <PrintChoiceIndicator checked={attendant.includes("doctor")} />
                </span>
                <span className="immunization-chart-print__choice-set">
                  MIDWIFE <PrintChoiceIndicator checked={attendant.includes("midwife")} />
                </span>
                <span className="immunization-chart-print__choice-set">
                  NURSE <PrintChoiceIndicator checked={attendant.includes("nurse")} />
                </span>
                <span className="immunization-chart-print__choice-set">
                  HILOT <PrintChoiceIndicator checked={attendant.includes("hilot")} />
                </span>
              </div>

              <div className="immunization-chart-print__choice-row">
                <span className="immunization-chart-print__label">TYPE OF DELIVERY:</span>
                <span className="immunization-chart-print__choice-set">
                  NSD <PrintChoiceIndicator checked={deliveryType.includes("nsd") || deliveryType.includes("normal")} />
                </span>
                <span className="immunization-chart-print__choice-set">
                  CS <PrintChoiceIndicator checked={deliveryType.includes("cs") || deliveryType.includes("c-section") || deliveryType.includes("caesarean")} />
                </span>
              </div>

              <div className="immunization-chart-print__choice-row">
                <span className="immunization-chart-print__label">NBS:</span>
                <span className="immunization-chart-print__choice-set">
                  YES <PrintChoiceIndicator checked={nbsDone === true} />
                </span>
                <span className="immunization-chart-print__choice-set">
                  NO <PrintChoiceIndicator checked={nbsDone === false} />
                </span>
                <span className="immunization-chart-print__label">DATE:</span>
                <PrintLinedValue
                  value={formatDate(infant.nbs_date)}
                  className="immunization-chart-print__line--medium"
                />
              </div>
            </div>
          </section>

          <div className="immunization-chart-print__section-title">VACCINATION:</div>

          <section className="immunization-chart-print__visit-grid">
            <div className="immunization-chart-print__visit-column">
              {leftColumnVisits.map((summary) => (
                <PrintVisitSection key={`print-${summary.template.age}`} summary={summary} />
              ))}
            </div>

            <div className="immunization-chart-print__visit-column">
              {rightColumnVisits.map((summary) => (
                <PrintVisitSection key={`print-${summary.template.age}`} summary={summary} />
              ))}

              <section className="immunization-chart-print__catchup">
                <div className="immunization-chart-print__catchup-title">CATCH UP:</div>
                <div className="immunization-chart-print__catchup-lines">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <PrintLinedValue
                      key={`print-catchup-${index}`}
                      value={catchUpData.lines[index] || ""}
                    />
                  ))}
                </div>
              </section>

              <section className="immunization-chart-print__catchup-footer">
                <div className="immunization-chart-print__field-row">
                  <span className="immunization-chart-print__label">BREASTFEEDING? (Y/N)</span>
                  <PrintLinedValue
                    value={catchUpData.breastfeeding}
                    className="immunization-chart-print__line--tiny"
                  />
                </div>

                <div className="immunization-chart-print__field-row">
                  <span className="immunization-chart-print__label">OTHERS/REMARKS:</span>
                  <PrintLinedValue
                    value={catchUpData.remarks}
                    className="immunization-chart-print__line--tiny"
                  />
                </div>

                <div className="immunization-chart-print__field-row">
                  <span className="immunization-chart-print__label">HT:</span>
                  <PrintLinedValue
                    value={catchUpData.height}
                    className="immunization-chart-print__line--tiny"
                  />
                </div>

                <div className="immunization-chart-print__field-row">
                  <span className="immunization-chart-print__label">TEMP:</span>
                  <PrintLinedValue
                    value={catchUpData.temperature}
                    className="immunization-chart-print__line--tiny"
                  />
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>

      <Modal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        title={selectedVisit ? `${selectedVisit.title} - Record Visit` : "Record Visit"}
        size="lg"
      >
        {saving && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving visit record...
            </p>
          </div>
        )}

        {selectedVisit && (
          <VisitRecordingForm
            infant={infant}
            visit={selectedVisit}
            onClose={() => setShowVisitModal(false)}
            onSave={handleVisitSave}
            disabled={saving}
          />
        )}
      </Modal>

      <style>{`${buildPrintPaperStyles(printPaperSize)}\n${PRINTABLE_STYLES}\n${buildPrintDocumentStyles(printPaperSize)}`}</style>
    </div>
  );
}
