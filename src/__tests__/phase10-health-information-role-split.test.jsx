import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import HealthInformation from "../pages/HealthInformation";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfantsByGuardian: jest.fn(),
    getInfants: jest.fn(),
    getHealthRecordsByInfant: jest.fn(),
    getGrowthRecordsByInfant: jest.fn(),
  },
}));

const mockUseAuth = jest.fn();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <HealthInformation />
    </MemoryRouter>,
  );

describe("Phase 10 health information role split", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.getHealthRecordsByInfant.mockResolvedValue([]);
    apiClient.getGrowthRecordsByInfant.mockResolvedValue([]);
  });

  test("guardian mode loads own children and shows caregiver guidance", async () => {
    mockUseAuth.mockReturnValue({
      guardianId: 91,
      isAdmin: false,
      isGuardian: true,
    });
    apiClient.getInfantsByGuardian.mockResolvedValue([
      {
        id: 7,
        first_name: "Jamie",
        last_name: "Doe",
        dob: "2025-10-01",
        sex: "F",
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(apiClient.getInfantsByGuardian).toHaveBeenCalledWith(91);
    });

    expect(await screen.findByRole("heading", { name: /health guidance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view growth charts/i })).toBeInTheDocument();
    expect(screen.getByText(/age-based care guidance/i)).toBeInTheDocument();
  });

  test("admin mode loads all child records and shows operational guidance", async () => {
    mockUseAuth.mockReturnValue({
      guardianId: null,
      isAdmin: true,
      isGuardian: false,
    });
    apiClient.getInfants.mockResolvedValue([
      {
        id: 12,
        first_name: "Ava",
        last_name: "Cruz",
        dob: "2025-05-01",
        sex: "F",
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(apiClient.getInfants).toHaveBeenCalled();
    });

    expect(apiClient.getInfantsByGuardian).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /open reports/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /campaign & care guidance/i })).toBeInTheDocument();
    expect(screen.getByText(/education campaigns/i)).toBeInTheDocument();
  });
});
