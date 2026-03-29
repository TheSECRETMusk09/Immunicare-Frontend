import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(scrollRegion).toHaveClass("overflow-y-auto");

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
    expect(screen.getByText(/^vaccine$/i).closest("thead")).toHaveClass(
      "sticky",
    );
  });
});
