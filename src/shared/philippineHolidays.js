"use strict";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLINIC_TIMEZONE = "Asia/Manila";

const PH_FIXED_HOLIDAYS = Object.freeze([
  { month: 1, day: 1, name: "New Year's Day", type: "regular" },
  { month: 2, day: 25, name: "EDSA People Power Revolution Anniversary", type: "special" },
  { month: 4, day: 9, name: "Araw ng Kagitingan (Bataan Day)", type: "regular" },
  { month: 5, day: 1, name: "Labor Day", type: "regular" },
  { month: 6, day: 12, name: "Independence Day", type: "regular" },
  { month: 8, day: 21, name: "Ninoy Aquino Day", type: "special" },
  { month: 11, day: 1, name: "All Saints' Day", type: "special" },
  { month: 11, day: 2, name: "All Souls' Day", type: "special" },
  { month: 11, day: 30, name: "Bonifacio Day", type: "regular" },
  { month: 12, day: 8, name: "Feast of the Immaculate Conception", type: "special" },
  { month: 12, day: 24, name: "Christmas Eve", type: "special" },
  { month: 12, day: 25, name: "Christmas Day", type: "regular" },
  { month: 12, day: 30, name: "Rizal Day", type: "regular" },
  { month: 12, day: 31, name: "Last Day of the Year", type: "special" },
]);

const padDatePart = (value) => String(value).padStart(2, "0");

const createUtcNoonDate = (year, monthIndex, day) => {
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseDateInput = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const dateOnlyMatch = normalized.match(DATE_ONLY_PATTERN);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return createUtcNoonDate(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeDateOnlyInput = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    const match = normalized.match(DATE_ONLY_PATTERN);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${padDatePart(Number(month))}-${padDatePart(Number(day))}`;
    }
  }

  const date = parseDateInput(value);
  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

const toDateKey = (value) => normalizeDateOnlyInput(value);

const fromDateKey = (value) => {
  const dateKey = normalizeDateOnlyInput(value);
  if (!dateKey) {
    return null;
  }

  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateEasterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return createUtcNoonDate(year, month - 1, day);
};

const getLastWeekdayOfMonth = (year, monthIndex, weekday) => {
  const cursor = createUtcNoonDate(year, monthIndex + 1, 0);
  if (!cursor) {
    return null;
  }

  while (cursor.getUTCDay() !== weekday) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return cursor;
};

const getMovableHolidays = (year) => {
  const easterSunday = calculateEasterSunday(year);
  if (!easterSunday) {
    return [];
  }

  const maundyThursday = new Date(easterSunday.getTime());
  maundyThursday.setUTCDate(easterSunday.getUTCDate() - 3);

  const goodFriday = new Date(easterSunday.getTime());
  goodFriday.setUTCDate(easterSunday.getUTCDate() - 2);

  const blackSaturday = new Date(easterSunday.getTime());
  blackSaturday.setUTCDate(easterSunday.getUTCDate() + 1);

  const nationalHeroesDay = getLastWeekdayOfMonth(year, 7, 1);

  return [
    { date: maundyThursday, name: "Maundy Thursday", type: "regular" },
    { date: goodFriday, name: "Good Friday", type: "regular" },
    { date: blackSaturday, name: "Black Saturday", type: "special" },
    { date: nationalHeroesDay, name: "National Heroes Day", type: "regular" },
  ].filter((holiday) => holiday.date);
};

const getPhilippineHolidays = (year) => {
  const holidays = [];

  PH_FIXED_HOLIDAYS.forEach((holiday) => {
    const fixedDate = createUtcNoonDate(year, holiday.month - 1, holiday.day);
    if (!fixedDate) {
      return;
    }

    holidays.push({
      date: fixedDate,
      name: holiday.name,
      type: holiday.type,
    });
  });

  holidays.push(...getMovableHolidays(year));

  return holidays.sort((left, right) => left.date - right.date);
};

const getHolidayInfo = (date) => {
  const parsedDate = parseDateInput(date);
  if (!parsedDate) {
    return null;
  }

  const dateKey = toDateKey(parsedDate);
  if (!dateKey) {
    return null;
  }

  return getPhilippineHolidays(parsedDate.getFullYear()).find(
    (holiday) => toDateKey(holiday.date) === dateKey,
  ) || null;
};

const isPhilippineHoliday = (date) => getHolidayInfo(date);

const isWeekend = (date) => {
  const parsedDate = parseDateInput(date);
  if (!parsedDate) {
    return false;
  }

  const day = parsedDate.getDay();
  return day === 0 || day === 6;
};

const isSaturday = (date) => {
  const parsedDate = parseDateInput(date);
  if (!parsedDate) {
    return false;
  }

  return parsedDate.getDay() === 6;
};

const isSunday = (date) => {
  const parsedDate = parseDateInput(date);
  if (!parsedDate) {
    return false;
  }

  return parsedDate.getDay() === 0;
};

const isDateAvailableForBooking = (
  date,
  {
    allowPast = false,
    blockedDate = null,
    blockedDates = null,
    now = new Date(),
  } = {},
) => {
  const parsedDate = parseDateInput(date);
  if (!parsedDate) {
    return {
      isAvailable: false,
      code: "INVALID_DATE",
      reason: "Invalid date provided",
    };
  }

  const dateKey = toDateKey(parsedDate);
  if (!dateKey) {
    return {
      isAvailable: false,
      code: "INVALID_DATE",
      reason: "Invalid date provided",
    };
  }

  const todayKey = toDateKey(now);
  if (!allowPast && todayKey && dateKey < todayKey) {
    return {
      isAvailable: false,
      code: "DATE_IN_PAST",
      reason: "Cannot schedule appointments in the past",
    };
  }

  if (isSaturday(parsedDate)) {
    return {
      isAvailable: false,
      code: "WEEKEND_RESTRICTED",
      reason: "Saturday - No appointments available",
    };
  }

  if (isSunday(parsedDate)) {
    return {
      isAvailable: false,
      code: "WEEKEND_RESTRICTED",
      reason: "Sunday - No appointments available",
    };
  }

  const holiday = getHolidayInfo(parsedDate);
  if (holiday) {
    return {
      isAvailable: false,
      code: "HOLIDAY_RESTRICTED",
      reason: `${holiday.name} is not available for booking`,
      holiday,
    };
  }

  const resolvedBlockedDate =
    blockedDate ||
    (blockedDates && typeof blockedDates === "object" ? blockedDates[dateKey] : null) ||
    null;

  if (resolvedBlockedDate?.is_blocked) {
    return {
      isAvailable: false,
      code: "ADMIN_BLOCKED",
      reason: resolvedBlockedDate.reason
        ? `This date is not available for booking: ${resolvedBlockedDate.reason}`
        : "This date has been blocked by the administrator",
      blockedDate: resolvedBlockedDate,
    };
  }

  return {
    isAvailable: true,
    code: "AVAILABLE",
    reason: "Available",
    holiday: null,
    blockedDate: resolvedBlockedDate,
    dateKey,
  };
};

const getMinBookingDate = (now = new Date()) => {
  const dateKey = toDateKey(now);
  return dateKey || "";
};

const getHolidaysForMonth = (year, month) => {
  const allHolidays = getPhilippineHolidays(year);
  return allHolidays.filter((holiday) => holiday.date.getMonth() === month);
};

const formatHoliday = (holiday) => {
  if (!holiday) {
    return "";
  }

  const dateStr = holiday.date.toLocaleDateString("en-PH", {
    timeZone: CLINIC_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `${dateStr} - ${holiday.name}`;
};

const getUpcomingHolidays = (limit = 10) => {
  const todayKey = toDateKey(new Date());
  if (!todayKey) {
    return [];
  }

  const year = new Date().getFullYear();
  const holidays = [...getPhilippineHolidays(year), ...getPhilippineHolidays(year + 1)]
    .filter((holiday) => {
      const holidayKey = toDateKey(holiday.date);
      return holidayKey && holidayKey >= todayKey;
    })
    .sort((left, right) => left.date - right.date);

  const seen = new Set();
  return holidays.filter((holiday) => {
    const key = toDateKey(holiday.date);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, limit);
};

const getDatePickerFilter = (_currentDate = null, options = {}) => {
  return (date) => !isDateAvailableForBooking(date, options).isAvailable;
};

const getHolidayTypeClass = (type) => {
  if (type === "regular") {
    return "ph-holiday-regular";
  }

  return "ph-holiday-special";
};

const holidayApi = {
  CLINIC_TIMEZONE,
  DATE_ONLY_PATTERN,
  PH_FIXED_HOLIDAYS,
  parseDateInput,
  toDateKey,
  fromDateKey,
  getPhilippineHolidays,
  getHolidayInfo,
  isPhilippineHoliday,
  isWeekend,
  isSaturday,
  isSunday,
  isDateAvailableForBooking,
  getMinBookingDate,
  getHolidaysForMonth,
  formatHoliday,
  getUpcomingHolidays,
  getDatePickerFilter,
  getHolidayTypeClass,
};

module.exports = holidayApi;
module.exports.default = holidayApi;
module.exports.__esModule = true;
