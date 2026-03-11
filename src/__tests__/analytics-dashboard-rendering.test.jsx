import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import apiClient from "../utils/api";
import AnalyticsDashboard from "../components/Analytics/AnalyticsDashboard";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAnalyticsDashboard: jest.fn(),
  },
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    on: jest.fn(),
    off: jest.fn(),
    connectionState: "connected",
  }),
}));

jest.mock("recharts", () => {
  const React = require("react");

  const Passthrough = ({ children }) => <div>{children}</div>;

  return {
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    BarChart: Passthrough,
    LineChart: Passthrough,
    PieChart: Passthrough,
    Bar: Passthrough,
    Line: Passthrough,
    Pie: Passthrough,
    Cell: Passthrough,
    Legend: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/analytics?tab=overview"]}>
      <AnalyticsDashboard />
    </MemoryRouter>,
  );

const buildDashboardPayload = (overrides = {}) => ({
  summary: {
    totalRegisteredInfants: 22,
    totalGuardians: 18,
    vaccinationsCompletedToday: 4,
    infantsDueForVaccination: 6,
    overdueVaccinations: 2,
    pendingAppointments: 5,
    lowStockVaccines: 2,
    totalAvailableVaccineDoses: 120,
  },
  vaccinationAnalytics: {
    statusBreakdown: [
      { status: "completed", count: 8 },
      { status: "pending", count: 3 },
    ],
    vaccineProgress: [
      {
        vaccineKey: "BCG",
        vaccineName: "BCG",
        infantsCovered: 12,
        dosesAdministered: 12,
        dueCount: 1,
        overdueCount: 0,
        coverageRate: 54.5,
      },
    ],
  },
  appointmentFollowup: {
    totalInPeriod: 11,
    today: 2,
    attended: 5,
    pending: 4,
    cancelled: 1,
    upcoming7Days: 3,
    overdueFollowUps: 1,
    followUpsToday: 1,
    followUpsInPeriod: 3,
    statusBreakdown: [
      { status: "scheduled", count: 4 },
      { status: "attended", count: 5 },
    ],
  },
  inventory: {
    totalItems: 7,
    totalAvailableDoses: 120,
    lowStockCount: 2,
    criticalStockCount: 1,
    outOfStockCount: 0,
    byVaccine: [
      {
        vaccineKey: "PCV",
        vaccineName: "Pneumococcal Conjugate Vaccine",
        availableDoses: 16,
        lowStock: false,
        criticalStock: false,
      },
      {
        vaccineKey: "MMR",
        vaccineName: "Measles Mumps Rubella Combination",
        availableDoses: 8,
        lowStock: true,
        criticalStock: false,
      },
    ],
  },
  reminders: {
    smsSent: 32,
    smsDelivered: 28,
    smsFailed: 4,
    unreadNotifications: 6,
    failedSmsCount: 2,
    deliveryRate: 87.5,
  },
  demographics: {
    ageGroups: [
      { label: "0-5 months", count: 8 },
      { label: "6-11 months", count: 7 },
      { label: "12-23 months", count: 5 },
    ],
    genderBreakdown: [
      { label: "Male", count: 11 },
      { label: "Female", count: 9 },
    ],
    coverage: {
      infants: 22,
      guardians: 18,
    },
  },
  trends: {
    vaccination: [
      { date: "2026-03-01", label: "Mar 1", count: 0 },
      { date: "2026-03-02", label: "Mar 2", count: 4 },
    ],
    appointments: [
      { date: "2026-03-01", label: "Mar 1", count: 1 },
      { date: "2026-03-02", label: "Mar 2", count: 0 },
    ],
  },
  alerts: [
    {
      id: "stock-1",
      severity: "critical",
      type: "inventory",
      message: "BCG stock is low (3 remaining)",
      timestamp: "2026-03-03T10:00:00.000Z",
    },
  ],
  recentActivity: [
    {
      id: "appointment-1",
      type: "appointment",
      title: "Appointment update",
      description: "Baby One - attended",
      severity: "info",
      timestamp: "2026-03-03T11:00:00.000Z",
    },
  ],
  reportShortcuts: [
    {
      key: "vaccination-summary",
      title: "Vaccination Summary",
      format: "pdf",
      endpoint: "/api/reports/vaccination-summary",
    },
  ],
  metadata: {
    generatedAt: "2026-03-03T12:00:00.000Z",
    scope: {
      locality: "Barangay San Nicolas Health Center, Pasig City",
    },
  },
  ...overrides,
});

describe("Analytics dashboard rendering and filter stability", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    jest.clearAllMocks();
    cleanup();

    apiClient.getAnalyticsDashboard.mockResolvedValue({
      success: true,
      data: buildDashboardPayload(),
    });
  });

  test("renders trend modules with zero-filled points and labels", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    expect(screen.getByText(/vaccination trend/i)).toBeInTheDocument();
    expect(screen.getByText(/appointment trend/i)).toBeInTheDocument();
    expect(screen.queryByText(/no timeline points available/i)).not.toBeInTheDocument();
  });

  test("shows explicit zero-data demographics state when backend has no records", async () => {
    apiClient.getAnalyticsDashboard.mockResolvedValueOnce({
      success: true,
      data: buildDashboardPayload({
        demographics: {
          ageGroups: [],
          genderBreakdown: [],
          coverage: { infants: 0, guardians: 0 },
        },
      }),
    });

    renderDashboard();

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: /demographics & activity/i }));

    await waitFor(() => {
      expect(screen.getByText(/demographic coverage \(age groups\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/male vs female distribution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/line chart of infant age-group distribution/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/rounded doughnut chart comparing male and female infant counts/i),
    ).toBeInTheDocument();

    const zeroDataBadges = screen.getAllByText(/^0 data$/i);
    expect(zeroDataBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/no records available for current filters/i)).not.toBeInTheDocument();
  });

  test("inventory labels and dropdown filters remain interactive without screen blackout", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: /inventory & reminders/i }));

    await waitFor(() => {
      expect(screen.getByText(/available doses by vaccine/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/vaccine inventory summary/i)).toBeInTheDocument();
    expect(screen.getByText(/total inventory items/i)).toBeInTheDocument();

    const periodSelect = screen.getByRole("combobox", { name: /period/i });
    fireEvent.mouseDown(periodSelect);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /this month/i, hidden: true })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: /this week/i, hidden: true }));

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(2);
    });
  });

  test("normalizes wrapped and direct analytics payload responses so trend sections still render", async () => {
    apiClient.getAnalyticsDashboard.mockResolvedValueOnce({
      data: buildDashboardPayload(),
    });

    renderDashboard();

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    expect(screen.getByText(/vaccination trend/i)).toBeInTheDocument();
    expect(screen.getByText(/appointment trend/i)).toBeInTheDocument();
    expect(screen.queryByText(/failed to load analytics dashboard data/i)).not.toBeInTheDocument();
  });

  test("supports dashboard payloads that return criticalAlerts only and still renders Critical Alerts module", async () => {
    apiClient.getAnalyticsDashboard.mockResolvedValueOnce({
      success: true,
      data: buildDashboardPayload({
        alerts: undefined,
        criticalAlerts: [
          {
            id: "critical-1",
            severity: "critical",
            type: "vaccination",
            message: "12 infant vaccinations overdue",
            timestamp: "2026-03-10T09:00:00.000Z",
          },
        ],
      }),
    });

    renderDashboard();

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: /demographics & activity/i }));

    await waitFor(() => {
      expect(screen.getByText(/critical alerts/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/12 infant vaccinations overdue/i)).toBeInTheDocument();

    expect(screen.queryByText(/no critical alerts for current filters/i)).not.toBeInTheDocument();
  });

  test("renders KPI cards from canonical summary fields for infants, guardians, completed today, and due", async () => {
    apiClient.getAnalyticsDashboard.mockResolvedValueOnce({
      success: true,
      data: buildDashboardPayload({
        summary: {
          totalRegisteredInfants: 143,
          totalGuardians: 118,
          vaccinationsCompletedToday: 27,
          infantsDueForVaccination: 39,
          overdueVaccinations: 12,
          pendingAppointments: 15,
          lowStockVaccines: 4,
          totalAvailableVaccineDoses: 920,
        },
      }),
    });

    renderDashboard();

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    expect(screen.getByText(/total registered infants/i)).toBeInTheDocument();
    expect(screen.getByText(/total guardians/i)).toBeInTheDocument();
    expect(screen.getByText(/vaccinations completed today/i)).toBeInTheDocument();
    expect(screen.getByText(/infants due for vaccination/i)).toBeInTheDocument();

    expect(screen.getByText("143")).toBeInTheDocument();
    expect(screen.getByText("118")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByText("39")).toBeInTheDocument();
    expect(screen.getByText(/12 overdue/i)).toBeInTheDocument();
  });

  test("shows auto-refresh warning without clearing existing rendered cards when silent refresh fails", async () => {
    jest.useFakeTimers();
    try {
      apiClient.getAnalyticsDashboard
        .mockResolvedValueOnce({
          success: true,
          data: buildDashboardPayload(),
        })
        .mockRejectedValueOnce(new Error("Network timeout"));

      renderDashboard();

      const totalInfantsTitle = await screen.findByText(/total registered infants/i);
      expect(totalInfantsTitle).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryAllByText("22").length).toBeGreaterThan(0);
      });

      await act(async () => {
        jest.advanceTimersByTime(30000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText(/auto-refresh failed: network timeout/i)).toBeInTheDocument();
      });

      expect(screen.queryAllByText("22").length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
