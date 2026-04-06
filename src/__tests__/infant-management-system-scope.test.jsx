import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, useLocation } from "react-router-dom";

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
jest.mock("../pages/TransferInCases", () => {
  const React = require("react");

  return {
    __esModule: true,
    default: React.forwardRef((_props, _ref) => (
      <div>Transfer-In Cases Panel</div>
    )),
  };
});
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

  const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location-probe">{location.search}</div>;
  };

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

  test("opens the transfer-in cases view from the header button without leaving the infant workflow", async () => {
    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByText(/christian samorin/i);

    fireEvent.click(screen.getByRole("button", { name: /transfer-in cases/i }));

    expect(await screen.findByText("Transfer-In Cases Panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to infants/i })).toBeInTheDocument();
    expect(screen.getByTestId("location-probe")).toHaveTextContent("?view=transfer-in");
  });
});
