import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import GuardianDashboard from "../pages/GuardianDashboard";
import GuardianSidebar from "../components/GuardianSidebar";
import apiClient from "../utils/api";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockPrefetchGuardianData = jest.fn();
const mockToggleDarkMode = jest.fn();
const mockMarkAsRead = jest.fn();
const mockRefreshNotifications = jest.fn();
const mockNotifications = [];
const mockGuardianNotificationsState = {
  notifications: mockNotifications,
  loading: false,
  error: null,
  unreadCount: 2,
  markAsRead: mockMarkAsRead,
  refresh: mockRefreshNotifications,
};

let mockPathname = "/guardian/dashboard";

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
  };
});

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    guardianId: 1,
    user: {
      id: 1,
      firstName: "Guardian",
      username: "guardian",
      email: "guardian@example.com",
      role: "guardian",
      role_type: "guardian",
    },
    logout: mockLogout,
  }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    darkMode: false,
    toggleDarkMode: mockToggleDarkMode,
  }),
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    isConnected: false,
    on: jest.fn(),
    off: jest.fn(),
  }),
}));

jest.mock("../hooks/useCachedData", () => ({
  usePrefetchGuardian: () => ({
    prefetchGuardianData: mockPrefetchGuardianData,
  }),
  useGuardianStats: () => ({
    data: { childrenCount: 1 },
  }),
}));

jest.mock("../hooks/useGuardianNotifications", () => ({
  __esModule: true,
  default: () => mockGuardianNotificationsState,
}));

jest.mock("../components/GuardianTopHeader", () => ({
  __esModule: true,
  default: ({ onRefresh, isRefreshing }) => (
    <button type="button" onClick={onRefresh}>
      {isRefreshing ? "Refreshing" : "Refresh"}
    </button>
  ),
}));

jest.mock("../components/GuardianModuleHeader", () => ({
  __esModule: true,
  default: ({ title, subtitle, actions }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
    </header>
  ),
}));

jest.mock("../components/ErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

jest.mock("../components/QuickActionFAB", () => ({
  triggerGuardianAddChildModal: jest.fn(),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getGuardianDashboardOverview: jest.fn(),
  },
}));

describe("Guardian current button flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/guardian/dashboard";
    mockLogout.mockResolvedValue(undefined);

    apiClient.getGuardianDashboardOverview.mockResolvedValue({
      children: [
        {
          id: 1,
          first_name: "John",
          last_name: "Doe",
          dob: "2023-01-01",
          control_number: "CN-001",
          completed_vaccinations: 3,
          pending_vaccinations: 1,
        },
      ],
      appointments: [
        {
          id: 101,
          first_name: "John",
          last_name: "Doe",
          scheduled_date: "2030-03-04T09:00:00",
          vaccine_name: "BCG",
          status: "scheduled",
        },
      ],
      dueVaccines: [
        {
          id: "due-1",
          childName: "John Doe",
          vaccineName: "BCG",
          dueDate: "2030-03-04",
          daysUntilDue: -2,
          status: "overdue",
        },
      ],
      stats: {
        childrenCount: 1,
        nextAppointment: { scheduled_date: "2030-03-04T09:00:00" },
        completedVaccinations: 3,
        pendingVaccinations: 1,
        overdueVaccinations: 1,
        upcomingVaccines: 0,
      },
      diagnostics: {
        warnings: [],
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("dashboard quick action routes transfer registrations through the current child module", async () => {
    render(
      <MemoryRouter>
        <GuardianDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /^transfer$/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/guardian/children", {
      state: {
        openGuardianRegistrationModal: true,
        registrationType: "transfer",
      },
    });
  });

  test("dashboard overdue booking CTA routes directly to the guardian booking page", async () => {
    render(
      <MemoryRouter>
        <GuardianDashboard />
      </MemoryRouter>,
    );

    const bookingButtons = await screen.findAllByRole("button", {
      name: /book now/i,
    });
    fireEvent.click(bookingButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/guardian/appointments/new");
  });

  test("dashboard desktop header buttons still route to notifications and profile", async () => {
    render(
      <MemoryRouter>
        <GuardianDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /open notifications/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /open profile/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/guardian/notifications");
    expect(mockNavigate).toHaveBeenCalledWith("/guardian/profile");
  });

  test("sidebar expands vaccinations and routes to the current immunization chart page", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/dashboard"]}>
        <GuardianSidebar
          isOpen
          onClose={jest.fn()}
          onToggle={jest.fn()}
          isDesktop={false}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /vaccinations/i }));
    fireEvent.click(await screen.findByRole("button", { name: /immunization chart/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/guardian/immunization-chart");
  });

  test("sidebar logout confirmation still completes the current guardian sign-out flow", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/dashboard"]}>
        <GuardianSidebar
          isOpen
          onClose={jest.fn()}
          onToggle={jest.fn()}
          isDesktop={false}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("guardian@example.com").closest("button"));
    fireEvent.click(await screen.findByRole("button", { name: /^logout$/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
