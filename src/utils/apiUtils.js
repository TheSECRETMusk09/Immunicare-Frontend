/**
 * API Response Utility Functions
 * Centralized utilities for handling API responses
 */

/**
 * Unwrap API payload from nested data structure
 * @param {*} value - API response value
 * @returns {*} Unwrapped data
 */
export function unwrapApiPayload(value) {
  if (value && typeof value === 'object' && 'data' in value) {
    return value.data;
  }
  return value;
}

/**
 * Normalize API response to array format
 * @param {*} value - API response value
 * @param {string[]} candidateKeys - Additional keys to check for array data
 * @returns {Array} Normalized array
 */
export function normalizeArrayPayload(value, candidateKeys = []) {
  const payload = unwrapApiPayload(value);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const keys = ['data', ...candidateKeys];
    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }

  return [];
}
