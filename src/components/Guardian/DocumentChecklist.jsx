/**
 * DocumentChecklist Component
 * Displays required documents and items checklist for vaccination appointments
 * Helps parents remember what to bring to appointments
 */

import React from "react";
import {
  CheckCircle,
  Circle,
  FileText,
  BookOpen,
  Heart,
  ClipboardList,
} from "lucide-react";

const DocumentChecklist = ({ completedItems = [], showStatus = true }) => {
  // Default required documents and items for vaccination appointments
  const defaultItems = [
    {
      id: "birth_cert",
      label: "Birth Certificate (Original)",
      description: "Original birth certificate for verification",
      icon: BookOpen,
    },
    {
      id: "parent_id",
      label: "Parent/Guardian Valid ID",
      description: "Any valid government ID",
      icon: FileText,
    },
    {
      id: "medbook",
      label: "Mother's / Child's Medical Book",
      description: "Pink book or vaccination record",
      icon: BookOpen,
    },
    {
      id: "previous_records",
      label: "Previous Vaccination Records",
      description: "If this is not the first vaccination",
      icon: ClipboardList,
    },
    {
      id: "consent_form",
      label: "Signed Consent Form",
      description: "Will be provided at the facility",
      icon: FileText,
      optional: true,
    },
    {
      id: "insurance",
      label: "Health Insurance Card (if applicable)",
      description: "PhilHealth or private insurance",
      icon: Heart,
      optional: true,
    },
  ];

  const isItemCompleted = (itemId) => completedItems.includes(itemId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <ClipboardList className="w-5 h-5" />
          <h3 className="font-bold text-sm sm:text-base">
            Required Documents Checklist
          </h3>
        </div>
        <p className="text-emerald-100 text-xs mt-1">
          Please bring these documents to your appointment
        </p>
      </div>

      {/* Checklist Items */}
      <div className="p-4 space-y-3">
        {defaultItems.map((item) => {
          const Icon = item.icon;
          const isCompleted = isItemCompleted(item.id);

          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 ${
                isCompleted
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? "bg-emerald-100 dark:bg-emerald-900/50"
                    : "bg-gray-200 dark:bg-gray-600"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isCompleted
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={`font-semibold text-sm ${
                      isCompleted
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {item.label}
                  </h4>
                  {item.optional && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-full">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.description}
                </p>
              </div>

              {/* Status indicator */}
              {showStatus && (
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-300 dark:text-gray-500" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {showStatus && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Progress:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {completedItems.length} of{" "}
              {defaultItems.filter((item) => !item.optional).length} required
              items
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentChecklist;
