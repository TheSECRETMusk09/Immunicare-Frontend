import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../utils/api";
import {
  normalizeGuardianChildren,
  normalizeGuardianAppointments,
  normalizeGuardianStats,
  normalizeGuardianNotifications,
} from "../utils/guardianDataNormalizers";

const STALE_TIMES = {
  dashboardStats: 3 * 60 * 1000,
  dashboardLists: 10 * 60 * 1000,
  guardian: 10 * 60 * 1000,
  notifications: 2 * 60 * 1000,
  appointmentSuggestions: 60 * 1000,
  monitoring: 60 * 1000,
};

const GC_TIMES = {
  standard: 30 * 60 * 1000,
};

const isQueryFresh = (queryClient, queryKey, staleTime) => {
  const state = queryClient.getQueryState(queryKey);
  if (!state?.dataUpdatedAt) {
    return false;
  }

  return Date.now() - state.dataUpdatedAt < staleTime;
};

// Query keys for consistent caching
export const queryKeys = {
  dashboard: {
    stats: ["dashboard", "stats"],
    appointments: ["dashboard", "appointments"],
    infants: ["dashboard", "infants"],
    guardians: ["dashboard", "guardians"],
    inventory: ["dashboard", "inventory"],
    analytics: ["dashboard", "analytics"],
    adminVaccinationMonitoring: (filters = {}) => [
      "dashboard",
      "admin-vaccination-monitoring",
      filters,
    ],
  },
  guardian: {
    children: (guardianId) => ["guardian", "children", guardianId],
    appointments: (guardianId, limit = 10) => [
      "guardian",
      "appointments",
      guardianId,
      limit,
    ],
    stats: (guardianId) => ["guardian", "stats", guardianId],
    notifications: (guardianScope = "self", limit = 10) => [
      "guardian",
      "notifications",
      guardianScope,
      limit,
    ],
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
    staleTime: STALE_TIMES.dashboardStats,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching dashboard appointments
 * Cached for 10 minutes
 */
export const useDashboardAppointments = (limit = 10) => {
  return useQuery({
    queryKey: [...queryKeys.dashboard.appointments, limit],
    queryFn: async () => {
      const response = await apiClient.getDashboardAppointments({ limit });
      if (response?.data) return response.data;
      if (Array.isArray(response)) return response;
      return response?.appointments || [];
    },
    staleTime: STALE_TIMES.dashboardLists,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching dashboard infants
 * Cached for 10 minutes
 */
export const useDashboardInfants = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.infants,
    queryFn: async () => {
      const response = await apiClient.getDashboardInfants();
      if (response?.data)
        return Array.isArray(response.data) ? response.data : [];
      if (Array.isArray(response)) return response;
      return response?.infants || [];
    },
    staleTime: STALE_TIMES.dashboardLists,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching dashboard guardians
 * Cached for 10 minutes
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
    staleTime: STALE_TIMES.dashboardLists,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching vaccine inventory
 * Cached for 10 minutes
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
    staleTime: STALE_TIMES.dashboardLists,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching vaccination analytics
 * Cached for 10 minutes
 */
export const useVaccinationAnalytics = (period = "month") => {
  return useQuery({
    queryKey: [...queryKeys.dashboard.analytics, period],
    queryFn: async () => {
      const response = await apiClient.getVaccinationAnalytics({ period });
      return response;
    },
    staleTime: STALE_TIMES.dashboardLists,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching admin vaccination monitoring data
 * Includes full infant vaccination history + next-dose/upcoming appointment rollups
 */
export const useAdminVaccinationMonitoring = (filters = {}, options = {}) => {
  const { enabled = true, refetchInterval = 60 * 1000 } = options;

  return useQuery({
    queryKey: queryKeys.dashboard.adminVaccinationMonitoring(filters),
    queryFn: async () => {
      const response = await apiClient.getAdminVaccinationMonitoring(filters);
      return response || { success: true, summary: {}, data: [] };
    },
    enabled,
    staleTime: STALE_TIMES.monitoring,
    gcTime: GC_TIMES.standard,
    refetchInterval,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching guardian's children
 * Cached for 10 minutes
 */
export const useGuardianChildren = (guardianId) => {
  return useQuery({
    queryKey: queryKeys.guardian.children(guardianId),
    queryFn: async () => {
      if (!guardianId) return [];
      const response = await apiClient.getInfantsByGuardian(guardianId);
      return normalizeGuardianChildren(response);
    },
    staleTime: STALE_TIMES.guardian,
    gcTime: GC_TIMES.standard,
    enabled: !!guardianId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching guardian's appointments
 * Cached for 10 minutes
 */
export const useGuardianAppointments = (guardianId, options = {}) => {
  const { limit = 10 } = options;
  return useQuery({
    queryKey: queryKeys.guardian.appointments(guardianId, limit),
    queryFn: async () => {
      if (!guardianId) return [];
      const response = await apiClient.getGuardianAppointments(guardianId, {
        limit,
      });
      return normalizeGuardianAppointments(response);
    },
    staleTime: STALE_TIMES.guardian,
    gcTime: GC_TIMES.standard,
    enabled: !!guardianId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching guardian stats
 * Cached for 10 minutes
 */
export const useGuardianStats = (guardianId) => {
  return useQuery({
    queryKey: queryKeys.guardian.stats(guardianId),
    queryFn: async () => {
      if (!guardianId) return {};
      const response = await apiClient.getGuardianStats(guardianId);
      return normalizeGuardianStats(response);
    },
    staleTime: STALE_TIMES.guardian,
    gcTime: GC_TIMES.standard,
    enabled: !!guardianId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching guardian notifications
 * Cached for 2 minutes
 */
export const useGuardianNotifications = (limit = 10) => {
  return useQuery({
    queryKey: queryKeys.guardian.notifications("self", limit),
    queryFn: async () => {
      const response = await apiClient.getGuardianNotifications({ limit });
      return normalizeGuardianNotifications(response);
    },
    staleTime: STALE_TIMES.notifications,
    gcTime: GC_TIMES.standard,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching appointment suggestions for an infant
 * Cached for 1 minute to balance freshness with performance
 */
export const useAppointmentSuggestions = (
  infantId,
  guardianId = null,
  clinicId = null,
) => {
  return useQuery({
    queryKey: ["appointment-suggestions", infantId, guardianId, clinicId],
    queryFn: async () => {
      if (!infantId) return null;
      const response = await apiClient.getAppointmentSuggestions({
        infantId,
        guardianId,
        clinicId,
      });
      return response?.data || response;
    },
    staleTime: STALE_TIMES.appointmentSuggestions,
    gcTime: GC_TIMES.standard,
    enabled: !!infantId,
    refetchOnWindowFocus: false,
  });
};

/**
 * Prefetch dashboard data
 * Call this on route hover to prefetch data before navigation
 */
export const usePrefetchDashboard = () => {
  const queryClient = useQueryClient();

  const prefetchDashboardData = async () => {
    const prefetchTasks = [];
    const appointmentsKey = [...queryKeys.dashboard.appointments, 10];

    if (
      !isQueryFresh(
        queryClient,
        queryKeys.dashboard.stats,
        STALE_TIMES.dashboardStats,
      )
    ) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.stats,
          queryFn: () => apiClient.getDashboardStats(),
          staleTime: STALE_TIMES.dashboardStats,
          gcTime: GC_TIMES.standard,
        }),
      );
    }

    if (
      !isQueryFresh(
        queryClient,
        appointmentsKey,
        STALE_TIMES.dashboardLists,
      )
    ) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: appointmentsKey,
          queryFn: () => apiClient.getDashboardAppointments({ limit: 10 }),
          staleTime: STALE_TIMES.dashboardLists,
          gcTime: GC_TIMES.standard,
        }),
      );
    }

    if (
      !isQueryFresh(
        queryClient,
        queryKeys.dashboard.infants,
        STALE_TIMES.dashboardLists,
      )
    ) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.infants,
          queryFn: () => apiClient.getDashboardInfants(),
          staleTime: STALE_TIMES.dashboardLists,
          gcTime: GC_TIMES.standard,
        }),
      );
    }

    if (prefetchTasks.length === 0) {
      return;
    }

    await Promise.allSettled(prefetchTasks);
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

    const childrenKey = queryKeys.guardian.children(guardianId);
    const appointmentsKey = queryKeys.guardian.appointments(guardianId, 10);
    const statsKey = queryKeys.guardian.stats(guardianId);
    const prefetchTasks = [];

    if (!isQueryFresh(queryClient, childrenKey, STALE_TIMES.guardian)) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: childrenKey,
          queryFn: async () => {
            const response = await apiClient.getInfantsByGuardian(guardianId);
            return normalizeGuardianChildren(response);
          },
          staleTime: STALE_TIMES.guardian,
          gcTime: GC_TIMES.standard,
        }),
      );
    }

    if (
      !isQueryFresh(queryClient, appointmentsKey, STALE_TIMES.guardian)
    ) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: appointmentsKey,
          queryFn: async () => {
            const response = await apiClient.getGuardianAppointments(guardianId, {
              limit: 10,
            });
            return normalizeGuardianAppointments(response);
          },
          staleTime: STALE_TIMES.guardian,
          gcTime: GC_TIMES.standard,
        }),
      );
    }

    if (!isQueryFresh(queryClient, statsKey, STALE_TIMES.guardian)) {
      prefetchTasks.push(
        queryClient.prefetchQuery({
          queryKey: statsKey,
          queryFn: async () => {
            const response = await apiClient.getGuardianStats(guardianId);
            return normalizeGuardianStats(response);
          },
          staleTime: STALE_TIMES.guardian,
          gcTime: GC_TIMES.standard,
        }),
      );
    }

    if (prefetchTasks.length === 0) {
      return;
    }

    await Promise.allSettled(prefetchTasks);
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

  const invalidateGuardian = () => {
    queryClient.invalidateQueries({ queryKey: ["guardian"] });
  };

  return { invalidateDashboard, invalidateGuardian };
};
