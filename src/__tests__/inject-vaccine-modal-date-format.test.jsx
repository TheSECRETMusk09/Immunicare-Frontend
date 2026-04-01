import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import InjectVaccineModal from "../components/InjectVaccineModal";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getVaccines: jest.fn(),
    getInfants: jest.fn(),
    getVaccineInventory: jest.fn(),
    getSystemUsers: jest.fn(),
    getVaccinationRecordsByInfant: jest.fn(),
    getEligibleVaccines: jest.fn(),
    getVaccineInventoryStatus: jest.fn(),
    createVaccinationRecord: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: {
      id: 200113,
      clinic_id: 203,
      first_name: "Sam",
      last_name: "Orin",
      role: "admin",
    },
  }),
}));

jest.mock("../components/VaccineEligibilityIndicator", () => () => null);

describe("InjectVaccineModal infant dropdown labels", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getInfants.mockResolvedValue([
      {
        id: 1,
        first_name: "Alvin",
        last_name: "Torres",
        dob: "2026-02-26T16:00:00.000Z",
      },
      {
        id: 2,
        first_name: "Noel",
        last_name: "Bacani",
        dob: "2025-10-09T16:00:00.000Z",
      },
    ]);
    apiClient.getVaccineInventory.mockResolvedValue([]);
    apiClient.getSystemUsers.mockResolvedValue({ data: [] });
    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([]);
    apiClient.getEligibleVaccines.mockResolvedValue({
      eligibleVaccines: [],
      upcomingVaccines: [],
      notEligibleVaccines: [],
      completedVaccines: [],
    });
    apiClient.getVaccineInventoryStatus.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  test("formats infant birth dates in the Select Infant dropdown using Manila local time", async () => {
    render(
      <InjectVaccineModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    const infantSelect = await screen.findByLabelText(/select infant/i);

    await waitFor(() => {
      expect(within(infantSelect).getByRole("option", { name: "Alvin Torres (Feb 27, 2026)" })).toBeInTheDocument();
      expect(within(infantSelect).getByRole("option", { name: "Noel Bacani (Oct 10, 2025)" })).toBeInTheDocument();
    });

    expect(
      within(infantSelect).queryByRole("option", {
        name: /2026-02-26T16:00:00\.000Z/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/2025-10-09T16:00:00\.000Z/i)).not.toBeInTheDocument();
  });
});