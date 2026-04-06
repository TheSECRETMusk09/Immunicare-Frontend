import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useAppointments } from "../hooks/useDashboard";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAppointments: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: {
      id: 100,
      role_type: "SYSTEM_ADMIN",
      clinic_id: 1,
      facility_id: 203,
    },
  }),
}));

function AppointmentScopeProbe() {
  const { appointments, loading } = useAppointments();

  if (loading) {
    return <div>Loading</div>;
  }

  return <div>{appointments.length}</div>;
}

function FilteredAppointmentScopeProbe() {
  const { appointments, loading } = useAppointments({
    fetchAll: false,
    params: {
      page: 1,
      limit: 20,
      status: "no_show",
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      sort_field: "scheduled_date",
      sort_direction: "asc",
    },
  });

  if (loading) {
    return <div>Loading filtered</div>;
  }

  return <div>{appointments.length}</div>;
}

describe("useAppointments admin scope loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("merges clinic_id and facility_id while loading the full appointment list", async () => {
    apiClient.getAppointments
      .mockResolvedValueOnce({
        data: [{ id: 1, status: "scheduled" }],
        metadata: {
          hasNext: true,
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: 2, status: "attended" }],
        metadata: {
          hasNext: false,
        },
      });

    render(<AppointmentScopeProbe />);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    expect(apiClient.getAppointments).toHaveBeenNthCalledWith(1, {
      clinic_id: 1,
      facility_id: 203,
      page: 1,
      limit: 200,
    });
    expect(apiClient.getAppointments).toHaveBeenNthCalledWith(2, {
      clinic_id: 1,
      facility_id: 203,
      page: 2,
      limit: 200,
    });
  });

  test("preserves facility scope while forwarding status and date filters for paged appointment loads", async () => {
    apiClient.getAppointments.mockResolvedValueOnce({
      data: [{ id: 3, status: "no_show" }],
      metadata: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(<FilteredAppointmentScopeProbe />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    expect(apiClient.getAppointments).toHaveBeenCalledWith({
      clinic_id: 1,
      facility_id: 203,
      page: 1,
      limit: 20,
      status: "no_show",
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      sort_field: "scheduled_date",
      sort_direction: "asc",
    });
  });
});
