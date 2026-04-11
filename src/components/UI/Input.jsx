import React, { useState } from "react";
import PasswordToggleButton from "./PasswordToggleButton";
import PortalDatePicker from "./PortalDatePicker";

/**
 * Healthcare Form Input Component
 * Immunicare Vaccination Management System
 *
 * Features:
 * - Enhanced padding for better readability
 * - Healthcare color palette with medical blue focus states
 * - Clear error handling with visual feedback
 * - Full dark mode support
 * - Accessible design with proper ARIA attributes
 */
const Input = ({
  label,
  error,
  helpText,
  className = "",
  containerClassName = "",
  surface = "default",
  showPasswordToggle = true,
  showPassword: controlledShowPassword,
  onToggleVisibility,
  showPasswordAriaLabel = "Show password",
  hidePasswordAriaLabel = "Hide password",
  icon: Icon,
  id,
  required = false,
  type = "text",
  textarea = false,
  ...props
}) => {
  const [internalShowPassword, setInternalShowPassword] = useState(false);

  if (type === "date") {
    return (
      <PortalDatePicker
        label={label}
        error={error}
        helpText={helpText}
        className={className}
        containerClassName={containerClassName}
        required={required}
        id={id}
        {...props}
      />
    );
  }

  const isPassword = type === "password";
  const showPassword =
    controlledShowPassword !== undefined
      ? controlledShowPassword
      : internalShowPassword;
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const togglePasswordVisibility = () => {
    const nextVisible = !showPassword;
    if (onToggleVisibility) {
      onToggleVisibility(nextVisible);
    } else {
      setInternalShowPassword(nextVisible);
    }
  };

  // Calculate appropriate padding based on icon and password toggle presence
  const getPaddingClass = () => {
    const basePadding = "py-2.5 sm:py-2 text-sm sm:text-base";

    if (Icon && isPassword) {
      return `${basePadding} pl-10 pr-14`;
    } else if (Icon) {
      return `${basePadding} pl-10 pr-4`;
    } else if (isPassword) {
      return `${basePadding} px-4 pr-14`;
    }

    return `${basePadding} px-3 sm:px-4`;
  };

  const inputClasses = `
    w-full rounded-lg border transition-all duration-200
    ${getPaddingClass()}
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
    ${
      surface === "light"
        ? "placeholder:text-gray-400 dark:placeholder:text-gray-500"
        : surface === "dark"
          ? "placeholder:text-gray-500"
          : "placeholder:text-gray-400 dark:placeholder:text-gray-500"
    }
    ${className}
  `;

  return (
    <div className={`${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-semibold ${
            surface === "light"
              ? "text-gray-800 dark:text-gray-100"
              : "text-gray-800 dark:text-white"
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
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        {textarea ? (
          <textarea
            id={inputId}
            className={inputClasses}
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
        ) : (
          <input
            id={inputId}
            type={isPassword ? (showPassword ? "text" : "password") : type}
            className={inputClasses}
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
        )}
        {showPasswordToggle && isPassword && (
          <PasswordToggleButton
            visible={showPassword}
            onToggle={togglePasswordVisibility}
            disabled={props.disabled}
            showLabel={showPasswordAriaLabel}
            hideLabel={hidePasswordAriaLabel}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors min-w-[40px] min-h-[40px] touch-target p-2 rounded-md bg-transparent hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-pointer z-50"
            style={{
              visibility: "visible",
              opacity: 1,
              zIndex: 50,
              right: "8px",
            }}
          />
        )}
      </div>
      {helpText && !error && (
        <p
          className={`mt-1.5 text-sm ${
            surface === "light"
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-500 dark:text-gray-400"
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

export default Input;
