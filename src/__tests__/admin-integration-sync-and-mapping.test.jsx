import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import {
  normalizeVaccinationRecordsResponse,
  normalizeVaccineInventoryTransactionsResponse,
  computeVaccinationComplianceSummary,
} from "../utils/adminDataAdapters";

import VaccinationsDashboard from "../pages/VaccinationsDashboard";
import VaccineTracking from "../pages/VaccineTracking";

import apiClient from "../utils/api";

const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getVaccinationRecords: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getInfants: jest.fn(),
    getVaccines: jest.fn(),
    createVaccinationRecord: jest.fn(),
    updateVaccinationRecord: jest.fn(),
    deleteVaccinationRecord: jest.fn(),
    getVaccineInventory: jest.fn(),
    getVaccineInventoryTransactions: jest.fn(),
    getVaccineStockAlerts: jest.fn(),
    acknowledgeVaccineStockAlert: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: 100, role_type: "SYSTEM_ADMIN" },
  }),
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    socket: {
      on: mockSocketOn,
      off: mockSocketOff,
    },
  }),
}));

const renderVaccinationsDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/vaccination-management"]}>
      <VaccinationsDashboard />
    </MemoryRouter>,
  );

const renderVaccineTracking = () =>
  render(
    <MemoryRouter initialEntries={["/vaccine-tracking"]}>
      <VaccineTracking />
    </MemoryRouter>,
  );

const scheduleRows = [
  {
    id: 11,
    vaccine_id: 1,
    vaccine_name: "BCG",
    dose_number: 1,
    total_doses: 1,
    age_in_months: 0,
    description: "At birth",
    is_active: true,
  },
  {
    id: 12,
    vaccine_id: 2,
    vaccine_name: "Pentavalent",
    dose_number: 1,
    total_doses: 3,
    age_in_months: 2,
    description: "2 months",
    is_active: true,
  },
];

const infantRows = [
  {
    id: 1,
    first_name: "Baby",
    last_name: "One",
    dob: "2025-12-01",
    sex: "female",
  },
  {
    id: 2,
    first_name: "Baby",
    last_name: "Two",
    dob: "2025-08-01",
    sex: "male",
  },
];

const vaccineRows = [
  { id: 1, name: "BCG", code: "BCG", doses_required: 1 },
  { id: 2, name: "Pentavalent", code: "PENTA", doses_required: 3 },
];

const vaccinationRecordRows = [
  {
    id: 501,
    patient_id: 1,
    vaccine_id: 1,
    vaccine_name: "BCG",
    dose_no: 1,
    admin_date: "2026-01-10",
    next_due_date: null,
    status: "completed",
    patient_first_name: "Baby",
    patient_last_name: "One",
  },
  {
    id: 502,
    patient_id: 2,
    vaccine_id: 2,
    vaccine_name: "Pentavalent",
    dose_no: 1,
    admin_date: null,
    next_due_date: "2025-10-10",
    status: "pending",
    patient_first_name: "Baby",
    patient_last_name: "Two",
  },
];

describe("Admin integration sync and mapping checks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normalized adapters handle wrapped payloads for records and transactions", () => {
    const wrappedRecords = {
      data: {
        records: [
          {
            id: "701",
            patient_id: "4",
            vaccine_id: "6",
            dose_no: "2",
            status: "COMPLETED",
            admin_date: "2026-03-01",
            patient_first_name: "Sample",
            patient_last_name: "Infant",
          },
        ],
      },
    };

    const wrappedTransactions = {
      data: {
        transactions: [
          {
            id: "801",
            vaccine_inventory_id: "12",
            vaccine_id: "6",
            clinic_id: "3",
            transaction_type: "issue",
            quantity: "1",
            previous_balance: "10",
            new_balance: "9",
          },
        ],
      },
    };

    const records = normalizeVaccinationRecordsResponse(wrappedRecords);
    const transactions =
      normalizeVaccineInventoryTransactionsResponse(wrappedTransactions);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 701,
      infant_id: 4,
      vaccine_id: 6,
      dose_number: 2,
      status: "completed",
    });

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      id: 801,
      vaccine_inventory_id: 12,
      vaccine_id: 6,
      transaction_type: "ISSUE",
      quantity: 1,
      previous_balance: 10,
      new_balance: 9,
    });
  });

  test("compliance summary is derived from schedules plus records (no placeholder math)", () => {
    const summary = computeVaccinationComplianceSummary({
      schedules: scheduleRows,
      records: vaccinationRecordRows.filter((row) => row.patient_id === 1),
      infantDob: "2025-12-01",
      referenceDate: "2026-03-01",
    });

    expect(summary.dueCount).toBeGreaterThanOrEqual(1);
    expect(summary.completed).toBeGreaterThanOrEqual(1);
    expect(summary.completionRate).toBeGreaterThanOrEqual(0);
    expect(summary.completionRate).toBeLessThanOrEqual(100);
  });

  test("vaccinations dashboard removes analytics tab and renders only required tabs", async () => {
    apiClient.getVaccinationRecords.mockResolvedValueOnce(vaccinationRecordRows);
    apiClient.getVaccinationSchedules.mockResolvedValueOnce(scheduleRows);
    apiClient.getInfants.mockResolvedValueOnce(infantRows);
    apiClient.getVaccines.mockResolvedValueOnce(vaccineRows);

    renderVaccinationsDashboard();

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).toHaveBeenCalled();
    });
    expect(apiClient.getVaccinationSchedules).toHaveBeenCalled();

    expect(
      screen.getByRole("button", { name: /vaccination records/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /vaccination tracking/i }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /analytics/i }),
    ).not.toBeInTheDocument();
  });

  test("vaccinations dashboard mutation triggers refresh fetch", async () => {
    apiClient.getVaccinationRecords.mockResolvedValue(vaccinationRecordRows);
    apiClient.getVaccinationSchedules.mockResolvedValue(scheduleRows);
    apiClient.getInfants.mockResolvedValue(infantRows);
    apiClient.getVaccines.mockResolvedValue(vaccineRows);
    apiClient.createVaccinationRecord.mockResolvedValueOnce({
      id: 999,
      patient_id: 1,
      vaccine_id: 1,
      dose_no: 1,
      admin_date: "2026-03-01",
      status: "completed",
      patient_first_name: "Baby",
      patient_last_name: "One",
      vaccine_name: "BCG",
    });

    renderVaccinationsDashboard();

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /add vaccination/i }));

    expect(
      await screen.findByRole("heading", { name: /add new vaccination record/i }),
    ).toBeInTheDocument();

    const childSelect = screen.getByDisplayValue("Select Child");
    const vaccineSelect = screen.getByDisplayValue("Select Vaccine");
    const doseInput = screen.getByLabelText(/dose number/i);
    const adminDateInput = screen.getByLabelText(/date administered/i);

    fireEvent.change(childSelect, { target: { value: "1" } });
    fireEvent.change(vaccineSelect, { target: { value: "1" } });
    fireEvent.change(doseInput, { target: { value: "1" } });
    fireEvent.change(adminDateInput, { target: { value: "2026-03-01" } });

    fireEvent.click(screen.getByRole("button", { name: /save record/i }));

    await waitFor(() => {
      expect(apiClient.createVaccinationRecord).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("socket subscription and polling synchronization behavior is active", async () => {
    jest.useFakeTimers();

    try {
      apiClient.getVaccines.mockResolvedValue(vaccineRows);
      apiClient.getVaccinationRecords.mockResolvedValue(vaccinationRecordRows);
      apiClient.getVaccineInventory.mockResolvedValue([
        {
          id: 11,
          vaccine_id: 1,
          vaccine_name: "BCG",
          vaccine_code: "BCG",
          stock_on_hand: 10,
          low_stock_threshold: 5,
          is_low_stock: false,
        },
      ]);
      apiClient.getVaccineInventoryTransactions.mockResolvedValue([
        {
          id: 900,
          vaccine_inventory_id: 11,
          vaccine_id: 1,
          transaction_type: "ISSUE",
          quantity: 1,
          previous_balance: 10,
          new_balance: 9,
          created_at: "2026-03-08T00:00:00.000Z",
          vaccine_name: "BCG",
        },
      ]);
      apiClient.getVaccineStockAlerts.mockResolvedValue([]);

      renderVaccineTracking();

      expect(await screen.findByText(/vaccine tracking/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(apiClient.getVaccineInventory).toHaveBeenCalledTimes(1);
      });

      expect(mockSocketOn).toHaveBeenCalled();
      expect(mockSocketOn).toHaveBeenCalledWith(
        "vaccination_created",
        expect.any(Function),
      );
      expect(mockSocketOn).toHaveBeenCalledWith(
        "vaccine_inventory_transaction_created",
        expect.any(Function),
      );

      const callsBeforePolling = apiClient.getVaccineInventory.mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(apiClient.getVaccineInventory.mock.calls.length).toBeGreaterThan(
          callsBeforePolling,
        );
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test("vaccine tracking acknowledges active alert via real API action", async () => {
    apiClient.getVaccines.mockResolvedValue(vaccineRows);
    apiClient.getVaccinationRecords.mockResolvedValue(vaccinationRecordRows);
    apiClient.getVaccineInventory.mockResolvedValue([
      {
        id: 11,
        vaccine_id: 1,
        vaccine_name: "BCG",
        vaccine_code: "BCG",
        stock_on_hand: 2,
        low_stock_threshold: 5,
        is_low_stock: true,
        is_critical_stock: true,
      },
    ]);
    apiClient.getVaccineInventoryTransactions.mockResolvedValue([]);
    apiClient.getVaccineStockAlerts.mockResolvedValue([
      {
        id: 1001,
        vaccine_id: 1,
        vaccine_name: "BCG",
        alert_type: "CRITICAL_STOCK",
        priority: "URGENT",
        status: "active",
        message: "Critical: 2 units remaining",
      },
    ]);
    apiClient.acknowledgeVaccineStockAlert.mockResolvedValueOnce({
      id: 1001,
      status: "ACKNOWLEDGED",
    });

    renderVaccineTracking();

    expect(
      await screen.findByRole("button", { name: /inventory tracking/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccineStockAlerts).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /active alerts/i }));

    await screen.findByText(/critical: 2 units remaining/i);

    fireEvent.click(screen.getByRole("button", { name: /acknowledge/i }));

    await waitFor(() => {
      expect(apiClient.acknowledgeVaccineStockAlert).toHaveBeenCalledWith(1001);
    });
  });
});
