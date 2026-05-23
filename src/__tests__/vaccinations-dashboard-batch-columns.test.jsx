import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import VaccinationsDashboard from "../pages/VaccinationsDashboard";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getDashboardInfants: jest.fn(),
    getVaccinationRecords: jest.fn(),
    getVaccinationTracking: jest.fn(),
    getVaccinationScheduleOverview: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getInfants: jest.fn(),
    getVaccines: jest.fn(),
    getVaccineInventory: jest.fn(),
    getVaccineInventoryStatus: jest.fn(),
    getSystemUsers: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));

jest.mock("../hooks/useVaccinationSocket", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("VaccinationsDashboard batch columns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("admin.vaccinations.activeTab", "schedule");

    apiClient.getDashboardInfants.mockResolvedValue([]);
    apiClient.getInfants.mockResolvedValue([]);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineInventory.mockResolvedValue([]);
    apiClient.getVaccineInventoryStatus.mockResolvedValue({ clinicId: 7, batches: [] });
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [],
      summary: { completed: 0, dueSoon: 0, overdue: 0, trackedInfants: 0 },
      metadata: { page: 1, limit: 9, total: 0, totalPages: 0 },
    });
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [
        {
          row_id: "1-1-1",
          infant_id: 1,
          infant_name: "Baby One",
          infant_dob: "2025-12-01",
          infant_context: {
            id: 1,
            first_name: "Baby",
            last_name: "One",
            full_name: "Baby One",
            display_name: "Baby One",
            control_number: "CTRL-1",
            dob: "2025-12-01",
          },
          vaccine_id: 1,
          vaccine_name: "BCG",
          disease_prevented: "At birth",
          age_label: "At Birth",
          dose_number: 1,
          total_doses: 1,
          due_date: "2026-01-10",
          admin_date: "2026-01-10",
          lot_batch_number: "BCG-LOT-001",
          expiration_date: "2027-01-31",
          status_key: "completed",
          status_label: "Completed",
        },
      ],
      summary: {
        upcoming: 0,
        due: 0,
        completed: 1,
        overdue: 0,
        trackedInfants: 1,
        totalRows: 1,
      },
      metadata: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    apiClient.getVaccinationRecords.mockResolvedValue([
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
        lot_batch_number: "BCG-LOT-001",
        expiration_date: "2027-01-31",
      },
    ]);
  });

  test("renders lot and expiration columns for schedule and records tabs", async () => {
    render(
      <MemoryRouter initialEntries={["/vaccination-management"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("columnheader", { name: /lot \/ batch number/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /expiration date/i })).toBeInTheDocument();
    expect(await screen.findByText("BCG-LOT-001")).toBeInTheDocument();
    expect(screen.getByText(new Date("2027-01-31").toLocaleDateString())).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /vaccination records/i }));

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).toHaveBeenCalled();
    });

    expect(
      await screen.findByRole("columnheader", { name: /lot \/ batch number/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /expiration date/i })).toBeInTheDocument();
    expect(screen.getAllByText("BCG-LOT-001").length).toBeGreaterThan(0);
  });
});
