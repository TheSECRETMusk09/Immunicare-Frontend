import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardOverview from "./Dashboard/DashboardOverview";

jest.mock("../hooks/useCachedData", () => ({
  useDashboardStats: () => ({
    data: {
      vaccination: { total: 12, completed: 8 },
      inventory: { total_items: 4, low_stock_items: 1, expired_items: 0 },
      appointments_summary: { total: 5, completed: 2, no_show: 0 },
      guardians_summary: { total: 3, active: 3 },
      infants_summary: { total: 6, up_to_date: 5 },
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
  useDashboardAppointments: () => ({
    data: [{ id: 1, first_name: "Baby", last_name: "One", scheduled_date: "2026-03-10" }],
    isLoading: false,
    refetch: jest.fn(),
  }),
  useDashboardInfants: () => ({
    data: [{ id: 1 }],
    isLoading: false,
    refetch: jest.fn(),
  }),
  useVaccineInventory: () => ({
    data: [{ id: 1, is_critical_stock: true }],
    isLoading: false,
    refetch: jest.fn(),
  }),
  useAdminVaccinationMonitoring: () => ({
    data: {
      summary: { overdueInfants: 1, dueSoonInfants: 2 },
      data: [
        {
          infant_id: 1,
          first_name: "Baby",
          last_name: "One",
          guardian_name: "Guardian One",
          next_status: "due_soon",
          next_due_date: "2026-03-12",
          upcoming_appointments_count: 1,
        },
      ],
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    alerts: [],
    notifications: [],
    isConnected: true,
  }),
}));

describe("DashboardOverview", () => {
  test("renders the admin monitoring overview with current actions", () => {
    render(
      <MemoryRouter>
        <DashboardOverview />
      </MemoryRouter>,
    );

    expect(screen.getByText(/dashboard overview/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/admin vaccination monitoring/i)).toBeInTheDocument();
  });
});
