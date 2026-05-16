import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Plus,
  AlertCircle,
  RefreshCw,
  Bell,
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
} from 'lucide-react';
import GuardianTopHeader from '../components/GuardianTopHeader';
import GuardianModuleHeader from '../components/GuardianModuleHeader';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/api';
import { triggerGuardianAddChildModal } from '../components/QuickActionFAB';
import useGuardianNotifications from '../hooks/useGuardianNotifications';
import { trackEvent } from '../utils/telemetry';
import ErrorBoundary from '../components/ErrorBoundary';
import { unwrapApiPayload } from '../utils/apiUtils';
import { inferNotificationType } from '../utils/notificationUtils';
import { TRANSFER_STATUS_META, getAppointmentStatusMeta } from '../constants/statusMappings';

// Skeletons

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

// Stat card

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

// Progress card

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

// Due vaccine alert

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

// Notification item

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

// Empty state

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

// Error state

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

// Guardian dashboard

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
  const [dueVaccines, setDueVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardWarnings, setDashboardWarnings] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);
  const hasTracked = React.useRef(false);
  const notificationsState = useGuardianNotifications({
    limit: 5,
    pollingInterval: 60000,
  });
  const guardianNotifications = Array.isArray(notificationsState?.notifications)
    ? notificationsState.notifications
    : [];
  const notificationsLoading = Boolean(notificationsState?.loading);
  const notificationsError = notificationsState?.error || null;
  const markAsRead =
    typeof notificationsState?.markAsRead === "function"
      ? notificationsState.markAsRead
      : async () => false;
  const refreshNotifications =
    typeof notificationsState?.refresh === "function"
      ? notificationsState.refresh
      : async () => {};

  // Fetch data from API
  const fetchDashboardData = useCallback(async (isSilentRefresh = false) => {
    if (!guardianId) {
      setChildren([]);
      setAppointments([]);
      setDueVaccines([]);
      setDashboardWarnings([]);
      setStats({
        childrenCount: 0,
        nextAppointment: 'None',
        vaccinatedCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        upcomingVaccines: 0,
      });
      setLoading(false);
      return;
    }

    if (!isSilentRefresh) {
      setLoading(true);
      setError(null);
    }

    try {
      const overviewResponse = await apiClient.getGuardianDashboardOverview(guardianId, {
        appointmentLimit: 5,
        dueLimit: 6,
      });
      const overview = unwrapApiPayload(overviewResponse) || {};
      const childrenData = Array.isArray(overview.children)
        ? overview.children.map((child) => ({
            ...child,
            name: child.name || `${child.first_name || ''} ${child.last_name || ''}`.trim(),
            dateOfBirth: child.dateOfBirth || child.dob || child.birth_date || null,
            controlNumber: child.controlNumber || child.control_number || null,
          }))
        : [];
      setChildren(childrenData);

      const appointmentsData = Array.isArray(overview.appointments)
        ? overview.appointments.map((appointment) => ({
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
          }))
        : [];
      setAppointments(appointmentsData);

      const dueVaccinesData = Array.isArray(overview.dueVaccines)
        ? overview.dueVaccines.map((entry) => ({
            ...entry,
            id:
              entry.id ||
              `${entry.childId || entry.child_id || 'child'}-${entry.vaccineName || entry.vaccine_name || 'vaccine'}-${entry.dueDate || entry.due_date || 'no-date'}`,
          }))
        : [];
      setDueVaccines(dueVaccinesData);
      setDashboardWarnings(
        Array.isArray(overview.diagnostics?.warnings)
          ? overview.diagnostics.warnings.filter(Boolean)
          : [],
      );

      const apiStats = overview.stats || {};

      const vaccinatedCount = apiStats.completedVaccinations ?? childrenData.reduce((acc, child) => {
        return acc + Number(child.completed_vaccinations || 0);
      }, 0);

      const pendingCount = apiStats.pendingVaccinations ?? childrenData.reduce((acc, child) => {
        return acc + Number(child.pending_vaccinations || 0);
      }, 0);

      const nextAppointmentDateSource =
        apiStats?.nextAppointment?.scheduled_date ||
        apiStats?.nextAppointment?.scheduledDate ||
        appointmentsData?.[0]?.scheduledDate ||
        appointmentsData?.[0]?.scheduled_date ||
        appointmentsData?.[0]?.date ||
        apiStats?.nextActionDate ||
        dueVaccinesData?.[0]?.dueDate ||
        dueVaccinesData?.[0]?.due_date;

      const nextAppointmentDate = nextAppointmentDateSource
        ? new Date(nextAppointmentDateSource).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        : 'None';

       setStats({
         childrenCount: apiStats.childrenCount || childrenData.length,
         nextAppointment: nextAppointmentDate,
         vaccinatedCount: vaccinatedCount,
         pendingCount: pendingCount,
         overdueCount: Number(
           apiStats.overdueVaccinations ??
             dueVaccinesData.filter((entry) => entry.status === 'overdue').length,
         ),
         upcomingVaccines: Number(
           apiStats.upcomingVaccines ??
             dueVaccinesData.filter((entry) => entry.status === 'due_soon').length,
         ),
       });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (!isSilentRefresh) {
        setError('Failed to load dashboard data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  // Fetch data on mount - only depend on guardianId to prevent circular calls
  useEffect(() => {
    if (guardianId) {
      fetchDashboardData(false);
    }
  }, [guardianId]);

  // Auto-refresh dashboard data every 60 seconds - stable dependencies
  useEffect(() => {
    if (!guardianId) return;

    const intervalId = window.setInterval(() => {
      fetchDashboardData(true);
      void refreshNotifications();
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [guardianId]);

  // Update dismissed notifications when guardianNotifications change
  useEffect(() => {
    setDismissedNotificationIds((previous) => {
      const next = previous.filter((notificationId) =>
        guardianNotifications.some((notification) => notification.id === notificationId),
      );

      if (
        next.length === previous.length &&
        next.every((notificationId, index) => notificationId === previous[index])
      ) {
        return previous;
      }

      return next;
    });
  }, [guardianNotifications]);

  // Accessibility: Focus main content when loaded
  useEffect(() => {
    if (!loading && !error && dashboardRef.current) {
      // Give the DOM a tiny bit of time to render before focusing
      setTimeout(() => dashboardRef.current?.focus(), 100);
    }
  }, [loading, error]);

  // Telemetry: track dashboard view and general stats - use ref to prevent re-triggers
  useEffect(() => {
    if (!loading && !error && !hasTracked.current && stats.childrenCount > 0) {
      trackEvent("dashboard_first_view", { childrenCount: stats.childrenCount, overdueCount: stats.overdueCount });
      hasTracked.current = true;
    }
  }, [loading, error]);

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
    fetchDashboardData(false);
    void refreshNotifications();
  };

  // Handle notification dismiss
  const handleDismissNotification = async (notificationId) => {
    setDismissedNotificationIds((previous) =>
      previous.includes(notificationId)
        ? previous
        : [...previous, notificationId],
    );
    try {
      const marked = await markAsRead(notificationId);
      if (!marked) {
        setDismissedNotificationIds((previous) =>
          previous.filter((id) => id !== notificationId),
        );
        return;
      }
      trackEvent("notification_dismissed", { notificationId });
    } catch (err) {
      console.warn(`Failed to mark notification ${notificationId} as read:`, err);
      setDismissedNotificationIds((previous) =>
        previous.filter((id) => id !== notificationId),
      );
    }
  };

  const notifications = useMemo(
    () =>
      guardianNotifications
        .filter((notification) => !dismissedNotificationIds.includes(notification.id))
        .slice(0, 5)
        .map((notification) => ({
          ...notification,
          type: inferNotificationType(notification),
          title: notification.title || 'Notification',
        })),
    [dismissedNotificationIds, guardianNotifications],
  );

  const warningMessages = useMemo(() => {
    const warnings = [...dashboardWarnings];
    if (notificationsError) {
      warnings.push(
        'Notifications are temporarily unavailable. Dashboard cards are loaded, but recent alerts may be incomplete.',
      );
    }
    return warnings;
  }, [dashboardWarnings, notificationsError]);

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

  // Phase 2: Derived Data Lag fix - Show skeleton only during initial load, not when counts are legitimately 0
  // Only show "Analyzing" state if we're still loading OR if we have children but haven't processed schedules yet
  const isGeneratingSchedule = loading && stats.childrenCount > 0 && vaccinationProgress.total === 0;

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
        />

        <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">
        <ErrorBoundary>

        {/* Error State */}
        {error && (
          <div className="pt-4">
            <ErrorState message={error} onRetry={handleRetry} />
          </div>
        )}

        {!error && warningMessages.length > 0 && (
          <div className="pt-4 space-y-3">
            {warningMessages.map((warningMessage, index) => (
              <div
                key={`${warningMessage}-${index}`}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                role="status"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{warningMessage}</span>
                </div>
              </div>
            ))}
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
                  label="NEXT APPOINTMENT"
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
                    label="OVERDUE VACCINES"
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
                  completed={stats.vaccinatedCount}
                  pending={stats.pendingCount}
                  total={Math.max(stats.vaccinatedCount + stats.pendingCount, 1)}
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
        </div>
        </ErrorBoundary>
        </main>
        </div>
      </div>
    </div>
  );
};

export default GuardianDashboard;
