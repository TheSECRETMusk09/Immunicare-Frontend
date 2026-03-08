import React from "react";

/**
 * LoadingFallback Component
 * Accessible loading indicator with ARIA attributes
 * Used as fallback for React.lazy loaded components
 */
const LoadingFallback = ({ message = "Loading..." }) => {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="flex flex-col items-center space-y-4">
        <div
          className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-gray-600 dark:text-gray-400 font-medium">
          {message}
        </p>
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
};

export default LoadingFallback;
