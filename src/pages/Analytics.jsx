import React from "react";
import { BarChart2 } from "lucide-react";
import { PageHeader } from "../components/UI";
import AnalyticsDashboard from "../components/Analytics/AnalyticsDashboard";

const Analytics = () => {
  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900"
      aria-label="Analytics Dashboard"
    >
      {/* Sticky Header */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Analytics Dashboard"
          subtitle="Operational analytics for one Barangay Health Center in Pasig City"
          icon={<BarChart2 className="w-8 h-8 text-white" />}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:px-6 sm:pb-6 pt-3">
        <AnalyticsDashboard />
      </div>
    </div>
  );
};

export default Analytics;
