import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Button,
  PageHeader,
  Card,
  Alert,
  LoadingSpinner,
} from "../../components/UI";
import VaccineScheduleBooklet from "../../components/VaccineScheduleBooklet";
import apiClient from "../../utils/api";
import { normalizeInfantResponse } from "../../utils/adminDataAdapters";
import { Syringe, FileText, Printer } from "lucide-react";
import { downloadWordDocument, PRINT_PAGE_PRESETS } from "../../utils/printDocumentExport";

const sanitizeFileSegment = (value) =>
  String(value || "document")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "document";

const downloadHtmlDocument = ({ title, filename, markup }) => {
  const htmlDocument = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { margin: 0; padding: 24px; background: #ffffff; color: #111827; font-family: Arial, sans-serif; }
        .bg-white { background: #ffffff; }
        .rounded-xl { border-radius: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
        .border, .border-b, .border-t { border-color: #d1d5db; }
      </style>
    </head>
    <body>
      ${markup}
    </body>
  </html>`;

  const blob = new Blob([htmlDocument], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function VaccineSchedulePage() {
  const { infantId } = useParams();
  const { isAdmin } = useAuth();
  const [infant, setInfant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInfant = useCallback(async () => {
    if (!infantId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await apiClient.getInfant(
        isAdmin ? `${infantId}?scope=system` : infantId,
      );
      setInfant(normalizeInfantResponse(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [infantId, isAdmin]);

  useEffect(() => {
    fetchInfant();
  }, [fetchInfant]);

  const triggerEmbeddedAction = (actionSelector, missingMessage, fallbackAction) => {
    const actionButton = document.querySelector(actionSelector);
    if (!actionButton && typeof fallbackAction === "function") {
      fallbackAction();
      return;
    }

    if (!actionButton) {
      setError(missingMessage);
      return;
    }

    actionButton.click();
  };

  const handlePrint = () =>
    triggerEmbeddedAction(
      '[data-print-action="vaccine-schedule-print"]',
      "Printable vaccine schedule content is not available yet.",
      () => window.print(),
    );

  const handleDownload = () =>
    triggerEmbeddedAction(
      '[data-print-action="vaccine-schedule-download"]',
      "Printable vaccine schedule content is not available yet.",
      () => {
        const printableNode = document.getElementById("vaccine-schedule-print");
        if (!printableNode) {
          setError("Printable vaccine schedule content is not available yet.");
          return;
        }

        downloadHtmlDocument({
          title: `Vaccine Schedule - ${infant?.first_name || "Child"} ${infant?.last_name || "Schedule"}`,
          filename: `Vaccine_Schedule_${sanitizeFileSegment(infant?.last_name)}_${sanitizeFileSegment(infant?.first_name)}.html`,
          markup: printableNode.outerHTML,
        });
      },
    );

  const handleDownloadWord = () =>
    triggerEmbeddedAction(
      '[data-print-action="vaccine-schedule-download-word"]',
      "Printable vaccine schedule content is not available yet.",
      () => {
        const printableNode = document.getElementById("vaccine-schedule-print");
        if (!printableNode) {
          setError("Printable vaccine schedule content is not available yet.");
          return;
        }

        downloadWordDocument({
          html: `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Vaccine Schedule</title></head><body>${printableNode.outerHTML}</body></html>`,
          filename: `Vaccine_Schedule_${sanitizeFileSegment(infant?.last_name)}_${sanitizeFileSegment(infant?.first_name)}.docx`,
          title: `Vaccine Schedule - ${infant?.first_name || "Child"} ${infant?.last_name || "Schedule"}`,
          headerText: "Vaccine Schedule Booklet",
          footerText: "Immunicare vaccine schedule",
          page: PRINT_PAGE_PRESETS.legalLandscape,
        });
      },
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading vaccine schedule..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="danger">
          <p>Error loading vaccine schedule: {error}</p>
        </Alert>
        <Button onClick={fetchInfant} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title="Vaccine Schedule Booklet"
        subtitle={
          infant
            ? `Schedule for ${infant.first_name} ${infant.last_name}`
            : "Standard vaccination schedule for infants below 1 year old"
        }
        icon={<Syringe className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="secondary">
              <FileText className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button onClick={handleDownloadWord} variant="secondary">
              <FileText className="w-4 h-4 mr-2" /> Download Word
            </Button>
            <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print</Button>
          </div>
        }
      />

      {/* Infant Summary Card */}
      {infant && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-2xl">
                👶
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {infant.first_name} {infant.middle_name || ""}{" "}
                  {infant.last_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  DOB: {new Date(infant.dob).toLocaleDateString()} •{" "}
                  {infant.sex === "M" ? "Male" : "Female"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current Age
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {infant.dob
                  ? Math.floor(
                      (new Date() - new Date(infant.dob)) /
                        (365.25 * 24 * 60 * 60 * 1000),
                    ) + " years"
                  : "N/A"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Vaccine Schedule Booklet Component */}
      {infantId ? (
        <VaccineScheduleBooklet infantId={infantId} />
      ) : (
        <Alert variant="info">
          <p className="font-medium">Select an Infant</p>
          <p className="mt-1">
            Please select an infant to view their vaccine schedule, or navigate
            from the Infant Management page.
          </p>
        </Alert>
      )}

      {/* Information Card */}
      <Card className="p-6 bg-gray-50 dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          📋 About This Schedule
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Complete Schedule
            </p>
            <p>
              This schedule covers all recommended vaccines from birth to 1 year
              of age.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Status Indicators
            </p>
            <p>✓ Completed • ● Due • ⚠ Overdue • ○ Pending</p>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Reminder
            </p>
            <p>
              Vaccines not listed may be available at private hospitals or
              clinics.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
