/**
 * PasswordInput Component
 * WCAG 2.1 AA compliant password input with visibility toggle
 *
 * Features:
 * - Secure password input with visibility toggle
 * - Screen reader announcements for visibility state changes
 * - Clear focus indicators
 * - Password strength indicator (optional)
 * - Minimum 44px touch targets
 */

import React, { useState, useRef, useEffect, useId, memo } from "react";
import PropTypes from "prop-types";
import FormError from "./FormError";
import PasswordToggleButton from "./PasswordToggleButton";

const PasswordInput = memo(function PasswordInput(props) {
  const {
    label,
    name = "password",
    value,
    onChange,
    onBlur,
    error,
    placeholder = "Enter your password",
    required = false,
    disabled = false,
    autoComplete = "current-password",
    showStrengthIndicator = false,
    className = "",
    containerClassName = "",
    id: propId,
    "aria-describedby": ariaDescribedBy,
    theme = "admin",
    showPassword: externalShowPassword,
    onToggleVisibility,
    showPasswordAriaLabel = "Show password",
    hidePasswordAriaLabel = "Hide password",
    ...rest
  } = props;

  const [internalShowPassword, setInternalShowPassword] = useState(false);

  // Use external showPassword if provided, otherwise use internal state
  const showPassword =
    externalShowPassword !== undefined
      ? externalShowPassword
      : internalShowPassword;
  const [strength, setStrength] = useState(0);
  const [announcedText, setAnnouncedText] = useState("");
  const inputRef = useRef(null);
  const uniqueId = useId();
  const id = propId || `password-${uniqueId}`;
  const errorId = `${id}-error`;
  const strengthId = `${id}-strength`;

  // Calculate password strength
  useEffect(() => {
    if (!showStrengthIndicator || !value) {
      setStrength(0);
      return;
    }

    let score = 0;
    if (value.length >= 8) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) score++;
    setStrength(score);
  }, [value, showStrengthIndicator]);

  // Announce visibility changes to screen readers
  const toggleVisibility = () => {
    const newState = !showPassword;
    setAnnouncedText(
      newState ? "Password is now visible" : "Password is now hidden",
    );

    // If external control is provided, use it; otherwise use internal state
    if (onToggleVisibility) {
      onToggleVisibility(newState);
    } else {
      setInternalShowPassword(newState);
    }
  };

  // Get theme-specific colors
  const getThemeColors = () => {
    return theme === "guardian"
      ? {
          focusRing: "focus:ring-orange-500 focus:border-orange-500",
          buttonHover: "hover:text-orange-600 dark:hover:text-orange-400",
          iconColor: "text-gray-700 dark:text-gray-100",
          iconSize: "w-5 h-5",
        }
      : {
          focusRing: "focus:ring-blue-600 focus:border-blue-600",
          buttonHover: "hover:text-blue-600 dark:hover:text-blue-400",
          iconColor: "text-gray-700 dark:text-gray-100",
          iconSize: "w-5 h-5",
        };
  };

  const themeColors = getThemeColors();

  // Get strength label and color
  const getStrengthInfo = () => {
    const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-blue-500",
      "bg-green-500",
    ];
    return { label: labels[strength], color: colors[strength] };
  };

  const strengthInfo = getStrengthInfo();

  const describedByIds =
    [
      error ? errorId : null,
      showStrengthIndicator && value ? strengthId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

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
      <div className="relative w-full">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
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
             w-full px-4 py-4 pr-14
             border rounded-lg
             text-base
             bg-white dark:bg-white
             border-gray-300 dark:border-gray-300
             placeholder-gray-500 dark:placeholder-gray-500
             text-gray-900 dark:text-gray-900
             transition-all duration-200
             focus:outline-none focus:ring-2 ${themeColors.focusRing}
             disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100
             ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""}
             min-h-[48px] touch-target min-w-0
             ${className}
           `}
          style={{ minHeight: "48px" }} // WCAG 2.5.5 Target Size
          {...rest}
        />
        {/* Always show the eye toggle button - with enhanced visibility styles */}
        <PasswordToggleButton
          visible={showPassword}
          onToggle={toggleVisibility}
          disabled={disabled}
          showLabel={showPasswordAriaLabel}
          hideLabel={hidePasswordAriaLabel}
          iconClassName={`w-6 h-6 ${themeColors.iconColor}`}
           className={`
             absolute right-1 top-1/2 -translate-y-1/2
             p-2 rounded-lg
             ${themeColors.buttonHover}
             ${themeColors.iconColor}
             focus:outline-none focus:ring-2 focus:ring-offset-1 ${themeColors.focusRing}
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors duration-150
             min-w-[40px] min-h-[40px]
             flex items-center justify-center
             bg-transparent dark:bg-gray-700/30
             hover:bg-gray-100 dark:hover:bg-gray-600
             z-50
             cursor-pointer
            visible
            opacity-100
          `}
          style={{
            visibility: "visible",
            opacity: 1,
            zIndex: 50,
            right: "8px",
          }}
        />
      </div>

      {/* Password Strength Indicator */}
      {showStrengthIndicator && value && (
        <div id={strengthId} className="mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${strengthInfo.color} transition-all duration-300`}
                style={{ width: `${((strength + 1) / 5) * 100}%` }}
                role="progressbar"
                aria-valuenow={strength + 1}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-label={`Password strength: ${strengthInfo.label}`}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px]">
              {strengthInfo.label}
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      <FormError id={errorId} message={error} fieldId={id} aria-live="polite" />

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcedText}
      </div>
    </div>
  );
});

PasswordInput.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  error: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  autoComplete: PropTypes.string,
  showStrengthIndicator: PropTypes.bool,
  className: PropTypes.string,
  containerClassName: PropTypes.string,
  id: PropTypes.string,
  "aria-describedby": PropTypes.string,
  theme: PropTypes.oneOf(["admin", "guardian"]),
  showPassword: PropTypes.bool,
  onToggleVisibility: PropTypes.func,
  showPasswordAriaLabel: PropTypes.string,
  hidePasswordAriaLabel: PropTypes.string,
};

export default PasswordInput;
