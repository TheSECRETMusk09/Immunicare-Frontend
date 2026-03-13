import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Clock, AlertCircle, Lock, Unlock } from 'lucide-react';
import apiClient from '../utils/api';

/**
 * Enhanced GuardianImmunizationChart Component
 *
 * Features:
 * - Dynamically fetches vaccination schedule from backend API
 * - Displays proper status: completed, upcoming, pending_confirmation, ready, overdue
 * - Shows "upcoming" when infant is not yet eligible due to age
 * - Shows "pending_confirmation" when infant is eligible but admin hasn't confirmed readiness
 * - Only allows completion when admin has confirmed readiness
 * - Horizontal scrolling on mobile with smooth snap scrolling
 * - WCAG 2.1 AA compliant
 */

const STATUS_CONFIG = {
  completed: {
    icon: Check,
    label: 'Completed',
    className: 'status-completed',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    borderClass: 'border-green-300 dark:border-green-700',
    textClass: 'text-green-700 dark:text-green-400'
  },
  upcoming: {
    icon: Clock,
    label: 'Upcoming',
    className: 'status-upcoming',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    borderClass: 'border-blue-300 dark:border-blue-700',
    textClass: 'text-blue-700 dark:text-blue-400'
  },
  pending_confirmation: {
    icon: Lock,
    label: 'Pending Confirmation',
    className: 'status-pending',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    borderClass: 'border-amber-300 dark:border-amber-700',
    textClass: 'text-amber-700 dark:text-amber-400'
  },
  ready: {
    icon: Unlock,
    label: 'Ready to Receive',
    className: 'status-ready',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
    textClass: 'text-emerald-700 dark:text-emerald-400'
  },
  overdue: {
    icon: AlertCircle,
    label: 'Overdue',
    className: 'status-overdue',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    borderClass: 'border-red-300 dark:border-red-700',
    textClass: 'text-red-700 dark:text-red-400'
  },
  due_soon: {
    icon: Clock,
    label: 'Due Soon',
    className: 'status-due-soon',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    borderClass: 'border-orange-300 dark:border-orange-700',
    textClass: 'text-orange-700 dark:text-orange-400'
  }
};

const ImmunizationCard = ({ vaccine, status, dueDate, index, onViewDetails }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  const Icon = config.icon;

  const getStatusLabel = () => {
    if (status === 'pending_confirmation') {
      return 'Waiting for health center confirmation';
    }
    if (status === 'upcoming') {
      return 'Not yet eligible - infant is too young';
    }
    if (status === 'ready') {
      return 'Ready to receive at health center';
    }
    return config.label;
  };

  return (
    <div
      className={`immunization-card flex-shrink-0 w-72 sm:w-80 p-4 rounded-xl border-2 ${config.borderClass} ${config.bgClass} cursor-pointer transition-all hover:shadow-md`}
      role="article"
      aria-label={`${vaccine.name} - ${config.label}`}
      onClick={() => onViewDetails && onViewDetails(vaccine, status)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onViewDetails && onViewDetails(vaccine, status);
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`status-icon p-2 rounded-lg ${config.bgClass}`}>
          <Icon size={20} className={config.textClass} />
        </div>
        <span className={`status-label text-xs font-medium px-2 py-1 rounded-full ${config.bgClass} ${config.textClass}`}>
          {config.label}
        </span>
      </div>

      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {vaccine.name}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {vaccine.description || `${vaccine.dose?.number || 1} of ${vaccine.dose?.total || 1} doses`}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Dose {vaccine.dose?.number || 1} of {vaccine.dose?.total || 1}
        </span>
        <span className={`text-sm font-medium ${config.textClass}`}>
          {dueDate}
        </span>
      </div>

      {vaccine.dose?.completed > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Completed: {vaccine.dose.completed} dose(s)
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {getStatusLabel()}
      </div>
    </div>
  );
};

const EnhancedGuardianImmunizationChart = ({
  immunizations = [],
  childId = null,
  onViewFullChart = null,
  forceRefresh = false
}) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(min-width: 1024:px)').matches;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dragStateRef = useRef({ isPointerDown: false, pointerId: null, startX: 0, startScrollLeft: 0 });

  // Fetch schedule data from API
  const fetchScheduleData = useCallback(async () => {
    if (!childId) {
      setScheduleData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getInfantVaccinationSchedule(childId);
      setScheduleData(response);
    } catch (err) {
      console.error('Error fetching vaccination schedule:', err);
      setError(err.message || 'Failed to load vaccination schedule');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData, forceRefresh]);

  // Viewport detection
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleViewportChange = (event) => {
      setIsDesktopViewport(event.matches);
      if (!event.matches) {
        setIsDragging(false);
      }
    };

    setIsDesktopViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  // Drag handlers
  const handlePointerDown = useCallback((event) => {
    if (!isDesktopViewport || event.pointerType === 'touch') {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    dragStateRef.current = {
      isPointerDown: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };

    setIsDragging(true);
    container.setPointerCapture?.(event.pointerId);
  }, [isDesktopViewport]);

  const handlePointerMove = useCallback((event) => {
    const container = scrollContainerRef.current;
    const dragState = dragStateRef.current;

    if (!container || !dragState.isPointerDown || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    container.scrollLeft = dragState.startScrollLeft - deltaX;
  }, []);

  const stopDragging = useCallback((pointerId) => {
    const container = scrollContainerRef.current;
    if (container && pointerId !== null && pointerId !== undefined) {
      container.releasePointerCapture?.(pointerId);
    }

    dragStateRef.current = {
      isPointerDown: false,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
    };

    setIsDragging(false);
  }, []);

  const handlePointerUp = useCallback((event) => {
    if (!dragStateRef.current.isPointerDown || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }
    stopDragging(event.pointerId);
  }, [stopDragging]);

  const handlePointerLeave = useCallback((event) => {
    if (!dragStateRef.current.isPointerDown || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }
    stopDragging(event.pointerId);
  }, [stopDragging]);

  const handlePointerCancel = useCallback((event) => {
    if (!dragStateRef.current.isPointerDown || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }
    stopDragging(event.pointerId);
  }, [stopDragging]);

  const handleViewFullChart = () => {
    if (typeof onViewFullChart === 'function') {
      onViewFullChart();
      return;
    }

    const sanitizedChildId =
      childId !== null && childId !== undefined && String(childId).trim() !== ''
        ? String(childId).trim()
        : null;

    const targetPath = sanitizedChildId
      ? `/guardian/immunization-chart/${sanitizedChildId}`
      : '/guardian/immunization-chart';

    navigate(targetPath, { replace: false });
  };

  const handleViewDetails = (vaccine, status) => {
    // Could open a modal or navigate to details
    console.log('View details for:', vaccine, status);
  };

  // Format date for display
  const formatDueDate = (dueDateStr) => {
    if (!dueDateStr) return 'N/A';

    const dueDate = new Date(dueDateStr);
    const today = new Date();

    if (dueDate < today) {
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      if (daysOverdue === 0) return 'Due today';
      if (daysOverdue === 1) return '1 day overdue';
      return `${daysOverdue} days overdue`;
    }

    const daysUntil = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    if (daysUntil <= 7) return `Due in ${daysUntil} days`;

    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Transform API data to card format
  const getImmunizationCards = () => {
    if (!scheduleData?.schedule) {
      return [];
    }

    return scheduleData.schedule.map((item) => ({
      vaccine: {
        id: item.vaccine.id,
        name: item.vaccine.name,
        description: item.schedule?.description,
        dose: {
          number: item.dose.number,
          total: item.dose.total,
          completed: item.dose.completed
        }
      },
      status: item.status,
      dueDate: formatDueDate(item.schedule.dueDate),
      isReady: item.isReady,
      canBeAdministered: item.canBeAdministered
    }));
  };

  const immunizationCards = getImmunizationCards();

  // Get summary counts
  const summary = scheduleData?.summary || {
    totalVaccines: 0,
    completed: 0,
    ready: 0,
    upcoming: 0,
    overdue: 0,
    pendingConfirmation: 0
  };

  if (loading) {
    return (
      <div className="immunization-chart-container">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Immunization Schedule
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="immunization-chart-container">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Immunization Schedule
          </h2>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
          <button
            onClick={fetchScheduleData}
            className="mt-2 text-sm text-red-700 dark:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="immunization-chart-container"
      role="region"
      aria-label="Immunization Schedule"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Immunization Schedule
        </h2>
        <button
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          onClick={handleViewFullChart}
          aria-label="View full immunization chart"
          type="button"
        >
          View Full Chart
        </button>
      </div>

      {/* Summary badges */}
      {scheduleData && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Check size={12} className="mr-1" />
            {summary.completed} Completed
          </span>
          {summary.ready > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Unlock size={12} className="mr-1" />
              {summary.ready} Ready
            </span>
          )}
          {summary.pendingConfirmation > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <Lock size={12} className="mr-1" />
              {summary.pendingConfirmation} Pending
            </span>
          )}
          {summary.upcoming > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              <Clock size={12} className="mr-1" />
              {summary.upcoming} Upcoming
            </span>
          )}
          {summary.overdue > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle size={12} className="mr-1" />
              {summary.overdue} Overdue
            </span>
          )}
        </div>
      )}

      {/* Horizontal scrollable container */}
      {immunizationCards.length > 0 ? (
        <div
          ref={scrollContainerRef}
          className={`immunization-scroll-container flex gap-4 overflow-x-auto pb-4 ${
            isDesktopViewport ? 'guardian-immunization-scroll-desktop' : ''
          } ${isDragging ? 'guardian-immunization-scroll-dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerCancel}
        >
          {immunizationCards.map((immunization, index) => (
            <ImmunizationCard
              key={`${immunization.vaccine.id}-${immunization.vaccine.dose?.number || index}`}
              vaccine={immunization.vaccine}
              status={immunization.status}
              dueDate={immunization.dueDate}
              index={index}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No immunization schedule available</p>
          {childId && (
            <p className="text-sm mt-2">
              Contact the health center to set up your child's immunization schedule.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedGuardianImmunizationChart;
