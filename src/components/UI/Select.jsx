import React from "react";

/**
 * Select Component
 * Immuniare Vaccination Management System
 *
 * Standardized dropdown select component
 * - Enhanced padding for better readability
 * - Healthcare color palette with medical blue focus states
 * - Clear error handling with visual feedback
 * - Full dark mode support
 * - Accessible design with proper ARIA attributes
 */
const Select = ({
  label,
  error,
  helpText,
  className = "",
  containerClassName = "",
  surface = "default",
  id,
  required = false,
  children,
  options,
  ...props
}) => {
  const selectId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const selectOptions = Array.isArray(options) ? options : null;

  return (
    <div className={`${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className={`block text-sm font-semibold ${
            surface === "light"
              ? "text-gray-700 dark:text-gray-100"
              : "text-gray-700 dark:text-white"
          } mb-1.5 ${
            required
              ? "after:content-['*'] after:text-danger-500 after:ml-1"
              : ""
          }`}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
          className={`
          w-full rounded-lg border transition-all duration-200
          px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base
          /* Mobile-friendly sizing - prevents zoom on iOS */
          min-h-[48px] sm:min-h-[40px]
          text-base
          ${
            error
              ? "border-danger-300 bg-danger-50 dark:bg-danger-900/20 dark:border-danger-600 focus:ring-danger-500 focus:border-danger-500"
              : surface === "light"
                ? "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-400"
                : surface === "dark"
                  ? "border-gray-600 bg-gray-700 text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                  : "border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          }
          focus:outline-none focus:ring-2 focus:ring-opacity-20
          ${
            surface === "light"
              ? "disabled:bg-gray-100 dark:disabled:bg-gray-700"
              : "disabled:bg-gray-100 dark:disabled:bg-gray-600"
          }
          disabled:cursor-not-allowed
          ${className}
        `}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={
          error
            ? `${selectId}-error`
            : helpText
              ? `${selectId}-help`
              : undefined
        }
        {...props}
      >
        {selectOptions
          ? selectOptions.map((option, index) => (
              <option
                key={`${String(option.value ?? 'option')}-${index}`}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))
          : children}
      </select>
      {helpText && !error && (
        <p
          className={`mt-1.5 text-sm ${
            surface === "light"
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
          id={`${selectId}-help`}
        >
          {helpText}
        </p>
      )}
      {error && (
        <p
          className="mt-1.5 text-sm text-danger-600 dark:text-danger-400"
          id={`${selectId}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default Select;
