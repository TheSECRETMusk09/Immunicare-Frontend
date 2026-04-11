import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Button,
  PageHeader,
  Card,
  Alert,
  LoadingSpinner,
} from "../../components/UI";
import ImmunizationRecordBooklet from "../../components/ImmunizationRecordBooklet";
import apiClient from "../../utils/api";
import { normalizeInfantResponse } from "../../utils/adminDataAdapters";
import { ArrowLeft, FileCheck, FileText, Printer } from "lucide-react";
import { downloadWordDocument, PRINT_PAGE_PRESETS } from "../../utils/printDocumentExport";

const sanitizeFileSegment = (value) =>
  String(value || "document")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "document";

const collectInlineStyles = (needle) =>
  Array.from(document.querySelectorAll("style"))
    .map((styleNode) => styleNode.textContent || "")
    .filter((text) => text.includes(needle))
    .join("\n");

const downloadHtmlDocument = ({ title, filename, markup, styles = "" }) => {
  const htmlDocument = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { margin: 0; padding: 24px; background: #ffffff; color: #111827; font-family: Arial, sans-serif; }
        ${styles}
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

export default function ImmunizationRecordPage() {
  const { infantId } = useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [infant, setInfant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const returnTo =
    location.state?.returnTo || "/digital-papers?tab=download_center";

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
      '[data-print-action="immunization-record-print"]',
      "Printable immunization record content is not available yet.",
      () => window.print(),
    );

  const handleDownload = () =>
    triggerEmbeddedAction(
      '[data-print-action="immunization-record-download"]',
      "Printable immunization record content is not available yet.",
      () => {
        const printableNode = document.querySelector(".record-booklet-print");
        if (!printableNode) {
          setError("Printable immunization record content is not available yet.");
          return;
        }

        downloadHtmlDocument({
          title: `Child Immunization Record - ${infant?.first_name || "Child"} ${infant?.last_name || "Record"}`,
          filename: `Immunization_Record_${sanitizeFileSegment(infant?.last_name)}_${sanitizeFileSegment(infant?.first_name)}.html`,
          markup: printableNode.outerHTML,
          styles: collectInlineStyles("record-booklet-print"),
        });
      },
    );

  const handleDownloadWord = () =>
    triggerEmbeddedAction(
      '[data-print-action="immunization-record-download-word"]',
      "Printable immunization record content is not available yet.",
      () => {
        const printableNode = document.querySelector(".record-booklet-print");
        if (!printableNode) {
          setError("Printable immunization record content is not available yet.");
          return;
        }

        downloadWordDocument({
          html: `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Child Immunization Record</title><style>${collectInlineStyles("record-booklet-print")}</style></head><body>${printableNode.outerHTML}</body></html>`,
          filename: `Immunization_Record_${sanitizeFileSegment(infant?.last_name)}_${sanitizeFileSegment(infant?.first_name)}.docx`,
          title: `Child Immunization Record - ${infant?.first_name || "Child"} ${infant?.last_name || "Record"}`,
          headerText: "Child Immunization Record Booklet",
          footerText: "Immunicare immunization record",
          page: PRINT_PAGE_PRESETS.a4Landscape,
        });
      },
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading immunization record..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="danger">
          <p>Error loading immunization record: {error}</p>
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
        title="Child Immunization Record Booklet"
        subtitle={
          infant
            ? `Immunization history for ${infant.first_name} ${infant.last_name}`
            : "Complete immunization record for tracking vaccinations"
        }
        icon={<FileCheck className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(returnTo)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </Button>
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
        <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-2xl">
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
            <div className="text-right space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mother: {infant.mother_name || "N/A"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Father: {infant.father_name || "N/A"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Immunization Record Booklet Component */}
      {infantId ? (
        <ImmunizationRecordBooklet infantId={infantId} />
      ) : (
        <Alert variant="info">
          <p className="font-medium">Select an Infant</p>
          <p className="mt-1">
            Please select an infant to view their immunization record, or
            navigate from the Infant Management page.
          </p>
        </Alert>
      )}

      {/* Information Card */}
      <Card className="p-6 bg-gray-50 dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          📋 About This Record
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Purpose
            </p>
            <p>
              This record tracks all vaccines administered to the child from
              birth onwards.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              For Health Center Use
            </p>
            <p>
              This form is used by Barangay San Nicolas Health Center to
              document infant vaccinations.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
