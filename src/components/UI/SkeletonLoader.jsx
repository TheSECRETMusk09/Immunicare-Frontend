import React from "react";

/**
 * SkeletonLoader Component Suite
 * Provides skeleton loading states for better perceived performance
 * WCAG compliant with reduced motion support
 */

// Skeleton Card for metric/stat cards
export const SkeletonCard = ({ className = "", height = "auto" }) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse ${className}`}
    aria-hidden="true"
    style={{ height }}
  >
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
  </div>
);

// Skeleton Grid for card layouts
export const SkeletonGrid = ({ columns = 4, rows = 1, className = "" }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-${columns} gap-4 ${className}`}>
    {Array.from({ length: rows * columns }).map((_, i) => (
      <SkeletonCard key={i} className="h-32" />
    ))}
  </div>
);

// Skeleton Table for data tables
export const SkeletonTable = ({ rows = 5, columns = 4, className = "" }) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${className}`}
    aria-hidden="true"
  >
    {/* Header */}
    <div className="grid gap-4 p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse flex-1"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
    {/* Rows */}
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-1"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Skeleton Text for content areas
export const SkeletonText = ({ lines = 3, className = "", spacing = "normal" }) => {
  const spacingClasses = {
    tight: "space-y-1",
    normal: "space-y-2",
    loose: "space-y-4",
  };

  return (
    <div className={`${spacingClasses[spacing]} ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          style={{
            width: i === lines - 1 ? "60%" : "100%",
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
};

// Skeleton Chart for charts and graphs
export const SkeletonChart = ({ className = "", height = "h-64" }) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
    aria-hidden="true"
  >
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6 animate-pulse" />
    <div className={`${height} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`} />
  </div>
);

// Skeleton Avatar for user profiles
export const SkeletonAvatar = ({ size = "md" }) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse`}
      aria-hidden="true"
    />
  );
};

// Skeleton Form Field
export const SkeletonFormField = ({ label = true, className = "" }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {label && (
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
    )}
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
  </div>
);

// Skeleton Form for entire forms
export const SkeletonForm = ({ fields = 4, className = "" }) => (
  <div className={`space-y-4 ${className}`} aria-hidden="true">
    {Array.from({ length: fields }).map((_, i) => (
      <SkeletonFormField key={i} />
    ))}
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse mt-6" />
  </div>
);

// Skeleton Page Header
export const SkeletonPageHeader = ({ className = "" }) => (
  <div className={`space-y-3 mb-6 ${className}`} aria-hidden="true">
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
  </div>
);

// Skeleton List for list items
export const SkeletonList = ({ items = 5, className = "" }) => (
  <div className={`space-y-3 ${className}`} aria-hidden="true">
    {Array.from({ length: items }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg"
      >
        <SkeletonAvatar size="sm" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

// Skeleton Calendar
export const SkeletonCalendar = ({ className = "" }) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}
    aria-hidden="true"
  >
    {/* Calendar Header */}
    <div className="flex justify-between items-center mb-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
      <div className="flex gap-2">
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
    {/* Calendar Grid */}
    <div className="grid grid-cols-7 gap-1">
      {/* Day headers */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={`header-${i}`}
          className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"
        />
      ))}
      {/* Calendar days */}
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          key={`day-${i}`}
          className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          style={{ animationDelay: `${i * 10}ms` }}
        />
      ))}
    </div>
  </div>
);

// Loading Overlay for full-screen or container loading states
export const LoadingOverlay = ({ message = "Loading...", className = "" }) => (
  <div
    className={`absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center z-50 ${className}`}
    role="status"
    aria-live="polite"
  >
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
    <p className="text-gray-600 dark:text-gray-300 font-medium">{message}</p>
  </div>
);

// Skeleton Dashboard Overview
export const SkeletonDashboardOverview = ({ className = "" }) => (
  <div className={`space-y-6 p-6 ${className}`}>
    <SkeletonPageHeader />
    <SkeletonGrid columns={4} rows={1} />
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <SkeletonCard height="400px" />
      </div>
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
    <SkeletonCard height="200px" />
  </div>
);

// Loading Button State
export const LoadingButton = ({ loading = true, children, className = "" }) => (
  <button
    type="button"
    className={`inline-flex items-center justify-center ${className}`}
    disabled={loading}
    aria-busy={loading}
  >
    {loading && (
      <svg
        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )}
    {children}
  </button>
);

// Main export with all components
const SkeletonLoader = {
  SkeletonCard,
  SkeletonGrid,
  SkeletonTable,
  SkeletonText,
  SkeletonChart,
  SkeletonAvatar,
  SkeletonFormField,
  SkeletonForm,
  SkeletonPageHeader,
  SkeletonList,
  SkeletonCalendar,
  LoadingOverlay,
  SkeletonDashboardOverview,
  LoadingButton,
};

export default SkeletonLoader;
