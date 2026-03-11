import React, { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Alert, LoadingSpinner } from "./UI";
import {
  normalizeVaccinationSchedulesResponse,
  normalizeVaccinationRecordsResponse,
  normalizeInfantResponse,
  buildVaccinationScheduleTimeline,
} from "../utils/adminDataAdapters";

const visitColumns = [
  { key: "birth", label: "At Birth", age: 0 },
  { key: "visit1", label: "1st visit\n1½ months", age: 1 },
  { key: "visit2", label: "2nd visit\n2½ months", age: 2 },
  { key: "visit3", label: "3rd visit\n3½ months", age: 3 },
  { key: "visit4", label: "4th visit\n9 months", age: 9 },
  { key: "visit5", label: "5th visit\n1 year", age: 12 },
];

const getStatusColor = (status) => {
  switch (status) {
    case "completed":
      return "text-green-700 bg-green-100 dark:text-green-200 dark:bg-green-900/30";
    case "due":
      return "text-yellow-700 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/30";
    case "overdue":
      return "text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900/30";
    default:
      return "text-gray-500 bg-gray-100 dark:text-gray-300 dark:bg-gray-700";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "completed":
      return "✓";
    case "due":
      return "●";
    case "overdue":
      return "⚠";
    default:
      return "○";
  }
};

const parseVisitAge = (entry) => {
  if (entry?.age_in_months === null || entry?.age_in_months === undefined) return null;
  const age = Number(entry.age_in_months);
  return Number.isFinite(age) ? age : null;
};

export default function VaccineScheduleBooklet({ infantId }) {
  const [scheduleTimeline, setScheduleTimeline] = useState([]);
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
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setScheduleTimeline([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [scheduleData, vaccinationData, infantData] = await Promise.all([
        apiClient.getVaccinationSchedules(),
        apiClient.getVaccinationRecordsByInfant(infantId),
        apiClient.getInfant(infantId),
      ]);

      const normalizedSchedule = normalizeVaccinationSchedulesResponse(scheduleData);
      const normalizedVaccinations = normalizeVaccinationRecordsResponse(vaccinationData);
      const normalizedInfant = normalizeInfantResponse(infantData);

      const timeline = buildVaccinationScheduleTimeline({
        schedules: normalizedSchedule,
        records: normalizedVaccinations,
        infantDob: normalizedInfant?.dob,
      });

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setScheduleTimeline(Array.isArray(timeline) ? timeline : []);
    } catch (err) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(err.message || "Failed to load vaccine schedule.");
      setScheduleTimeline([]);
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    if (!infantId) {
      setScheduleTimeline([]);
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
    }, 60000);

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
        "table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }",
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

  const rowsByVaccine = scheduleTimeline.reduce((acc, entry) => {
    const key = `${entry.vaccine_id}-${entry.vaccine_name}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        vaccine_name: entry.vaccine_name,
        disease_prevented: entry.disease_prevented,
        doses: [],
      };
    }
    acc[key].doses.push(entry);
    return acc;
  }, {});

  const scheduleRows = Object.values(rowsByVaccine).map((row) => ({
    ...row,
    doses: row.doses.sort(
      (a, b) => Number(a.dose_number || 0) - Number(b.dose_number || 0),
    ),
  }));

  const getDoseForColumn = (row, columnAge) => {
    return row.doses.find((doseEntry) => parseVisitAge(doseEntry) === columnAge) || null;
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

  if (scheduleRows.length === 0) {
    return (
      <Alert variant="info" title="No vaccination schedule found">
        No schedule entries are currently available for this infant.
      </Alert>
    );
  }

  const renderScheduleTable = () => (
    <table className="w-full">
      <thead className="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Bakuna (Vaccine)
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Sakit na maiiwasan (Disease Prevented)
          </th>
          {visitColumns.map((column) => (
            <th
              key={column.key}
              className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-pre-line"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {scheduleRows.map((row) => (
          <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {row.vaccine_name}
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-500 dark:text-gray-300">
                {row.disease_prevented || "-"}
              </div>
            </td>
            {visitColumns.map((column) => {
              const doseEntry = getDoseForColumn(row, column.age);
              return (
                <td key={`${row.key}-${column.key}`} className="px-6 py-4 text-center">
                  {doseEntry ? (
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${getStatusColor(
                        doseEntry.status,
                      )}`}
                      title={
                        doseEntry.admin_date
                          ? `Administered on ${new Date(
                              doseEntry.admin_date,
                            ).toLocaleDateString()}`
                          : doseEntry.due_date
                            ? `Due on ${new Date(
                                doseEntry.due_date,
                              ).toLocaleDateString()}`
                            : "Pending"
                      }
                    >
                      {getStatusIcon(doseEntry.status)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      {/* Hidden printable version */}
      <div id="vaccine-schedule-print" className="hidden print:block">
        <div className="bg-white rounded-xl">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800">
              Child Immunization Schedule Booklet
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Schedule for giving vaccines for below 1 year old babies
            </p>
          </div>
          <div className="overflow-x-auto">{renderScheduleTable()}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Child Immunization Schedule Booklet
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Schedule for giving vaccines for below 1 year old babies
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="secondary">
                📄 Download PDF
              </Button>
              <Button onClick={handlePrint}>🖨️ Print</Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">{renderScheduleTable()}</div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-green-600 bg-green-100 mr-2">
                ✓
              </span>
              <span className="text-gray-600 dark:text-gray-300">Completed</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-yellow-600 bg-yellow-100 mr-2">
                ●
              </span>
              <span className="text-gray-600 dark:text-gray-300">Due</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-red-600 bg-red-100 mr-2">
                ⚠
              </span>
              <span className="text-gray-600 dark:text-gray-300">Overdue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
