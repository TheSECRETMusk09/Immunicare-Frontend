import React, { useState } from "react";
import {
  Save,
  RotateCcw,
  Shield,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";

const SecuritySettings = ({ settings, onSave, onReset }) => {
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

    if (localSettings.session_timeout !== undefined) {
      const timeout = parseInt(localSettings.session_timeout);
      if (isNaN(timeout) || timeout < 5 || timeout > 120) {
        newErrors.session_timeout =
          "Session timeout must be between 5 and 120 minutes";
      }
    }

    if (localSettings.password_expiry_days !== undefined) {
      const expiry = parseInt(localSettings.password_expiry_days);
      if (isNaN(expiry) || expiry < 30 || expiry > 365) {
        newErrors.password_expiry_days =
          "Password expiry must be between 30 and 365 days";
      }
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
      {/* Two-Factor Authentication */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 flex-shrink-0" />
          Two-Factor Authentication
        </h3>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Add an extra layer of security
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Enable two-factor authentication to protect your account with an
                additional verification step.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Two-Factor Authentication
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Require additional verification when signing in
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
            <input
              type="checkbox"
              checked={localSettings.two_factor_enabled || false}
              onChange={(e) =>
                handleChange("two_factor_enabled", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Login Notifications */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          Login Notifications
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Email me on new sign-in
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Get notified when someone signs into your account
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
            <input
              type="checkbox"
              checked={localSettings.login_notifications !== false}
              onChange={(e) =>
                handleChange("login_notifications", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Session Management */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 flex-shrink-0" />
          Session Management
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={localSettings.session_timeout || 30}
              onChange={(e) =>
                handleChange("session_timeout", parseInt(e.target.value))
              }
              className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                ${errors.session_timeout ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {errors.session_timeout && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.session_timeout}
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              You will be automatically logged out after this period of
              inactivity.
            </p>
          </div>
        </div>
      </div>

      {/* Password Policy */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 flex-shrink-0" />
          Password Policy
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Password Expiry (days)
            </label>
            <input
              type="number"
              min="30"
              max="365"
              value={localSettings.password_expiry_days || 90}
              onChange={(e) =>
                handleChange("password_expiry_days", parseInt(e.target.value))
              }
              className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                ${errors.password_expiry_days ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {errors.password_expiry_days && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.password_expiry_days}
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              You will be prompted to change your password after this period.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                IP Whitelist Enabled
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Restrict access to specific IP addresses
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
              <input
                type="checkbox"
                checked={localSettings.ip_whitelist_enabled || false}
                onChange={(e) =>
                  handleChange("ip_whitelist_enabled", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t dark:border-gray-700">
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

export default SecuritySettings;
