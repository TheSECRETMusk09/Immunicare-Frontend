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
    getVaccineInventory: jest.fn(),
    getVaccineInventoryTransactions: jest.fn(),
    getVaccines: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
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
  return (
    <>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
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
    apiClient.getVaccineInventory.mockResolvedValue([]);
    apiClient.getVaccineInventoryTransactions.mockResolvedValue([]);
    apiClient.getVaccines.mockResolvedValue([]);
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

  test("Analytics filter interactions keep pathname pinned to /analytics while only refreshing data", async () => {
    apiClient.getAnalyticsDashboard.mockResolvedValue({
      success: true,
      data: {
        summary: {
          totalRegisteredInfants: 8,
          totalGuardians: 6,
          vaccinationsCompletedToday: 2,
          infantsDueForVaccination: 3,
        },
      },
    });

    renderAnalyticsRoute(
      "/analytics?tab=overview",
      <>
        <AnalyticsDashboard />
        <LocationProbe />
      </>,
    );

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");

    const periodSelect = screen.getByRole("combobox", { name: /period/i });
    fireEvent.mouseDown(periodSelect);
    fireEvent.click(screen.getByRole("option", { name: /today/i, hidden: true }));

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");

    fireEvent.mouseDown(periodSelect);
    fireEvent.click(
      screen.getByRole("option", { name: /custom date range/i, hidden: true }),
    );

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    fireEvent.change(startDateInput, { target: { value: "2026-03-01" } });
    fireEvent.change(endDateInput, { target: { value: "2026-03-10" } });

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(5);
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");
    expect(screen.getByTestId("location-search")).toHaveTextContent("tab=overview");

    const vaccineSelect = screen.getByRole("combobox", { name: /vaccine/i });
    fireEvent.mouseDown(vaccineSelect);
    fireEvent.click(screen.getByRole("option", { name: /^BCG$/i, hidden: true }));

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(6);
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");
    expect(screen.getByTestId("location-search")).toHaveTextContent("tab=overview");

    const statusSelect = screen.getByRole("combobox", { name: /vaccination status/i });
    fireEvent.mouseDown(statusSelect);
    fireEvent.click(screen.getByRole("option", { name: /completed/i, hidden: true }));

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalledTimes(7);
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");
    expect(screen.getByTestId("location-search")).toHaveTextContent("tab=overview");

    fireEvent.click(screen.getByRole("switch", { name: /auto-refresh/i }));
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");
    expect(screen.getByTestId("location-search")).toHaveTextContent("tab=overview");
  });

  test("Analytics canonicalizes tab search to tab-only after invalid deep link tab while staying on /analytics", async () => {
    renderAnalyticsRoute(
      "/analytics?tab=invalid-tab&foo=bar",
      <>
        <AnalyticsDashboard />
        <LocationProbe />
      </>,
    );

    await waitFor(() => {
      expect(apiClient.getAnalyticsDashboard).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname")).toHaveTextContent("/analytics");
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=overview",
      );
    });

    expect(screen.getByTestId("location-search").textContent || "").not.toContain("foo=");
    expect(
      screen.getByRole("tab", { name: /^overview$/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("Inventory module preserves the Inventory Summary tab via URL and storage fallback", async () => {
    localStorage.setItem("admin.inventory.activeTab", "stock_alerts");

    renderInventoryRoute("/inventory");

    const inventorySummaryTabButton = await screen.findByRole("button", {
      name: /inventory summary/i,
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=inventory_summary",
      );
    });

    expect(inventorySummaryTabButton).toHaveClass("bg-white");
    expect(screen.getByTestId("inventory-summary-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /inventory sheet/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=inventory_sheet",
      );
    });
  });

  test("Inventory tab switching replaces the inventory sheet panel with stock movement history", async () => {
    apiClient.getVaccineInventory.mockResolvedValue([
      {
        id: 301,
        clinic_id: 7,
        vaccine_id: 1,
        vaccine_name: "BCG",
        beginning_balance: 42,
        received_during_period: 10,
        lot_batch_number: "BCG-INV-001",
        transferred_in: 2,
        transferred_out: 4,
        expired_wasted: 0,
        issuance: 8,
      },
    ]);
    apiClient.getVaccineInventoryTransactions.mockResolvedValue([
      {
        id: 777,
        transaction_type: "RECEIVE",
        quantity: 10,
        previous_balance: 42,
        new_balance: 52,
        vaccine_name: "BCG",
        lot_batch_number: "BCG-LOT-002",
        reference_number: "PO-777",
        notes: "&#x2F;PO-777&#x2F; &amp; checked",
        created_at: "2026-03-21T08:30:00.000Z",
        performed_by_name: "Sam Orin",
        performed_by_username: "samorin123",
        performed_by_role: "SYSTEM_ADMIN",
      },
    ]);

    renderInventoryRoute("/inventory?tab=inventory_sheet");

    expect(
      await screen.findByTestId("inventory-sheet-panel"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save inventory/i })).toBeInTheDocument();
    expect(apiClient.getVaccineInventoryTransactions).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        clinic_id: 7,
        limit: 250,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /stock movements/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=stock_movements",
      );
    });

    expect(
      await screen.findByTestId("inventory-stock-movements-panel"),
    ).toBeInTheDocument();
    expect(screen.getByText(/stock movement history/i)).toBeInTheDocument();
    expect(screen.getByText("PO-777")).toBeInTheDocument();
    expect(screen.getByText("/PO-777/ & checked")).toBeInTheDocument();
    expect(screen.getByText("samorin123")).toBeInTheDocument();
    expect(screen.getByText("System Admin")).toBeInTheDocument();
    expect(screen.queryByTestId("inventory-sheet-panel")).not.toBeInTheDocument();
    expect(screen.queryByText(/beginning balance/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save inventory/i })).not.toBeInTheDocument();
  });

  test("Inventory transaction deep links resolve to Stock Movements and render transaction history", async () => {
    apiClient.getVaccineInventoryTransactions.mockResolvedValue([
      {
        id: 501,
        transaction_type: "ISSUE",
        quantity: 12,
        previous_balance: 88,
        new_balance: 76,
        vaccine_name: "BCG",
        lot_batch_number: "BCG-LOT-001",
        created_at: "2026-03-20T09:15:00.000Z",
        performed_by_name: "system-admin",
        performed_by_username: "system-admin",
        performed_by_role: "STAFF_NURSE",
      },
    ]);

    renderInventoryRoute("/inventory?tab=transactions");

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=stock_movements",
      );
    });

    await screen.findByText(/stock movement history/i);

    expect(
      screen.getByRole("button", { name: /stock movements/i }),
    ).toHaveClass("bg-white");
    expect(screen.getByText(/stock movement history/i)).toBeInTheDocument();
    expect(screen.getByText("BCG")).toBeInTheDocument();
    expect(screen.getByText("system-admin")).toBeInTheDocument();
    expect(screen.getByText("Staff Nurse")).toBeInTheDocument();
    expect(screen.queryByText(/save inventory/i)).not.toBeInTheDocument();
  });

  test("Inventory legacy reports tab canonicalizes to the supported inventory sheet tab", async () => {
    renderInventoryRoute("/inventory?tab=reports");

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=inventory_sheet",
      );
    });
  });
});
