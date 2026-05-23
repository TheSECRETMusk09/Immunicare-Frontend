/**
 * Date utility functions
 * Centralized date formatting and manipulation utilities
 */
const CLINIC_TIMEZONE = 'Asia/Manila';
const CLINIC_TIMEZONE_OFFSET_HOURS = 8;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const TIME_SLOT_CONFIG = Object.freeze({
  start: '08:00',
  end: '16:00',
  intervalMinutes: 30,
  lunchStart: '12:00',
  lunchEnd: '13:00',
});

const timeToMinutes = (timeValue) => {
  if (!timeValue) {
    return null;
  }

  const [hours, minutes] = String(timeValue).split(':').map((part) => parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildDailyTimeSlots = () => {
  const startMinutes = timeToMinutes(TIME_SLOT_CONFIG.start);
  const endMinutes = timeToMinutes(TIME_SLOT_CONFIG.end);
  const lunchStartMinutes = timeToMinutes(TIME_SLOT_CONFIG.lunchStart);
  const lunchEndMinutes = timeToMinutes(TIME_SLOT_CONFIG.lunchEnd);

  if (
    startMinutes === null ||
    endMinutes === null ||
    lunchStartMinutes === null ||
    lunchEndMinutes === null
  ) {
    return [];
  }

  const slots = [];
  for (let current = startMinutes; current <= endMinutes; current += TIME_SLOT_CONFIG.intervalMinutes) {
    if (current >= lunchStartMinutes && current < lunchEndMinutes) {
      continue;
    }
    slots.push(minutesToTime(current));
  }

  return slots;
};

const DAILY_TIME_SLOTS = buildDailyTimeSlots();
const DAILY_TIME_SLOT_SET = new Set(DAILY_TIME_SLOTS);
const DAILY_TIME_SLOT_MINUTES = DAILY_TIME_SLOTS
  .map((slot) => timeToMinutes(slot))
  .filter((value) => Number.isFinite(value));

const clinicDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const clinicDateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const clinicDateTimeLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const clinicTimeLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const padDatePart = (value) => String(value).padStart(2, '0');

const getParts = (date) => {
  const parts = clinicDateTimeFormatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== 'literal') {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  if (
    [year, month, day, hour, minute, second].some((part) => Number.isNaN(part))
  ) {
    return null;
  }

  return {
    dateKey: `${year}-${padDatePart(month)}-${padDatePart(day)}`,
    time: `${padDatePart(hour)}:${padDatePart(minute)}`,
    minutesOfDay: hour * 60 + minute,
    date,
  };
};

const buildClinicDateTimeFromParts = (dateKey, timeValue) => {
  if (!dateKey || !timeValue) {
    return null;
  }

  const dateMatch = String(dateKey).trim().match(DATE_ONLY_PATTERN);
  const minutes = timeToMinutes(timeValue);
  if (!dateMatch || minutes === null) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const utcDate = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours - CLINIC_TIMEZONE_OFFSET_HOURS,
    mins,
    0,
    0,
  ));

  return Number.isNaN(utcDate.getTime()) ? null : utcDate;
};

export function parseAppointmentDateTimeInput(value, { requireTime = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    const instant = new Date(value.getTime());
    const parts = getParts(instant);
    if (!parts) {
      return null;
    }

    return {
      instant,
      dateKey: parts.dateKey,
      time: parts.time,
      minutesOfDay: parts.minutesOfDay,
      hasTime: true,
      normalizedIsoString: instant.toISOString(),
    };
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const dateOnlyMatch = text.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    if (requireTime) {
      return null;
    }

    const [, year, month, day] = dateOnlyMatch;
    const instant = new Date(`${year}-${month}-${day}T00:00:00+08:00`);
    const parts = getParts(instant);
    if (!parts) {
      return null;
    }

    return {
      instant,
      dateKey: parts.dateKey,
      time: parts.time,
      minutesOfDay: parts.minutesOfDay,
      hasTime: false,
      normalizedIsoString: instant.toISOString(),
    };
  }

  const dateTimeMatch = text.match(DATE_TIME_PATTERN);
  if (dateTimeMatch) {
    const hasTimezone = TIMEZONE_PATTERN.test(text);
    const [, year, month, day, hour, minute, second = '00', millisecond = '000'] = dateTimeMatch;
    const normalizedMillisecond = String(millisecond).padEnd(3, '0').slice(0, 3);
    const instant = hasTimezone
      ? new Date(text)
      : new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedMillisecond}+08:00`);

    if (Number.isNaN(instant.getTime())) {
      return null;
    }

    const parts = getParts(instant);
    if (!parts) {
      return null;
    }

    return {
      instant,
      dateKey: parts.dateKey,
      time: parts.time,
      minutesOfDay: parts.minutesOfDay,
      hasTime: true,
      normalizedIsoString: instant.toISOString(),
    };
  }

  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const parts = getParts(instant);
  if (!parts) {
    return null;
  }

  return {
    instant,
    dateKey: parts.dateKey,
    time: parts.time,
    minutesOfDay: parts.minutesOfDay,
    hasTime: true,
    normalizedIsoString: instant.toISOString(),
  };
}

export function normalizeAppointmentTimeToAllowedSlot(timeValue) {
  const minutes = timeToMinutes(timeValue);
  if (minutes === null || DAILY_TIME_SLOT_MINUTES.length === 0) {
    return TIME_SLOT_CONFIG.start;
  }

  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  DAILY_TIME_SLOT_MINUTES.forEach((slotMinutes, index) => {
    const diff = Math.abs(slotMinutes - minutes);
    if (diff < bestDiff || (diff === bestDiff && slotMinutes < DAILY_TIME_SLOT_MINUTES[bestIndex])) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return DAILY_TIME_SLOTS[bestIndex] || TIME_SLOT_CONFIG.start;
}

export function normalizeAppointmentDateTimeForDisplay(value) {
  const parsed = parseAppointmentDateTimeInput(value, { requireTime: false });
  if (!parsed) {
    return null;
  }

  const normalizedTime = DAILY_TIME_SLOT_SET.has(parsed.time)
    ? parsed.time
    : normalizeAppointmentTimeToAllowedSlot(parsed.time);

  return buildClinicDateTimeFromParts(parsed.dateKey, normalizedTime);
}

export function getClinicDateTimeParts(value) {
  const normalized = normalizeAppointmentDateTimeForDisplay(value);
  if (!normalized) {
    return null;
  }

  return getParts(normalized);
}

export function toClinicDateKey(value) {
  const parts = getClinicDateTimeParts(value);
  return parts?.dateKey || '';
}

export function fromClinicDateKey(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value.trim())) {
    return null;
  }

  const instant = new Date(`${value.trim()}T00:00:00+08:00`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function formatClinicDateLabel(value) {
  const normalized = normalizeAppointmentDateTimeForDisplay(value);
  return normalized ? clinicDateLabelFormatter.format(normalized) : '';
}

export function formatClinicDateTime(value) {
  const normalized = normalizeAppointmentDateTimeForDisplay(value);
  return normalized ? clinicDateTimeLabelFormatter.format(normalized) : '';
}

export function formatClinicTime(value) {
  if (!value) return '';

  if (/^\d{2}:\d{2}$/.test(String(value).trim())) {
    const normalized = buildClinicDateTimeFromParts('2000-01-01', value);
    return normalized ? clinicTimeLabelFormatter.format(normalized) : String(value);
  }

  const normalized = normalizeAppointmentDateTimeForDisplay(value);
  return normalized ? clinicTimeLabelFormatter.format(normalized) : '';
}

export function combineClinicDateTime(dateKey, timeValue) {
  const date = String(dateKey || '').trim();
  const time = String(timeValue || '').trim();

  if (!DATE_ONLY_PATTERN.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return '';
  }

  const instant = buildClinicDateTimeFromParts(date, time);
  return instant ? instant.toISOString() : '';
}

/**
 * Convert a Date object or date string to YYYY-MM-DD format (Asia/Manila timezone)
 * @param {Date|string} value - Date to convert
 * @returns {string} Date in YYYY-MM-DD format
 */
export function toDateKey(value) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = getParts(date);
  return parts ? parts.dateKey : '';
}

/**
 * Convert a Date object to YYYY-MM format (Asia/Manila timezone)
 * @param {Date} date - Date to convert
 * @returns {string} Date in YYYY-MM format
 */
export function toMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const parts = getParts(d);
  return parts ? parts.dateKey.slice(0, 7) : '';
}

/**
 * Convert YYYY-MM-DD string to Date object (PST midnight, UTC+8)
 * @param {string} value - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date object or null if invalid
 */
export function fromDateKey(value) {
  if (!value || typeof value !== 'string') return null;
  const parsedDate = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

/**
 * Format a date string or Date object to a readable format (Asia/Manila timezone)
 * @param {string|Date} date - The date to format
 * @param {string} format - The output format (default: 'YYYY-MM-DD')
 * @returns {string} The formatted date string
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';

  const d = new Date(date);

  if (isNaN(d.getTime())) return '';

  const parts = getParts(d);
  if (!parts) return '';

  const [year, month, day] = parts.dateKey.split('-');

  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY/MM/DD':
    default:
      return parts.dateKey;
  }
}

/**
 * Format a date with time in localized format
 * @param {string|Date} value - The date to format
 * @returns {string} The formatted date and time string
 */
export function formatDateTime(value) {
  return formatClinicDateTime(value);
}

/**
 * Format time slot (HH:MM) to readable format
 * @param {string} value - Time in HH:MM format
 * @returns {string} Formatted time string
 */
export function formatTimeSlotLabel(value) {
  return formatClinicTime(value);
}

const infantDobLongFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const infantDobShortFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
});

function parseInfantDobToDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatInfantDob(value) {
  const date = parseInfantDobToDate(value);
  return date ? infantDobLongFormatter.format(date) : '';
}

export function formatInfantDobShort(value) {
  const date = parseInfantDobToDate(value);
  return date ? infantDobShortFormatter.format(date) : '';
}

export function getInfantDobParts(value) {
  const date = parseInfantDobToDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}
