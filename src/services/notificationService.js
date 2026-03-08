/**
 * Notification Service
 * Handles all notification-related API operations
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

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
};

export default notificationService;
