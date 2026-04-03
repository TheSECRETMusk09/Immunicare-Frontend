import React from "react";

/**
 * Healthcare Form TextArea Component
 * Immunicare Vaccination Management System
 *
 * Features:
 * - Enhanced padding for better readability
 * - Healthcare color palette with medical blue focus states
 * - Clear error handling with visual feedback
 * - Full dark mode support
 * - Accessible design with proper ARIA attributes
 * - Resizable textarea with minimum height
 * - Character count display for validation feedback
 */
const TextArea = ({
  label,
  error,
  helpText,
  className = "",
  containerClassName = "",
  surface = "default",
  rows = 4,
  maxLength,
  showCount = false,
  required = false,
  ...props
}) => {
  const inputId = label ? label.toLowerCase().replace(/\s+/g, "-") : undefined;
  const [charCount, setCharCount] = React.useState(0);

  const handleChange = (e) => {
    setCharCount(e.target.value.length);
    if (props.onChange) {
      props.onChange(e);
    }
  };

  return (
    <div className={`${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-semibold ${
            surface === "light" ? "text-gray-800" : "text-gray-800 dark:text-white"
          } mb-1.5 ${
            required
              ? "after:content-['*'] after:text-danger-500 after:ml-1"
              : ""
          }`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          id={inputId}
          rows={rows}
          maxLength={maxLength}
          onChange={handleChange}
          className={`
            w-full rounded-lg border transition-all duration-200
            px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base
            min-h-[48px] sm:min-h-[40px] resize-y
            ${error
              ? "border-danger-300 bg-danger-50 dark:bg-danger-900/20 dark:border-danger-600 focus:ring-danger-500 focus:border-danger-500"
              : surface === "light"
                ? "border-gray-300 bg-white text-gray-900 focus:ring-primary-500 focus:border-primary-500"
                : surface === "dark"
                  ? "border-gray-600 bg-gray-700 text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                  : "border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
            }
            focus:outline-none focus:ring-2 focus:ring-opacity-20
            ${
              surface === "light"
                ? "disabled:bg-gray-100"
                : "disabled:bg-gray-100 dark:disabled:bg-gray-600"
            }
            disabled:cursor-not-allowed
            ${
              surface === "light"
                ? "placeholder:text-gray-400"
                : surface === "dark"
                  ? "placeholder:text-gray-500"
                  : "placeholder:text-gray-400 dark:placeholder:text-gray-500"
            }
            ${className}
          `}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helpText
                ? `${inputId}-help`
                : undefined
          }
          {...props}
        />
        {showCount && maxLength && (
          <span className={`absolute bottom-2 right-2 text-xs ${
            charCount > maxLength * 0.9
              ? "text-warning-500"
              : charCount >= maxLength
                ? "text-danger-500"
                : "text-gray-400"
          }`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      {helpText && !error && (
        <p
          className={`mt-1.5 text-sm ${
            surface === "light" ? "text-gray-500" : "text-gray-500 dark:text-gray-400"
          }`}
          id={`${inputId}-help`}
        >
          {helpText}
        </p>
      )}
      {error && (
        <p
          className="mt-1.5 text-sm text-danger-600 dark:text-danger-400"
          id={`${inputId}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default TextArea;
