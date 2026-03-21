import React from "react";
import { Link } from "react-router-dom";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import { Alert, Button } from "../components/UI";
import { guardianRoutePaths } from "../utils/routePaths";
import {
  FileText,
  Calendar,
  Syringe,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const documentModules = [
  {
    title: "Vaccination Records",
    description:
      "Review the official administered doses, schedule views, and record booklet for each child.",
    to: guardianRoutePaths.vaccinationRecords,
    icon: FileText,
    cta: "Open records",
  },
  {
    title: "Immunization Chart",
    description:
      "Open the synchronized immunization chart view sourced from the same vaccination records used across the portal.",
    to: guardianRoutePaths.immunizationChart,
    icon: Syringe,
    cta: "Open chart",
  },
  {
    title: "Appointments",
    description:
      "Book or confirm clinic visits for pending and overdue doses when the child is due for vaccination.",
    to: guardianRoutePaths.appointmentBooking(),
    icon: Calendar,
    cta: "Book appointment",
  },
];

export default function GuardianDocumentsPage() {
  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 guardian-module-mobile-header-spacing">
      <GuardianModuleHeader
        title="Documents"
        subtitle="Current document and record access for your children"
        icon={<FileText className="w-8 h-8 text-white" />}
      />

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">
        <Alert variant="info">
          Guardian digital documents are being consolidated into one connected workflow.
          For this release, the official child documents still come from the live
          vaccination records, immunization chart, and appointment modules listed below.
        </Alert>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
                Source-of-truth reminder
              </h2>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                Any completed vaccine shown in the records and chart modules is the same
                vaccination data used for readiness, scheduling, notifications, and admin review.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documentModules.map((module) => {
            const Icon = module.icon;

            return (
              <article
                key={module.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {module.title}
                  </h2>
                </div>

                <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
                  {module.description}
                </p>

                <Button asChild>
                  <Link to={module.to}>
                    {module.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
