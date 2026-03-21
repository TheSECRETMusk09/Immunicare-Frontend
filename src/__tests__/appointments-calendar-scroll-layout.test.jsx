import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import AdminLayout from "../components/AdminLayout";
import Appointments from "../pages/Appointments";

const stableAppointments = [
  {
    id: 1,
    first_name: "Baby",
    last_name: "One",
    guardian_name: "Guardian One",
    scheduled_date: "2026-03-24T10:00:00.000Z",
    type: "Vaccination",
    status: "scheduled",
    control_number: "INF-2026-000001",
  },
];

const stableInfants = [
  {
    id: 1,
    first_name: "Baby",
    last_name: "One",
    control_number: "INF-2026-000001",
  },
];

jest.mock("../hooks/useDashboard", () => ({
  useAppointments: () => ({
    appointments: stableAppointments,
    loading: false,
    error: null,
  }),
  useInfants: () => ({
    infants: stableInfants,
  }),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAppointmentCalendarAvailability: jest.fn().mockResolvedValue({ dates: [] }),
    getBlockedDates: jest.fn().mockResolvedValue({ blockedDates: {} }),
    getAppointmentDateDetails: jest.fn().mockResolvedValue({
      summary: { total: 0 },
      appointments: [],
      isWeekend: false,
      holiday: null,
    }),
    getAppointments: jest.fn().mockResolvedValue({
      data: stableAppointments,
    }),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  },
}));

jest.mock("../components/Sidebar", () => function SidebarMock() {
  return <div data-testid="admin-sidebar" />;
});

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    darkMode: false,
    toggleDarkMode: jest.fn(),
  }),
}));

describe("admin appointments calendar scroll layout", () => {
  test("admin layout constrains routed content so nested pages can own scrolling", () => {
    render(
      <AdminLayout>
        <div data-testid="layout-child">Layout child</div>
      </AdminLayout>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveClass(
      "flex-1",
      "min-h-0",
      "min-w-0",
      "overflow-y-auto",
      "overflow-x-hidden",
    );
  });

  test("calendar view uses an internal scroll region instead of locking the full page height", async () => {
    render(
      <MemoryRouter>
        <AdminLayout>
          <Appointments />
        </AdminLayout>
      </MemoryRouter>,
    );

    const page = screen.getByTestId("admin-appointments-page");
    expect(page).toHaveClass("flex", "flex-col", "h-full", "min-h-0", "min-w-0");
    expect(page).not.toHaveClass("h-screen");

    fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

    await waitFor(() => {
      expect(screen.getByText("Calendar View")).toBeInTheDocument();
    });

    const scrollRegion = screen.getByTestId(
      "admin-appointments-calendar-scroll-region",
    );
    expect(scrollRegion).toBeInTheDocument();
    expect(scrollRegion).toHaveClass(
      "flex-1",
      "min-h-0",
      "overflow-y-auto",
      "overflow-x-hidden",
    );
  });
});
