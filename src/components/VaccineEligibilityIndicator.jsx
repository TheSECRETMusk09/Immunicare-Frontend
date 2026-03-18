import React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle, Info } from 'lucide-react';

/**
 * VaccineEligibilityIndicator Component
 *
 * Shows vaccine eligibility status:
 * - ✅ Ready - Can be administered now
 * - ⏰ Upcoming - Due within 2 weeks
 * - ❌ Not eligible - Show reason (completed, contraindication, too early)
 * - Already administered - Show completion date
 */

const statusConfig = {
  ready: {
    icon: CheckCircle,
    label: 'Ready',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    description: 'Can be administered now'
  },
  upcoming: {
    icon: Clock,
    label: 'Upcoming',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    description: 'Due within 2 weeks'
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    description: 'All doses completed'
  },
  contraindicated: {
    icon: XCircle,
    label: 'Not Eligible',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    description: 'Contraindicated'
  },
  too_early: {
    icon: Clock,
    label: 'Too Early',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-700',
    description: 'Not yet due'
  },
  interval_not_met: {
    icon: AlertCircle,
    label: 'Wait',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    description: 'Minimum interval not met'
  },
  not_ready: {
    icon: AlertCircle,
    label: 'Not Ready',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-700',
    description: 'Not ready for administration'
  }
};

export default function VaccineEligibilityIndicator({
  vaccine,
  showDetails = true,
  compact = false
}) {
  const status = vaccine.status || 'not_ready';
  const config = statusConfig[status] || statusConfig.not_ready;
  const StatusIcon = config.icon;

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.color}`}>
        <StatusIcon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <StatusIcon className={`w-5 h-5 mt-0.5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`font-medium ${config.color}`}>
              {vaccine.vaccineName}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
              {config.label}
            </span>
          </div>

          {showDetails && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {/* Dose information */}
              {vaccine.nextDoseNumber && (
                <p>
                  <span className="font-medium">Dose: </span>
                  {vaccine.nextDoseNumber} of {vaccine.totalDoses}
                  {vaccine.dosesCompleted > 0 && ` (${vaccine.dosesCompleted} completed)`}
                </p>
              )}

              {/* Due date */}
              {vaccine.dueDate && status !== 'completed' && (
                <p>
                  <span className="font-medium">Due: </span>
                  {formatDate(vaccine.dueDate)}
                  {vaccine.daysUntilDue !== undefined && vaccine.daysUntilDue > 0 && (
                    <span className="ml-1 text-gray-500">
                      (in {vaccine.daysUntilDue} days)
                    </span>
                  )}
                </p>
              )}

              {/* Last dose date for completed vaccines */}
              {status === 'completed' && vaccine.lastDoseDate && (
                <p>
                  <span className="font-medium">Last dose: </span>
                  {formatDate(vaccine.lastDoseDate)}
                </p>
              )}

              {/* Age information */}
              {vaccine.ageInDays !== undefined && (
                <p>
                  <span className="font-medium">Current age: </span>
                  {Math.floor(vaccine.ageInDays / 30)} months ({vaccine.ageInDays} days)
                </p>
              )}

              {/* Reason for not eligibility */}
              {vaccine.reason && status !== 'ready' && status !== 'upcoming' && status !== 'completed' && (
                <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded">
                  <p className="font-medium text-red-600 dark:text-red-400">
                    <Info className="w-3 h-3 inline mr-1" />
                    Reason:
                  </p>
                  <p className="text-red-600 dark:text-red-400">{vaccine.reason}</p>
                </div>
              )}

              {/* Contraindications */}
              {vaccine.contraindicationCheck?.contraindicated && (
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    Contraindications:
                  </p>
                  {vaccine.contraindicationCheck.reasons?.map((reason, index) => (
                    <p key={index} className="text-red-600 dark:text-red-400 text-sm">
                      - {reason.description || reason.type}
                      {reason.severity && ` (${reason.severity})`}
                    </p>
                  ))}
                </div>
              )}

              {/* Interval check */}
              {vaccine.intervalCheck && !vaccine.intervalCheck.passed && (
                <p className="text-orange-600 dark:text-orange-400">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {vaccine.intervalCheck.reason}
                </p>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {config.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * VaccineEligibilityList Component
 * Displays a list of vaccines grouped by eligibility status
 */
export function VaccineEligibilityList({
  eligibleVaccines = [],
  upcomingVaccines = [],
  notEligibleVaccines = [],
  completedVaccines = [],
  showDetails = true
}) {
  const allVaccines = [
    ...eligibleVaccines.map(v => ({ ...v, status: 'ready' })),
    ...upcomingVaccines.map(v => ({ ...v, status: 'upcoming' })),
    ...notEligibleVaccines,
    ...completedVaccines.map(v => ({ ...v, status: 'completed' }))
  ];

  if (allVaccines.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>No vaccination schedule found for this infant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ready vaccines */}
      {eligibleVaccines.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Ready to Administer ({eligibleVaccines.length})
          </h3>
          <div className="space-y-2">
            {eligibleVaccines.map((vaccine, index) => (
              <VaccineEligibilityIndicator
                key={`ready-${vaccine.vaccineId}-${index}`}
                vaccine={{ ...vaccine, status: 'ready' }}
                showDetails={showDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming vaccines */}
      {upcomingVaccines.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming (within 2 weeks) ({upcomingVaccines.length})
          </h3>
          <div className="space-y-2">
            {upcomingVaccines.map((vaccine, index) => (
              <VaccineEligibilityIndicator
                key={`upcoming-${vaccine.vaccineId}-${index}`}
                vaccine={{ ...vaccine, status: 'upcoming' }}
                showDetails={showDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* Not eligible vaccines */}
      {notEligibleVaccines.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Not Currently Eligible ({notEligibleVaccines.length})
          </h3>
          <div className="space-y-2">
            {notEligibleVaccines.map((vaccine, index) => (
              <VaccineEligibilityIndicator
                key={`not-eligible-${vaccine.vaccineId}-${index}`}
                vaccine={vaccine}
                showDetails={showDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed vaccines */}
      {completedVaccines.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed ({completedVaccines.length})
          </h3>
          <div className="space-y-2">
            {completedVaccines.map((vaccine, index) => (
              <VaccineEligibilityIndicator
                key={`completed-${vaccine.vaccineId}-${index}`}
                vaccine={{ ...vaccine, status: 'completed' }}
                showDetails={showDetails}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
