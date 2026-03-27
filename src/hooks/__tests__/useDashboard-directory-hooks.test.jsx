import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useGuardians, useSystemUsers } from "../useDashboard";
import apiClient from "../../utils/api";

jest.mock("../../utils/api", () => ({
  __esModule: true,
  default: {
    getGuardians: jest.fn(),
    getSystemUsers: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("useDashboard directory hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("useGuardians fetches only the requested page", async () => {
    apiClient.getGuardians.mockResolvedValue({
      data: [{ id: 120, name: "Maria Clara Santos", username: "maria.santos" }],
      meta: {
        pagination: {
          page: 12,
          limit: 10,
          total: 120,
          totalPages: 12,
          hasNext: false,
          hasPrev: true,
        },
      },
    });

    const { result } = renderHook(
      () => useGuardians({ page: 12, limit: 10, search: "maria" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.getGuardians).toHaveBeenCalledTimes(1);
    expect(apiClient.getGuardians).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 12,
        limit: 10,
        search: "maria",
      }),
      expect.objectContaining({
        disableRetry: true,
        signal: expect.any(Object),
      }),
    );
    expect(result.current.pagination.page).toBe(12);
    expect(result.current.totalCount).toBe(120);
    expect(result.current.guardians).toHaveLength(1);
  });

  test("useSystemUsers honors enabled=false and stays idle", async () => {
    renderHook(() => useSystemUsers({ page: 1, limit: 10 }, { enabled: false }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(apiClient.getSystemUsers).not.toHaveBeenCalled();
    });
  });
});
