import React, { useState } from "react";
import {
  Save,
  RotateCcw,
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Clock,
} from "lucide-react";

const NotificationSettings = ({ settings, onSave, onReset }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (
      !localSettings.digest_frequency ||
      !["immediate", "hourly", "daily", "weekly"].includes(
        localSettings.digest_frequency,
      )
    ) {
      newErrors.digest_frequency = "Invalid digest frequency";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(localSettings);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 flex-shrink-0" />
          Notification Channels
        </h3>
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Email Notifications
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
              <input
                type="checkbox"
                checked={localSettings.email_enabled !== false}
                onChange={(e) =>
                  handleChange("email_enabled", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Push Notifications
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive in-app notifications
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
              <input
                type="checkbox"
                checked={localSettings.push_enabled !== false}
                onChange={(e) => handleChange("push_enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  SMS Alerts
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive critical alerts via SMS
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
              <input
                type="checkbox"
                checked={localSettings.sms_enabled || false}
                onChange={(e) => handleChange("sms_enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Digest Settings */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 flex-shrink-0" />
          Digest Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notification Digest Frequency
            </label>
            <select
              value={localSettings.digest_frequency || "daily"}
              onChange={(e) => handleChange("digest_frequency", e.target.value)}
              className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                ${errors.digest_frequency ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="immediate">Immediate</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            {errors.digest_frequency && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.digest_frequency}
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Choose how often you want to receive notification summaries.
            </p>
          </div>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 flex-shrink-0" />
          Quiet Hours
        </h3>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 sm:p-4 mb-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Pause notifications during specific hours
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                You won't receive notifications during quiet hours, except for
                critical alerts.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Quiet Hours Start
            </label>
            <input
              type="time"
              value={localSettings.quiet_hours_start || "22:00"}
              onChange={(e) =>
                handleChange("quiet_hours_start", e.target.value)
              }
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base sm:text-sm min-h-[48px] sm:min-h-[40px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Quiet Hours End
            </label>
            <input
              type="time"
              value={localSettings.quiet_hours_end || "08:00"}
              onChange={(e) => handleChange("quiet_hours_end", e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base sm:text-sm min-h-[48px] sm:min-h-[40px]"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Notifications will be paused between{" "}
          {localSettings.quiet_hours_start || "22:00"} and{" "}
          {localSettings.quiet_hours_end || "08:00"}.
        </p>
      </div>

      {/* Notification Types */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Notification Types
        </h3>
        <div className="space-y-3">
          {[
            {
              key: "appointments",
              label: "Appointment reminders",
              description: "Get notified about upcoming appointments",
            },
            {
              key: "vaccinations",
              label: "Vaccination due dates",
              description: "Reminders for scheduled vaccinations",
            },
            {
              key: "inventory",
              label: "Inventory alerts",
              description: "Low stock and inventory updates",
            },
            {
              key: "system",
              label: "System updates",
              description: "Important system announcements",
            },
          ].map((type) => (
            <div
              key={type.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {type.label}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {type.description}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
                <input
                  type="checkbox"
                  checked={localSettings[`notify_${type.key}`] !== false}
                  onChange={(e) =>
                    handleChange(`notify_${type.key}`, e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="form-actions-standardized">
        <button
          onClick={handleReset}
          className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[40px] touch-manipulation"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[40px] touch-manipulation"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
