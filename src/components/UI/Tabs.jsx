import React, { useCallback } from "react";

/**
 * Tabs component - A tabbed navigation component
 * @param {Object} props
 * @param {string} props.activeTab - The currently active tab ID
 * @param {Function} props.onTabChange - Callback when tab changes
 * @param {React.ReactNode} props.children - Tab components
 */
export function Tabs({ activeTab, onTabChange, children }) {
  const handleTabClick = useCallback(
    (tabId) => {
      if (onTabChange) {
        onTabChange(tabId);
      }
    },
    [onTabChange],
  );

  // Clone children to pass activeTab prop
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        isActive: child.props.id === activeTab,
        onClick: () => handleTabClick(child.props.id),
      });
    }
    return child;
  });

  return <div className="tabs-container">{childrenWithProps}</div>;
}

/**
 * Tab component - Individual tab content wrapper
 * @param {Object} props
 * @param {string} props.id - Unique tab identifier
 * @param {string} props.label - Tab label text
 * @param {React.ReactNode} props.icon - Tab icon (emoji or icon component)
 * @param {boolean} props.isActive - Whether this tab is active
 * @param {Function} props.onClick - Click handler
 * @param {React.ReactNode} props.children - Tab content
 */
export function Tab({ id, label, icon, isActive, onClick, children }) {
  const activeClasses = "border-blue-500 text-blue-600 dark:text-blue-400";
  const inactiveClasses =
    "border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";
  const classes = `tab-button px-4 py-2 text-sm font-medium border-b-2 transition-colors ${isActive ? activeClasses : inactiveClasses}`;

  return (
    <div className="tab-wrapper">
      <button
        className={classes}
        onClick={onClick}
        role="tab"
        aria-selected={isActive}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {label}
      </button>
      {isActive && (
        <div className="tab-content pt-4" role="tabpanel">
          {children}
        </div>
      )}
    </div>
  );
}
