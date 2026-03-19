import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import GuardianImmunizationChart from "../components/GuardianImmunizationChart";

import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfantVaccinationSchedule: jest.fn(),
  },
}));

describe("GuardianImmunizationChart - View Full Chart navigation", () => {
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

  test("navigates to child-specific guardian route without hard reload fallback", () => {
    render(
      <MemoryRouter initialEntries={["/guardian/dashboard"]}>
        <Routes>
          <Route
            path="/guardian/dashboard"
            element={<GuardianImmunizationChart childId={42} />}
          />
          <Route
            path="/guardian/immunization-chart/:childId"
            element={<div>Reached Child Full Chart</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    return screen
      .findByRole("button", {
        name: /view full chart/i,
      })
      .then((viewFullChartButton) => {
        fireEvent.click(viewFullChartButton);

        expect(screen.getByText("Reached Child Full Chart")).toBeInTheDocument();
      });
  });

  test("uses provided onViewFullChart callback when passed from parent", () => {
    const onViewFullChart = jest.fn();

    render(
      <MemoryRouter>
        <GuardianImmunizationChart childId={7} onViewFullChart={onViewFullChart} />
      </MemoryRouter>,
    );

    return screen
      .findByRole("button", {
        name: /view full chart/i,
      })
      .then((viewFullChartButton) => {
        fireEvent.click(viewFullChartButton);

        expect(onViewFullChart).toHaveBeenCalledTimes(1);
      });
  });
});
