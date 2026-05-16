import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Alert, LoadingSpinner } from "./UI";
import usePrintDateRange from "../hooks/usePrintDateRange";
import {
  filterItemsByPrintDateRange,
  formatPrintDateValue,
} from "../utils/printDateRange";
import {
  downloadPdfFromNode,
  downloadWordDocument,
  PRINT_PAGE_PRESETS,
} from "../utils/printDocumentExport";

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
  return formatPrintDateValue(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDays = (days) => {
  if (days === null || days === undefined || Number.isNaN(Number(days))) return "";
  if (days === 0) return "";
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} overdue`;
  return `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} until due`;
};

const VACCINE_SCHEDULE_EXPORT_PAGE = {
  ...PRINT_PAGE_PRESETS.legalLandscape,
};

const VACCINE_SCHEDULE_PRINTABLE_STYLES = `
  @page {
    size: legal landscape;
    margin: 0.35in;
  }

  body {
    margin: 0;
    color: #111827;
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
  }

  .schedule-booklet-export {
    width: 100%;
    color: #111827;
    box-sizing: border-box;
  }

  .schedule-booklet-export__header {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
    border-bottom: 2px solid #1f2937;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }

  .schedule-booklet-export__title {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 700;
  }

  .schedule-booklet-export__subtitle {
    margin: 0;
    font-size: 12px;
    color: #475569;
  }

  .schedule-booklet-export__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 18px;
    margin-top: 12px;
    font-size: 11px;
  }

  .schedule-booklet-export__meta strong {
    display: inline-block;
    min-width: 90px;
  }

  .schedule-booklet-export__summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 12px 0;
  }

  .schedule-booklet-export__summary-card {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 8px 10px;
    background: #f8fafc;
  }

  .schedule-booklet-export__summary-label {
    margin: 0 0 4px;
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .schedule-booklet-export__summary-value {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  .schedule-booklet-export__table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
  }

  .schedule-booklet-export__table th,
  .schedule-booklet-export__table td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    vertical-align: middle;
  }

  .schedule-booklet-export__table th {
    background: #e2e8f0;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .schedule-booklet-export__vaccine {
    font-weight: 700;
  }

  .schedule-booklet-export__age {
    display: block;
    margin-top: 2px;
    font-size: 9px;
    color: #64748b;
  }

  .schedule-booklet-export__status {
    display: inline-block;
    min-width: 78px;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 9px;
    font-weight: 700;
    text-align: center;
    box-sizing: border-box;
  }

  .schedule-booklet-export__status--completed {
    background: #dcfce7;
    color: #166534;
  }

  .schedule-booklet-export__status--overdue {
    background: #fee2e2;
    color: #b91c1c;
  }

  .schedule-booklet-export__status--upcoming {
    background: #fef3c7;
    color: #92400e;
  }

  .schedule-booklet-export__status--future,
  .schedule-booklet-export__status--pending {
    background: #e2e8f0;
    color: #334155;
  }

  .schedule-booklet-export__signatures {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px;
    margin-top: 18px;
  }

  .schedule-booklet-export__signature-label {
    margin: 0 0 20px;
    font-size: 11px;
    font-weight: 600;
  }

  .schedule-booklet-export__signature-line {
    border-top: 1px solid #1f2937;
    height: 1px;
  }
`;

export default function VaccineScheduleBooklet({ infantId }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(Boolean(infantId));
  const [error, setError] = useState(null);
  const printDateRange = usePrintDateRange({
    headerPrefix: "Date Range",
    fallbackLabel: "All available schedule records",
  });

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const printAreaRef = useRef(null);

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
    if (!infantId) return;

    const handleUpdate = (e) => {
      const detailId = Number(e?.detail?.patient_id || e?.detail?.infant_id || e?.detail?.child_id);
      if (!detailId || detailId === Number(infantId)) {
        void fetchData();
      }
    };

    window.addEventListener("vaccination-update", handleUpdate);
    window.addEventListener("vaccination-readiness-update", handleUpdate);
    return () => {
      window.removeEventListener("vaccination-update", handleUpdate);
      window.removeEventListener("vaccination-readiness-update", handleUpdate);
    };
  }, [infantId, fetchData]);

  const printableSchedules = useMemo(() => {
    const schedules = scheduleData?.schedules || [];
    if (!printDateRange.hasAppliedDateRange) {
      return schedules;
    }

    return filterItemsByPrintDateRange(schedules, {
      startDate: printDateRange.appliedStartDate,
      endDate: printDateRange.appliedEndDate,
      getItemDates: (entry) => [entry?.adminDate, entry?.dueDate],
    });
  }, [
    printDateRange.appliedEndDate,
    printDateRange.appliedStartDate,
    printDateRange.hasAppliedDateRange,
    scheduleData?.schedules,
  ]);

  const buildPrintableDocument = useCallback(() => {
    const printableNode =
      printAreaRef.current?.querySelector(".schedule-booklet-export");
    if (!printableNode) {
      return "";
    }

    const infantDetails = scheduleData?.infantInfo || {};
    const safeTitle =
      `${infantDetails.firstName || ""} ${infantDetails.lastName || ""}`.trim() ||
      "Child Immunization Schedule Booklet";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vaccine Schedule - ${safeTitle}</title>
    <style>${VACCINE_SCHEDULE_PRINTABLE_STYLES}</style>
  </head>
  <body>
    ${printableNode.outerHTML}
  </body>
</html>`;
  }, [scheduleData]);























                         useCallback(async () => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const printableNode =
      printAreaRef.current?.querySelector(".schedule-booklet-print");
    if (!printableNode) {
      return;
    }

    try {
      await downloadPdfFromNode({
        node: printableNode,
        filename: `Vaccine_Schedule_${infantId || "child"}.pdf`,
        title: "Child Immunization Schedule Booklet",
        page: VACCINE_SCHEDULE_EXPORT_PAGE,
        marginsMm: {
          top: 4,
          right: 4,
          bottom: 4,
          left: 4,
        },
        scale: 0.82,
        autoPaging: false,
      });
    } catch (downloadError) {
      console.error("Error generating vaccine schedule PDF:", downloadError);
      setError(downloadError.message || "Failed to generate vaccine schedule PDF.");
    }
  }, [infantId, printDateRange]);

                             useCallback(() => {
    if (!printDateRange.ensureReadyForPrint()) {
      return;
    }

    const printableHtml = buildPrintableDocument();
    if (!printableHtml) {
      return;
    }

    downloadWordDocument({
      html: printableHtml,
      filename: `Vaccine_Schedule_${infantId || "child"}.docx`,
      title: "Child Immunization Schedule Booklet",
      headerText: "Child Immunization Schedule Booklet",
      footerText: printDateRange.activeDateRangeLabel,
      page: VACCINE_SCHEDULE_EXPORT_PAGE,
    });
  }, [buildPrintableDocument, infantId, printDateRange]);

  const printableSummary = useMemo(
    () =>( {
      totalScheduled: printableSchedules.length,
      completedCount: printableSchedules.filter((entry) => entry?.status === "completed")
        .length,
      overdueCount: printableSchedules.filter((entry) => entry?.status === "overdue")
        .length,
      upcomingCount: printableSchedules.filter((entry) => entry?.status === "upcoming")
        .length,
    }),
    [printableSchedules],
  );

  if (loading) {
    return(
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinner size="lg" />
        <span className="mt-3 text-gray-600 dark:text-gray-400">
          Loading vaccine schedule...
        </span>
      </div>)
     ;
  }

  if (error) {
    return(
      <Alert variant="error" title="Error loading schedule">
        {error}
        <div className="mt-4">
          <Button size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      </Alert>)
     ;
  }

  if (!scheduleData || printableSchedules.length === 0) {
    return(
      <Alert variant="info" title="No vaccination schedule found">
        No schedule entries are currently available for this infant.
      </Alert>)
     ;
  }

  const infantInfo = scheduleData?.infantInfo || {};
  const summary = scheduleData?.summary || {};
  const childName =
    `${infantInfo.firstName || ""} ${infantInfo.lastName || ""}`.trim() ||
    "Child";

  const renderScheduleTable = () =>(
    <>
      {/* Mobile Card View */}
      <div className="guardian-table-card-list min-[768px]:hidden mt-2">
        {printableSchedules.map((schedule, index) =>(
          <article key={index} className="guardian-table-card">
            <div className="guardian-table-card__header">
              <div className="min-w-0">
                <h4 className="guardian-table-card__title text-base">{schedule.vaccineName}</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {schedule.ageDescription} • Dose {schedule.doseNumber}/{schedule.totalDoses}
                </p>
              </div>
              <span
                className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  schedule.status
                )}`}
              >
                {getStatusIcon(schedule.status)} {getStatusLabel(schedule.status)}
              </span>
            </div>
            <div className="guardian-table-card__rows">
              <div className="guardian-table-card__row">
                <span className="guardian-table-card__label">Due Date</span>
                <span className="guardian-table-card__value">{formatDate(schedule.dueDate)}</span>
              </div>
              <div className="guardian-table-card__row">
                <span className="guardian-table-card__label">Admin Date</span>
                <span className="guardian-table-card__value">{formatDate(schedule.adminDate)}</span>
              </div>
              <div className="guardian-table-card__row">
                <span className="guardian-table-card__label">Days</span>
                <span className={`guardian-table-card__value text-xs ${
                  schedule.isOverdue ? 'text-red-600 font-medium' :
                  schedule.isUpcoming ? 'text-yellow-600 font-medium' : 'text-gray-500'
                }`}>
                  {formatDays(schedule.daysOverdue) || "—"}
                </span>
              </div>
            </div>
          </article>)
         )}
      </div>

      {/* Desktop Table View */}
      <div className="guardian-table-scroll-shell hidden min-[768px]:block">
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
            {printableSchedules.map((schedule, index) =>(
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
              </tr>)
             )}
          </tbody>
        </table>
      </div>
    </>)
   ;

  return(
    <div className="space-y-6">
      <div ref={printAreaRef} className="hidden" aria-hidden="true">
        <style>{VACCINE_SCHEDULE_PRINTABLE_STYLES}</style>
        <div className="schedule-booklet-print">
          <div className="schedule-booklet-export">
            <div className="schedule-booklet-export__header">
              <div>
                <h1 className="schedule-booklet-export__title">
                  Child Immunization Schedule Booklet
                </h1>
                <p className="schedule-booklet-export__subtitle">
                  Vaccine schedule summary sourced from the live readiness and vaccination timeline.
                </p>
                <div className="schedule-booklet-export__meta">
                  <p><strong>Name:</strong> {childName}</p>
                  <p><strong>Control No.:</strong> {infantInfo.controlNumber || "N/A"}</p>
                  <p><strong>Date of Birth:</strong> {formatDate(infantInfo.dateOfBirth)}</p>
                  <p><strong>Guardian:</strong> {infantInfo.guardianName || "N/A"}</p>
                </div>
              </div>
              <div>
                <p className="schedule-booklet-export__subtitle">
                  {printDateRange.activeDateRangeLabel}
                </p>
              </div>
            </div>

            <div className="schedule-booklet-export__summary">
              <div className="schedule-booklet-export__summary-card">
                <p className="schedule-booklet-export__summary-label">Total</p>
                <p className="schedule-booklet-export__summary-value">
                  {printDateRange.hasAppliedDateRange
                    ? printableSummary.totalScheduled
                    :( summary.totalScheduled || 0)}
                </p>
              </div>
              <div className="schedule-booklet-export__summary-card">
                <p className="schedule-booklet-export__summary-label">Completed</p>
                <p className="schedule-booklet-export__summary-value">
                  {printDateRange.hasAppliedDateRange
                    ? printableSummary.completedCount
                    :( summary.completedCount || 0)}
                </p>
              </div>
              <div className="schedule-booklet-export__summary-card">
                <p className="schedule-booklet-export__summary-label">Overdue</p>
                <p className="schedule-booklet-export__summary-value">
                  {printDateRange.hasAppliedDateRange
                    ? printableSummary.overdueCount
                    :( summary.overdueCount || 0)}
                </p>
              </div>
              <div className="schedule-booklet-export__summary-card">
                <p className="schedule-booklet-export__summary-label">Upcoming</p>
                <p className="schedule-booklet-export__summary-value">
                  {printDateRange.hasAppliedDateRange
                    ? printableSummary.upcomingCount
                    :( summary.upcomingCount || 0)}
                </p>
              </div>
            </div>

            <table className="schedule-booklet-export__table">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Vaccine</th>
                  <th style={{ width: "9%" }}>Dose</th>
                  <th style={{ width: "17%" }}>Status</th>
                  <th style={{ width: "14%" }}>Due Date</th>
                  <th style={{ width: "14%" }}>Admin Date</th>
                  <th style={{ width: "20%" }}>Days</th>
                </tr>
              </thead>
              <tbody>
                {printableSchedules.map((schedule) =>(
                  <tr
                    key={`${schedule.vaccineId}-${schedule.doseNumber}-${schedule.dueDate || schedule.adminDate || "row"}`}
                  >
                    <td>
                      <span className="schedule-booklet-export__vaccine">
                        {schedule.vaccineName}
                      </span>
                      <span className="schedule-booklet-export__age">
                        {schedule.ageDescription}
                      </span>
                    </td>
                    <td>
                      {schedule.doseNumber}/{schedule.totalDoses}
                    </td>
                    <td>
                      <span
                        className={`schedule-booklet-export__status schedule-booklet-export__status--${
                          schedule.status || "pending"
                        }`}
                      >
                        {getStatusLabel(schedule.status)}
                      </span>
                    </td>
                    <td>{formatDate(schedule.dueDate)}</td>
                    <td>{formatDate(schedule.adminDate)}</td>
                    <td>{formatDays(schedule.daysOverdue) || "-"}</td>
                  </tr>)
                 )}
              </tbody>
            </table>

            <div className="schedule-booklet-export__signatures">
              <div>
                <p className="schedule-booklet-export__signature-label">
                  Health Worker Signature
                </p>
                <div className="schedule-booklet-export__signature-line" />
              </div>
              <div>
                <p className="schedule-booklet-export__signature-label">
                  Guardian Signature
                </p>
                <div className="schedule-booklet-export__signature-line" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header with infant info and summary */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Child Immunization Schedule Booklet
            </h3>
            {infantInfo &&(
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {infantInfo.firstName} {infantInfo.lastName} • DOB: {formatDate(infantInfo.dateOfBirth)}
              </p>)
             }
          </div>

          {/* Summary badges */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Total: {printDateRange.hasAppliedDateRange ? printableSummary.totalScheduled :( summary.totalScheduled || 0)}
              </span>
            </div>
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                ✓ Completed: {printDateRange.hasAppliedDateRange ? printableSummary.completedCount :( summary.completedCount || 0)}
              </span>
            </div>
            <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                ⚠ Overdue: {printDateRange.hasAppliedDateRange ? printableSummary.overdueCount :( summary.overdueCount || 0)}
              </span>
            </div>
            <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                ⏰ Upcoming: {printDateRange.hasAppliedDateRange ? printableSummary.upcomingCount :( summary.upcomingCount || 0)}
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
    </div>)
   ;}