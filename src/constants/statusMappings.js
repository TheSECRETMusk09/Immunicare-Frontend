/**
 * Status Mappings and Utilities
 * Centralized status metadata for appointments and transfers
 */

/**
 * Appointment status metadata
 */
export const APPOINTMENT_STATUS_META = {
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  rescheduled: {
    label: 'Rescheduled',
    className: 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  attended: {
    label: 'Attended',
    className: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  },
  no_show: {
    label: 'No Show',
    className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  },
};

/**
 * Transfer status metadata
 */
export const TRANSFER_STATUS_META = {
  approved: {
    label: 'Transfer Approved',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  for_validation: {
    label: 'Transfer Review',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  needs_clarification: {
    label: 'Needs Clarification',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  },
  rejected: {
    label: 'Transfer Rejected',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
};

/**
 * Get appointment status metadata
 * @param {string} status - Appointment status
 * @returns {Object} Status metadata
 */
export function getAppointmentStatusMeta(status) {
  return APPOINTMENT_STATUS_META[String(status || '').toLowerCase()] || APPOINTMENT_STATUS_META.scheduled;
}

/**
 * Get status pill CSS class for appointments
 * @param {string} status - Appointment status
 * @returns {string} CSS class string
 */
export function getStatusPillClass(status) {
  switch (status) {
    case 'scheduled':
    case 'confirmed':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'completed':
    case 'attended':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
}

/**
 * Get transfer status metadata
 * @param {string} status - Transfer status
 * @returns {Object} Status metadata
 */
export function getTransferStatusMeta(status) {
  return TRANSFER_STATUS_META[String(status || '').toLowerCase()] || null;
}
