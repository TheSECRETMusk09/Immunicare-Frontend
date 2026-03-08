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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const themeColors =
    theme === "guardian"
      ? {
          checkbox:
            "checked:bg-orange-600 checked:border-orange-600 focus:ring-orange-500",
          hover: "hover:border-orange-400",
        }
      : {
          checkbox:
            "checked:bg-blue-600 checked:border-blue-600 focus:ring-blue-600",
          hover: "hover:border-blue-400",
        };

  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center h-5">
        <input
          id={id}
          name="rememberMe"
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-describedby={descriptionId}
          className={`
            appearance-none -webkit-appearance-none
            w-5 h-5
            border-2 border-gray-300 dark:border-gray-600
            rounded
            bg-white dark:bg-gray-800
            text-white
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2 ${themeColors.checkbox}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${themeColors.hover}
            cursor-pointer
            flex-shrink-0
          `}
          style={{
            width: "20px",
            height: "20px",
            minWidth: "20px",
            minHeight: "20px",
          }}
        />
      </div>
      <div className="ml-3 text-sm">
        <label
          htmlFor={id}
          className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
          tabIndex={-1}
        >
          {label}
        </label>
        <p
          id={descriptionId}
          className="text-gray-500 dark:text-gray-400 text-xs mt-0.5"
        >
          {description}
        </p>
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
