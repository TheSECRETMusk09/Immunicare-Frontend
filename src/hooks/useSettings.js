import { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";

export const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getSettings();
      setSettings(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = err.message || "Failed to fetch settings";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (settingsArray) => {
    try {
      setError(null);
      const response = await apiClient.updateSettings(settingsArray);

      setSettings((prev) => {
        const updated = { ...(prev || {}) };
        settingsArray.forEach((setting) => {
          if (!updated[setting.category]) {
            updated[setting.category] = {};
          }
          updated[setting.category][setting.key] = setting.value;
        });
        return updated;
      });

      return response.data;
    } catch (err) {
      const errorMessage = err.message || "Failed to update settings";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const resetCategory = useCallback(async (category) => {
    try {
      setError(null);
      const response = await apiClient.resetSettingsCategory(category);

      setSettings((prev) => {
        const updated = { ...(prev || {}) };
        updated[category] = {};
        (response.data || []).forEach((setting) => {
          updated[category][setting.key] = setting.value;
        });
        return updated;
      });

      return response.data;
    } catch (err) {
      const errorMessage = err.message || "Failed to reset settings";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const exportSettings = useCallback(async () => {
    try {
      setError(null);
      return await apiClient.exportUserSettings();
    } catch (err) {
      const errorMessage = err.message || "Failed to export settings";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const importSettings = useCallback(async (importedSettings) => {
    try {
      setError(null);
      const response = await apiClient.importUserSettings(importedSettings);
      setSettings(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = err.message || "Failed to import settings";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    return fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    resetCategory,
    exportSettings,
    importSettings,
    refreshSettings,
  };
};
