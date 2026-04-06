import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ImmunizationChart from "../components/ImmunizationChart";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  getInfant: jest.fn(),
  getAppointmentsByInfant: jest.fn(),
  getGrowthRecordsByInfant: jest.fn(),
  getVaccinationRecordsByInfant: jest.fn(),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin" },
  }),
}));

jest.mock("../components/VisitRecordingForm", () => () => null);

describe("ImmunizationChart visual controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.getInfant.mockResolvedValue({
      id: 1,
      first_name: "Andrei",
      last_name: "Reyes",
      dob: "2023-07-28",
      sex: "F",
    });
    apiClient.getAppointmentsByInfant.mockResolvedValue([]);
    apiClient.getGrowthRecordsByInfant.mockResolvedValue([]);
    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([]);
  });

  test("keeps Word export accessible while removing the visible label and chart date-range text", async () => {
    render(<ImmunizationChart infantId={1} />);

    await waitFor(() => {
      expect(apiClient.getInfant).toHaveBeenCalledWith(1);
    });

    expect(
      await screen.findByRole("button", { name: "Download Word" }),
    ).toBeInTheDocument();

    expect(screen.queryByText("Download Word")).not.toBeInTheDocument();
    expect(screen.queryByText("All immunization chart records")).not.toBeInTheDocument();

    const barangayLogos = screen.getAllByAltText("Barangay San Nicolas logo");
    expect(barangayLogos[0]).toHaveClass("immunization-chart__logo--shield");
    expect(barangayLogos[1]).toHaveClass("immunization-chart-print__logo--shield");
  });
});
