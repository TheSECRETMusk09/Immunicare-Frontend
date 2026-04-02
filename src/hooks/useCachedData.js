import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../utils/api";
import {
  normalizeGuardianChildren,
  normalizeGuardianAppointments,
  normalizeGuardianStats,
  normalizeGuardianNotifications,
} from "../utils/guardianDataNormalizers";

// Query keys for consistent caching
export const queryKeys = {
  dashboard: {
    stats: ["dashboard", "stats"],
    appointments: ["dashboard", "appointments"],
    infants: ["dashboard", "infants"],
    guardians: ["dashboard", "guardians"],
    inventory: ["dashboard", "inventory"],
    analytics: ["dashboard", "analytics"],
    adminVaccinationMonitoring: (filters = {}) => ["dashboard", "admin-vaccination-monitoring", filters],
  },
  guardian: {
    children: (guardianId) => ["guardian", "children", guardianId],
    appointments: (guardianId) => ["guardian", "appointments", guardianId],
    stats: (guardianId) => ["guardian", "stats", guardianId],
    notifications: (guardianScope = "self") => ["guardian", "notifications", guardianScope],
  },
  vaccinations: {
    all: ["vaccinations", "all"],
    byInfant: (infantId) => ["vaccinations", "infant", infantId],
    upcoming: ["vaccinations", "upcoming"],
    completed: ["vaccinations", "completed"],
  },
  appointments: {
    all: ["appointments", "all"],
    byId: (id) => ["appointments", id],
    byDate: (date) => ["appointments", "date", date],
  },
  infants: {
    all: ["infants", "all"],
    byId: (id) => ["infants", id],
  },
  users: {
    all: ["users", "all"],
    byId: (id) => ["users", id],
    guardiansList: (params = {}) => ["users", "guardians", params],
    systemUsersList: (params = {}) => ["users", "system-users", params],
  },
};

/**
 * Hook for fetching dashboard statistics
 * Cached briefly to keep admin metrics responsive after mutations
 */
export const useDashboardStats = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      const response = await apiClient.getDashboardStats();
      return response;
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching dashboard appointments
 * Cached for 5 minutes
 */
export const useDashboardAppointments = (limit = 10) => {
  return useQuery({
    queryKey: [...queryKeys.dashboard.appointments, limit],
    queryFn: async () => {
      const response = await apiClient.getDashboardAppointments({ limit });
      // Handle different response formats
      if (response?.data) return response.data;
      if (Array.isArray(response)) return response;
      return response?.appointments || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching dashboard infants
 * Cached for 5 minutes
 */
export const useDashboardInfants = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.infants,
    queryFn: async () => {
      const response = await apiClient.getDashboardInfants();
      // Handle different response formats
      if (response?.data)
        return Array.isArray(response.data) ? response.data : [];
      if (Array.isArray(response)) return response;
      return response?.infants || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching dashboard guardians
 * Cached for 5 minutes
 */
export const useDashboardGuardians = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.guardians,
    queryFn: async () => {
      const response = await apiClient.getDashboardGuardians();
      if (response?.data)
        return Array.isArray(response.data) ? response.data : [];
      if (Array.isArray(response)) return response;
      return response?.guardians || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching vaccine inventory
 * Cached for 5 minutes
 */
export const useVaccineInventory = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.inventory,
    queryFn: async () => {
      const response = await apiClient.getVaccineInventory();
      if (response?.data)
        return Array.isArray(response.data) ? response.data : [];
      if (Array.isArray(response)) return response;
      return response?.inventory || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching vaccination analytics
 * Cached for 5 minutes
 */
export const useVaccinationAnalytics = (period = "month") => {
  return useQuery({
    queryKey: [...queryKeys.dashboard.analytics, period],
    queryFn: async () => {
      const response = await apiClient.getVaccinationAnalytics({ period });
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching admin vaccination monitoring data
 * Includes full infant vaccination history + next-dose/upcoming appointment rollups
 */
export const useAdminVaccinationMonitoring = (filters = {}, options = {}) => {
  const {
    enabled = true,
    refetchInterval = 60 * 1000,
  } = options;

  return useQuery({
    queryKey: queryKeys.dashboard.adminVaccinationMonitoring(filters),
    queryFn: async () => {
      const response = await apiClient.getAdminVaccinationMonitoring(filters);
      return response || { success: true, summary: {}, data: [] };
    },
    enabled,
    staleTime: 60 * 1000,
    refetchInterval,
  });
};

/**
 * Hook for fetching guardian's children
 * Cached for 5 minutes
 */
export const useGuardianChildren = (guardianId) => {
  return useQuery({
    queryKey: queryKeys.guardian.children(guardianId),
    queryFn: async () => {
      if (!guardianId) return [];
      const response = await apiClient.getInfantsByGuardian(guardianId);
      return normalizeGuardianChildren(response);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!guardianId,
  });
};

/**
 * Hook for fetching guardian's appointments
 * Cached for 5 minutes
 */
export const useGuardianAppointments = (guardianId, options = {}) => {
  const { limit = 10 } = options;
  return useQuery({
    queryKey: queryKeys.guardian.appointments(guardianId),
    queryFn: async () => {
      if (!guardianId) return [];
      const response = await apiClient.getGuardianAppointments(guardianId, {
        limit,
      });
      return normalizeGuardianAppointments(response);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!guardianId,
  });
};

/**
 * Hook for fetching guardian stats
 * Cached for 5 minutes
 */
export const useGuardianStats = (guardianId) => {
  return useQuery({
    queryKey: queryKeys.guardian.stats(guardianId),
    queryFn: async () => {
      if (!guardianId) return {};
      const response = await apiClient.getGuardianStats(guardianId);
      return normalizeGuardianStats(response);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!guardianId,
  });
};

  /**
   * Hook for fetching guardian notifications
   * Cached for 2 minutes (more frequently updated)
   */
  export const useGuardianNotifications = (limit = 10) => {
    return useQuery({
      queryKey: [...queryKeys.guardian.notifications(), limit],
      queryFn: async () => {
        const response = await apiClient.getGuardianNotifications({ limit });
        return normalizeGuardianNotifications(response);
      },
      staleTime: 2 * 60 * 1000,
    });
  };

  /**
   * Hook for fetching appointment suggestions for an infant
   * Cached for 1 minute to balance freshness with performance
   */
  export const useAppointmentSuggestions = (infantId, guardianId = null, clinicId = null) => {
    return useQuery({
      queryKey: ['appointment-suggestions', infantId, guardianId, clinicId],
      queryFn: async () => {
        if (!infantId) return null;
        const response = await apiClient.getAppointmentSuggestions({ infantId, guardianId, clinicId });
        return response?.data || response;
      },
      staleTime: 60 * 1000, // 1 minute
      enabled: !!infantId,
    });
  };

/**
 * Prefetch dashboard data
 * Call this on route hover to prefetch data before navigation
 */
export const usePrefetchDashboard = () => {
  const queryClient = useQueryClient();

  const prefetchDashboardData = async () => {
    // Prefetch all dashboard data in parallel
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.stats,
        queryFn: () => apiClient.getDashboardStats(),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.appointments,
        queryFn: () => apiClient.getDashboardAppointments({ limit: 10 }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.infants,
        queryFn: () => apiClient.getDashboardInfants(),
      }),
    ]);
  };

  return { prefetchDashboardData };
};

/**
 * Prefetch guardian data
 * Call this on guardian route hover
 */
export const usePrefetchGuardian = () => {
  const queryClient = useQueryClient();

  const prefetchGuardianData = async (guardianId) => {
    if (!guardianId) return;

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.guardian.children(guardianId),
        queryFn: () => apiClient.getInfantsByGuardian(guardianId),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.guardian.appointments(guardianId),
        queryFn: () =>
          apiClient.getGuardianAppointments(guardianId, { limit: 10 }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.guardian.stats(guardianId),
        queryFn: () => apiClient.getGuardianStats(guardianId),
      }),
    ]);
  };

  return { prefetchGuardianData };
};

/**
 * Invalidate and refetch dashboard data
 * Use this after mutations to update cached data
 */
export const useInvalidateDashboard = () => {
  const queryClient = useQueryClient();

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const invalidateGuardian = (guardianId) => {
    queryClient.invalidateQueries({ queryKey: ["guardian"] });
  };

  return { invalidateDashboard, invalidateGuardian };
};
