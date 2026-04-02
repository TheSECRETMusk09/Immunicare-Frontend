import React from "react";

/**
 * PageHeader Component - Standardized UI Component
 * Immunicare Vaccination Management System
 *
 * Features:
 * - Consistent sizing across desktop, tablet, and mobile
 * - Standardized gradient background
 * - Responsive padding and typography
 * - Glassmorphism support
 * - Optional action buttons
 * - Icon support: component reference, JSX element, or string (emoji)
 *
 * Standards:
 * - Desktop (>=1024px): padding 24px 32px, title 28px
 * - Tablet (768-1023px): padding 20px 24px, title 24px
 * - Mobile (<768px): padding 16px 20px, title 20px
 */
const PageHeader = ({ title, subtitle, actions, icon, className = "", glassmorphism = false }) => {
  const getStandardIconClassName = (existingClassName = "") =>
    `${existingClassName} w-6 h-6 sm:w-8 sm:h-8`.trim();

  // Render icon based on its type
  const renderIcon = () => {
    if (!icon) return null;

    // If icon is a string (e.g., emoji), render it directly
    if (typeof icon === "string") {
      return (
        <div className="page-header__icon text-xl sm:text-2xl">
          <span>{icon}</span>
        </div>
      );
    }

    // If icon is a React element (JSX), clone it with consistent styling
    if (React.isValidElement(icon)) {
      const existingClassName =
        typeof icon.props?.className === "string" ? icon.props.className : "";

      return (
        <div className="page-header__icon text-xl sm:text-2xl">
          {React.cloneElement(icon, {
            className: getStandardIconClassName(existingClassName),
          })}
        </div>
      );
    }

    // If icon is a component reference (function/class), render it
    if (typeof icon === "function") {
      const IconComponent = icon;
      return (
        <div className="page-header__icon text-xl sm:text-2xl">
          <IconComponent className={getStandardIconClassName()} />
        </div>
      );
    }

    return null;
  };

  // Base classes with violet gradient background - consistent across all modules
  const baseClasses = glassmorphism !== false
    ? "page-header glassmorphism-header"
    : "page-header";

  // Violet gradient background class - applied to all page headers
  const gradientClasses = "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700";

  return (
    <header
      className={`${baseClasses} ${gradientClasses} rounded-xl sm:rounded-2xl text-white shadow-lg w-full ${className}`}
      role="banner"
      aria-label={`${title} page header`}
    >
      <div className="page-header__container px-4 py-4 min-[768px]:px-6 min-[768px]:py-5 min-[1025px]:px-8 min-[1025px]:py-6">
        <div className="page-header__content flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-start min-[768px]:justify-between min-[768px]:gap-4">
          <div className="page-header__main flex items-start gap-3 min-w-0">
            {renderIcon()}
            <div className="page-header__text min-w-0">
              <h2 className="page-header__title text-lg min-[768px]:text-xl min-[1025px]:text-2xl font-bold break-words leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="page-header__subtitle text-sm min-[768px]:text-base text-white/80 break-words leading-relaxed">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div
              className="page-header__actions flex w-full flex-wrap items-center gap-2 rounded-xl bg-white/15 px-2.5 py-2 shadow-lg ring-1 ring-white/30 backdrop-blur-sm text-white min-[768px]:w-auto min-[768px]:justify-end min-[768px]:gap-3 dark:bg-gray-900/30"
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
