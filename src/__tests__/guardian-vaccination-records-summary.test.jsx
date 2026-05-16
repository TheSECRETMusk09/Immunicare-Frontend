import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import UserVaccinationRecords from "../pages/UserVaccinationRecords";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    guardianId: 12,
  }),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfantsByGuardian: jest.fn(),
    getVaccinationsByInfant: jest.fn(),
    getInfantVaccinationSchedule: jest.fn(),
    getVaccinationReadiness: jest.fn(),
  },
}));

jest.mock("../components/GuardianModuleHeader", () => ({
  __esModule: true,
  default: ({ title, actions }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

jest.mock("../components/GuardianTopHeader", () => ({
  __esModule: true,
  default: () => <div data-testid="guardian-top-header" />,
}));

jest.mock("../components/GuardianVaccinationCompletionModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../components/ImmunizationRecordBooklet", () => ({
  __esModule: true,
  default: () => <div data-testid="record-booklet" />,
}));

jest.mock("../components/UI", () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Card: ({ children, className = "" }) => <div className={className}>{children}</div>,
  Input: (props) => <input {...props} />,
}));

jest.mock("../utils/telemetry", () => ({
  trackEvent: jest.fn(),
}));

const byTextContent = (pattern) => (_, node) =>
  pattern.test(node?.textContent?.replace(/\s+/g, " ").trim() || "");

describe("guardian vaccination records summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getInfantsByGuardian.mockResolvedValue([
      {
        id: 101,
        first_name: "Christian",
        last_name: "Samorin",
        dob: "2025-01-01",
        sex: "M",
        control_number: "INF-101",
      },
    ]);

    apiClient.getVaccinationsByInfant.mockResolvedValue([
      {
        id: 1,
        vaccine_name: "Hepa B",
        dose_no: 1,
        admin_date: "2025-01-01",
        status: "completed",
      },
    ]);

    apiClient.getInfantVaccinationSchedule.mockResolvedValue({
      infant: {
        id: 101,
      },
      summary: {
        totalVaccines: 7,
        completed: 2,
        upcoming: 3,
        overdue: 1,
      },
      schedule: [
        { vaccineId: 1, vaccineName: "Hepa B", doseNumber: 1, status: "completed" },
        { vaccineId: 1, vaccineName: "Hepa B", doseNumber: 2, status: "completed" },
        { vaccineId: 1, vaccineName: "Hepa B", doseNumber: 3, status: "upcoming" },
        { vaccineId: 2, vaccineName: "BCG", doseNumber: 1, status: "upcoming" },
        { vaccineId: 3, vaccineName: "MMR", doseNumber: 1, status: "upcoming" },
        { vaccineId: 4, vaccineName: "PCV", doseNumber: 1, status: "overdue" },
        {
          vaccineId: 6,
          vaccineName: "Penta Valent",
          vaccineFullName: "Pentavalent Vaccine (DPT-Hep B-HIB)",
          doseNumber: 1,
          ageDescription: "1.5 months",
          status: "upcoming",
        },
        { vaccineId: 5, vaccineName: "IPV", doseNumber: 1, status: "pending_confirmation" },
      ],
    });

    apiClient.getVaccinationReadiness.mockResolvedValue({
      success: true,
      data: {
        readinessStatus: "UPCOMING",
        dueVaccines: [],
        overdueVaccines: [],
        blockedVaccines: [],
        nextAppointmentPrediction: {
          date: "2030-03-04",
        },
      },
    });
  });

  test("uses the canonical schedule summary for completed, upcoming, and overdue metrics", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/vaccination-records/101"]}>
        <Routes>
          <Route
            path="/guardian/vaccination-records/:childId"
            element={<UserVaccinationRecords />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.getInfantVaccinationSchedule).toHaveBeenCalledWith(101);
    });

    expect(screen.getAllByText(byTextContent(/^2\s*Completed$/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(byTextContent(/^3\s*Upcoming$/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(byTextContent(/^1\s*Overdue$/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/2\s*\/\s*7/)).toBeInTheDocument();
  });

  test("prefers booklet-ready schedule labels for vaccine names and age slots", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/vaccination-records/101"]}>
        <Routes>
          <Route
            path="/guardian/vaccination-records/:childId"
            element={<UserVaccinationRecords />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Pentavalent Vaccine (DPT-Hep B-HIB)"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1½ mos").length).toBeGreaterThan(0);
  });
});
