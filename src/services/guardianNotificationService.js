/**
 * Guardian Notification Service
 * Handles all guardian-specific notification API operations
 * Ensures guardians only receive their relevant notifications
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const guardianNotificationService = {
  /**
   * Get all notifications for the authenticated guardian
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getNotifications(options = {}) {
    const { limit = 50, offset = 0, unreadOnly = false, type, search } = options;
    return handleApiResponse(
      apiClient.getGuardianNotifications({ limit, offset, unreadOnly, type, search }),
      "Fetch guardian notifications",
    );
  },

  /**
   * Get unread notification count
   * @returns {Promise<Object>}
   */
  async getUnreadCount() {
    return handleApiResponse(
      apiClient.getGuardianUnreadNotificationCount(),
      "Fetch guardian unread notification count",
    );
  },

  /**
   * Get notification statistics summary
   * @returns {Promise<Object>}
   */
  async getStats() {
    return handleApiResponse(
      apiClient.getGuardianNotificationStats(),
      "Fetch guardian notification statistics",
    );
  },

  /**
   * Mark a notification as read
   * @param {string|number} id - Notification ID
   * @returns {Promise<Object>}
   */
  async markAsRead(id) {
    return handleApiResponse(
      apiClient.markGuardianNotificationAsRead(id),
      `Mark guardian notification ${id} as read`,
    );
  },

  /**
   * Mark a notification as unread
   * @param {string|number} id - Notification ID
   * @returns {Promise<Object>}
   */
  async markAsUnread(id) {
    return handleApiResponse(
      apiClient.markGuardianNotificationAsUnread(id),
      `Mark guardian notification ${id} as unread`,
    );
  },

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>}
   */
  async markAllAsRead() {
    return handleApiResponse(
      apiClient.markAllGuardianNotificationsAsRead(),
      "Mark all guardian notifications as read",
    );
  },

  /**
   * Delete a notification
   * @param {string|number} id - Notification ID
   * @returns {Promise<Object>}
   */
  async deleteNotification(id) {
    return handleApiResponse(
      apiClient.deleteGuardianNotification(id),
      `Delete guardian notification ${id}`,
    );
  },
};

export default guardianNotificationService;
