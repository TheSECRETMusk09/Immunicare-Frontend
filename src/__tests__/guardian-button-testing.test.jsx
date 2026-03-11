import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom";

import GuardianDashboard from "../pages/GuardianDashboard";
import MobileBottomNav from "../components/MobileBottomNav";
import GuardianSidebar from "../components/GuardianSidebar";
import MyChildren from "../pages/MyChildren";
import Appointments from "../pages/Appointments";
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

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthContext,
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    unreadCount: 2,
    alerts: [],
    notifications: [],
  }),
}));

jest.mock("../hooks/useCachedData", () => ({
  usePrefetchGuardian: () => ({
    prefetchGuardianData: jest.fn(),
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
    getGuardianNotifications: jest.fn().mockResolvedValue({ data: [] }),
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
  test("Appointments quick action navigates to appointments page", async () => {
    setViewport(1280, 800);

    renderWithRoutes("/guardian/dashboard", {
      "/guardian/dashboard": <GuardianDashboard />,
      "/guardian/appointments": <div>GUARDIAN_APPOINTMENTS_PAGE</div>,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^appointments$/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^appointments$/i }));

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
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /^records$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^immunization$/i }),
    ).toBeInTheDocument();
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
    });

    await waitFor(() => {
      expect(screen.getByText("View All Records")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /view all records/i }));

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

  test("Appointments page opens scheduling modal", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/appointments"]}>
        <Appointments />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /schedule new appointment/i })
          .length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /schedule new appointment/i })[0],
    );

    expect(await screen.findByText(/select infant/i)).toBeInTheDocument();
  });

  test("Appointments page allows switching to calendar view", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/appointments"]}>
        <Appointments />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /calendar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

    expect(
      await screen.findByRole("heading", { name: /calendar view/i }),
    ).toBeInTheDocument();
  });
});
