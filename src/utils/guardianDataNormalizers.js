/**
 * Guardian Data Normalizers
 * 
 * Centralized normalizers for guardian-related API responses to ensure
 * consistent data handling across all guardian components and hooks.
 */

/**
 * Normalize guardian children/infants response
 * Handles various API response formats and ensures consistent array output
 * 
 * @param {*} response - API response (can be array, object with data, or nested structure)
 * @returns {Array} - Normalized array of children
 */
export const normalizeGuardianChildren = (response) => {
  if (!response) return [];
  
  if (Array.isArray(response)) return response;
  
  if (response.data) {
    if (Array.isArray(response.data)) return response.data;
    if (response.data.children && Array.isArray(response.data.children)) {
      return response.data.children;
    }
    if (response.data.infants && Array.isArray(response.data.infants)) {
      return response.data.infants;
    }
    if (response.data.patients && Array.isArray(response.data.patients)) {
      return response.data.patients;
    }
  }
  
  if (response.children && Array.isArray(response.children)) {
    return response.children;
  }
  
  if (response.infants && Array.isArray(response.infants)) {
    return response.infants;
  }
  
  if (response.patients && Array.isArray(response.patients)) {
    return response.patients;
  }
  
  return [];
};

/**
 * Normalize guardian appointments response
 * 
 * @param {*} response - API response
 * @returns {Array} - Normalized array of appointments
 */
export const normalizeGuardianAppointments = (response) => {
  if (!response) return [];
  
  if (Array.isArray(response)) return response;
  
  if (response.data) {
    if (Array.isArray(response.data)) return response.data;
    if (response.data.appointments && Array.isArray(response.data.appointments)) {
      return response.data.appointments;
    }
  }
  
  if (response.appointments && Array.isArray(response.appointments)) {
    return response.appointments;
  }
  
  return [];
};

/**
 * Normalize guardian stats response
 * 
 * @param {*} response - API response
 * @returns {Object} - Normalized stats object
 */
export const normalizeGuardianStats = (response) => {
  if (!response) return {};
  
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    return response.data;
  }
  
  if (typeof response === 'object' && !Array.isArray(response)) {
    return response;
  }
  
  return {};
};

/**
 * Normalize guardian notifications response
 * 
 * @param {*} response - API response
 * @returns {Array} - Normalized array of notifications
 */
export const normalizeGuardianNotifications = (response) => {
  if (!response) return [];
  
  if (Array.isArray(response)) return response;
  
  if (response.data) {
    if (Array.isArray(response.data)) return response.data;
    if (response.data.notifications && Array.isArray(response.data.notifications)) {
      return response.data.notifications;
    }
  }
  
  if (response.notifications && Array.isArray(response.notifications)) {
    return response.notifications;
  }
  
  return [];
};

/**
 * Normalize download history response
 * 
 * @param {*} response - API response
 * @returns {Array} - Normalized array of download records
 */
export const normalizeDownloadHistory = (response) => {
  if (!response) return [];
  
  if (Array.isArray(response)) return response;
  
  if (response.data) {
    if (Array.isArray(response.data)) return response.data;
    if (response.data.downloads && Array.isArray(response.data.downloads)) {
      return response.data.downloads;
    }
    if (response.data.history && Array.isArray(response.data.history)) {
      return response.data.history;
    }
  }
  
  if (response.downloads && Array.isArray(response.downloads)) {
    return response.downloads;
  }
  
  if (response.history && Array.isArray(response.history)) {
    return response.history;
  }
  
  return [];
};
