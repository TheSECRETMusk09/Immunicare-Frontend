import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import apiClient from "../utils/api";
import InventoryManagement from "../components/InventoryManagement";

jest.mock("../utils/api", () =>( {
  __esModule: true,
  default: {
    getFacilityInfo: jest.fn(),
    getVaccineInventory: jest.fn(),
    getInventoryStockMovements: jest.fn(),
    getVaccineInventoryTransactions: jest.fn(),
    getVaccines: jest.fn(),
    getVaccineStockAlerts: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () =>( {
  useAuth: () =>( {
    user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));

const renderInventoryRoute = (initialEntry) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Inventory Management toolbar layout", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) =>( {
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
        stock_on_hand: 10,
        period_start: "2026-05-01",
        period_end: "2026-05-20",
      },
    ]);
    apiClient.getInventoryStockMovements.mockResolvedValue({
      success: true,
      data: {
        movements: [],
        summary: {
          totalRecords: 0,
          stockIn: 0,
          stockOut: 0,
          wasted: 0,
        },
      },
    });
    apiClient.getVaccineInventoryTransactions.mockResolvedValue([]);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineStockAlerts.mockResolvedValue([]);
  });

  test("renders the inventory sheet reporting period chip inside the sticky toolbar row", async () => {
    renderInventoryRoute("/inventory?tab=inventory_sheet");

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalled();
    });
    await screen.findByTestId("inventory-sheet-panel");

    const reportingChip = screen.getByTestId(
      "inventory-sheet-reporting-period-chip",
    );
    expect(screen.getByTestId("inventory-sticky-shell")).toContainElement(
      reportingChip,
    );
    expect(screen.getByTestId("inventory-sheet-panel")).not.toContainElement(
      reportingChip,
    );
  });

  test("renders the inventory summary stats inside the sticky toolbar row", async () => {
    renderInventoryRoute("/inventory?tab=inventory_summary");

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalled();
    });
    await screen.findByTestId("inventory-summary-panel");

    const toolbarStats = screen.getByTestId("inventory-summary-toolbar-stats");
    expect(screen.getByTestId("inventory-sticky-shell")).toContainElement(
      toolbarStats,
    );
    expect(screen.getByTestId("inventory-summary-panel")).not.toContainElement(
      toolbarStats,
    );
    expect(within(toolbarStats).getByText("Vaccines")).toBeInTheDocument();
    expect(within(toolbarStats).getByText("Beginning")).toBeInTheDocument();
    expect(within(toolbarStats).getByText("Received")).toBeInTheDocument();
    expect(within(toolbarStats).getByText("Issued")).toBeInTheDocument();
    expect(within(toolbarStats).getByText("On Hand")).toBeInTheDocument();
    expect(within(toolbarStats).getByText("Expired Lots")).toBeInTheDocument();
  });
});
