import React from "react";
import {
  Shield,
  Calendar,
  Clock,
  CheckCircle,
  Baby,
  Syringe,
} from "lucide-react";

/**
 * AccountStatsCard Component
 * Displays account overview statistics and information
 *
 * @param {Object} props
 * @param {Object} props.user - User data object
 * @param {number} props.childrenCount - Number of registered children
 * @param {number} props.vaccinationCount - Number of completed vaccinations
 */
const AccountStatsCard = ({ user, childrenCount = 0, vaccinationCount = 0 }) => {
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "N/A";

  const lastLogin = user?.last_login
    ? new Date(user.last_login).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Today";

  const stats = [
    {
      icon: Calendar,
      label: "Member Since",
      value: memberSince,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: Clock,
      label: "Last Login",
      value: lastLogin,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: Baby,
      label: "Children Registered",
      value: childrenCount.toString(),
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
    {
      icon: Syringe,
      label: "Vaccinations Completed",
      value: vaccinationCount.toString(),
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Account Stats
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your account overview
            </p>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Account Status
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            Active
          </span>
        </div>

        {/* Stats Grid */}
        <div className="space-y-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div
                  className={`w-10 h-10 ${stat.bgColor} dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300`}
                >
                  <Icon className={`w-5 h-5 ${stat.color} dark:text-white`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AccountStatsCard;
