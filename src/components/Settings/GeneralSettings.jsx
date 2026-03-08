import React, { useState } from "react";
import { Save, RotateCcw, Globe, Clock, Palette, Calendar } from "lucide-react";

const GeneralSettings = ({ settings, onSave, onReset }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!localSettings.language || localSettings.language.trim() === "") {
      newErrors.language = "Language is required";
    }

    if (!localSettings.timezone || localSettings.timezone.trim() === "") {
      newErrors.timezone = "Timezone is required";
    }

    if (
      !localSettings.theme ||
      !["light", "dark", "auto"].includes(localSettings.theme)
    ) {
      newErrors.theme = "Invalid theme selection";
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
      {/* Language & Region */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 flex-shrink-0" />
          Language & Region
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Language *
            </label>
            <select
              value={localSettings.language || "en"}
              onChange={(e) => handleChange("language", e.target.value)}
              className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                ${errors.language ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
            {errors.language && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.language}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Timezone *
            </label>
            <select
              value={localSettings.timezone || "Asia/Singapore"}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                ${errors.timezone ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
              <option value="UTC">UTC (UTC+0)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
              <option value="America/Los_Angeles">
                America/Los_Angeles (UTC-8)
              </option>
              <option value="Europe/London">Europe/London (UTC+0)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
            </select>
            {errors.timezone && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.timezone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 flex-shrink-0" />
          Appearance
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {["light", "dark", "auto"].map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => handleChange("theme", theme)}
                  className={`px-3 sm:px-4 py-3 sm:py-3 rounded-lg border-2 transition-all capitalize min-h-[48px] sm:min-h-[44px] touch-manipulation text-sm sm:text-base
                    ${
                      localSettings.theme === theme
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300"
                    }`}
                >
                  {theme}
                </button>
              ))}
            </div>
            {errors.theme && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.theme}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 flex-shrink-0" />
          Date & Time Format
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date Format
            </label>
            <select
              value={localSettings.date_format || "YYYY-MM-DD"}
              onChange={(e) => handleChange("date_format", e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base sm:text-sm min-h-[48px] sm:min-h-[40px]"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Time Format
            </label>
            <select
              value={localSettings.time_format || "24h"}
              onChange={(e) => handleChange("time_format", e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base sm:text-sm min-h-[48px] sm:min-h-[40px]"
            >
              <option value="24h">24-hour</option>
              <option value="12h">12-hour</option>
            </select>
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

export default GeneralSettings;
