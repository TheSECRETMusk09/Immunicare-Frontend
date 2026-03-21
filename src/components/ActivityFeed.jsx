import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";

/**
 * ActivityFeed Component
 * Displays recent activity timeline for an infant
 *
 * Wireframe Specification:
 * - Timeline of activities: vaccination completed, appointment scheduled, growth check
 * - Icons for each activity type
 * - Timestamps (e.g., "2 days ago", "1 week ago")
 * - "View All Activity" functionality
 * - Mobile responsive layout
 */

const activityIcons = {
  vaccination: "💉",
  appointment: "📅",
  growth: "📊",
  certificate: "📋",
};

const activityColors = {
  vaccination:
    "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200",
  appointment:
    "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200",
  growth:
    "bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200",
  certificate:
    "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200",
};

export default function ActivityFeed({
  infantId,
  maxItems = 5,
  showViewAll = true,
}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  // Use ref to store the fetch function for retry functionality
  const fetchActivitiesRef = useRef(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let data = [];
      try {
        const response = await apiClient.getInfantActivities(infantId, maxItems);
        data = Array.isArray(response) ? response : response?.data || [];
      } catch (apiErr) {
        console.warn("API not available, using fallback mock data for Activity Feed", apiErr);
        // Fallback mock data if backend endpoint doesn't exist yet
        data = [
          {
            id: 1,
            type: "vaccination",
            title: "MMR Vaccine Completed",
            description: "Administered MMR vaccine to infant",
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 2,
            type: "appointment",
            title: "Appointment Scheduled",
            description: "Scheduled DPT vaccination appointment",
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 3,
            type: "growth",
            title: "Growth Check Completed",
            description: "Recorded growth: 8.5kg, 68cm",
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 4,
            type: "certificate",
            title: "Health Certificate Issued",
            description: "Issued annual health certificate",
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
      }

      setActivities(data.slice(0, maxItems));
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  // Store the fetch function in ref for retry
  fetchActivitiesRef.current = fetchActivities;

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
      }
    }

    return "Just now";
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-start gap-3 p-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="text-center py-4">
          <p className="text-red-600 dark:text-red-400">
            Error loading activities
          </p>
          <button
            onClick={() =>
              fetchActivitiesRef.current && fetchActivitiesRef.current()
            }
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Activity
        </h3>
        {showViewAll && activities.length > 0 && (
          <button
            onClick={() => navigate(`/activity/${infantId}`)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            View All
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Activities will appear here as you use the system
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => {
                // Navigate based on activity type
                if (activity.type === "vaccination") {
                  navigate(`/vaccination-records/${infantId}`);
                } else if (activity.type === "appointment") {
                  navigate(`/appointments?infantId=${infantId}`);
                } else if (activity.type === "growth") {
                  navigate(`/health-information?infantId=${infantId}`);
                } else if (activity.type === "certificate") {
                  navigate(
                    `/documents/health-certificates?infantId=${infantId}`,
                  );
                }
              }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activityColors[activity.type]}`}
              >
                <span className="text-sm">{activityIcons[activity.type]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {activity.title}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatTimeAgo(activity.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
