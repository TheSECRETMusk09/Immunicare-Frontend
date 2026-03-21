import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Alert, LoadingSpinner } from "./UI";
import {
  normalizeInfantResponse,
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationSchedulesResponse,
  buildVaccinationScheduleTimeline,
} from "../utils/adminDataAdapters";

const DATE_ONLY_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DUE_SOON_WINDOW_DAYS = 14;

const BOOKLET_VACCINE_ROWS = [
  {
    key: "bcg",
    vaccineLabel: "BCG Vaccine",
    slots: [
      {
        key: "bcg-1",
        displayDoseNumber: 1,
        scheduleLabel: "At birth",
        targetWeeks: 0,
        window: { min: 0, max: 4 },
        matchers: [{ names: ["BCG", "BCG Vaccine"], doseNumbers: [1] }],
      },
    ],
  },
  {
    key: "hepb",
    vaccineLabel: "Hepatitis B Vaccine",
    slots: [
      {
        key: "hepb-1",
        displayDoseNumber: 1,
        scheduleLabel: "At birth",
        targetWeeks: 0,
        window: { min: 0, max: 4 },
        matchers: [
          {
            names: [
              "Hepa B",
              "Hep B",
              "Hepatitis B",
              "Hepatitis B Vaccine",
            ],
            doseNumbers: [1],
          },
        ],
      },
    ],
  },
  {
    key: "penta",
    vaccineLabel: "Pentavalent Vaccine (DPT-Hep B-HIB)",
    slots: [
      {
        key: "penta-1",
        displayDoseNumber: 1,
        scheduleLabel: "1½ mos",
        targetWeeks: 6,
        window: { min: 5, max: 7 },
        matchers: [
          {
            names: [
              "Penta Valent",
              "Pentavalent Vaccine",
              "Pentavalent",
              "DPT-Hep B-HIB",
            ],
            doseNumbers: [1],
          },
        ],
      },
      {
        key: "penta-2",
        displayDoseNumber: 2,
        scheduleLabel: "2½ mos",
        targetWeeks: 10,
        window: { min: 9, max: 11 },
        matchers: [
          {
            names: [
              "Penta Valent",
              "Pentavalent Vaccine",
              "Pentavalent",
              "DPT-Hep B-HIB",
            ],
            doseNumbers: [2],
          },
        ],
      },
      {
        key: "penta-3",
        displayDoseNumber: 3,
        scheduleLabel: "3½ mos",
        targetWeeks: 14,
        window: { min: 13, max: 15 },
        matchers: [
          {
            names: [
              "Penta Valent",
              "Pentavalent Vaccine",
              "Pentavalent",
              "DPT-Hep B-HIB",
            ],
            doseNumbers: [3],
          },
        ],
      },
    ],
  },
  {
    key: "opv",
    vaccineLabel: "Oral Polio Vaccine (OPV)",
    slots: [
      {
        key: "opv-1",
        displayDoseNumber: 1,
        scheduleLabel: "1½ mos",
        targetWeeks: 6,
        window: { min: 5, max: 7 },
        matchers: [
          {
            names: ["OPV 20-doses", "Oral Polio Vaccine", "OPV"],
            doseNumbers: [1],
          },
        ],
      },
      {
        key: "opv-2",
        displayDoseNumber: 2,
        scheduleLabel: "2½ mos",
        targetWeeks: 10,
        window: { min: 9, max: 11 },
        matchers: [
          {
            names: ["OPV 20-doses", "Oral Polio Vaccine", "OPV"],
            doseNumbers: [2],
          },
        ],
      },
      {
        key: "opv-3",
        displayDoseNumber: 3,
        scheduleLabel: "3½ mos",
        targetWeeks: 14,
        window: { min: 13, max: 15 },
        matchers: [
          {
            names: ["OPV 20-doses", "Oral Polio Vaccine", "OPV"],
            doseNumbers: [3],
          },
        ],
      },
    ],
  },
  {
    key: "ipv",
    vaccineLabel: "Inactivated Polio Vaccine (IPV)",
    slots: [
      {
        key: "ipv-1",
        displayDoseNumber: 1,
        scheduleLabel: "3½ mos",
        targetWeeks: 14,
        window: { min: 13, max: 15 },
        matchers: [
          {
            names: ["IPV multi dose", "Inactivated Polio Vaccine", "IPV"],
            doseNumbers: [1],
          },
        ],
      },
      {
        key: "ipv-2",
        displayDoseNumber: 2,
        scheduleLabel: "9 mos",
        targetWeeks: 39,
        window: { min: 32, max: 40 },
        matchers: [
          {
            names: ["IPV multi dose", "Inactivated Polio Vaccine", "IPV"],
            doseNumbers: [2, 1],
          },
        ],
      },
    ],
  },
  {
    key: "pcv",
    vaccineLabel: "Pneumococcal Conjugate Vaccine (PCV)",
    slots: [
      {
        key: "pcv-1",
        displayDoseNumber: 1,
        scheduleLabel: "1½ mos",
        targetWeeks: 6,
        window: { min: 5, max: 7 },
        matchers: [
          {
            names: [
              "PCV 10",
              "PCV 13",
              "PCV 13 / PCV 10",
              "PCV 13/PCV 10",
              "Pneumococcal Conjugate Vaccine",
              "PCV",
            ],
            doseNumbers: [1],
          },
        ],
      },
      {
        key: "pcv-2",
        displayDoseNumber: 2,
        scheduleLabel: "2½ mos",
        targetWeeks: 10,
        window: { min: 9, max: 11 },
        matchers: [
          {
            names: [
              "PCV 10",
              "PCV 13",
              "PCV 13 / PCV 10",
              "PCV 13/PCV 10",
              "Pneumococcal Conjugate Vaccine",
              "PCV",
            ],
            doseNumbers: [2],
          },
        ],
      },
      {
        key: "pcv-3",
        displayDoseNumber: 3,
        scheduleLabel: "3½ mos",
        targetWeeks: 14,
        window: { min: 13, max: 15 },
        matchers: [
          {
            names: [
              "PCV 10",
              "PCV 13",
              "PCV 13 / PCV 10",
              "PCV 13/PCV 10",
              "Pneumococcal Conjugate Vaccine",
              "PCV",
            ],
            doseNumbers: [3],
          },
        ],
      },
    ],
  },
  {
    key: "mmr",
    vaccineLabel: "Measles, Mumps, Rubella Vaccine (MMR)",
    slots: [
      {
        key: "mmr-1",
        displayDoseNumber: 1,
        scheduleLabel: "9 mos",
        targetWeeks: 39,
        window: { min: 32, max: 40 },
        matchers: [
          {
            names: [
              "Measles & Rubella (MR)",
              "Measles & Rubella (P)",
              "MR",
              "MMR",
            ],
            doseNumbers: [1],
          },
        ],
      },
      {
        key: "mmr-2",
        displayDoseNumber: 2,
        scheduleLabel: "1 year",
        targetWeeks: 52,
        window: { min: 44, max: 56 },
        matchers: [
          {
            names: [
              "MMR",
              "Measles & Rubella (MR)",
              "Measles & Rubella (P)",
              "MR",
            ],
            doseNumbers: [2, 1],
          },
        ],
      },
    ],
  },
];

const PRINTABLE_STYLES = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 18px;
    background: #f3f4f6;
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
  }

  .record-booklet-print {
    width: min(100%, 1120px);
    margin: 0 auto;
    background: #ffffff;
    padding: 24px 22px 28px;
  }

  .record-booklet-print__title {
    margin: 0 0 12px;
    font-size: 28px;
    font-weight: 800;
    line-height: 1.05;
  }

  .record-booklet-print__details {
    display: grid;
    grid-template-columns: 1.2fr 1fr 0.85fr;
    gap: 24px;
    margin-bottom: 22px;
  }

  .record-booklet-print__detail-column {
    min-width: 0;
  }

  .record-booklet-print__field {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 14px;
    line-height: 1.1;
  }

  .record-booklet-print__field--stacked {
    align-items: flex-start;
  }

  .record-booklet-print__label {
    font-weight: 700;
    white-space: nowrap;
  }

  .record-booklet-print__value {
    display: inline-flex;
    align-items: flex-end;
    min-height: 18px;
    padding: 0 2px 1px;
  }

  .record-booklet-print__value--filled {
    border-bottom: none;
    min-width: 0;
  }

  .record-booklet-print__value--placeholder {
    border-bottom: 1.5px solid #374151;
  }

  .record-booklet-print__value--wide {
    min-width: 190px;
  }

  .record-booklet-print__value--medium {
    min-width: 136px;
  }

  .record-booklet-print__value--narrow {
    min-width: 86px;
  }

  .record-booklet-print__table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 6px;
  }

  .record-booklet-print__table th {
    background: #f4b24d;
    color: #111827;
    font-size: 13px;
    font-weight: 700;
    text-align: center;
    padding: 9px 10px;
    border: 2px solid #0f6967;
  }

  .record-booklet-print__table td {
    background: #ffffff;
    border: 2px solid #0f6967;
    padding: 8px 10px;
    vertical-align: top;
    font-size: 13px;
  }

  .record-booklet-print__vaccine {
    font-weight: 700;
  }

  .record-booklet-print__dose-list,
  .record-booklet-print__date-grid,
  .record-booklet-print__remarks {
    min-height: 42px;
  }

  .record-booklet-print__dose-list {
    display: grid;
    gap: 6px;
  }

  .record-booklet-print__dose-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .record-booklet-print__dose-badge {
    display: inline-flex;
    width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #f4b24d;
    font-weight: 700;
    font-size: 11px;
    color: #111827;
    flex-shrink: 0;
  }

  .record-booklet-print__dose-label {
    font-size: 12px;
    font-weight: 600;
  }

  .record-booklet-print__date-grid {
    display: grid;
    gap: 6px;
  }

  .record-booklet-print__date-slot {
    position: relative;
    min-height: 34px;
    border: 1.5px solid #94a3b8;
    padding: 12px 8px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
  }

  .record-booklet-print__date-slot-index {
    position: absolute;
    top: 4px;
    left: 6px;
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
  }

  .record-booklet-print__date-slot-value {
    min-height: 14px;
  }

  .record-booklet-print__remarks {
    line-height: 1.25;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .record-booklet-print__empty-row td {
    min-height: 34px;
    height: 34px;
  }

  @media print {
    @page {
      size: landscape;
      margin: 10mm;
    }

    body {
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .record-booklet-print {
      width: 100%;
      padding: 0;
      box-shadow: none;
    }
  }
`;

const hasDisplayValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const normalizeNameToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeStatusValue = (value, fallback = "pending") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized || fallback;
};

const parseDateValue = (value) => {
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

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatDate = (value) => {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) return "";

  return [parsedDate.getMonth() + 1, parsedDate.getDate(), parsedDate.getFullYear()]
    .map((part, index) =>
      index < 2 ? String(part).padStart(2, "0") : String(part),
    )
    .join("/");
};

const formatMeasurement = (value, unit = "") => {
  if (!hasDisplayValue(value)) return "";

  const numericValue = Number(value);
  const normalizedValue = Number.isFinite(numericValue)
    ? Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(1).replace(/\.0$/, "")
    : String(value).trim();

  return unit ? `${normalizedValue} ${unit}` : normalizedValue;
};

const buildChildFullName = (infant) => {
  if (!infant) return "";

  const firstName = String(infant.first_name || "").trim();
  const lastName = String(infant.last_name || "").trim();
  const middleInitial = hasDisplayValue(infant.middle_name)
    ? `${String(infant.middle_name).trim().charAt(0)}.`
    : "";

  if (lastName && firstName) {
    return [`${lastName}, ${firstName}`, middleInitial].filter(Boolean).join(" ");
  }

  return [firstName, middleInitial, lastName].filter(Boolean).join(" ");
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

const getSexLabel = (value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (["m", "male"].includes(normalizedValue)) return "Male";
  if (["f", "female"].includes(normalizedValue)) return "Female";
  return hasDisplayValue(value) ? String(value).trim() : "";
};

const getWeeksFromDate = (dob, value) => {
  const birthDate = parseDateValue(dob);
  const targetDate = parseDateValue(value);
  if (!birthDate || !targetDate) {
    return null;
  }

  return Math.floor((targetDate - birthDate) / (7 * 24 * 60 * 60 * 1000));
};

const isWeeksWithinWindow = (weeks, window) =>
  Number.isFinite(weeks) && weeks >= window.min && weeks <= window.max;

const getSlotTargetDate = (dob, slot) => {
  const birthDate = parseDateValue(dob);
  if (!birthDate || !Number.isFinite(slot?.targetWeeks)) {
    return null;
  }

  const targetDate = new Date(birthDate);
  targetDate.setDate(targetDate.getDate() + Number(slot.targetWeeks) * 7);
  return targetDate;
};

const buildRemarks = (...sources) => {
  const remarks = sources
    .flatMap((source) => (Array.isArray(source) ? source : [source]))
    .filter(hasDisplayValue)
    .map((value) => String(value).trim());

  return [...new Set(remarks)].join("\n");
};

const getDoseMatchRank = (recordLike, doseNumbers = []) => {
  if (!Array.isArray(doseNumbers) || doseNumbers.length === 0) {
    return 0;
  }

  const doseNumber = Number(recordLike?.dose_no ?? recordLike?.dose_number ?? 1);
  if (!Number.isFinite(doseNumber)) {
    return null;
  }

  const matchedIndex = doseNumbers.indexOf(doseNumber);
  return matchedIndex >= 0 ? matchedIndex : null;
};

const matchesRecordName = (record, candidateNames = []) => {
  const recordName = normalizeNameToken(record?.vaccine_name);
  if (!recordName) return false;

  return candidateNames
    .map(normalizeNameToken)
    .filter(Boolean)
    .some(
      (candidate) =>
        candidate === recordName ||
        candidate.includes(recordName) ||
        recordName.includes(candidate),
    );
};

const scoreRecordLikeForSlot = ({
  recordLike,
  slot,
  infantDob,
  resolveDate,
}) => {
  const referenceDate = parseDateValue(resolveDate(recordLike));
  const targetDate = getSlotTargetDate(infantDob, slot);
  const weeksFromBirth = getWeeksFromDate(infantDob, referenceDate);
  const isInWindow = isWeeksWithinWindow(weeksFromBirth, slot.window);

  let bestScore = null;

  slot.matchers.forEach((matcher) => {
    if (!matchesRecordName(recordLike, matcher.names)) {
      return;
    }

    const doseRank = getDoseMatchRank(recordLike, matcher.doseNumbers);
    if (doseRank === null) {
      return;
    }

    const distanceDays =
      targetDate && referenceDate
        ? Math.abs(referenceDate - targetDate) / (24 * 60 * 60 * 1000)
        : 999;

    const score =
      1000 +
      (doseRank === 0 ? 400 : Math.max(180, 280 - doseRank * 40)) +
      (isInWindow ? 260 : Math.max(0, 120 - Math.round(distanceDays / 7) * 10)) +
      (referenceDate ? 40 : 0);

    if (bestScore === null || score > bestScore) {
      bestScore = score;
    }
  });

  return bestScore;
};

const assignItemsToSlots = ({ items = [], slots = [], scorer }) => {
  const enrichedItems = (Array.isArray(items) ? items : []).map((item, index) => ({
    item,
    key:
      item?.id ??
      `${item?.vaccine_name || "item"}-${item?.dose_number || item?.dose_no || 0}-${item?.admin_date || item?.due_date || "no-date"}-${index}`,
  }));

  const candidatesBySlot = slots.map((slot) => ({
    slotKey: slot.key,
    candidates: enrichedItems
      .map((entry) => ({
        ...entry,
        score: scorer(entry.item, slot),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score),
  }));

  let bestAssignment = { totalScore: -1, assignments: new Map() };

  const search = (slotIndex, usedKeys, assignments, totalScore) => {
    if (slotIndex >= candidatesBySlot.length) {
      if (totalScore > bestAssignment.totalScore) {
        bestAssignment = {
          totalScore,
          assignments: new Map(assignments),
        };
      }
      return;
    }

    const currentSlot = candidatesBySlot[slotIndex];

    search(slotIndex + 1, usedKeys, assignments, totalScore);

    currentSlot.candidates.forEach((candidate) => {
      if (usedKeys.has(candidate.key)) {
        return;
      }

      const nextUsedKeys = new Set(usedKeys);
      nextUsedKeys.add(candidate.key);

      const nextAssignments = new Map(assignments);
      nextAssignments.set(currentSlot.slotKey, candidate.item);

      search(slotIndex + 1, nextUsedKeys, nextAssignments, totalScore + candidate.score);
    });
  };

  search(0, new Set(), new Map(), 0);

  return bestAssignment.assignments;
};

const deriveSlotStatus = ({ record, infantDob, slot, referenceDate = new Date() }) => {
  const explicitStatus = normalizeStatusValue(record?.status, "");
  const dueDate = getSlotTargetDate(infantDob, slot);
  const now = parseDateValue(referenceDate) || new Date();
  const dueSoonThreshold = new Date(now);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + DUE_SOON_WINDOW_DAYS);

  if (record?.admin_date || explicitStatus === "completed") {
    return "completed";
  }

  if (explicitStatus && !["pending", "scheduled"].includes(explicitStatus)) {
    return explicitStatus;
  }

  if (dueDate && dueDate < now) {
    return "overdue";
  }

  if (dueDate && dueDate <= dueSoonThreshold) {
    return "due";
  }

  return "pending";
};

const buildBookletRows = ({
  records = [],
  timeline = [],
  infantDob,
  referenceDate = new Date(),
}) =>
  BOOKLET_VACCINE_ROWS.map((row) => {
    const recordAssignments = assignItemsToSlots({
      items: records,
      slots: row.slots,
      scorer: (record, slot) =>
        scoreRecordLikeForSlot({
          recordLike: record,
          slot,
          infantDob,
          resolveDate: (entry) => entry?.admin_date,
        }),
    });

    const timelineAssignments = assignItemsToSlots({
      items: timeline,
      slots: row.slots,
      scorer: (entry, slot) =>
        scoreRecordLikeForSlot({
          recordLike: entry,
          slot,
          infantDob,
          resolveDate: (timelineEntry) => timelineEntry?.admin_date ?? timelineEntry?.due_date,
        }),
    });

    const slots = row.slots.map((slot) => {
      const record = recordAssignments.get(slot.key) || null;
      const timelineEntry = timelineAssignments.get(slot.key) || null;
      const timelineStatus = normalizeStatusValue(timelineEntry?.status, "");
      const derivedStatus = deriveSlotStatus({ record, infantDob, slot, referenceDate });

      return {
        ...slot,
        record,
        timelineEntry,
        adminDate: record?.admin_date ?? null,
        notes: record?.notes ?? "",
        status:
          derivedStatus === "completed"
            ? "completed"
            : timelineStatus && timelineStatus !== "pending"
              ? timelineStatus
              : derivedStatus,
      };
    });

    return {
      ...row,
      slots,
      remarks: buildRemarks(slots.map((slot) => slot.notes)),
    };
  });

const getStatusBadgeClassName = (status) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200";
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200";
    case "due":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  }
};

const PrintableField = ({ label, value, widthClassName = "record-booklet-print__value--wide" }) => (
  <div className="record-booklet-print__field">
    <span className="record-booklet-print__label">{label}</span>
    <span
      className={`record-booklet-print__value ${widthClassName} ${
        hasDisplayValue(value)
          ? "record-booklet-print__value--filled"
          : "record-booklet-print__value--placeholder"
      }`.trim()}
    >
      {hasDisplayValue(value) ? value : "\u00A0"}
    </span>
  </div>
);

export default function ImmunizationRecordBooklet({ infantId }) {
  const [infant, setInfant] = useState(null);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const printAreaRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!infantId) {
      if (!isMountedRef.current) {
        return;
      }

      setInfant(null);
      setVaccinationRecords([]);
      setVaccinationSchedules([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [infantData, vaccinationData, schedulesData] = await Promise.all([
        apiClient.getInfant(infantId),
        apiClient.getVaccinationRecordsByInfant(infantId),
        apiClient.getVaccinationSchedules(),
      ]);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setInfant(normalizeInfantResponse(infantData));
      setVaccinationRecords(normalizeVaccinationRecordsResponse(vaccinationData));
      setVaccinationSchedules(normalizeVaccinationSchedulesResponse(schedulesData));
    } catch (fetchError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(fetchError.message || "Failed to load immunization records.");
      setInfant(null);
      setVaccinationRecords([]);
      setVaccinationSchedules([]);
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

  useEffect(() => {
    if (!infantId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchData();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [infantId, fetchData]);

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

    const handleVaccinationUpdate = (event) => {
      if (shouldRefreshForInfant(event?.detail)) {
        void fetchData();
      }
    };

    const handleChildUpdate = (event) => {
      if (shouldRefreshForInfant(event?.detail)) {
        void fetchData();
      }
    };

    window.addEventListener("vaccination-update", handleVaccinationUpdate);
    window.addEventListener("child-data-update", handleChildUpdate);

    return () => {
      window.removeEventListener("vaccination-update", handleVaccinationUpdate);
      window.removeEventListener("child-data-update", handleChildUpdate);
    };
  }, [fetchData, infantId]);

  const vaccinationTimeline = useMemo(
    () =>
      buildVaccinationScheduleTimeline({
        schedules: vaccinationSchedules,
        records: vaccinationRecords,
        infantDob: infant?.dob,
      }),
    [infant?.dob, vaccinationRecords, vaccinationSchedules],
  );

  const bookletRows = useMemo(
    () =>
      buildBookletRows({
        records: vaccinationRecords,
        timeline: vaccinationTimeline,
        infantDob: infant?.dob,
      }),
    [infant?.dob, vaccinationRecords, vaccinationTimeline],
  );

  const childName = useMemo(() => buildChildFullName(infant), [infant]);
  const address = useMemo(() => buildAddress(infant), [infant]);
  const birthDate = formatDate(infant?.dob);
  const birthWeight = formatMeasurement(infant?.birth_weight, "kg");
  const birthHeight = formatMeasurement(infant?.birth_height, "cm");
  const sexLabel = getSexLabel(infant?.sex);

  const summaryFields = useMemo(
    () => [
      { label: "Child's Name", value: childName },
      { label: "Date of Birth", value: birthDate },
      { label: "Address", value: address },
      { label: "Mother's Name", value: infant?.mother_name || "" },
      { label: "Father's Name", value: infant?.father_name || "" },
      { label: "Place of Birth", value: infant?.place_of_birth || "" },
      { label: "Birth Weight", value: birthWeight },
      { label: "Birth Height", value: birthHeight },
      { label: "Sex", value: sexLabel },
      { label: "Barangay", value: infant?.barangay || "" },
      { label: "Family Number", value: infant?.family_no || "" },
      { label: "Health Center", value: infant?.health_center || "" },
    ],
    [
      address,
      birthDate,
      birthHeight,
      birthWeight,
      childName,
      infant?.barangay,
      infant?.family_no,
      infant?.father_name,
      infant?.health_center,
      infant?.mother_name,
      infant?.place_of_birth,
      sexLabel,
    ],
  );

  const buildPrintableDocument = useCallback(() => {
    const printableNode = printAreaRef.current;
    if (!printableNode) {
      return "";
    }

    const safeTitle = childName || "Immunization Record Booklet";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Immunization Record Booklet - ${safeTitle}</title>
    <style>${PRINTABLE_STYLES}</style>
  </head>
  <body>
    ${printableNode.outerHTML}
  </body>
</html>`;
  }, [childName]);

  const handlePrint = useCallback(() => {
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
  }, [buildPrintableDocument]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinner size="lg" />
        <span className="mt-3 text-gray-600 dark:text-gray-400">
          Loading immunization records...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title="Error loading immunization records">
        {error}
        <div className="mt-4">
          <Button onClick={fetchData} size="sm">
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!infant) {
    return (
      <Alert variant="warning" title="Infant not found">
        The selected infant record is no longer available.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4 flex-1 min-w-0">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Child Immunization Record Booklet
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Vaccine rows and date slots are synchronized per child, vaccine,
                  and dose using the stored immunization records.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {summaryFields.map((field) => (
                  <div
                    key={field.label}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3"
                  >
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                      {field.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                      {hasDisplayValue(field.value) ? field.value : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 self-start">
              <Button onClick={handlePrint} variant="secondary">
                📄 Download PDF
              </Button>
              <Button onClick={handlePrint}>🖨️ Print</Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Bakuna (Vaccine)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Doses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date Administered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Remarks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {bookletRows.map((row) => {
                const noteEntries = row.slots.filter((slot) => hasDisplayValue(slot.notes));

                return (
                  <tr key={row.key}>
                    <td className="px-6 py-4 align-top">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.vaccineLabel}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        {row.slots.map((slot) => (
                          <div key={slot.key} className="flex items-center gap-2 text-sm">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-semibold text-xs">
                              {slot.displayDoseNumber}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                              {slot.scheduleLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div
                        className="grid gap-2 min-w-[240px]"
                        style={{
                          gridTemplateColumns: `repeat(${row.slots.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {row.slots.map((slot) => (
                          <div
                            key={slot.key}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2"
                          >
                            <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                              Dose {slot.displayDoseNumber}
                            </div>
                            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {hasDisplayValue(slot.adminDate)
                                ? formatDate(slot.adminDate)
                                : "—"}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                              {slot.scheduleLabel}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                      {noteEntries.length > 0 ? (
                        <div className="space-y-2 min-w-[220px]">
                          {noteEntries.map((slot) => (
                            <div key={`${row.key}-${slot.key}-note`}>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                Dose {slot.displayDoseNumber}:
                              </span>{" "}
                              <span>{slot.notes}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        {row.slots.map((slot) => (
                          <div key={`${row.key}-${slot.key}-status`} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[52px]">
                              Dose {slot.displayDoseNumber}
                            </span>
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getStatusBadgeClassName(
                                slot.status,
                              )}`}
                            >
                              {slot.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={printAreaRef} className="hidden">
        <div className="record-booklet-print">
          <h1 className="record-booklet-print__title">Child Immunization Record</h1>

          <section className="record-booklet-print__details">
            <div className="record-booklet-print__detail-column">
              <PrintableField label="Child's name:" value={childName} />
              <PrintableField
                label="Date of birth:"
                value={birthDate}
                widthClassName="record-booklet-print__value--medium"
              />
              <PrintableField label="Place of birth:" value={infant.place_of_birth} />
              <PrintableField label="Address:" value={address} />
            </div>

            <div className="record-booklet-print__detail-column">
              <PrintableField label="Mother's name:" value={infant.mother_name} />
              <PrintableField label="Father's name:" value={infant.father_name} />
              <PrintableField
                label="Birth height:"
                value={birthHeight}
                widthClassName="record-booklet-print__value--narrow"
              />
              <PrintableField
                label="Birth weight:"
                value={birthWeight}
                widthClassName="record-booklet-print__value--narrow"
              />
              <PrintableField
                label="Sex:"
                value={sexLabel}
                widthClassName="record-booklet-print__value--narrow"
              />
            </div>

            <div className="record-booklet-print__detail-column">
              <PrintableField label="Health Center:" value={infant.health_center} />
              <PrintableField label="Barangay:" value={infant.barangay} />
              <PrintableField
                label="Family no.:"
                value={infant.family_no}
                widthClassName="record-booklet-print__value--medium"
              />
            </div>
          </section>

          <table className="record-booklet-print__table">
            <thead>
              <tr>
                <th>Bakuna</th>
                <th>Doses</th>
                <th>
                  Petsa ng bakuna
                  <br />
                  <span style={{ fontSize: "11px", fontWeight: 600 }}>MM/DD/YY</span>
                </th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {bookletRows.map((row) => (
                <tr key={`print-${row.key}`}>
                  <td className="record-booklet-print__vaccine">{row.vaccineLabel}</td>
                  <td>
                    <div className="record-booklet-print__dose-list">
                      {row.slots.map((slot) => (
                        <div key={`print-dose-${slot.key}`} className="record-booklet-print__dose-item">
                          <span className="record-booklet-print__dose-badge">
                            {slot.displayDoseNumber}
                          </span>
                          <span className="record-booklet-print__dose-label">
                            {slot.scheduleLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div
                      className="record-booklet-print__date-grid"
                      style={{
                        gridTemplateColumns: `repeat(${row.slots.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.slots.map((slot) => (
                        <div key={`print-date-${slot.key}`} className="record-booklet-print__date-slot">
                          <span className="record-booklet-print__date-slot-index">
                            {slot.displayDoseNumber}
                          </span>
                          <span className="record-booklet-print__date-slot-value">
                            {formatDate(slot.adminDate) || "\u00A0"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="record-booklet-print__remarks">
                      {row.remarks || "\u00A0"}
                    </div>
                  </td>
                </tr>
              ))}

              {[0, 1].map((blankIndex) => (
                <tr key={`print-empty-${blankIndex}`} className="record-booklet-print__empty-row">
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
