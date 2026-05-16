import React from "react";
import { Input, Select } from "./UI";
import { PERIOD_OPTIONS } from "../utils/vaccinationPeriods";

const VaccinationPeriodFilter = ({
  period,
  startDate = "",
  endDate = "",
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  periodOptions = PERIOD_OPTIONS,
  className = "",
  periodLabel = "Period",
  startDateLabel = "Start Date",
  endDateLabel = "End Date",
  layout = "inline",
}) => {
  const isStackedLayout = layout === "stacked";
  const supportsCustomPeriod = periodOptions.some((option) => option.value === "custom");

  return (
    <div
      className={`${
        isStackedLayout
          ? "space-y-3"
          : "flex flex-wrap items-end gap-3"
      } ${className}`.trim()}
    >
      <div
        className={
          isStackedLayout
            ? "w-full"
            : "w-full sm:w-44 flex-shrink-0"
        }
      >
        <Select
          label={periodLabel}
          surface="light"
          value={period}
          onChange={(event) => onPeriodChange?.(event.target.value)}
          options={periodOptions}
          containerClassName="mb-0"
        />
      </div>

      {supportsCustomPeriod && period === "custom" && (
        <div
          className={
            isStackedLayout
              ? "grid gap-3 sm:grid-cols-2"
              : "contents"
          }
        >
          <div className="w-full sm:w-44 flex-shrink-0">
            <Input
              label={startDateLabel}
              surface="light"
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange?.(event.target.value)}
            />
          </div>
          {!isStackedLayout ? (
            <div className="hidden sm:block pb-2 text-gray-500 dark:text-gray-400">
              -
            </div>
          ) : null}
          <div className="w-full sm:w-44 flex-shrink-0">
            <Input
              label={endDateLabel}
              surface="light"
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange?.(event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VaccinationPeriodFilter;
