import React from "react";
import { Card } from "../UI";

const ComplianceMonitor = ({
  infants,
  vaccinationRecords,
  vaccinationSchedules,
}) => {
  const calculateComplianceStats = () => {
    const stats = { high: 0, moderate: 0, low: 0 };

    infants.forEach((infant) => {
      const complianceRate = getComplianceRate(
        infant.id,
        vaccinationRecords,
        vaccinationSchedules
      );
      if (complianceRate >= 80) stats.high++;
      else if (complianceRate >= 50) stats.moderate++;
      else stats.low++;
    });

    return stats;
  };

  const stats = calculateComplianceStats();
  const totalInfants = infants.length;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Compliance Overview
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ComplianceCard
          title="High Compliance (≥80%)"
          count={stats.high}
          total={totalInfants}
          color="green"
          description="Children who are up-to-date with vaccinations"
        />
        <ComplianceCard
          title="Moderate Compliance (50-79%)"
          count={stats.moderate}
          total={totalInfants}
          color="yellow"
          description="Children who need attention"
        />
        <ComplianceCard
          title="Low Compliance (<50%)"
          count={stats.low}
          total={totalInfants}
          color="red"
          description="Children at risk - immediate action needed"
        />
      </div>
    </div>
  );
};

const ComplianceCard = ({ title, count, total, icon, color, description }) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    green: "bg-green-500 text-white",
    yellow: "bg-yellow-500 text-white",
    red: "bg-red-500 text-white",
  };

  return (
    <Card className="p-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>

      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {count}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {percentage}% of total children
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </Card>
  );
};

const getComplianceRate = (
  infantId,
  vaccinationRecords,
  vaccinationSchedules
) => {
  const infantRecords = vaccinationRecords.filter(
    (r) => r.infant_id === infantId && r.admin_date
  );
  const completed = infantRecords.length;
  const totalExpected = vaccinationSchedules.length * 2;
  return totalExpected > 0 ? Math.round((completed / totalExpected) * 100) : 0;
};

export default ComplianceMonitor;
