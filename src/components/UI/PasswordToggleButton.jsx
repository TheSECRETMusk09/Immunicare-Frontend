import React from "react";
import PropTypes from "prop-types";
import { Eye, EyeOff } from "lucide-react";

const PasswordToggleButton = ({
  visible,
  onToggle,
  disabled = false,
  className = "",
  iconClassName = "h-5 w-5",
  showLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      className={className}
      {...props}
    >
      {visible ? (
        <EyeOff className={iconClassName} aria-hidden="true" />
      ) : (
        <Eye className={iconClassName} aria-hidden="true" />
      )}
    </button>
  );
};

PasswordToggleButton.propTypes = {
  visible: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  showLabel: PropTypes.string,
  hideLabel: PropTypes.string,
};

export default PasswordToggleButton;
