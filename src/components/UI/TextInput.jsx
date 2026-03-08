/**
 * TextInput Component
 * WCAG 2.1 AA compliant text input with validation support
 *
 * Features:
 * - Clear labeling and error association
 * - Focus indicators
 * - Screen reader support
 * - Touch target optimization (48px min height)
 * - Real-time validation support
 * - Password visibility toggle (for password type)
 */

import React, { useId, memo, useState } from "react";
import PropTypes from "prop-types";
import FormError from "./FormError";
import PasswordToggleButton from "./PasswordToggleButton";

const TextInput = memo(
  ({
    label,
    name,
    value,
    onChange,
    onBlur,
    error,
    placeholder,
    required = false,
    disabled = false,
    autoComplete,
    type = "text",
    className = "",
    containerClassName = "",
    id: propId,
    "aria-describedby": ariaDescribedBy,
    theme = "admin",
    icon: Icon,
    helpText,
    showPasswordToggle = true,
    showPassword: controlledShowPassword,
    onToggleVisibility,
    showPasswordAriaLabel = "Show password",
    hidePasswordAriaLabel = "Hide password",
    ...props
  }) => {
    const uniqueId = useId();
    const id = propId || `input-${uniqueId}`;
    const errorId = `${id}-error`;
    const helpId = `${id}-help`;

    const isPassword = type === "password";
    const [internalShowPassword, setInternalShowPassword] = useState(false);
    const showPassword =
      controlledShowPassword !== undefined
        ? controlledShowPassword
        : internalShowPassword;

    const togglePasswordVisibility = () => {
      const nextVisible = !showPassword;
      if (onToggleVisibility) {
        onToggleVisibility(nextVisible);
      } else {
        setInternalShowPassword(nextVisible);
      }
    };

    const themeColors =
      theme === "guardian"
        ? {
            focusRing:
              "focus:ring-[var(--theme-warning)] focus:border-[var(--theme-warning)]",
            iconColor: "text-[var(--theme-warning)]",
          }
        : {
            focusRing:
              "focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)]",
            iconColor: "text-[var(--theme-primary)]",
          };

    const describedByIds =
      [error ? errorId : null, helpText ? helpId : null, ariaDescribedBy]
        .filter(Boolean)
        .join(" ") || undefined;

    // Calculate appropriate padding based on icon and password toggle presence
    const getPaddingClass = () => {
      const baseClasses =
        "w-full px-4 py-4 border rounded-lg text-base bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-[var(--color-border-default)] placeholder-[var(--color-text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 min-w-0";

      if (Icon && isPassword && showPasswordToggle) {
        return `${baseClasses} pl-10 pr-14`;
      } else if (Icon) {
        return `${baseClasses} pl-10 pr-4`;
      } else if (isPassword && showPasswordToggle) {
        return `${baseClasses} px-4 pr-14`;
      }

      return `${baseClasses} px-4`;
    };

    return (
      <div className={`space-y-1 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-gray-800 dark:text-white"
          >
            {label}
            {required && (
              <span
                className="text-danger-500 ml-1"
                aria-hidden="true"
              >
                *
              </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon
                className={`h-5 w-5 ${themeColors.iconColor}`}
                aria-hidden="true"
              />
            </div>
          )}
          <input
            id={id}
            name={name}
            type={isPassword && showPassword ? "text" : type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            autoComplete={autoComplete}
            placeholder={placeholder}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedByIds}
            aria-required={required}
            className={`
              ${getPaddingClass()}
              ${themeColors.focusRing}
              disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-tertiary)]
              ${error ? "border-[var(--theme-error)] focus:ring-[var(--theme-error)] focus:border-[var(--theme-error)]" : ""}
              min-h-[48px] touch-target
              ${className}
            `}
            style={{ minHeight: "48px" }}
            {...props}
          />
          {/* Password Visibility Toggle */}
          {isPassword && showPasswordToggle && (
            <PasswordToggleButton
              visible={showPassword}
              onToggle={togglePasswordVisibility}
              disabled={disabled}
              showLabel={showPasswordAriaLabel}
              hideLabel={hidePasswordAriaLabel}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors min-w-[40px] min-h-[40px] touch-target p-2 rounded-md bg-transparent hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] cursor-pointer z-50"
              style={{
                visibility: "visible",
                opacity: 1,
                zIndex: 50,
                right: "8px",
              }}
            />
          )}
        </div>

        {helpText && (
          <p
            id={helpId}
            className="text-xs text-[var(--color-text-secondary)] mt-1"
          >
            {helpText}
          </p>
        )}

        <FormError
          id={errorId}
          message={error}
          fieldId={id}
          aria-live="polite"
        />
      </div>
    );
  },
);

TextInput.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  error: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  autoComplete: PropTypes.string,
  type: PropTypes.string,
  className: PropTypes.string,
  containerClassName: PropTypes.string,
  id: PropTypes.string,
  "aria-describedby": PropTypes.string,
  theme: PropTypes.oneOf(["admin", "guardian"]),
  icon: PropTypes.elementType,
  helpText: PropTypes.string,
  showPasswordToggle: PropTypes.bool,
  showPassword: PropTypes.bool,
  onToggleVisibility: PropTypes.func,
  showPasswordAriaLabel: PropTypes.string,
  hidePasswordAriaLabel: PropTypes.string,
};

export default TextInput;
