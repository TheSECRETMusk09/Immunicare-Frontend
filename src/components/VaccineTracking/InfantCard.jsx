import React from "react";
import { Button } from "../UI";

const InfantCard = ({
  infant,
  vaccinationRecords,
  vaccinationSchedules,
  onAddVaccine,
  onViewDetails,
}) => {
  const complianceRate = getComplianceRate(
    infant.id,
    vaccinationRecords,
    vaccinationSchedules
  );
  const nextVaccines = getNextVaccines(
    infant.id,
    vaccinationRecords,
    vaccinationSchedules
  );
  const completed = vaccinationRecords.filter(
    (r) => r.infant_id === infant.id && r.admin_date
  ).length;

  const getStatusEmoji = (rate) => {
    if (rate >= 80) return "😊";
    if (rate >= 50) return "😐";
    return "😟";
  };

  const getStatusColor = (rate) => {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-lg">
            <span className="text-2xl">{infant.sex === "M" ? "👦" : "👧"}</span>
            {infant.first_name} {infant.last_name}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            DOB: {new Date(infant.dob).toLocaleDateString()}
          </p>
        </div>
        <div className="text-3xl">{getStatusEmoji(complianceRate)}</div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">
            Vaccination Progress
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {complianceRate}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(
              complianceRate
            )}`}
            style={{ width: `${complianceRate}%` }}
          ></div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-3 gap-4 text-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="text-lg font-semibold text-green-600">
            {completed}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Completed
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold text-yellow-600">
            {vaccinationRecords.filter((r) => r.infant_id === infant.id)
              .length - completed}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Pending
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold text-blue-600">
            {nextVaccines.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Next Up
          </div>
        </div>
      </div>

      {/* Next Vaccines */}
      {nextVaccines.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Next Vaccines Due
          </h5>
          <div className="space-y-2">
            {nextVaccines.slice(0, 3).map((vaccine, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <span className="text-green-600">💉</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {vaccine.vaccine_name}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  ({vaccine.disease_prevented})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => onViewDetails(infant)}
          size="sm"
          variant="outline"
          className="flex-1"
        >
          View Details
        </Button>
        <Button
          onClick={() => onAddVaccine(infant)}
          size="sm"
          className="flex-1"
        >
          Add Vaccine
        </Button>
      </div>
    </div>
  );
};

// Helper functions
const getComplianceRate = (
  infantId,
  vaccinationRecords,
  vaccinationSchedules
) => {
  const infantRecords = vaccinationRecords.filter(
    (r) => r.infant_id === infantId && r.admin_date
  );
  const completed = infantRecords.length;
  const totalExpected = vaccinationSchedules.length * 2; // Average 2 doses per vaccine
  return totalExpected > 0 ? Math.round((completed / totalExpected) * 100) : 0;
};

const getNextVaccines = (
  infantId,
  vaccinationRecords,
  vaccinationSchedules
) => {
  const infantRecords = vaccinationRecords.filter(
    (r) => r.infant_id === infantId
  );
  const completedVaccineIds = infantRecords.map((r) => r.vaccine_id);

  return vaccinationSchedules
    .filter((schedule) => !completedVaccineIds.includes(schedule.vaccine_id))
    .slice(0, 3);
};

export default InfantCard;
