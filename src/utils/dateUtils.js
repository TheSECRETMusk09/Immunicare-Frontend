/**
 * Date utility functions
 * Centralized date formatting and manipulation utilities
 */

/**
 * Convert a Date object or date string to YYYY-MM-DD format
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to YYYY-MM format
 * @param {Date} date - Date to convert
 * @returns {string} Date in YYYY-MM format
 */
export function toMonthKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

/**
 * Convert YYYY-MM-DD string to Date object
 * @param {string} value - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date object or null if invalid
 */
export function fromDateKey(value) {
  if (!value || typeof value !== 'string') return null;
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

/**
 * Format a date string or Date object to a readable format
 * @param {string|Date} date - The date to format
 * @param {string} format - The output format (default: 'YYYY-MM-DD')
 * @returns {string} The formatted date string
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return '';
  
  const d = new Date(date);
  
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY/MM/DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Format a date with time in localized format
 * @param {string|Date} value - The date to format
 * @returns {string} The formatted date and time string
 */
export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format time slot (HH:MM) to readable format
 * @param {string} value - Time in HH:MM format
 * @returns {string} Formatted time string
 */
export function formatTimeSlotLabel(value) {
  if (!value) return '';
  const parsed = new Date(`2000-01-01T${value}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
