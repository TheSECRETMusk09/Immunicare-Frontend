/**
 * Philippine Holidays Display Component
 * Shows upcoming Philippine government holidays on dashboards
 */
import React, { useState, useEffect } from "react";
import { getUpcomingHolidays } from "../../utils/holidays";

export default function HolidayDisplay({
  compact = false,
  maxHolidays = 5,
  mode = "full",
}) {
  const [holidays, setHolidays] = useState([]);
  const [isExpanded, setIsExpanded] = useState(mode === "full");

  useEffect(() => {
    const upcomingHolidays = getUpcomingHolidays();
    setHolidays(upcomingHolidays.slice(0, maxHolidays));
  }, [maxHolidays]);

  if (holidays.length === 0) {
    return null;
  }

  // Mini widget mode
  if (mode === "mini") {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Upcoming Holidays
          </h4>
        </div>
        <div className="space-y-2">
          {holidays.map((holiday, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-amber-700 dark:text-amber-300 truncate">
                {holiday.name}
              </span>
              <span className="text-amber-600 dark:text-amber-400 ml-2 whitespace-nowrap">
                {holiday.date.toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Compact version for sidebar or small spaces
  if (compact || mode === "compact") {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Upcoming Holiday
          </h4>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {holidays[0]?.name} -{" "}
          {holidays[0]?.date?.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Philippine Holidays
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {holidays.length} upcoming holiday
              {holidays.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg
            className={`w-5 h-5 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Holiday List */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {holidays.map((holiday, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      holiday.type === "regular" ? "bg-red-500" : "bg-amber-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {holiday.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {holiday.date.toLocaleDateString("en-PH", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    holiday.type === "regular"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {holiday.type === "regular" ? "Regular" : "Special"}
                </span>
              </div>
            ))}
          </div>

          {/* Info Note */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Appointments cannot be scheduled on weekends and holidays
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Mini version for dashboard widgets
export function HolidayMiniWidget() {
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    const upcomingHolidays = getUpcomingHolidays();
    setHolidays(upcomingHolidays.slice(0, 3));
  }, []);

  if (holidays.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Upcoming Holidays
        </h4>
      </div>
      <div className="space-y-2">
        {holidays.map((holiday, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-amber-700 dark:text-amber-300 truncate">
              {holiday.name}
            </span>
            <span className="text-amber-600 dark:text-amber-400 ml-2 whitespace-nowrap">
              {holiday.date.toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
