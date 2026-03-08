import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import GeneralSettings from "./GeneralSettings";
import ProfileSettings from "./ProfileSettings";
import SecuritySettings from "./SecuritySettings";
import NotificationSettings from "./NotificationSettings";
import { useSettings } from "../../hooks/useSettings";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

const SettingsManager = () => {
  const [activeTab, setActiveTab] = useState("general");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { isOnline } = useNetworkStatus();

  const {
    settings,
    loading,
    error,
    updateSettings,
    resetCategory,
    exportSettings,
    importSettings,
    refreshSettings,
  } = useSettings();

  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "profile", label: "Profile", icon: SettingsIcon },
    { id: "security", label: "Security", icon: SettingsIcon },
    { id: "notification", label: "Notifications", icon: SettingsIcon },
  ];

  const handleSave = async (category, categorySettings) => {
    if (!isOnline) {
      setSaveError("You are offline. Please check your internet connection.");
      return;
    }

    setSaveError(null);
    setSaveSuccess(false);

    try {
      const settingsArray = Object.entries(categorySettings).map(
        ([key, value]) => ({
          category,
          key,
          value,
          type:
            typeof value === "boolean"
              ? "boolean"
              : typeof value === "number"
                ? "number"
                : "string",
        }),
      );

      await updateSettings(settingsArray);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Failed to save settings");
    }
  };

  const handleReset = async (category) => {
    if (
      !window.confirm(
        `Are you sure you want to reset ${category} settings to defaults?`,
      )
    ) {
      return;
    }

    try {
      await resetCategory(category);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Failed to reset settings");
    }
  };

  const handleExport = async () => {
    try {
      const exported = await exportSettings();
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `immunicare-settings-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(err.message || "Failed to export settings");
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);
      await importSettings(importedSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Failed to import settings");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Manage your account preferences and system settings
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[40px] touch-manipulation"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="sm:inline">Export</span>
          </button>
          <label className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] sm:min-h-[40px] touch-manipulation">
            <SettingsIcon className="w-4 h-4" />
            <span className="sm:inline">Import</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => refreshSettings()}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[40px] touch-manipulation"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Network Status */}
      {!isOnline && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>
            You are currently offline. Changes will be saved when you reconnect.
          </span>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Error Message */}
      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Settings Container */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Tabs - Horizontal scrollable on mobile */}
        <div className="border-b dark:border-gray-700 overflow-x-auto">
          <nav className="flex min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[48px] sm:min-h-[44px] touch-manipulation
                    ${
                      activeTab === tab.id
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === "general" && (
            <GeneralSettings
              settings={settings?.general || {}}
              onSave={(s) => handleSave("general", s)}
              onReset={() => handleReset("general")}
            />
          )}
          {activeTab === "profile" && (
            <ProfileSettings
              settings={settings?.profile || {}}
              onSave={(s) => handleSave("profile", s)}
              onReset={() => handleReset("profile")}
            />
          )}
          {activeTab === "security" && (
            <SecuritySettings
              settings={settings?.security || {}}
              onSave={(s) => handleSave("security", s)}
              onReset={() => handleReset("security")}
            />
          )}
          {activeTab === "notification" && (
            <NotificationSettings
              settings={settings?.notification || {}}
              onSave={(s) => handleSave("notification", s)}
              onReset={() => handleReset("notification")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsManager;
