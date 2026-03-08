import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";

/**
 * HealthAlerts Component
 * Displays health alerts and reminders in alert format with icons
 * Following wireframe specifications with alert-critical, alert-warning, alert-info styles
 */
export default function HealthAlerts({
  infants = [],
  maxAlerts = 5,
  showViewAll = true,
  onViewAllClick,
  className = "",
}) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // setError is intentionally unused - reserved for future error handling improvements

  // Store the generateAlerts function in ref for retry functionality
  const generateAlertsRef = useRef(null);

  const generateAlerts = useCallback(() => {
    if (!infants || infants.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const newAlerts = [];

    infants.forEach((infant) => {
      // Vaccination due alerts
      if (infant.nextVaccination) {
        const dueDate = new Date(infant.nextVaccinationDueDate);
        const today = new Date();
        const daysUntilDue = Math.ceil(
          (dueDate - today) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilDue <= 0) {
          newAlerts.push({
            id: `vaccine-overdue-${infant.id}`,
            type: "critical",
            icon: "⚠️",
            title: "Vaccination Overdue",
            message: `${infant.first_name} ${infant.last_name} is overdue for ${infant.nextVaccination} vaccination`,
            childId: infant.id,
            childName: `${infant.first_name} ${infant.last_name}`,
            action: "Schedule Now",
            actionUrl: `/appointments/new?childId=${infant.id}`,
            daysAgo: Math.abs(daysUntilDue),
            category: "vaccination",
          });
        } else if (daysUntilDue <= 7) {
          newAlerts.push({
            id: `vaccine-due-soon-${infant.id}`,
            type: "warning",
            icon: "⚠️",
            title: "Vaccination Due Soon",
            message: `${infant.first_name} ${infant.last_name} is due for ${infant.nextVaccination} in ${daysUntilDue} days`,
            childId: infant.id,
            childName: `${infant.first_name} ${infant.last_name}`,
            action: "Schedule Now",
            actionUrl: `/appointments/new?childId=${infant.id}`,
            daysUntilDue,
            category: "vaccination",
          });
        } else if (daysUntilDue <= 30) {
          newAlerts.push({
            id: `vaccine-due-${infant.id}`,
            type: "info",
            icon: "💉",
            title: "Upcoming Vaccination",
            message: `${infant.first_name} ${infant.last_name} has ${infant.nextVaccination} scheduled`,
            childId: infant.id,
            childName: `${infant.first_name} ${infant.last_name}`,
            action: "View Details",
            actionUrl: `/vaccination-records/${infant.id}`,
            daysUntilDue,
            category: "vaccination",
          });
        }
      }

      // Growth tracking alerts
      if (infant.growthTrackingNeeded) {
        newAlerts.push({
          id: `growth-update-${infant.id}`,
          type: "warning",
          icon: "📊",
          title: "Growth Tracking Update Needed",
          message: `Growth tracking data for ${infant.first_name} ${infant.last_name} needs to be updated`,
          childId: infant.id,
          childName: `${infant.first_name} ${infant.last_name}`,
          action: "Update Now",
          actionUrl: `/health-information?childId=${infant.id}`,
          category: "growth",
        });
      }

      // Health certificate expiry alerts
      if (infant.healthCertificateExpiry) {
        const expiryDate = new Date(infant.healthCertificateExpiry);
        const today = new Date();
        const daysUntilExpiry = Math.ceil(
          (expiryDate - today) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          newAlerts.push({
            id: `cert-expiring-${infant.id}`,
            type: "warning",
            icon: "📋",
            title: "Health Certificate Expiring",
            message: `Annual health certificate for ${infant.first_name} ${infant.last_name} expires in ${daysUntilExpiry} days`,
            childId: infant.id,
            childName: `${infant.first_name} ${infant.last_name}`,
            action: "Renew",
            actionUrl: `/documents/health-certificates?childId=${infant.id}`,
            daysUntilExpiry,
            category: "certificate",
          });
        } else if (daysUntilExpiry <= 0) {
          newAlerts.push({
            id: `cert-expired-${infant.id}`,
            type: "critical",
            icon: "📋",
            title: "Health Certificate Expired",
            message: `Annual health certificate for ${infant.first_name} ${infant.last_name} has expired`,
            childId: infant.id,
            childName: `${infant.first_name} ${infant.last_name}`,
            action: "Renew Immediately",
            actionUrl: `/documents/health-certificates?childId=${infant.id}`,
            daysAgo: Math.abs(daysUntilExpiry),
            category: "certificate",
          });
        }
      }

      // Appointment reminders
      if (infant.upcomingAppointments && infant.upcomingAppointments > 0) {
        newAlerts.push({
          id: `appointment-reminder-${infant.id}`,
          type: "info",
          icon: "📅",
          title: "Upcoming Appointment",
          message: `${infant.first_name} ${infant.last_name} has ${infant.upcomingAppointments} upcoming appointment(s)`,
          childId: infant.id,
          childName: `${infant.first_name} ${infant.last_name}`,
          action: "View Appointments",
          actionUrl: `/appointments?childId=${infant.id}`,
          count: infant.upcomingAppointments,
          category: "appointment",
        });
      }
    });

    // Sort alerts by priority: critical > warning > info
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    newAlerts.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

    setAlerts(newAlerts.slice(0, maxAlerts));
    setLoading(false);
  }, [infants, maxAlerts]);

  // Store the generateAlerts function in ref for retry
  generateAlertsRef.current = generateAlerts;

  useEffect(() => {
    generateAlerts();
  }, [generateAlerts]);

  const getAlertStyles = (type) => {
    switch (type) {
      case "critical":
        return {
          container:
            "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
          icon: "text-red-500",
          title: "text-red-800 dark:text-red-200",
          message: "text-red-700 dark:text-red-300",
          action:
            "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300",
          badge: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
        };
      case "warning":
        return {
          container:
            "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
          icon: "text-amber-500",
          title: "text-amber-800 dark:text-amber-200",
          message: "text-amber-700 dark:text-amber-300",
          action:
            "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300",
          badge:
            "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
        };
      case "info":
      default:
        return {
          container:
            "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
          icon: "text-blue-500",
          title: "text-blue-800 dark:text-blue-200",
          message: "text-blue-700 dark:text-blue-300",
          action:
            "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300",
          badge:
            "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
        };
    }
  };

  const handleActionClick = (alert) => {
    if (alert.actionUrl) {
      window.location.href = alert.actionUrl;
    } else if (onViewAllClick) {
      onViewAllClick(alert);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Health Alerts & Reminders
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse flex items-start gap-3 p-3 rounded-lg"
            >
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Health Alerts & Reminders
        </h3>
        <div className="text-center py-4">
          <p className="text-red-600 dark:text-red-400">Error loading alerts</p>
          <button
            onClick={() =>
              generateAlertsRef.current && generateAlertsRef.current()
            }
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Health Alerts & Reminders
        </h3>
        {alerts.length > 0 && (
          <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-medium rounded-full">
            {alerts.length} new
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-gray-600 dark:text-gray-400">
            No health alerts at this time
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            All vaccinations and health checks are up to date
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const styles = getAlertStyles(alert.type);
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${styles.container}`}
              >
                <span className={`text-xl flex-shrink-0 mt-0.5 ${styles.icon}`}>
                  {alert.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium text-sm ${styles.title}`}>
                      {alert.title}
                    </h4>
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded ${styles.badge}`}
                    >
                      {alert.childName}
                    </span>
                  </div>
                  <p className={`text-sm ${styles.message}`}>{alert.message}</p>
                  <button
                    onClick={() => handleActionClick(alert)}
                    className={`mt-2 text-xs font-medium hover:underline ${styles.action}`}
                  >
                    {alert.action} →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showViewAll && alerts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onViewAllClick}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            View All Alerts →
          </button>
        </div>
      )}
    </div>
  );
}

HealthAlerts.propTypes = {
  infants: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      first_name: PropTypes.string.isRequired,
      last_name: PropTypes.string.isRequired,
      nextVaccination: PropTypes.string,
      nextVaccinationDueDate: PropTypes.string,
      growthTrackingNeeded: PropTypes.bool,
      healthCertificateExpiry: PropTypes.string,
      upcomingAppointments: PropTypes.number,
    }),
  ),
  maxAlerts: PropTypes.number,
  showViewAll: PropTypes.bool,
  onViewAllClick: PropTypes.func,
  className: PropTypes.string,
};

// Export alert types for external use
export const AlertTypes = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
};
