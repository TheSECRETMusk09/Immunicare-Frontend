/**
 * RoleSelector Component
 * Allows users to select their login role (Admin or Guardian)
 * Distinct visual branding for each role to prevent authentication confusion
 *
 * Features:
 * - Clear visual distinction between roles
 * - Role-specific icons and colors
 * - Accessible keyboard navigation
 * - Screen reader support
 */

import React from "react";
import PropTypes from "prop-types";

const RoleSelector = ({ selectedRole, onRoleChange, className = "" }) => {
  const roles = [
    {
      id: "admin",
      label: "Healthcare Staff",
      description: "Doctors, Nurses & Administrators",
      icon: ({ className }) => (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      colors: {
        selected:
          "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/25",
        unselected:
          "bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20",
        icon: "text-blue-600",
      },
    },
    {
      id: "guardian",
      label: "Parent / Guardian",
      description: "Access your child's records",
      icon: ({ className }) => (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      ),
      colors: {
        selected:
          "bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/25",
        unselected:
          "bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:border-orange-500 dark:hover:bg-orange-900/20",
        icon: "text-orange-600",
      },
    },
  ];

  return (
    <div
      className={`grid grid-cols-2 gap-3 ${className}`}
      role="radiogroup"
      aria-label="Select your login type"
    >
      {roles.map((role) => {
        const isSelected = selectedRole === role.id;
        const Icon = role.icon;

        return (
          <button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onRoleChange(role.id)}
            className={`
              relative flex flex-col items-center justify-center
              p-4 rounded-xl border-2
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${isSelected ? role.colors.selected : role.colors.unselected}
              ${role.id === "admin" ? "focus:ring-blue-500" : "focus:ring-orange-500"}
              min-h-[120px] touch-target
            `}
            style={{ minHeight: "120px" }}
          >
            <Icon
              className={`w-8 h-8 mb-2 ${isSelected ? "text-white" : role.colors.icon}`}
            />
            <span className="font-semibold text-sm">{role.label}</span>
            <span
              className={`text-xs mt-1 ${isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}
            >
              {role.description}
            </span>

            {isSelected && (
              <span className="absolute top-2 right-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

RoleSelector.propTypes = {
  selectedRole: PropTypes.oneOf(["admin", "guardian"]).isRequired,
  onRoleChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default RoleSelector;
