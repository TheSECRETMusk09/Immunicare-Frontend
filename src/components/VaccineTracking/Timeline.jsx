import React from "react";

const Timeline = ({ schedule, records, infantId }) => {
  return (
    <div className="space-y-4">
      {schedule.map((vaccine, index) => {
        const record = records.find(
          (r) => r.infant_id === infantId && r.vaccine_id === vaccine.vaccine_id
        );
        const isCompleted = record && record.admin_date;
        const isOverdue =
          !isCompleted &&
          new Date() >
            new Date(vaccine.target_age_weeks * 7 * 24 * 60 * 60 * 1000);

        return (
          <div
            key={index}
            className="flex items-center gap-4 group hover:bg-gray-50 dark:hover:bg-gray-800 p-3 rounded-lg transition-colors"
          >
            <div
              className={`w-4 h-4 rounded-full flex-shrink-0 transition-colors ${
                isCompleted
                  ? "bg-green-500"
                  : isOverdue
                  ? "bg-red-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              {isCompleted && (
                <span className="text-white text-xs ml-0.5">✓</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {vaccine.vaccine_name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {vaccine.disease_prevented}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isCompleted
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : isOverdue
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    }`}
                  >
                    {isCompleted ? "Completed" : isOverdue ? "Overdue" : "Due"}
                  </span>
                  {record?.admin_date && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Administered:{" "}
                      {new Date(record.admin_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Recommended:{" "}
                  {vaccine.target_age_weeks > 0
                    ? `${Math.floor(vaccine.target_age_weeks / 4)} months`
                    : "Birth"}
                </span>
                {record?.healthcare_worker && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    By: {record.healthcare_worker}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
