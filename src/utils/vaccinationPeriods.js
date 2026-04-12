const PERIOD_OPTIONS = Object.freeze([
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Date Range" },
]);

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value) => String(value).padStart(2, "0");

const buildLocalDate = (year, monthIndex, day) => {
  const date = new Date(year, monthIndex, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return buildLocalDate(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  const match = text.match(DATE_ONLY_PATTERN);
  if (match) {
    return buildLocalDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return buildLocalDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toDateKey = (value) => {
  const date = parseDateValue(value);
  if (!date) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
      startDate: toDateKey(startDate),
      endDate: toDateKey(endDate),
    };
  }

  const today = parseDateValue(referenceDate) || new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (normalizedPeriod === "today") {
    // same-day range
  } else if (normalizedPeriod === "week") {
    start.setDate(start.getDate() - 6);
  } else if (normalizedPeriod === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  } else {
    return {
      startDate: "",
      endDate: "",
    };
  }

  return {
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
};

export const isDateWithinVaccinationPeriod = (value, range = {}) => {
  const candidate = toDateKey(value);
  if (!candidate) {
    return false;
  }

  const start = toDateKey(range.startDate);
  const end = toDateKey(range.endDate);

  if (start && candidate < start) {
    return false;
  }

  if (end && candidate > end) {
    return false;
  }

  return true;
};

export const buildVaccinationRecordPeriodParams = (periodState = {}) => {
  const { startDate, endDate } = getVaccinationPeriodRange(periodState);

  return {
    ...(startDate ? { administered_start_date: startDate } : {}),
    ...(endDate ? { administered_end_date: endDate } : {}),
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
