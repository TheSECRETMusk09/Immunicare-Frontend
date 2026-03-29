import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../utils/api";
import { queryKeys } from "./useCachedData";
import { useAuth } from "../contexts/AuthContext";

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

const extractPaginationMeta = (data) => {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.meta?.pagination) {
    return data.meta.pagination;
  }

  if (data.pagination) {
    return data.pagination;
  }

  return null;
};

const extractCollectionResponse = (data, wrapperKey = null) => ({
  items: normalizeToArray(data, wrapperKey),
  pagination: extractPaginationMeta(data),
});

const DIRECTORY_DEFAULT_LIMIT = 10;

const buildDirectoryParams = (params = {}) => {
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);
  const limit = Math.max(1, Number.parseInt(params.limit, 10) || DIRECTORY_DEFAULT_LIMIT);

  return Object.entries({
    ...params,
    page,
    limit,
  }).reduce((accumulator, [key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
};

const buildDefaultPagination = (limit = DIRECTORY_DEFAULT_LIMIT) => ({
  page: 1,
  limit,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
});

const normalizeDirectoryCollection = (
  data,
  wrapperKey = null,
  fallbackLimit = DIRECTORY_DEFAULT_LIMIT,
) => {
  const collection = extractCollectionResponse(data, wrapperKey);
  const pagination = {
    ...buildDefaultPagination(fallbackLimit),
    ...(collection.pagination || {}),
  };

  pagination.page = Number.parseInt(pagination.page, 10) || 1;
  pagination.limit = Number.parseInt(pagination.limit, 10) || fallbackLimit;
  pagination.total = Number.parseInt(pagination.total, 10) || collection.items.length;
  pagination.totalPages =
    Number.parseInt(pagination.totalPages, 10) ||
    (pagination.total > 0 ? Math.ceil(pagination.total / pagination.limit) : 0);
  pagination.hasNext =
    typeof collection.pagination?.hasNext === "boolean"
      ? collection.pagination.hasNext
      : pagination.page < pagination.totalPages;
  pagination.hasPrev =
    typeof collection.pagination?.hasPrev === "boolean"
      ? collection.pagination.hasPrev
      : pagination.page > 1;

  return {
    items: collection.items,
    pagination,
    total: pagination.total,
  };
};

const usePrefetchNextDirectoryPage = ({
  enabled,
  data,
  params,
  queryKeyFactory,
  fetchPage,
}) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !data?.pagination?.hasNext) {
      return;
    }

    const nextParams = {
      ...params,
      page: Number(data.pagination.page || 1) + 1,
    };

    queryClient.prefetchQuery({
      queryKey: queryKeyFactory(nextParams),
      queryFn: ({ signal }) => fetchPage(nextParams, signal),
      staleTime: 60 * 1000,
    });
  }, [data?.pagination?.hasNext, data?.pagination?.page, enabled, fetchPage, params, queryClient, queryKeyFactory]);
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

export const useGuardians = (params = {}, options = {}) => {
  const normalizedParams = buildDirectoryParams(params);
  const enabled = options.enabled ?? true;

  const fetchGuardiansPage = useCallback(
    (requestParams, signal) =>
      apiClient.getGuardians(requestParams, {
        signal,
        disableRetry: true,
        timeout: options.timeout ?? 20000,
      }),
    [options.timeout],
  );

  const query = useQuery({
    queryKey: queryKeys.users.guardiansList(normalizedParams),
    enabled,
    retry: options.retry ?? 1,
    queryFn: ({ signal }) => fetchGuardiansPage(normalizedParams, signal),
    select: (response) =>
      normalizeDirectoryCollection(response, "data", normalizedParams.limit),
    placeholderData: (previousData) => previousData,
  });

  usePrefetchNextDirectoryPage({
    enabled,
    data: query.data,
    params: normalizedParams,
    queryKeyFactory: queryKeys.users.guardiansList,
    fetchPage: fetchGuardiansPage,
  });

  return {
    guardians: query.data?.items || [],
    totalCount: query.data?.total || 0,
    pagination: query.data?.pagination || buildDefaultPagination(normalizedParams.limit),
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message || null,
    refreshGuardians: query.refetch,
  };
};

export const useAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const hasLoadedAppointmentsRef = useRef(false);

  const refreshAppointments = useCallback(
    async ({ silent = false } = {}) => {
      const scopeIds = Array.from(
        new Set(
          [user?.clinic_id, user?.facility_id]
            .map((value) => Number.parseInt(value, 10))
            .filter((value) => Number.isInteger(value) && value > 0),
        ),
      );

      const scopedFilters = {
        ...(scopeIds[0] ? { clinic_id: scopeIds[0] } : {}),
        ...(scopeIds[1] ? { facility_id: scopeIds[1] } : {}),
      };

      const shouldManageInitialLoading =
        !silent && !hasLoadedAppointmentsRef.current;

      if (shouldManageInitialLoading) {
        setLoading(true);
      }

      try {
        let page = 1;
        let hasNext = true;
        const allAppointments = [];

        while (hasNext) {
          const response = await apiClient.getAppointments({
            ...scopedFilters,
            page,
            limit: 200,
          });

          const pageAppointments = normalizeToArray(response);
          allAppointments.push(...pageAppointments);

          hasNext = Boolean(response?.metadata?.hasNext) && pageAppointments.length > 0;
          page += 1;
        }

        setAppointments(allAppointments);
        setError(null);
        return allAppointments;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        hasLoadedAppointmentsRef.current = true;
        if (shouldManageInitialLoading) {
          setLoading(false);
        }
      }
    },
    [user?.clinic_id, user?.facility_id],
  );

  useEffect(() => {
    refreshAppointments().catch(() => undefined);
  }, [refreshAppointments]);

  return { appointments, loading, error, refreshAppointments };
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
export const useSystemUsers = (params = {}, options = {}) => {
  const normalizedParams = buildDirectoryParams(params);
  const enabled = options.enabled ?? true;

  const fetchSystemUsersPage = useCallback(
    (requestParams, signal) =>
      apiClient.getSystemUsers(requestParams, {
        signal,
        disableRetry: true,
        timeout: options.timeout ?? 20000,
      }),
    [options.timeout],
  );

  const query = useQuery({
    queryKey: queryKeys.users.systemUsersList(normalizedParams),
    enabled,
    retry: options.retry ?? 1,
    queryFn: ({ signal }) => fetchSystemUsersPage(normalizedParams, signal),
    select: (response) =>
      normalizeDirectoryCollection(response, "data", normalizedParams.limit),
    placeholderData: (previousData) => previousData,
  });

  usePrefetchNextDirectoryPage({
    enabled,
    data: query.data,
    params: normalizedParams,
    queryKeyFactory: queryKeys.users.systemUsersList,
    fetchPage: fetchSystemUsersPage,
  });

  const refreshSystemUsers = () => query.refetch();

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
    systemUsers: query.data?.items || [],
    totalCount: query.data?.total || 0,
    pagination: query.data?.pagination || buildDefaultPagination(normalizedParams.limit),
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message || null,
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

      const didResetSucceed =
        result?.success === true ||
        (!result?.error && Boolean(result?.user || result?.guardian || result?.message));

      if (didResetSucceed) {
        // Return the updated user for UI synchronization
        return {
          success: true,
          user: result.user || result.guardian || null,
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
        const data = await apiClient.getRoles({ exclude: "guardian" });
        setRoles(
          normalizeToArray(data).filter(
            (role) => String(role?.name || "").trim().toLowerCase() !== "guardian",
          ),
        );
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

  const unwrapApiPayload = useCallback((value) => {
    if (value && typeof value === "object" && "data" in value) {
      return value.data;
    }
    return value;
  }, []);

  const normalizeArrayPayload = useCallback(
    (value, candidateKeys = []) => {
      const payload = unwrapApiPayload(value);

      if (Array.isArray(payload)) {
        return payload;
      }

      if (payload && typeof payload === "object") {
        const keys = ["data", ...candidateKeys];
        for (const key of keys) {
          if (Array.isArray(payload[key])) {
            return payload[key];
          }
        }
      }

      return [];
    },
    [unwrapApiPayload],
  );

  const extractGuardianStats = useCallback(
    (value) => {
      const payload = unwrapApiPayload(value);
      return payload && typeof payload === "object" ? payload : {};
    },
    [unwrapApiPayload],
  );

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
        .then((res) => normalizeArrayPayload(res, ["infants", "children"]))
        .catch((err) => {
          console.warn("Children fetch failed:", err.message);
          return [];
        });

      const fetchAppointments = fetchWithTimeout(
        apiClient.getGuardianAppointments(guardianId, { limit: 10 }),
      )
        .then((res) => normalizeArrayPayload(res, ["appointments"]))
        .catch((err) => {
          console.warn("Appointments fetch failed:", err.message);
          return [];
        });

      const fetchStats = fetchWithTimeout(
        apiClient.getGuardianStats(guardianId),
      )
        .then((res) => extractGuardianStats(res))
        .catch((err) => {
          console.warn("Stats fetch failed:", err.message);
          return {};
        });

      const fetchNotifications = fetchWithTimeout(
        apiClient.getGuardianNotifications({ limit: 5 }),
      )
        .then((res) => normalizeArrayPayload(res, ["notifications"]))
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
  }, [
    guardianId,
    fetchWithTimeout,
    normalizeArrayPayload,
    extractGuardianStats,
    children.length,
    appointments.length,
  ]);

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
