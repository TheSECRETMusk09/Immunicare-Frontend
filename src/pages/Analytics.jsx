import React from "react";
import { BarChart2 } from "lucide-react";
import { PageHeader } from "../components/UI";
import AnalyticsDashboard from "../components/Analytics/AnalyticsDashboard";

const Analytics = () => {
  return (
    <section className="p-4 md:p-6" aria-label="Analytics Dashboard">
      <PageHeader
        title="Analytics Dashboard"
        subtitle="Operational analytics for one Barangay Health Center in Pasig City"
        icon={<BarChart2 className="w-8 h-8 text-white" />}
      />

      <div className="mt-6">
        <AnalyticsDashboard />
      </div>
    </section>
  );
};

export default Analytics;
