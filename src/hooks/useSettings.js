import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";

export const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    return localStorage.getItem("token");
  }, []);

  // Create axios instance with auth headers
  const createAuthHeaders = useCallback(() => {
    const token = getAuthToken();
    return {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };
  }, [getAuthToken]);

  // Fetch all settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${API_BASE_URL}/settings`,
        createAuthHeaders(),
      );
      setSettings(response.data.data);
      return response.data.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to fetch settings";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [createAuthHeaders]);

  // Update settings
  const updateSettings = useCallback(
    async (settingsArray) => {
      try {
        setError(null);
        const response = await axios.put(
          `${API_BASE_URL}/settings`,
          { settings: settingsArray },
          createAuthHeaders(),
        );

        // Update local state with new settings
        setSettings((prev) => {
          const updated = { ...prev };
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
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          "Failed to update settings";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [createAuthHeaders],
  );

  // Reset category to defaults
  const resetCategory = useCallback(
    async (category) => {
      try {
        setError(null);
        const response = await axios.post(
          `${API_BASE_URL}/settings/${category}/reset`,
          {},
          createAuthHeaders(),
        );

        // Update local state with reset settings
        setSettings((prev) => {
          const updated = { ...prev };
          updated[category] = {};
          response.data.data.forEach((setting) => {
            updated[category][setting.key] = setting.value;
          });
          return updated;
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          "Failed to reset settings";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [createAuthHeaders],
  );

  // Export settings
  const exportSettings = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(
        `${API_BASE_URL}/settings/export`,
        createAuthHeaders(),
      );
      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to export settings";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [createAuthHeaders]);

  // Import settings
  const importSettings = useCallback(
    async (importedSettings) => {
      try {
        setError(null);
        const response = await axios.post(
          `${API_BASE_URL}/settings/import`,
          { settings: importedSettings },
          createAuthHeaders(),
        );

        // Update local state with imported settings
        setSettings(response.data.data);

        return response.data;
      } catch (err) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          "Failed to import settings";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [createAuthHeaders],
  );

  // Refresh settings
  const refreshSettings = useCallback(async () => {
    return fetchSettings();
  }, [fetchSettings]);

  // Fetch settings on mount
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
