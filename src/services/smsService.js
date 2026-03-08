/**
 * SMS Service for Frontend
 * Provides API calls for SMS functionality
 */

import apiClient from "../utils/api";

const smsService = {
  /**
   * Send SMS verification code to a phone number
   * @param {string} phoneNumber - Phone number to verify
   * @param {string} purpose - Purpose of verification (phone_verification, password_reset)
   */
  async sendVerificationCode(phoneNumber, purpose = "phone_verification") {
    return apiClient.post("/sms/send-verification", {
      phoneNumber,
      purpose,
    });
  },

  /**
   * Verify SMS code
   * @param {string} phoneNumber - Phone number that received the code
   * @param {string} code - Verification code
   * @param {string} purpose - Purpose of verification
   */
  async verifyCode(phoneNumber, code, purpose = "phone_verification") {
    return apiClient.post("/sms/verify-code", {
      phoneNumber,
      code,
      purpose,
    });
  },

  /**
   * Request password reset via SMS
   * @param {string} email - User's email (optional)
   * @param {string} phoneNumber - User's phone number (optional)
   */
  async requestPasswordReset(email, phoneNumber) {
    return apiClient.post("/sms/password-reset/request", {
      email,
      phoneNumber,
    });
  },

  /**
   * Verify password reset code
   * @param {string} phoneNumber - Phone number that received the code
   * @param {string} code - Verification code
   */
  async verifyPasswordResetCode(phoneNumber, code) {
    return apiClient.post("/sms/password-reset/verify", {
      phoneNumber,
      code,
    });
  },

  /**
   * Complete password reset with token
   * @param {string} resetToken - Reset token from verification
   * @param {string} newPassword - New password
   */
  async resetPassword(resetToken, newPassword) {
    return apiClient.post("/sms/password-reset/reset", {
      resetToken,
      newPassword,
    });
  },

  /**
   * Get guardian phone numbers
   * @param {number} guardianId - Guardian ID
   */
  async getGuardianPhones(guardianId) {
    return apiClient.get(`/sms/phone/${guardianId}`);
  },

  /**
   * Update guardian phone number
   * @param {number} guardianId - Guardian ID
   * @param {string} phoneNumber - New phone number
   * @param {boolean} isPrimary - Is this the primary phone number
   * @param {object} smsPreferences - SMS preferences
   */
  async updatePhone(
    guardianId,
    phoneNumber,
    isPrimary = true,
    smsPreferences = null,
  ) {
    return apiClient.put(`/sms/phone/${guardianId}`, {
      phoneNumber,
      isPrimary,
      smsPreferences,
    });
  },

  /**
   * Verify phone number change
   * @param {number} guardianId - Guardian ID
   * @param {string} phoneNumber - Phone number to verify
   * @param {string} code - Verification code
   */
  async verifyPhoneChange(guardianId, phoneNumber, code) {
    return apiClient.post(`/sms/phone/${guardianId}/verify`, {
      phoneNumber,
      code,
    });
  },

  /**
   * Get SMS delivery logs (admin only)
   * @param {object} params - Query parameters
   */
  async getSMSLogs(params = {}) {
    return apiClient.get("/sms/logs", { params });
  },

  /**
   * Test SMS endpoint
   * @param {string} phoneNumber - Test phone number
   * @param {string} message - Test message
   */
  async testSMS(phoneNumber, message) {
    return apiClient.post("/sms/test", {
      phoneNumber,
      message,
    });
  },

  /**
   * Format phone number for display (masked)
   * @param {string} phoneNumber - Full phone number
   */
  formatPhoneForDisplay(phoneNumber) {
    if (!phoneNumber) return "";
    if (phoneNumber.length < 8) return phoneNumber;
    return (
      phoneNumber.substring(0, 4) +
      "****" +
      phoneNumber.substring(phoneNumber.length - 4)
    );
  },

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   */
  validatePhoneNumber(phoneNumber) {
    // Basic validation - accepts various formats
    const cleaned = phoneNumber.replace(/\D/g, "");

    // Philippine phone numbers: 10 digits (e.g., 09171234567) or 11 digits with country code
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      return true;
    }

    return false;
  },
};

export default smsService;
