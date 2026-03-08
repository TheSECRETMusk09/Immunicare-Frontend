/**
 * RememberMeCheckbox Component
 * WCAG 2.1 AA compliant checkbox for "Remember Me" functionality
 *
 * Features:
 * - Large touch target (44px minimum)
 * - Clear visual state indication
 * - Screen reader support with descriptive label
 * - Keyboard accessible
 */

import React, { useId } from "react";
import PropTypes from "prop-types";

const RememberMeCheckbox = ({
  checked,
  onChange,
  disabled = false,
  label = "Remember me",
  description = "Stay signed in on this device",
  className = "",
  id: propId,
  theme = "admin",
}) => {
  const uniqueId = useId();
  const id = propId || `remember-me-${uniqueId}`;
  const descriptionId = `${id}-description`;

  const handleChange = (e) => {
    onChange(e.target.checked);
  };

  const themeColors =
    theme === "guardian"
      ? {
          checkbox:
            "accent-amber-400 border-white/40 bg-white/10 focus:ring-amber-300/80",
          hover: "hover:border-amber-300",
          label: "text-white/90",
          description: "text-white/60",
        }
      : {
          checkbox:
            "accent-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-blue-600",
          hover: "hover:border-blue-400",
          label: "text-gray-700 dark:text-gray-300",
          description: "text-gray-500 dark:text-gray-400",
        };

  return (
    <div className={`remember-me-checkbox flex items-start gap-2.5 ${className}`}>
      <div className="remember-me-checkbox-control flex items-center justify-center mt-0.5 flex-shrink-0">
        <input
          id={id}
          name="rememberMe"
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
          data-remember-me-checkbox="true"
          className={`
            remember-me-checkbox-input
            h-[18px] w-[18px] rounded-[4px] border
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2
            focus:ring-offset-transparent
            ${themeColors.checkbox}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${themeColors.hover}
            cursor-pointer
            flex-shrink-0
          `}
        />
      </div>
      <div className="remember-me-checkbox-content min-w-0 text-sm leading-tight">
        <label
          htmlFor={id}
          className={`remember-me-checkbox-label font-medium cursor-pointer select-none ${themeColors.label}`}
          tabIndex={-1}
        >
          {label}
        </label>
        {description && (
          <p
            id={descriptionId}
            className={`remember-me-checkbox-description text-xs mt-1 ${themeColors.description}`}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

RememberMeCheckbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  description: PropTypes.string,
  className: PropTypes.string,
  id: PropTypes.string,
  theme: PropTypes.oneOf(["admin", "guardian"]),
};

export default RememberMeCheckbox;
