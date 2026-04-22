import { toClinicDateKey } from "./dateUtils";

const PERIOD_OPTIONS = Object.freeze([
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Date Range" },
]);

const shiftClinicDateKey = (value, days) => {
  const dateKey = toClinicDateKey(value);
  if (!dateKey || !Number.isFinite(days)) {
    return "";
  }

  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toClinicDateKey(parsed);
};

const startOfClinicWeekKey = (value) => {
  const dateKey = toClinicDateKey(value);
  if (!dateKey) {
    return "";
  }

  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const dayOfWeek = parsed.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  parsed.setUTCDate(parsed.getUTCDate() - diffToMonday);

  return toClinicDateKey(parsed);
};

const endOfClinicWeekKey = (value) => {
  const startOfWeekKey = startOfClinicWeekKey(value);
  if (!startOfWeekKey) {
    return "";
  }

  return shiftClinicDateKey(startOfWeekKey, 6);
};

const startOfClinicMonthKey = (value) => {
  const dateKey = toClinicDateKey(value);
  if (!dateKey) {
    return "";
  }

  return `${dateKey.slice(0, 7)}-01`;
};

const endOfClinicMonthKey = (value) => {
  const startOfMonthKey = startOfClinicMonthKey(value);
  if (!startOfMonthKey) {
    return "";
  }

  const parsed = new Date(`${startOfMonthKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  parsed.setUTCMonth(parsed.getUTCMonth() + 1, 0);
  return toClinicDateKey(parsed);
};

export const normalizeVaccinationPeriod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return PERIOD_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "month";
};

export const getVaccinationPeriodRange = ({
  period,
  startDate,
  endDate,
  referenceDate = new Date(),
} = {}) => {
  const normalizedPeriod = normalizeVaccinationPeriod(period);

  if (normalizedPeriod === "custom") {
    return {
      startDate: toClinicDateKey(startDate),
      endDate: toClinicDateKey(endDate),
    };
  }

  const today = toClinicDateKey(referenceDate);
  if (!today) {
    return {
      startDate: "",
      endDate: "",
    };
  }

  if (normalizedPeriod === "today") {
    // same-day range
  } else if (normalizedPeriod === "week") {
    return {
      startDate: startOfClinicWeekKey(today),
      endDate: endOfClinicWeekKey(today),
    };
  } else if (normalizedPeriod === "month") {
    return {
      startDate: startOfClinicMonthKey(today),
      endDate: endOfClinicMonthKey(today),
    };
  } else {
    return {
      startDate: "",
      endDate: "",
    };
  }

  return {
    startDate: today,
    endDate: today,
  };
};

export const isDateWithinVaccinationPeriod = (value, range = {}) => {
  const candidate = toClinicDateKey(value);
  if (!candidate) {
    return false;
  }

  const start = toClinicDateKey(range.startDate);
  const end = toClinicDateKey(range.endDate);

  if (start && candidate < start) {
    return false;
  }

  if (end && candidate > end) {
    return false;
  }

  return true;
};

export const buildVaccinationRecordPeriodParams = (periodState = {}) => {
  const normalizedPeriod = normalizeVaccinationPeriod(periodState.period);

  if (normalizedPeriod === "custom") {
    const { startDate, endDate } = getVaccinationPeriodRange(periodState);

    return {
      period: normalizedPeriod,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }

  return {
    period: normalizedPeriod,
  };
};

export const buildVaccinationInfantPeriodParams = (periodState = {}) => {
  const { startDate, endDate } = getVaccinationPeriodRange(periodState);

  return {
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  };
};

export { PERIOD_OPTIONS };
