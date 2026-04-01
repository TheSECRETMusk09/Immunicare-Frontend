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
    getAvailableInventoryLots: jest.fn(),
    getSystemUsers: jest.fn(),
    getVaccinationRecordsByInfant: jest.fn(),
    getEligibleVaccines: jest.fn(),
    getVaccineInventoryStatus: jest.fn(),
    recordVaccinationWithInventory: jest.fn(),
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

describe("InjectVaccineModal FEFO and brand empty states", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getVaccines.mockResolvedValue([
      {
        id: 4,
        name: "Penta Valent",
        code: "PENTA",
        allowed_brands: [],
      },
    ]);
    apiClient.getInfants.mockResolvedValue([
      {
        id: 1,
        first_name: "Alvin",
        last_name: "Torres",
        dob: "2026-02-26T16:00:00.000Z",
      },
    ]);
    apiClient.getVaccineInventory.mockResolvedValue([]);
    apiClient.getAvailableInventoryLots.mockResolvedValue([]);
    apiClient.getSystemUsers.mockResolvedValue({ data: [] });
    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([]);
    apiClient.getEligibleVaccines.mockResolvedValue({
      eligibleVaccines: [
        {
          vaccineId: 4,
          vaccineName: "Penta Valent",
          nextDoseNumber: 2,
          totalDoses: 3,
          status: "ready",
        },
      ],
      upcomingVaccines: [],
      notEligibleVaccines: [],
      completedVaccines: [],
    });
    apiClient.getVaccineInventoryStatus.mockResolvedValue({ clinicId: 203, batches: [] });
  });

  afterEach(() => {
    cleanup();
  });

  const renderModal = () =>
    render(
      <InjectVaccineModal
        isOpen
        infantId={1}
        prefillContext={{ infant_id: 1, vaccine_id: 4, dose_number: 2 }}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

  test("uses available inventory lots and auto-selects a matched FEFO batch", async () => {
    apiClient.getVaccineInventory.mockResolvedValue([
      {
        id: 21,
        vaccine_id: 4,
        clinic_id: 203,
        lot_batch_number: "PENTA-FEFO-001",
        stock_on_hand: 9,
      },
    ]);
    apiClient.getAvailableInventoryLots.mockResolvedValue([
      {
        batch_id: 301,
        vaccine_id: 4,
        lot_number: "PENTA-FEFO-001",
        available_quantity: 9,
        expiry_date: "2026-06-01",
      },
    ]);

    renderModal();

    await waitFor(() => {
      expect(apiClient.getAvailableInventoryLots).toHaveBeenCalledWith({
        vaccine_id: 4,
      });
    });

    const batchSelect = await screen.findByLabelText(/batch source \(fefo\)/i);
    await waitFor(() => {
      expect(batchSelect).toHaveValue("301");
    });

    expect(
      screen.queryByText(
        /No non-expired FEFO batch with available stock was found for the selected vaccine\./i,
      ),
    ).not.toBeInTheDocument();
  });

  test("shows one FEFO empty-state helper and keeps brand selection non-blocking when no brands are configured", async () => {
    renderModal();

    expect(
      await screen.findByText(
        /No non-expired FEFO batch with available stock was found for the selected vaccine\./i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/No valid FEFO batch source available for this vaccine/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No approved vaccine brands are configured for the selected vaccine/i),
    ).not.toBeInTheDocument();

    const vaccineBrandSelect = screen.getByLabelText(/vaccine brand/i);
    expect(vaccineBrandSelect).toBeDisabled();
    expect(
      within(vaccineBrandSelect).getByRole("option", { name: "Brand optional" }),
    ).toBeInTheDocument();
  });
});