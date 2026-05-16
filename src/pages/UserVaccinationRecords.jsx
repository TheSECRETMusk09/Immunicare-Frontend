import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import { guardianRoutePaths } from "../utils/routePaths";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianVaccinationCompletionModal from "../components/GuardianVaccinationCompletionModal";
import { Button, Card, Input } from "../components/UI";
import {
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  ChevronDown,
  Activity,
  FileCheck,
} from "lucide-react";
import { trackEvent } from "../utils/telemetry";
import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import EnhancedGuardianImmunizationChart from "../components/GuardianImmunizationChart";
import { normalizeVaccinationRecordsResponse, computeVaccinationComplianceSummary } from "../utils/adminDataAdapters";
import { normalizeArrayPayload } from "../utils/apiUtils";
import { formatClinicDateTime, formatInfantDob } from "../utils/dateUtils";

const PROVIDER_FALLBACK_LABEL = "Provider unavailable";
const EMPTY_BOOKLET_VALUE = "\u2014";
const HALF_FRACTION = "\u00BD";

const vaccineDisplayName = {
  BCG: "BCG Vaccine",
  "Hepa B": "Hepatitis B Vaccine",
  "Hepatitis B": "Hepatitis B Vaccine",
  "Penta Valent": "Pentavalent Vaccine (DPT-Hep B-HIB)",
  Pentavalent: "Pentavalent Vaccine (DPT-Hep B-HIB)",
  "OPV 20-doses": "Oral Polio Vaccine (OPV)",
  OPV: "Oral Polio Vaccine (OPV)",
  "IPV multi dose": "Inactivated Polio Vaccine (IPV)",
  IPV: "Inactivated Polio Vaccine (IPV)",
  "PCV 13/PCV 10": "Pneumococcal Conjugate Vaccine (PCV)",
  PCV: "Pneumococcal Conjugate Vaccine (PCV)",
  MMR: "Measles, Mumps, Rubella Vaccine (MMR)",
};

const getVaccineName = (raw) => {
  for (const key of Object.keys(vaccineDisplayName)) {
    if (raw && raw.toLowerCase().includes(key.toLowerCase())) return vaccineDisplayName[key];
  }
  return raw;
};

const epiAgeSchedule = {
  "BCG Vaccine": { 1: "At birth" },
  "Hepatitis B Vaccine": { 1: "At birth" },
  "Pentavalent Vaccine (DPT-Hep B-HIB)": { 1: "1\u00BD mos", 2: "2\u00BD mos", 3: "3\u00BD mos" },
  "Oral Polio Vaccine (OPV)": { 1: "1\u00BD mos", 2: "2\u00BD mos", 3: "3\u00BD mos" },
  "Inactivated Polio Vaccine (IPV)": { 1: "3\u00BD mos", 2: "9 mos" },
  "Pneumococcal Conjugate Vaccine (PCV)": { 1: "1\u00BD mos", 2: "2\u00BD mos", 3: "3\u00BD mos" },
  "Measles, Mumps, Rubella Vaccine (MMR)": { 1: "9 mos", 2: "1 year" },
};

const vaccineOrder = [
  "BCG Vaccine",
  "Hepatitis B Vaccine",
  "Pentavalent Vaccine (DPT-Hep B-HIB)",
  "Oral Polio Vaccine (OPV)",
  "Inactivated Polio Vaccine (IPV)",
  "Pneumococcal Conjugate Vaccine (PCV)",
  "Measles, Mumps, Rubella Vaccine (MMR)",
];

const getVaccineOrderIndex = (displayName) => {
  const idx = vaccineOrder.indexOf(displayName);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
};

const ageLabelToMonths = (label) => {
  if (!label) return null;
  if (/at\s*birth/i.test(label)) return 0;
  const yearMatch = label.match(/(\d+(?:\.\d+)?)\s*year/i);
  if (yearMatch) return Number(yearMatch[1]) * 12;
  const halfPresent = /[\u00BD]|\.5/.test(label);
  const monthMatch = label.match(/(\d+)\s*mos?/i);
  if (monthMatch) {
    return Number(monthMatch[1]) + (halfPresent ? 0.5 : 0);
  }
  return null;
};

const monthsSinceDob = (dob) => {
  if (!dob) return null;
  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - dobDate.getTime();
  if (diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
};

const getDoseAge = (vaccineName, doseNumber) => {
  const displayName = getVaccineName(vaccineName);
  return epiAgeSchedule[displayName]?.[doseNumber] ?? "";
};

const resolveProviderName = (record) =>
  record?.provider_name ||
  record?.administered_by_name ||
  PROVIDER_FALLBACK_LABEL;

const resolveVaccineDisplayName = (entry) =>
  entry?.vaccine_display_name ||
  entry?.vaccineFullName ||
  entry?.vaccine_full_name ||
  entry?.vaccine?.fullName ||
  entry?.vaccine?.full_name ||
  entry?.vaccine?.name ||
  entry?.vaccine_name ||
  entry?.vaccineName ||
  "Unknown vaccine";

const normalizeAgeScheduleLabel = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  if (/at\s*birth/i.test(rawValue)) {
    return "At birth";
  }

  return rawValue
    .replace(/(\d+)\.5/g, (_, whole) => `${whole}${HALF_FRACTION}`)
    .replace(/\bmonths?\b/gi, "mos")
    .replace(/\bmos\s+old\b/gi, "mos")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeScheduleRecord = (scheduleItem) => ({
  id:
    scheduleItem?.recordId ||
    `schedule-${scheduleItem?.vaccine?.id || scheduleItem?.vaccineId}-${scheduleItem?.dose?.number || scheduleItem?.doseNumber || 1}`,
  recordId: scheduleItem?.recordId || null,
  vaccine_id: scheduleItem?.vaccine?.id || scheduleItem?.vaccineId || null,
  vaccine_name:
    scheduleItem?.vaccine?.name || scheduleItem?.vaccineName || "Unknown vaccine",
  vaccine_display_name: resolveVaccineDisplayName(scheduleItem),
  dose_no: scheduleItem?.dose?.number || scheduleItem?.doseNumber || 1,
  dose_number: scheduleItem?.dose?.number || scheduleItem?.doseNumber || 1,
  total_doses: scheduleItem?.dose?.total || scheduleItem?.totalDoses || 1,
  due_date: scheduleItem?.schedule?.dueDate || scheduleItem?.dueDate || null,
  admin_date: scheduleItem?.lastAdministered || scheduleItem?.adminDate || null,
  status: scheduleItem?.status || "upcoming",
  isScheduleOnly: !scheduleItem?.recordId,
  isReady: Boolean(scheduleItem?.isReady),
  canBeAdministered: Boolean(scheduleItem?.canBeAdministered),
  schedule_id: scheduleItem?.schedule?.id || scheduleItem?.scheduleId || null,
  scheduleId: scheduleItem?.schedule?.id || scheduleItem?.scheduleId || null,
  age_in_months: scheduleItem?.schedule?.ageInMonths ?? scheduleItem?.ageInMonths ?? null,
  minimum_age_days:
    scheduleItem?.schedule?.minimumAgeDays ?? scheduleItem?.minimumAgeDays ?? null,
  age_description:
    scheduleItem?.schedule?.ageDescription ||
    scheduleItem?.schedule?.age_description ||
    scheduleItem?.ageDescription ||
    scheduleItem?.age_description ||
    null,
  description: scheduleItem?.schedule?.description || scheduleItem?.description || "",
  source_facility: scheduleItem?.source_facility || null,
});

const normalizeStatusKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

const resolveCanonicalStatusKey = (record) => {
  if (record?.admin_date) {
    return "completed";
  }

  const normalizedStatus = normalizeStatusKey(record?.status);

  if (!normalizedStatus) {
    return record?.isScheduleOnly ? "upcoming" : "pending";
  }

  if (normalizedStatus === "attended") {
    return "completed";
  }

  if (normalizedStatus === "confirmed" || normalizedStatus === "rescheduled") {
    return "scheduled";
  }

  return normalizedStatus;
};

const buildVaccineMatchKey = (entry) => {
  const vaccineId = entry?.vaccine_id || entry?.vaccineId || entry?.vaccine?.id || null;
  if (vaccineId) {
    return `vaccine:${vaccineId}`;
  }

  return `vaccine:${String(
    entry?.vaccine_name || entry?.vaccineName || entry?.vaccine?.name || "unknown",
  )
    .trim()
    .toLowerCase()}`;
};

const buildDoseMatchKey = (entry) =>
  `${buildVaccineMatchKey(entry)}:dose:${Number(
    entry?.dose_no || entry?.dose_number || entry?.doseNumber || entry?.dose?.number || 1,
  )}`;

const formatNumericDate = (value) => {
  if (!value) return EMPTY_BOOKLET_VALUE;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return EMPTY_BOOKLET_VALUE;
  }

  return [
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
    parsedDate.getFullYear(),
  ].join("/");
};

const formatMonthAgeLabel = (months) => {
  if (!Number.isFinite(months) || months < 0) {
    return "";
  }

  if (months === 0) {
    return "At birth";
  }

  if (Math.abs(months - 0.5) < 0.01) {
    return `${HALF_FRACTION} mo`;
  }

  if (months >= 12) {
    const years = months / 12;
    if (Math.abs(years - Math.round(years)) < 0.1) {
      const roundedYears = Math.round(years);
      return roundedYears === 1 ? "1 year" : `${roundedYears} years`;
    }
  }

  const roundedMonths = Math.round(months * 2) / 2;
  const isWholeMonth = Math.abs(roundedMonths - Math.round(roundedMonths)) < 0.01;
  const monthLabel = isWholeMonth
    ? String(Math.round(roundedMonths))
    : roundedMonths.toFixed(1).replace(".5", HALF_FRACTION);

  return monthLabel === "1" ? "1 mo" : `${monthLabel} mos`;
};

const formatDoseAgeLabel = (entry) => {
  const ageDescription = normalizeAgeScheduleLabel(
    entry?.age_description || entry?.ageDescription || entry?.ageLabel,
  );
  if (ageDescription) {
    return ageDescription;
  }

  const minimumAgeDays = Number(entry?.minimum_age_days);
  if (Number.isFinite(minimumAgeDays)) {
    if (minimumAgeDays <= 0) {
      return "At birth";
    }

    if (minimumAgeDays >= 365) {
      const years = Math.max(1, Math.round(minimumAgeDays / 365));
      return years === 1 ? "1 year" : `${years} years`;
    }

    const monthLabel = formatMonthAgeLabel(minimumAgeDays / 30);
    if (monthLabel) {
      return monthLabel;
    }
  }

  const ageInMonths = Number(entry?.age_in_months);
  if (Number.isFinite(ageInMonths)) {
    const monthLabel = formatMonthAgeLabel(ageInMonths);
    if (monthLabel) {
      return monthLabel;
    }
  }

  const description = String(entry?.description || "").trim();
  if (!description) {
    return EMPTY_BOOKLET_VALUE;
  }

  const normalizedDescription = normalizeAgeScheduleLabel(description);
  return normalizedDescription || EMPTY_BOOKLET_VALUE;
};

const resolveBookletStatusDisplay = (record) => {
  const statusKey = resolveCanonicalStatusKey(record);

  if (statusKey === "completed") {
    return {
      key: "completed",
      label: "Completed",
      className: "bg-green-600 text-white dark:bg-green-500 dark:text-white",
    };
  }

  if (statusKey === "overdue") {
    return {
      key: "overdue",
      label: "Overdue",
      className: "bg-red-600 text-white dark:bg-red-500 dark:text-white",
    };
  }

  if (statusKey === "pending_confirmation") {
    return {
      key: "pending_confirmation",
      label: "Pending Confirmation",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }

  if (statusKey === "pending" || statusKey === "cancelled") {
    return {
      key: "pending",
      label: "Pending",
      className:
        "border border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-transparent dark:text-gray-200",
    };
  }

  return {
    key: "upcoming",
    label: "Upcoming",
    className: "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900",
  };
};

export default function UserVaccinationRecords() {
  const { guardianId } = useAuth();
  const { childId } = useParams();
  const navigate = useNavigate();

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("records");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showChildDropdown, setShowChildDropdown] = useState(false);
  const [vaccinationActionTarget, setVaccinationActionTarget] = useState(null);
  const [actionFeedback, setActionFeedback] = useState("");
  const [chartSubTab, setChartSubTab] = useState("immunization");
  const [growthRecords, setGrowthRecords] = useState([]);
  const [loadingGrowth, setLoadingGrowth] = useState(false);

  const recordsBookletRef = useRef(null);
  const triggerBookletAction = useCallback((action) => {
    const node = recordsBookletRef.current;
    if (!node) return;
    const target = node.querySelector(`[data-print-action="${action}"]`);
    if (target && typeof target.click === "function") {
      target.click();
    }
  }, []);

  // Readiness state for next-dose prediction
  const [childReadiness, setChildReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const fetchChildren = useCallback(async () => {
    if (!guardianId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.getInfantsByGuardian(guardianId);
      const childrenData = normalizeArrayPayload(response, ["infants", "children", "patients"]);
      setChildren(childrenData);

      if (childrenData.length === 0) {
        setSelectedChild(null);
        setVaccinationRecords([]);
        setVaccinationSchedules([]);
        setScheduleSummary(null);
        setChildReadiness(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  const fetchVaccinationData = useCallback(async (childId) => {
    try {
      setScheduleSummary(null);
      const [recordsResponse, schedulesResponse] = await Promise.all([
        apiClient.getVaccinationsByInfant(childId),
        apiClient.getInfantVaccinationSchedule(childId),
      ]);

      const normalizedRecords = normalizeVaccinationRecordsResponse(recordsResponse).map((record) => ({
        ...record,
        due_date: record?.due_date || record?.next_due_date || null,
        dose_no: record?.dose_no || record?.dose_number || 1,
        dose_number: record?.dose_number || record?.dose_no || 1,
        provider_name: resolveProviderName(record),
        vaccine_display_name: resolveVaccineDisplayName(record),
        age_description: record?.ageDescription || record?.age_description || null,
      }));

      setVaccinationRecords(normalizedRecords);
      const normalizedScheduleResponse =
        schedulesResponse && typeof schedulesResponse === "object"
          ? schedulesResponse
          : { schedule: Array.isArray(schedulesResponse) ? schedulesResponse : [] };

      setVaccinationSchedules(
        Array.isArray(normalizedScheduleResponse?.schedule)
          ? normalizedScheduleResponse.schedule
          : Array.isArray(normalizedScheduleResponse?.data)
            ? normalizedScheduleResponse.data
            : [],
      );
      setScheduleSummary(normalizedScheduleResponse?.summary || null);
    } catch (err) {
      console.error("Error fetching vaccination data:", err);
      setScheduleSummary(null);
    }
  }, []);

  // Fetch readiness for next-dose prediction
  const fetchReadiness = useCallback(async (childId) => {
    setReadinessLoading(true);
    try {
      const result = await apiClient.getVaccinationReadiness(childId);
      if (result?.success && result?.data) {
        setChildReadiness(result.data);
      } else {
        setChildReadiness(null);
      }
    } catch (err) {
      console.warn("Error fetching readiness:", err);
      setChildReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  useEffect(() => {
    if (children.length === 0) {
      return;
    }

    const parsedChildId = childId ? Number.parseInt(childId, 10) : null;
    const targetChild = Number.isInteger(parsedChildId)
      ? children.find((child) => Number(child.id) === parsedChildId)
      : null;

    const nextSelectedChild = targetChild || children[0];

    setSelectedChild((currentSelectedChild) => {
      if (
        currentSelectedChild &&
        Number(currentSelectedChild.id) === Number(nextSelectedChild.id)
      ) {
        return currentSelectedChild;
      }

      return nextSelectedChild;
    });

    if (String(childId || "") !== String(nextSelectedChild.id)) {
      navigate(`/guardian/vaccination-records/${nextSelectedChild.id}`, {
        replace: true,
      });
    }
  }, [childId, children, navigate]);

  useEffect(() => {
    if (selectedChild) {
      trackEvent("vaccination_records_viewed", { childId: selectedChild.id, viewMode });
    }
  }, [selectedChild, viewMode]);

  useEffect(() => {
    if (selectedChild) {
      fetchVaccinationData(selectedChild.id);
      fetchReadiness(selectedChild.id);
      setActionFeedback("");
    }
  }, [selectedChild, fetchVaccinationData, fetchReadiness]);

  const fetchGrowthRecords = useCallback(async (targetChildId) => {
    if (!targetChildId) {
      setGrowthRecords([]);
      return;
    }
    try {
      setLoadingGrowth(true);
      const response = await apiClient.getGrowthRecordsByInfant(targetChildId);
      const normalized = Array.isArray(response) ? response : response?.data || [];
      setGrowthRecords(normalized.sort((a, b) => {
        const dateA = new Date(a.measurement_date || a.date || 0);
        const dateB = new Date(b.measurement_date || b.date || 0);
        return dateB - dateA;
      }));
    } catch (err) {
      console.error("Error fetching growth records:", err);
      setGrowthRecords([]);
    } finally {
      setLoadingGrowth(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "chart" && chartSubTab === "growth" && selectedChild?.id) {
      fetchGrowthRecords(selectedChild.id);
    }
  }, [viewMode, chartSubTab, selectedChild?.id, fetchGrowthRecords]);

  const normalizedScheduleRecords = useMemo(
    () => vaccinationSchedules.map((scheduleItem) => normalizeScheduleRecord(scheduleItem)),
    [vaccinationSchedules],
  );

  const pendingConfirmationCount = useMemo(
    () =>
      normalizedScheduleRecords.filter(
        (record) => String(record.status || "").toLowerCase() === "pending_confirmation",
      ).length,
    [normalizedScheduleRecords],
  );

  const resolveActionLabel = (vaccine) => {
    if (resolveCanonicalStatusKey(vaccine) === "completed") {
      return "Edit Date";
    }

    return "Mark Completed";
  };

  const openVaccinationActionModal = (vaccine) => {
    setVaccinationActionTarget(vaccine);
  };

  const handleVaccinationActionSuccess = useCallback(
    async (message) => {
      if (!selectedChild?.id) {
        return;
      }

      await fetchVaccinationData(selectedChild.id);
      await fetchReadiness(selectedChild.id);
      setVaccinationActionTarget(null);
      setActionFeedback(message);
    },
    [fetchReadiness, fetchVaccinationData, selectedChild],
  );

  const calculateAge = (dob) => {
    if (!dob) return "-";
    const birthDate = new Date(dob);
    const today = new Date();
    const months =
      (today.getFullYear() - birthDate.getFullYear()) * 12 +
      (today.getMonth() - birthDate.getMonth());
    if (months < 1) {
      const days = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
      return `${days} days`;
    } else if (months < 24) {
      return `${months} month${months !== 1 ? "s" : ""}`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return remainingMonths > 0
        ? `${years} year${years !== 1 ? "s" : ""} ${remainingMonths} mo`
        : `${years} year${years !== 1 ? "s" : ""}`;
    }
  };

  const complianceSummary = useMemo(
    () =>
      computeVaccinationComplianceSummary({
        schedules: vaccinationSchedules,
        records: vaccinationRecords,
        infantDob: selectedChild?.dob,
      }),
    [vaccinationSchedules, vaccinationRecords, selectedChild?.dob],
  );

  // Calculate vaccination statistics
  const stats = useMemo(() => {
    if (scheduleSummary) {
      return {
        completed: Number(scheduleSummary.completed || 0),
        upcoming: Number(scheduleSummary.upcoming || 0),
        overdue: Number(scheduleSummary.overdue || 0),
        total: Number(
          scheduleSummary.totalVaccines ||
            normalizedScheduleRecords.length ||
            vaccinationRecords.length ||
            0,
        ),
        completionRate: scheduleSummary.completionRate ?? complianceSummary.completionRate,
      };
    }

    const completed = normalizedScheduleRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "completed",
    ).length;
    const upcoming = normalizedScheduleRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "upcoming",
    ).length;
    const overdue = normalizedScheduleRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "overdue",
    ).length;

    return {
      completed,
      upcoming,
      overdue,
      total:
        normalizedScheduleRecords.length ||
        vaccinationRecords.length ||
        completed + upcoming + overdue,
      completionRate: complianceSummary.completionRate,
    };
  }, [complianceSummary, normalizedScheduleRecords, scheduleSummary, vaccinationRecords]);

  const bookletRows = useMemo(() => {
    const recordByDoseKey = new Map(
      vaccinationRecords.map((record) => [buildDoseMatchKey(record), record]),
    );
    const groupedRows = new Map();
    const seenDoseKeys = new Set();

    const upsertSlot = (entry, matchedRecord = null) => {
      const doseKey = buildDoseMatchKey(entry);
      if (seenDoseKeys.has(doseKey)) {
        return;
      }

      seenDoseKeys.add(doseKey);

      const vaccineKey = buildVaccineMatchKey(entry);
      const doseNumber = Number(entry?.dose_no || entry?.dose_number || 1);
      const effectiveRecord = matchedRecord || recordByDoseKey.get(doseKey) || null;
      const scheduleLabel = formatDoseAgeLabel(entry);
      const adminDate = effectiveRecord?.admin_date || entry?.admin_date || null;
      const notes = String(effectiveRecord?.notes || entry?.notes || "").trim();
      const statusSource = {
        ...entry,
        ...effectiveRecord,
        admin_date: adminDate,
        status: adminDate ? "completed" : effectiveRecord?.status || entry?.status || "pending",
      };
      const statusDisplay = resolveBookletStatusDisplay(statusSource);
      const actionTarget = {
        ...entry,
        ...effectiveRecord,
        id: effectiveRecord?.id || entry?.id,
        recordId: effectiveRecord?.id || effectiveRecord?.recordId || entry?.recordId || null,
        vaccine_id: entry?.vaccine_id || effectiveRecord?.vaccine_id || null,
        vaccine_name: entry?.vaccine_name || effectiveRecord?.vaccine_name || "Unknown vaccine",
        vaccine_display_name:
          entry?.vaccine_display_name ||
          effectiveRecord?.vaccine_display_name ||
          entry?.vaccine_name ||
          effectiveRecord?.vaccine_name ||
          "Unknown vaccine",
        dose_no: doseNumber,
        dose_number: doseNumber,
        doseNumber,
        admin_date: adminDate,
        adminDate,
        status: statusSource.status,
        isScheduleOnly: !Boolean(
          effectiveRecord?.id || effectiveRecord?.recordId || entry?.recordId,
        ),
        schedule_id:
          entry?.schedule_id || entry?.scheduleId || effectiveRecord?.schedule_id || null,
        scheduleId:
          entry?.schedule_id || entry?.scheduleId || effectiveRecord?.schedule_id || null,
        source_facility: effectiveRecord?.source_facility || entry?.source_facility || null,
        notes,
      };
      const slotSortValue = Number.isFinite(Number(entry?.minimum_age_days))
        ? Number(entry.minimum_age_days)
        : Number.isFinite(Number(entry?.age_in_months))
          ? Number(entry.age_in_months) * 30
          : Number.POSITIVE_INFINITY;

      const existingRow = groupedRows.get(vaccineKey);
      const nextRow = existingRow || {
        key: vaccineKey,
        vaccineLabel:
          entry?.vaccine_display_name ||
          effectiveRecord?.vaccine_display_name ||
          entry?.vaccine_name ||
          effectiveRecord?.vaccine_name ||
          "Unknown vaccine",
        sortValue: slotSortValue,
        slots: [],
      };

      nextRow.sortValue = Math.min(nextRow.sortValue, slotSortValue);
      nextRow.slots.push({
        key: doseKey,
        displayDoseNumber: doseNumber,
        scheduleLabel,
        adminDate,
        notes,
        statusDisplay,
        actionTarget,
      });

      groupedRows.set(vaccineKey, nextRow);
    };

    normalizedScheduleRecords.forEach((record) => {
      upsertSlot(record, recordByDoseKey.get(buildDoseMatchKey(record)) || null);
    });

    vaccinationRecords.forEach((record) => {
      upsertSlot(record, record);
    });

    const childAgeMonths = monthsSinceDob(selectedChild?.dob);

    return Array.from(groupedRows.values())
      .map((row) => {
        const displayLabel = getVaccineName(row.vaccineLabel);
        const doseSchedule = epiAgeSchedule[displayLabel] || {};
        const hasCanonicalSchedule = Object.keys(doseSchedule).length > 0;
        const existingByDoseNum = new Map(row.slots.map((s) => [s.displayDoseNumber, s]));

        const doseNumbers = hasCanonicalSchedule
          ? Object.keys(doseSchedule).map(Number).sort((a, b) => a - b)
          : Array.from(new Set(row.slots.map((s) => s.displayDoseNumber))).sort((a, b) => a - b);

        const slots = doseNumbers.map((doseNum) => {
          const existing = existingByDoseNum.get(doseNum);
          const ageLabel = doseSchedule[doseNum] || (existing ? existing.scheduleLabel : "");

          if (existing) {
            return { ...existing, scheduleLabel: ageLabel };
          }

          const scheduledMonths = ageLabelToMonths(ageLabel);
          const isOverdueByAge =
            childAgeMonths !== null &&
            scheduledMonths !== null &&
            childAgeMonths > scheduledMonths;
          const derivedStatus = isOverdueByAge ? "overdue" : "upcoming";

          return {
            key: `${row.key}:dose:${doseNum}`,
            displayDoseNumber: doseNum,
            scheduleLabel: ageLabel,
            adminDate: null,
            notes: "",
            statusDisplay: resolveBookletStatusDisplay({ status: derivedStatus, admin_date: null }),
            actionTarget: {
              id: null,
              recordId: null,
              vaccine_id: row.slots[0]?.actionTarget?.vaccine_id ?? null,
              vaccine_name: row.slots[0]?.actionTarget?.vaccine_name ?? displayLabel,
              vaccine_display_name: displayLabel,
              dose_no: doseNum,
              dose_number: doseNum,
              doseNumber: doseNum,
              admin_date: null,
              adminDate: null,
              status: derivedStatus,
              isScheduleOnly: true,
              schedule_id: null,
              scheduleId: null,
              source_facility: null,
              notes: "",
            },
          };
        });

        return {
          ...row,
          vaccineLabel: displayLabel,
          slots,
          noteEntries: slots.filter((slot) => Boolean(slot.notes)),
        };
      })
      .sort((left, right) => {
        const leftIdx = getVaccineOrderIndex(left.vaccineLabel);
        const rightIdx = getVaccineOrderIndex(right.vaccineLabel);
        if (leftIdx !== rightIdx) {
          return leftIdx - rightIdx;
        }
        return left.vaccineLabel.localeCompare(right.vaccineLabel);
      });
  }, [normalizedScheduleRecords, vaccinationRecords, selectedChild?.dob]);

  // Filter records based on search and view mode
  const filteredBookletRows = useMemo(() => {
    let rows = [...bookletRows];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter((row) => row.vaccineLabel.toLowerCase().includes(query));
    }

    if (statusFilter !== "all") {
      rows = rows.filter((row) => {
        if (statusFilter === "completed") {
          return row.slots.some((slot) => slot.statusDisplay.key === "completed");
        }

        if (statusFilter === "overdue") {
          return row.slots.some((slot) => slot.statusDisplay.key === "overdue");
        }

        if (statusFilter === "upcoming") {
          return row.slots.some((slot) =>
            ["upcoming", "pending"].includes(slot.statusDisplay.key),
          );
        }

        return true;
      });
    }

    return rows;
  }, [bookletRows, searchQuery, statusFilter]);

  const growthDisplayData = useMemo(() => {
    const toDateKey = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().slice(0, 10);
    };
    const birthWeight = selectedChild?.birth_weight ?? selectedChild?.birthWeight ?? selectedChild?.birth_weight_kg ?? selectedChild?.weight_at_birth ?? null;
    const birthHeight = selectedChild?.birth_height ?? selectedChild?.birth_length ?? selectedChild?.birthHeight ?? selectedChild?.birthLength ?? null;
    const birthHeadCircumference =
      selectedChild?.birth_head_circumference ??
      selectedChild?.head_circumference_cm ??
      selectedChild?.head_circumference ??
      null;
    const dobKey = toDateKey(selectedChild?.dob);
    const hasBirthRow = dobKey ? growthRecords.some((r) => toDateKey(r?.measurement_date || r?.date) === dobKey) : false;
    const showBirthFallback =
      Boolean(dobKey) &&
      !hasBirthRow &&
      (birthWeight !== null || birthHeight !== null || birthHeadCircumference !== null);
    const birthEntry = showBirthFallback
      ? {
          id: "birth",
          measurement_date: selectedChild?.dob,
          weight_kg: birthWeight,
          length_cm: birthHeight,
          head_circumference_cm: birthHeadCircumference,
          notes: "Recorded at registration",
          isBirthFallback: true,
        }
      : null;
    const displayRecords = birthEntry
      ? [...growthRecords, birthEntry].sort((a, b) => {
          const dateA = new Date(a.measurement_date || a.date || 0).getTime();
          const dateB = new Date(b.measurement_date || b.date || 0).getTime();
          return dateB - dateA;
        })
      : growthRecords;
    return {
      displayRecords,
      latestRecord: displayRecords[0] || null,
      latestIsBirth: Boolean(displayRecords[0]?.isBirthFallback),
    };
  }, [growthRecords, selectedChild]);

  const scheduledAppointment = childReadiness?.scheduledAppointment || null;

  const handleChildSelect = (child) => {
    setShowChildDropdown(false);
    setSearchQuery("");
    setStatusFilter("all");

    if (Number(selectedChild?.id) !== Number(child.id)) {
      navigate(`/guardian/vaccination-records/${child.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 px-4">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={fetchChildren}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="guardian-page-wrapper guardian-vaccination-records-page min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="min-[1025px]:hidden fixed top-0 left-0 right-0 z-40 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={() => {
            fetchChildren();
            if (selectedChild) {
              fetchVaccinationData(selectedChild.id);
              fetchReadiness(selectedChild.id);
            }
          }}
          isRefreshing={loading}
        />
      </div>

      <div className="pt-14 sm:pt-16 min-[1025px]:pt-0">
        <GuardianModuleHeader
        title="Vaccination Records"
        subtitle="Track and manage your child's vaccination history"
        icon={<FileText className="w-8 h-8 text-white" />}
        actions={
          <div
            className="guardian-inline-actions guardian-vaccination-records-view-toggle flex items-center gap-2"
            style={{ flexDirection: "row", flexWrap: "nowrap" }}
          >
            <Button
              variant={viewMode === "records" ? "primary" : "secondary"}
              onClick={() => setViewMode("records")}
              size="sm"
              style={{ flex: 1 }}
            >
              Records
            </Button>
            <Button
              variant={viewMode === "booklet" ? "primary" : "secondary"}
              onClick={() => setViewMode("booklet")}
              size="sm"
              style={{ flex: 1 }}
            >
              Booklet
            </Button>
            <Button
              variant={viewMode === "chart" ? "primary" : "secondary"}
              onClick={() => setViewMode("chart")}
              size="sm"
              style={{ flex: 1 }}
            >
              Immunization Chart
            </Button>
          </div>
        }
      />
      </div>

      <main className="guardian-page-content space-y-4 sm:space-y-6">

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">👶</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Children Registered
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to register your children first to view their vaccination
            records.
          </p>
          <Button onClick={() => navigate("/guardian/children")}>
            Register Child
          </Button>
        </div>
      ) : (
        <>
          {/* Child Selector Dropdown */}
          <div className="relative">
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-4 cursor-pointer"
              onClick={() => setShowChildDropdown(!showChildDropdown)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                    <span className="text-xl">
                      {selectedChild?.sex === "M" ? "👦" : "👧"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 break-words">
                      {selectedChild?.first_name} {selectedChild?.last_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                      {calculateAge(selectedChild?.dob)} • Born{" "}
                      {formatInfantDob(selectedChild?.dob)}
                    </p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 break-all">
                      Infant Control Number: {selectedChild?.control_number || "Pending"}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${showChildDropdown ? "rotate-180" : ""}`}
                />
              </div>

              {/* Quick Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    Vaccination Progress
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {stats.completed} / {stats.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.completionRate ?? 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Dropdown Options */}
            {showChildDropdown && children.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-10 overflow-hidden">
                {children.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => handleChildSelect(child)}
                    className={`p-4 cursor-pointer flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedChild?.id === child.id
                        ? "bg-indigo-50 dark:bg-indigo-900/20"
                        : ""
                    }`}
                  >
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                      <span className="text-lg">
                        {child.sex === "M" ? "👦" : "👧"}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {child.first_name} {child.last_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {calculateAge(child.dob)}
                      </p>
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1">
                        Infant Control Number: {child.control_number || "Pending"}
                      </p>
                    </div>
                    {selectedChild?.id === child.id && (
                      <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Cards - Child Specific Only */}
          <div className="guardian-vaccination-summary-grid grid grid-cols-1 min-[480px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-3">
            <Card className="guardian-vaccination-summary-card p-4 flex items-center gap-4">
              <div className="guardian-vaccination-summary-card__icon w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="guardian-vaccination-summary-card__body">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.completed}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Completed
                </p>
              </div>
            </Card>

            <Card className="guardian-vaccination-summary-card p-4 flex items-center gap-4">
              <div className="guardian-vaccination-summary-card__icon w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="guardian-vaccination-summary-card__body">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.upcoming}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upcoming
                </p>
              </div>
            </Card>

            <Card className="guardian-vaccination-summary-card p-4 flex items-center gap-4">
              <div className="guardian-vaccination-summary-card__icon w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="guardian-vaccination-summary-card__body">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.overdue}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Overdue
                </p>
              </div>
            </Card>
          </div>

          {/* Next-Dose Prediction Banner */}
          {selectedChild && !readinessLoading && childReadiness && (
            <div className={`rounded-xl p-4 ${
              scheduledAppointment
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : childReadiness.readinessStatus === 'READY'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : childReadiness.readinessStatus === 'OVERDUE'
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  {scheduledAppointment ? (
                    <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                  ) : childReadiness.readinessStatus === 'READY' ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : childReadiness.readinessStatus === 'OVERDUE' ? (
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5" />
                  ) : (
                    <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`font-semibold ${
                      scheduledAppointment
                        ? 'text-blue-800 dark:text-blue-300'
                        : childReadiness.readinessStatus === 'READY'
                        ? 'text-green-800 dark:text-green-300'
                        : childReadiness.readinessStatus === 'OVERDUE'
                          ? 'text-red-800 dark:text-red-300'
                          : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                            ? 'text-yellow-800 dark:text-yellow-300'
                            : 'text-blue-800 dark:text-blue-300'
                    }`}>
                      {scheduledAppointment
                        ? 'Appointment Scheduled'
                        : childReadiness.readinessStatus === 'READY'
                        ? 'Ready for Next Vaccination!'
                        : childReadiness.readinessStatus === 'OVERDUE'
                          ? 'Overdue - Schedule Appointment Now!'
                          : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                            ? 'Pending Confirmation'
                            : 'Upcoming Vaccination'}
                    </h4>

                    {scheduledAppointment && (
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Scheduled{scheduledAppointment.vaccine_name ? ` for ${scheduledAppointment.vaccine_name}` : ""}:{" "}
                        {formatClinicDateTime(scheduledAppointment.scheduled_date)}
                      </p>
                    )}

                    {/* Due Vaccines */}
                    {!scheduledAppointment &&
                      childReadiness.dueVaccines &&
                      childReadiness.dueVaccines.length > 0 && (
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        Due: {childReadiness.dueVaccines.map(v => v.label).join(', ')}
                      </p>
                      )}

                    {/* Overdue Vaccines */}
                    {!scheduledAppointment &&
                      childReadiness.overdueVaccines &&
                      childReadiness.overdueVaccines.length > 0 && (
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        Overdue: {childReadiness.overdueVaccines.map(v => v.label).join(', ')}
                      </p>
                      )}

                    {/* Next Appointment Prediction */}
                    {!scheduledAppointment && childReadiness.nextAppointmentPrediction && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        <span className="font-medium">Recommended Date:</span>{' '}
                        {childReadiness.nextAppointmentPrediction.date
                          ? new Date(childReadiness.nextAppointmentPrediction.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'Not available'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Book Appointment Button */}
                {(scheduledAppointment ||
                  childReadiness.readinessStatus === 'READY' ||
                  childReadiness.readinessStatus === 'OVERDUE' ||
                  (childReadiness.nextAppointmentPrediction && childReadiness.nextAppointmentPrediction.date)) && (
                  <Button
                    onClick={() =>
                      scheduledAppointment
                        ? navigate(`${guardianRoutePaths.appointments}?childId=${selectedChild.id}`)
                        : navigate(guardianRoutePaths.appointmentBooking(selectedChild.id))
                    }
                    size="sm"
                    className="shrink-0"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {scheduledAppointment ? "Open Appointment" : "Book Appointment"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {actionFeedback ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {actionFeedback}
            </div>
          ) : null}

          {pendingConfirmationCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your child is old enough for at least one next dose, but this health center has not
              yet confirmed readiness for on-site administration. If the vaccine was already given
              elsewhere, use <span className="font-semibold">Mark Completed</span>, enter the
              administered date, and upload the transfer file or vaccination proof.
            </div>
          ) : null}

          {/* Loading State for Readiness */}
          {selectedChild && readinessLoading && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mr-2"></div>
              <span className="text-gray-500 dark:text-gray-400">Loading vaccination status...</span>
            </div>
          )}


          {/* Search Bar */}
          {viewMode === "records" && (
            <div className="w-full max-w-md">
              <Input
                placeholder="Search vaccinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
          )}

          {viewMode === "records" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {["all", "completed", "upcoming", "overdue"].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      statusFilter === filter
                        ? filter === "completed"
                          ? "bg-green-600 text-white"
                          : filter === "upcoming"
                            ? "bg-gray-600 text-white"
                            : filter === "overdue"
                              ? "bg-red-600 text-white"
                              : "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              {selectedChild && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => triggerBookletAction("immunization-record-download-word")}
                    variant="secondary"
                    size="sm"
                  >
                    Download Word
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          {selectedChild && (
            <>
              {viewMode === "booklet" ? (
                <ImmunizationRecordBooklet infantId={selectedChild.id} />
              ) : viewMode === "chart" ? (
                <>
                  <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-800 rounded-xl p-1.5 border border-gray-200 dark:border-gray-700 shadow-sm w-full">
                    <button
                      type="button"
                      onClick={() => setChartSubTab("immunization")}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                        chartSubTab === "immunization"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <FileCheck className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">Immunization Chart</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSubTab("growth")}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                        chartSubTab === "growth"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <Activity className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">Growth Charts</span>
                    </button>
                  </div>
                  {chartSubTab === "immunization" && (
                    <div className="guardian-chart-scroll-container bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
                      <EnhancedGuardianImmunizationChart
                        childId={selectedChild.id}
                      />
                    </div>
                  )}
                  {chartSubTab === "growth" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4">
                        <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
                          <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Weight</p>
                          <p className="text-2xl font-bold text-theme-primary mt-2">
                            {growthDisplayData.latestRecord && (growthDisplayData.latestRecord.weight_kg ?? growthDisplayData.latestRecord.weight) != null
                              ? `${growthDisplayData.latestRecord.weight_kg ?? growthDisplayData.latestRecord.weight} kg`
                              : '-'}
                          </p>
                          {growthDisplayData.latestIsBirth && (growthDisplayData.latestRecord?.weight_kg ?? null) != null && (
                            <p className="text-xs text-theme-secondary mt-1">(at birth)</p>
                          )}
                        </div>
                        <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
                          <p className="text-xs uppercase tracking-wide text-theme-secondary">Latest Height</p>
                          <p className="text-2xl font-bold text-theme-primary mt-2">
                            {growthDisplayData.latestRecord && (growthDisplayData.latestRecord.length_cm ?? growthDisplayData.latestRecord.height ?? growthDisplayData.latestRecord.length) != null
                              ? `${growthDisplayData.latestRecord.length_cm ?? growthDisplayData.latestRecord.height ?? growthDisplayData.latestRecord.length} cm`
                              : '-'}
                          </p>
                          {growthDisplayData.latestIsBirth && (growthDisplayData.latestRecord?.length_cm ?? null) != null && (
                            <p className="text-xs text-theme-secondary mt-1">(at birth)</p>
                          )}
                        </div>
                        <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4">
                          <p className="text-xs uppercase tracking-wide text-theme-secondary">Head Circumference</p>
                          <p className="text-2xl font-bold text-theme-primary mt-2">
                            {growthDisplayData.latestRecord && (growthDisplayData.latestRecord.head_circumference_cm ?? growthDisplayData.latestRecord.head_circumference) != null
                              ? `${growthDisplayData.latestRecord.head_circumference_cm ?? growthDisplayData.latestRecord.head_circumference} cm`
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-theme-bg-card rounded-xl shadow-sm border border-theme-border-primary p-4 sm:p-6">
                        <h3 className="text-lg font-semibold text-theme-primary mb-4">Growth History</h3>
                        {loadingGrowth ? (
                          <div className="py-10 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                          </div>
                        ) : growthDisplayData.displayRecords.length === 0 ? (
                          <div className="py-10 text-center text-theme-secondary">
                            No growth records yet for this child.
                          </div>
                        ) : (
                          <div className="guardian-table-card-list md:hidden">
                            {growthDisplayData.displayRecords.map((record) => (
                              <article
                                key={record.id || `${record.measurement_date}-${record.weight_kg}`}
                                className="guardian-table-card"
                              >
                                <div className="guardian-table-card__header">
                                  <h4 className="guardian-table-card__title">
                                    {record.measurement_date
                                      ? new Date(record.measurement_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                      : "Measurement"}
                                  </h4>
                                </div>
                                <div className="guardian-table-card__rows">
                                  <div className="guardian-table-card__row">
                                    <span className="guardian-table-card__label">Weight</span>
                                    <span className="guardian-table-card__value">{record.weight_kg || record.weight || '-'} kg</span>
                                  </div>
                                  <div className="guardian-table-card__row">
                                    <span className="guardian-table-card__label">Height</span>
                                    <span className="guardian-table-card__value">{record.length_cm || record.height || record.length || '-'} cm</span>
                                  </div>
                                  <div className="guardian-table-card__row">
                                    <span className="guardian-table-card__label">Head Circ.</span>
                                    <span className="guardian-table-card__value">{record.head_circumference_cm || record.head_circumference || '-'} cm</span>
                                  </div>
                                  <div className="guardian-table-card__row">
                                    <span className="guardian-table-card__label">Notes</span>
                                    <span className="guardian-table-card__value">{record.notes || '-'}</span>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                        {!loadingGrowth && growthDisplayData.displayRecords.length > 0 && (
                          <div className="guardian-table-scroll-shell hidden md:block">
                            <table className="w-full min-w-[700px]">
                              <thead>
                                <tr className="border-b border-theme-border-primary">
                                  <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Date</th>
                                  <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Weight (kg)</th>
                                  <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Height (cm)</th>
                                  <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Head Circ. (cm)</th>
                                  <th className="text-left text-xs uppercase tracking-wide text-theme-secondary py-2">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {growthDisplayData.displayRecords.map((record) => (
                                  <tr key={record.id || `${record.measurement_date}-${record.weight_kg}`} className="border-b border-theme-border-primary/60">
                                    <td className="py-3 text-theme-primary">
                                      {record.measurement_date ? new Date(record.measurement_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : '-'}
                                    </td>
                                    <td className="py-3 text-theme-primary">{record.weight_kg || record.weight || '-'}</td>
                                    <td className="py-3 text-theme-primary">{record.length_cm || record.height || record.length || '-'}</td>
                                    <td className="py-3 text-theme-primary">{record.head_circumference_cm || record.head_circumference || '-'}</td>
                                    <td className="py-3 text-theme-secondary max-w-[220px] truncate">{record.notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                <div
                  ref={recordsBookletRef}
                  aria-hidden="true"
                  style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", clip: "rect(0 0 0 0)" }}
                >
                  <ImmunizationRecordBooklet infantId={selectedChild.id} />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                  {/* Tablet/Desktop table */}
                  <div className="guardian-table-scroll-shell overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Bakuna (Vaccine)
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Doses
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Date Administered
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Remarks
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredBookletRows.map((row) => (
                          <tr
                            key={row.key}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 align-top"
                          >
                            <td className="px-4 py-4">
                              <div className="min-w-[190px] text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {row.vaccineLabel}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[180px] space-y-2">
                                {row.slots.map((slot) => (
                                  <div key={`${row.key}-${slot.key}-dose`} className="flex items-center gap-3">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                      {slot.displayDoseNumber}
                                    </span>
                                    <span className="text-sm text-gray-700 dark:text-gray-200">
                                      {slot.scheduleLabel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div
                                className="grid min-w-[320px] gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${row.slots.length}, minmax(140px, 1fr))`,
                                }}
                              >
                                {row.slots.map((slot) => (
                                  <button
                                    key={`${row.key}-${slot.key}-card`}
                                    type="button"
                                    onClick={() => openVaccinationActionModal(slot.actionTarget)}
                                    title={resolveActionLabel(slot.actionTarget)}
                                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-900/10"
                                  >
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                      DOSE {slot.displayDoseNumber}
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                      {formatNumericDate(slot.adminDate)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                      {slot.scheduleLabel}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {row.noteEntries.length > 0 ? (
                                <div className="min-w-[220px] space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                  {row.noteEntries.map((slot) => (
                                    <div key={`${row.key}-${slot.key}-note`}>
                                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        Dose {slot.displayDoseNumber}:
                                      </span>{" "}
                                      <span>{slot.notes}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 dark:text-gray-500">{EMPTY_BOOKLET_VALUE}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[180px] space-y-2">
                                {row.slots.map((slot) => (
                                  <div
                                    key={`${row.key}-${slot.key}-status`}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="min-w-[54px] text-xs font-medium text-gray-500 dark:text-gray-400">
                                      Dose {slot.displayDoseNumber}
                                    </span>
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${slot.statusDisplay.className}`}
                                    >
                                      {slot.statusDisplay.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredBookletRows.length === 0 && (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-3">💉</div>
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchQuery
                          ? "No vaccinations match your search."
                          : statusFilter === "upcoming"
                            ? "No upcoming vaccinations scheduled."
                            : statusFilter === "overdue"
                              ? "No overdue vaccinations."
                              : statusFilter === "completed"
                                ? "No completed vaccinations."
                                : "No vaccination records found."}
                      </p>
                    </div>
                  )}
                </div>
                </>
              )}
            </>
          )}
        </>
      )}
      </main>

      <GuardianVaccinationCompletionModal
        isOpen={Boolean(vaccinationActionTarget)}
        onClose={() => setVaccinationActionTarget(null)}
        child={selectedChild}
        vaccination={vaccinationActionTarget}
        onSuccess={handleVaccinationActionSuccess}
      />
    </div>
  );
}
