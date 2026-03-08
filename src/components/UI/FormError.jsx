/**
 * FormError Component
 * WCAG 2.1 AA compliant error messaging with screen reader support
 *
 * Features:
 * - Associates errors with form fields using aria-describedby
 * - Live region announcements for dynamic error updates
 * - High contrast visual indicators
 * - Icon support for visual recognition
 */

import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";

const FormError = ({
  id,
  message,
  className = "",
  showIcon = true,
  role = "alert",
  "aria-live": ariaLive = "polite",
  fieldId,
  onAnnounce,
}) => {
  const announceRef = useRef(null);

  // Announce error to screen readers when message changes
  useEffect(() => {
    if (message && onAnnounce) {
      onAnnounce(message);
    }
  }, [message, onAnnounce]);

  if (!message) return null;

  const errorId = id || (fieldId ? `${fieldId}-error` : undefined);

  return (
    <div
      id={errorId}
      role={role}
      aria-live={ariaLive}
      className={`flex items-start gap-2 mt-1.5 text-sm ${className}`}
      data-testid="form-error"
    >
      {showIcon && (
        <svg
          className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="text-red-700 dark:text-red-300 font-medium">
        {message}
      </span>
      {/* Hidden live region for screen reader announcements */}
      <span ref={announceRef} className="sr-only" aria-live="assertive">
        {message}
      </span>
    </div>
  );
};

FormError.propTypes = {
  id: PropTypes.string,
  message: PropTypes.string,
  className: PropTypes.string,
  showIcon: PropTypes.bool,
  role: PropTypes.string,
  "aria-live": PropTypes.oneOf(["off", "polite", "assertive"]),
  fieldId: PropTypes.string,
  onAnnounce: PropTypes.func,
};

/**
 * FormErrorSummary Component
 * Displays a summary of all form errors for better accessibility
 */
export const FormErrorSummary = ({
  errors,
  title = "Please correct the following errors:",
  className = "",
}) => {
  if (!errors || Object.keys(errors).length === 0) return null;

  const errorEntries = Object.entries(errors).filter(([, value]) => value);

  if (errorEntries.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20 ${className}`}
      data-testid="form-error-summary"
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            {title}
          </h3>
          <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                <a
                  href={`#${field}`}
                  className="underline hover:text-red-900 dark:hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(field)?.focus();
                  }}
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

FormErrorSummary.propTypes = {
  errors: PropTypes.object,
  title: PropTypes.string,
  className: PropTypes.string,
};

/**
 * FieldError Component
 * Simple inline error for a single field
 */
export const FieldError = ({ message, id }) => {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  );
};

FieldError.propTypes = {
  message: PropTypes.string,
  id: PropTypes.string.isRequired,
};

export default FormError;
