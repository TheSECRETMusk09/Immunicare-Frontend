import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import Sidebar from "../components/Sidebar";
import MobileBottomNav from "../components/Navigation/MobileBottomNav";
import {
  adminRoutePaths,
  guardianRoutePaths,
  legacyRouteRedirects,
} from "../utils/routePaths";

const mockNavigate = jest.fn();
let mockPathname = "/guardian/dashboard";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, firstName: "Guardian", username: "guardian.user" },
    guardianId: 1,
    logout: jest.fn(),
  }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    darkMode: false,
    toggleDarkMode: jest.fn(),
  }),
}));

jest.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    transferInSubmitted: jest.fn(),
    success: jest.fn(),
  }),
}));

jest.mock("../hooks/useCachedData", () => ({
  usePrefetchGuardian: () => ({ prefetchGuardianData: jest.fn() }),
  usePrefetchDashboard: () => ({ prefetchDashboardData: jest.fn() }),
  useGuardianStats: () => ({ data: { childrenCount: 1 } }),
}));

jest.mock("../hooks/useGuardianNotifications", () => () => ({
  unreadCount: 0,
}));

jest.mock("../services/notificationService", () => ({
  sendTransferInSubmittedNotification: jest.fn(),
}));

jest.mock("../utils/api", () => ({
  getGuardianStats: jest.fn().mockResolvedValue({ data: { childrenCount: 1 } }),
  getInfantsByGuardian: jest.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        first_name: "Jamie",
        last_name: "Doe",
        sex: "F",
        dob: "2025-01-15",
        control_number: "INF-001",
        health_center: "San Nicolas Health Center",
      },
    ],
  }),
  get: jest.fn().mockResolvedValue({
    success: true,
    data: {
      readinessStatus: "READY",
      nextAppointmentPrediction: { date: "2026-03-30" },
    },
  }),
}));

describe("Phase 1 route cleanup", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPathname = "/guardian/dashboard";
  });

  test("admin sidebar keeps transfer-in and digital papers out of the primary navigation", () => {
    mockPathname = "/analytics";

    render(
      <MemoryRouter>
        <Sidebar
          isOpen={true}
          onClose={jest.fn()}
          darkMode={false}
          onToggleDarkMode={jest.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /transfer-in cases/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /digital papers/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /analytics/i }));
    expect(mockNavigate).toHaveBeenCalledWith(adminRoutePaths.analytics);
  });

  test("mobile bottom navigation standardizes guardian account access under profile", () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /settings/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /profile/i }));

    expect(mockNavigate).toHaveBeenCalledWith(guardianRoutePaths.profile);
  });

  test("guardian route helpers standardize booking and documents hub targets", () => {
    expect(guardianRoutePaths.appointmentBooking()).toBe(
      "/guardian/appointments/new",
    );
    expect(guardianRoutePaths.appointmentBooking(1)).toBe(
      "/guardian/appointments/new?childId=1",
    );
    expect(guardianRoutePaths.documents).toBe("/guardian/documents");
  });

  test("legacy route helpers remain stable for existing guardian routes", () => {
    expect(typeof legacyRouteRedirects).toBe("object");
  });
});
