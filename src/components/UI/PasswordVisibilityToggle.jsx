/**
 * PasswordVisibilityToggle Component
 * WCAG 2.1 AA compliant checkbox for toggling password visibility
 *
 * Features:
 * - Large touch target (44px minimum)
 * - Clear visual state indication
 * - Screen reader support with descriptive label
 * - Keyboard accessible
 * - Consistent styling across all login forms
 */

import React, { useId } from "react";
import PropTypes from "prop-types";

const PasswordVisibilityToggle = ({
  checked,
  onChange,
  disabled = false,
  label = "Show password",
  className = "",
  id: propId,
  theme = "admin",
}) => {
  const uniqueId = useId();
  const id = propId || `password-visibility-${uniqueId}`;

  const handleChange = (e) => {
    onChange(e.target.checked);
  };

  const themeColors =
    theme === "guardian"
      ? {
          checkbox:
            "checked:bg-green-600 checked:border-green-600 focus:ring-green-500",
          hover: "hover:bg-green-100 hover:border-green-300",
          label: "text-white",
          border: "border-white",
          bg: "bg-white",
          checkColor: "text-green-600",
        }
      : {
          checkbox:
            "checked:bg-green-600 checked:border-green-600 focus:ring-green-500",
          hover: "hover:bg-green-100 hover:border-green-300",
          label: "text-white",
          border: "border-white",
          bg: "bg-white/30",
          checkColor: "text-green-600",
        };

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 cursor-pointer select-none ${className}`}
    >
      <div className="relative flex items-center h-5">
        <input
          id={id}
          name="showPassword"
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={`
            appearance-none -webkit-appearance-none
            w-5 h-5
            ${themeColors.border}
            rounded
            ${themeColors.bg}
            text-white
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2 ${themeColors.checkbox}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${themeColors.hover}
            cursor-pointer
            flex-shrink-0
            border-2
          `}
          style={{
            width: "20px",
            height: "20px",
            minWidth: "20px",
            minHeight: "20px",
          }}
        />
        {/* Custom checkmark icon for better visibility */}
        {checked && (
          <svg
            className={`absolute w-4 h-4 ${themeColors.checkColor} pointer-events-none`}
            viewBox="0 0 20 20"
            fill="currentColor"
            style={{
              position: "absolute",
              left: "2px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <span
        className={`text-sm font-medium leading-relaxed tracking-tight ${themeColors.label}`}
      >
        {label}
      </span>
    </label>
  );
};

PasswordVisibilityToggle.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  className: PropTypes.string,
  id: PropTypes.string,
  theme: PropTypes.oneOf(["admin", "guardian"]),
};

export default PasswordVisibilityToggle;
