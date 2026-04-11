import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import VaccinationsDashboard from "../pages/VaccinationsDashboard";
import apiClient from "../utils/api";
import useVaccinationSocket from "../hooks/useVaccinationSocket";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getDashboardInfants: jest.fn(),
    getVaccinationRecords: jest.fn(),
    getVaccinationReconciliationRecords: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getInfants: jest.fn(),
    getVaccines: jest.fn(),
    getSystemUsers: jest.fn(),
    getAnalyticsDashboard: jest.fn(),
  },
}));

jest.mock("../hooks/useVaccinationSocket", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));

const renderVaccinationsDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/vaccination-management"]}>
      <VaccinationsDashboard />
    </MemoryRouter>,
  );

const readMetricValue = (label) =>
  screen.getByText(label).previousElementSibling?.textContent?.trim();

describe("Vaccinations dashboard metric consistency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-29T08:00:00.000Z"));

    useVaccinationSocket.mockImplementation(() => undefined);
    apiClient.getSystemUsers.mockResolvedValue([]);
    apiClient.getAnalyticsDashboard.mockResolvedValue(null);
    apiClient.getVaccinationReconciliationRecords.mockResolvedValue([]);
    apiClient.getDashboardInfants.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("summary cards use full schedule-derived counts instead of only pending record rows", async () => {
    apiClient.getVaccinationRecords.mockResolvedValue([
      {
        id: 901,
        patient_id: 1,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2026-03-20",
        status: "completed",
        patient_first_name: "Baby",
        patient_last_name: "One",
      },
    ]);
    apiClient.getVaccinationReconciliationRecords.mockResolvedValue([
      {
        id: 901,
        patient_id: 1,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2026-03-20",
        status: "completed",
        patient_first_name: "Baby",
        patient_last_name: "One",
      },
    ]);

    apiClient.getVaccinationSchedules.mockResolvedValue([
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
        total_doses: 1,
        age_in_months: 2,
        description: "2 months",
        is_active: true,
      },
    ]);

    apiClient.getDashboardInfants.mockResolvedValue([
      {
        id: 1,
        first_name: "Baby",
        last_name: "One",
        dob: "2026-03-20",
        sex: "female",
      },
      {
        id: 2,
        first_name: "Baby",
        last_name: "Two",
        dob: "2026-03-25",
        sex: "male",
      },
      {
        id: 3,
        first_name: "Baby",
        last_name: "Three",
        dob: "2026-01-31",
        sex: "female",
      },
      {
        id: 4,
        first_name: "Future",
        last_name: "Seed",
        dob: "2030-06-01",
        sex: "male",
      },
    ]);

    apiClient.getVaccines.mockResolvedValue([
      { id: 1, name: "BCG", code: "BCG", doses_required: 1 },
      { id: 2, name: "Penta Valent", code: "PENTA", doses_required: 1 },
    ]);

    renderVaccinationsDashboard();

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationReconciliationRecords).toHaveBeenCalledWith({
        scope: "system",
      });
      expect(apiClient.getVaccinationRecords).not.toHaveBeenCalled();
      expect(apiClient.getDashboardInfants).toHaveBeenCalledWith({
        scope: "system",
        exclude_future_dob: true,
        fields: "lite",
        page: 1,
        limit: 10000,
      });
    });

    expect(readMetricValue("Completed Vaccinations")).toBe("1");
    expect(readMetricValue("Due Soon (7 Days)")).toBe("1");
    expect(readMetricValue("Overdue Vaccinations")).toBe("2");
    expect(readMetricValue("Children Tracked")).toBe("3");
    expect(screen.queryByText(/future seed/i)).not.toBeInTheDocument();
  });
});
