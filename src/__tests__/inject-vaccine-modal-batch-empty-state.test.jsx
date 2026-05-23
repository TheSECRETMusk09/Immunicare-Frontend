import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        include_history: true,
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

  test("keeps overdue OPV 20-doses selectable when the dose is past due", async () => {
    apiClient.getVaccines.mockResolvedValue([
      {
        id: 5,
        name: "OPV 20-doses",
        code: "OPV",
        allowed_brands: [],
      },
    ]);
    apiClient.getEligibleVaccines.mockResolvedValue({
      eligibleVaccines: [],
      upcomingVaccines: [],
      notEligibleVaccines: [
        {
          vaccineId: 5,
          vaccineName: "OPV 20-doses",
          nextDoseNumber: 2,
          totalDoses: 3,
          dueDate: "2026-05-11",
          status: "interval_not_met",
          reason: "Must wait 23 more days before next dose",
        },
      ],
      completedVaccines: [],
    });

    render(
      <InjectVaccineModal
        isOpen
        infantId={1}
        prefillContext={{ infant_id: 1 }}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    const vaccineSelect = await screen.findByDisplayValue("Select Vaccine");

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: /overdue: opv 20-doses - dose 2\/3 \(due: 2026-05-11\)/i,
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(vaccineSelect, { target: { value: "5" } });

    await waitFor(() => {
      expect(vaccineSelect).toHaveValue("5");
      expect(screen.getByLabelText(/dose number/i)).toHaveValue(2);
    });
  });

  test("shows the full approved vaccine list even when eligibility only returns a subset", async () => {
    apiClient.getVaccines.mockResolvedValue([
      { id: 1, name: "BCG", code: "BCG", allowed_brands: [] },
      { id: 2, name: "Hepa B", code: "HEPB", allowed_brands: [] },
      { id: 3, name: "IPV multi dose", code: "IPV", allowed_brands: [] },
      { id: 4, name: "MMR", code: "MMR", allowed_brands: [] },
      { id: 5, name: "OPV 20-doses", code: "OPV", allowed_brands: [] },
      { id: 6, name: "Penta Valent", code: "PENTA", allowed_brands: [] },
      { id: 7, name: "PCV 13/PCV 10", code: "PCV", allowed_brands: [] },
    ]);
    apiClient.getEligibleVaccines.mockResolvedValue({
      eligibleVaccines: [
        {
          vaccineId: 6,
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

    render(
      <InjectVaccineModal
        isOpen
        infantId={1}
        prefillContext={{ infant_id: 1 }}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "BCG" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Hepa B" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /ready: penta valent - dose 2\/3/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "PCV 13/PCV 10" })).toBeInTheDocument();
    });
  });

  test("filters administered-by suggestions to the selected role and keeps the list role-scoped after clearing the name", async () => {
    apiClient.getSystemUsers.mockResolvedValue({
      data: [
        {
          id: 200113,
          role_name: "physician",
          username: "admin",
          clinic_id: 203,
          facility_id: 203,
          is_active: true,
        },
        {
          id: 3101,
          role_name: "nurse",
          username: "nurse.one",
          first_name: "Nurse",
          last_name: "One",
          clinic_id: 203,
          facility_id: 203,
          is_active: true,
        },
        {
          id: 4101,
          role_name: "midwife",
          username: "midwife.one",
          first_name: "Midwife",
          last_name: "One",
          clinic_id: 203,
          facility_id: 203,
          is_active: true,
        },
      ],
    });

    renderModal();

    const roleSelect = await screen.findByLabelText(/administered by role/i);
    const nameInput = await screen.findByLabelText(/administered by name/i);

    fireEvent.change(roleSelect, { target: { value: "midwife" } });

    await waitFor(() => {
      expect(roleSelect).toHaveValue("midwife");
      expect(nameInput).toHaveValue("");
    });

    fireEvent.focus(nameInput);
    fireEvent.change(nameInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByText("Midwife One")).toBeInTheDocument();
    });

    expect(screen.queryByText("admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Nurse One")).not.toBeInTheDocument();
  });
});
