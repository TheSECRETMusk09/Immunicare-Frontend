import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import InfantManagement from "../pages/InfantManagement";
import infantService from "../services/infantService";

jest.mock("../services/infantService", () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    isGuardian: false,
  }),
}));

jest.mock("../hooks/useInfantManagementSocket", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../components/VaccineScheduleBooklet", () => () => null);
jest.mock("../components/ImmunizationRecordBooklet", () => () => null);
jest.mock("../components/InfantPersonalRecord", () => () => null);
jest.mock("../components/ImmunizationChart", () => () => null);
jest.mock("../pages/TransferInCases", () => () => null);
jest.mock("../components/AddInfantModal", () => () => null);
jest.mock("../components/InjectVaccineModal", () => () => null);
jest.mock("../components/VaccineReadinessManager", () => () => null);

describe("Infant management system scope loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    infantService.getAll.mockResolvedValue({
      data: [
        {
          id: 1,
          first_name: "Christian",
          last_name: "Samorin",
          dob: "2026-03-20",
          sex: "male",
          guardian_name: "Christine Samorin",
          control_number: "INF-2026-357447",
          pending_vaccinations: 0,
          completed_vaccinations: 0,
          imported_vaccinations: 0,
          workflow_status: "up_to_date",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 5001,
        totalPages: 251,
        hasNext: true,
        hasPrev: false,
      },
      summary: {
        total: 5001,
        needsReview: 693,
        withImportedHistory: 541,
        pendingVaccinations: 563,
      },
    });
  });

  test("requests full system infant scope for admin listings", async () => {
    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
      });
    });

    expect(await screen.findByText("5001")).toBeInTheDocument();
    expect(screen.getByText(/showing 20 of 5001 infants/i)).toBeInTheDocument();
    expect(screen.getByText(/christian samorin/i)).toBeInTheDocument();
  });
});
