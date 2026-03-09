import React from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';

/**
 * GuardianImmunizationChart Component
 * Displays immunization schedule with horizontal scrolling on mobile.
 * This component is now fully themed using CSS variables from the comprehensive theme file.
 *
 * Features:
 * - Horizontally scrollable container for immunization cards.
 * - WCAG 2.1 AA compliant with proper aria labels and semantic HTML.
 * - Uses centralized theme variables for consistent light and dark modes.
 * - Smooth snap scrolling for a better user experience on touch devices.
 */

const ImmunizationCard = ({ vaccine, status, dueDate, index }) => {
  const statusConfig = {
    completed: {
      icon: Check,
      label: 'Completed',
      className: 'status-completed'
    },
    upcoming: {
      icon: Clock,
      label: 'Upcoming',
      className: 'status-upcoming'
    },
    overdue: {
      icon: AlertCircle,
      label: 'Overdue',
      className: 'status-overdue'
    },
    missed: {
      icon: X,
      label: 'Missed',
      className: 'status-missed'
    },
  };

  const config = statusConfig[status] || statusConfig.upcoming;
  const Icon = config.icon;

  return (
    <div
      className={`immunization-card flex-shrink-0 w-72 sm:w-80 p-4 rounded-xl border ${config.className}`}
      role="article"
      aria-label={`${vaccine.name} - ${config.label}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="status-icon p-2 rounded-lg">
          <Icon size={20} />
        </div>
        <span className="status-label text-xs font-medium px-2 py-1 rounded-full">
          {config.label}
        </span>
      </div>

      <h3 className="text-base font-semibold text-theme-primary mb-1">
        {vaccine.name}
      </h3>

      <p className="text-sm text-theme-secondary mb-2">
        {vaccine.description}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-theme-border-primary">
        <span className="text-sm text-theme-primary">
          {vaccine.dose}
        </span>
        <span className={`text-sm font-medium status-text`}>
          {dueDate}
        </span>
      </div>

      {vaccine.age && (
        <div className="mt-2 text-xs text-theme-muted">
          Recommended age: {vaccine.age}
        </div>
      )}
    </div>
  );
};

const GuardianImmunizationChart = ({ immunizations = [] }) => {
  const defaultImmunizations = [
        {
      name: 'BCG',
      description: 'Bacillus Calmette-Guérin vaccine',
      dose: '1st Dose',
      age: 'At birth',
      status: 'completed',
      dueDate: 'Completed',
    },
    {
      name: 'Hepatitis B',
      description: 'Hepatitis B vaccine',
      dose: '1st Dose',
      age: 'At birth',
      status: 'completed',
      dueDate: 'Completed',
    },
    {
      name: 'Pentavalent',
      description: 'DPT-HepB-Hib combination',
      dose: '1st Dose',
      age: '6 weeks',
      status: 'upcoming',
      dueDate: 'Due Oct 24',
    },
    {
      name: 'OPV',
      description: 'Oral Polio Vaccine',
      dose: '1st Dose',
      age: '6 weeks',
      status: 'upcoming',
      dueDate: 'Due Oct 24',
    },
    {
      name: 'PCV',
      description: 'Pneumococcal Conjugate Vaccine',
      dose: '1st Dose',
      age: '6 weeks',
      status: 'upcoming',
      dueDate: 'Due Oct 24',
    },
        {
      name: 'Rotavirus',
      description: 'Rotavirus vaccine',
      dose: '1st Dose',
      age: '6 weeks',
      status: 'upcoming',
      dueDate: 'Due Oct 24',
    },
  ];

  const data = immunizations.length > 0 ? immunizations : defaultImmunizations;

  return (
    <div
      className="immunization-chart-container"
      role="region"
      aria-label="Immunization Schedule"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-theme-primary">
          Immunization Schedule
        </h2>
        <button
          className="text-sm font-medium text-theme-accent-primary hover:underline"
          onClick={() => window.open('/guardian/immunization-chart', '_self')}
          aria-label="View full immunization chart"
        >
          View Full Chart
        </button>
      </div>

      {/* Horizontal scrollable container */}
      <div
        className="immunization-scroll-container flex gap-4 overflow-x-auto pb-4"
      >
        {data.map((immunization, index) => (
          <ImmunizationCard
            key={index}
            vaccine={immunization}
            status={immunization.status}
            dueDate={immunization.dueDate}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default GuardianImmunizationChart;
