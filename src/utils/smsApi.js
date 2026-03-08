/**
 * SMS API Client
 *
 * Frontend API client for interacting with SMS endpoints
 */

import apiClient from "./api";

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone number to send OTP to
 * @param {string} purpose - Purpose of OTP (verification, password_reset, phone_verification)
 * @returns {Promise<Object>} - API response
 */
export const sendOTP = async (phoneNumber, purpose = "verification") => {
  const response = await apiClient.post("/sms/send-otp", {
    phoneNumber,
    purpose,
  });
  return response.data;
};

/**
 * Verify OTP code
 * @param {string} phoneNumber - Phone number that received the OTP
 * @param {string} code - OTP code to verify
 * @param {string} purpose - Purpose of OTP
 * @returns {Promise<Object>} - API response
 */
export const verifyOTP = async (
  phoneNumber,
  code,
  purpose = "verification",
) => {
  const response = await apiClient.post("/sms/verify-otp", {
    phoneNumber,
    code,
    purpose,
  });
  return response.data;
};

/**
 * Request password reset via SMS
 * @param {string} phoneNumber - Phone number associated with account
 * @returns {Promise<Object>} - API response
 */
export const requestPasswordReset = async (phoneNumber) => {
  const response = await apiClient.post("/sms/password-reset", {
    phoneNumber,
  });
  return response.data;
};

/**
 * Get SMS preferences for authenticated guardian
 * @returns {Promise<Object>} - API response with phone numbers and preferences
 */
export const getSMSPreferences = async () => {
  const response = await apiClient.get("/sms/preferences");
  return response.data;
};

/**
 * Update SMS preferences
 * @param {number} phoneNumberId - ID of the phone number
 * @param {Object} smsPreferences - Updated preferences
 * @returns {Promise<Object>} - API response
 */
export const updateSMSPreferences = async (phoneNumberId, smsPreferences) => {
  const response = await apiClient.put("/sms/preferences", {
    phoneNumberId,
    smsPreferences,
  });
  return response.data;
};

/**
 * Start phone number verification
 * @param {string} phoneNumber - Phone number to verify
 * @returns {Promise<Object>} - API response
 */
export const verifyPhoneNumber = async (phoneNumber) => {
  const response = await apiClient.post("/sms/verify-phone", {
    phoneNumber,
  });
  return response.data;
};

/**
 * Confirm phone number verification with OTP
 * @param {string} phoneNumber - Phone number being verified
 * @param {string} code - OTP code
 * @param {boolean} setPrimary - Whether to set as primary number
 * @returns {Promise<Object>} - API response
 */
export const confirmPhoneNumber = async (
  phoneNumber,
  code,
  setPrimary = false,
) => {
  const response = await apiClient.post("/sms/confirm-phone", {
    phoneNumber,
    code,
    setPrimary,
  });
  return response.data;
};

/**
 * Get SMS configuration status
 * @returns {Promise<Object>} - API response with config status
 */
export const getSMSConfigStatus = async () => {
  const response = await apiClient.get("/sms/config-status");
  return response.data;
};

/**
 * Get SMS logs for authenticated guardian
 * @param {number} limit - Number of logs to retrieve
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} - API response with logs
 */
export const getSMSLogs = async (limit = 20, offset = 0) => {
  const response = await apiClient.get("/sms/logs", {
    params: { limit, offset },
  });
  return response.data;
};

/**
 * Send appointment reminder (internal/admin use)
 * @param {Object} appointment - Appointment details
 * @returns {Promise<Object>} - API response
 */
export const sendAppointmentReminder = async (appointment) => {
  const response = await apiClient.post("/sms/send-appointment-reminder", {
    appointment,
  });
  return response.data;
};

export default {
  sendOTP,
  verifyOTP,
  requestPasswordReset,
  getSMSPreferences,
  updateSMSPreferences,
  verifyPhoneNumber,
  confirmPhoneNumber,
  getSMSConfigStatus,
  getSMSLogs,
  sendAppointmentReminder,
};
