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
} from 'lucide-react';
import GuardianTopHeader from '../components/GuardianTopHeader';
import GuardianModuleHeader from '../components/GuardianModuleHeader';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/api';

// ============================================
// SKELETON LOADING COMPONENTS
// ============================================

const StatCardSkeleton = () => (
  <div className="bg-gray-100 rounded-2xl p-5 animate-pulse min-h-[120px]">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-20"></div>
        <div className="h-8 bg-gray-200 rounded w-12"></div>
      </div>
      <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
    </div>
  </div>
);

const ChildCardSkeleton = () => (
  <div className="bg-gray-100 rounded-2xl p-6 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="h-3 bg-gray-200 rounded w-24"></div>
      </div>
    </div>
  </div>
);

const AppointmentCardSkeleton = () => (
  <div className="bg-gray-100 rounded-2xl p-5 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-gray-200 rounded w-40"></div>
        <div className="h-3 bg-gray-200 rounded w-24"></div>
      </div>
    </div>
  </div>
);

const NotificationSkeleton = () => (
  <div className="bg-gray-100 rounded-xl p-4 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        <div className="h-2 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

// ============================================
// ENHANCED STAT CARD COMPONENT
// ============================================

const StatCard = ({ label, value, subLabel, icon: Icon, bgColor, iconBgColor, textColor, onClick }) => (
  <div
    className={`${bgColor} rounded-2xl p-4 sm:p-5 relative overflow-hidden min-h-[100px] sm:min-h-[120px] transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
    onClick={onClick}
  >
    {/* Background decoration */}
    <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-10 h-10 sm:w-12 sm:h-12 ${iconBgColor} rounded-xl flex items-center justify-center opacity-80`}>
      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${textColor}`} />
    </div>
    <div className="relative z-10">
      <p className={`text-[10px] sm:text-xs font-bold ${textColor} uppercase tracking-wider mb-1 sm:mb-2 opacity-90`}>{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold ${textColor} mb-0.5 sm:mb-1`}>{value}</p>
      {subLabel && (
        <div className="flex items-center gap-1">
          <TrendingUp className={`w-3 h-3 ${textColor} opacity-70`} />
          <span className={`text-[10px] sm:text-xs ${textColor} opacity-80 font-medium`}>{subLabel}</span>
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

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-100',
      iconBg: 'bg-emerald-200',
      text: 'text-emerald-700',
      progressBg: 'bg-emerald-200',
      progressFill: 'bg-emerald-500',
    },
    blue: {
      bg: 'bg-blue-100',
      iconBg: 'bg-blue-200',
      text: 'text-blue-700',
      progressBg: 'bg-blue-200',
      progressFill: 'bg-blue-500',
    },
    purple: {
      bg: 'bg-purple-100',
      iconBg: 'bg-purple-200',
      text: 'text-purple-700',
      progressBg: 'bg-purple-200',
      progressFill: 'bg-purple-500',
    },
    amber: {
      bg: 'bg-amber-100',
      iconBg: 'bg-amber-200',
      text: 'text-amber-700',
      progressBg: 'bg-amber-200',
      progressFill: 'bg-amber-500',
    },
  };

  const colors = colorClasses[color] || colorClasses.emerald;

  return (
    <div className={`${colors.bg} rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`${colors.iconBg} rounded-lg p-1.5`}>
            <Icon className={`w-4 h-4 ${colors.text}`} />
          </div>
          <span className={`text-sm font-bold ${colors.text}`}>{title}</span>
        </div>
        <span className={`text-lg font-bold ${colors.text}`}>{percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className={`h-2 ${colors.progressBg} rounded-full overflow-hidden mb-2`}>
        <div
          className={`h-full ${colors.progressFill} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={`${colors.text} opacity-80`}>{completed} completed</span>
        <span className={`${colors.text} opacity-80`}>{pending} pending</span>
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
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{vaccine}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{infantName}</p>
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
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow">
      <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {notification.title || notification.message?.substring(0, 50)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {notification.created_at ? new Date(notification.created_at).toLocaleDateString() : 'Just now'}
        </p>
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(notification.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 text-center shadow-sm">
    {Icon && (
      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
    )}
    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs mx-auto">{description}</p>
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
        guardianId ? apiClient.getInfantsByGuardian(guardianId) : Promise.resolve({ data: [] }),
        guardianId ? apiClient.getGuardianAppointments(guardianId, { status: 'upcoming', limit: 5 }) : Promise.resolve({ data: [] }),
        guardianId ? apiClient.getNotifications({ limit: 10 }) : Promise.resolve({ data: [] }),
        guardianId ? apiClient.getGuardianStats(guardianId) : Promise.resolve({ data: {} }),
      ]);

      // Process children data
      let childrenData = [];
      if (childrenResponse.status === 'fulfilled' && childrenResponse.value?.data) {
        childrenData = Array.isArray(childrenResponse.value.data)
          ? childrenResponse.value.data
          : childrenResponse.value.data.infants || [];
      }
      setChildren(childrenData);

      // Process appointments data
      let appointmentsData = [];
      if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value?.data) {
        appointmentsData = Array.isArray(appointmentsResponse.value.data)
          ? appointmentsResponse.value.data
          : appointmentsResponse.value.data.appointments || [];
      }
      setAppointments(appointmentsData);

      // Process notifications data
      let notificationsData = [];
      if (notificationsResponse.status === 'fulfilled' && notificationsResponse.value?.data) {
        notificationsData = Array.isArray(notificationsResponse.value.data)
          ? notificationsResponse.value.data
          : notificationsResponse.value.data.notifications || [];
      }
      setNotifications(notificationsData.slice(0, 5));

      // Process stats from API or calculate locally
      const apiStats = statsResponse.status === 'fulfilled' ? (statsResponse.value?.data || statsResponse.value || {}) : {};

      // Calculate stats locally if not available from API
      const today = new Date();

      const vaccinatedCount = childrenData.reduce((acc, child) => {
        return acc + (child.vaccinations?.filter(v => v.status === 'completed')?.length || 0);
      }, 0);

      const pendingCount = childrenData.reduce((acc, child) => {
        return acc + (child.vaccinations?.filter(v => v.status === 'pending' || v.status === 'scheduled')?.length || 0);
      }, 0);

      // Calculate due/overdue vaccinations
      const dueVaccinesList = [];
      childrenData.forEach(child => {
        const childDueVaccines = child.vaccinations?.filter(v => {
          if (v.status === 'completed') return false;
          const dueDate = v.dueDate || v.scheduledDate;
          if (!dueDate) return false;
          const due = new Date(dueDate);
          const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
          return daysUntil <= 30; // Due within 30 days
        }) || [];

        childDueVaccines.forEach(vaccine => {
          const dueDate = vaccine.dueDate || vaccine.scheduledDate;
          const daysUntil = Math.ceil((new Date(dueDate) - today) / (1000 * 60 * 60 * 24));
          dueVaccinesList.push({
            id: `${child.id}-${vaccine.id}`,
            childId: child.id,
            childName: child.name || `${child.first_name} ${child.last_name}`.trim(),
            vaccineName: vaccine.name || vaccine.vaccineName,
            dueDate: dueDate,
            daysUntilDue: daysUntil,
            status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming',
          });
        });
      });

      // Sort by urgency
      dueVaccinesList.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      setDueVaccines(dueVaccinesList.slice(0, 5));

      const nextAppointmentDate = appointmentsData.length > 0
        ? new Date(appointmentsData[0].scheduledDate || appointmentsData[0].date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        : 'None';

      setStats({
        childrenCount: apiStats.childrenCount || childrenData.length,
        nextAppointment: apiStats.nextAppointment || nextAppointmentDate,
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
    // Optionally call API to mark as read/dismissed
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

  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={handleRetry}
          isRefreshing={loading}
        />
      </div>

      <div className="pt-14 sm:pt-16 lg:pt-0">
        <GuardianModuleHeader
          title="Guardian Dashboard"
          subtitle="Welcome back! "
          icon={<Calendar className="w-8 h-8 text-white" />}
          actions={(
            <div className="hidden lg:flex guardian-desktop-pageheader-actions">
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

        <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6 p-4 md:p-6">

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
              <div className="flex items-start gap-3">
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
                  onClick={() => navigate('/guardian/appointments/book')}
                  className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition-colors shadow-sm ${
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  bgColor="bg-emerald-100"
                  iconBgColor="bg-emerald-200"
                  textColor="text-emerald-700"
                  onClick={() => navigate('/guardian/children')}
                />
                <StatCard
                  label="NEXT APPT"
                  value={stats.nextAppointment}
                  icon={Calendar}
                  bgColor="bg-blue-100"
                  iconBgColor="bg-blue-200"
                  textColor="text-blue-700"
                  onClick={() => navigate('/guardian/appointments')}
                />
                <StatCard
                  label="VACCINATED"
                  value={stats.vaccinatedCount}
                  subLabel="Completed"
                  icon={Syringe}
                  bgColor="bg-purple-100"
                  iconBgColor="bg-purple-200"
                  textColor="text-purple-700"
                  onClick={() => navigate('/guardian/vaccination-records')}
                />
                {stats.overdueCount > 0 ? (
                  <StatCard
                    label="OVERDUE"
                    value={stats.overdueCount}
                    icon={AlertCircle}
                    bgColor="bg-red-100"
                    iconBgColor="bg-red-200"
                    textColor="text-red-700"
                    onClick={() => navigate('/guardian/appointments/book')}
                  />
                ) : (
                  <StatCard
                    label="PENDING"
                    value={stats.pendingCount}
                    icon={Clock}
                    bgColor="bg-amber-100"
                    iconBgColor="bg-amber-200"
                    textColor="text-amber-700"
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
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Vaccination Progress</h2>
            </div>
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
          </div>
        )}

        {/* Due Vaccines Alert Cards */}
        {!loading && dueVaccines.length > 0 && (
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Due Vaccines</h2>
              </div>
              <button
                onClick={() => navigate('/guardian/appointments/book')}
                className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                Book Appointment
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dueVaccines.slice(0, 6).map((vaccine) => (
                <DueVaccineCard
                  key={vaccine.id}
                  vaccine={vaccine.vaccineName}
                  infantName={vaccine.childName}
                  dueDate={vaccine.dueDate}
                  daysUntilDue={vaccine.daysUntilDue}
                  status={vaccine.status}
                  onBook={() => navigate('/guardian/appointments/book')}
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
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/guardian/appointments')}
              className="guardian-quick-action-btn flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-2" />
              <span className="text-xs sm:text-sm font-semibold text-white text-center">Appointments</span>
            </button>
            <button
              onClick={() => navigate('/guardian/children')}
              className="guardian-quick-action-btn flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-2" />
              <span className="text-xs sm:text-sm font-semibold text-white text-center">My Children</span>
            </button>
            <button
              onClick={() => navigate('/guardian/immunization-chart')}
              className="guardian-quick-action-btn flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-violet-500 to-violet-600 dark:from-violet-600 dark:to-violet-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <Syringe className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-2" />
              <span className="text-xs sm:text-sm font-semibold text-white text-center">Immunization</span>
            </button>
            <button
              onClick={() => navigate('/guardian/vaccination-records')}
              className="guardian-quick-action-btn flex flex-col items-center justify-center p-4 sm:p-5 bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[100px] sm:min-h-[120px]"
            >
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-2" />
              <span className="text-xs sm:text-sm font-semibold text-white text-center">Records</span>
            </button>
          </div>
        </div>

        {/* Three Column Layout - Children, Appointments, Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 pt-4 md:pt-6">
            {/* My Children Section */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                    <Baby className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">My Children</h2>
                </div>
                <button
                  onClick={() => navigate('/guardian/children')}
                  className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <ChildCardSkeleton />
              ) : children.length === 0 ? (
                <div className="lg:px-0">
                  <EmptyState
                    icon={Baby}
                    title="No Children Registered"
                    description="Add your first child to get started tracking their vaccinations"
                    actionLabel="Add Child"
                    onAction={() => navigate('/guardian/children/new')}
                    variant="primary"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {children.slice(0, 2).map((child) => (
                    <div
                      key={child.id}
                      onClick={() => navigate(`/guardian/children/${child.id}`)}
                      className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                          {(child.name || `${child.first_name} ${child.last_name}`.trim())?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">
                            {child.name || `${child.first_name} ${child.last_name}`.trim()}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
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
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                  {children.length > 2 && (
                    <button
                      onClick={() => navigate('/guardian/children')}
                      className="w-full py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      + {children.length - 2} more children
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming Appointments Section */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Appointments</h2>
                </div>
                <button
                  onClick={() => navigate('/guardian/appointments')}
                  className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
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
                    return (
                      <div
                        key={appointment.id}
                        onClick={() => navigate(`/guardian/appointments/${appointment.id}`)}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex flex-col items-center justify-center border border-emerald-100 dark:border-emerald-800 flex-shrink-0">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">{dateInfo.month}</span>
                            <span className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300">{dateInfo.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 dark:text-white truncate">
                              {appointment.type || appointment.vaccineName || 'Vaccination'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {dateInfo.time} • {appointment.doctorName || 'Dr. Smith'}
                            </p>
                            {appointment.infantName && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                For: {appointment.infantName}
                              </p>
                            )}
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full flex-shrink-0">
                            {appointment.status === 'confirmed' ? 'Confirmed' : 'Scheduled'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Notifications Section */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
                </div>
                <button
                  onClick={() => navigate('/guardian/notifications')}
                  className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
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
                      className="w-full py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      + {notifications.length - 4} more notifications
                    </button>
                  )}
                </div>
              )}
            </div>
        </div>
        </main>
      </div>
    </div>
  );
};

export default GuardianDashboard;
