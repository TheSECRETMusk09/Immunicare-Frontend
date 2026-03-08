import React from "react";

const Badge = ({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}) => {
  const baseClasses = "inline-flex items-center font-medium rounded-full";

  const variants = {
    default: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]",
    primary: "bg-[var(--theme-primary-light)] text-[var(--theme-primary)]",
    secondary: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]",
    success: "bg-[var(--theme-success-bg)] text-[var(--theme-success)]",
    warning: "bg-[var(--theme-warning-bg)] text-[var(--theme-warning)]",
    error: "bg-[var(--theme-error-bg)] text-[var(--theme-error)]",
    danger: "bg-[var(--theme-error-bg)] text-[var(--theme-error)]",
    info: "bg-[var(--theme-info-bg)] text-[var(--theme-info)]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-0.5 text-sm",
    lg: "px-3 py-1 text-sm",
  };

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;
