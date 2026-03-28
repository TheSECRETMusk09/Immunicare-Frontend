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
    createVaccineInventory: jest.fn(),
    updateVaccineInventory: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 101, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
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

describe("Inventory Management save behavior", () => {
  const inventoryRecords = [
    {
      id: 1,
      clinic_id: 7,
      vaccine_id: 1,
      vaccine_name: "BCG",
      beginning_balance: 10,
      received_during_period: 4,
      lot_batch_number: "LOT-BCG-001",
      transferred_in: 0,
      transferred_out: 1,
      expired_wasted: 0,
      issuance: 5,
      period_start: "2026-10-01",
      period_end: "2026-10-31",
    },
  ];

  let originalAlert;

  beforeAll(() => {
    originalAlert = window.alert;
    window.alert = jest.fn();
  });

  afterAll(() => {
    window.alert = originalAlert;
  });

  beforeEach(() => {
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
    apiClient.getVaccineInventory.mockResolvedValue(inventoryRecords);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.createVaccineInventory.mockResolvedValue({});
    apiClient.updateVaccineInventory.mockResolvedValue({});
  });

  test("saves inventory sheet through the supported item update endpoint with a resolved reporting period", async () => {
    renderInventoryRoute();

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({
        clinic_id: 7,
      });
    });

    await screen.findByRole("button", { name: /save inventory/i });

    const reportDateInput = document.getElementById("inventory-report-date-toolbar");
    expect(reportDateInput).toBeInTheDocument();

    fireEvent.change(reportDateInput, {
      target: { value: "2026-11-15" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save inventory/i }));

    await waitFor(() => {
      expect(apiClient.updateVaccineInventory).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          beginning_balance: 10,
          received_during_period: 4,
          transferred_in: 0,
          transferred_out: 1,
          expired_wasted: 0,
          issuance: 5,
          lot_batch_number: "LOT-BCG-001",
          period_start: "2026-11-01",
          period_end: "2026-11-30",
        }),
      );
    });

    expect(apiClient.createVaccineInventory).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("Inventory sheet saved successfully.");
  });

  test("keeps saved inventory rows actionable when the persisted vaccine name differs from the sheet label", async () => {
    apiClient.getVaccineInventory.mockResolvedValueOnce([
      {
        id: 55,
        clinic_id: 7,
        vaccine_id: 2,
        vaccine_name: "Hepatitis B",
        beginning_balance: 5,
        received_during_period: 2,
        lot_batch_number: "HEPB-LOT-001",
        transferred_in: 0,
        transferred_out: 0,
        expired_wasted: 0,
        issuance: 1,
      },
    ]);
    apiClient.getVaccines.mockResolvedValueOnce([
      { id: 2, name: "Hepa B", code: "HEPB" },
    ]);
    apiClient.createVaccineInventoryTransaction.mockResolvedValueOnce({
      id: 901,
    });

    renderInventoryRoute();

    const hepaBRow = await screen.findByText("Hepatitis B");
    fireEvent.click(
      within(hepaBRow.closest("tr")).getByRole("button", { name: /receive/i }),
    );

    fireEvent.change(screen.getByLabelText(/^quantity$/i), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText(/lot\/batch #/i), {
      target: { value: "HEPB-LOT-002" },
    });
    fireEvent.change(screen.getByLabelText(/expiry date/i), {
      target: { value: "2026-12-31" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^receive$/i }));

    await waitFor(() => {
      expect(apiClient.createVaccineInventoryTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          vaccine_inventory_id: 55,
          vaccine_id: 2,
          clinic_id: 7,
          transaction_type: "RECEIVE",
          quantity: 3,
          transaction_date: expect.any(String),
          lot_number: "HEPB-LOT-002",
          lot_batch_number: "HEPB-LOT-002",
          expiry_date: "2026-12-31",
        }),
      );
    });
  });

  test("reuses the inventory row lot data for issue transactions", async () => {
    const today = new Date().toISOString().slice(0, 10);
    apiClient.createVaccineInventoryTransaction.mockResolvedValueOnce({
      id: 902,
    });

    renderInventoryRoute();

    const bcgRow = await screen.findByText("BCG");
    fireEvent.click(
      within(bcgRow.closest("tr")).getByRole("button", { name: /issue/i }),
    );

    fireEvent.change(screen.getByLabelText(/^quantity$/i), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^issue$/i }));

    await waitFor(() => {
      expect(apiClient.createVaccineInventoryTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          vaccine_inventory_id: 1,
          vaccine_id: 1,
          clinic_id: 7,
          transaction_type: "ISSUE",
          quantity: 2,
          transaction_date: today,
          lot_number: "LOT-BCG-001",
          lot_batch_number: "LOT-BCG-001",
        }),
      );
    });
  });

  test("keeps backend validation errors inside the transaction modal instead of replacing the page", async () => {
    apiClient.createVaccineInventoryTransaction.mockRejectedValueOnce({
      response: {
        data: {
          error: "Validation failed",
          fields: {
            transaction_type:
              "transaction_type must be one of RECEIVE, TRANSFER_IN, TRANSFER_OUT, ISSUE, EXPIRE, WASTE, ADJUST",
          },
        },
      },
      message: "Validation failed",
    });

    renderInventoryRoute();

    const bcgRow = await screen.findByText("BCG");
    fireEvent.click(
      within(bcgRow.closest("tr")).getByRole("button", { name: /receive/i }),
    );

    fireEvent.change(screen.getByLabelText(/^quantity$/i), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText(/lot\/batch #/i), {
      target: { value: "LOT-BCG-002" },
    });
    fireEvent.change(screen.getByLabelText(/expiry date/i), {
      target: { value: "2026-12-31" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^receive$/i }));

    expect(
      await screen.findByText(
        /transaction_type must be one of receive, transfer_in, transfer_out, issue, expire, waste, adjust/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument();
  });
});
