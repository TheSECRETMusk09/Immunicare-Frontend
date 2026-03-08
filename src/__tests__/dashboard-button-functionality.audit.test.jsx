import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import MobileBottomNav from "../components/MobileBottomNav";
import GuardianSidebar from "../components/GuardianSidebar";
import Sidebar from "../components/Sidebar";
import DashboardOverview from "../components/Dashboard/DashboardOverview";
import Analytics from "../pages/Analytics";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
let mockPathname = "/guardian/dashboard";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, first_name: "Guardian", role_type: "GUARDIAN" },
    guardianId: 1,
    logout: mockLogout,
  }),
}));

jest.mock("../hooks/useCachedData", () => ({
  usePrefetchGuardian: () => ({ prefetchGuardianData: jest.fn() }),
  usePrefetchDashboard: () => ({ prefetchDashboardData: jest.fn() }),
  useDashboardStats: () => ({ data: { infants: 12 }, isLoading: false }),
  useDashboardAppointments: () => ({
    data: [{ id: 10, infant_name: "Baby A", scheduled_date: "2026-02-28" }],
    isLoading: false,
  }),
  useDashboardInfants: () => ({ data: [{ id: 1 }], isLoading: false }),
  useVaccineInventory: () => ({
    data: [{ id: 1, is_critical_stock: true }],
    isLoading: false,
  }),
  useAdminVaccinationMonitoring: () => ({
    data: {
      summary: { overdueInfants: 1, dueSoonInfants: 2 },
      data: [
        {
          infant_id: 1,
          first_name: "Test",
          last_name: "Infant",
          next_status: "overdue",
          guardian_name: "Guardian One",
          next_due_date: "2026-03-01",
          completed_count: 1,
          pending_count: 2,
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
    isConnected: true,
    unreadCount: 2,
    alerts: [],
    notifications: [],
  }),
}));

jest.mock("../hooks/useDashboard", () => ({
  useVaccinationAnalytics: () => ({ data: [], loading: false }),
  useAppointmentAnalytics: () => ({ data: [], loading: false }),
}));

describe("Dashboard button functionality audit", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLogout.mockClear();
    mockPathname = "/guardian/dashboard";
  });

  test("Guardian mobile bottom nav buttons navigate to expected routes", () => {
    render(<MobileBottomNav />);

    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    fireEvent.click(screen.getByRole("button", { name: /appointments/i }));
    fireEvent.click(screen.getByRole("button", { name: /records/i }));
    fireEvent.click(screen.getByRole("button", { name: /schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, "/guardian/dashboard");
    expect(mockNavigate).toHaveBeenNthCalledWith(2, "/guardian/appointments");
    expect(mockNavigate).toHaveBeenNthCalledWith(
      3,
      "/guardian/vaccination-records",
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      4,
      "/guardian/immunization-chart",
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(5, "/guardian/profile");
  });

  test("Guardian sidebar primary buttons navigate to expected routes", () => {
    render(
      <GuardianSidebar
        isOpen={true}
        onClose={jest.fn()}
        darkMode={{ isDarkMode: false, toggle: jest.fn() }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /my children/i }));
    fireEvent.click(screen.getByRole("button", { name: /appointments/i }));
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/guardian/children");
    expect(mockNavigate).toHaveBeenCalledWith("/guardian/appointments");
    expect(mockNavigate).toHaveBeenCalledWith("/guardian/notifications");
    expect(mockNavigate).toHaveBeenCalledWith("/guardian/settings");
  });

  test("Admin dashboard notifications actions navigate correctly", () => {
    mockPathname = "/dashboard";

    render(<DashboardOverview />);

    fireEvent.click(
      screen.getByRole("button", { name: /open notifications/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /go to notifications/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });

  test("Admin sidebar buttons route correctly and logout opens confirmation", () => {
    mockPathname = "/dashboard";

    render(
      <Sidebar
        isOpen={true}
        onClose={jest.fn()}
        darkMode={false}
        onToggleDarkMode={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /analytics/i }));
    fireEvent.click(screen.getByRole("button", { name: /appointments/i }));
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/analytics");
    expect(mockNavigate).toHaveBeenCalledWith("/appointments");
    expect(mockNavigate).toHaveBeenCalledWith("/settings");

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(screen.getByText(/confirm logout/i)).toBeInTheDocument();
  });

  test("Admin sidebar renders live date-time above Dashboard and updates in real time", () => {
    mockPathname = "/dashboard";
    const datetimePattern =
      /^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*•\s*\d{1,2}:\d{2}\s+(AM|PM)$/;

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-08T02:45:00.000Z"));

    try {
      render(
        <Sidebar
          isOpen={true}
          onClose={jest.fn()}
          darkMode={false}
          onToggleDarkMode={jest.fn()}
        />,
      );

      const dateTimeText = screen.getByTestId("admin-sidebar-datetime-text");
      const dashboardButton = screen.getByRole("button", { name: /dashboard/i });

      expect(dateTimeText).toBeInTheDocument();
      expect(dateTimeText.textContent.trim()).toMatch(datetimePattern);

      expect(
        dateTimeText.compareDocumentPosition(dashboardButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      const initialText = dateTimeText.textContent;

      act(() => {
        jest.advanceTimersByTime(61_000);
      });

      expect(dateTimeText.textContent.trim()).toMatch(datetimePattern);
      expect(dateTimeText.textContent).not.toBe(initialText);
    } finally {
      jest.useRealTimers();
    }
  });

  test("Analytics page renders resilient empty state without crashing", () => {
    render(<Analytics />);

    expect(screen.getByText(/analytics dashboard/i)).toBeInTheDocument();
    expect(
      screen.getByText(/analytics data is currently limited/i),
    ).toBeInTheDocument();
  });
});
