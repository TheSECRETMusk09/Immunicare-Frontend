/**
 * Notification Utility Functions
 * Centralized utilities for notification handling
 */

/**
 * Infer notification type from notification object
 * @param {Object} notification - Notification object
 * @returns {string} Notification type
 */
export function inferNotificationType(notification = {}) {
  const rawType = String(notification.notification_type || notification.type || '').toLowerCase();

  if (rawType.includes('appointment')) return 'appointment';
  if (rawType.includes('vaccination') || rawType.includes('vaccine')) return 'vaccination';
  if (rawType.includes('message')) return 'message';
  if (rawType.includes('alert') || rawType.includes('error') || rawType.includes('warning')) return 'alert';
  return 'info';
}
