const isNil = (value) => value === undefined || value === null;

export const isBlank = (value) => {
  if (isNil(value)) return true;
  return String(value).trim().length === 0;
};

export const sanitizeText = (
  value,
  { trim = true, maxLength = null, preserveNewLines = false } = {},
) => {
  if (isNil(value)) return "";

  let next = String(value);
  if (!preserveNewLines) {
    next = next.replace(/\s+/g, " ");
  }

  if (trim) {
    next = next.trim();
  }

  if (Number.isInteger(maxLength) && maxLength > 0) {
    next = next.slice(0, maxLength);
  }

  return next;
};

export const sanitizeIdentifier = (
  value,
  { maxLength = 30, allowDash = true, upperCase = true } = {},
) => {
  if (isNil(value)) return "";
  const allowedRegex = allowDash ? /[^A-Za-z0-9-]/g : /[^A-Za-z0-9]/g;

  let next = String(value).replace(allowedRegex, "");
  next = upperCase ? next.toUpperCase() : next;
  return next.slice(0, maxLength);
};

export const normalizeEnumValue = (value, allowedValues, fallback = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (allowedValues.includes(normalized)) {
    return normalized;
  }

  return fallback;
};

export const validateRequired = (value, message = "This field is required.") =>
  isBlank(value) ? message : null;

export const validateLength = (value, { min = 0, max = Infinity, label = "Value" } = {}) => {
  if (isBlank(value)) return null;
  const length = String(value).trim().length;

  if (length < min) {
    return `${label} must be at least ${min} characters.`;
  }

  if (length > max) {
    return `${label} must not exceed ${max} characters.`;
  }

  return null;
};

export const validateNumberRange = (
  value,
  {
    label = "Value",
    required = false,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    integer = false,
  } = {},
) => {
  if (isBlank(value)) {
    return {
      value: null,
      error: required ? `${label} is required.` : null,
    };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      error: `${label} must be a valid number.`,
    };
  }

  if (integer && !Number.isInteger(parsed)) {
    return {
      value: null,
      error: `${label} must be a whole number.`,
    };
  }

  if (parsed < min || parsed > max) {
    return {
      value: null,
      error: `${label} must be between ${min} and ${max}.`,
    };
  }

  return {
    value: parsed,
    error: null,
  };
};

export const validateDate = (
  value,
  {
    label = "Date",
    required = false,
    minDate = null,
    maxDate = null,
  } = {},
) => {
  if (isBlank(value)) {
    return {
      value: null,
      error: required ? `${label} is required.` : null,
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      value: null,
      error: `${label} is invalid.`,
    };
  }

  if (minDate) {
    const min = new Date(minDate);
    if (!Number.isNaN(min.getTime()) && parsed < min) {
      return {
        value: parsed,
        error: `${label} must be on or after ${min.toISOString().slice(0, 10)}.`,
      };
    }
  }

  if (maxDate) {
    const max = new Date(maxDate);
    if (!Number.isNaN(max.getTime()) && parsed > max) {
      return {
        value: parsed,
        error: `${label} must be on or before ${max.toISOString().slice(0, 10)}.`,
      };
    }
  }

  return {
    value: parsed,
    error: null,
  };
};

export const validateDateRange = ({
  startDate,
  endDate,
  startKey = "startDate",
  endKey = "endDate",
  startLabel = "Start date",
  endLabel = "End date",
} = {}) => {
  const errors = {};
  const start = validateDate(startDate, { label: startLabel });
  const end = validateDate(endDate, { label: endLabel });

  if (start.error) {
    errors[startKey] = start.error;
  }

  if (end.error) {
    errors[endKey] = end.error;
  }

  if (!start.error && !end.error && start.value && end.value && end.value < start.value) {
    errors[endKey] = `${endLabel} cannot be earlier than ${startLabel.toLowerCase()}.`;
  }

  return errors;
};

export const hasFieldErrors = (errors = {}) =>
  Object.values(errors).some((value) => Boolean(value));

export const mergeFieldErrors = (...errorMaps) =>
  errorMaps.reduce((accumulator, current) => {
    if (!current || typeof current !== "object") return accumulator;
    Object.entries(current).forEach(([key, value]) => {
      if (value) {
        accumulator[key] = value;
      }
    });
    return accumulator;
  }, {});

export const findDuplicateRecord = ({
  records = [],
  candidate = {},
  keys = [],
} = {}) => {
  if (!Array.isArray(records) || !Array.isArray(keys) || keys.length === 0) {
    return null;
  }

  return (
    records.find((record) =>
      keys.every((key) => {
        const left = sanitizeText(record?.[key], { preserveNewLines: true }).toLowerCase();
        const right = sanitizeText(candidate?.[key], {
          preserveNewLines: true,
        }).toLowerCase();
        return left === right;
      }),
    ) || null
  );
};

