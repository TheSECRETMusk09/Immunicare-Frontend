import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Activity,
  Plus,
  FileText,
  AlertCircle,
  RefreshCw,
  Bell,
  User,
  ChevronRight,
  Clock,
  Syringe,
  TrendingUp,
  Baby,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  Info,
  X,
  ArrowRightCircle,
} from 'lucide-react';
import GuardianTopHeader from '../components/GuardianTopHeader';
import GuardianModuleHeader from '../components/GuardianModuleHeader';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/api';
import { triggerGuardianAddChildModal } from '../components/QuickActionFAB';
import guardianNotificationService from '../services/guardianNotificationService';
import { trackEvent } from '../utils/telemetry';
import ErrorBoundary from '../components/ErrorBoundary';

const unwrapApiPayload = (value) => {
  if (value && typeof value === 'object' && 'data' in value) {
    return value.data;
  }
  return value;
};

const normalizeArrayPayload = (value, candidateKeys = []) => {
  const payload = unwrapApiPayload(value);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const keys = ['data', ...candidateKeys];
    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }

  return [];
};

const inferNotificationType = (notification = {}) => {
  const rawType = String(notification.notification_type || notification.type || '').toLowerCase();

  if (rawType.includes('appointment')) return 'appointment';
  if (rawType.includes('vaccination') || rawType.includes('vaccine')) return 'vaccination';
  if (rawType.includes('message')) return 'message';
  if (rawType.includes('alert') || rawType.includes('error') || rawType.includes('warning')) return 'alert';
  return 'info';
};

const buildDueVaccineIdentity = (child, vaccine, dueDate) => {
  const vaccineId =
    vaccine?.schedule?.vaccineId ||
    vaccine?.vaccine?.id ||
    vaccine?.id ||
    vaccine?.vaccineId ||
    vaccine?.name ||
    'vaccine';
  const doseNumber =
    vaccine?.schedule?.doseNumber ||
    vaccine?.dose?.number ||
    vaccine?.doseNumber ||
    vaccine?.dose_no ||
    vaccine?.dose_number ||
    'dose';
  const dueDateKey =
    dueDate ||
    vaccine?.schedule?.dueDate ||
    vaccine?.dueDate ||
    vaccine?.scheduledDate ||
    'no-date';

  return `${child?.id || 'child'}-${vaccineId}-${doseNumber}-${dueDateKey}`;
};

const TRANSFER_STATUS_META = {
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

const APPOINTMENT_STATUS_META = {
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
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  },
  no_show: {
    label: 'No Show',
    className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  },
};

const getAppointmentStatusMeta = (status) =>
  APPOINTMENT_STATUS_META[String(status || '').toLowerCase()] || APPOINTMENT_STATUS_META.scheduled;

// ============================================
// SKELETON LOADING COMPONENTS
// ============================================

const StatCardSkeleton = () => (
  <div className="bg-theme-bg-secondary rounded-2xl p-5 animate-pulse min-h-[120px]">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <div className="h-3 bg-theme-bg-tertiary rounded w-20"></div>
        <div className="h-8 bg-theme-bg-tertiary rounded w-12"></div>
      </div>
      <div className="w-10 h-10 bg-theme-bg-tertiary rounded-xl"></div>
    </div>
  </div>
);

const ChildCardSkeleton = () => (
  <div className="bg-theme-bg-secondary rounded-2xl p-6 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-theme-bg-tertiary rounded-full"></div>
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-theme-bg-tertiary rounded w-32"></div>
        <div className="h-3 bg-theme-bg-tertiary rounded w-24"></div>
      </div>
    </div>
  </div>
);

const AppointmentCardSkeleton = () => (
  <div className="bg-theme-bg-secondary rounded-2xl p-5 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-theme-bg-tertiary rounded-xl"></div>
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-theme-bg-tertiary rounded w-40"></div>
        <div className="h-3 bg-theme-bg-tertiary rounded w-24"></div>
      </div>
    </div>
  </div>
);

const NotificationSkeleton = () => (
  <div className="bg-theme-bg-secondary rounded-xl p-4 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-theme-bg-tertiary rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-theme-bg-tertiary rounded w-3/4"></div>
        <div className="h-2 bg-theme-bg-tertiary rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

// ============================================
// ENHANCED STAT CARD COMPONENT
// ============================================

const StatCard = ({ label, value, subLabel, icon: Icon, variant = 'emerald', onClick }) => (
  <div
    className={`guardian-stat-card guardian-stat-card--${variant} rounded-2xl p-5 sm:p-6 relative overflow-hidden min-h-[108px] sm:min-h-[126px] transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
    onClick={onClick}
  >
    {/* Background decoration */}
    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-10 h-10 sm:w-12 sm:h-12 guardian-stat-card__icon-wrap rounded-xl flex items-center justify-center opacity-80">
      <Icon className="w-5 h-5 sm:w-6 sm:h-6 guardian-stat-card__icon" />
    </div>
    <div className="relative z-10">
      <p className="text-[10px] sm:text-xs font-bold guardian-stat-card__label uppercase tracking-wider mb-1.5 sm:mb-2.5 opacity-90">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold guardian-stat-card__value leading-tight mb-1 sm:mb-1.5">{value}</p>
      {subLabel && (
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 guardian-stat-card__trend-icon opacity-70" />
          <span className="text-[10px] sm:text-xs guardian-stat-card__trend-text opacity-80 font-medium">{subLabel}</span>
        </div>
      )}
    </div>
  </div>
);

// ============================================
// PROGRESS CARD COMPONENT
// ============================================

const ProgressCard = ({ title, completed, pending, total, icon: Icon, color = 'emerald' }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={`guardian-progress-card guardian-progress-card--${color} rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="guardian-progress-card__icon-wrap rounded-lg p-1.5">
            <Icon className="w-4 h-4 guardian-progress-card__icon" />
          </div>
          <span className="text-sm font-bold guardian-progress-card__title">{title}</span>
        </div>
        <span className="text-lg font-bold guardian-progress-card__percentage">{percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 guardian-progress-card__track rounded-full overflow-hidden mb-2">
        <div
          className="h-full guardian-progress-card__fill rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="guardian-progress-card__meta opacity-80">{completed} completed</span>
        <span className="guardian-progress-card__meta opacity-80">{pending} pending</span>
      </div>
    </div>
  );
};

// ============================================
// DUE VACCINE ALERT CARD
// ============================================

const DueVaccineCard = ({ vaccine, infantName, dueDate, daysUntilDue, status, onBook }) => {
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;

  return (
    <div className={`rounded-xl p-3 border ${
      isOverdue
        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        : isDueSoon
          ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
          : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOverdue ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : isDueSoon ? (
            <Clock className="w-4 h-4 text-amber-500" />
          ) : (
            <Calendar className="w-4 h-4 text-blue-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-theme-primary">{vaccine}</p>
            <p className="text-xs text-theme-secondary">{infantName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xs font-bold ${
            isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-blue-600'
          }`}>
            {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` :
             isDueSoon ? `Due in ${daysUntilDue} days` :
             `${daysUntilDue} days`}
          </p>
          <p className="text-xs text-gray-400">{new Date(dueDate).toLocaleDateString()}</p>
        </div>
      </div>
      {onBook && (
        <button
          onClick={onBook}
          className={`mt-2 w-full py-1.5 text-xs font-bold rounded-lg transition-colors ${
            isOverdue
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isOverdue ? 'Book Now' : 'Schedule'}
        </button>
      )}
    </div>
  );
};

// ============================================
// NOTIFICATION ITEM COMPONENT
// ============================================

const NotificationItem = ({ notification, onDismiss }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'appointment':
        return Calendar;
      case 'vaccination':
        return Syringe;
      case 'alert':
        return AlertTriangle;
      case 'message':
        return MessageSquare;
      default:
        return Info;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'appointment':
        return 'text-blue-500 bg-blue-100';
      case 'vaccination':
        return 'text-purple-500 bg-purple-100';
      case 'alert':
        return 'text-red-500 bg-red-100';
      case 'message':
        return 'text-emerald-500 bg-emerald-100';
      default:
        return 'text-gray-500 bg-gray-100';
    }
  };

  const Icon = getIcon(notification.type || 'info');
  const colorClass = getColor(notification.type || 'info');

  return (
    <div className="guardian-dashboard-notification-item flex items-start gap-3 p-3 rounded-xl bg-theme-bg-card border border-theme-border-primary hover:shadow-sm transition-shadow">
      <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="guardian-dashboard-notification-content flex-1 min-w-0">
        <p className="text-sm font-medium text-theme-primary leading-snug break-words">
          {notification.title || notification.message?.substring(0, 50)}
        </p>
        <p className="text-xs text-theme-secondary mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {notification.created_at ? new Date(notification.created_at).toLocaleDateString() : 'Just now'}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className="guardian-dashboard-notification-dismiss text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ============================================
// EMPTY STATE COMPONENT
// ============================================

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction, variant = 'default' }) => (
  <div className="bg-theme-bg-card rounded-2xl p-6 sm:p-8 border border-theme-border-primary text-center shadow-sm">
    {Icon && (
      <div className="w-16 h-16 bg-theme-bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-theme-tertiary" />
      </div>
    )}
    <h3 className="text-base font-bold text-theme-primary mb-2">{title}</h3>
    <p className="text-sm text-theme-secondary mb-4 max-w-xs mx-auto">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md bg-emerald-500 hover:bg-emerald-600"
      >
        <Plus className="w-4 h-4" />
        {actionLabel}
      </button>
    )}
  </div>
);

// ============================================
// ERROR STATE COMPONENT
// ============================================

const ErrorState = ({ message, onRetry }) => (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-8 text-center">
    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
      <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
    </div>
    <p className="text-sm text-red-600 dark:text-red-400 mb-4 font-medium">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    )}
  </div>
);

// ============================================
// MAIN GUARDIAN DASHBOARD COMPONENT
// ============================================

const GuardianDashboard = () => {
  const navigate = useNavigate();
  const { guardianId } = useAuth();
  const dashboardRef = React.useRef(null);

  // State for data, loading, and errors
  const [stats, setStats] = useState({
    childrenCount: 0,
    nextAppointment: 'None',
    vaccinatedCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    upcomingVaccines: 0,
  });
  const [children, setChildren] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dueVaccines, setDueVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data from API
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [
        childrenResponse,
        appointmentsResponse,
        notificationsResponse,
        statsResponse,
      ] = await Promise.allSettled([
        // Backward-compatible fallback for test mocks or older API clients.
        // Use empty notifications fallback instead of generic notifications
        // endpoint to preserve guardian-only contract boundaries.
        guardianId ? apiClient.getInfantsByGuardian(guardianId) : Promise.resolve({ data: [] }),
        guardianId ? apiClient.getGuardianAppointments(guardianId, { status: 'upcoming', limit: 5 }) : Promise.resolve({ data: [] }),
        !guardianId
          ? Promise.resolve({ data: [] })
          : typeof apiClient.getGuardianNotifications === 'function'
            ? apiClient.getGuardianNotifications({ limit: 10 })
            : Promise.resolve({ data: [] }),
        guardianId ? apiClient.getGuardianStats(guardianId) : Promise.resolve({ data: {} }),
      ]);

      // Process children data
      let childrenData = [];
      if (childrenResponse.status === 'fulfilled') {
        childrenData = normalizeArrayPayload(childrenResponse.value, ['infants', 'children']).map((child) => ({
          ...child,
          name: child.name || `${child.first_name || ''} ${child.last_name || ''}`.trim(),
          dateOfBirth: child.dateOfBirth || child.dob || child.birth_date || null,
          controlNumber: child.controlNumber || child.control_number || null,
        }));
      }
      setChildren(childrenData);

      const vaccinationScheduleResponses = await Promise.allSettled(
        childrenData.map((child) => apiClient.getInfantVaccinationSchedule(child.id)),
      );

      const vaccinationScheduleMap = new Map();
      vaccinationScheduleResponses.forEach((response, index) => {
        const childId = childrenData[index]?.id;
        if (!childId) {
          return;
        }

        if (response.status === 'fulfilled') {
          const normalizedSchedule =
            normalizeArrayPayload(response.value, ['schedule']) ||
            response.value?.schedule ||
            [];
          vaccinationScheduleMap.set(childId, normalizedSchedule);
          return;
        }

        vaccinationScheduleMap.set(childId, []);
      });

      // Process appointments data
      let appointmentsData = [];
      if (appointmentsResponse.status === 'fulfilled') {
        appointmentsData = normalizeArrayPayload(appointmentsResponse.value, ['appointments']).map((appointment) => ({
          ...appointment,
          scheduledDate:
            appointment.scheduledDate ||
            appointment.scheduled_date ||
            appointment.date ||
            null,
          infantName:
            appointment.infantName ||
            `${appointment.first_name || ''} ${appointment.last_name || ''}`.trim(),
          vaccineName:
            appointment.vaccineName ||
            appointment.vaccine_name ||
            appointment.type ||
            'Vaccination',
          doctorName:
            appointment.doctorName ||
            appointment.provider_name ||
            appointment.health_worker_name ||
            null,
        }));
      }
      setAppointments(appointmentsData);

      // Process notifications data
      let notificationsData = [];
      if (notificationsResponse.status === 'fulfilled') {
        notificationsData = normalizeArrayPayload(notificationsResponse.value, ['notifications']).map((notification) => ({
          ...notification,
          type: inferNotificationType(notification),
          title: notification.title || 'Notification',
        }));
      }
      setNotifications(notificationsData.slice(0, 5));

      // Process stats from API or calculate locally
      const apiStats = statsResponse.status === 'fulfilled' ? (unwrapApiPayload(statsResponse.value) || {}) : {};

      // Calculate stats locally if not available from API
      const today = new Date();

      const vaccinatedCount = childrenData.reduce((acc, child) => {
        return acc + Number(child.completed_vaccinations || 0);
      }, 0);

      const pendingCount = childrenData.reduce((acc, child) => {
        return acc + Number(child.pending_vaccinations || 0);
      }, 0);

      // Calculate due/overdue vaccinations
      const dueVaccinesList = [];
      const seenDueVaccines = new Set();
      childrenData.forEach(child => {
        const scheduleEntries = vaccinationScheduleMap.get(child.id);
        const candidateVaccines = Array.isArray(scheduleEntries) && scheduleEntries.length > 0
          ? scheduleEntries
          : child.vaccinations || [];

        const childDueVaccines = candidateVaccines.filter(v => {
          if (v.status === 'completed') return false;
          const dueDate =
            v.schedule?.dueDate ||
            v.dueDate ||
            v.scheduledDate;
          if (!dueDate) return false;
          const due = new Date(dueDate);
          const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
          return daysUntil <= 30; // Due within 30 days
        });

        childDueVaccines.forEach(vaccine => {
          const dueDate =
            vaccine.schedule?.dueDate ||
            vaccine.dueDate ||
            vaccine.scheduledDate;
          const daysUntil = Math.ceil((new Date(dueDate) - today) / (1000 * 60 * 60 * 24));
          const dueVaccineId = buildDueVaccineIdentity(child, vaccine, dueDate);

          if (seenDueVaccines.has(dueVaccineId)) {
            return;
          }

          seenDueVaccines.add(dueVaccineId);
          dueVaccinesList.push({
            id: dueVaccineId,
            childId: child.id,
            childName: child.name || `${child.first_name} ${child.last_name}`.trim(),
            vaccineName:
              vaccine.vaccine?.name ||
              vaccine.name ||
              vaccine.vaccineName,
            dueDate: dueDate,
            daysUntilDue: daysUntil,
            status:
              vaccine.status ||
              (daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming'),
          });
        });
      });

      // Sort by urgency
      dueVaccinesList.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      setDueVaccines(dueVaccinesList.slice(0, 5));

      const nextAppointmentDateSource =
        apiStats?.nextAppointment?.scheduled_date ||
        apiStats?.nextAppointment?.scheduledDate ||
        appointmentsData?.[0]?.scheduledDate ||
        appointmentsData?.[0]?.scheduled_date ||
        appointmentsData?.[0]?.date;

      const nextAppointmentDate = nextAppointmentDateSource
        ? new Date(nextAppointmentDateSource).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        : 'None';

       setStats({
         childrenCount: apiStats.childrenCount || childrenData.length,
         nextAppointment: nextAppointmentDate,
         vaccinatedCount: apiStats.completedVaccinations || vaccinatedCount,
         pendingCount: apiStats.pendingVaccinations || pendingCount,
         overdueCount: dueVaccinesList.filter(v => v.status === 'overdue').length,
         upcomingVaccines: dueVaccinesList.filter(v => v.status === 'due_soon').length,
       });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh dashboard data every 60 seconds
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchDashboardData();
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboardData]);

  // Accessibility: Focus main content when loaded
  useEffect(() => {
    if (!loading && !error && dashboardRef.current) {
      // Give the DOM a tiny bit of time to render before focusing
      setTimeout(() => dashboardRef.current?.focus(), 100);
    }
  }, [loading, error]);

  // Telemetry: track dashboard view and general stats
  useEffect(() => {
    if (!loading && !error) {
      trackEvent("dashboard_first_view", { childrenCount: stats.childrenCount, overdueCount: stats.overdueCount });
    }
  }, [loading, error, stats.childrenCount, stats.overdueCount]);

  // Format date for appointment display
  const formatAppointmentDate = (dateString) => {
    const date = new Date(dateString);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      fullDate: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };
  };

  // Handle retry
  const handleRetry = () => {
    fetchDashboardData();
  };

  // Handle notification dismiss
  const handleDismissNotification = async (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    try {
      await guardianNotificationService.markAsRead(notificationId);
      trackEvent("notification_dismissed", { notificationId });
    } catch (err) {
      console.warn(`Failed to mark notification ${notificationId} as read:`, err);
      // Optionally, add the notification back to the list on failure or show a toast.
    }
  };

  // Calculate vaccination progress
  const vaccinationProgress = useMemo(() => {
    const total = stats.vaccinatedCount + stats.pendingCount;
    return {
      completed: stats.vaccinatedCount,
      pending: stats.pendingCount,
      total,
      percentage: total > 0 ? Math.round((stats.vaccinatedCount / total) * 100) : 0,
    };
  }, [stats.vaccinatedCount, stats.pendingCount]);

  // Phase 2: Derived Data Lag fix - Show skeleton if children exist but 0 total vaccines are mapped yet
  const isGeneratingSchedule = stats.childrenCount > 0 && vaccinationProgress.total === 0;

  return (
    <div className="guardian-page-wrapper min-h-screen bg-theme-bg-primary transition-colors duration-200">
      <div className="min-[1025px]:hidden fixed top-0 left-0 right-0 z-40 w-full bg-theme-bg-primary border-b border-theme-border-primary shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={handleRetry}
          isRefreshing={loading}
        />
      </div>

      <div className="pt-14 sm:pt-16 min-[1025px]:pt-0">
        <div ref={dashboardRef} tabIndex="-1" className="focus:outline-none">
        <GuardianModuleHeader
          title="Guardian Dashboard"
          subtitle="Welcome back! "
          icon={<Calendar className="w-8 h-8 text-white" />}
          actions={(
            <div className="hidden min-[1025px]:flex guardian-desktop-pageheader-actions">
              <button
                type="button"
                onClick={handleRetry}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Refresh Guardian Dashboard"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/guardian/notifications')}
                className="guardian-desktop-pageheader-icon-btn guardian-desktop-pageheader-icon-btn--notif"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="guardian-desktop-pageheader-notif-dot" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/guardian/profile')}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Open profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          )}
        />

        <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">
        <ErrorBoundary>

        {/* Error State */}
        {error && (
          <div className="pt-4">
            <ErrorState message={error} onRetry={handleRetry} />
          </div>
        )}

        {/* Overdue/Due Soon Vaccination Alert Banner */}
        {!loading && !error && (stats.overdueCount > 0 || stats.upcomingVaccines > 0) && (
          <div className="pt-4">
            <div
              className={`border-l-4 rounded-r-xl p-4 shadow-sm ${
                stats.overdueCount > 0
                  ? 'bg-red-50 dark:bg-red-900/30 border-red-500'
                  : 'bg-amber-50 dark:bg-amber-900/30 border-amber-500'
              }`}
              role="alert"
            >
              <div className="flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-start">
                {stats.overdueCount > 0 ? (
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                ) : (
                  <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-base font-bold ${
                    stats.overdueCount > 0
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-amber-800 dark:text-amber-300'
                  }`}>
                    {stats.overdueCount > 0
                      ? `${stats.overdueCount} Overdue Vaccination${stats.overdueCount > 1 ? 's' : ''}`
                      : `${stats.upcomingVaccines} Upcoming Vaccination${stats.upcomingVaccines > 1 ? 's' : ''}`
                    }
                  </h3>
                  <p className={`text-sm mt-1 ${
                    stats.overdueCount > 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {dueVaccines.slice(0, 3).map((v, i) => (
                      <span key={i}>
                        {i > 0 && ', '}{v.childName}: {v.vaccineName} ({v.daysUntilDue < 0 ? `${Math.abs(v.daysUntilDue)} days overdue` : `in ${v.daysUntilDue} days`})
                      </span>
                    ))}
                    {dueVaccines.length > 3 && (
                      <span> and {dueVaccines.length - 3} more</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/guardian/appointments/new')}
                  className={`w-full min-[768px]:w-auto flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition-colors shadow-sm ${
                    stats.overdueCount > 0
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid - 2x2 on mobile, 4 columns on desktop */}
        <div className="pt-4">
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 min-[1025px]:grid-cols-4 gap-4">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  label="MY CHILDREN"
                  value={stats.childrenCount}
                  icon={Users}
                  variant="emerald"
                  onClick={() => {
                    navigate('/guardian/children');
                    setTimeout(() => {
                      triggerGuardianAddChildModal();
                    }, 0);
                  }}
                />
                <StatCard
                  label="NEXT APPT"
                  value={stats.nextAppointment}
                  icon={Calendar}
                  variant="blue"
                  onClick={() => navigate('/guardian/appointments')}
                />
                <StatCard
                  label="VACCINATED"
                  value={stats.vaccinatedCount}
                  subLabel="Completed"
                  icon={Syringe}
                  variant="purple"
                  onClick={() => navigate('/guardian/vaccination-records')}
                />
                {stats.overdueCount > 0 ? (
                  <StatCard
                    label="OVERDUE"
                    value={stats.overdueCount}
                    icon={AlertCircle}
                    variant="red"
                    onClick={() => navigate('/guardian/appointments/new')}
                  />
                ) : (
                  <StatCard
                    label="PENDING"
                    value={stats.pendingCount}
                    icon={Clock}
                    variant="amber"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Vaccination Progress Section */}
        {!loading && stats.childrenCount > 0 && (
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-theme-primary">Vaccination Progress</h2>
            </div>

            {isGeneratingSchedule ? (
              <div className="bg-theme-bg-card rounded-2xl p-6 sm:p-8 border border-theme-border-primary text-center shadow-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-3"></div>
                <h3 className="text-sm font-bold text-theme-primary mb-1">Analyzing Baseline Schedule...</h3>
                <p className="text-xs text-theme-secondary">We are generating the personalized vaccination schedule for your newly added child. This may take a moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProgressCard
                  title="Overall Progress"
                  completed={vaccinationProgress.completed}
                  pending={vaccinationProgress.pending}
                  total={vaccinationProgress.total}
                  icon={CheckCircle}
                  color="emerald"
                />
                <ProgressCard
                  title="This Month"
                  completed={Math.min(stats.vaccinatedCount, 5)}
                  pending={stats.pendingCount}
                  total={Math.max(stats.vaccinatedCount + stats.pendingCount, 5)}
                  icon={Calendar}
                  color="blue"
                />
              </div>
            )}
          </div>
        )}

        {/* Due Vaccines Alert Cards */}
        {!loading && dueVaccines.length > 0 && (
          <div className="pt-4">
            <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-theme-primary">Due Vaccines</h2>
              </div>
              <button
                onClick={() => navigate('/guardian/appointments/new')}
                className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                Book Appointment
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-3">
              {dueVaccines.slice(0, 6).map((vaccine) => (
                <DueVaccineCard
                  key={vaccine.id}
                  vaccine={vaccine.vaccineName}
                  infantName={vaccine.childName}
                  dueDate={vaccine.dueDate}
                  daysUntilDue={vaccine.daysUntilDue}
                  status={vaccine.status}
                  onBook={() => navigate('/guardian/appointments/new')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions Section */}
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-theme-primary">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 min-[768px]:grid-cols-3 min-[1025px]:grid-cols-5 gap-4">
            <button
              onClick={() => navigate('/guardian/appointments')}
              className="guardian-quick-action-btn guardian-dashboard-quick-action flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 guardian-dashboard-quick-action__icon mb-2" />
              <span className="text-xs sm:text-sm font-semibold guardian-dashboard-quick-action__label text-center">Appointments</span>
            </button>
            <button
              onClick={() => navigate('/guardian/children')}
              className="guardian-quick-action-btn guardian-dashboard-quick-action flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <Users className="w-6 h-6 sm:w-7 sm:h-7 guardian-dashboard-quick-action__icon mb-2" />
              <span className="text-xs sm:text-sm font-semibold guardian-dashboard-quick-action__label text-center">My Children</span>
            </button>
            <button
              onClick={() => navigate('/guardian/immunization-chart')}
              className="guardian-quick-action-btn guardian-dashboard-quick-action flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-violet-500 to-violet-600 dark:from-violet-600 dark:to-violet-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <Syringe className="w-6 h-6 sm:w-7 sm:h-7 guardian-dashboard-quick-action__icon mb-2" />
              <span className="text-xs sm:text-sm font-semibold guardian-dashboard-quick-action__label text-center">Immunization</span>
            </button>
            <button
              onClick={() => navigate('/guardian/vaccination-records')}
              className="guardian-quick-action-btn guardian-dashboard-quick-action flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 guardian-dashboard-quick-action__icon mb-2" />
              <span className="text-xs sm:text-sm font-semibold guardian-dashboard-quick-action__label text-center">Records</span>
            </button>
            <button
              onClick={() => navigate('/guardian/children', {
                state: {
                  openGuardianRegistrationModal: true,
                  registrationType: 'transfer',
                },
              })}
              className="guardian-quick-action-btn guardian-dashboard-quick-action flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-cyan-500 to-cyan-600 dark:from-cyan-600 dark:to-cyan-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <ArrowRightCircle className="w-6 h-6 sm:w-7 sm:h-7 guardian-dashboard-quick-action__icon mb-2" />
              <span className="text-xs sm:text-sm font-semibold guardian-dashboard-quick-action__label text-center">Transfer</span>
            </button>
          </div>
        </div>

        {/* Three Column Layout - Children, Appointments, Notifications */}
        <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4 md:gap-6 pt-4 md:pt-6">
            {/* My Children Section */}
            <div>
              <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                    <Baby className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-theme-primary">My Children</h2>
                </div>
                <button
                  onClick={() => navigate('/guardian/children')}
                  className="text-sm font-bold text-theme-secondary hover:text-theme-primary flex items-center gap-1 transition-colors"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <ChildCardSkeleton />
              ) : children.length === 0 ? (
                <div className="lg:px-0">
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 sm:p-8 border border-emerald-100 dark:border-emerald-800/50 text-center shadow-sm">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Baby className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                      Welcome to Immunicare!
                    </h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-6 max-w-sm mx-auto">
                      Your dashboard is ready. To begin tracking vaccination schedules and booking appointments, please add your child's profile.
                    </p>
                    <button
                      onClick={() => {
                        navigate('/guardian/children');
                        setTimeout(() => {
                          triggerGuardianAddChildModal();
                        }, 0);
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Add Your First Child
                    </button>

                    <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
                      <button
                        onClick={() => {
                          trackEvent("intro_replayed");
                          navigate('/guardian/introduction');
                        }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                      >
                        <Info className="w-4 h-4" />
                        Replay Introduction Tour
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {children.slice(0, 2).map((child) => (
                    <div
                      key={child.id}
                      onClick={() => navigate(`/guardian/children/${child.id}`)}
                      className="bg-theme-bg-card rounded-2xl p-4 sm:p-5 border border-theme-border-primary shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                          {(child.name || `${child.first_name} ${child.last_name}`.trim())?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-theme-primary truncate">
                            {child.name || `${child.first_name} ${child.last_name}`.trim()}
                          </h3>
                          <p className="text-sm text-theme-secondary">
                            {child.dateOfBirth || child.dob
                              ? new Date(child.dateOfBirth || child.dob).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : 'DOB not set'
                            }
                          </p>
                          {child.controlNumber && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              ID: {child.controlNumber}
                            </p>
                          )}
                          {child.latest_transfer_case_status && TRANSFER_STATUS_META[child.latest_transfer_case_status] && (
                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${TRANSFER_STATUS_META[child.latest_transfer_case_status].className}`}>
                              {TRANSFER_STATUS_META[child.latest_transfer_case_status].label}
                            </span>
                          )}
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                            {Number(child.completed_vaccinations || 0)} completed • {Number(child.pending_vaccinations || 0)} pending
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                  {children.length > 2 && (
                    <button
                      onClick={() => navigate('/guardian/children')}
                      className="w-full py-3 text-sm font-bold text-theme-secondary hover:text-theme-primary transition-colors"
                    >
                      + {children.length - 2} more children
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming Appointments Section */}
            <div>
              <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-theme-primary">Appointments</h2>
                </div>
                <button
                  onClick={() => navigate('/guardian/appointments')}
                  className="text-sm font-bold text-theme-secondary hover:text-theme-primary flex items-center gap-1 transition-colors"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <AppointmentCardSkeleton />
              ) : appointments.length === 0 ? (
                <div className="lg:px-0">
                  <EmptyState
                    icon={Calendar}
                    title="No Upcoming Appointments"
                    description="Your appointments will appear here when scheduled"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.slice(0, 3).map((appointment) => {
                    const dateInfo = formatAppointmentDate(appointment.scheduledDate || appointment.date);
                    const statusMeta = getAppointmentStatusMeta(appointment.status);
                    return (
                      <div
                        key={appointment.id}
                        onClick={() => navigate(`/guardian/appointments/${appointment.id}`)}
                        className="bg-theme-bg-card rounded-2xl p-4 sm:p-5 border border-theme-border-primary shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex flex-col items-center justify-center border border-emerald-100 dark:border-emerald-800 flex-shrink-0">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">{dateInfo.month}</span>
                            <span className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300">{dateInfo.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-theme-primary truncate">
                              {appointment.type || appointment.vaccineName || 'Vaccination'}
                            </h3>
                            <p className="text-sm text-theme-secondary">
                              {dateInfo.time} • {appointment.doctorName || 'Dr. Smith'}
                            </p>
                            {appointment.infantName && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                For: {appointment.infantName}
                              </p>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full flex-shrink-0 ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Notifications Section */}
            <div className="min-[768px]:col-span-2 min-[1025px]:col-span-1">
              <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-theme-primary">Notifications</h2>
                </div>
                <button
                  onClick={() => navigate('/guardian/notifications')}
                  className="text-sm font-bold text-theme-secondary hover:text-theme-primary flex items-center gap-1 transition-colors"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                </div>
              ) : notifications.length === 0 ? (
                <div className="lg:px-0">
                  <EmptyState
                    icon={Bell}
                    title="No Notifications"
                    description="You will receive notifications about appointments and vaccinations here"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 4).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onDismiss={handleDismissNotification}
                    />
                  ))}
                  {notifications.length > 4 && (
                    <button
                      onClick={() => navigate('/guardian/notifications')}
                      className="w-full py-3 text-sm font-bold text-theme-secondary hover:text-theme-primary transition-colors"
                    >
                      + {notifications.length - 4} more notifications
                    </button>
                  )}
                </div>
              )}
            </div>
        </div>
        </ErrorBoundary>
        </main>
        </div>
      </div>
    </div>
  );
};

export default GuardianDashboard;
