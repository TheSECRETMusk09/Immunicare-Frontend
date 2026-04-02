import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import apiClient from "../utils/api";
import InventoryManagement from "../components/InventoryManagement";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getFacilityInfo: jest.fn(),
    getVaccineInventory: jest.fn(),
    getVaccineInventoryTransactions: jest.fn(),
    getVaccines: jest.fn(),
    getVaccineStockAlerts: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));

jest.mock("../components/InventoryMonitoringDashboard", () => ({
  __esModule: true,
  default: () => <div>Inventory Monitoring Dashboard</div>,
}));

const renderInventoryRoute = (initialEntry) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

const createStockMovement = (id) => ({
  id,
  transaction_type: id % 3 === 0 ? "ISSUE" : "RECEIVE",
  created_at: `2026-03-${String((id % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
  vaccine_name: `Vaccine ${id}`,
  quantity: id % 3 === 0 ? -id : id,
  previous_balance: 500 + id,
  new_balance: 500,
  lot_batch_number: `LOT-${String(id).padStart(3, "0")}`,
  reference_number: `REF-${String(id).padStart(3, "0")}`,
  notes: `Movement ${id}`,
  performed_by_name: "Admin User",
  performed_by_username: "admin.user",
  performed_by_role: "SYSTEM_ADMIN",
});

const createPersistedAlert = (id) => ({
  id,
  vaccine_name: `Alert Vaccine ${id}`,
  alert_type: "CRITICAL_STOCK",
  priority: "URGENT",
  current_stock: Math.max(0, 10 - id),
  threshold_value: 10,
  status: "active",
  message: `Alert message ${id}`,
  updated_at: "2026-04-03T00:25:21.000Z",
  created_at: "2026-04-03T00:25:21.000Z",
});

describe("Inventory Management sticky layout", () => {
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
    localStorage.clear();
    sessionStorage.clear();

    apiClient.getFacilityInfo.mockResolvedValue({
      name: "San Nicolas Health Center",
      address: "San Nicolas",
      province: "Metro Manila",
      city: "Pasig",
      barangay: "San Nicolas",
    });
    apiClient.getVaccineInventory.mockResolvedValue([
      {
        id: 1,
        clinic_id: 7,
        vaccine_id: 1,
        vaccine_name: "BCG",
        beginning_balance: 12,
        received_during_period: 4,
        lot_batch_number: "LOT-001",
        transferred_in: 0,
        transferred_out: 0,
        expired_wasted: 0,
        issuance: 6,
      },
    ]);
    apiClient.getVaccineInventoryTransactions.mockResolvedValue([
      {
        id: 90,
        transaction_type: "RECEIVE",
        created_at: "2026-03-28T08:00:00.000Z",
        vaccine_name: "BCG",
        quantity: 4,
        previous_balance: 8,
        new_balance: 12,
        lot_batch_number: "LOT-001",
        reference_number: "REF-001",
        notes: "Restocked",
        performed_by_name: "Admin User",
        performed_by_username: "admin.user",
        performed_by_role: "SYSTEM_ADMIN",
      },
    ]);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineStockAlerts.mockResolvedValue([]);
  });

  test("keeps the inventory shell sticky and the stock movement rows inside their own scroll region", async () => {
    renderInventoryRoute("/inventory?tab=stock_movements");

    await waitFor(() => {
      expect(apiClient.getVaccineInventoryTransactions).toHaveBeenCalled();
    });

    expect(screen.getByTestId("inventory-sticky-shell")).toHaveClass("sticky");

    const scrollRegion = screen.getByTestId("stock-movements-scroll-region");
    expect(scrollRegion).toHaveClass("overflow-auto");

    expect(screen.getByText(/^date$/i).closest("thead")).toHaveClass("sticky");
    expect(screen.getByText("admin.user")).toBeInTheDocument();
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  test("keeps the inventory summary shell fixed while summary content scrolls in place", async () => {
    renderInventoryRoute("/inventory?tab=inventory_summary");

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalled();
    });

    expect(screen.getByTestId("inventory-sticky-shell")).toHaveClass("sticky");
    expect(screen.getByTestId("inventory-summary-panel")).toHaveClass("flex");
    expect(screen.getByTestId("inventory-summary-alert-cards-sticky")).toHaveClass(
      "sticky",
    );

    const scrollRegion = screen.getByTestId("inventory-summary-scroll-region");
    expect(scrollRegion).toHaveClass("overflow-y-auto");
    expect(scrollRegion).toHaveClass("flex-1");

    const workflowScrollRegion = screen.getByTestId(
      "inventory-summary-workflow-scroll-region",
    );
    expect(workflowScrollRegion).toHaveClass("overflow-auto");
    expect(within(workflowScrollRegion).getByText(/^vaccine$/i).closest("thead")).toHaveClass(
      "sticky",
    );
  });

  test("paginates stock movement history in infant-management sized batches", async () => {
    apiClient.getVaccineInventoryTransactions.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => createStockMovement(index + 1)),
    );

    renderInventoryRoute("/inventory?tab=stock_movements");

    await waitFor(() => {
      expect(apiClient.getVaccineInventoryTransactions).toHaveBeenCalled();
    });

    expect(screen.getByTestId("stock-movements-pagination")).toHaveTextContent(
      "Showing 1 to 20 of 25 entries",
    );
    expect(screen.getByText("Movement 20")).toBeInTheDocument();
    expect(screen.queryByText("Movement 21")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(screen.getByTestId("stock-movements-pagination")).toHaveTextContent(
      "Showing 21 to 25 of 25 entries",
    );
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Movement 21")).toBeInTheDocument();
  });

  test("paginates persisted stock alerts inside the inventory summary workflow card", async () => {
    apiClient.getVaccineStockAlerts.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => createPersistedAlert(index + 1)),
    );

    renderInventoryRoute("/inventory?tab=inventory_summary");

    await waitFor(() => {
      expect(apiClient.getVaccineStockAlerts).toHaveBeenCalled();
    });

    expect(
      screen.getByTestId("inventory-summary-workflow-pagination"),
    ).toHaveTextContent("Showing 1 to 20 of 25 alerts");
    expect(screen.getByText("Alert message 20")).toBeInTheDocument();
    expect(screen.queryByText("Alert message 21")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(
      screen.getByTestId("inventory-summary-workflow-pagination"),
    ).toHaveTextContent("Showing 21 to 25 of 25 alerts");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Alert message 21")).toBeInTheDocument();
  });
});
