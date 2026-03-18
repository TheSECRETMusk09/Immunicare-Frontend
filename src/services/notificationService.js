/**
 * Notification Service
 * Handles all notification-related API operations
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";
import { renderNotification } from "../utils/notificationTemplates";

const notificationService = {
  /**
   * Get all notifications
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  async getAll(filters = {}) {
    return handleApiResponse(
      apiClient.getNotifications(filters),
      "Fetch notifications",
    );
  },

  /**
   * Get notification by ID
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    return handleApiResponse(
      apiClient.getNotification(id),
      "Fetch notification",
    );
  },

  /**
   * Mark notification as read
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async markAsRead(id) {
    return handleApiResponse(
      apiClient.markNotificationAsRead(id),
      "Mark notification as read",
    );
  },

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>}
   */
  async markAllAsRead() {
    return handleApiResponse(
      apiClient.markAllNotificationsAsRead(),
      "Mark all notifications as read",
    );
  },

  /**
   * Get notification settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    return handleApiResponse(
      apiClient.getNotificationSettings(),
      "Fetch notification settings",
    );
  },

  /**
   * Update notification settings
   * @param {Object} settings
   * @returns {Promise<Object>}
   */
  async updateSettings(settings) {
    return handleApiResponse(
      apiClient.updateNotificationSettings(settings),
      "Update notification settings",
    );
  },

  /**
   * Get notification statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return handleApiResponse(
      apiClient.getNotificationStats(),
      "Fetch notification stats",
    );
  },

  /**
   * Get unread notification count
   * @returns {Promise<Object>}
   */
  async getUnreadCount() {
    return handleApiResponse(
      apiClient.getUnreadNotificationCount(),
      "Fetch unread notification count",
    );
  },

  /**
   * Send a transfer-in submitted notification
   * @param {Object} data - Data for template substitution
   * @returns {Promise<Object>}
   */
  async sendTransferInSubmittedNotification(data) {
    const notification = renderNotification('transfer_in_submitted', data);
    return handleApiResponse(
      apiClient.createNotification(notification),
      "Send transfer-in submitted notification",
    );
  },

  /**
   * Send a next vaccine computed notification
   * @param {Object} data - Data for template substitution
   * @returns {Promise<Object>}
   */
  async sendNextVaccineComputedNotification(data) {
    const notification = renderNotification('next_vaccine_computed', data);
    return handleApiResponse(
      apiClient.createNotification(notification),
      "Send next vaccine computed notification",
    );
  },

  /**
   * Send an appointment suggested notification
   * @param {Object} data - Data for template substitution
   * @returns {Promise<Object>}
   */
  async sendAppointmentSuggestedNotification(data) {
    const notification = renderNotification('appointment_suggested', data);
    return handleApiResponse(
      apiClient.createNotification(notification),
      "Send appointment suggested notification",
    );
  },

  /**
   * Send a vaccine overdue warning notification
   * @param {Object} data - Data for template substitution
   * @returns {Promise<Object>}
   */
  async sendVaccineOverdueNotification(data) {
    const notification = renderNotification('vaccine_overdue', data);
    return handleApiResponse(
      apiClient.createNotification(notification),
      "Send vaccine overdue warning notification",
    );
  },

  /**
   * Send a missed appointment notification
   * @param {Object} data - Data for template substitution
   * @returns {Promise<Object>}
   */
  async sendMissedAppointmentNotification(data) {
    const notification = renderNotification('missed_appointment', data);
    return handleApiResponse(
      apiClient.createNotification(notification),
      "Send missed appointment notification",
    );
  },

  /**
   * Send a stock unavailable notification
   * @param {Object} data - Data for template substitution
   * @returns {Promise<Object>}
   */
  async sendStockUnavailableNotification(data) {
    const notification = renderNotification('stock_unavailable', data);
    return handleApiResponse(
      apiClient.createNotification(notification),
      "Send stock unavailable notification",
    );
  },
};

export default notificationService;
