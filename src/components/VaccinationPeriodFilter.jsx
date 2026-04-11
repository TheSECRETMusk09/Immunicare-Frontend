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
  className = "",
}) => {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`.trim()}>
      <div className="w-full sm:w-44 flex-shrink-0">
        <Select
          label="Period"
          surface="light"
          value={period}
          onChange={(event) => onPeriodChange?.(event.target.value)}
          options={PERIOD_OPTIONS}
          containerClassName="mb-0"
        />
      </div>

      {period === "custom" && (
        <>
          <div className="w-full sm:w-44 flex-shrink-0">
            <Input
              label="Start Date"
              surface="light"
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange?.(event.target.value)}
            />
          </div>
          <div className="hidden sm:block pb-2 text-gray-500 dark:text-gray-400">-</div>
          <div className="w-full sm:w-44 flex-shrink-0">
            <Input
              label="End Date"
              surface="light"
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange?.(event.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default VaccinationPeriodFilter;
