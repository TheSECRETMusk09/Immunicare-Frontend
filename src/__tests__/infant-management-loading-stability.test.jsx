import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import InfantPersonalRecord from "../components/InfantPersonalRecord";
import VaccineScheduleBooklet from "../components/VaccineScheduleBooklet";
import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import ImmunizationChart from "../components/ImmunizationChart";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    customRequest: jest.fn(),
    getInfant: jest.fn(),
    updateInfant: jest.fn(),
    getDynamicSchedule: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getVaccinationRecordsByInfant: jest.fn(),
    getAppointmentsByInfant: jest.fn(),
    getGrowthRecordsByInfant: jest.fn(),
    getVaccines: jest.fn(),
    getVaccineBatches: jest.fn(),
    createGrowthRecord: jest.fn(),
    createVaccinationRecord: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    isGuardian: false,
  }),
}));

const baseInfant = {
  id: 1,
  first_name: "Baby",
  last_name: "One",
  middle_name: "A",
  dob: "2025-01-01",
  sex: "F",
  control_number: "001",
  mother_name: "Mother One",
  father_name: "Father One",
  address: "San Nicolas",
  barangay: "San Nicolas",
  health_center: "Barangay San Nicolas Health Center",
  purok: "Purok 7",
  street_color: "Bedana / Dimanlig St. - Red",
};

const baseSchedule = [
  {
    id: 11,
    vaccine_id: 10,
    vaccine_name: "BCG",
    disease_prevented: "Tuberculosis",
    age_in_months: 0,
    dose_number: 1,
    is_active: true,
  },
];

const baseDynamicSchedule = {
  infantInfo: {
    firstName: "Baby",
    lastName: "One",
    controlNumber: "001",
    dateOfBirth: "2025-01-01",
    guardianName: "Mother One",
  },
  summary: {
    totalScheduled: 1,
    completedCount: 0,
    overdueCount: 0,
    upcomingCount: 1,
  },
  schedules: [
    {
      vaccineId: 1,
      vaccineName: "BCG",
      ageMonths: 0,
      ageDescription: "At Birth",
      doseNumber: 1,
      totalDoses: 1,
      status: "upcoming",
      dueDate: "2025-01-01",
      adminDate: null,
      daysOverdue: 0,
      isOverdue: false,
      isUpcoming: true,
    },
  ],
};

const renderStrict = (ui) => render(<React.StrictMode>{ui}</React.StrictMode>);

describe("Infant module loading stability under StrictMode lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();

    apiClient.getInfant.mockResolvedValue(baseInfant);
    apiClient.updateInfant.mockResolvedValue(baseInfant);
    apiClient.request.mockResolvedValue({ success: true, data: [] });
    apiClient.customRequest.mockResolvedValue({ data: [] });
    apiClient.getDynamicSchedule.mockResolvedValue(baseDynamicSchedule);
    apiClient.getVaccinationSchedules.mockResolvedValue(baseSchedule);
    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([]);
    apiClient.getAppointmentsByInfant.mockResolvedValue([]);
    apiClient.getGrowthRecordsByInfant.mockResolvedValue([]);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineBatches.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  test("InfantPersonalRecord exits loading state after StrictMode effect replay", async () => {
    renderStrict(<InfantPersonalRecord infantId={1} />);

    expect(screen.getByText(/loading infant record/i)).toBeInTheDocument();

    await screen.findByText(/infant personal information record/i);

    expect(screen.queryByText(/loading infant record/i)).not.toBeInTheDocument();
    expect(apiClient.getInfant).toHaveBeenCalled();
  });

  test("InfantPersonalRecord renders saved purok details in health center information", async () => {
    renderStrict(<InfantPersonalRecord infantId={1} />);

    await screen.findByText(/health center information/i);

    expect(screen.getByText("Purok 7")).toBeInTheDocument();
    expect(
      screen.getByText("Bedana / Dimanlig St. - Red"),
    ).toBeInTheDocument();
  });

  test("VaccineScheduleBooklet exits loading state after StrictMode effect replay", async () => {
    renderStrict(<VaccineScheduleBooklet infantId={1} />);

    expect(screen.getByText(/loading vaccine schedule/i)).toBeInTheDocument();

    const scheduleHeadings = await screen.findAllByText(
      /child immunization schedule booklet/i,
    );
    expect(scheduleHeadings.length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByText(/loading vaccine schedule/i)).not.toBeInTheDocument();
    expect(apiClient.getDynamicSchedule).toHaveBeenCalledWith(1);
  });

  test("ImmunizationRecordBooklet exits loading state after StrictMode effect replay", async () => {
    renderStrict(<ImmunizationRecordBooklet infantId={1} />);

    expect(screen.getByText(/loading immunization records/i)).toBeInTheDocument();

    const recordHeadings = await screen.findAllByText(
      /child immunization record booklet/i,
    );
    expect(recordHeadings.length).toBeGreaterThanOrEqual(1);

    expect(
      screen.queryByText(/loading immunization records/i),
    ).not.toBeInTheDocument();
    expect(apiClient.getVaccinationRecordsByInfant).toHaveBeenCalled();
  });

  test("ImmunizationChart exits loading state after StrictMode effect replay", async () => {
    renderStrict(<ImmunizationChart infantId={1} />);

    expect(screen.getByText(/loading immunization chart/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/detailed visit records for/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/loading immunization chart/i)).not.toBeInTheDocument();
    expect(apiClient.getAppointmentsByInfant).toHaveBeenCalled();
    expect(apiClient.getGrowthRecordsByInfant).toHaveBeenCalled();
  });
});
