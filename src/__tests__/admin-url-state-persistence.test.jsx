import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import apiClient from "../utils/api";
import AnalyticsDashboard from "../components/Analytics/AnalyticsDashboard";
import InventoryManagement from "../components/InventoryManagement";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAnalyticsDashboard: jest.fn(),
    getFacilityInfo: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const AnalyticsHarness = () => {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate("/analytics?tab=overview")}>
        URL Overview
      </button>
      <button
        type="button"
        onClick={() => navigate("/analytics?tab=inventory-reminders")}
      >
        URL Inventory
      </button>
      <AnalyticsDashboard />
      <LocationProbe />
    </>
  );
};

const renderAnalyticsRoute = (initialEntry, element) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/analytics" element={element} />
      </Routes>
    </MemoryRouter>,
  );

const renderInventoryRoute = (initialEntry) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/inventory"
          element={
            <>
              <InventoryManagement />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("Admin module URL state persistence", () => {
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
    localStorage.clear();
    sessionStorage.clear();

    apiClient.getAnalyticsDashboard.mockResolvedValue({
      success: true,
      data: {},
    });
    apiClient.getFacilityInfo.mockResolvedValue({
      name: "Test Health Center",
      province: "Test Province",
      city: "Test City",
      barangay: "Test Barangay",
    });
  });

  test("Analytics deep link keeps Inventory & Reminders active on load", async () => {
    renderAnalyticsRoute(
      "/analytics?tab=inventory-reminders",
      <>
        <AnalyticsDashboard />
        <LocationProbe />
      </>,
    );

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    const inventoryTab = screen.getByRole("tab", {
      name: /inventory & reminders/i,
    });

    expect(inventoryTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "tab=inventory-reminders",
    );
  });

  test("Analytics uses URL as source of truth for tab changes and URL navigation", async () => {
    renderAnalyticsRoute("/analytics?tab=overview", <AnalyticsHarness />);

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    fireEvent.click(
      screen.getByRole("tab", { name: /inventory & reminders/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=inventory-reminders",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /url overview/i }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^overview$/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /url inventory/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: /inventory & reminders/i }),
      ).toHaveAttribute("aria-selected", "true");
    });
  });

  test("Analytics falls back to stored tab only when URL tab is missing", async () => {
    localStorage.setItem("admin.analytics.activeTab", "appointments-follow-up");

    renderAnalyticsRoute(
      "/analytics",
      <>
        <AnalyticsDashboard />
        <LocationProbe />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=appointments-follow-up",
      );
    });

    expect(
      screen.getByRole("tab", { name: /appointments & follow-up/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("Inventory module preserves active tab via URL and storage fallback", async () => {
    localStorage.setItem("admin.inventory.activeTab", "reports");

    renderInventoryRoute("/inventory");

    const reportsTabButton = await screen.findByRole("button", {
      name: /^reports$/i,
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=reports",
      );
    });

    expect(reportsTabButton).toHaveClass("border-b-2");

    fireEvent.click(screen.getByRole("button", { name: /inventory sheet/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=inventory_sheet",
      );
    });
  });
});
