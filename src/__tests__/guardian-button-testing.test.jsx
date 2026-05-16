import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom";

import GuardianDashboard from "../pages/GuardianDashboard";
import MobileBottomNav from "../components/MobileBottomNav";
import GuardianSidebar from "../components/GuardianSidebar";
import MyChildren from "../pages/MyChildren";
import GuardianAppointmentsPage from "../pages/GuardianAppointmentsPage";
import apiClient from "../utils/api";
import {
  GUARDIAN_INFANT_REGISTERED_EVENT,
  GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
} from "../components/QuickActionFAB";

const mockAuthContext = {
  user: { id: 1, first_name: "Test", username: "guardian_test" },
  guardianId: 1,
  logout: jest.fn(),
  forcePasswordChange: false,
  updateUserPasswordStatus: jest.fn(),
};
const stableGuardianNotifications = [];

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthContext,
}));

jest.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    transferInSubmitted: jest.fn(),
    success: jest.fn(),
  }),
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    unreadCount: 2,
    alerts: [],
    notifications: [],
    on: jest.fn(),
    off: jest.fn(),
  }),
}));

jest.mock("../hooks/useCachedData", () => ({
  usePrefetchGuardian: () => ({
    prefetchGuardianData: jest.fn(),
  }),
  useGuardianStats: () => ({
    data: { childrenCount: 2 },
  }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    darkMode: false,
    toggleDarkMode: jest.fn(),
  }),
}));

jest.mock("../hooks/useGuardianNotifications", () => ({
  __esModule: true,
  default: () => ({
    notifications: stableGuardianNotifications,
    unreadCount: 0,
    refresh: jest.fn(),
  }),
}));

jest.mock("../hooks/useDashboard", () => {
  const stableAppointments = [
    {
      id: 1,
      infant_id: 1,
      first_name: "John",
      last_name: "Doe",
      guardian_name: "Test Guardian",
      scheduled_date: "2030-02-20T10:00:00",
      type: "Vaccination",
      status: "scheduled",
    },
  ];

  const stableInfants = [
    {
      id: 1,
      first_name: "John",
      last_name: "Doe",
      control_number: "CN-001",
    },
  ];

  return {
    useAppointments: () => ({
      appointments: stableAppointments,
      loading: false,
      error: null,
    }),
    useInfants: () => ({
      infants: stableInfants,
      loading: false,
      error: null,
    }),
  };
});

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfantsByGuardian: jest.fn().mockResolvedValue([
      {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        sex: "M",
        dob: "2020-01-01",
        status: "active",
        health_center: "Health Center A",
        control_number: "CN-001",
      },
      {
        id: 2,
        first_name: "Jane",
        last_name: "Doe",
        sex: "F",
        dob: "2021-06-15",
        status: "active",
        health_center: "Health Center B",
        control_number: "CN-002",
      },
    ]),
    getGuardianAppointments: jest.fn().mockResolvedValue([
      {
        id: 1,
        infant_id: 1,
        first_name: "John",
        last_name: "Doe",
        guardian_name: "Test Guardian",
        scheduled_date: "2030-02-20T10:00:00",
        type: "Vaccination",
        status: "scheduled",
        location: "Health Center A",
      },
    ]),
    getGuardianStats: jest.fn().mockResolvedValue({
      childrenCount: 2,
      nextAppointment: "2030-02-20",
      completedVaccinations: 10,
      pendingVaccinations: 3,
    }),
    getGuardianDashboardOverview: jest.fn().mockResolvedValue({
      summary: {
        childrenCount: 2,
        nextAppointment: "2030-02-20",
        completedVaccinations: 10,
        pendingVaccinations: 3,
      },
      appointments: [
        {
          id: 1,
          infant_id: 1,
          first_name: "John",
          last_name: "Doe",
          guardian_name: "Test Guardian",
          scheduled_date: "2030-02-20T10:00:00",
          type: "Vaccination",
          status: "scheduled",
          location: "Health Center A",
        },
      ],
      notifications: [],
      dueVaccines: [],
      alerts: [],
    }),
    getGuardianNotifications: jest.fn().mockResolvedValue({ data: [] }),
    getVaccines: jest.fn().mockResolvedValue([
      { id: 1, name: "BCG" },
      { id: 2, name: "Penta Valent" },
    ]),
    getAppointmentCalendarAvailability: jest.fn().mockResolvedValue({
      dates: [],
      blockedDates: {},
    }),
    getAppointmentDateDetails: jest.fn().mockResolvedValue({
      appointments: [],
      summary: { total: 0 },
      availability: { available: true, message: "Available for booking" },
      isWeekend: false,
      holiday: null,
    }),
    checkAppointmentAvailability: jest.fn().mockResolvedValue({
      available: true,
      message: "Available for booking",
    }),
    get: jest.fn().mockResolvedValue({ success: false }),
    getDashboardAppointments: jest.fn().mockResolvedValue([
      {
        id: 1,
        infant_id: 1,
        first_name: "John",
        last_name: "Doe",
        guardian_name: "Test Guardian",
        scheduled_date: "2030-02-20T10:00:00",
        type: "Vaccination",
        status: "scheduled",
        location: "Health Center A",
      },
    ]),
    getDashboardInfants: jest.fn().mockResolvedValue([
      {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        sex: "M",
        dob: "2020-01-01",
        status: "active",
        health_center: "Health Center A",
        control_number: "CN-001",
      },
      {
        id: 2,
        first_name: "Jane",
        last_name: "Doe",
        sex: "F",
        dob: "2021-06-15",
        status: "active",
        health_center: "Health Center B",
        control_number: "CN-002",
      },
    ]),
    createAppointment: jest.fn().mockResolvedValue({ id: 999 }),
    updateAppointment: jest.fn().mockResolvedValue({ success: true }),
    cancelAppointment: jest.fn().mockResolvedValue({ success: true }),
  },
}));

function setViewport(width, height) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

function renderWithRoutes(initialEntry, routeMap) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        {Object.entries(routeMap).map(([path, element]) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("Guardian dashboard journey smoke tests", () => {
  test("Appointments section view-all button navigates to appointments page", async () => {
    setViewport(1280, 800);

    renderWithRoutes("/guardian/dashboard", {
      "/guardian/dashboard": <GuardianDashboard />,
      "/guardian/appointments": <div>GUARDIAN_APPOINTMENTS_PAGE</div>,
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^appointments$/i })).toBeInTheDocument();
    });

    const appointmentsHeading = screen.getByRole("heading", { name: /^appointments$/i });
    const appointmentsSectionHeader = appointmentsHeading.parentElement?.parentElement;
    const appointmentsViewAllButton = appointmentsSectionHeader?.querySelector("button");

    expect(appointmentsViewAllButton).toBeTruthy();
    fireEvent.click(appointmentsViewAllButton);

    expect(await screen.findByText("GUARDIAN_APPOINTMENTS_PAGE")).toBeInTheDocument();
  });

  test("Guardian dashboard remains usable in mobile viewport", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter initialEntries={["/guardian/dashboard"]}>
        <GuardianDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^my children$/i })).toBeInTheDocument();
    });

    expect(screen.queryByText("Quick Actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^records$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^immunization$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^appointments$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^notifications$/i })).toBeInTheDocument();
  });
});

describe("Guardian navigation components", () => {
  test("Mobile bottom nav routes to Appointments", async () => {
    renderWithRoutes("/guardian/dashboard", {
      "/guardian/dashboard": <MobileBottomNav />,
      "/guardian/appointments": <div>GUARDIAN_APPOINTMENTS_PAGE</div>,
    });

    fireEvent.click(screen.getByRole("button", { name: /appointments/i }));

    expect(
      await screen.findByText("GUARDIAN_APPOINTMENTS_PAGE"),
    ).toBeInTheDocument();
  });

  test("Guardian sidebar routes to My Children", async () => {
    setViewport(1280, 800);

    renderWithRoutes("/guardian/dashboard", {
      "/guardian/dashboard": (
        <GuardianSidebar isOpen={true} onClose={jest.fn()} darkMode={false} />
      ),
      "/guardian/children": <div>MY_CHILDREN_PAGE</div>,
    });

    fireEvent.click(screen.getByRole("button", { name: /my children/i }));

    expect(await screen.findByText("MY_CHILDREN_PAGE")).toBeInTheDocument();
  });
});

describe("Guardian module pages", () => {
  test("MyChildren page quick actions navigate to records", async () => {
    apiClient.getInfantsByGuardian.mockResolvedValueOnce([
      {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        sex: "M",
        dob: "2020-01-01",
        status: "active",
        health_center: "Health Center A",
      },
    ]);

    renderWithRoutes("/guardian/children", {
      "/guardian/children": <MyChildren />,
      "/guardian/vaccination-records": <div>VACCINATION_RECORDS_PAGE</div>,
      "/guardian/vaccination-records/:childId": <div>VACCINATION_RECORDS_PAGE</div>,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^records$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^records$/i }));

    expect(
      await screen.findByText("VACCINATION_RECORDS_PAGE"),
    ).toBeInTheDocument();
  });

  test("MyChildren opens Add Child modal when global add-child event is dispatched", async () => {
    renderWithRoutes("/guardian/children", {
      "/guardian/children": <MyChildren />,
    });

    await waitFor(() => {
      expect(screen.getByText(/my children/i)).toBeInTheDocument();
    });

    window.dispatchEvent(new CustomEvent(GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT));

    expect(
      await screen.findByRole("heading", { name: /register new child/i }),
    ).toBeInTheDocument();
  });

  test("MyChildren links purok and street-color selections in the registration form", async () => {
    renderWithRoutes("/guardian/children", {
      "/guardian/children": <MyChildren />,
    });

    await waitFor(() => {
      expect(screen.getByText(/my children/i)).toBeInTheDocument();
    });

    window.dispatchEvent(new CustomEvent(GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT));

    const purokSelect = await screen.findByLabelText(/^purok$/i);
    const streetColorSelect = screen.getByLabelText(/^purok-street-color$/i);

    expect(streetColorSelect).toBeDisabled();

    fireEvent.change(purokSelect, { target: { value: "Purok 1" } });

    expect(streetColorSelect).not.toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Son Risa St. - Pink" }),
    ).toBeInTheDocument();

    fireEvent.change(streetColorSelect, {
      target: { value: "Son Risa St. - Pink" },
    });
    expect(streetColorSelect).toHaveValue("Son Risa St. - Pink");

    fireEvent.change(purokSelect, { target: { value: "Purok 2" } });

    expect(streetColorSelect).toHaveValue("");
    expect(
      screen.queryByRole("option", { name: "Son Risa St. - Pink" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "M.H Del Pilar - Blue" }),
    ).toBeInTheDocument();
  });

  test("Appointment booking refreshes children list when infant registered event is dispatched", async () => {
    const baselineChildren = [
      {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        sex: "M",
        dob: "2020-01-01",
        control_number: "CN-001",
      },
    ];

    const updatedChildren = [
      ...baselineChildren,
      {
        id: 3,
        first_name: "Baby",
        last_name: "New",
        sex: "F",
        dob: "2026-01-10",
        control_number: "CN-003",
      },
    ];

    apiClient.getInfantsByGuardian
      .mockResolvedValueOnce(baselineChildren)
      .mockResolvedValueOnce(updatedChildren);

    const { default: GuardianAppointmentBooking } = await import(
      "../pages/GuardianAppointmentBooking"
    );

    renderWithRoutes("/guardian/appointments/new", {
      "/guardian/appointments/new": <GuardianAppointmentBooking />,
    });

    await waitFor(() => {
      expect(screen.getByText(/select child/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Baby New/i)).not.toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(GUARDIAN_INFANT_REGISTERED_EVENT));

    expect(await screen.findByText(/Baby New/i)).toBeInTheDocument();
  });

  test("Guardian appointments page routes to the dedicated booking page", async () => {
    renderWithRoutes("/guardian/appointments", {
      "/guardian/appointments": <GuardianAppointmentsPage />,
      "/guardian/appointments/new": <div>GUARDIAN_APPOINTMENT_BOOKING_PAGE</div>,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /new appointment/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /new appointment/i }));

    expect(
      await screen.findByText("GUARDIAN_APPOINTMENT_BOOKING_PAGE"),
    ).toBeInTheDocument();
  });

  test("Guardian appointments page allows switching back to calendar view on mobile", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter initialEntries={["/guardian/appointments"]}>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^calendar$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /upcoming/i }));
    fireEvent.click(screen.getByRole("tab", { name: /^calendar$/i }));

    expect(
      screen.getByRole("tab", { name: /^calendar$/i }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
