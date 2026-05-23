import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfant: jest.fn(),
    getVaccinationRecordsByInfant: jest.fn(),
    getVaccinationSchedules: jest.fn(),
  },
}));

jest.mock("../components/UI", () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Alert: ({ children }) => <div>{children}</div>,
  LoadingSpinner: () => <div>Loading...</div>,
}));

const findVisibleRowByLabel = async (label) => {
  await waitFor(() => {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  return screen
    .getAllByText(label)
    .map((node) => node.closest("tr"))
    .find((row) => row && !row.closest(".hidden"));
};

describe("ImmunizationRecordBooklet vaccine-series matching", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getInfant.mockResolvedValue({
      id: 575021,
      first_name: "Bea",
      last_name: "Alonzo",
      dob: "2026-05-17",
      sex: "Female",
    });

    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([
      {
        id: 1,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2026-05-17",
        status: "completed",
      },
      {
        id: 2,
        vaccine_id: 3,
        vaccine_name: "Hep B",
        dose_no: 1,
        admin_date: "2026-05-17",
        status: "completed",
      },
    ]);

    apiClient.getVaccinationSchedules.mockResolvedValue([
      {
        id: 101,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_number: 1,
        due_date: "2026-05-17",
        status: "completed",
      },
      {
        id: 102,
        vaccine_id: 3,
        vaccine_name: "Hepa B",
        dose_number: 1,
        due_date: "2026-05-17",
        status: "completed",
      },
      {
        id: 103,
        vaccine_id: 4,
        vaccine_name: "Penta Valent",
        dose_number: 1,
        due_date: "2026-06-28",
        status: "upcoming",
      },
      {
        id: 104,
        vaccine_id: 4,
        vaccine_name: "Penta Valent",
        dose_number: 2,
        due_date: "2026-07-26",
        status: "upcoming",
      },
      {
        id: 105,
        vaccine_id: 4,
        vaccine_name: "Penta Valent",
        dose_number: 3,
        due_date: "2026-08-23",
        status: "upcoming",
      },
    ]);
  });

  test("keeps Hep B at-birth completion from being assigned to the Pentavalent row", async () => {
    render(<ImmunizationRecordBooklet infantId={575021} />);

    await screen.findByText(/child immunization record booklet/i);

    const hepatitisBRow = await findVisibleRowByLabel("Hepatitis B Vaccine");
    const pentavalentRow = await findVisibleRowByLabel(
      "Pentavalent Vaccine (DPT-Hep B-HIB)",
    );

    expect(hepatitisBRow).toBeTruthy();
    expect(pentavalentRow).toBeTruthy();

    expect(within(hepatitisBRow).getByText("05/17/2026")).toBeInTheDocument();
    expect(
      within(pentavalentRow).queryByText("05/17/2026"),
    ).not.toBeInTheDocument();
    expect(
      within(pentavalentRow).queryByText(/^completed$/i),
    ).not.toBeInTheDocument();
  });
});
