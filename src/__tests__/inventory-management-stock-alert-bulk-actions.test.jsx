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

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getFacilityInfo: jest.fn(),
    getVaccineInventory: jest.fn(),
    getVaccines: jest.fn(),
    getVaccineStockAlerts: jest.fn(),
    acknowledgeAllVaccineStockAlerts: jest.fn(),
    resolveAllVaccineStockAlerts: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
  },
}));

let mockUser = {
  id: 101,
  role_type: "SYSTEM_ADMIN",
  clinic_id: 7,
  facility_id: 7,
};

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

jest.mock("../components/InventoryMonitoringDashboard", () => ({
  __esModule: true,
  default: () => <div>Inventory Monitoring Dashboard</div>,
}));

const renderInventoryRoute = (initialEntry = "/inventory?tab=stock_alerts") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Inventory Management stock-alert bulk actions", () => {
  const inventoryRecords = [
    {
      id: 1,
      clinic_id: 7,
      vaccine_id: 1,
      vaccine_name: "BCG",
      beginning_balance: 10,
      received_during_period: 0,
      lot_batch_number: "LOT-BCG-001",
      transferred_in: 0,
      transferred_out: 0,
      expired_wasted: 0,
      issuance: 10,
    },
  ];

  const initialPersistedAlerts = [
    {
      id: 11,
      clinic_id: 7,
      vaccine_name: "BCG",
      alert_type: "LOW_STOCK",
      status: "ACTIVE",
      priority: "HIGH",
      current_stock: 3,
      threshold_value: 10,
      message: "Low stock: 3 units remaining",
      created_at: "2026-03-20T08:00:00.000Z",
      updated_at: "2026-03-20T08:00:00.000Z",
    },
    {
      id: 12,
      clinic_id: 7,
      vaccine_name: "MMR",
      alert_type: "CRITICAL_STOCK",
      status: "ACKNOWLEDGED",
      priority: "URGENT",
      current_stock: 0,
      threshold_value: 5,
      message: "Critical: 0 units remaining",
      acknowledged_at: "2026-03-20T09:00:00.000Z",
      updated_at: "2026-03-20T09:00:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockUser = {
      id: 101,
      role_type: "SYSTEM_ADMIN",
      clinic_id: 7,
      facility_id: 7,
    };

    apiClient.getFacilityInfo.mockResolvedValue({
      name: "San Nicolas Health Center",
      address: "San Nicolas",
      province: "Metro Manila",
      city: "Pasig",
      barangay: "San Nicolas",
    });
    apiClient.getVaccineInventory.mockResolvedValue(inventoryRecords);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineStockAlerts.mockResolvedValue(initialPersistedAlerts);
    apiClient.acknowledgeAllVaccineStockAlerts.mockResolvedValue({
      updated_count: 1,
      message: "Acknowledged 1 stock alert.",
    });
    apiClient.resolveAllVaccineStockAlerts.mockResolvedValue({
      updated_count: 2,
      message: "Resolved 2 stock alerts.",
    });
  });

  test("shows admin-only bulk controls and refreshes statuses after acknowledge-all and resolve-all", async () => {
    apiClient.getVaccineStockAlerts
      .mockResolvedValueOnce(initialPersistedAlerts)
      .mockResolvedValueOnce([
        {
          ...initialPersistedAlerts[0],
          status: "ACKNOWLEDGED",
          acknowledged_at: "2026-03-21T10:00:00.000Z",
          updated_at: "2026-03-21T10:00:00.000Z",
        },
        initialPersistedAlerts[1],
      ])
      .mockResolvedValueOnce([
        {
          ...initialPersistedAlerts[0],
          status: "RESOLVED",
          resolved_at: "2026-03-22T11:00:00.000Z",
          updated_at: "2026-03-22T11:00:00.000Z",
        },
        {
          ...initialPersistedAlerts[1],
          status: "RESOLVED",
          resolved_at: "2026-03-22T11:00:00.000Z",
          updated_at: "2026-03-22T11:00:00.000Z",
        },
      ]);

    renderInventoryRoute("/inventory?tab=vaccine_monitoring");

    expect(
      await screen.findByRole("button", { name: /acknowledge all/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resolve all/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /acknowledge all/i }));

    const acknowledgeDialog = screen.getByRole("dialog", {
      name: /confirm acknowledge all/i,
    });
    expect(acknowledgeDialog).toHaveTextContent(
      /acknowledge all 1 pending stock alert/i,
    );

    fireEvent.click(
      within(acknowledgeDialog).getByRole("button", {
        name: /acknowledge all/i,
      }),
    );

    await waitFor(() => {
      expect(apiClient.acknowledgeAllVaccineStockAlerts).toHaveBeenCalledWith({
        clinic_id: 7,
        alert_ids: [11],
      });
    });

    expect(
      await screen.findByText(/acknowledged 1 stock alert/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/pending: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/acknowledged: 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /resolve all/i }));

    const resolveDialog = screen.getByRole("dialog", {
      name: /confirm resolve all/i,
    });
    expect(resolveDialog).toHaveTextContent(
      /resolve all 2 eligible stock alerts/i,
    );

    fireEvent.click(
      within(resolveDialog).getByRole("button", {
        name: /resolve all/i,
      }),
    );

    await waitFor(() => {
      expect(apiClient.resolveAllVaccineStockAlerts).toHaveBeenCalledWith({
        clinic_id: 7,
        alert_ids: [11, 12],
        resolution_notes: "Resolved in bulk from the Inventory module.",
      });
    });

    expect(
      await screen.findByText(/resolved 2 stock alerts/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/resolved: 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/resolved/i).length).toBeGreaterThanOrEqual(2);
  });

  test("hides bulk controls from non-system-admin users", async () => {
    mockUser = {
      id: 202,
      role_type: "CLINIC_MANAGER",
      clinic_id: 7,
      facility_id: 7,
    };

    renderInventoryRoute();

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({
        clinic_id: 7,
      });
    });

    expect(
      screen.queryByRole("button", { name: /acknowledge all/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resolve all/i }),
    ).not.toBeInTheDocument();
    expect(apiClient.getVaccineStockAlerts).not.toHaveBeenCalled();
  });

  test("shows an error message when a bulk action fails", async () => {
    apiClient.acknowledgeAllVaccineStockAlerts.mockRejectedValueOnce(
      new Error("Bulk acknowledge failed"),
    );

    renderInventoryRoute("/inventory?tab=vaccine_monitoring");

    fireEvent.click(
      await screen.findByRole("button", { name: /acknowledge all/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /confirm acknowledge all/i,
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: /acknowledge all/i }),
    );

    expect(
      await screen.findByText(/bulk acknowledge failed/i),
    ).toBeInTheDocument();
  });

  test("renders the alert workflow for legacy stock-alert aliases mapped to inventory summary", async () => {
    const stockAlertsView = renderInventoryRoute("/inventory?tab=stock_alerts");

    expect(
      await screen.findByRole("button", { name: /acknowledge all/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resolve all/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("inventory-summary-panel")).toBeInTheDocument();

    stockAlertsView.unmount();
    renderInventoryRoute("/inventory?tab=vaccine_monitoring");

    expect(
      await screen.findByRole("button", { name: /acknowledge all/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resolve all/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("inventory-summary-panel")).toBeInTheDocument();
  });
});
