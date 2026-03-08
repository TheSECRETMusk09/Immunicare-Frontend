import React from "react";

/**
 * PageContainer Component
 * Immuniare Vaccination Management System
 *
 * Standardized content container for page content
 * - Consistent background: bg-white dark:bg-gray-800
 * - Consistent border radius: rounded-xl
 * - Consistent shadow: shadow-sm
 * - Optional header and footer
 */
const PageContainer = ({
  children,
  title,
  header,
  footer,
  className = "",
  noPadding = false,
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>
      )}
      {header && header}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          {footer}
        </div>
      )}
    </div>
  );
};

export default PageContainer;
