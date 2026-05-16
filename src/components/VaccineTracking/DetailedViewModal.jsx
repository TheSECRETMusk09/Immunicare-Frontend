import React from "react";
import { Modal, Button } from "../UI";
import FormActions from "../UI/FormActions";
import Timeline from "./Timeline";

const DetailedViewModal = ({
  isOpen,
  onClose,
  infant,
  vaccinationRecords,
  vaccinationSchedules,
}) => {
  const complianceRate = getComplianceRate(
    infant.id,
    vaccinationRecords,
    vaccinationSchedules,
  );
  const infantRecords = vaccinationRecords.filter(
    (r) => r.infant_id === infant.id,
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "due":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Vaccination Details for ${infant.first_name} ${infant.last_name}`}
      size="xl"
      footer={
        <FormActions>
          <Button variant="cancel" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              // Trigger add vaccine action
              onClose();
            }}
          >
            Add New Vaccine
          </Button>
        </FormActions>
      }
    >
      <div className="space-y-6">
        {/* Child Information */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
            Child Information
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Name:</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {infant.first_name} {infant.last_name}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Date of Birth:</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(infant.dob).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Gender:</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {infant.sex === "M" ? "Male" : "Female"}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Age:</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {Math.floor(
                  (new Date() - new Date(infant.dob)) /
                    (1000 * 60 * 60 * 24 * 30),
                )}{" "}
                months
              </p>
            </div>
          </div>
        </div>

        {/* Vaccination History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              Vaccination History
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Vaccine
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Dose
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Administered By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {infantRecords.map((record) => {
                  const vaccine = vaccinationSchedules.find(
                    (v) => v.vaccine_id === record.vaccine_id,
                  );
                  const status = record.admin_date ? "completed" : "pending";

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {vaccine ? vaccine.vaccine_name : "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {vaccine ? vaccine.disease_prevented : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Dose {record.dose_no}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {record.admin_date
                            ? new Date(record.admin_date).toLocaleDateString()
                            : "Not administered"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            status,
                          )}`}
                        >
                          {status === "completed" ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {record.healthcare_worker || "N/A"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {infantRecords.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No vaccination records found for this child.
            </div>
          )}
        </div>

        {/* Vaccination Timeline */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Vaccination Timeline
          </h4>
          <Timeline
            schedule={vaccinationSchedules}
            records={infantRecords}
            infantId={infant.id}
          />
        </div>

        {/* Compliance Summary */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
            Compliance Summary
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Overall Compliance Rate
              </p>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                {complianceRate}%
              </p>
            </div>
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Status
              </p>
              <p
                className={`text-lg font-bold ${
                  complianceRate >= 80
                    ? "text-green-600"
                    : complianceRate >= 50
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {complianceRate >= 80
                  ? "On Track"
                  : complianceRate >= 50
                    ? "Needs Attention"
                    : "At Risk"}
              </p>
            </div>
          </div>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
            {complianceRate >= 80
              ? "Excellent! Your child is up-to-date with all recommended vaccinations."
              : complianceRate >= 50
                ? "Your child has received some vaccinations but is missing important doses. Please schedule an appointment."
                : "Your child is significantly behind on vaccinations. Immediate action is recommended to protect their health."}
          </p>
        </div>
      </div>
    </Modal>
  );
};

const getComplianceRate = (
  infantId,
  vaccinationRecords,
  vaccinationSchedules,
) => {
  const infantRecords = vaccinationRecords.filter(
    (r) => r.infant_id === infantId && r.admin_date,
  );
  const completed = infantRecords.length;
  const totalExpected = vaccinationSchedules.length * 2;
  return totalExpected > 0 ? Math.round((completed / totalExpected) * 100) : 0;
};

export default DetailedViewModal;
