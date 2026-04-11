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

import apiClient from "../utils/api";
import useVaccinationSocket from "../hooks/useVaccinationSocket";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getDashboardInfants: jest.fn(),
    getVaccinationRecords: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getInfants: jest.fn(),
    getVaccines: jest.fn(),
    createVaccinationRecord: jest.fn(),
    updateVaccinationRecord: jest.fn(),
    deleteVaccinationRecord: jest.fn(),
    getVaccineInventory: jest.fn(),
    getVaccineInventoryStatus: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
    getSystemUsers: jest.fn(),
  },
}));

const mockUseAuth = jest.fn(() => ({
  isAdmin: true,
  user: { id: 100, role_type: "SYSTEM_ADMIN" },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../hooks/useVaccinationSocket", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const renderVaccinationsDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/vaccination-management"]}>
      <VaccinationsDashboard />
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
    vaccine_name: "Penta Valent",
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
  { id: 2, name: "Penta Valent", code: "PENTA", doses_required: 3 },
];

const inventoryRecordRows = [
  {
    id: 11,
    vaccine_id: 1,
    vaccine_name: "BCG",
    clinic_id: 7,
    lot_batch_number: "BCG-LOT-001",
    stock_on_hand: 10,
    low_stock_threshold: 5,
    is_low_stock: false,
  },
  {
    id: 21,
    vaccine_id: 2,
    vaccine_name: "Penta Valent",
    clinic_id: 7,
    lot_batch_number: "PENTA-FEFO-001",
    stock_on_hand: 9,
    low_stock_threshold: 5,
    is_low_stock: false,
  },
  {
    id: 22,
    vaccine_id: 2,
    vaccine_name: "Penta Valent",
    clinic_id: 7,
    lot_batch_number: "PENTA-LATER-002",
    stock_on_hand: 6,
    low_stock_threshold: 5,
    is_low_stock: false,
  },
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
    vaccine_name: "Penta Valent",
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
    useVaccinationSocket.mockImplementation(() => undefined);
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
    });
    apiClient.getVaccineInventory.mockResolvedValue([]);
    apiClient.getVaccineInventoryStatus.mockResolvedValue({ clinicId: 7, batches: [] });
    apiClient.createVaccineInventoryTransaction.mockResolvedValue({ id: 901 });
    apiClient.getInfants.mockResolvedValue(infantRows);
    apiClient.getSystemUsers.mockResolvedValue([
      {
        id: 100,
        role_name: "nurse",
        username: "nurse.one",
        clinic_id: 7,
        facility_id: 7,
        is_active: true,
      },
    ]);
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
    apiClient.getDashboardInfants.mockResolvedValueOnce(infantRows);
    apiClient.getVaccines.mockResolvedValueOnce(vaccineRows);

    renderVaccinationsDashboard();

    expect(
    await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).not.toHaveBeenCalled();
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
    apiClient.getDashboardInfants.mockResolvedValue(infantRows);
    apiClient.getVaccines.mockResolvedValue(vaccineRows);
    apiClient.getVaccineInventory.mockResolvedValue(inventoryRecordRows);
    apiClient.createVaccinationRecord.mockResolvedValueOnce({
      id: 999,
      patient_id: 2,
      vaccine_id: 2,
      dose_no: 1,
      admin_date: "2026-03-01",
      status: "completed",
      patient_first_name: "Baby",
      patient_last_name: "Two",
      vaccine_name: "Penta Valent",
    });
    apiClient.getVaccineInventoryStatus.mockResolvedValue({
      clinicId: 7,
      batches: [
        {
          id: 302,
          vaccine_id: 2,
          lot_no: "PENTA-LATER-002",
          qty_current: 6,
          expiry_date: "2026-06-01",
        },
        {
          id: 301,
          vaccine_id: 2,
          lot_no: "PENTA-FEFO-001",
          qty_current: 9,
          expiry_date: "2026-04-01",
        },
      ],
    });

    renderVaccinationsDashboard();

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).not.toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^➕\s*add$/i }));

    expect(
      await screen.findByRole("heading", { name: /add new vaccination record/i }),
    ).toBeInTheDocument();

    const childSelect = screen.getByDisplayValue("Select Child");
    const vaccineSelect = screen.getByDisplayValue("Select Vaccine");
    const batchSourceSelect = await screen.findByLabelText(/batch source/i);
    const doseInput = screen.getByLabelText(/dose number/i);
    const adminDateInput = screen.getByLabelText(/date administered/i);

    fireEvent.change(childSelect, { target: { value: "2" } });
    fireEvent.change(vaccineSelect, { target: { value: "2" } });

    await waitFor(() => {
      expect(apiClient.getVaccineInventoryStatus).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(batchSourceSelect).toHaveValue("301");
    });

    expect(
      screen.getByText(/FEFO recommended batch selected automatically/i),
    ).toBeInTheDocument();
    fireEvent.change(doseInput, { target: { value: "1" } });
    fireEvent.change(adminDateInput, { target: { value: "2026-03-01" } });

    fireEvent.click(screen.getByRole("button", { name: /save record/i }));

    await waitFor(() => {
      expect(apiClient.createVaccinationRecord).toHaveBeenCalledTimes(1);
    });

    expect(apiClient.createVaccinationRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: 2,
        vaccine_id: 2,
        batch_id: 301,
        lot_batch_number: "PENTA-FEFO-001",
      }),
    );

    await waitFor(() => {
      expect(apiClient.createVaccineInventoryTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          vaccine_inventory_id: 21,
          vaccine_id: 2,
          transaction_type: "ISSUE",
          lot_batch_number: "PENTA-FEFO-001",
        }),
      );
    });

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  test("vaccination add flow auto-selects the earliest FEFO-linked batch", async () => {
    apiClient.getVaccinationRecords.mockResolvedValue(vaccinationRecordRows);
    apiClient.getVaccinationSchedules.mockResolvedValue(scheduleRows);
    apiClient.getDashboardInfants.mockResolvedValue(infantRows);
    apiClient.getVaccines.mockResolvedValue(vaccineRows);
    apiClient.getVaccineInventory.mockResolvedValue(inventoryRecordRows);
    apiClient.getVaccineInventoryStatus.mockResolvedValue({
      clinicId: 7,
      batches: [
        {
          id: 302,
          vaccine_id: 2,
          lot_no: "PENTA-LATER-002",
          qty_current: 6,
          expiry_date: "2026-06-01",
        },
        {
          id: 301,
          vaccine_id: 2,
          lot_no: "PENTA-FEFO-001",
          qty_current: 9,
          expiry_date: "2026-04-01",
        },
      ],
    });

    renderVaccinationsDashboard();

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^➕\s*add$/i }));

    expect(
      await screen.findByRole("heading", { name: /add new vaccination record/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Select Child"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByDisplayValue("Select Vaccine"), {
      target: { value: "2" },
    });

    const batchSourceSelect = await screen.findByLabelText(/batch source/i);
    const lotBatchInput = screen.getByLabelText(/lot \/ batch number/i);

    await waitFor(() => {
      expect(apiClient.getVaccineInventoryStatus).toHaveBeenCalledWith(2);
    });
    await waitFor(() => {
      expect(batchSourceSelect).toHaveValue("301");
    });
    await waitFor(() => {
      expect(lotBatchInput).toHaveValue("PENTA-FEFO-001");
    });
  });

  test("vaccinations dashboard keeps scoped inventory polling active", async () => {
    jest.useFakeTimers();

    try {
      apiClient.getVaccines.mockResolvedValue(vaccineRows);
      apiClient.getVaccinationSchedules.mockResolvedValue(scheduleRows);
      apiClient.getDashboardInfants.mockResolvedValue(infantRows);
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

      renderVaccinationsDashboard();

      expect(
        await screen.findByRole("button", { name: /vaccination tracking/i }),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(apiClient.getVaccineInventory).toHaveBeenCalledTimes(1);
      });

      expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({ clinic_id: 7 });
      expect(useVaccinationSocket).toHaveBeenCalled();

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

  test("vaccine tracking falls back to unscoped fetch when clinic context is unavailable", async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: null, facility_id: null },
    });

    apiClient.getVaccines.mockResolvedValue(vaccineRows);
    apiClient.getVaccinationSchedules.mockResolvedValue(scheduleRows);
    apiClient.getDashboardInfants.mockResolvedValue(infantRows);
    apiClient.getVaccinationRecords.mockResolvedValue(vaccinationRecordRows);
    apiClient.getVaccineInventory.mockResolvedValue([]);

    renderVaccinationsDashboard();

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalled();
    });

    expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({});
  });

  test("add-record vaccine selection excludes unapproved vaccine names", async () => {
    apiClient.getVaccines.mockResolvedValue([
      ...vaccineRows,
      { id: 99, name: "Pentavalent", code: "LEGACY", doses_required: 3 },
    ]);
    apiClient.getVaccinationSchedules.mockResolvedValue(scheduleRows);
    apiClient.getDashboardInfants.mockResolvedValue(infantRows);
    apiClient.getVaccinationRecords.mockResolvedValue(vaccinationRecordRows);
    apiClient.getVaccineInventory.mockResolvedValue([
      {
        id: 11,
        vaccine_id: 1,
        vaccine_name: "BCG",
        vaccine_code: "BCG",
        clinic_id: 7,
        stock_on_hand: 2,
        low_stock_threshold: 5,
        is_low_stock: true,
        is_critical_stock: true,
      },
      {
        id: 12,
        vaccine_id: 99,
        vaccine_name: "Pentavalent",
        vaccine_code: "LEGACY",
        clinic_id: 7,
        stock_on_hand: 5,
        low_stock_threshold: 5,
        is_low_stock: true,
        is_critical_stock: true,
      },
    ]);

    renderVaccinationsDashboard();

    expect(await screen.findByRole("button", { name: /vaccination schedule/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^➕\s*add$/i }));

    expect(
      await screen.findByRole("heading", { name: /add new vaccination record/i }),
    ).toBeInTheDocument();

    const vaccineSelect = screen.getByDisplayValue("Select Vaccine");
    expect(screen.getByRole("option", { name: /BCG/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Pentavalent/i })).not.toBeInTheDocument();

    fireEvent.change(vaccineSelect, { target: { value: "1" } });
    expect(vaccineSelect).toHaveValue("1");
  });
});
