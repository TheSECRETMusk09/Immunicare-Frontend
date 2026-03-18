import React, { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Alert, LoadingSpinner } from "./UI";
import {
  normalizeInfantResponse,
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationSchedulesResponse,
  buildVaccinationScheduleTimeline,
} from "../utils/adminDataAdapters";

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

export default function ImmunizationRecordBooklet({ infantId }) {
  const [infant, setInfant] = useState(null);
  const [recordRows, setRecordRows] = useState([]);
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

      setInfant(null);
      setRecordRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [infantData, vaccinationData, schedulesData] = await Promise.all([
        apiClient.getInfant(infantId),
        apiClient.getVaccinationRecordsByInfant(infantId),
        apiClient.getVaccinationSchedules(),
      ]);

      const normalizedInfant = normalizeInfantResponse(infantData);
      const normalizedVaccinations =
        normalizeVaccinationRecordsResponse(vaccinationData);
      const normalizedSchedules =
        normalizeVaccinationSchedulesResponse(schedulesData);

      const timeline = buildVaccinationScheduleTimeline({
        schedules: normalizedSchedules,
        records: normalizedVaccinations,
        infantDob: normalizedInfant?.dob,
      });

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setInfant(normalizedInfant);
      setRecordRows(Array.isArray(timeline) ? timeline : []);
    } catch (err) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setError(err.message || "Failed to load immunization records.");
      setInfant(null);
      setRecordRows([]);
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoading(false);
    }
  }, [infantId]);

  useEffect(() => {
    if (!infantId) {
      setInfant(null);
      setRecordRows([]);
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
    const printContent = document.getElementById("immunization-record-print");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(
        "<html><head><title>Immunization Record</title></head><body>",
      );
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinner size="lg" />
        <span className="mt-3 text-gray-600 dark:text-gray-400">
          Loading immunization records...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title="Error loading immunization records">
        {error}
        <div className="mt-4">
          <Button onClick={fetchData} size="sm">
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!infant) {
    return (
      <Alert variant="warning" title="Infant not found">
        The selected infant record is no longer available.
      </Alert>
    );
  }

  const renderTable = () => (
    <table className="w-full">
      <thead className="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Bakuna (Vaccine)
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Doses
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Date Administered
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Remarks
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Status
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {recordRows.map((entry) => (
          <tr key={`${entry.id}-${entry.dose_number}`}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {entry.vaccine_name}
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
              Dose {entry.dose_number}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {formatDate(entry.admin_date)}
            </td>
            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
              {entry.notes || ""}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                  entry.status === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200"
                    : entry.status === "overdue"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"
                      : entry.status === "due"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                }`}
              >
                {entry.status}
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
      <div id="immunization-record-print" className="hidden print:block">
        <div className="bg-white rounded-xl">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800">
              Child Immunization Record Booklet
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Child's Name:</span>
                <span className="ml-2 text-gray-900">
                  {infant.last_name}, {infant.first_name}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Date of Birth:</span>
                <span className="ml-2 text-gray-900">{formatDate(infant.dob)}</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">{renderTable()}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Child Immunization Record Booklet
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Child's Name:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {infant.last_name}, {infant.first_name}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Date of Birth:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {formatDate(infant.dob)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="secondary">
                📄 Download PDF
              </Button>
              <Button onClick={handlePrint}>🖨️ Print</Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">{renderTable()}</div>
      </div>
    </div>
  );
}
