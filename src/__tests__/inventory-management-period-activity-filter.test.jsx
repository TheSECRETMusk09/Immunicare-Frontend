import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const renderInventoryRoute = (initialEntry = "/inventory?tab=inventory_sheet") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Inventory Management activity-based period filtering", () => {
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));

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
        beginning_balance: 20,
        received_during_period: 5,
        transferred_in: 0,
        transferred_out: 0,
        expired_wasted: 0,
        issuance: 2,
        stock_on_hand: 23,
        lot_batch_number: "BCG-LOT-001",
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        updated_at: "2026-05-20T08:00:00.000Z",
      },
      {
        id: 2,
        clinic_id: 7,
        vaccine_id: 2,
        vaccine_name: "Hepa B",
        beginning_balance: 14,
        received_during_period: 3,
        transferred_in: 0,
        transferred_out: 0,
        expired_wasted: 0,
        issuance: 1,
        stock_on_hand: 16,
        lot_batch_number: "HEPA-LOT-002",
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        updated_at: "2026-05-19T09:30:00.000Z",
      },
      {
        id: 3,
        clinic_id: 7,
        vaccine_id: 3,
        vaccine_name: "IPV multi dose",
        beginning_balance: 30,
        received_during_period: 0,
        transferred_in: 0,
        transferred_out: 0,
        expired_wasted: 0,
        issuance: 0,
        stock_on_hand: 30,
        lot_batch_number: "IPV-LOT-003",
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        updated_at: "2026-05-01T08:00:00.000Z",
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

  afterEach(() => {
    jest.useRealTimers();
  });

  test("keeps all week-active vaccine rows even when saved inventory periods are stale", async () => {
    renderInventoryRoute();

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({
        clinic_id: 7,
      });
    });
    await screen.findByTestId("inventory-sheet-panel");

    fireEvent.change(
      within(screen.getByTestId("inventory-sticky-shell")).getByLabelText(
        /^period$/i,
      ),
      {
        target: { value: "week" },
      },
    );

    const inventorySheetPanel = screen.getByTestId("inventory-sheet-panel");

    await waitFor(() => {
      expect(within(inventorySheetPanel).getByText("BCG")).toBeInTheDocument();
      expect(within(inventorySheetPanel).getByText("Hepa B")).toBeInTheDocument();
    });

    expect(
      within(inventorySheetPanel).queryByText("IPV multi dose"),
    ).not.toBeInTheDocument();
    expect(
      within(inventorySheetPanel).queryByText(
        /No inventory rows match the selected filters\./i,
      ),
    ).not.toBeInTheDocument();
  });
});
