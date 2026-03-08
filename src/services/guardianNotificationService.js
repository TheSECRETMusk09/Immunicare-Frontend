/**
 * Guardian Notification Service
 * Handles all guardian-specific notification API operations
 * Ensures guardians only receive their relevant notifications
 */

import apiClient from "../utils/api";

const guardianNotificationService = {
  /**
   * Get all notifications for the authenticated guardian
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getNotifications(options = {}) {
    const { limit = 50, offset = 0, unreadOnly = false, type, search } = options;
    const params = new URLSearchParams();

    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);
    if (unreadOnly) params.append("unreadOnly", "true");
    if (type) params.append("type", type);
    if (search) params.append("search", search);

    const queryString = params.toString();
    const url = `/guardian/notifications${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.customRequest(url, {
      method: "GET",
    });

    return response.data;
  },

  /**
   * Get unread notification count
   * @returns {Promise<Object>}
   */
  async getUnreadCount() {
    const response = await apiClient.customRequest(
      "/guardian/notifications/unread-count",
      {
        method: "GET",
      },
    );

    return response.data;
  },

  /**
   * Get notification statistics summary
   * @returns {Promise<Object>}
   */
  async getStats() {
    const response = await apiClient.customRequest(
      "/guardian/notifications/stats/summary",
      {
        method: "GET",
      },
    );

    return response.data;
  },

  /**
   * Mark a notification as read
   * @param {string|number} id - Notification ID
   * @returns {Promise<Object>}
   */
  async markAsRead(id) {
    const response = await apiClient.customRequest(
      `/guardian/notifications/${id}/read`,
      {
        method: "PATCH",
      },
    );

    return response.data;
  },

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>}
   */
  async markAllAsRead() {
    const response = await apiClient.customRequest(
      "/guardian/notifications/read-all",
      {
        method: "PATCH",
      },
    );

    return response.data;
  },

  /**
   * Delete a notification
   * @param {string|number} id - Notification ID
   * @returns {Promise<Object>}
   */
  async deleteNotification(id) {
    const response = await apiClient.customRequest(
      `/guardian/notifications/${id}`,
      {
        method: "DELETE",
      },
    );

    return response.data;
  },
};

export default guardianNotificationService;
