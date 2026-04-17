import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import GuardianImmunizationChart from "../components/GuardianImmunizationChart";

import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfantVaccinationSchedule: jest.fn(),
  },
}));

describe("GuardianImmunizationChart dead full-chart action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.getInfantVaccinationSchedule.mockResolvedValue({
      schedule: [
        {
          vaccine: { id: 1, name: "BCG" },
          dose: { number: 1, total: 1, completed: 0 },
          status: "upcoming",
          schedule: {
            dueDate: "2026-03-18",
            description: "At birth",
          },
        },
      ],
      summary: {
        totalVaccines: 1,
        completed: 0,
        ready: 0,
        upcoming: 1,
        overdue: 0,
        pendingConfirmation: 0,
      },
    });
  });

  test("does not render the removed View Full Chart CTA", async () => {
    render(
      <MemoryRouter>
        <GuardianImmunizationChart childId={42} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Immunization Schedule")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /view full chart/i }),
    ).not.toBeInTheDocument();
  });
});
