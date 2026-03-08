import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client with optimized caching settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      // This prevents unnecessary refetches when switching between modules
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache data for 30 minutes
      // Users can return to previous pages and see cached data instantly
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)

      // Don't refetch on window focus for dashboard data
      // This prevents unnecessary network requests when switching tabs
      refetchOnWindowFocus: false,

      // Retry failed requests 2 times
      retry: 2,

      // Show loading state for background refetches
      placeholderData: (previousData) => previousData,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

/**
 * QueryProvider Component
 * Wraps the application with React Query for data caching and management.
 * This enables:
 * - Automatic data caching between route changes
 * - Prefetching data on hover
 * - Deduplication of API calls
 * - Optimistic updates
 */
export default function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Export the queryClient for direct access if needed
export { queryClient };
