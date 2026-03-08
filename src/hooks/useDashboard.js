import { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";

/**
 * Normalizes API response data to ensure it's always an array.
 * Handles cases where API returns wrapped objects like { data: [...] } or { guardians: [...] }
 * @param {any} data - The data to normalize
 * @param {string} [wrapperKey] - Optional specific wrapper key to look for
 * @returns {Array} - Normalized array
 */
export const normalizeToArray = (data, wrapperKey = null) => {
  // Handle null/undefined
  if (data == null) {
    console.warn("API returned null/undefined data");
    return [];
  }

  // Handle direct arrays
  if (Array.isArray(data)) {
    return data;
  }

  // Handle count-only responses like {count: 5}
  if (typeof data === "object" && data !== null) {
    // Check for count-based pagination responses
    if ("count" in data && Object.keys(data).length === 1) {
      console.warn("API returned count-only response:", data);
      return [];
    }

    // If a specific wrapper key is provided, use it first
    if (wrapperKey && Array.isArray(data[wrapperKey])) {
      return data[wrapperKey];
    }

    // Check for common API response wrapper keys
    const wrapperKeys = [
      "data",
      "results",
      "items",
      "guardians",
      "users",
      "admins",
      "infants",
      "appointments",
      "records",
      "vaccinations",
      "inventory",
      "templates",
    ];
    for (const key of wrapperKeys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }

    // If it's an empty object or non-array object, warn and return empty array
    console.warn("API returned an object instead of an array:", data);
    return [];
  }

  // Handle other types (string, number, etc.)
  console.warn(`API returned unexpected data type: ${typeof data}`);
  return [];
};

export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    infants: 0,
    guardians: 0,
    appointments: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.getDashboardStats();
        // Stats endpoint returns an object, not an array
        setStats(data || {});
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
};

export const useInfants = () => {
  const [infants, setInfants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInfants = async () => {
      try {
        const data = await apiClient.getDashboardInfants();
        setInfants(normalizeToArray(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInfants();
  }, []);

  return { infants, loading, error };
};

export const useGuardians = () => {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGuardians = async () => {
    try {
      const data = await apiClient.getDashboardGuardians();
      setGuardians(normalizeToArray(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, []);

  const refreshGuardians = () => {
    setLoading(true);
    return fetchGuardians();
  };

  return { guardians, loading, error, refreshGuardians };
};

export const useAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const data = await apiClient.getDashboardAppointments();
        setAppointments(normalizeToArray(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  return { appointments, loading, error };
};

export const useVaccinationAnalytics = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiClient.getVaccinationAnalytics();
        setData(normalizeToArray(result));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};

export const useAppointmentAnalytics = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiClient.getAppointmentAnalytics();
        setData(normalizeToArray(result));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};

// System Users Management Hook
export const useSystemUsers = () => {
  const [systemUsers, setSystemUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSystemUsers = async () => {
    try {
      const data = await apiClient.getSystemUsers();
      setSystemUsers(normalizeToArray(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemUsers();
  }, []);

  const refreshSystemUsers = () => {
    setLoading(true);
    return fetchSystemUsers();
  };

  const createUser = async (userData) => {
    try {
      const response = await apiClient.createSystemUser(userData);
      const createdUser = response?.user || response?.data?.user || null;

      if (!createdUser) {
        return {
          success: false,
          error:
            response?.error || "Create user succeeded but no normalized user payload was returned",
        };
      }

      setSystemUsers((prev) => [createdUser, ...prev]);
      return {
        success: true,
        user: createdUser,
        message: response?.message || "System user created successfully",
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateUser = async (id, userData) => {
    try {
      const response = await apiClient.updateSystemUser(id, userData);
      const updatedUser = response?.user || response?.data?.user || null;

      if (!updatedUser) {
        return {
          success: false,
          error:
            response?.error || "Update user succeeded but no normalized user payload was returned",
        };
      }

      setSystemUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, ...updatedUser } : user,
        ),
      );
      return {
        success: true,
        user: updatedUser,
        message: response?.message || "System user updated successfully",
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteUser = async (id) => {
    try {
      const response = await apiClient.deleteSystemUser(id);
      setSystemUsers((prev) => prev.filter((user) => user.id !== id));
      return {
        success: true,
        message: response?.message || "System user deleted successfully",
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const toggleUserActive = async (id, isActive) => {
    try {
      const response = await apiClient.toggleUserActive(id, isActive);
      const updatedUser = response?.user || response?.data?.user || null;

      if (!updatedUser) {
        return {
          success: false,
          error:
            response?.error || "Toggle active succeeded but no normalized user payload was returned",
        };
      }

      setSystemUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, ...updatedUser } : user,
        ),
      );
      return {
        success: true,
        user: updatedUser,
        message:
          response?.message ||
          (updatedUser.is_active
            ? "System user enabled successfully"
            : "System user disabled successfully"),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    systemUsers,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    refreshSystemUsers,
  };
};

// User Password Management Hook (Admin Only)
// Comprehensive dashboard hook for vaccination management
export const useAllUsers = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllUsers = async () => {
    try {
      const data = await apiClient.getAllUsers();
      setAllUsers(normalizeToArray(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const refreshAllUsers = () => {
    setLoading(true);
    return fetchAllUsers();
  };

  return { allUsers, loading, error, refreshAllUsers };
};

export const useDashboard = () => {
  const [stats, setStats] = useState({
    totalVaccinations: 0,
    appointmentsToday: 0,
    lowStockAlerts: 0,
    coverageRate: 0,
  });
  const [appointments, setAppointments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch all required data in parallel
        const [statsData, appointmentsData, inventoryData] = await Promise.all([
          apiClient.getDashboardStats(),
          apiClient.getDashboardAppointments(),
          apiClient.getVaccineInventory(),
        ]);

        // Transform data for the dashboard
        setStats({
          totalVaccinations: statsData.vaccinations || 0,
          appointmentsToday: statsData.appointmentsToday || 0,
          lowStockAlerts: statsData.lowStock || 0,
          coverageRate: statsData.coverageRate || 0,
        });

        // Transform appointments data - normalize to array first
        const normalizedAppointments = normalizeToArray(appointmentsData);
        setAppointments(
          normalizedAppointments.map((appointment) => ({
            patientName: appointment.patient?.name || "Unknown",
            vaccine: appointment.vaccine?.name || "N/A",
            date: new Date(appointment.date).toLocaleDateString(),
            time: appointment.time || "N/A",
            status: appointment.status || "Scheduled",
          })),
        );

        // Transform inventory data - normalize to array first
        const normalizedInventory = normalizeToArray(inventoryData);
        setInventory(
          normalizedInventory.map((item) => ({
            name: item.vaccine?.name || "Unknown",
            stock: item.quantity || 0,
            status: item.quantity < item.minLevel ? "Low" : "Good",
            expiry: item.expiryDate
              ? new Date(item.expiryDate).toLocaleDateString()
              : "N/A",
          })),
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return { stats, appointments, inventory, loading, error };
};

// User Password Management Hook (Admin Only)
export const useUserPasswords = () => {
  const [passwords, setPasswords] = useState({});
  const [visibleGuardianPasswords, setVisibleGuardianPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getUserPassword = async (userId) => {
    setLoading(true);
    try {
      // Use centralized service
      const result = await apiClient.getSystemUserPasswordStatus(userId);
      if (result?.password) {
        setPasswords((prev) => ({ ...prev, [userId]: result.password }));
        return { success: true, password: result.password };
      }
      return { success: false, error: "Password not found" };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const resetUserPassword = async (
    userId,
    newPassword,
    userType = "system",
  ) => {
    setLoading(true);
    try {
      // Use centralized service based on user type
      let result;
      if (userType === "guardian") {
        result = await apiClient.resetGuardianPassword(userId, newPassword, {
          isPasswordSet: true,
          mustChangePassword: false,
        });
      } else {
        result = await apiClient.resetSystemUserPassword(userId, newPassword);
      }

      // Check for success in the response - API returns { success: true, user: {...} }
      if (result?.success) {
        // Return the updated user for UI synchronization
        return {
          success: true,
          user: result.user || null,
          message: result.message || "Password reset successfully",
        };
      }
      // Handle case where API returns error directly
      return {
        success: false,
        error: result?.error || "Failed to reset password",
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const revealGuardianPassword = async (
    guardianId,
    sourceContext = "user-management/system-users",
  ) => {
    setLoading(true);
    try {
      console.log('Revealing password for guardian:', guardianId);
      const result = await apiClient.getGuardianPasswordVisibility(
        guardianId,
        sourceContext,
      );

      console.log('Password visibility response:', result);

      const payload = result?.data || result;
      if (payload?.available && payload?.password) {
        setVisibleGuardianPasswords((prev) => ({
          ...prev,
          [guardianId]: payload.password,
        }));
      }

      return {
        success: true,
        data: payload,
      };
    } catch (err) {
      console.error('Error revealing guardian password:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const auditGuardianPasswordVisibility = async (
    guardianId,
    action,
    sourceContext = "user-management/system-users",
  ) => {
    try {
      await apiClient.auditGuardianPasswordVisibility(
        guardianId,
        action,
        sourceContext,
      );
      return { success: true };
    } catch (err) {
      console.error('Error auditing password visibility:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const hideGuardianPassword = async (
    guardianId,
    sourceContext = "user-management/system-users",
  ) => {
    setVisibleGuardianPasswords((prev) => {
      const next = { ...prev };
      delete next[guardianId];
      return next;
    });

    await auditGuardianPasswordVisibility(guardianId, "hide", sourceContext);
    return { success: true };
  };

  const togglePasswordVisibility = async (guardianId) => {
    if (visibleGuardianPasswords[guardianId]) {
      // Hide password if currently visible
      return hideGuardianPassword(guardianId);
    } else {
      // Show password if currently hidden
      return revealGuardianPassword(guardianId);
    }
  };

  return {
    passwords,
    visibleGuardianPasswords,
    loading,
    error,
    getUserPassword,
    resetUserPassword,
    revealGuardianPassword,
    hideGuardianPassword,
    togglePasswordVisibility,
    auditGuardianPasswordVisibility,
  };
};

// Roles Hook
export const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const data = await apiClient.getRoles();
        setRoles(normalizeToArray(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  return { roles, loading, error };
};

// Clinics Hook
export const useClinics = () => {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const data = await apiClient.getClinics();
        setClinics(normalizeToArray(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClinics();
  }, []);

  return { clinics, loading, error };
};

// Guardian-specific Dashboard Hook
export const useGuardianDashboard = (guardianId) => {
  const [children, setChildren] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    childrenCount: 0,
    upcomingVaccinations: 0,
    completedVaccinations: 0,
    pendingAppointments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWithTimeout = useCallback(async (promise, timeout = 10000) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout),
    );
    return Promise.race([promise, timeoutPromise]);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!guardianId) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);

      // Fetch all data in parallel with error handling for each
      const fetchChildren = fetchWithTimeout(
        apiClient.getInfantsByGuardian(guardianId),
      )
        .then((res) => res.data || [])
        .catch((err) => {
          console.warn("Children fetch failed:", err.message);
          return [];
        });

      const fetchAppointments = fetchWithTimeout(
        apiClient.getGuardianAppointments(guardianId, { limit: 10 }),
      )
        .then((res) => res.data || [])
        .catch((err) => {
          console.warn("Appointments fetch failed:", err.message);
          return [];
        });

      const fetchStats = fetchWithTimeout(
        apiClient.getGuardianStats(guardianId),
      )
        .then((res) => res.data || {})
        .catch((err) => {
          console.warn("Stats fetch failed:", err.message);
          return {};
        });

      const fetchNotifications = fetchWithTimeout(
        apiClient.getNotifications({ limit: 5 }),
      )
        .then((res) => {
          if (Array.isArray(res.data)) return res.data;
          return res.data?.notifications || [];
        })
        .catch((err) => {
          console.warn("Notifications fetch failed:", err.message);
          return [];
        });

      const [childrenData, appointmentsData, statsData, notificationsData] =
        await Promise.all([
          fetchChildren,
          fetchAppointments,
          fetchStats,
          fetchNotifications,
        ]);

      setChildren(childrenData);
      setAppointments(appointmentsData);
      setStats({
        childrenCount: childrenData.length,
        upcomingVaccinations: statsData.upcomingVaccinations || 0,
        completedVaccinations: statsData.completedVaccinations || 0,
        pendingAppointments: appointmentsData.filter(
          (apt) => apt.status === "scheduled" || apt.status === "pending",
        ).length,
      });
      setNotifications(notificationsData);
      setError(null);
    } catch (err) {
      console.error("Error fetching guardian dashboard data:", err);
      if (children.length === 0 && appointments.length === 0) {
        setError("Unable to load dashboard data. Please try refreshing.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guardianId, fetchWithTimeout, children.length, appointments.length]);

  useEffect(() => {
    fetchDashboardData();
    // Refresh data every 60 seconds
    const intervalId = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  return {
    children,
    appointments,
    notifications,
    stats,
    loading,
    error,
    refreshing,
    refresh: fetchDashboardData,
  };
};
