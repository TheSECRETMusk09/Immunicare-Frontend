import React from "react";
import { Button, Input } from "./UI";

export default function PrintDateRangeControls({
  controller,
  className = "",
  label = "Print Date Range",
  startLabel = "Start Date",
  endLabel = "End Date",
  applyLabel = "Apply Range",
  clearLabel = "Clear",
  alignEnd = false,
}) {
  if (!controller) {
    return null;
  }

  const {
    startDateInput,
    endDateInput,
    validationError,
    hasAppliedDateRange,
    activeDateRangeLabel,
    setStartDateInput,
    setEndDateInput,
    applyDateRange,
    clearDateRange,
  } = controller;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div
        className={`flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40 ${
          alignEnd ? "md:items-end" : ""
        }`}
      >
        <div
          className={`flex flex-col gap-3 ${alignEnd ? "md:items-end" : ""}`}
        >
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {label}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Input
              label={startLabel}
              aria-label={startLabel}
              type="date"
              value={startDateInput}
              onChange={(event) => setStartDateInput(event.target.value)}
              className={`text-sm ${validationError ? "border-danger-300 focus:border-danger-500 focus:ring-danger-500" : ""}`.trim()}
              containerClassName="w-full sm:w-44"
            />

            <Input
              label={endLabel}
              aria-label={endLabel}
              type="date"
              value={endDateInput}
              onChange={(event) => setEndDateInput(event.target.value)}
              className={`text-sm ${validationError ? "border-danger-300 focus:border-danger-500 focus:ring-danger-500" : ""}`.trim()}
              containerClassName="w-full sm:w-44"
            />

            <div className="flex flex-wrap gap-2 pb-0.5">
              <Button size="sm" variant="primary" onClick={applyDateRange}>
                {applyLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={clearDateRange}>
                {clearLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {validationError ? (
            <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
              {validationError}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Leave both dates blank to print all available records. After changing the dates, click Apply Range before printing or exporting.
            </p>
          )}

          {hasAppliedDateRange && (
            <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {activeDateRangeLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
