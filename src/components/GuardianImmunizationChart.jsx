import React from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';

/**
 * GuardianImmunizationChart Component
 * Displays immunization schedule with horizontal scrolling on mobile
 * Uses snap-type-x-mandatory for smooth scrolling behavior
 *
 * Features:
 * - Horizontally scrollable on mobile (< 640px)
 * - CSS snap scrolling for smooth experience
 * - WCAG 2.1 AA compliant with proper aria labels
 * - Design System v2.0 tokens applied
 */

const ImmunizationCard = ({ vaccine, status, dueDate, index }) => {
  const statusConfig = {
    completed: {
      icon: Check,
      color: 'var(--color-emerald-600, #059669)',
      bg: 'var(--color-emerald-50, #ecfdf5)',
      label: 'Completed'
    },
    upcoming: {
      icon: Clock,
      color: 'var(--color-warning-600, #d97706)',
      bg: 'var(--color-amber-50, #fffbeb)',
      label: 'Upcoming'
    },
    overdue: {
      icon: AlertCircle,
      color: 'var(--color-red-600, #dc2626)',
      bg: 'var(--color-red-50, #fef2f2)',
      label: 'Overdue'
    },
    missed: {
      icon: X,
      color: 'var(--color-gray-500, #6b7280)',
      bg: 'var(--color-gray-100, #f3f4f6)',
      label: 'Missed'
    },
  };

  const config = statusConfig[status] || statusConfig.upcoming;
  const Icon = config.icon;

  return (
    <div
      className="immunization-card flex-shrink-0 w-72 sm:w-80 p-4 rounded-xl border"
      style={{
        backgroundColor: 'var(--color-background-primary, #ffffff)',
        borderColor: 'var(--color-border, #e5e7eb)',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
      }}
      role="article"
      aria-label={`${vaccine.name} - ${config.label}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2 rounded-lg"
          style={{
            backgroundColor: config.bg,
            color: config.color,
          }}
        >
          <Icon size={20} />
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{
            backgroundColor: config.bg,
            color: config.color,
          }}
        >
          {config.label}
        </span>
      </div>

      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
        {vaccine.name}
      </h3>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        {vaccine.description}
      </p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {vaccine.dose}
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: config.color }}
        >
          {dueDate}
        </span>
      </div>

      {vaccine.age && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Recommended age: {vaccine.age}
        </div>
      )}
    </div>
  );
};

const GuardianImmunizationChart = ({ immunizations = [] }) => {
  // Default mock data if no immunizations provided
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Immunization Schedule
        </h2>
        <button
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--color-warning-600, #d97706)' }}
          onClick={() => window.open('/guardian/immunization-chart', '_self')}
          aria-label="View full immunization chart"
        >
          View Full Chart
        </button>
      </div>

      {/* Horizontal scrollable container with snap scrolling for mobile */}
      <div
        className="immunization-scroll-container flex gap-4 overflow-x-auto pb-4 sm:overflow-visible sm:flex-wrap"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-warning-600, #d97706) transparent',
        }}
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

      {/* Mobile scroll indicator */}
      <div className="sm:hidden flex justify-center mt-2">
        <div className="flex gap-1">
          {data.map((_, index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: index === 0
                  ? 'var(--color-warning-600, #d97706)'
                  : 'var(--color-gray-300, #d1d5db)',
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuardianImmunizationChart;
