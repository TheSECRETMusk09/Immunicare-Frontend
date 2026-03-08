/**
 * Philippine Official Government Holidays Utility
 *
 * This module provides functions to check Philippine official holidays
 * and special days for appointment scheduling restrictions.
 *
 * Regular Holidays (Nationwide):
 * - New Year's Day - January 1
 * - Araw ng Kagitingan (Bataan Day) - April 9
 * - Maundy Thursday - Variable (March/April)
 * - Good Friday - Variable (March/April)
 * - Labor Day - May 1
 * - Independence Day - June 12
 * - National Heroes Day - Last Sunday of August
 * - Bonifacio Day - November 30
 * - Christmas Day - December 25
 * - Rizal Day - December 30
 *
 * Special Non-Working Holidays:
 * - EDSA People Power Revolution Anniversary - February 25
 * - All Saints' Day - November 1
 * - Last Day of the Year - December 31
 * - Local holidays may vary by region
 */

// Fixed date holidays (month is 0-indexed: 0 = January, 11 = December)
const FIXED_REGULAR_HOLIDAYS = [
  { month: 0, day: 1, name: "New Year's Day", type: "regular" },
  {
    month: 2,
    day: 9,
    name: "Araw ng Kagitingan (Bataan Day)",
    type: "regular",
  },
  { month: 4, day: 1, name: "Labor Day", type: "regular" },
  { month: 5, day: 12, name: "Independence Day", type: "regular" },
  { month: 10, day: 30, name: "Bonifacio Day", type: "regular" },
  { month: 11, day: 25, name: "Christmas Day", type: "regular" },
  { month: 11, day: 30, name: "Rizal Day", type: "regular" },
];

const FIXED_SPECIAL_HOLIDAYS = [
  {
    month: 1,
    day: 25,
    name: "EDSA People Power Revolution Anniversary",
    type: "special",
  },
  { month: 10, day: 1, name: "All Saints' Day", type: "special" },
  { month: 11, day: 31, name: "Last Day of the Year", type: "special" },
];

/**
 * Calculate Easter Sunday for a given year (Western Gregorian calendar)
 * Uses the Anonymous Gregorian algorithm
 * @param {number} year - The year
 * @returns {Date} Easter Sunday date
 */
function calculateEaster(year) {
  const a = Math.floor(year / 100);
  const b = Math.floor(year / 400);
  const c = Math.floor((3 * a + 3) / 4);
  const d = Math.floor((8 * a + 13) / 25);
  const e = Math.floor((19 * a + b - d + 15) % 30);
  const f = Math.floor(c - Math.floor((e * 11) / 32));
  const g = (e + f + 7) % 7;

  let month, day;
  if (e < 10) {
    month = 3;
    day = 22 + e + g;
  } else {
    month = 4;
    day = e + g - 9;
  }

  // Adjust for April
  if (month === 4 && day > 30) {
    month = 4;
    day = day - 30;
  }

  return new Date(year, month - 1, day);
}

/**
 * Calculate movable holidays for a specific year
 * @param {number} year - The year
 * @returns {Array} Array of movable holiday objects
 */
function getMovableHolidays(year) {
  const holidays = [];

  // Calculate Easter
  const easter = calculateEaster(year);

  // Maundy Thursday (2 days before Easter)
  const maundyThursday = new Date(easter);
  maundyThursday.setDate(easter.getDate() - 3);
  holidays.push({
    date: maundyThursday,
    name: "Maundy Thursday",
    type: "regular",
  });

  // Good Friday (2 days before Easter)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({
    date: goodFriday,
    name: "Good Friday",
    type: "regular",
  });

  // National Heroes Day (Last Sunday of August)
  const august = new Date(year, 7, 1); // August
  const dayOfWeek = august.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const lastSunday = new Date(august);
  lastSunday.setDate(august.getDate() + daysUntilSunday + 21); // Last Sunday
  holidays.push({
    date: lastSunday,
    name: "National Heroes Day",
    type: "regular",
  });

  return holidays;
}

/**
 * Get all Philippine holidays for a specific year
 * @param {number} year - The year
 * @returns {Array} Array of holiday objects with date and name
 */
export function getPhilippineHolidays(year) {
  const holidays = [];

  // Add fixed regular holidays
  FIXED_REGULAR_HOLIDAYS.forEach((h) => {
    holidays.push({
      date: new Date(year, h.month, h.day),
      name: h.name,
      type: h.type,
    });
  });

  // Add fixed special holidays
  FIXED_SPECIAL_HOLIDAYS.forEach((h) => {
    holidays.push({
      date: new Date(year, h.month, h.day),
      name: h.name,
      type: h.type,
    });
  });

  // Add movable holidays
  const movableHolidays = getMovableHolidays(year);
  holidays.push(...movableHolidays);

  return holidays.sort((a, b) => a.date - b.date);
}

/**
 * Check if a specific date is a Philippine holiday
 * @param {Date|string} date - The date to check
 * @returns {Object|null} Holiday object if it's a holiday, null otherwise
 */
export function isPhilippineHoliday(date) {
  if (!date) return null;

  const d = new Date(date);
  const year = d.getFullYear();

  // Get holidays for this year
  const holidays = getPhilippineHolidays(year);

  // Check if the date matches any holiday
  for (const holiday of holidays) {
    if (
      holiday.date.getDate() === d.getDate() &&
      holiday.date.getMonth() === d.getMonth() &&
      holiday.date.getFullYear() === d.getFullYear()
    ) {
      return holiday;
    }
  }

  return null;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if weekend, false otherwise
 */
export function isWeekend(date) {
  if (!date) return false;
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Check if a date is a Saturday
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if Saturday, false otherwise
 */
export function isSaturday(date) {
  if (!date) return false;
  const d = new Date(date);
  return d.getDay() === 6;
}

/**
 * Check if a date is a Sunday
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if Sunday, false otherwise
 */
export function isSunday(date) {
  if (!date) return false;
  const d = new Date(date);
  return d.getDay() === 0;
}

/**
 * Check if a date is available for booking (not a weekend or holiday)
 * @param {Date|string} date - The date to check
 * @returns {Object} Object with isAvailable (boolean) and reason (string)
 */
export function isDateAvailableForBooking(date) {
  if (!date) {
    return { isAvailable: false, reason: "No date provided" };
  }

  const d = new Date(date);
  const holiday = isPhilippineHoliday(d);

  if (isSaturday(d)) {
    return {
      isAvailable: false,
      reason: "Saturday - No appointments available",
    };
  }

  if (isSunday(d)) {
    return { isAvailable: false, reason: "Sunday - No appointments available" };
  }

  if (holiday) {
    return {
      isAvailable: false,
      reason: `${holiday.name} - ${holiday.type === "regular" ? "Regular Holiday" : "Special Holiday"}`,
    };
  }

  return { isAvailable: true, reason: "Available" };
}

/**
 * Get the minimum date for booking (today)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getMinBookingDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/**
 * Get holidays for a specific month and year (for calendar display)
 * @param {number} year - The year
 * @param {number} month - The month (0-indexed)
 * @returns {Array} Array of holiday objects
 */
export function getHolidaysForMonth(year, month) {
  const allHolidays = getPhilippineHolidays(year);
  return allHolidays.filter((h) => h.date.getMonth() === month);
}

/**
 * Format a holiday for display
 * @param {Object} holiday - Holiday object
 * @returns {string} Formatted holiday string
 */
export function formatHoliday(holiday) {
  if (!holiday) return "";
  const dateStr = holiday.date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${dateStr} - ${holiday.name}`;
}

/**
 * Get all upcoming holidays from today
 * @returns {Array} Array of upcoming holiday objects
 */
export function getUpcomingHolidays() {
  const today = new Date();
  const year = today.getFullYear();
  const allHolidays = getPhilippineHolidays(year);

  // Also get holidays for next year to cover early January
  const nextYearHolidays = getPhilippineHolidays(year + 1);

  return [...allHolidays, ...nextYearHolidays]
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date - b.date)
    .slice(0, 10);
}

/**
 * Get date picker disabled dates (weekends and holidays)
 * @param {Date} currentDate - Current date being viewed in calendar
 * @returns {Function} Function that returns true if date should be disabled
 */
export function getDatePickerFilter(currentDate) {
  return (date) => {
    const d = new Date(date);
    // Disable past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return true;

    // Disable weekends
    if (isWeekend(d)) return true;

    // Disable holidays
    if (isPhilippineHoliday(d)) return true;

    return false;
  };
}

/**
 * Get CSS class for holiday type
 * @param {string} type - Holiday type
 * @returns {string} CSS class name
 */
export function getHolidayTypeClass(type) {
  if (type === "regular") return "ph-holiday-regular";
  return "ph-holiday-special";
}
