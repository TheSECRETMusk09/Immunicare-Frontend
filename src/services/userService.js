/**
 * User Service
 * Handles all user-related API operations (Guardians, System Users, Admins)
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const userService = {
  // ==================== GUARDIANS ====================

  /**
   * Get all guardians
   * @returns {Promise<Object>}
   */
  async getGuardians() {
    return handleApiResponse(apiClient.getGuardians(), "Fetch guardians");
  },

  /**
   * Get guardian by ID
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getGuardianById(id) {
    return handleApiResponse(
      apiClient.request(`/users/guardians/${id}`),
      "Fetch guardian",
    );
  },

  /**
   * Create new guardian
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createGuardian(data) {
    return handleApiResponse(apiClient.createGuardian(data), "Create guardian");
  },

  /**
   * Update guardian
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateGuardian(id, data, options = {}) {
    return handleApiResponse(
      apiClient.updateGuardian(id, data, options),
      "Update guardian",
    );
  },

  /**
   * Delete guardian
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async deleteGuardian(id, options = {}) {
    return handleApiResponse(
      apiClient.deleteGuardian(id, options),
      "Delete guardian",
    );
  },

  /**
   * Reset guardian password
   * @param {string|number} id
   * @param {string} newPassword
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async resetGuardianPassword(id, newPassword, options = {}) {
    return handleApiResponse(
      apiClient.resetGuardianPassword(id, newPassword, options),
      "Reset guardian password",
    );
  },

  /**
   * Get guardian password status
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getGuardianPasswordStatus(id) {
    return handleApiResponse(
      apiClient.getGuardianPasswordStatus(id),
      "Fetch guardian password status",
    );
  },

  // ==================== SYSTEM USERS ====================

  /**
   * Get all system users
   * @returns {Promise<Object>}
   */
  async getSystemUsers() {
    return handleApiResponse(apiClient.getSystemUsers(), "Fetch system users");
  },

  /**
   * Create system user
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createSystemUser(data) {
    return handleApiResponse(
      apiClient.createSystemUser(data),
      "Create system user",
    );
  },

  /**
   * Update system user
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateSystemUser(id, data) {
    return handleApiResponse(
      apiClient.updateSystemUser(id, data),
      "Update system user",
    );
  },

  /**
   * Delete system user
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async deleteSystemUser(id) {
    return handleApiResponse(
      apiClient.deleteSystemUser(id),
      "Delete system user",
    );
  },

  /**
   * Reset system user password
   * @param {string|number} id
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async resetSystemUserPassword(id, newPassword) {
    return handleApiResponse(
      apiClient.resetSystemUserPassword(id, newPassword),
      "Reset system user password",
    );
  },

  /**
   * Get system user password status
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getSystemUserPasswordStatus(id) {
    return handleApiResponse(
      apiClient.getSystemUserPasswordStatus(id),
      "Fetch system user password status",
    );
  },

  // ==================== ADMIN USERS ====================

  /**
   * Get all admin users
   * @returns {Promise<Object>}
   */
  async getAdminUsers() {
    return handleApiResponse(apiClient.getAdminUsers(), "Fetch admin users");
  },

  /**
   * Get admin user by ID
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getAdminUserById(id) {
    return handleApiResponse(apiClient.getAdminUser(id), "Fetch admin user");
  },

  /**
   * Update admin user
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateAdminUser(id, data) {
    return handleApiResponse(
      apiClient.updateAdminUser(id, data),
      "Update admin user",
    );
  },

  /**
   * Reset admin password
   * @param {string|number} id
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async resetAdminPassword(id, newPassword) {
    return handleApiResponse(
      apiClient.resetAdminPassword(id, newPassword),
      "Reset admin password",
    );
  },

  /**
   * Get current admin profile
   * @returns {Promise<Object>}
   */
  async getCurrentAdminProfile() {
    return handleApiResponse(
      apiClient.getCurrentAdminProfile(),
      "Fetch admin profile",
    );
  },

  /**
   * Update current admin profile
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateCurrentAdminProfile(data) {
    return handleApiResponse(
      apiClient.updateCurrentAdminProfile(data),
      "Update admin profile",
    );
  },

  // ==================== ROLES & CLINICS ====================

  /**
   * Get all roles
   * @returns {Promise<Object>}
   */
  async getRoles() {
    return handleApiResponse(apiClient.getRoles(), "Fetch roles");
  },

  /**
   * Get all clinics
   * @returns {Promise<Object>}
   */
  async getClinics() {
    return handleApiResponse(apiClient.getClinics(), "Fetch clinics");
  },

  // ==================== USER PROFILE ====================

  /**
   * Get user profile
   * @param {string|number} userId
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    return handleApiResponse(
      apiClient.getUserProfile(userId),
      "Fetch user profile",
    );
  },

  /**
   * Update user profile
   * @param {string|number} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateUserProfile(userId, data) {
    return handleApiResponse(
      apiClient.updateUserProfile(userId, data),
      "Update user profile",
    );
  },

  /**
   * Change password
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async changePassword(currentPassword, newPassword) {
    return handleApiResponse(
      apiClient.changePassword(currentPassword, newPassword),
      "Change password",
    );
  },
};

export default userService;
