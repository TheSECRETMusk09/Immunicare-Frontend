const DATE_ONLY_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const resolvePrintLocale = () => {
  if (typeof navigator !== "undefined") {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      return navigator.languages[0];
    }

    if (navigator.language) {
      return navigator.language;
    }
  }

  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
};

export const resolvePrintTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const parseDateOnlyValue = (value, { endOfDay = false } = {}) => {
  if (!value) {
    return null;
  }

  const rawValue = String(value).trim();
  if (!DATE_ONLY_VALUE_PATTERN.test(rawValue)) {
    return null;
  }

  const parsed = new Date(`${rawValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
};

export const parseDateLikeValue = (value, { endOfDay = false } = {}) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    const cloned = new Date(value.getTime());
    if (endOfDay) {
      cloned.setHours(23, 59, 59, 999);
    }
    return cloned;
  }

  if (typeof value === "string" && DATE_ONLY_VALUE_PATTERN.test(value.trim())) {
    return parseDateOnlyValue(value, { endOfDay });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
};

export const validatePrintDateRange = ({
  startDate = "",
  endDate = "",
  requireBothDates = false,
} = {}) => {
  const normalizedStart = String(startDate || "").trim();
  const normalizedEnd = String(endDate || "").trim();

  if (!normalizedStart && !normalizedEnd) {
    return {
      isValid: !requireBothDates,
      error: requireBothDates
        ? "Select both Start Date and End Date before printing or exporting."
        : "",
      start: null,
      end: null,
    };
  }

  if (!normalizedStart || !normalizedEnd) {
    return {
      isValid: false,
      error: "Select both Start Date and End Date before printing or exporting.",
      start: null,
      end: null,
    };
  }

  const parsedStart = parseDateOnlyValue(normalizedStart);
  const parsedEnd = parseDateOnlyValue(normalizedEnd, { endOfDay: true });

  if (!parsedStart || !parsedEnd) {
    return {
      isValid: false,
      error: "Enter valid Start Date and End Date values.",
      start: null,
      end: null,
    };
  }

  if (parsedStart.getTime() > parsedEnd.getTime()) {
    return {
      isValid: false,
      error: "Start Date cannot be later than End Date.",
      start: null,
      end: null,
    };
  }

  return {
    isValid: true,
    error: "",
    start: parsedStart,
    end: parsedEnd,
  };
};

export const formatPrintDateValue = (
  value,
  {
    locale = resolvePrintLocale(),
    timeZone = resolvePrintTimeZone(),
    fallback = "",
    ...options
  } = {},
) => {
  const parsed = parseDateLikeValue(value);
  if (!parsed) {
    return fallback || (value ? String(value) : "");
  }

  const hasExplicitDateParts = ["weekday", "era", "year", "month", "day"].some(
    (key) => Object.prototype.hasOwnProperty.call(options, key),
  );

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...(!hasExplicitDateParts &&
    !Object.prototype.hasOwnProperty.call(options, "dateStyle")
      ? { dateStyle: "medium" }
      : {}),
    ...options,
  }).format(parsed);
};

export const formatPrintDateTimeValue = (
  value,
  {
    locale = resolvePrintLocale(),
    timeZone = resolvePrintTimeZone(),
    fallback = "",
    ...options
  } = {},
) => {
  const parsed = parseDateLikeValue(value);
  if (!parsed) {
    return fallback || (value ? String(value) : "");
  }

  const hasExplicitDateParts = ["weekday", "era", "year", "month", "day"].some(
    (key) => Object.prototype.hasOwnProperty.call(options, key),
  );
  const hasExplicitTimeParts = [
    "hour",
    "minute",
    "second",
    "fractionalSecondDigits",
    "timeZoneName",
    "hour12",
    "hourCycle",
  ].some((key) => Object.prototype.hasOwnProperty.call(options, key));

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...(!hasExplicitDateParts &&
    !Object.prototype.hasOwnProperty.call(options, "dateStyle")
      ? { dateStyle: "medium" }
      : {}),
    ...(!hasExplicitTimeParts &&
    !Object.prototype.hasOwnProperty.call(options, "timeStyle")
      ? { timeStyle: "short" }
      : {}),
    ...options,
  }).format(parsed);
};

export const formatPrintDateRangeLabel = ({
  startDate = "",
  endDate = "",
  locale = resolvePrintLocale(),
  timeZone = resolvePrintTimeZone(),
  prefix = "Date Range",
  fallbackLabel = "All available records",
} = {}) => {
  const validation = validatePrintDateRange({ startDate, endDate });
  if (!validation.isValid || !validation.start || !validation.end) {
    return `${prefix}: ${fallbackLabel}`;
  }

  return `${prefix}: ${formatPrintDateValue(validation.start, {
    locale,
    timeZone,
  })} - ${formatPrintDateValue(validation.end, {
    locale,
    timeZone,
  })}`;
};

export const isValueWithinPrintDateRange = (
  value,
  { startDate = "", endDate = "" } = {},
) => {
  const validation = validatePrintDateRange({ startDate, endDate });
  if (!validation.isValid || !validation.start || !validation.end) {
    return true;
  }

  const parsedValue = parseDateLikeValue(value);
  if (!parsedValue) {
    return false;
  }

  return (
    parsedValue.getTime() >= validation.start.getTime() &&
    parsedValue.getTime() <= validation.end.getTime()
  );
};

export const filterItemsByPrintDateRange = (
  items = [],
  {
    startDate = "",
    endDate = "",
    getItemDates,
  } = {},
) => {
  const validation = validatePrintDateRange({ startDate, endDate });
  if (!validation.isValid || !validation.start || !validation.end) {
    return items;
  }

  return items.filter((item) => {
    const candidateValues = typeof getItemDates === "function"
      ? getItemDates(item)
      : [];

    return []
      .concat(candidateValues || [])
      .some((candidate) =>
        isValueWithinPrintDateRange(candidate, {
          startDate,
          endDate,
        }),
      );
  });
};
