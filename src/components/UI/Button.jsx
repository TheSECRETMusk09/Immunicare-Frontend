import React, { Children, cloneElement, isValidElement } from "react";
import ActionSpinner from "./ActionSpinner";

/**
 * Healthcare Form Button Component - Enhanced for Guardian Dashboard
 * Immunicare Vaccination Management System
 *
 * Features:
 * - Healthcare color palette with medical blue primary buttons
 * - Health green success buttons
 * - Danger red buttons for critical actions
 * - Optimized padding for compact layout
 * - Full dark mode support
 * - Accessible design with improved color contrast (WCAG AA)
 * - Consistent hover/focus/click states across all variants
 */
const Button = ({
  children,
  variant = "primary",
  size = "md",
  actionRole,
  leftIcon,
  asChild = false,
  disabled = false,
  loading = false,
  onClick,
  className = "",
  type = "button",
  ...props
}) => {
  // Base classes for all buttons - consistent across all variants
  const baseClasses =
    "inline-flex items-center justify-center font-semibold rounded-lg border border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none cursor-pointer touch-manipulation";

  // Variant classes with improved color contrast for accessibility
  const variants = {
    primary:
      "bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--color-text-inverse)] focus-visible:ring-[var(--theme-primary)]",
    secondary:
      "bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border-default)] focus-visible:ring-[var(--theme-primary)]",
    danger:
      "bg-[var(--color-danger-600)] hover:bg-[var(--color-danger-700)] text-[var(--color-text-inverse)] focus-visible:ring-[var(--color-danger-500)]",
    cancel:
      "bg-red-600 hover:bg-red-700 text-white font-bold focus-visible:ring-red-500",
    success:
      "bg-[var(--color-secondary-600)] hover:bg-[var(--color-secondary-700)] text-[var(--color-text-inverse)] focus-visible:ring-[var(--color-secondary-500)]",
    edit: "bg-[var(--color-secondary-600)] hover:bg-[var(--color-secondary-700)] text-[var(--color-text-inverse)] focus-visible:ring-[var(--color-secondary-500)]",
    outline:
      "border-2 border-[var(--theme-primary)] text-[var(--theme-primary)] bg-transparent hover:bg-[var(--theme-primary-light)] focus-visible:ring-[var(--theme-primary)]",
    headerOutline:
      "border-2 border-white/85 text-white bg-white/10 hover:bg-white/20 hover:border-white focus-visible:ring-white backdrop-blur-sm",
    warning:
      "bg-[var(--color-warning-600)] hover:bg-[var(--color-warning-700)] text-[var(--color-text-inverse)] focus-visible:ring-[var(--color-warning-500)]",
    info: "bg-[var(--color-info-600)] hover:bg-[var(--color-info-700)] text-[var(--color-text-inverse)] focus-visible:ring-[var(--color-info-500)]",
    ghost:
      "text-[var(--color-text-primary)] bg-transparent hover:bg-[var(--color-bg-secondary)] focus-visible:ring-[var(--theme-primary)]",
  };

  // Compact size classes for Guardian Dashboard
  const sizes = {
    xs: "px-2.5 py-1.5 text-xs gap-1.5 h-8 min-h-[32px]",
    sm: "px-3 py-2 text-sm gap-1.5 h-9 min-h-[36px]",
    md: "px-4 py-2 text-sm gap-2 h-10 min-h-[40px]",
    lg: "px-5 py-2.5 text-sm gap-2 h-11 min-h-[44px]",
    xl: "px-6 py-3 text-base gap-2 h-12 min-h-[48px]",
  };

  const formActionPadding =
    "ui-form-action-btn:px-4 ui-form-action-btn:py-2.5 ui-form-action-btn:h-auto ui-form-action-btn:min-h-[44px]";

  const actionRoleClass =
    actionRole === "primary"
      ? "form-action--primary"
      : actionRole === "cancel"
        ? "form-action--cancel"
        : "";

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${formActionPadding} ${actionRoleClass} ${className}`;
  const content = (
    <>
      {!loading && leftIcon ? leftIcon : null}
      {loading && <ActionSpinner size="md" className="-ml-0.5 mr-2" />}
      {asChild && isValidElement(children) ? children.props.children : children}
    </>
  );

  if (asChild && isValidElement(children)) {
    const child = Children.only(children);
    const handleChildClick = (event) => {
      if (disabled || loading) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      child.props.onClick?.(event);
      onClick?.(event);
    };

    return cloneElement(child, {
      ...props,
      className: `${classes} ${child.props.className || ""}`.trim(),
      onClick: handleChildClick,
      "aria-busy": loading || undefined,
      "aria-disabled": disabled || loading || undefined,
      tabIndex:
        disabled || loading
          ? -1
          : child.props.tabIndex,
      children: content,
    });
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
};

export default Button;
