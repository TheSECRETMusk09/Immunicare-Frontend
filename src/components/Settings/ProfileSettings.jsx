import React, { useState } from "react";
import {
  Save,
  RotateCcw,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";

const ProfileSettings = ({ settings, onSave, onReset }) => {
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
      !localSettings.display_name ||
      localSettings.display_name.trim() === ""
    ) {
      newErrors.display_name = "Display name is required";
    } else if (localSettings.display_name.length < 2) {
      newErrors.display_name = "Display name must be at least 2 characters";
    } else if (localSettings.display_name.length > 50) {
      newErrors.display_name = "Display name must be less than 50 characters";
    }

    if (
      localSettings.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(localSettings.email)
    ) {
      newErrors.email = "Invalid email format";
    }

    if (localSettings.phone && !/^[+]?[\d\s-()]+$/.test(localSettings.phone)) {
      newErrors.phone = "Invalid phone number format";
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
      {/* Basic Information */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 flex-shrink-0" />
          Basic Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Display Name *
            </label>
            <input
              type="text"
              value={localSettings.display_name || ""}
              onChange={(e) => handleChange("display_name", e.target.value)}
              placeholder="Enter your display name"
              className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                ${errors.display_name ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {errors.display_name && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.display_name}
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              This name will be displayed on your profile and in communications.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Bio
            </label>
            <textarea
              value={localSettings.bio || ""}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="Tell us a little about yourself"
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-base sm:text-sm min-h-[100px]"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {localSettings.bio?.length || 0}/500 characters
            </p>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 flex-shrink-0" />
          Contact Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="email"
                value={localSettings.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="your.email@example.com"
                className={`w-full pl-10 pr-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                  ${errors.email ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.email}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="tel"
                value={localSettings.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
                className={`w-full pl-10 pr-3 py-2.5 sm:py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base sm:text-sm min-h-[48px] sm:min-h-[40px]
                  ${errors.phone ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 flex-shrink-0" />
          Location
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Address
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <textarea
              value={localSettings.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Enter your address"
              rows={3}
              className="w-full pl-10 pr-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-base sm:text-sm min-h-[80px]"
            />
          </div>
        </div>
      </div>

      {/* Avatar URL */}
      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 flex-shrink-0" />
          Profile Picture
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Avatar URL
          </label>
          <input
            type="url"
            value={localSettings.avatar_url || ""}
            onChange={(e) => handleChange("avatar_url", e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base sm:text-sm min-h-[48px] sm:min-h-[40px]"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Enter a URL for your profile picture image.
          </p>
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

export default ProfileSettings;
