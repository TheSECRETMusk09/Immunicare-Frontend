import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import AdminLayout from "../components/AdminLayout";
import Appointments from "../pages/Appointments";
import apiClient from "../utils/api";
import { toClinicDateKey } from "../utils/dateUtils";

let mockCalendarAppointments = [
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

let mockCalendarAvailability = { dates: [] };
let mockDailyCapacity = {
  date: "2026-03-24",
  current: 1,
  maximum: 400,
  remaining: 399,
};

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
    appointments: mockCalendarAppointments,
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
    getAppointmentCalendarAvailability: jest.fn(() => Promise.resolve(mockCalendarAvailability)),
    getAppointmentDailyCapacity: jest.fn(() => Promise.resolve(mockDailyCapacity)),
    getBlockedDates: jest.fn().mockResolvedValue({ blockedDates: {} }),
    getAppointmentDateDetails: jest.fn().mockResolvedValue({
      summary: { total: 0 },
      appointments: [],
      isWeekend: false,
      holiday: null,
    }),
    getAppointments: jest.fn(() => Promise.resolve({
      data: mockCalendarAppointments,
    })),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  },
}));

jest.mock("../components/Sidebar", () => function SidebarMock() {
  return <div data-testid="admin-sidebar" />;
});

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: 100, role_type: "SYSTEM_ADMIN" },
  }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    darkMode: false,
    toggleDarkMode: jest.fn(),
  }),
}));

beforeEach(() => {
  mockCalendarAppointments = [
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
  mockCalendarAvailability = { dates: [] };
  mockDailyCapacity = {
    date: "2026-03-24",
    current: 1,
    maximum: 400,
    remaining: 399,
  };
  jest.clearAllMocks();
  apiClient.getAppointmentCalendarAvailability.mockImplementation(
    () => Promise.resolve(mockCalendarAvailability),
  );
  apiClient.getAppointmentDailyCapacity.mockImplementation(
    () => Promise.resolve(mockDailyCapacity),
  );
  apiClient.getBlockedDates.mockResolvedValue({ blockedDates: {} });
  apiClient.getAppointmentDateDetails.mockResolvedValue({
    summary: { total: 0 },
    appointments: [],
    isWeekend: false,
    holiday: null,
  });
  apiClient.getAppointments.mockImplementation(() =>
    Promise.resolve({
      data: mockCalendarAppointments,
    }),
  );
});

const getExpectedMonthRange = () => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: toClinicDateKey(monthStart),
    endDate: toClinicDateKey(monthEnd),
  };
};

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

  test("calendar view reuses the appointments endpoint with month date filters", async () => {
    const { startDate, endDate } = getExpectedMonthRange();

    render(
      <MemoryRouter>
        <AdminLayout>
          <Appointments />
        </AdminLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

    await waitFor(() => {
      expect(apiClient.getAppointments).toHaveBeenCalled();
    });

    expect(apiClient.getAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: startDate,
        end_date: endDate,
        sort_field: "scheduled_date",
        sort_direction: "asc",
      }),
    );
  });

  test("list view places today's vaccination slots inside the filter toolbar", async () => {
    render(
      <MemoryRouter>
        <AdminLayout>
          <Appointments />
        </AdminLayout>
      </MemoryRouter>,
    );

    const toolbar = await screen.findByTestId("appointments-list-toolbar");
    await waitFor(() => {
      expect(apiClient.getAppointmentDailyCapacity).toHaveBeenCalled();
    });
    const slotsIndicator = await screen.findByTestId(
      "appointments-today-capacity-indicator",
    );

    expect(toolbar).toContainElement(slotsIndicator);

    expect(
      within(slotsIndicator).getByText("Today's Vaccination Slots"),
    ).toBeInTheDocument();
    expect(
      within(slotsIndicator).getByText(/399 available/i),
    ).toBeInTheDocument();
    expect(
      within(slotsIndicator).getByText(/1 booked/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Today's Vaccination Slots")).toHaveLength(1);
  });

  test("calendar view groups the selected date appointments into status columns", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));

    mockCalendarAppointments = [
      {
        id: 1,
        first_name: "Infant",
        last_name: "One",
        guardian_name: "Isaac Domingo",
        scheduled_date: "2026-05-15T08:00:00+08:00",
        type: "Vaccination",
        status: "completed",
        control_number: "INF-2026-000001",
      },
      {
        id: 2,
        first_name: "Infant",
        last_name: "Two",
        guardian_name: "Nadine Panganiban",
        scheduled_date: "2026-05-15T08:30:00+08:00",
        type: "Vaccination",
        status: "scheduled",
        control_number: "INF-2026-000002",
      },
      {
        id: 3,
        first_name: "Infant",
        last_name: "Three",
        guardian_name: "Karen Mabini",
        scheduled_date: "2026-05-15T09:00:00+08:00",
        type: "Vaccination",
        status: "No Show",
        control_number: "INF-2026-000003",
      },
    ];
    mockCalendarAvailability = { dates: [] };
    mockDailyCapacity = {
      date: "2026-05-15",
      current: 3,
      maximum: 400,
      remaining: 397,
    };

    try {
      render(
        <MemoryRouter>
          <AdminLayout>
            <Appointments />
          </AdminLayout>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Appointments for Friday, May 15, 2026"),
        ).toBeInTheDocument();
        expect(screen.getByText("Attended")).toBeInTheDocument();
        expect(screen.getByText("Scheduled")).toBeInTheDocument();
        expect(screen.getByText("No Show")).toBeInTheDocument();
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
        expect(screen.getByText("No cancelled appointments")).toBeInTheDocument();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
