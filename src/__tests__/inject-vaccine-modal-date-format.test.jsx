import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    const infantSelect = await screen.findByRole("button", { name: /select infant/i });

    expect(apiClient.getInfants).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 50,
        page: 1,
        orderBy: "dob",
        orderDirection: "DESC",
        scope: "system",
      }),
    );

    fireEvent.click(infantSelect);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /alvin torres/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /noel bacani/i })).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("option", {
        name: /2026-02-26T16:00:00\.000Z/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/2025-10-09T16:00:00\.000Z/i)).not.toBeInTheDocument();
  });

  test("keeps the selected searched infant name visible after the base infant list refreshes", async () => {
    jest.useFakeTimers();

    apiClient.getInfants
      .mockResolvedValueOnce([
        {
          id: 1,
          first_name: "Alvin",
          last_name: "Torres",
          dob: "2026-02-26T16:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          first_name: "Alvin",
          last_name: "Torres",
          dob: "2026-02-26T16:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 77,
          first_name: "Christian",
          last_name: "Samorin",
          dob: "2026-03-15T16:00:00.000Z",
          control_number: "INF-2026-357447",
        },
      ])
      .mockResolvedValue([
        {
          id: 1,
          first_name: "Alvin",
          last_name: "Torres",
          dob: "2026-02-26T16:00:00.000Z",
        },
      ]);

    render(
      <InjectVaccineModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    const infantSelect = await screen.findByRole("button", { name: /select infant/i });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    fireEvent.click(infantSelect);

    const searchInput = await screen.findByPlaceholderText(
      /search by name, control number, or date of birth/i,
    );

    fireEvent.change(searchInput, { target: { value: "christian samorin" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const christianOption = await screen.findByRole("button", {
      name: /christian samorin/i,
    });

    fireEvent.click(christianOption);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /christian samorin \(mar 16, 2026\)/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/^Infant record$/i)).not.toBeInTheDocument();

    jest.useRealTimers();
  });
});
