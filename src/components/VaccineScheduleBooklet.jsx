import React, { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Alert, LoadingSpinner } from "./UI";

// Extended age columns based on vaccination schedules
const getVisitColumns = (schedules) => {
  // Extract unique age months from schedules
  const uniqueAges = [...new Set(schedules.map(s => s.ageMonths))].sort((a, b) => a - b);

  // Map ages to column labels
  const ageLabels = {
    0: { key: "birth", label: "At Birth", shortLabel: "Birth" },
    1.5: { key: "visit1", label: "1½ months", shortLabel: "1.5mo" },
    2.5: { key: "visit2", label: "2½ months", shortLabel: "2.5mo" },
    3.5: { key: "visit3", label: "3½ months", shortLabel: "3.5mo" },
    6: { key: "visit6", label: "6 months", shortLabel: "6mo" },
    9: { key: "visit9", label: "9 months", shortLabel: "9mo" },
    12: { key: "visit12", label: "12 months", shortLabel: "1yr" },
    18: { key: "visit18", label: "18 months", shortLabel: "1.5yr" },
    48: { key: "visit48", label: "4-6 years", shortLabel: "4-6yr" },
    60: { key: "visit60", label: "5 years", shortLabel: "5yr" },
    72: { key: "visit72", label: "6 years", shortLabel: "6yr" }
  };

  return uniqueAges.map(age => ({
    key: ageLabels[age]?.key || `age_${age}`,
    label: ageLabels[age]?.label || `${age} months`,
    shortLabel: ageLabels[age]?.shortLabel || `${age}mo`,
    age
  }));
};

const getStatusColor = (status) => {
  switch (status) {
    case "completed":
      return "text-green-700 bg-green-100 dark:text-green-200 dark:bg-green-900/30";
    case "overdue":
      return "text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/30";
    case "upcoming":
      return "text-yellow-700 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/30";
    default:
      return "text-gray-500 bg-gray-100 dark:text-gray-300 dark:bg-gray-700";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "completed":
      return "✓";
    case "overdue":
      return "⚠";
    case "upcoming":
      return "⏰";
    default:
      return "○";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    case "upcoming":
      return "Due Soon";
    case "future":
      return "Not Yet Due";
    default:
      return "Pending";
  }
};

const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDays = (days) => {
  if (days === 0) return "";
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} overdue`;
  return `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} until due`;
};

export default function VaccineScheduleBooklet({ infantId }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!infantId) {
      if (!isMountedRef.current) {
        return;
      }

      setScheduleData(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await apiClient.getDynamicSchedule(infantId);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      if (result.error) {
        setError(result.error);
        setScheduleData(null);
      } else {
        setScheduleData(result);
      }
    } catch (err) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(err.message || "Failed to load vaccine schedule.");
      setScheduleData(null);
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    if (!infantId) {
      setScheduleData(null);
      setError(null);
      setLoading(false);
      return;
    }

    void fetchData();
  }, [infantId, fetchData]);

  useEffect(() => {
    if (!infantId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchData();
    }, 60000); // Refresh every minute

    return () => window.clearInterval(intervalId);
  }, [infantId, fetchData]);

  const handlePrint = () => {
    const printContent = document.getElementById("vaccine-schedule-print");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write("<html><head><title>Vaccine Schedule</title>");
      printWindow.document.write("<style>");
      printWindow.document.write(
        "table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }"
      );
      printWindow.document.write("</style></head><body>");
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write("</body></html>");
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  // Group schedules by vaccine
  const rowsByVaccine = scheduleData?.schedules?.reduce((acc, entry) => {
    const key = `${entry.vaccineId}-${entry.vaccineName}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        vaccineName: entry.vaccineName,
        vaccineId: entry.vaccineId,
        doses: [],
      };
    }
    acc[key].doses.push(entry);
    return acc;
  }, {});

  const scheduleRows = rowsByVaccine ? Object.values(rowsByVaccine).map((row) => ({
    ...row,
    doses: row.doses.sort((a, b) => a.ageMonths - b.ageMonths),
  })) : [];

  // Get dynamic columns based on actual schedule data
  const visitColumns = scheduleData?.schedules
    ? getVisitColumns(scheduleData.schedules)
    : [];

  const getDoseForColumn = (row, columnAge) => {
    return row.doses.find(doseEntry => doseEntry.ageMonths === columnAge) || null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinner size="lg" />
        <span className="mt-3 text-gray-600 dark:text-gray-400">
          Loading vaccine schedule...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title="Error loading schedule">
        {error}
        <div className="mt-4">
          <Button size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!scheduleData || scheduleRows.length === 0) {
    return (
      <Alert variant="info" title="No vaccination schedule found">
        No schedule entries are currently available for this infant.
      </Alert>
    );
  }

  const { infantInfo, summary } = scheduleData;

  const renderPrintHeader = () => (
    <div className="mb-6 p-4 border-b">
      <h2 className="text-xl font-bold">Child Immunization Schedule Booklet</h2>
      {infantInfo && (
        <div className="mt-2 text-sm">
          <p><strong>Name:</strong> {infantInfo.firstName} {infantInfo.lastName}</p>
          <p><strong>Control Number:</strong> {infantInfo.controlNumber}</p>
          <p><strong>Date of Birth:</strong> {formatDate(infantInfo.dateOfBirth)}</p>
          <p><strong>Guardian:</strong> {infantInfo.guardianName}</p>
        </div>
      )}
    </div>
  );

  const renderScheduleTable = () => (
    <table className="w-full">
      <thead className="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Bakuna (Vaccine)
          </th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Dose
          </th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Status
          </th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Due Date
          </th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Admin Date
          </th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Days
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {scheduleData.schedules.map((schedule, index) => (
          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td className="px-4 py-3">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {schedule.vaccineName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {schedule.ageDescription}
              </div>
            </td>
            <td className="px-4 py-3 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {schedule.doseNumber}/{schedule.totalDoses}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <span
                className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  schedule.status
                )}`}
              >
                {getStatusIcon(schedule.status)} {getStatusLabel(schedule.status)}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formatDate(schedule.dueDate)}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formatDate(schedule.adminDate)}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <span className={`text-xs ${
                schedule.isOverdue ? 'text-red-600 font-medium' :
                schedule.isUpcoming ? 'text-yellow-600' : 'text-gray-500'
              }`}>
                {formatDays(schedule.daysOverdue)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      {/* Hidden printable version */}
      <div id="vaccine-schedule-print" className="hidden print:block">
        <div className="bg-white rounded-xl p-6">
          {renderPrintHeader()}
          <div className="overflow-x-auto">{renderScheduleTable()}</div>

          {/* Signature section for print */}
          <div className="mt-8 pt-4 border-t">
            <div className="flex justify-between">
              <div>
                <p className="text-sm">Health Worker Signature:</p>
                <div className="h-12 border-b border-gray-400 w-48 mt-4"></div>
              </div>
              <div>
                <p className="text-sm">Guardian Signature:</p>
                <div className="h-12 border-b border-gray-400 w-48 mt-4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header with infant info and summary */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Child Immunization Schedule Booklet
              </h3>
              {infantInfo && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {infantInfo.firstName} {infantInfo.lastName} • DOB: {formatDate(infantInfo.dateOfBirth)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="secondary" size="sm">
                📄 Print
              </Button>
            </div>
          </div>

          {/* Summary badges */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Total: {summary.totalScheduled}
              </span>
            </div>
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                ✓ Completed: {summary.completedCount}
              </span>
            </div>
            <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                ⚠ Overdue: {summary.overdueCount}
              </span>
            </div>
            <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                ⏰ Upcoming: {summary.upcomingCount}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="overflow-x-auto">{renderScheduleTable()}</div>

        {/* Legend */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-6 text-sm flex-wrap">
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-green-600 bg-green-100 mr-2">
                ✓
              </span>
              <span className="text-gray-600 dark:text-gray-300">Completed</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-yellow-600 bg-yellow-100 mr-2">
                ⏰
              </span>
              <span className="text-gray-600 dark:text-gray-300">Due Soon (within 2 weeks)</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-red-600 bg-red-100 mr-2">
                ⚠
              </span>
              <span className="text-gray-600 dark:text-gray-300">Overdue</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-gray-500 bg-gray-100 mr-2">
                ○
              </span>
              <span className="text-gray-600 dark:text-gray-300">Not Yet Due</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
